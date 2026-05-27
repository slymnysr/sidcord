import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { Plus, Compass } from 'lucide-react';
import { useAppDispatch, useAppSelector, openModal, switchToDM, switchToGuild } from '../store';
import type { APIGuild } from '../api';

export function ServerRail() {
  const guilds = useAppSelector((s) => s.guilds.list);
  const selectedId = useAppSelector((s) => s.guilds.selectedId);
  const mode = useAppSelector((s) => s.ui.mode);
  const dispatch = useAppDispatch();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <aside className="w-[76px] bg-bg flex flex-col items-center py-4 gap-3 border-r border-line">
      <button
        title="Arkadaşlar / Direkt Mesajlar"
        onClick={() => dispatch(switchToDM())}
        className={
          'w-12 h-12 rounded-xl bg-surface-1 border border-line hover:border-brand-500/40 hover:scale-105 flex items-center justify-center overflow-hidden transition-all ' +
          (mode === 'dm' ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-bg shadow-glow border-brand-500 scale-105' : '')
        }
      >
        <img src="/brand/logo.svg" width={36} height={36} alt="" />
      </button>
      <div className="w-8 h-px bg-line" />

      <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto w-full items-center">
        {guilds.length === 0 && (
          <p className="text-[10px] text-ink-tertiary text-center px-2 pt-3">
            Henüz sunucun yok
          </p>
        )}
        {guilds.map((g) => (
          <GuildIcon key={g.id} guild={g} active={g.id === selectedId && mode === 'guild'} />
        ))}
      </div>

      <div className="flex flex-col gap-2 items-center relative" ref={menuRef}>
        {menuOpen && (
          <div className="absolute bottom-0 left-full ml-3 w-56 bg-surface-1 border border-line rounded-xl shadow-2xl p-1 z-30">
            <button
              onClick={() => {
                setMenuOpen(false);
                dispatch(openModal('create_guild'));
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-2 text-ink-primary flex items-center gap-2"
            >
              <Plus size={16} className="text-brand-500" />
              <span className="text-sm font-medium">Sunucu Oluştur</span>
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                dispatch(openModal('join_guild'));
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-2 text-ink-primary flex items-center gap-2"
            >
              <Compass size={16} className="text-brand-500" />
              <span className="text-sm font-medium">Davet ile Katıl</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className={clsx(
            'w-12 h-12 rounded-xl bg-surface-1 hover:bg-brand-500/15 hover:text-brand-500 text-ink-secondary transition-colors flex items-center justify-center border border-line',
            menuOpen && 'bg-brand-500/15 text-brand-500',
          )}
          title="Sunucu Ekle"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => dispatch(openModal('join_guild'))}
          className="w-12 h-12 rounded-xl bg-surface-1 hover:bg-brand-500/15 hover:text-brand-500 text-ink-secondary transition-colors flex items-center justify-center border border-line"
          title="Davet ile Katıl"
        >
          <Compass size={20} />
        </button>
      </div>
    </aside>
  );
}

function GuildIcon({ guild, active }: { guild: APIGuild; active: boolean }) {
  const dispatch = useAppDispatch();
  // Bu sunucunun herhangi bir kanalında okunmamış mesaj var mı?
  const { hasUnread, totalMentions } = useAppSelector((s) => {
    const channels = s.channels.byGuild[guild.id] ?? [];
    let unread = false;
    let mentions = 0;
    for (const ch of channels) {
      if (ch.type === 'category') continue;
      const rs = s.readStates.byChannel[ch.id];
      mentions += rs?.mention_count ?? 0;
      if (
        ch.last_message_id &&
        (!rs?.last_message_id || rs.last_message_id < ch.last_message_id)
      ) {
        unread = true;
      }
    }
    return { hasUnread: unread, totalMentions: mentions };
  });

  return (
    <div className="relative">
      <button
        onClick={() => dispatch(switchToGuild(guild.id))}
        title={guild.name}
        className={clsx(
          'relative w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-[15px] tracking-tight transition-all duration-200',
          active
            ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-bg shadow-glow scale-105'
            : 'opacity-85 hover:opacity-100 hover:scale-105',
        )}
        style={{ backgroundColor: guild.icon_color }}
      >
        {guild.icon_text}
        {active && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-500" />
        )}
      </button>
      {/* Okunmamış göstergesi: sol kenarda beyaz dik bar, mention varsa kırmızı sayı */}
      {!active && hasUnread && (
        <span className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-1 h-2 rounded-r-full bg-ink-primary" />
      )}
      {totalMentions > 0 && (
        <span className="absolute -bottom-0.5 -right-0.5 min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-bg">
          {totalMentions > 99 ? '99+' : totalMentions}
        </span>
      )}
    </div>
  );
}
