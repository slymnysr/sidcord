import { useEffect, useState } from 'react';
import { UserPlus, Hash } from 'lucide-react';
import { api, type APIDMChannel, type APIPublicUser } from '../api';
import { useAppDispatch, useAppSelector, openModal, selectDM, selectChannel, setPendingDM, switchToGuild } from '../store';
import { VoiceStatusBar } from './VoiceStatusBar';

export function DMSidebar() {
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.auth.user);
  const selectedDMId = useAppSelector((s) => s.ui.selectedDMChannelId);
  const pendingDM = useAppSelector((s) => s.ui.pendingDM);
  const [dms, setDMs] = useState<APIDMChannel[]>([]);
  const [partners, setPartners] = useState<Record<string, APIPublicUser>>({});

  async function refresh() {
    try {
      const list = await api.dms.list();
      setDMs(list);
      const userIds = new Set<string>();
      for (const dm of list) {
        for (const p of dm.participants) {
          if (p !== me?.id) userIds.add(p);
        }
      }
      if (pendingDM) userIds.add(pendingDM.partnerId);
      const ids = Array.from(userIds);
      const results = await Promise.all(
        ids.map((id) => api.users.user(id).catch(() => null)),
      );
      const next: Record<string, APIPublicUser> = {};
      for (let i = 0; i < ids.length; i++) {
        const u = results[i];
        if (u) next[ids[i]] = u;
      }
      setPartners(next);
      // Pending DM artık listeye geldiyse temizle (mesaj atılmış demektir)
      if (pendingDM && list.some((d) => d.id === pendingDM.channelId)) {
        dispatch(setPendingDM(null));
      }
    } catch (e) {
      console.warn('dm refresh', e);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, selectedDMId, pendingDM?.channelId]);

  // Pending DM listede mevcutsa zaten gösteriliyor, ekstra satır gereksiz
  const showPending =
    pendingDM && !dms.some((d) => d.id === pendingDM.channelId)
      ? pendingDM
      : null;

  function dmTitle(dm: APIDMChannel): string {
    const other = dm.participants.find((p) => p !== me?.id);
    if (!other) return dm.name || 'DM';
    return partners[other]?.display_name ?? `Kullanıcı ${other.slice(-4)}`;
  }

  function dmColor(dm: APIDMChannel): string {
    const other = dm.participants.find((p) => p !== me?.id);
    return partners[other ?? '']?.avatar_color ?? '#6B7280';
  }

  return (
    <aside className="w-64 bg-surface-1 flex flex-col border-r border-line">
      <header className="h-14 px-4 flex items-center border-b border-line">
        <h2 className="text-ink-primary font-semibold text-[15px]">Direkt Mesajlar</h2>
      </header>

      <div className="px-2.5 py-3 border-b border-line">
        <button
          onClick={() => dispatch(openModal('friends'))}
          className="w-full px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white font-semibold text-sm flex items-center gap-2 justify-center"
        >
          <UserPlus size={16} />
          Arkadaş Ekle
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2.5 space-y-0.5">
        <div className="px-2 mb-2 text-[11px] font-bold text-ink-tertiary uppercase tracking-[0.08em]">
          Doğrudan Mesajlar — {dms.length}
        </div>
        {dms.length === 0 && !showPending && (
          <p className="px-2 text-xs text-ink-tertiary">
            Henüz DM yok. "Arkadaş Ekle" ile başla.
          </p>
        )}
        {showPending && (() => {
          const partner = partners[showPending.partnerId];
          const title = partner?.display_name ?? `Kullanıcı ${showPending.partnerId.slice(-4)}`;
          const color = partner?.avatar_color ?? '#6B7280';
          const active = showPending.channelId === selectedDMId;
          return (
            <button
              onClick={() => {
                dispatch(selectDM(showPending.channelId));
                dispatch(selectChannel(showPending.channelId));
              }}
              className={
                'w-full text-left px-2 py-1.5 rounded-md flex items-center gap-2.5 transition-colors ' +
                (active
                  ? 'bg-brand-500/10 text-ink-primary'
                  : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary')
              }
              title="Henüz mesaj atılmadı"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 ring-1 ring-brand-500/40"
                style={{ backgroundColor: color }}
              >
                {title.slice(0, 1).toUpperCase()}
              </div>
              <span className="text-sm truncate font-medium flex-1">{title}</span>
              <span className="text-[9px] uppercase font-bold text-brand-500 tracking-wider">Yeni</span>
            </button>
          );
        })()}
        {dms.map((dm) => {
          const active = dm.id === selectedDMId;
          return (
            <button
              key={dm.id}
              onClick={() => {
                dispatch(selectDM(dm.id));
                dispatch(selectChannel(dm.id));
              }}
              className={
                'w-full text-left px-2 py-1.5 rounded-md flex items-center gap-2.5 transition-colors ' +
                (active
                  ? 'bg-brand-500/10 text-ink-primary'
                  : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary')
              }
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                style={{ backgroundColor: dmColor(dm) }}
              >
                {dmTitle(dm).slice(0, 1).toUpperCase()}
              </div>
              <span className="text-sm truncate font-medium">{dmTitle(dm)}</span>
            </button>
          );
        })}
      </div>

      <div className="px-2.5 pb-2 border-t border-line pt-2">
        <button
          onClick={() => dispatch(switchToGuild())}
          className="w-full px-2 py-1.5 rounded-md text-xs text-ink-tertiary hover:bg-surface-2 hover:text-ink-primary flex items-center gap-2"
        >
          <Hash size={12} />
          Sunucu görünümüne dön
        </button>
      </div>
      <VoiceStatusBar />
    </aside>
  );
}

