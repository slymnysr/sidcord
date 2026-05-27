import { useEffect, useState } from 'react';
import { User, Lock, Smile, Bell, Mic, Keyboard } from 'lucide-react';
import { api } from '../api';
import { useAppDispatch, useAppSelector, closeModal, fetchMe } from '../store';

type Tab = 'profile' | 'account' | 'status' | 'notifications' | 'voice' | 'keyboard';

export function UserSettingsModal() {
  const me = useAppSelector((s) => s.auth.user);
  const [tab, setTab] = useState<Tab>('profile');
  if (!me) return null;

  return (
    <div className="flex max-h-[80vh]" style={{ minHeight: '500px' }}>
      <nav className="w-52 bg-surface-2 border-r border-line p-3 space-y-1 overflow-y-auto rounded-l-2xl">
        <div className="text-xs font-bold uppercase text-ink-tertiary px-2 py-2">
          Kullanıcı Ayarları
        </div>
        <TabBtn icon={<User size={16} />} active={tab === 'profile'} onClick={() => setTab('profile')}>
          Profilim
        </TabBtn>
        <TabBtn icon={<Lock size={16} />} active={tab === 'account'} onClick={() => setTab('account')}>
          Hesap
        </TabBtn>
        <TabBtn icon={<Smile size={16} />} active={tab === 'status'} onClick={() => setTab('status')}>
          Özel Durum
        </TabBtn>
        <TabBtn icon={<Bell size={16} />} active={tab === 'notifications'} onClick={() => setTab('notifications')}>
          Bildirimler
        </TabBtn>
        <TabBtn icon={<Mic size={16} />} active={tab === 'voice'} onClick={() => setTab('voice')}>
          Ses & Video
        </TabBtn>
        <TabBtn icon={<Keyboard size={16} />} active={tab === 'keyboard'} onClick={() => setTab('keyboard')}>
          Klavye Kısayolları
        </TabBtn>
      </nav>
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'profile' && <ProfileTab />}
        {tab === 'account' && <AccountTab />}
        {tab === 'status' && <CustomStatusTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'voice' && <VoiceTab />}
        {tab === 'keyboard' && <KeyboardTab />}
      </div>
    </div>
  );
}

function TabBtn({
  icon,
  active,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ' +
        (active ? 'bg-brand-500/15 text-brand-500' : 'text-ink-secondary hover:bg-surface-3 hover:text-ink-primary')
      }
    >
      {icon}
      {children}
    </button>
  );
}

function ProfileTab() {
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.auth.user)!;
  const [displayName, setDisplayName] = useState(me.display_name);
  const [bio, setBio] = useState((me as any).bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/v1/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('sidcord_access'),
        },
        body: JSON.stringify({ display_name: displayName, bio }),
      });
      await dispatch(fetchMe());
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    try {
      const presign = await api.uploads.presign({
        filename: file.name,
        content_type: file.type || 'image/png',
        size_bytes: file.size,
      });
      await fetch(presign.upload_url, {
        method: 'PUT',
        body: file,
        headers: file.type ? { 'Content-Type': file.type } : undefined,
      });
      await fetch('/api/v1/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('sidcord_access'),
        },
        body: JSON.stringify({ avatar_url: presign.public_url }),
      });
      await dispatch(fetchMe());
    } finally {
      setUploadingAvatar(false);
    }
  }

  const avatarUrl = (me as any).avatar_url as string | undefined;

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink-primary mb-5">Profilim</h2>
      <div className="bg-surface-2 rounded-xl border border-line p-4 space-y-4">
        <div className="flex items-center gap-4">
          <label
            className={
              'w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold overflow-hidden cursor-pointer ring-2 ring-transparent hover:ring-brand-500 transition-all relative ' +
              (uploadingAvatar ? 'opacity-50' : '')
            }
            style={{ backgroundColor: me.avatar_color }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              me.display_name.slice(0, 1).toUpperCase()
            )}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
              }}
            />
            <span className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 text-[10px] flex items-center justify-center font-normal">
              Değiştir
            </span>
          </label>
          <div>
            <div className="text-lg font-semibold text-ink-primary">{me.display_name}</div>
            <div className="text-sm text-ink-tertiary">@{me.username}</div>
            <div className="text-xs text-ink-tertiary mt-1">
              Avatara tıkla → resim seç (PNG/JPG/GIF)
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-ink-secondary mb-1">Görünen Ad</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
            className="w-full bg-surface-1 border border-line rounded-lg px-3 py-2 text-ink-primary focus:border-brand-500/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase text-ink-secondary mb-1">Hakkımda</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={190}
            className="w-full bg-surface-1 border border-line rounded-lg px-3 py-2 text-ink-primary focus:border-brand-500/50 focus:outline-none resize-none"
          />
          <p className="text-xs text-ink-tertiary mt-1">{bio.length}/190</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:bg-surface-3 text-white font-semibold"
        >
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}

