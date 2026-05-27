import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, User, AtSign, UserMinus, Ban as BanIcon, Clock } from 'lucide-react';
import {
  useAppDispatch,
  useAppSelector,
  openProfileCard,
  setMode,
  selectDM,
  selectChannel,
  setPendingDM,
} from '../store';
import { api, type APIMember } from '../api';

export function MemberList() {
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const members = useAppSelector((s) => (guildId ? s.members.byGuild[guildId] ?? [] : []));
  const roles = useAppSelector((s) => (guildId ? s.guilds.list.find((g) => g.id === guildId) : null));
  const allRoles = useAppSelector((s) => s.guildRoles?.byGuild?.[guildId ?? ''] ?? []);
  const onlineIds = useAppSelector((s) => (guildId ? s.presence.onlineByGuild[guildId] ?? [] : []));

  const onlineSet = useMemo(() => new Set(onlineIds), [onlineIds]);

  if (!guildId) return null;

  // Discord davranışı: hoist=true rollere göre üyeleri grupla
  // Her üye en yüksek hoist rolüne göre kümelenir
  const hoistRoles = allRoles
    .filter((r: any) => r.hoist && !r.is_everyone)
    .sort((a: any, b: any) => b.position - a.position);

  const onlineMembers: APIMember[] = [];
  const offlineMembers: APIMember[] = [];
  for (const m of members) {
    if (onlineSet.has(m.user_id)) onlineMembers.push(m);
    else offlineMembers.push(m);
  }

  // Her hoist rolü için online üyeleri topla
  const roleBuckets: { role: any; members: APIMember[] }[] = [];
  const assigned = new Set<string>();
  for (const r of hoistRoles) {
    const bucket: APIMember[] = [];
    for (const m of onlineMembers) {
      if (!assigned.has(m.user_id) && m.role_ids?.includes(r.id)) {
        bucket.push(m);
        assigned.add(m.user_id);
      }
    }
    if (bucket.length > 0) roleBuckets.push({ role: r, members: bucket });
  }
  const onlineRest = onlineMembers.filter((m) => !assigned.has(m.user_id));

  void roles;

  return (
    <aside className="w-60 bg-surface-1 border-l border-line overflow-y-auto py-3">
      {members.length === 0 && (
        <p className="px-4 text-sm text-ink-tertiary text-center py-6">
          Üye listesi yükleniyor...
        </p>
      )}

      {roleBuckets.map((b) => (
        <Group
          key={b.role.id}
          label={b.role.name}
          count={b.members.length}
          members={b.members}
          online
          color={`#${(b.role.color as number).toString(16).padStart(6, '0')}`}
        />
      ))}
      {onlineRest.length > 0 && (
        <Group
          label={roleBuckets.length > 0 ? 'Online' : 'Çevrimiçi'}
          count={onlineRest.length}
          members={onlineRest}
          online
        />
      )}
      {offlineMembers.length > 0 && (
        <Group label="Çevrimdışı" count={offlineMembers.length} members={offlineMembers} online={false} />
      )}
    </aside>
  );
}

function Group({
  label,
  count,
  members,
  online,
  color,
}: {
  label: string;
  count: number;
  members: APIMember[];
  online: boolean;
  color?: string;
}) {
  return (
    <section className="mb-5">
      <div
        className="px-4 mb-2 text-[11px] font-bold uppercase tracking-[0.08em] flex items-center justify-between"
        style={{ color: color ?? undefined }}
      >
        <span className={color ? '' : 'text-ink-tertiary'}>{label}</span>
        <span className="text-ink-muted">{count}</span>
      </div>
      <ul className="px-2 space-y-0.5">
        {members.map((m) => (
          <MemberRow key={m.user_id} m={m} online={online} />
        ))}
      </ul>
    </section>
  );
}

