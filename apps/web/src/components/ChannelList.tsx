import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { Hash, Volume2, Megaphone, MessagesSquare, Mic, ChevronDown, Settings, LogOut, UserPlus, type LucideIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector, selectChannel, logout, openModal, fetchVoicePresence } from '../store';
import { api, type APIChannel } from '../api';

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

  const groups: Record<string, APIChannel[]> = { Kanallar: all };

  return (
    <aside className="w-64 bg-surface-1 flex flex-col border-r border-line">
      <GuildHeader />

      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-5">
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
        {Object.entries(groups).map(([cat, list]) =>
          list.length === 0 ? null : (
            <section key={cat}>
              <div className="px-2 mb-1.5 text-[11px] font-bold text-ink-tertiary uppercase tracking-[0.08em] flex items-center justify-between">
                <span>{cat}</span>
                <ChevronDown size={12} />
              </div>
              <ul className="space-y-0.5">
                {list.map((ch) => {
                  const active = ch.id === selectedId;
                  const Icon = ChannelIcon[ch.type] ?? Hash;
                  const connected = ch.type === 'voice' ? voiceByChannel[ch.id] ?? [] : [];
                  return (
                    <li key={ch.id} className="relative">
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-brand-500 rounded-r-full" />
                      )}
                      <button
                        onClick={() => dispatch(selectChannel(ch.id))}
                        className={clsx(
                          'w-full text-left pl-3 pr-2 py-1.5 rounded-md flex items-center gap-2 transition-colors',
                          active
                            ? 'bg-brand-500/10 text-ink-primary'
                            : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary',
                        )}
                      >
                        <Icon size={16} className={active ? 'text-brand-500' : 'text-ink-tertiary'} />
                        <span className="text-sm truncate font-medium">{ch.name}</span>
                        {ch.type === 'voice' && connected.length > 0 && (
                          <span className="ml-auto text-[10px] text-brand-500 font-semibold">
                            {connected.length}
                          </span>
                        )}
                      </button>
                      {connected.length > 0 && (
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
                })}
              </ul>
            </section>
          ),
        )}
      </div>

      <UserPanel />
    </aside>
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
