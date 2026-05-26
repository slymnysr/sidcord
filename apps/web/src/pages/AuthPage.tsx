import { useState } from 'react';
import { useAppDispatch, useAppSelector, loginThunk, registerThunk } from '../store';

type Mode = 'login' | 'register';

export function AuthPage() {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'login') {
      dispatch(loginThunk({ email, password }));
    } else {
      dispatch(
        registerThunk({
          email,
          password,
          username,
          display_name: displayName || username,
        }),
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/brand/logo.svg"
            width={56}
            height={56}
            alt="Sidcord"
            className="inline-block mb-3"
          />
          <h1 className="text-3xl font-bold tracking-tight">Sidcord</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {mode === 'login' ? 'Hesabına giriş yap' : 'Yeni hesap oluştur'}
          </p>
        </div>

        <form onSubmit={submit} className="bg-surface-1 rounded-2xl border border-line p-6 space-y-4">
          {mode === 'register' && (
            <>
              <Field label="Kullanıcı adı" hint="3-32 karakter, sadece a-z 0-9 . _">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ornek_kullanici"
                  required
                  autoComplete="username"
                  className={inputCls}
                />
              </Field>
              <Field label="Görünen ad" hint="opsiyonel — boşsa kullanıcı adı kullanılır">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Adın Soyadın"
                  autoComplete="name"
                  className={inputCls}
                />
              </Field>
            </>
          )}

          <Field label="E-posta">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sen@ornek.com"
              required
              autoComplete="email"
              className={inputCls}
            />
          </Field>

          <Field label="Parola" hint={mode === 'register' ? 'En az 8 karakter' : ''}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : undefined}
              className={inputCls}
            />
          </Field>

          {error && (
            <div className="text-sm text-accent-500 bg-accent-500/10 border border-accent-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 disabled:bg-surface-3 disabled:text-ink-tertiary text-white font-semibold transition-colors"
          >
            {loading ? 'Bekleyin...' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
          </button>

          <div className="text-center text-sm text-ink-secondary pt-2">
            {mode === 'login' ? (
              <>
                Hesabın yok mu?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="text-brand-500 hover:text-brand-400 font-medium"
                >
                  Kayıt ol
                </button>
              </>
            ) : (
              <>
                Zaten hesabın var mı?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-brand-500 hover:text-brand-400 font-medium"
                >
                  Giriş yap
                </button>
              </>
            )}
          </div>
        </form>

        <p className="text-center text-xs text-ink-tertiary mt-6">
          Türkiye'nin yerli sohbet platformu · v0.1
        </p>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-ink-primary mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink-tertiary mt-1">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full bg-surface-2 border border-line focus:border-brand-500/50 focus:outline-none rounded-lg px-3 py-2 text-ink-primary placeholder:text-ink-tertiary transition-colors';
