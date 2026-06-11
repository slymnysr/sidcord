// Sidcord Mobil — giriş kapısı + basit gezinme (Login → Ana → Sohbet).
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, BackHandler } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './src/theme';
import { api, loadTokens, clearTokens, type User } from './src/api';
import { loadHost } from './src/config';
import { disconnectGateway } from './src/gateway';
import { LoginScreen } from './src/screens/LoginScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ChatScreen } from './src/screens/ChatScreen';

type OpenChannel = { id: string; name: string; guildId?: string };

export default function App() {
  const [booting, setBooting] = useState(true);
  const [me, setMe] = useState<User | null>(null);
  const [openChannel, setOpenChannel] = useState<OpenChannel | null>(null);
  // Sohbetten ana ekrana dönüşte listeleri/okunmamışları tazele
  const [homeRefresh, setHomeRefresh] = useState(0);

  function closeChannel() {
    setOpenChannel(null);
    setHomeRefresh((n) => n + 1);
  }

  // Açılış: kayıtlı sunucu + token varsa otomatik giriş
  useEffect(() => {
    (async () => {
      await loadHost();
      await loadTokens();
      try {
        const u = await api.me();
        setMe(u);
      } catch {}
      setBooting(false);
    })();
  }, []);

  // Android geri tuşu: sohbetten ana ekrana dön
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (openChannel) {
        closeChannel();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [openChannel]);

  async function logout() {
    disconnectGateway();
    await clearTokens();
    setOpenChannel(null);
    setMe(null);
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        {booting ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.brand} size="large" />
          </View>
        ) : !me ? (
          <LoginScreen onLogin={setMe} />
        ) : openChannel ? (
          <ChatScreen channel={openChannel} me={me} onBack={closeChannel} />
        ) : (
          <HomeScreen me={me} refreshKey={homeRefresh} onOpenChannel={setOpenChannel} onLogout={logout} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
