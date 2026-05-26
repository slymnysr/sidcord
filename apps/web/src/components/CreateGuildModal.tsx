import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAppDispatch, createGuildThunk, closeModal } from '../store';

export function CreateGuildModal() {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    setLoading(true);
    setError(null);
    try {
      await dispatch(createGuildThunk(v)).unwrap();
      dispatch(closeModal());
    } catch (e: any) {
      setError(e?.message || 'Oluşturulamadı');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-brand-500/15 text-brand-500 flex items-center justify-center">
          <Sparkles size={20} />
        </div>
        <h2 className="text-xl font-bold text-ink-primary">Sunucunu oluştur</h2>
      </div>
      <p className="text-sm text-ink-secondary mb-5">
        Topluluğun için bir isim seç. Sonra arkadaşlarına davet bağlantısı yollayabilirsin.
      </p>
      <form onSubmit={submit}>
        <label className="block text-sm font-semibold text-ink-primary mb-1.5">
          Sunucu adı
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Örn. Yazılım Türkiye"
          maxLength={64}
          className="w-full bg-surface-2 border border-line focus:border-brand-500/50 focus:outline-none rounded-lg px-3 py-2.5 text-ink-primary placeholder:text-ink-tertiary"
        />
        {error && <p className="text-accent-500 text-sm mt-2">{error}</p>}
        <button
          type="submit"
          disabled={!name.trim() || loading}
          className="w-full mt-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:bg-surface-3 disabled:text-ink-tertiary text-white font-semibold transition-colors"
        >
          {loading ? 'Oluşturuluyor...' : 'Sunucu Oluştur'}
        </button>
      </form>
    </div>
  );
}
