import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { colors } from '../theme';
import { api, type User } from '../api';
import { getHost, setHost } from '../config';

export function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [host, setHostInput] = useState(getHost() || 'http://192.168.1.');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setErr(null);
    setBusy(true);
    try {
      await setHost(host);
      const d =
        mode === 'login'
          ? await api.login(email.trim(), password)
          : await api.register(email.trim(), password, username.trim(), displayName.trim() || username.trim());
      onLogin(d.user);
    } catch (e: any) {
      setErr(e?.message ?? 'Bağlanılamadı — sunucu adresini kontrol et');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>Sidcord</Text>
        <Text style={s.subtitle}>
          {mode === 'login' ? 'Hesabına giriş yap' : 'Yeni hesap oluştur'}
        </Text>

        <Text style={s.label}>Sunucu adresi</Text>
        <TextInput
          style={s.input}
          value={host}
          onChangeText={setHostInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.34"
          placeholderTextColor={colors.inkTertiary}
        />

        {mode === 'register' && (
          <>
            <Text style={s.label}>Kullanıcı adı</Text>
            <TextInput
              style={s.input} value={username} onChangeText={setUsername}
              autoCapitalize="none" placeholder="ornek_kullanici" placeholderTextColor={colors.inkTertiary}
            />
            <Text style={s.label}>Görünen ad</Text>
            <TextInput
              style={s.input} value={displayName} onChangeText={setDisplayName}
              placeholder="Adın" placeholderTextColor={colors.inkTertiary}
            />
          </>
        )}

        <Text style={s.label}>E-posta</Text>
        <TextInput
          style={s.input} value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address" placeholder="sen@ornek.com"
          placeholderTextColor={colors.inkTertiary}
        />
        <Text style={s.label}>Parola</Text>
        <TextInput
          style={s.input} value={password} onChangeText={setPassword}
          secureTextEntry placeholder="••••••••" placeholderTextColor={colors.inkTertiary}
        />

        {err && <Text style={s.err}>{err}</Text>}

        <TouchableOpacity style={[s.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          <Text style={s.btnText}>
            {busy ? 'Bekleyin…' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
          <Text style={s.switch}>
            {mode === 'login' ? 'Hesabın yok mu? Kayıt ol' : 'Zaten hesabın var mı? Giriş yap'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { color: colors.brand, fontSize: 36, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.inkSecondary, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  label: { color: colors.inkSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 12, textTransform: 'uppercase' },
  input: {
    backgroundColor: colors.surface1, borderColor: colors.line, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontSize: 15,
  },
  err: { color: colors.accent, marginTop: 12, textAlign: 'center' },
  btn: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 14, marginTop: 20 },
  btnText: { color: '#06281F', fontWeight: '800', textAlign: 'center', fontSize: 16 },
  switch: { color: colors.brand, textAlign: 'center', marginTop: 16 },
});
