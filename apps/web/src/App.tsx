import { useEffect, useRef, useState } from 'react';
import { Volume2, ScreenShare, Video, PhoneCall, Mic } from 'lucide-react';
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
} from './store';
import { tokenStore } from './api';
import { connectGateway, joinGuild, joinUser, disconnectGateway, onGuildEvent } from './gateway';

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

  // Login sonrası guild'leri çek + user kanalına abone ol
  useEffect(() => {
    if (user) {
      dispatch(fetchGuilds());
      connectGateway();
      joinUser(user.id, {
        onDMMessage: (event: any) => {
          if (event.author) dispatch(upsertUser(event.author));
          if (event.message) dispatch(pushMessage(event.message));
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
    joinGuild(guildId, {
      onMessage: (event: any) => {
        if (event.author) dispatch(upsertUser(event.author));
        if (event.message) dispatch(pushMessage(event.message));
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

  // Kanal seçiminde mesajları çek
  useEffect(() => {
    if (!channelId) return;
    dispatch(fetchMessages(channelId));
  }, [channelId, dispatch]);

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
    </div>
  );
}

function FriendsHub() {
  const dispatch = useAppDispatch();
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-bg text-center px-6">
      <div className="w-24 h-24 rounded-3xl bg-brand-500/10 text-brand-500 flex items-center justify-center mb-6">
        <img src="/brand/logo.svg" width={64} height={64} alt="" />
      </div>
      <h2 className="text-2xl font-bold text-ink-primary mb-2">Arkadaşlar</h2>
      <p className="text-ink-secondary max-w-md mb-6">
        Soldaki listeden bir konuşma seç veya bir kişiye mesaj göndermek için profil kartından
        başla.
      </p>
      <button
        onClick={() => dispatch(openModal('friends'))}
        className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-semibold transition-colors"
      >
        Arkadaş Ekle
      </button>
    </div>
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
