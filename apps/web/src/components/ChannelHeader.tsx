import { useEffect, useState } from 'react';
import { Hash, Volume2, Megaphone, MessagesSquare, Mic, Users, UserPlus, Bell, Search, type LucideIcon } from 'lucide-react';
import { useAppDispatch, useAppSelector, toggleMemberList, openModal } from '../store';
import { api } from '../api';

const Icon: Record<string, LucideIcon> = {
  text: Hash,
  voice: Volume2,
  announcement: Megaphone,
  forum: MessagesSquare,
  stage: Mic,
  category: Hash,
};

export function ChannelHeader() {
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const channelId = useAppSelector((s) => s.channels.selectedId);
  const channel = useAppSelector((s) =>
    guildId && channelId ? s.channels.byGuild[guildId]?.find((c) => c.id === channelId) : null,
  );
  const showMembers = useAppSelector((s) => s.ui.showMemberList);
  const dispatch = useAppDispatch();
  const Ico = channel ? Icon[channel.type] ?? Hash : Hash;

  return (
    <header className="h-14 px-5 flex items-center gap-3 border-b border-line bg-bg">
      <Ico size={20} className="text-ink-tertiary" />
      <div className="flex items-baseline gap-3 min-w-0">
        <h1 className="text-ink-primary font-semibold truncate">{channel?.name ?? '—'}</h1>
        <span className="text-ink-tertiary text-xs hidden md:inline">
          {channel?.type === 'voice'
            ? 'Sesli kanal'
            : channel?.type === 'announcement'
              ? 'Duyuru kanalı'
              : 'Sohbet'}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => dispatch(openModal('search'))}
          title="Ara"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-secondary hover:bg-surface-2 hover:text-ink-primary transition-colors"
        >
          <Search size={18} />
        </button>
        <NotificationsBell />
        {guildId && (
          <button
            type="button"
            onClick={() => dispatch(openModal('invite_link'))}
            title="Sunucuya davet bağlantısı oluştur"
            className="h-9 px-3 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            <UserPlus size={16} />
            <span>Davet Et</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => dispatch(toggleMemberList())}
          title="Üye listesini aç/kapat"
          className={
            'w-9 h-9 rounded-lg flex items-center justify-center transition-colors text-ink-secondary ' +
            (showMembers ? 'bg-brand-500/15 text-brand-500' : 'hover:bg-surface-2 hover:text-ink-primary')
          }
        >
          <Users size={18} />
        </button>
      </div>
    </header>
  );
}

function NotificationsBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function refresh() {
      try {
        const r = await api.notifications.count();
        setCount(r.unread);
      } catch {}
    }
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  async function markAll() {
    await api.notifications.markAllRead().catch(() => {});
    setCount(0);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Bildirimler"
        className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-secondary hover:bg-surface-2 hover:text-ink-primary transition-colors relative"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent-500 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-72 bg-surface-1 border border-line rounded-xl shadow-2xl p-3 z-30">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-ink-primary">Bildirimler</h3>
            <button onClick={markAll} className="text-xs text-brand-500 hover:underline">
              Hepsini okundu işaretle
            </button>
          </div>
          <p className="text-sm text-ink-tertiary">
            {count === 0 ? 'Yeni bildirim yok.' : `${count} okunmamış bildirim`}
          </p>
        </div>
      )}
    </div>
  );
}
