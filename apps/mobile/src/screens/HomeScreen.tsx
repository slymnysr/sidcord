// Ana ekran — Discord mobil düzeni: solda sunucu rayı, sağda kanal listesi.
// Okunmamış göstergeleri (kalın + nokta + mention rozeti), DM girişi,
// davet koduyla katılma / sunucu oluşturma.
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image, RefreshControl,
  Modal, TextInput, Pressable,
} from 'react-native';
import { colors } from '../theme';
import { api, type Channel, type DMChannel, type Guild, type ReadState, type User } from '../api';

interface Props {
  me: User;
  refreshKey: number; // sohbetten dönüşte listeleri tazelemek için artar
  onOpenChannel: (ch: { id: string; name: string; guildId?: string }) => void;
  onLogout: () => void;
}

export function HomeScreen({ me, refreshKey, onOpenChannel, onLogout }: Props) {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selected, setSelected] = useState<string | 'dm' | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dms, setDms] = useState<DMChannel[]>([]);
  const [reads, setReads] = useState<Record<string, ReadState>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [newGuildName, setNewGuildName] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const loadReads = useCallback(async () => {
    try {
      const list = await api.readStates();
      const map: Record<string, ReadState> = {};
      for (const r of list) map[r.channel_id] = r;
      setReads(map);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    try {
      const g = await api.guilds();
      setGuilds(g);
      setSelected((cur) => cur ?? (g[0]?.id ?? 'dm'));
    } catch {}
    loadReads();
  }, [loadReads]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!selected) return;
    if (selected === 'dm') {
      api.dms().then(setDms).catch(() => {});
    } else {
      api.channels(selected).then(setChannels).catch(() => {});
    }
  }, [selected, refreshKey]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    if (selected === 'dm') await api.dms().then(setDms).catch(() => {});
    else if (selected) await api.channels(selected).then(setChannels).catch(() => {});
    setRefreshing(false);
  };

  // Okunmamış: kanalın son mesajı, okuma imlecinden yeniyse
  const isUnread = (channelId: string, lastMessageId?: string) => {
    if (!lastMessageId) return false;
    const r = reads[channelId];
    if (!r?.last_message_id) return true;
    try {
      return BigInt(lastMessageId) > BigInt(r.last_message_id);
    } catch {
      return false;
    }
  };

  async function joinByInvite() {
    if (!inviteCode.trim() || addBusy) return;
    setAddBusy(true);
    setAddErr(null);
    try {
      const g = await api.acceptInvite(inviteCode);
      setInviteCode('');
      setAddOpen(false);
      await load();
      setSelected(g.id);
    } catch (e: any) {
      setAddErr(e?.message ?? 'Katılınamadı');
    } finally {
      setAddBusy(false);
    }
  }

  async function createGuild() {
    if (newGuildName.trim().length < 2 || addBusy) return;
    setAddBusy(true);
    setAddErr(null);
    try {
      const g = await api.createGuild(newGuildName.trim());
      setNewGuildName('');
      setAddOpen(false);
      await load();
      setSelected(g.id);
    } catch (e: any) {
      setAddErr(e?.message ?? 'Oluşturulamadı');
    } finally {
      setAddBusy(false);
    }
  }

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
        <TouchableOpacity style={s.railItem} onPress={() => { setAddErr(null); setAddOpen(true); }}>
          <Text style={[s.railText, { color: colors.brand, fontSize: 22 }]}>＋</Text>
        </TouchableOpacity>
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
            renderItem={({ item }) => {
              const unread = isUnread(item.id, item.last_message_id);
              return (
                <TouchableOpacity
                  style={s.channelRow}
                  onPress={() => onOpenChannel({ id: item.id, name: item.name || 'DM' })}
                >
                  <Text style={s.channelIcon}>{item.type === 'group_dm' ? '👥' : '@'}</Text>
                  <Text style={[s.channelName, unread && s.channelUnread]} numberOfLines={1}>
                    {item.name || 'Doğrudan mesaj'}
                  </Text>
                  {unread && <View style={s.dot} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={s.empty}>Henüz DM yok.</Text>}
          />
        ) : (
          <FlatList
            data={textChannels}
            keyExtractor={(c) => c.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />}
            renderItem={({ item }) => {
              const unread = isUnread(item.id, item.last_message_id);
              const mentions = reads[item.id]?.mention_count ?? 0;
              return (
                <TouchableOpacity
                  style={s.channelRow}
                  onPress={() => onOpenChannel({ id: item.id, name: item.name, guildId: item.guild_id })}
                >
                  <Text style={s.channelIcon}>{item.type === 'announcement' ? '📣' : '#'}</Text>
                  <Text style={[s.channelName, unread && s.channelUnread]} numberOfLines={1}>{item.name}</Text>
                  {mentions > 0 ? (
                    <View style={s.mentionBadge}>
                      <Text style={s.mentionText}>{mentions > 99 ? '99+' : mentions}</Text>
                    </View>
                  ) : (
                    unread && <View style={s.dot} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 16 }}>
                <Text style={s.empty}>Kanal yok.</Text>
              </View>
            }
          />
        )}
        <View style={s.me}>
          <View style={[s.avatar, { backgroundColor: me.avatar_color || colors.brand }]}>
            <Text style={s.avatarText}>{me.display_name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text style={s.meName} numberOfLines={1}>{me.display_name}</Text>
        </View>
      </View>

      {/* Sunucuya katıl / oluştur */}
      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>Sunucuya Katıl</Text>
            <TextInput
              style={s.modalInput}
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="none"
              placeholder="Davet kodu (örn. yazilim-tr)"
              placeholderTextColor={colors.inkTertiary}
            />
            <TouchableOpacity style={[s.modalBtn, (!inviteCode.trim() || addBusy) && { opacity: 0.4 }]} onPress={joinByInvite} disabled={!inviteCode.trim() || addBusy}>
              <Text style={s.modalBtnText}>Katıl</Text>
            </TouchableOpacity>

            <View style={s.modalSep} />

            <Text style={s.modalTitle}>Yeni Sunucu</Text>
            <TextInput
              style={s.modalInput}
              value={newGuildName}
              onChangeText={setNewGuildName}
              placeholder="Sunucu adı"
              placeholderTextColor={colors.inkTertiary}
            />
            <TouchableOpacity style={[s.modalBtn, (newGuildName.trim().length < 2 || addBusy) && { opacity: 0.4 }]} onPress={createGuild} disabled={newGuildName.trim().length < 2 || addBusy}>
              <Text style={s.modalBtnText}>Oluştur</Text>
            </TouchableOpacity>

            {addErr && <Text style={s.modalErr}>{addErr}</Text>}
          </Pressable>
        </Pressable>
      </Modal>
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
  channelUnread: { color: colors.ink, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink },
  mentionBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  mentionText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  empty: { color: colors.inkTertiary },
  me: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderColor: colors.line, gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  meName: { color: colors.ink, fontWeight: '600', flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', backgroundColor: colors.surface1, borderRadius: 18, padding: 18 },
  modalTitle: { color: colors.ink, fontWeight: '800', fontSize: 16, marginBottom: 8 },
  modalInput: {
    backgroundColor: colors.surface2, borderColor: colors.line, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, marginBottom: 10,
  },
  modalBtn: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 11 },
  modalBtnText: { color: '#06281F', fontWeight: '800', textAlign: 'center' },
  modalSep: { height: 1, backgroundColor: colors.line, marginVertical: 16 },
  modalErr: { color: colors.accent, marginTop: 10, textAlign: 'center' },
});
