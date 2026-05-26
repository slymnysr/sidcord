import { useEffect, useRef, useState } from 'react';
import { MessageSquare, UserPlus, X, Check, Clock } from 'lucide-react';
import { api, type APIPublicUser } from '../api';
import { useAppDispatch, useAppSelector, selectChannel, setMode, selectDM, setPendingDM } from '../store';

type AnchorRect = { top: number; left: number; right: number; bottom: number; width: number; height: number };

interface Props {
  userId: string;
  onClose: () => void;
  anchorRect?: AnchorRect | null;
}

export function UserProfileCard({ userId, onClose, anchorRect }: Props) {
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.auth.user);
  const [user, setUser] = useState<APIPublicUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.users
      .user(userId)
      .then(setUser)
      .catch((e) => setError(e?.message ?? 'Yüklenemedi'));
  }, [userId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  // Pozisyon: anchor varsa yanına yerleştir, yoksa merkez
  const style: React.CSSProperties = {};
  if (anchorRect) {
    const cardWidth = 320;
    let left = anchorRect.right + 8;
    if (left + cardWidth > window.innerWidth) {
      left = anchorRect.left - cardWidth - 8;
    }
    if (left < 8) left = 8;
    style.left = left;
    style.top = Math.min(anchorRect.top, window.innerHeight - 420);
  } else {
    style.left = '50%';
    style.top = '50%';
    style.transform = 'translate(-50%, -50%)';
  }

  async function sendFriendRequest() {
    if (!user) return;
    setBusy(true);
    try {
      await fetch('/api/v1/friends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('sidcord_access'),
        },
        body: JSON.stringify({ user_id: user.id }),
      });
      setUser({ ...user, friendship_state: 'pending_sent' });
    } finally {
      setBusy(false);
    }
  }

  async function acceptFriend() {
    if (!user) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/friends/${user.id}/accept`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + localStorage.getItem('sidcord_access') },
      });
      setUser({ ...user, friendship_state: 'accepted' });
    } finally {
      setBusy(false);
    }
  }

  async function openDM() {
    if (!user) return;
    setBusy(true);
    try {
      const channelID =
        user.dm_channel_id ??
        (await api.dms.open(user.id)).channel_id;
      dispatch(setMode('dm'));
      dispatch(selectDM(channelID));
      dispatch(selectChannel(channelID));
      // Mesajsız DM olabilir; DMSidebar'a pinned olarak göster
      dispatch(setPendingDM({ channelId: channelID, partnerId: user.id }));
      onClose();
    } catch (e) {
      console.warn('open dm', e);
    } finally {
      setBusy(false);
    }
  }

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
    offline: 'Çevrimdışı',
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={ref}
        style={style}
        className="absolute w-80 bg-surface-1 border border-line rounded-2xl shadow-2xl ring-1 ring-white/5 pointer-events-auto overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-md hover:bg-surface-2 text-ink-secondary hover:text-ink-primary flex items-center justify-center z-10"
        >
          <X size={14} />
        </button>

        {error && (
          <div className="p-6 text-center text-accent-500 text-sm">{error}</div>
        )}

        {!user && !error && (
          <div className="p-6 text-center text-ink-tertiary text-sm">Yükleniyor...</div>
        )}

        {user && (
          <>
            <div
              className="h-20"
              style={{
                background: user.banner_url
                  ? `url(${user.banner_url}) center/cover`
                  : `linear-gradient(135deg, ${user.avatar_color}, ${user.avatar_color}80)`,
              }}
            />
            <div className="px-5 pb-5 -mt-10 relative">
              <div className="flex items-end justify-between mb-3">
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-full ring-4 ring-surface-1 flex items-center justify-center text-white text-2xl font-bold"
                    style={{ backgroundColor: user.avatar_color }}
                  >
                    {user.display_name.slice(0, 1).toUpperCase()}
                  </div>
                  <span
                    className={
                      'absolute bottom-1 right-1 w-5 h-5 rounded-full ring-4 ring-surface-1 ' +
                      statusColor[user.status]
                    }
                  />
                </div>
              </div>

              <div className="bg-surface-2 rounded-xl p-3">
                <h2 className="text-lg font-bold text-ink-primary flex items-center gap-2">
                  {user.display_name}
                  {user.bot && (
                    <span className="bg-brand-500/15 text-brand-500 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      BOT
                    </span>
                  )}
                </h2>
                <p className="text-sm text-ink-secondary">@{user.username}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  <span className={'w-2 h-2 rounded-full ' + statusColor[user.status]} />
                  <span className="text-ink-tertiary">{statusLabel[user.status]}</span>
                </div>

                {user.bio && (
                  <div className="mt-3 pt-3 border-t border-line">
                    <h3 className="text-[10px] font-bold uppercase text-ink-tertiary tracking-wider mb-1">
                      Hakkımda
                    </h3>
                    <p className="text-sm text-ink-primary leading-snug">{user.bio}</p>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-line">
                  <h3 className="text-[10px] font-bold uppercase text-ink-tertiary tracking-wider mb-1">
                    Sidcord Üye
                  </h3>
                  <p className="text-xs text-ink-secondary">
                    {new Date(user.created_at).toLocaleDateString('tr-TR', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                </div>

                {user.id !== me?.id && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={openDM}
                      disabled={busy}
                      className="flex-1 px-3 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      <MessageSquare size={14} />
                      Mesaj
                    </button>
                    {user.friendship_state === 'accepted' && (
                      <span className="px-3 py-2 rounded-lg bg-surface-3 text-ink-tertiary text-xs font-semibold flex items-center gap-1.5">
                        <Check size={14} /> Arkadaş
                      </span>
                    )}
                    {user.friendship_state === 'pending_sent' && (
                      <span className="px-3 py-2 rounded-lg bg-surface-3 text-ink-tertiary text-xs font-semibold flex items-center gap-1.5">
                        <Clock size={14} /> İstek gönderildi
                      </span>
                    )}
                    {user.friendship_state === 'pending_received' && (
                      <button
                        onClick={acceptFriend}
                        disabled={busy}
                        className="px-3 py-2 rounded-lg bg-surface-3 hover:bg-brand-500 hover:text-white text-ink-primary text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Check size={14} /> Kabul
                      </button>
                    )}
                    {!user.friendship_state && (
                      <button
                        onClick={sendFriendRequest}
                        disabled={busy}
                        className="px-3 py-2 rounded-lg bg-surface-3 hover:bg-brand-500 hover:text-white text-ink-primary text-xs font-semibold flex items-center gap-1.5"
                      >
                        <UserPlus size={14} /> Arkadaş Ekle
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
