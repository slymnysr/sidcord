import { useEffect, useState } from 'react';
import { Hash, Volume2, Megaphone, MessagesSquare, Mic, Lock, ChevronLeft } from 'lucide-react';
import { api, type APIRole } from '../api';
import { useAppDispatch, useAppSelector, closeModal, fetchChannels, selectChannel } from '../store';

type ChannelType = 'text' | 'voice' | 'announcement' | 'forum' | 'stage';

// Discord paritesi: izin bitmask. ViewChannel = 1 << 10 = 1024
const VIEW_CHANNEL = '1024';

const types: { type: ChannelType; icon: any; label: string; description: string }[] = [
  { type: 'text', icon: Hash, label: 'Metin', description: 'Yazılı mesajlar, dosya paylaşımı' },
  { type: 'voice', icon: Volume2, label: 'Sesli', description: 'Ses + görüntü + ekran paylaşımı' },
  { type: 'announcement', icon: Megaphone, label: 'Duyuru', description: 'Yöneticiler yazar, diğerleri okur' },
  { type: 'stage', icon: Mic, label: 'Sahne', description: 'Konuşmacı/dinleyici düzeni' },
  { type: 'forum', icon: MessagesSquare, label: 'Forum', description: 'Konu bazlı tartışma başlatma' },
];

type Step = 'type' | 'details';

export function CreateChannelModal() {
  const dispatch = useAppDispatch();
  const guildId = useAppSelector((s) => s.guilds.selectedId);
  const [step, setStep] = useState<Step>('type');
  const [type, setType] = useState<ChannelType>('text');
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [roles, setRoles] = useState<APIRole[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) return;
    api.guilds
      .roles(guildId)
      .then((rs) => setRoles(rs.filter((r) => !r.is_everyone)))
      .catch(() => {});
  }, [guildId]);

  if (!guildId) return null;

  function toggleRole(id: string) {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!guildId) return;
    const v = type === 'voice' || type === 'stage' ? name.trim() : name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!v) return;
    setLoading(true);
    setError(null);
    try {
      const created = await api.guilds.createChannel(guildId, v, type);
      // Özel kanal: @everyone'dan ViewChannel kaldır, seçili rollere allow ekle
      if (isPrivate) {
        const everyone = (await api.guilds.roles(guildId)).find((r) => r.is_everyone);
        if (everyone) {
          await api.channels.upsertOverride(created.id, {
            target_type: 'role',
            target_id: everyone.id,
            allow: '0',
            deny: VIEW_CHANNEL,
          });
        }
        for (const rid of selectedRoles) {
          await api.channels.upsertOverride(created.id, {
            target_type: 'role',
            target_id: rid,
            allow: VIEW_CHANNEL,
            deny: '0',
          });
        }
      }
      await dispatch(fetchChannels(guildId));
      dispatch(selectChannel(created.id));
      dispatch(closeModal());
    } catch (e: any) {
      setError(e?.message || 'Oluşturulamadı');
    } finally {
      setLoading(false);
    }
  }

  const TypeIcon = types.find((t) => t.type === type)?.icon ?? Hash;

  if (step === 'type') {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-ink-primary mb-1">Kanal Oluştur</h2>
        <p className="text-sm text-ink-secondary mb-5">Kanal türünü seç</p>

        <div className="space-y-2">
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
                  <div className="text-sm font-semibold text-ink-primary">{t.label} Kanalı</div>
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

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => dispatch(closeModal())}
            className="flex-1 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-ink-primary font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => setStep('details')}
            className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-white font-semibold"
          >
            İleri
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-6">
      <button
        type="button"
        onClick={() => setStep('type')}
        className="text-xs text-ink-tertiary hover:text-ink-primary flex items-center gap-1 mb-2"
      >
        <ChevronLeft size={14} /> Geri
      </button>
      <h2 className="text-xl font-bold text-ink-primary mb-1">Kanal Detayları</h2>
      <p className="text-sm text-ink-secondary mb-5 flex items-center gap-1.5">
        <TypeIcon size={14} className="text-brand-500" />
        {types.find((t) => t.type === type)?.label} kanalı
      </p>

      <label className="block text-sm font-semibold text-ink-primary mb-1.5">Kanal Adı</label>
      <div className="relative mb-4">
        {type === 'voice' || type === 'stage' ? (
          <Volume2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        ) : (
          <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
        )}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === 'voice' ? 'Kahve Molası' : type === 'stage' ? 'Genel Sahne' : 'genel'}
          maxLength={100}
          className="w-full bg-surface-2 border border-line focus:border-brand-500/50 focus:outline-none rounded-lg pl-9 pr-3 py-2.5 text-ink-primary placeholder:text-ink-tertiary"
        />
      </div>

      <label className="flex items-start gap-3 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-brand-500"
        />
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink-primary flex items-center gap-1.5">
            <Lock size={14} className="text-ink-tertiary" />
            Özel Kanal
          </div>
          <div className="text-xs text-ink-tertiary mt-0.5">
            Bu kanalı yalnızca seçilen roller ve üyeler görebilir.
          </div>
        </div>
      </label>

      {isPrivate && (
        <div className="mb-4 bg-surface-2 rounded-xl border border-line p-3">
          <div className="text-xs font-bold uppercase text-ink-tertiary tracking-wider mb-2">
            Erişimi Olan Roller
          </div>
          {roles.length === 0 ? (
            <p className="text-xs text-ink-tertiary">
              Henüz rol yok. Sunucu Ayarları &gt; Roller'den ekleyebilirsin.
            </p>
          ) : (
            <ul className="max-h-40 overflow-y-auto space-y-1">
              {roles.map((r) => (
                <li key={r.id}>
                  <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRoles.has(r.id)}
                      onChange={() => toggleRole(r.id)}
                      className="w-4 h-4 accent-brand-500"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: '#' + r.color.toString(16).padStart(6, '0') }}
                    />
                    <span className="text-sm text-ink-primary">{r.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-accent-500 text-sm mb-3">{error}</p>}

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
          disabled={!name.trim() || loading}
          className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:bg-surface-3 disabled:text-ink-tertiary text-white font-semibold"
        >
          {loading ? 'Oluşturuluyor...' : 'Kanal Oluştur'}
        </button>
      </div>
    </form>
  );
}
