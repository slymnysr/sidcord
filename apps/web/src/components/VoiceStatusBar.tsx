import { useEffect, useState } from 'react';
import { Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { voice } from '../voice';
import { useAppSelector } from '../store';

export function useVoiceState() {
  const [connected, setConnected] = useState<boolean>(voice.isConnected());
  const [channelId, setChannelId] = useState<string | null>(voice.channelId);
  const [micOn, setMicOn] = useState<boolean>(voice.isMicrophoneEnabled());

  useEffect(() => {
    const onConn = ({ channelId: c }: any) => {
      setConnected(true);
      setChannelId(c);
      setMicOn(voice.isMicrophoneEnabled());
    };
    const onDisc = () => {
      setConnected(false);
      setChannelId(null);
    };
    const onMic = ({ enabled }: any) => setMicOn(enabled);
    voice.on('connected', onConn);
    voice.on('disconnected', onDisc);
    voice.on('mic:changed', onMic);
    return () => {
      voice.off('connected', onConn);
      voice.off('disconnected', onDisc);
      voice.off('mic:changed', onMic);
    };
  }, []);

  return { connected, channelId, micOn };
}

export function VoiceStatusBar() {
  const { connected, channelId, micOn } = useVoiceState();
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const channel = useAppSelector((s) =>
    guildId && channelId ? s.channels.byGuild[guildId]?.find((c) => c.id === channelId) : null,
  );
  const guild = useAppSelector((s) => s.guilds.list.find((g) => g.id === guildId));

  if (!connected || !channelId) return null;

  function toggleMic() {
    voice.setMicrophoneEnabled(!micOn);
  }

  async function leave() {
    try {
      await voice.disconnect();
    } catch {}
  }

  return (
    <div className="bg-surface-2 border-t border-line px-3 py-2 flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-status-online shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-status-online flex items-center gap-1">
          <Volume2 size={12} className="shrink-0" />
          <span className="truncate">Ses Bağlı</span>
        </div>
        <div className="text-[10px] text-ink-tertiary truncate">
          {channel?.name ? `#${channel.name}` : '—'}
          {guild?.name && ` / ${guild.name}`}
        </div>
      </div>
      <button
        onClick={toggleMic}
        title={micOn ? 'Mikrofonu kapat' : 'Mikrofonu aç'}
        className={
          'w-7 h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ' +
          (micOn
            ? 'text-ink-secondary hover:bg-surface-3 hover:text-ink-primary'
            : 'bg-accent-500/15 text-accent-500 hover:bg-accent-500/25')
        }
      >
        {micOn ? <Mic size={14} /> : <MicOff size={14} />}
      </button>
      <button
        onClick={leave}
        title="Sesten ayrıl"
        className="w-7 h-7 rounded-md text-ink-secondary hover:bg-accent-500 hover:text-white flex items-center justify-center transition-colors shrink-0"
      >
        <PhoneOff size={14} />
      </button>
    </div>
  );
}
