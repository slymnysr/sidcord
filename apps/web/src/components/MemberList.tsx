import { useMemo } from 'react';
import { useAppDispatch, useAppSelector, openProfileCard } from '../store';
import type { APIMember } from '../api';

export function MemberList() {
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const members = useAppSelector((s) => (guildId ? s.members.byGuild[guildId] ?? [] : []));
  const onlineIds = useAppSelector((s) => (guildId ? s.presence.onlineByGuild[guildId] ?? [] : []));

  const onlineSet = useMemo(() => new Set(onlineIds), [onlineIds]);

  if (!guildId) return null;

  const online: APIMember[] = [];
  const offline: APIMember[] = [];
  for (const m of members) {
    if (onlineSet.has(m.user_id)) online.push(m);
    else offline.push(m);
  }

  return (
    <aside className="w-60 bg-surface-1 border-l border-line overflow-y-auto py-3">
      {members.length === 0 && (
        <p className="px-4 text-sm text-ink-tertiary text-center py-6">
          Üye listesi yükleniyor...
        </p>
      )}

      {online.length > 0 && (
        <Group label="Çevrimiçi" count={online.length} members={online} online />
      )}
      {offline.length > 0 && (
        <Group label="Çevrimdışı" count={offline.length} members={offline} online={false} />
      )}
    </aside>
  );
}

function Group({
  label,
  count,
  members,
  online,
}: {
  label: string;
  count: number;
  members: APIMember[];
  online: boolean;
}) {
  const dispatch = useAppDispatch();
  return (
    <section className="mb-5">
      <div className="px-4 mb-2 text-[11px] font-bold text-ink-tertiary uppercase tracking-[0.08em] flex items-center justify-between">
        <span>{label}</span>
        <span className="text-ink-muted">{count}</span>
      </div>
      <ul className="px-2 space-y-0.5">
        {members.map((m) => (
          <li key={m.user_id}>
            <button
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                dispatch(openProfileCard({ userId: m.user_id, anchorRect: rect }));
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
          </li>
        ))}
      </ul>
    </section>
  );
}
