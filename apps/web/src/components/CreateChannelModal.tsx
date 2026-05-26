import { useState } from 'react';
import { Hash, Volume2, Megaphone, MessagesSquare } from 'lucide-react';
import { api } from '../api';
import { useAppDispatch, useAppSelector, closeModal, fetchChannels, selectChannel } from '../store';

type ChannelType = 'text' | 'voice' | 'announcement' | 'forum';

const types: { type: ChannelType; icon: any; label: string; description: string }[] = [
  { type: 'text', icon: Hash, label: 'Metin Kanalı', description: 'Yazılı mesajlar, dosya paylaşımı' },
  { type: 'voice', icon: Volume2, label: 'Sesli Kanal', description: 'Sesli + görüntülü + ekran paylaşımı' },
  { type: 'announcement', icon: Megaphone, label: 'Duyuru Kanalı', description: 'Sadece moderatörler yazabilir' },
  { type: 'forum', icon: MessagesSquare, label: 'Forum Kanalı', description: 'Konu bazlı tartışmalar (Faz 2.x)' },
];

export function CreateChannelModal() {
  const dispatch = useAppDispatch();
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const [type, setType] = useState<ChannelType>('text');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!guildId) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!guildId) return;
    const v = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!v) return;
    setLoading(true);
    setError(null);
    try {
      const created = await api.guilds.createChannel(guildId, v, type);
      await dispatch(fetchChannels(guildId));
      dispatch(selectChannel(created.id));
      dispatch(closeModal());
    } catch (e: any) {
      setError(e?.message || 'Oluşturulamadı');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-ink-primary mb-1">Kanal Oluştur</h2>
      <p className="text-sm text-ink-secondary mb-5">
        Sunucuna yeni bir kanal ekle. Sonradan ayarlardan değiştirebilirsin.
      </p>

      <form onSubmit={submit}>
        <label className="block text-xs font-bold uppercase text-ink-secondary tracking-wider mb-2">
          Kanal Türü
        </label>
        <div className="space-y-2 mb-4">
          {types.map((t) => {
            const Icon = t.icon;
            const selected = t.type === type;
            return (
              <button
                key={t.type}
                type="button"
                onClick={() => setType(t.type)}
                className={
                  'w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-colors ' +
                  (selected
                    ? 'bg-brand-500/10 border-brand-500/50'
                    : 'bg-surface-2 border-line hover:bg-surface-3')
                }
              >
                <div
                  className={
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ' +
                    (selected ? 'bg-brand-500/20 text-brand-500' : 'bg-surface-3 text-ink-secondary')
                  }
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-primary">{t.label}</div>
                  <div className="text-xs text-ink-tertiary">{t.description}</div>
                </div>
                <div
                  className={
                    'w-4 h-4 rounded-full border-2 shrink-0 ' +
                    (selected ? 'border-brand-500 bg-brand-500' : 'border-ink-tertiary')
                  }
                />
              </button>
            );
          })}
        </div>

        <label className="block text-sm font-semibold text-ink-primary mb-1.5">Kanal adı</label>
        <div className="relative">
          {type === 'voice' ? (
            <Volume2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          ) : (
            <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          )}
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'voice' ? 'Kahve Molası' : 'genel'}
            maxLength={100}
            className="w-full bg-surface-2 border border-line focus:border-brand-500/50 focus:outline-none rounded-lg pl-9 pr-3 py-2.5 text-ink-primary placeholder:text-ink-tertiary"
          />
        </div>
        {type !== 'voice' && (
          <p className="text-xs text-ink-tertiary mt-1">
            Metin kanalları küçük harf + tire ile yazılır (örn. <span className="font-mono">iş-ilanları</span>)
          </p>
        )}

        {error && <p className="text-accent-500 text-sm mt-3">{error}</p>}

        <button
          type="submit"
          disabled={!name.trim() || loading}
          className="w-full mt-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:bg-surface-3 disabled:text-ink-tertiary text-white font-semibold transition-colors"
        >
          {loading ? 'Oluşturuluyor...' : 'Kanal Oluştur'}
        </button>
      </form>
    </div>
  );
}
