import { useState } from 'react';
import { Hash, Volume2 } from 'lucide-react';
import { api, type APIChannel } from '../api';
import { useAppDispatch, useAppSelector, closeModal, fetchChannels } from '../store';

interface Props {
  channel: APIChannel;
}

export function ChannelEditModal({ channel }: Props) {
  const dispatch = useAppDispatch();
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? '');
  const [nsfw, setNsfw] = useState(channel.nsfw);
  const [rateLimit, setRateLimit] = useState(channel.rate_limit_sec);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!guildId) return;
    setBusy(true);
    setErr(null);
    try {
      const v = name.trim().toLowerCase().replace(/\s+/g, '-');
      await api.channels.update(channel.id, {
        name: v || channel.name,
        topic,
        nsfw,
        rate_limit_sec: rateLimit,
      });
      await dispatch(fetchChannels(guildId));
      dispatch(closeModal());
    } catch (e: any) {
      setErr(e?.message || 'Güncellenemedi');
    } finally {
      setBusy(false);
    }
  }

  const isVoice = channel.type === 'voice';

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-ink-primary mb-1">Kanalı Düzenle</h2>
      <p className="text-sm text-ink-secondary mb-5">#{channel.name}</p>

      <form onSubmit={submit}>
        <label className="block text-sm font-semibold text-ink-primary mb-1.5">Kanal Adı</label>
        <div className="relative mb-4">
          {isVoice ? (
            <Volume2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          ) : (
            <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full bg-surface-2 border border-line focus:border-brand-500/50 focus:outline-none rounded-lg pl-9 pr-3 py-2.5 text-ink-primary"
          />
        </div>

        {!isVoice && (
          <>
            <label className="block text-sm font-semibold text-ink-primary mb-1.5">Konu</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={1024}
              placeholder="Bu kanal ne hakkında?"
              className="w-full bg-surface-2 border border-line focus:border-brand-500/50 focus:outline-none rounded-lg px-3 py-2.5 text-ink-primary placeholder:text-ink-tertiary mb-4"
            />

            <label className="block text-sm font-semibold text-ink-primary mb-1.5">
              Yavaş Mod (sn)
            </label>
            <input
              type="number"
              min={0}
              max={21600}
              value={rateLimit}
              onChange={(e) => setRateLimit(Math.max(0, parseInt(e.target.value || '0', 10)))}
              className="w-full bg-surface-2 border border-line focus:border-brand-500/50 focus:outline-none rounded-lg px-3 py-2.5 text-ink-primary mb-4"
            />
            <p className="text-xs text-ink-tertiary -mt-3 mb-4">
              0 = kapalı, kullanıcılar mesaj atınca bu kadar saniye beklemek zorunda.
            </p>

            <label className="flex items-center gap-3 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={nsfw}
                onChange={(e) => setNsfw(e.target.checked)}
                className="w-4 h-4 accent-brand-500"
              />
              <span className="text-sm text-ink-primary">+18 (NSFW) içerik</span>
            </label>
          </>
        )}

        {err && <p className="text-accent-500 text-sm mb-3">{err}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => dispatch(closeModal())}
            className="flex-1 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-ink-primary font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:bg-surface-3 disabled:text-ink-tertiary text-white font-semibold"
          >
            {busy ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
}
