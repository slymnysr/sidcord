// Ana ekran — Discord mobil düzeni: solda sunucu rayı, sağda kanal listesi.
// En üstte DM girişi; kanala dokununca sohbet ekranı açılır.
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image, RefreshControl,
} from 'react-native';
import { colors } from '../theme';
import { api, type Channel, type DMChannel, type Guild, type User } from '../api';

interface Props {
  me: User;
  onOpenChannel: (ch: { id: string; name: string; guildId?: string }) => void;
  onLogout: () => void;
}

export function HomeScreen({ me, onOpenChannel, onLogout }: Props) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selected, setSelected] = useState<string | 'dm' | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDms] = useState<DMChannel[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const g = await api.guilds();
      setGuilds(g);
      setSelected((cur) => cur ?? (g[0]?.id ?? 'dm'));
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    if (selected === 'dm') {
      api.dms().then(setDms).catch(() => {});
    } else {
      api.channels(selected).then(setChannels).catch(() => {});
    }
  }, [selected]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    if (selected === 'dm') await api.dms().then(setDms).catch(() => {});
    else if (selected) await api.channels(selected).then(setChannels).catch(() => {});
    setRefreshing(false);
  };

  const guildName = selected === 'dm' ? 'Doğrudan Mesajlar' : guilds.find((g) => g.id === selected)?.name ?? '';
  const textChannels = channels
    .filter((c) => ['text', 'announcement', 'forum', 'media'].includes(c.type))
    .sort((a, b) => a.position - b.position);

  return (
    <View style={s.root}>
      {/* Sunucu rayı */}
      <View style={s.rail}>
        <TouchableOpacity
          style={[s.railItem, selected === 'dm' && s.railItemActive]}
          onPress={() => setSelected('dm')}
        >
          <Text style={s.railEmoji}>💬</Text>
        </TouchableOpacity>
        <View style={s.railSep} />
        <FlatList
          data={guilds}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.railItem, selected === item.id && s.railItemActive]}
              onPress={() => setSelected(item.id)}
            >
              {item.icon_url_v2 ? (
                <Image source={{ uri: item.icon_url_v2 }} style={s.railImg} />
              ) : (
                <Text style={[s.railText, { color: item.icon_color || colors.brand }]}>
                  {(item.icon_text || item.name).slice(0, 2).toUpperCase()}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={s.railItem} onPress={onLogout}>
          <Text style={{ fontSize: 16 }}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* Kanal / DM listesi */}
      <View style={s.list}>
        <Text style={s.guildName} numberOfLines={1}>{guildName}</Text>
        {selected === 'dm' ? (
          <FlatList
            data={dms}
            keyExtractor={(d) => d.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.channelRow}
                onPress={() => onOpenChannel({ id: item.id, name: item.name || 'DM' })}
              >
                <Text style={s.channelIcon}>{item.type === 'group_dm' ? '👥' : '@'}</Text>
                <Text style={s.channelName} numberOfLines={1}>{item.name || 'Doğrudan mesaj'}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={s.empty}>Henüz DM yok.</Text>}
          />
        ) : (
          <FlatList
            data={textChannels}
            keyExtractor={(c) => c.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.channelRow}
                onPress={() => onOpenChannel({ id: item.id, name: item.name, guildId: item.guild_id })}
              >
                <Text style={s.channelIcon}>{item.type === 'announcement' ? '📣' : '#'}</Text>
                <Text style={s.channelName} numberOfLines={1}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={s.empty}>Kanal yok.</Text>}
          />
        )}
        <View style={s.me}>
          <View style={[s.avatar, { backgroundColor: me.avatar_color || colors.brand }]}>
            <Text style={s.avatarText}>{me.display_name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={s.meName} numberOfLines={1}>{me.display_name}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  rail: { width: 64, backgroundColor: colors.bg, alignItems: 'center', paddingVertical: 8 },
  railItem: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface1,
    alignItems: 'center', justifyContent: 'center', marginVertical: 4, overflow: 'hidden',
  },
  railItemActive: { borderRadius: 14, borderWidth: 2, borderColor: colors.brand },
  railEmoji: { fontSize: 18 },
  railText: { fontWeight: '800', fontSize: 13 },
  railImg: { width: '100%', height: '100%' },
  railSep: { height: 1, width: 28, backgroundColor: colors.line, marginVertical: 6 },
  list: { flex: 1, backgroundColor: colors.surface1, borderTopLeftRadius: 18 },
  guildName: { color: colors.ink, fontWeight: '800', fontSize: 17, padding: 14, borderBottomWidth: 1, borderColor: colors.line },
  channelRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  channelIcon: { color: colors.inkTertiary, width: 24, fontSize: 15, fontWeight: '700' },
  channelName: { color: colors.inkSecondary, fontSize: 15, flex: 1 },
  empty: { color: colors.inkTertiary, padding: 16 },
  me: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderColor: colors.line, gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  meName: { color: colors.ink, fontWeight: '600', flex: 1 },
});
