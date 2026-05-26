import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import {
  Hash,
  Volume2,
  Megaphone,
  MessagesSquare,
  Mic,
  ChevronDown,
  Settings,
  LogOut,
  UserPlus,
  Pencil,
  Lock,
  Trash2,
  Link as LinkIcon,
  BellOff,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import {
  useAppDispatch,
  useAppSelector,
  selectChannel,
  logout,
  openModal,
  fetchVoicePresence,
  fetchChannels,
  openEditChannel,
  openChannelPerms,
} from '../store';
import { api, type APIChannel } from '../api';
import { VoiceStatusBar } from './VoiceStatusBar';

const ChannelIcon: Record<string, LucideIcon> = {
  text: Hash,
  voice: Volume2,
  announcement: Megaphone,
  forum: MessagesSquare,
  stage: Mic,
  category: Hash,
};

export function ChannelList() {
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const all = useAppSelector((s) => (guildId ? s.channels.byGuild[guildId] ?? [] : []));
  const selectedId = useAppSelector((s) => s.channels.selectedId);
  const voiceByChannel = useAppSelector((s) => s.presence.voiceByChannel);
  const usersById = useAppSelector((s) => s.users.byId);
  const dispatch = useAppDispatch();

  // Voice kanalları için periyodik presence çek
  useEffect(() => {
    const voiceChannels = all.filter((c) => c.type === 'voice').map((c) => c.id);
    if (voiceChannels.length === 0) return;
    const tick = () => {
      dispatch(fetchVoicePresence(voiceChannels));
    };
    tick();
    const t = setInterval(tick, 8000);
    return () => clearInterval(t);
  }, [all, dispatch]);

  // Kategorilere göre grupla — kategori type='category', diğer kanallar parent_id'yi referans alır
  const categories = all
    .filter((c) => c.type === 'category')
    .sort((a, b) => a.position - b.position);
  const byParent: Record<string, APIChannel[]> = {};
  const uncategorized: APIChannel[] = [];
  for (const ch of all) {
    if (ch.type === 'category') continue;
    if (ch.parent_id) {
      (byParent[ch.parent_id] ??= []).push(ch);
    } else {
      uncategorized.push(ch);
    }
  }
  for (const k of Object.keys(byParent)) {
    byParent[k].sort((a, b) => a.position - b.position);
  }
  uncategorized.sort((a, b) => a.position - b.position);

  function renderChannel(ch: APIChannel) {
    const active = ch.id === selectedId;
    const Icon = ChannelIcon[ch.type] ?? Hash;
    const connected = ch.type === 'voice' ? voiceByChannel[ch.id] ?? [] : [];
    return (
      <li key={ch.id} className="relative">
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-brand-500 rounded-r-full" />
        )}
        <ChannelButton channel={ch} active={active} Icon={Icon} connectedCount={connected.length} />
        {ch.type === 'voice' && connected.length > 0 && (
          <ul className="ml-6 mt-0.5 space-y-0.5">
            {connected.map((uid: string) => {
              const u = usersById[uid];
              return (
                <li key={uid} className="flex items-center gap-2 px-2 py-0.5 text-xs text-ink-secondary">
                  <span className="w-2 h-2 rounded-full bg-status-online" />
                  <span className="truncate">{u?.display_name ?? uid}</span>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  }

  return (
    <aside className="w-64 bg-surface-1 flex flex-col border-r border-line">
      <GuildHeader />

      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-3">
        {!guildId && (
          <p className="text-sm text-ink-tertiary px-2 py-6 text-center">
            Sol kenardan bir sunucu seç veya oluştur.
          </p>
        )}
        {guildId && (
          <button
            onClick={() => dispatch(openModal('create_channel'))}
            className="w-full text-left px-3 py-2 rounded-md flex items-center gap-2 text-ink-secondary hover:bg-surface-2 hover:text-brand-500 transition-colors border border-dashed border-line hover:border-brand-500/40"
          >
            <span className="text-lg leading-none">+</span>
            <span className="text-sm font-medium">Kanal Oluştur</span>
          </button>
        )}
        {guildId && all.length === 0 && (
          <p className="text-sm text-ink-tertiary px-2 py-6 text-center">Kanal yok.</p>
        )}

        {/* Kategorisiz kanallar üstte */}
        {uncategorized.length > 0 && <ul className="space-y-0.5">{uncategorized.map(renderChannel)}</ul>}

        {/* Kategoriler ve altlarındaki kanallar */}
        {categories.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            children={byParent[cat.id] ?? []}
            renderChannel={renderChannel}
          />
        ))}
      </div>

      <VoiceStatusBar />
      <UserPanel />
    </aside>
  );
}

function CategorySection({
  category,
  children,
  renderChannel,
}: {
  category: APIChannel;
  children: APIChannel[];
  renderChannel: (ch: APIChannel) => React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  return (
    <section>
      <div
        onContextMenu={onContextMenu}
        className="px-2 mb-1 text-[11px] font-bold text-ink-tertiary uppercase tracking-[0.08em] flex items-center justify-between hover:text-ink-secondary group"
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1 flex-1 min-w-0 text-left"
        >
          <ChevronDown
            size={10}
            className={'transition-transform ' + (collapsed ? '-rotate-90' : '')}
          />
          <span className="truncate">{category.name}</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch(openModal('create_channel'))}
          title="Bu kategoriye kanal ekle"
          className="opacity-0 group-hover:opacity-100 text-base leading-none hover:text-ink-primary"
        >
          +
        </button>
      </div>
      {!collapsed && children.length > 0 && <ul className="space-y-0.5">{children.map(renderChannel)}</ul>}
      {menu && (
        <ChannelContextMenu
          channel={category}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
    </section>
  );
}

function ChannelButton({
  channel,
  active,
  Icon,
  connectedCount,
}: {
  channel: APIChannel;
  active: boolean;
  Icon: LucideIcon;
  connectedCount: number;
}) {
  const dispatch = useAppDispatch();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <button
        onClick={() => dispatch(selectChannel(channel.id))}
        onContextMenu={onContextMenu}
        className={clsx(
          'w-full text-left pl-3 pr-2 py-1.5 rounded-md flex items-center gap-2 transition-colors',
          active
            ? 'bg-brand-500/10 text-ink-primary'
            : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary',
        )}
      >
        <Icon size={16} className={active ? 'text-brand-500' : 'text-ink-tertiary'} />
        <span className="text-sm truncate font-medium">{channel.name}</span>
        {channel.type === 'voice' && connectedCount > 0 && (
          <span className="ml-auto text-[10px] text-brand-500 font-semibold">{connectedCount}</span>
        )}
      </button>
      {menu && (
        <ChannelContextMenu
          channel={channel}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  );
}

function ChannelContextMenu({
  channel,
  x,
  y,
  onClose,
}: {
  channel: APIChannel;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const ref = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  async function copyLink() {
    const url = `${location.origin}/channels/${channel.guild_id}/${channel.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    onClose();
  }

  async function toggleMute() {
    try {
      await api.channels.muteSettings(channel.id, {
        notif_level: muted ? 'all' : 'nothing',
      });
      setMuted(!muted);
    } catch {}
    onClose();
  }

  async function doDelete() {
    if (!guildId) return;
    if (!confirm(`#${channel.name} kanalını silmek istediğine emin misin?`)) {
      onClose();
      return;
    }
    try {
      await api.channels.delete(channel.id);
      await dispatch(fetchChannels(guildId));
    } catch (e) {
      console.warn('delete channel', e);
    }
    onClose();
  }

  // Sağ tık menüsünü viewport içine sığdır
  const cardWidth = 220;
  const cardHeight = 320;
  let left = x;
  let top = y;
  if (left + cardWidth > window.innerWidth) left = window.innerWidth - cardWidth - 8;
  if (top + cardHeight > window.innerHeight) top = window.innerHeight - cardHeight - 8;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={ref}
        style={{ left, top, width: cardWidth }}
        className="absolute bg-surface-1 border border-line rounded-xl shadow-2xl p-1 pointer-events-auto ring-1 ring-white/5"
      >
        <CtxItem
          icon={<Pencil size={14} />}
          label="Kanalı Düzenle"
          onClick={() => {
            dispatch(openEditChannel(channel.id));
            onClose();
          }}
        />
        <CtxItem
          icon={<Lock size={14} />}
          label="Kanal İzinleri"
          onClick={() => {
            dispatch(openChannelPerms(channel.id));
            onClose();
          }}
        />
        <CtxItem
          icon={muted ? <Bell size={14} /> : <BellOff size={14} />}
          label={muted ? 'Sesi Aç' : 'Sustur'}
          onClick={toggleMute}
        />
        <CtxItem
          icon={<LinkIcon size={14} />}
          label="Davet Oluştur"
          onClick={() => {
            dispatch(openModal('invite_link'));
            onClose();
          }}
        />
        <CtxItem
          icon={<LinkIcon size={14} />}
          label="Kanal Linkini Kopyala"
          onClick={copyLink}
        />
        <div className="my-1 h-px bg-line" />
        <CtxItem
          icon={<Trash2 size={14} />}
          label="Kanalı Sil"
          danger
          onClick={doDelete}
        />
      </div>
    </div>
  );
}

function CtxItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2.5 transition-colors',
        danger
          ? 'text-accent-500 hover:bg-accent-500/10'
          : 'text-ink-primary hover:bg-surface-2',
      )}
    >
      <span className={danger ? 'text-accent-500' : 'text-ink-tertiary'}>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

function GuildHeader() {
  const guild = useAppSelector((s) => s.guilds.list.find((g) => g.id === s.guilds.selectedId));
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!guild) {
    return (
      <div className="h-14 px-4 flex items-center border-b border-line">
        <h2 className="text-ink-tertiary font-semibold text-[15px]">Sunucu seç</h2>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-14 px-4 flex items-center gap-2 border-b border-line hover:bg-surface-2 active:bg-surface-3 transition-colors"
      >
        <div className="flex-1 min-w-0 text-left">
          <h2 className="text-ink-primary font-semibold text-[15px] truncate">{guild.name}</h2>
        </div>
        <ChevronDown
          size={18}
          className={'text-ink-secondary transition-transform ' + (open ? 'rotate-180' : '')}
        />
      </button>

      {open && (
        <div className="absolute top-full left-2 right-2 mt-1 bg-surface-1 border border-line rounded-xl shadow-2xl p-1 z-50">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              dispatch(openModal('invite_link'));
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-2 text-ink-primary flex items-center gap-2"
          >
            <UserPlus size={16} className="text-brand-500" />
            <span className="text-sm font-medium">Arkadaşları Davet Et</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              dispatch(openModal('server_settings'));
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-2 text-ink-primary flex items-center gap-2"
          >
            <Settings size={16} className="text-brand-500" />
            <span className="text-sm font-medium">Sunucu Ayarları</span>
          </button>
        </div>
      )}
    </div>
  );
}

function UserPanel() {
  const me = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const [status, setStatus] = useState<'online' | 'idle' | 'dnd' | 'offline'>(
    (me?.status as any) ?? 'online',
  );
  const [menuOpen, setMenuOpen] = useState(false);

  if (!me) return null;

  const statusColor: Record<string, string> = {
    online: 'bg-status-online',
    idle: 'bg-status-idle',
    dnd: 'bg-status-dnd',
    offline: 'bg-status-offline',
  };
  const statusLabel: Record<string, string> = {
    online: 'Çevrimiçi',
    idle: 'Uzakta',
    dnd: 'Rahatsız Etmeyin',
    offline: 'Görünmez',
  };

  async function changeStatus(s: 'online' | 'idle' | 'dnd' | 'offline') {
    setStatus(s);
    setMenuOpen(false);
    try {
      await api.updateStatus(s);
    } catch (e) {
      console.warn('status update', e);
    }
  }

  return (
    <div className="bg-surface-2 px-3 py-2.5 flex items-center gap-3 border-t border-line relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="relative shrink-0"
        title="Durum değiştir"
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: me.avatar_color }}
        >
          {me.display_name.slice(0, 1).toUpperCase()}
        </div>
        <span
          className={
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-surface-2 ' +
            (statusColor[status] ?? 'bg-status-offline')
          }
        />
      </button>
      {menuOpen && (
        <div className="absolute bottom-14 left-3 bg-surface-1 border border-line rounded-xl shadow-2xl p-1 z-30 w-44">
          {(['online', 'idle', 'dnd', 'offline'] as const).map((s) => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              className={
                'w-full text-left px-3 py-1.5 rounded flex items-center gap-2 ' +
                (s === status
                  ? 'bg-surface-2 text-ink-primary'
                  : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary')
              }
            >
              <span className={'w-2 h-2 rounded-full ' + statusColor[s]} />
              <span className="text-sm">{statusLabel[s]}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-ink-primary text-sm font-semibold truncate">{me.display_name}</div>
        <div className="text-ink-tertiary text-xs truncate">{statusLabel[status]}</div>
      </div>
      <button
        type="button"
        onClick={() => dispatch(logout())}
        title="Çıkış"
        className="w-8 h-8 rounded-md hover:bg-surface-3 text-ink-secondary hover:text-accent-500 flex items-center justify-center transition-colors"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}
