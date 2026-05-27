import { useEffect, useRef, useState } from 'react';
import { Volume2, ScreenShare, Video, PhoneCall, Mic, Users, MessageCircle, X } from 'lucide-react';
import { voice } from './voice';
import { ServerRail } from './components/ServerRail';
import { ChannelList } from './components/ChannelList';
import { ChannelHeader } from './components/ChannelHeader';
import { MessageList } from './components/MessageList';
import { MessageInput } from './components/MessageInput';
import { MemberList } from './components/MemberList';
import { AuthPage } from './pages/AuthPage';
import { Modal } from './components/Modal';
import { DMSidebar } from './components/DMSidebar';
import { UserProfileCard } from './components/UserProfileCard';
import { ToastContainer } from './components/Toast';
import { ReconnectBanner } from './components/ReconnectBanner';
import {
  useAppDispatch,
  useAppSelector,
  fetchMe,
  fetchGuilds,
  fetchChannels,
  fetchMessages,
  fetchMembers,
  fetchReactions,
  pushMessage,
  updateMessage,
  removeMessage,
  upsertUser,
  setGuildPresence,
  setTyping,
  pruneTyping,
  openProfileCard,
  openModal,
  fetchReadStates,
  ackChannel,
  fetchGuildRoles,
} from './store';
import { tokenStore } from './api';
import { connectGateway, joinGuild, joinUser, disconnectGateway, onGuildEvent } from './gateway';
import { playMessageSound, playMentionSound } from './notifSound';

