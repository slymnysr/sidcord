// Sohbet ekranı — gerçek zamanlı mesajlar (Phoenix WS) + gönderme + eskiyi yükleme.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { colors } from '../theme';
import { api, type Message, type User } from '../api';
import { joinGuild, sendTyping } from '../gateway';

interface Props {
  channel: { id: string; name: string; guildId?: string };
  me: User;
  onBack: () => void;
}

export function ChatScreen({ channel, me, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [users, setUsers] = useState<Record<string, User>>({ [me.id]: me });
  const [sending, setSending] = useState(false);
  const usersRef = useRef(users);
  usersRef.current = users;

  const resolveUser = useCallback((id: string) => {
    if (usersRef.current[id]) return;
    setUsers((u) => ({ ...u, [id]: { id, username: '', display_name: '…', avatar_color: colors.surface3, status: 'offline' } }));
    api.user(id).then((u) => setUsers((prev) => ({ ...prev, [id]: u }))).catch(() => {});
  }, []);

  // İlk yükleme (en yeni 50, ters çevir: en eski üstte)
  useEffect(() => {
    let cancelled = false;
    api.messages(channel.id)
      .then((list) => {
        if (cancelled) return;
        const ordered = list.slice().reverse();
        setMessages(ordered);
        for (const m of ordered) resolveUser(m.author_id);
      })
      .catch(() => {});
    api.ack(channel.id).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [channel.id, resolveUser]);

  // Gerçek zamanlı: guild kanalı eventleri (DM'lerde sunucu kanalı yok — polling fallback)
  useEffect(() => {
    if (!channel.guildId) {
      const t = setInterval(() => {
        api.messages(channel.id).then((list) => setMessages(list.slice().reverse())).catch(() => {});
      }, 4000);
      return () => clearInterval(t);
    }
    joinGuild(channel.guildId, (ev, payload) => {
      const msg: Message | undefined = payload?.message;
      if (!msg || msg.channel_id !== channel.id) return;
      if (ev === 'MESSAGE_CREATE') {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        resolveUser(msg.author_id);
      } else if (ev === 'MESSAGE_UPDATE') {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
      } else if (ev === 'MESSAGE_DELETE') {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }
    });
  }, [channel.id, channel.guildId, resolveUser]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      const m = await api.sendMessage(channel.id, content);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch (e: any) {
      setText(content); // başarısızsa geri koy
    } finally {
      setSending(false);
    }
  }

  const listRef = useRef<FlatList>(null);

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.back}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerIcon}>#</Text>
        <Text style={s.headerName} numberOfLines={1}>{channel.name}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ paddingVertical: 8 }}
        renderItem={({ item, index }) => {
          if (item.system) {
            return <Text style={s.system}>→ {item.content}</Text>;
          }
          const prev = messages[index - 1];
          const grouped =
            !!prev && !prev.system && prev.author_id === item.author_id &&
            new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
          const author = users[item.author_id];
          const name = item.webhook_username || author?.display_name || '…';
          return (
            <View style={[s.msgRow, grouped && s.msgRowGrouped]}>
              {grouped ? (
                <View style={s.avatarSpacer} />
              ) : (
                <View style={[s.avatar, { backgroundColor: author?.avatar_color || colors.surface3 }]}>
                  {author?.avatar_url ? (
                    <Image source={{ uri: author.avatar_url }} style={s.avatarImg} />
                  ) : (
                    <Text style={s.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
                  )}
                </View>
              )}
              <View style={s.msgBody}>
                {!grouped && (
                  <View style={s.msgHead}>
                    <Text style={s.msgAuthor}>{name}</Text>
                    <Text style={s.msgTime}>
                      {new Date(item.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
                {!!item.content && <Text style={s.msgText}>{item.content}</Text>}
                {item.attachments?.map((a: NonNullable<Message['attachments']>[number]) =>
                  (a.content_type ?? '').startsWith('image/') ? (
                    <Image key={a.id} source={{ uri: a.url }} style={s.attachment} resizeMode="cover" />
                  ) : (
                    <Text key={a.id} style={s.file}>📎 {a.filename}</Text>
                  ),
                )}
              </View>
            </View>
          );
        }}
      />

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (channel.guildId) sendTyping(channel.guildId, channel.id);
          }}
          placeholder={`#${channel.name} kanalına mesaj`}
          placeholderTextColor={colors.inkTertiary}
          multiline
        />
        <TouchableOpacity style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]} onPress={send} disabled={!text.trim() || sending}>
          <Text style={s.sendText}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: colors.line, gap: 8 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.ink, fontSize: 28, lineHeight: 30 },
  headerIcon: { color: colors.inkTertiary, fontSize: 18, fontWeight: '800' },
  headerName: { color: colors.ink, fontSize: 17, fontWeight: '800', flex: 1 },
  system: { color: colors.inkTertiary, fontSize: 13, paddingHorizontal: 16, paddingVertical: 6 },
  msgRow: { flexDirection: 'row', paddingHorizontal: 12, marginTop: 12, gap: 10 },
  msgRowGrouped: { marginTop: 2 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarSpacer: { width: 38 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  msgBody: { flex: 1 },
  msgHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  msgAuthor: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  msgTime: { color: colors.inkTertiary, fontSize: 11 },
  msgText: { color: colors.ink, fontSize: 15, lineHeight: 21, marginTop: 1 },
  attachment: { width: 220, height: 150, borderRadius: 10, marginTop: 6, backgroundColor: colors.surface2 },
  file: { color: colors.brand, marginTop: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8, borderTopWidth: 1, borderColor: colors.line },
  input: {
    flex: 1, backgroundColor: colors.surface2, borderRadius: 22, paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 10, color: colors.ink, fontSize: 15, maxHeight: 110,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#06281F', fontSize: 18, fontWeight: '800' },
});
