import { useEffect, useMemo } from 'react';
import { Hash, Volume2, AtSign } from 'lucide-react';
import { useAppSelector } from '../store';

interface Props {
  type: '@' | '#';
  query: string;
  onPick: (text: string) => void;
  onClose: () => void;
}

export function MentionPicker({ type, query, onPick, onClose }: Props) {
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const members = useAppSelector((s) => (guildId ? s.members.byGuild[guildId] ?? [] : []));
  const channels = useAppSelector((s) => (guildId ? s.channels.byGuild[guildId] ?? [] : []));

  const items = useMemo(() => {
    const q = query.toLowerCase();
    if (type === '@') {
      const u = members
        .filter((m) => (m.nickname ?? m.display_name).toLowerCase().includes(q) || m.username.toLowerCase().includes(q))
        .slice(0, 8);
      return u.map((m) => ({
        key: m.user_id,
        label: m.nickname ?? m.display_name,
        sub: '@' + m.username,
        color: m.avatar_color,
        replacement: `<@${m.user_id}>`,
      }));
    }
    const cs = channels
      .filter((c) => c.type !== 'category' && c.name.toLowerCase().includes(q))
      .slice(0, 8);
    return cs.map((c) => ({
      key: c.id,
      label: c.name,
      sub: c.type === 'voice' ? 'sesli' : c.type,
      color: c.type === 'voice' ? '#7C7CDD' : '#5865F2',
      replacement: `<#${c.id}>`,
    }));
  }, [type, query, members, channels]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (items.length === 0) return null;

  return (
    <div className="absolute bottom-full left-2 right-2 mb-1 bg-surface-1 border border-line rounded-xl shadow-2xl max-h-60 overflow-y-auto z-10">
      <div className="text-[10px] font-bold uppercase text-ink-tertiary tracking-wider px-3 py-2 border-b border-line flex items-center gap-1.5">
        {type === '@' ? <AtSign size={12} /> : <Hash size={12} />}
        {type === '@' ? 'Üyeler' : 'Kanallar'}
        <span className="text-ink-muted">— {items.length} sonuç</span>
      </div>
      <ul>
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(it.replacement);
              }}
              className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-surface-2 transition-colors"
            >
              {type === '@' ? (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: it.color }}
                >
                  {it.label.slice(0, 1).toUpperCase()}
                </div>
              ) : (
                <span className="w-6 h-6 flex items-center justify-center shrink-0">
                  {it.sub === 'sesli' ? (
                    <Volume2 size={14} className="text-ink-tertiary" />
                  ) : (
                    <Hash size={14} className="text-ink-tertiary" />
                  )}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink-primary truncate font-medium">{it.label}</div>
                <div className="text-[10px] text-ink-tertiary truncate">{it.sub}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