function AccountTab() {
  const me = useAppSelector((s) => s.auth.user)!;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit() {
    setErr(null);
    setOk(false);
    if (next !== confirm) {
      setErr('Yeni parola eşleşmiyor');
      return;
    }
    if (next.length < 8) {
      setErr('Yeni parola en az 8 karakter olmalı');
      return;
    }
    try {
      await api.changePassword(current, next);
      setOk(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (e: any) {
      setErr(e?.message ?? 'Hata');
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink-primary mb-5">Hesap</h2>
      <div className="bg-surface-2 rounded-xl border border-line p-4 space-y-2 text-sm mb-5">
        <div>
          <span className="text-ink-tertiary">Kullanıcı Adı: </span>
          <span className="text-ink-primary font-mono">@{me.username}</span>
        </div>
        <div>
          <span className="text-ink-tertiary">E-posta: </span>
          <span className="text-ink-primary">{me.email}</span>
        </div>
      </div>

      <h3 className="text-base font-bold text-ink-primary mb-2">Parolayı Değiştir</h3>
      <div className="bg-surface-2 rounded-xl border border-line p-4 space-y-3">
        <input
          type="password"
          placeholder="Mevcut parola"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full bg-surface-1 border border-line rounded-lg px-3 py-2 text-ink-primary focus:border-brand-500/50 focus:outline-none"
        />
        <input
          type="password"
          placeholder="Yeni parola (en az 8 karakter)"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="w-full bg-surface-1 border border-line rounded-lg px-3 py-2 text-ink-primary focus:border-brand-500/50 focus:outline-none"
        />
        <input
          type="password"
          placeholder="Yeni parola tekrar"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full bg-surface-1 border border-line rounded-lg px-3 py-2 text-ink-primary focus:border-brand-500/50 focus:outline-none"
        />
        {err && <p className="text-accent-500 text-sm">{err}</p>}
        {ok && <p className="text-status-online text-sm">Parola başarıyla değiştirildi.</p>}
        <button
          onClick={submit}
          disabled={!current || !next || !confirm}
          className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:bg-surface-3 text-white font-semibold"
        >
          Parolayı Güncelle
        </button>
      </div>
    </div>
  );
}

function CustomStatusTab() {
  const [emoji, setEmoji] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api.me().then((u: any) => {
      setEmoji(u.custom_status_emoji ?? '');
      setText(u.custom_status_text ?? '');
    });
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.updateCustomStatus({ custom_status_text: text, custom_status_emoji: emoji });
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    setEmoji('');
    setText('');
    await api.updateCustomStatus({ custom_status_text: '', custom_status_emoji: '' });
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink-primary mb-5">Özel Durum</h2>
      <div className="bg-surface-2 rounded-xl border border-line p-4">
        <p className="text-sm text-ink-secondary mb-4">
          Kullanıcı adının yanında görünecek geçici bir mesaj ayarla.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
            placeholder="😎"
            className="w-14 text-center bg-surface-1 border border-line rounded-lg px-2 py-2 text-xl"
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ne yapıyorsun?"
            maxLength={128}
            className="flex-1 bg-surface-1 border border-line rounded-lg px-3 py-2 text-ink-primary focus:border-brand-500/50 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 disabled:bg-surface-3 text-white font-semibold flex-1"
          >
            {saving ? 'Kaydediliyor...' : ok ? 'Kaydedildi ✓' : 'Kaydet'}
          </button>
          <button
            onClick={clear}
            className="px-4 py-2 rounded-lg bg-surface-3 hover:bg-accent-500 hover:text-white text-ink-primary font-semibold"
          >
            Temizle
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  const [enabled, setEnabled] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );
  const [subscribed, setSubscribed] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch {}
    })();
  }, []);

  async function enable() {
    if (typeof Notification === 'undefined') return;
    const r = await Notification.requestPermission();
    setEnabled(r);
    if (r !== 'granted') return;
    // Service worker + push subscribe
    setErr(null);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      // Sidcord public VAPID key (dev için sabit). Production'da backend'den getirilir.
      // Bu placeholder — gerçek push gönderim için backend webpush kütüphanesi ile imzalanır.
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true });
      const json = sub.toJSON() as any;
      await api.push.subscribe({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? '',
        auth: json.keys?.auth ?? '',
      });
      setSubscribed(true);
    } catch (e: any) {
      setErr(e?.message ?? 'Push aboneliği başarısız');
    }
  }

  async function disable() {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      await api.push.unsubscribeAll();
      setSubscribed(false);
    } catch {}
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-ink-primary mb-5">Bildirimler</h2>
      <div className="bg-surface-2 rounded-xl border border-line p-4">
        <h3 className="text-sm font-bold text-ink-primary mb-2">Masaüstü Bildirimleri</h3>
        <p className="text-sm text-ink-secondary mb-3">
          Sidcord sekmesi açık değilken bile DM ve mention bildirimleri göstersin.
        </p>
        {err && <p className="text-accent-500 text-sm mb-2">{err}</p>}
        {enabled === 'granted' && subscribed ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-status-online flex-1">✓ Bildirimler aktif</p>
            <button
              onClick={disable}
              className="px-3 py-1.5 rounded-lg bg-surface-3 hover:bg-accent-500 hover:text-white text-ink-primary text-sm font-semibold"
            >
              Aboneliği iptal et
            </button>
          </div>
        ) : enabled === 'denied' ? (
          <p className="text-sm text-accent-500">
            Bildirim izni reddedilmiş. Tarayıcı ayarlarından açabilirsin.
          </p>
        ) : (
          <button
            onClick={enable}
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white font-semibold"
          >
            Bildirimleri Aç
          </button>
        )}
      </div>

      <div className="bg-surface-2 rounded-xl border border-line p-4 mt-4">
        <h3 className="text-sm font-bold text-ink-primary mb-2">Bildirim Sesleri</h3>
        <p className="text-sm text-ink-secondary">
          Mesaj sesi, mention sesi, ses bağlantı sesi — şu an varsayılan tarayıcı sesleri.
        </p>
      </div>
    </div>
  );
}