export default function App() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const channelId = useAppSelector((s) => s.channels.selectedId);
  const channels = useAppSelector((s) => (guildId ? s.channels.byGuild[guildId] : undefined));
  const channel = channels?.find((c) => c.id === channelId);
  const mode = useAppSelector((s) => s.ui.mode);
  const showMembers = useAppSelector((s) => s.ui.showMemberList);
  const profileCardUserId = useAppSelector((s) => s.ui.profileCardUserId);
  const profileCardAnchor = useAppSelector((s) => s.ui.profileCardAnchor);

  // F5 flash önlemi: token varsa /me tamamlanana kadar splash göster
  const [bootChecking, setBootChecking] = useState<boolean>(!!tokenStore.access() && !user);

  useEffect(() => {
    if (tokenStore.access() && !user) {
      dispatch(fetchMe()).finally(() => setBootChecking(false));
    } else {
      setBootChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Login sonrası guild'leri çek + user kanalına abone ol + read states
  useEffect(() => {
    if (user) {
      dispatch(fetchGuilds());
      dispatch(fetchReadStates());
      connectGateway();
      joinUser(user.id, {
        onDMMessage: (event: any) => {
          if (event.author) dispatch(upsertUser(event.author));
          if (event.message) {
            dispatch(pushMessage(event.message));
            // Başka kullanıcıdan DM → ses çal
            if (event.message.author_id !== user.id) playMentionSound();
          }
        },
      });
    }
    return () => {
      if (!user) disconnectGateway();
    };
  }, [user, dispatch]);

  // Guild seçiminde kanalları + üyeleri çek + gateway topic'e abone ol
  useEffect(() => {
    if (!guildId) return;
    dispatch(fetchChannels(guildId));
    dispatch(fetchMembers(guildId));
    dispatch(fetchGuildRoles(guildId));
    joinGuild(guildId, {
      onMessage: (event: any) => {
        if (event.author) dispatch(upsertUser(event.author));
        if (event.message) {
          dispatch(pushMessage(event.message));
          const msg = event.message;
          if (msg.author_id !== user!.id) {
            const mentioned =
              msg.content?.includes(`<@${user!.id}>`) ||
              msg.content?.includes('@everyone') ||
              msg.content?.includes('@here');
            if (mentioned) playMentionSound();
            else if (msg.channel_id !== channelId) playMessageSound();
          }
        }
      },
      onPresence: (ids) => {
        dispatch(setGuildPresence({ guildId, userIds: Array.from(ids) }));
      },
    });
    const offEdit = onGuildEvent(guildId, 'MESSAGE_UPDATE', (ev: any) => {
      if (ev.message) dispatch(updateMessage(ev.message));
    });
    const offDel = onGuildEvent(guildId, 'MESSAGE_DELETE', (ev: any) => {
      if (ev.message) {
        dispatch(removeMessage({ channel_id: ev.message.channel_id, id: ev.message.id }));
      }
    });
    const offReactAdd = onGuildEvent(guildId, 'REACTION_ADD', (ev: any) => {
      if (ev.message_id) dispatch(fetchReactions(ev.message_id));
    });
    const offReactRem = onGuildEvent(guildId, 'REACTION_REMOVE', (ev: any) => {
      if (ev.message_id) dispatch(fetchReactions(ev.message_id));
    });
    const offTyping = onGuildEvent(guildId, 'TYPING_START', (ev: any) => {
      if (ev.user_id && ev.channel_id) {
        dispatch(setTyping({ channelId: ev.channel_id, userId: ev.user_id }));
      }
    });
    // Soundboard event: voice kanaldaki herkes için ses dosyasını çal
    const offSound = onGuildEvent(guildId, 'SOUNDBOARD_PLAY', (ev: any) => {
      if (ev?.sound?.file_url) {
        try {
          const audio = new Audio(ev.sound.file_url);
          audio.volume = Math.min(1, Math.max(0, ev.sound.volume ?? 1));
          audio.play().catch(() => {});
        } catch {}
      }
    });
    const pruneInterval = setInterval(() => dispatch(pruneTyping()), 1000);
    return () => {
      offEdit();
      offDel();
      offReactAdd();
      offSound();
      offReactRem();
      offTyping();
      clearInterval(pruneInterval);
    };
  }, [guildId, dispatch]);

  // Kanal seçiminde mesajları çek + ACK (okundu işaretle)
  const lastMsgId = useAppSelector((s) => {
    if (!channelId) return null;
    const list = s.messages.byChannel[channelId];
    return list && list.length > 0 ? list[list.length - 1].id : null;
  });
  useEffect(() => {
    if (!channelId) return;
    dispatch(fetchMessages(channelId));
  }, [channelId, dispatch]);
  useEffect(() => {
    if (channelId && lastMsgId) {
      dispatch(ackChannel({ channelId, lastMessageId: lastMsgId }));
    }
  }, [channelId, lastMsgId, dispatch]);

  if (bootChecking) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <img
          src="/brand/logo.svg"
          width={80}
          height={80}
          alt="Sidcord"
          className="animate-pulse"
        />
      </div>
    );
  }
  if (!user) return <AuthPage />;

  const dmHubVisible = mode === 'dm' && !channelId;

  return (
    <div className="h-screen flex bg-bg text-ink-primary overflow-hidden">
      <ServerRail />
      {mode === 'dm' ? <DMSidebar /> : <ChannelList />}
      <main className="flex-1 flex flex-col min-w-0">
        <ChannelHeader />
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            {dmHubVisible ? (
              <FriendsHub />
            ) : channel?.type === 'voice' ? (
              <>
                <VoiceStage />
                <div className="flex-1 min-h-0 border-t border-line">
                  <MessageList />
                </div>
              </>
            ) : (
              <MessageList />
            )}
            {!dmHubVisible && <MessageInput />}
          </div>
          {showMembers && mode === 'guild' && <MemberList />}
        </div>
      </main>
      <Modal />
      {profileCardUserId && (
        <UserProfileCard
          userId={profileCardUserId}
          anchorRect={profileCardAnchor}
          onClose={() => dispatch(openProfileCard(null))}
        />
      )}
      <ToastContainer />
      <ReconnectBanner />
    </div>
  );
}