function MemberRow({ m, online }: { m: APIMember; online: boolean }) {
  const dispatch = useAppDispatch();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <li>
      <button
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
          dispatch(openProfileCard({ userId: m.user_id, anchorRect: rect }));
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        className="w-full px-2 py-1.5 rounded-md hover:bg-surface-2 flex items-center gap-3 text-left transition-colors"
      >
        <div className="relative shrink-0">
          <div
            className={
              'w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ' +
              (online ? '' : 'opacity-40')
            }
            style={{ backgroundColor: m.avatar_color }}
          >
            {(m.nickname ?? m.display_name).slice(0, 1).toUpperCase()}
          </div>
          <span
            className={
              'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-surface-1 ' +
              (online ? 'bg-status-online' : 'bg-status-offline')
            }
          />
        </div>
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
          <span
            className={
              'text-sm truncate font-medium ' +
              (online ? 'text-ink-primary' : 'text-ink-tertiary')
            }
          >
            {m.nickname ?? m.display_name}
          </span>
          {m.bot && (
            <span className="bg-brand-500/15 text-brand-500 text-[9px] font-semibold px-1 rounded">
              BOT
            </span>
          )}
        </div>
      </button>
      {menu && <MemberContextMenu m={m} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </li>
  );
}

function MemberContextMenu({
  m,
  x,
  y,
  onClose,
}: {
  m: APIMember;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const me = useAppSelector((s) => s.auth.user);
  const ref = useRef<HTMLDivElement>(null);

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

  async function openDM() {
    try {
      const r = await api.dms.open(m.user_id);
      dispatch(setMode('dm'));
      dispatch(selectDM(r.channel_id));
      dispatch(selectChannel(r.channel_id));
      dispatch(setPendingDM({ channelId: r.channel_id, partnerId: m.user_id }));
    } catch {}
    onClose();
  }

  async function kick() {
    if (!guildId) return;
    if (!confirm(`${m.display_name} kullanıcısını sunucudan atmak istiyor musun?`)) {
      onClose();
      return;
    }
    await api.guilds.kick(guildId, m.user_id).catch(() => {});
    onClose();
  }

  async function ban() {
    if (!guildId) return;
    const reason = prompt(`${m.display_name} için ban sebebi (boş bırakılabilir):`);
    if (reason === null) {
      onClose();
      return;
    }
    await api.guilds.ban(guildId, m.user_id, reason).catch(() => {});
    onClose();
  }

  async function timeoutMember() {
    if (!guildId) return;
    const mins = prompt('Timeout süresi (dakika)?', '10');
    if (!mins) {
      onClose();
      return;
    }
    const sec = parseInt(mins, 10) * 60;
    if (sec > 0) await api.guilds.timeout(guildId, m.user_id, sec).catch(() => {});
    onClose();
  }

  const isMe = me?.id === m.user_id;
  const cardWidth = 220;
  let left = x;
  let top = y;
  if (left + cardWidth > window.innerWidth) left = window.innerWidth - cardWidth - 8;
  if (top + 280 > window.innerHeight) top = window.innerHeight - 280 - 8;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={ref}
        style={{ left, top, width: cardWidth }}
        className="absolute bg-surface-1 border border-line rounded-xl shadow-2xl p-1 pointer-events-auto ring-1 ring-white/5"
      >
        <Item
          icon={<User size={14} />}
          label="Profili Görüntüle"
          onClick={() => {
            dispatch(openProfileCard({ userId: m.user_id, anchorRect: null }));
            onClose();
          }}
        />
        {!isMe && <Item icon={<MessageSquare size={14} />} label="Mesaj" onClick={openDM} />}
        {!isMe && (
          <Item
            icon={<AtSign size={14} />}
            label="Bahset"
            onClick={() => {
              const ev = new CustomEvent('sidcord:insert-text', {
                detail: { text: `<@${m.user_id}> ` },
              });
              window.dispatchEvent(ev);
              onClose();
            }}
          />
        )}
        {!isMe && (
          <>
            <div className="my-1 h-px bg-line" />
            <Item icon={<Clock size={14} />} label="Zaman Aşımı (Timeout)" onClick={timeoutMember} />
            <Item icon={<UserMinus size={14} />} label="Sunucudan At" danger onClick={kick} />
            <Item icon={<BanIcon size={14} />} label="Yasakla" danger onClick={ban} />
          </>
        )}
      </div>
    </div>
  );
}

function Item({
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
      className={
        'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2.5 transition-colors ' +
        (danger ? 'text-accent-500 hover:bg-accent-500/10' : 'text-ink-primary hover:bg-surface-2')
      }
    >
      <span className={danger ? 'text-accent-500' : 'text-ink-tertiary'}>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