function VoiceTab() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-ink-primary mb-5">Ses & Video</h2>
      <div className="bg-surface-2 rounded-xl border border-line p-4">
        <p className="text-sm text-ink-secondary mb-3">
          Mikrofon ve kamera ayarları tarayıcı izinleriyle yönetilir.
        </p>
        <p className="text-sm text-ink-tertiary">
          Sidcord otomatik olarak echo cancellation, noise suppression ve auto gain control
          uygular (getUserMedia constraints).
        </p>
      </div>
    </div>
  );
}

function KeyboardTab() {
  const shortcuts = [
    { keys: ['Ctrl', 'K'], label: 'Sunucu/kanal hızlı geçiş (arama)' },
    { keys: ['Ctrl', 'Shift', 'K'], label: 'Yeni DM oluştur' },
    { keys: ['Ctrl', '/'], label: 'Bu yardımı göster' },
    { keys: ['Ctrl', 'B'], label: 'Üye listesini aç/kapat' },
    { keys: ['Enter'], label: 'Mesaj gönder' },
    { keys: ['Shift', 'Enter'], label: 'Yeni satır' },
    { keys: ['Escape'], label: 'Düzenlemeyi iptal et / Modal kapat' },
    { keys: ['↑'], label: 'Son mesajı düzenle' },
    { keys: ['Ctrl', 'Shift', 'M'], label: 'Mikrofonu sustur/aç' },
    { keys: ['Ctrl', 'Shift', 'D'], label: 'Sağırlaştır/aç' },
    { keys: ['@', 'isim'], label: 'Bir üyeyi bahset' },
    { keys: ['#', 'isim'], label: 'Bir kanal bağla' },
    { keys: [':emoji:'], label: 'Emoji ekle' },
    { keys: ['/komut'], label: 'Slash komut çalıştır' },
    { keys: ['Ctrl', 'Shift', 'R'], label: 'Sayfayı sert yenile' },
  ];
  return (
    <div>
      <h2 className="text-2xl font-bold text-ink-primary mb-5">Klavye Kısayolları</h2>
      <div className="bg-surface-2 rounded-xl border border-line p-4 space-y-2">
        {shortcuts.map((s, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-line last:border-b-0">
            <span className="text-sm text-ink-primary">{s.label}</span>
            <div className="flex items-center gap-1">
              {s.keys.map((k, j) => (
                <kbd
                  key={j}
                  className="px-2 py-0.5 rounded bg-surface-3 text-ink-primary text-xs font-mono border border-line"
                >
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

void closeModal;