function FriendsHub() {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<'online' | 'all' | 'pending' | 'blocked'>('online');
  const [friends, setFriends] = useState<Awaited<ReturnType<typeof import('./api').api.friends.list>>>(
    [],
  );

  async function refresh() {
    try {
      const { api } = await import('./api');
      setFriends(await api.friends.list());
    } catch {}
  }
  useEffect(() => {
    refresh();
  }, []);

  const filtered = friends.filter((f) => {
    if (tab === 'online') return f.friendship_state === 'accepted' && f.status !== 'offline';
    if (tab === 'all') return f.friendship_state === 'accepted';
    if (tab === 'pending')
      return f.friendship_state === 'pending_sent' || f.friendship_state === 'pending_received';
    if (tab === 'blocked') return f.friendship_state === 'blocked';
    return false;
  });

  return (
    <div className="flex-1 flex flex-col bg-bg overflow-hidden">
      <div className="h-14 border-b border-line px-5 flex items-center gap-1">
        <Users size={20} className="text-ink-tertiary mr-2" />
        <h1 className="text-ink-primary font-semibold mr-4">Arkadaşlar</h1>
        <span className="w-px h-6 bg-line mx-1" />
        <FriendTab active={tab === 'online'} onClick={() => setTab('online')}>
          Çevrimiçi
        </FriendTab>
        <FriendTab active={tab === 'all'} onClick={() => setTab('all')}>
          Tümü
        </FriendTab>
        <FriendTab active={tab === 'pending'} onClick={() => setTab('pending')}>
          Bekleyen
        </FriendTab>
        <FriendTab active={tab === 'blocked'} onClick={() => setTab('blocked')}>
          Engelli
        </FriendTab>
        <button
          onClick={() => dispatch(openModal('friends'))}
          className="ml-2 px-3 py-1.5 rounded-md bg-status-online/15 hover:bg-status-online/25 text-status-online text-sm font-semibold"
        >
          Arkadaş Ekle
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="text-[11px] font-bold uppercase text-ink-tertiary tracking-wider mb-3">
          {tab === 'online'
            ? 'Çevrimiçi'
            : tab === 'all'
              ? 'Tüm Arkadaşlar'
              : tab === 'pending'
                ? 'Bekleyen İstekler'
                : 'Engelli'}{' '}
          — {filtered.length}
        </div>

        {filtered.length === 0 ? (
          <p className="text-ink-tertiary text-center py-12">
            {tab === 'online'
              ? 'Hiçbir arkadaşın çevrimiçi değil. Yalnız değilsin sıkıntı yok.'
              : tab === 'pending'
                ? 'Bekleyen istek yok.'
                : tab === 'blocked'
                  ? 'Engellediğin kimse yok.'
                  : 'Henüz arkadaşın yok.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((f) => (
              <FriendRow key={f.user_id} f={f} tab={tab} onRefresh={refresh} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FriendTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'px-3 py-1 rounded-md text-sm font-medium transition-colors ' +
        (active
          ? 'bg-surface-2 text-ink-primary'
          : 'text-ink-secondary hover:bg-surface-2/50 hover:text-ink-primary')
      }
    >
      {children}
    </button>
  );
}

function FriendRow({
  f,
  tab,
  onRefresh,
}: {
  f: any;
  tab: 'online' | 'all' | 'pending' | 'blocked';
  onRefresh: () => void;
}) {
  const dispatch = useAppDispatch();
  const statusColor: Record<string, string> = {
    online: 'bg-status-online',
    idle: 'bg-status-idle',
    dnd: 'bg-status-dnd',
    offline: 'bg-status-offline',
  };

  async function openDM() {
    const { api } = await import('./api');
    try {
      const r = await api.dms.open(f.user_id);
      dispatch({ type: 'ui/setMode', payload: 'dm' });
      dispatch({ type: 'ui/selectDM', payload: r.channel_id });
      dispatch({ type: 'channels/selectChannel', payload: r.channel_id });
    } catch {}
  }

  async function remove() {
    const { api } = await import('./api');
    await api.friends.remove(f.user_id).catch(() => {});
    onRefresh();
  }

  async function accept() {
    const { api } = await import('./api');
    await api.friends.accept(f.user_id).catch(() => {});
    onRefresh();
  }

  async function unblock() {
    const { api } = await import('./api');
    await api.unblock(f.user_id).catch(() => {});
    onRefresh();
  }

  return (
    <li className="flex items-center gap-3 py-3 group hover:bg-surface-1/40 -mx-2 px-2 rounded">
      <button
        onClick={(e) =>
          dispatch({
            type: 'ui/openProfileCard',
            payload: { userId: f.user_id, anchorRect: e.currentTarget.getBoundingClientRect() },
          })
        }
        className="relative shrink-0"
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: f.avatar_color }}
        >
          {f.display_name.slice(0, 1).toUpperCase()}
        </div>
        <span
          className={
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-bg ' +
            (statusColor[f.status] ?? 'bg-status-offline')
          }
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-ink-primary truncate">{f.display_name}</div>
        <div className="text-xs text-ink-tertiary truncate">
          @{f.username} ·{' '}
          {f.friendship_state === 'pending_sent'
            ? 'İstek gönderildi'
            : f.friendship_state === 'pending_received'
              ? 'Sana istek gönderdi'
              : f.friendship_state === 'blocked'
                ? 'Engelli'
                : f.status}
        </div>
      </div>
      <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
        {tab === 'pending' && f.friendship_state === 'pending_received' && (
          <button
            onClick={accept}
            className="px-3 py-1.5 rounded-md bg-status-online/15 hover:bg-status-online/25 text-status-online text-xs font-semibold"
          >
            Kabul Et
          </button>
        )}
        {tab !== 'blocked' && f.friendship_state === 'accepted' && (
          <button
            onClick={openDM}
            title="DM"
            className="w-9 h-9 rounded-full bg-surface-2 hover:bg-surface-3 text-ink-secondary hover:text-ink-primary flex items-center justify-center"
          >
            <MessageCircle size={16} />
          </button>
        )}
        {tab === 'blocked' ? (
          <button
            onClick={unblock}
            className="px-3 py-1.5 rounded-md bg-surface-2 hover:bg-status-online/25 hover:text-status-online text-ink-secondary text-xs font-semibold"
          >
            Engeli Kaldır
          </button>
        ) : (
          <button
            onClick={remove}
            title="Arkadaşlıktan çıkar"
            className="w-9 h-9 rounded-full bg-surface-2 hover:bg-accent-500 hover:text-white text-ink-secondary flex items-center justify-center"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </li>
  );
}

function VoiceStage() {
  const channelId = useAppSelector((s) => s.channels.selectedId);
  const me = useAppSelector((s) => s.auth.user);
  const [connected, setConnected] = useState(voice.channelId === channelId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [localCamera, setLocalCamera] = useState<MediaStream | null>(null);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const onChange = () => force((n) => n + 1);
    const onCamera = ({ stream }: any) => setLocalCamera(stream);
    const onScreen = ({ stream }: any) => setLocalScreen(stream);
    const onConn = () => setConnected(true);
    const onDisc = () => {
      setConnected(false);
      setCameraOn(false);
      setScreenOn(false);
    };
    voice.on('remotes:changed', onChange);
    voice.on('local:camera', onCamera);
    voice.on('local:screen', onScreen);
    voice.on('connected', onConn);
    voice.on('disconnected', onDisc);
    return () => {
      voice.off('remotes:changed', onChange);
      voice.off('local:camera', onCamera);
      voice.off('local:screen', onScreen);
      voice.off('connected', onConn);
      voice.off('disconnected', onDisc);
    };
  }, []);

  async function join() {
    if (!channelId) return;
    setBusy(true);
    setError(null);
    try {
      await voice.connect(channelId);
      setConnected(true);
    } catch (e: any) {
      setError(e?.message || 'Sese katılamadı');
    } finally {
      setBusy(false);
    }
  }

  async function toggleCamera() {
    try {
      if (cameraOn) {
        await voice.unpublishCamera();
        setCameraOn(false);
      } else {
        await voice.publishCamera();
        setCameraOn(true);
      }
    } catch (e: any) {
      setError(e?.message || 'Kamera açılamadı');
    }
  }

  async function toggleScreen() {
    try {
      if (screenOn) {
        await voice.unpublishScreen();
        setScreenOn(false);
      } else {
        await voice.publishScreen();
        setScreenOn(true);
      }
    } catch (e: any) {
      if (e?.name !== 'NotAllowedError') {
        setError(e?.message || 'Ekran paylaşılamadı');
      }
    }
  }

  if (!connected) {
    return (
      <div className="shrink-0 px-5 py-4 border-b border-line bg-surface-1 flex items-center gap-3">
        <Volume2 size={20} className="text-brand-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-primary">Sesli sohbet</div>
          {error && <div className="text-xs text-accent-500 truncate">{error}</div>}
        </div>
        <button
          onClick={join}
          disabled={busy}
          className="shrink-0 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:bg-surface-3 text-white text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <PhoneCall size={14} />
          {busy ? 'Bağlanıyor...' : 'Sese Katıl'}
        </button>
      </div>
    );
  }

  const videoTiles: { key: string; label: string; stream: MediaStream; me?: boolean }[] = [];
  if (localCamera) videoTiles.push({ key: 'self-cam', label: `${me?.display_name ?? 'Sen'} · kamera`, stream: localCamera, me: true });
  if (localScreen) videoTiles.push({ key: 'self-scr', label: `${me?.display_name ?? 'Sen'} · ekran`, stream: localScreen, me: true });
  for (const r of voice.remoteStreams()) {
    if (r.kind === 'video') {
      videoTiles.push({
        key: r.producerId,
        label: `${r.userId} · ${r.source === 'screen' ? 'ekran' : 'kamera'}`,
        stream: r.stream,
      });
    }
  }
  const audioPeers = new Set<string>();
  for (const r of voice.remoteStreams()) if (r.kind === 'audio') audioPeers.add(r.userId);

  return (
    <div className="shrink-0 max-h-[55%] flex flex-col bg-gradient-to-b from-surface-1 via-surface-1 to-brand-900/10 border-b border-line overflow-hidden">
      <div className="flex-1 p-4 overflow-y-auto min-h-[120px]">
        {videoTiles.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center gap-3">
            <Mic size={20} className="text-brand-500" />
            <p className="text-sm text-ink-secondary">
              {audioPeers.size > 0
                ? `${audioPeers.size + 1} kullanıcı bağlı · video açmak için aşağıdaki butonları kullan`
                : 'Sesli sohbet aktif · video açmak için aşağıdaki butonları kullan'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-fr">
            {videoTiles.map((t) => (
              <VideoTile key={t.key} stream={t.stream} label={t.label} isLocal={t.me} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line bg-surface-2 px-4 py-2 flex items-center justify-center gap-2 shrink-0">
        <button
          onClick={toggleCamera}
          className={
            'h-8 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ' +
            (cameraOn
              ? 'bg-brand-500 hover:bg-brand-400 text-white'
              : 'bg-surface-3 hover:bg-surface-1 text-ink-primary')
          }
          title={cameraOn ? 'Kamerayı kapat' : 'Kamerayı aç'}
        >
          <Video size={13} />
          {cameraOn ? 'Kamerayı Kapat' : 'Kamera'}
        </button>
        <button
          onClick={toggleScreen}
          className={
            'h-8 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ' +
            (screenOn
              ? 'bg-brand-500 hover:bg-brand-400 text-white'
              : 'bg-surface-3 hover:bg-surface-1 text-ink-primary')
          }
          title={screenOn ? 'Ekran paylaşımını kapat' : 'Ekran paylaş'}
        >
          <ScreenShare size={13} />
          {screenOn ? 'Ekranı Kapat' : 'Ekran Paylaş'}
        </button>
        {channelId && <SoundboardButton channelId={channelId} />}
      </div>
    </div>
  );
}

function SoundboardButton({ channelId }: { channelId: string }) {
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const [open, setOpen] = useState(false);
  const [sounds, setSounds] = useState<Awaited<ReturnType<typeof import('./api').api.sounds.list>>>(
    [],
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || !guildId) return;
    import('./api').then(({ api }) => api.sounds.list(guildId).then(setSounds).catch(() => {}));
  }, [open, guildId]);

  async function play(soundId: string) {
    const { api } = await import('./api');
    await api.sounds.play(soundId, channelId).catch(() => {});
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Soundboard"
        className="h-8 px-3 rounded-md text-xs font-semibold bg-surface-3 hover:bg-surface-1 text-ink-primary flex items-center gap-1.5"
      >
        🔊 Soundboard
      </button>
      {open && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-72 bg-surface-1 border border-line rounded-xl shadow-2xl p-2 z-30 max-h-64 overflow-y-auto">
          {sounds.length === 0 ? (
            <p className="text-xs text-ink-tertiary p-3 text-center">
              Henüz ses yok. Sunucu Ayarları &gt; Soundboard ile ekle.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sounds.map((s) => (
                <button
                  key={s.id}
                  onClick={() => play(s.id)}
                  className="aspect-square flex flex-col items-center justify-center gap-1 rounded-lg bg-surface-2 hover:bg-brand-500/15 transition-colors"
                  title={s.name}
                >
                  <span className="text-2xl">{s.emoji ?? '🔊'}</span>
                  <span className="text-[10px] truncate w-full px-1 text-center text-ink-primary">
                    {s.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VideoTile({ stream, label, isLocal }: { stream: MediaStream; label: string; isLocal?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <div className="relative bg-black rounded-2xl overflow-hidden border border-line aspect-video">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white font-medium">
        {label}
        {isLocal && <span className="ml-1 text-brand-400">(sen)</span>}
      </div>
    </div>
  );
}
