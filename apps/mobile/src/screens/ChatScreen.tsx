// Sohbet ekranı — gerçek zamanlı mesajlar (Phoenix WS), tepkiler, yanıtlar,
// uzun-basma menüsü (tepki/yanıtla/kopyala/sil), eskiyi yükleme.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Image, Modal, Pressable, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme';
import { api, type Message, type Reaction, type User } from '../api';
import { joinGuild, sendTyping } from '../gateway';

interface Props {
  channel: { id: string; name: string; guildId?: string };
  me: User;
  onBack: () => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👀', '🎉'];

export function ChatScreen({ channel, me, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [text, setText] = useState('');
  const [users, setUsers] = useState<Record<string, User>>({ [me.id]: me });
  const [sending, setSending] = useState(false);
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const usersRef = useRef(users);
  usersRef.current = users;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const resolveUser = useCallback((id: string) => {
    if (usersRef.current[id]) return;
    setUsers((u) => ({ ...u, [id]: { id, username: '', display_name: '…', avatar_color: colors.surface3, status: 'offline' } }));
    api.user(id).then((u) => setUsers((prev) => ({ ...prev, [id]: u }))).catch(() => {});
  }, []);

  // İlk yükleme (en yeni 50; en eski üstte) + son 30 mesajın tepkileri
  useEffect(() => {
    let cancelled = false;
    api.messages(channel.id)
      .then(async (list) => {
        if (cancelled) return;
        const ordered = list.slice().reverse();
        setMessages(ordered);
        for (const m of ordered) resolveUser(m.author_id);
        const tail = ordered.slice(-30);
        const results = await Promise.all(
          tail.map((m) => api.reactions.list(m.id).then((r) => [m.id, r] as const).catch(() => null)),
        );
        if (cancelled) return;
        const map: Record<string, Reaction[]> = {};
        for (const r of results) if (r && r[1].length > 0) map[r[0]] = r[1];
        setReactions((prev) => ({ ...map, ...prev }));
      })
      .catch(() => {});
    api.ack(channel.id).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [channel.id, resolveUser]);

  // Tepki sayacını yerel güncelle (canlı event + optimistic ortak yolu)
  const bumpReaction = useCallback((messageId: string, emoji: string, delta: 1 | -1, byMe: boolean) => {
    setReactions((prev) => {
      const list = prev[messageId] ? [...prev[messageId]] : [];
      const idx = list.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        const r = { ...list[idx] };
        r.count += delta;
        if (byMe) r.me = delta > 0;
        if (r.count <= 0) list.splice(idx, 1);
        else list[idx] = r;
      } else if (delta > 0) {
        list.push({ emoji, count: 1, me: byMe });
      }
      return { ...prev, [messageId]: list };
    });
  }, []);

  // Gerçek zamanlı: guild eventleri (DM'de polling fallback)
  useEffect(() => {
    if (!channel.guildId) {
      const t = setInterval(() => {
        api.messages(channel.id).then((list) => setMessages(list.slice().reverse())).catch(() => {});
      }, 4000);
      return () => clearInterval(t);
    }
    joinGuild(channel.guildId, (ev, payload) => {
      if (ev === 'REACTION_ADD' || ev === 'REACTION_REMOVE') {
        if (payload?.channel_id !== channel.id) return;
        const mine = String(payload.user_id) === me.id;
        // Kendi tepkim optimistic işlendi — event'te tekrar sayma
        if (mine) return;
        bumpReaction(String(payload.message_id), payload.emoji, ev === 'REACTION_ADD' ? 1 : -1, false);
        return;
      }
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
  }, [channel.id, channel.guildId, me.id, resolveUser, bumpReaction]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    const reply = replyTo;
    setReplyTo(null);
    try {
      const m = await api.sendMessage(channel.id, content, reply?.id);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch {
      setText(content);
      setReplyTo(reply);
    } finally {
      setSending(false);
    }
  }

  async function toggleReaction(msg: Message, emoji: string) {
    const cur = reactions[msg.id]?.find((r) => r.emoji === emoji);
    const adding = !cur?.me;
    bumpReaction(msg.id, emoji, adding ? 1 : -1, true);
    try {
      if (adding) await api.reactions.add(msg.id, emoji);
      else await api.reactions.remove(msg.id, emoji);
    } catch {
      bumpReaction(msg.id, emoji, adding ? -1 : 1, true); // geri al
    }
  }

  function deleteMessage(msg: Message) {
    Alert.alert('Mesajı sil', 'Bu mesaj kalıcı olarak silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMessage(msg.id);
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          } catch {}
        },
      },
    ]);
  }

  const listRef = useRef<FlatList>(null);
  const findMessage = (id?: string) => (id ? messagesRef.current.find((m) => m.id === id) : undefined);

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
          const prevAny = messages[index - 1];
          const newDay =
            !prevAny ||
            new Date(prevAny.created_at).toDateString() !== new Date(item.created_at).toDateString();
          const dayDivider = newDay ? (
            <View style={s.dayRow}>
              <View style={s.dayLine} />
              <Text style={s.dayText}>
                {new Date(item.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
              <View style={s.dayLine} />
            </View>
          ) : null;
          if (item.system) {
            return (
              <View>
                {dayDivider}
                <Text style={s.system}>→ {item.content}</Text>
              </View>
            );
          }
          const prev = messages[index - 1];
          const grouped =
            !!prev && !prev.system && prev.author_id === item.author_id && !item.replied_to_id &&
            new Date(item.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
          const author = users[item.author_id];
          const name = item.webhook_username || author?.display_name || '…';
          const replied = findMessage(item.replied_to_id);
          const msgReactions = reactions[item.id] ?? [];
          return (
            <Pressable onLongPress={() => setMenuFor(item)} delayLongPress={250}>
              {dayDivider}
              {item.replied_to_id && (
                <View style={s.replyPreviewRow}>
                  <Text style={s.replyPreviewText} numberOfLines={1}>
                    ↪ {replied ? `${users[replied.author_id]?.display_name ?? '…'}: ${replied.content}` : 'bir mesaja yanıt'}
                  </Text>
                </View>
              )}
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
                  {msgReactions.length > 0 && (
                    <View style={s.reactionRow}>
                      {msgReactions.map((r) => (
                        <TouchableOpacity
                          key={r.emoji}
                          style={[s.reactionChip, r.me && s.reactionChipMine]}
                          onPress={() => toggleReaction(item, r.emoji)}
                        >
                          <Text style={s.reactionEmoji}>{r.emoji}</Text>
                          <Text style={[s.reactionCount, r.me && { color: colors.brand }]}>{r.count}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {replyTo && (
        <View style={s.replyBar}>
          <Text style={s.replyBarText} numberOfLines={1}>
            ↪ {users[replyTo.author_id]?.display_name ?? '…'} kullanıcısına yanıt
          </Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Text style={s.replyBarClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* Uzun-basma menüsü */}
      <Modal visible={!!menuFor} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable style={s.sheetBackdrop} onPress={() => setMenuFor(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.quickRow}>
              {QUICK_EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={s.quickEmoji}
                  onPress={() => {
                    if (menuFor) toggleReaction(menuFor, e);
                    setMenuFor(null);
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={s.sheetItem}
              onPress={() => {
                setReplyTo(menuFor);
                setMenuFor(null);
              }}
            >
              <Text style={s.sheetItemText}>↩️  Yanıtla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.sheetItem}
              onPress={async () => {
                if (menuFor?.content) await Clipboard.setStringAsync(menuFor.content);
                setMenuFor(null);
              }}
            >
              <Text style={s.sheetItemText}>📋  Metni Kopyala</Text>
            </TouchableOpacity>
            {menuFor?.author_id === me.id && (
              <TouchableOpacity
                style={s.sheetItem}
                onPress={() => {
                  const m = menuFor;
                  setMenuFor(null);
                  if (m) deleteMessage(m);
                }}
              >
                <Text style={[s.sheetItemText, { color: colors.accent }]}>🗑️  Mesajı Sil</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginTop: 14, marginBottom: 2 },
  dayLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dayText: { color: colors.inkTertiary, fontSize: 11, fontWeight: '700' },
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
  replyPreviewRow: { paddingLeft: 60, paddingRight: 12, marginTop: 10 },
  replyPreviewText: { color: colors.inkTertiary, fontSize: 12 },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  reactionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface2,
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.line,
  },
  reactionChipMine: { borderColor: colors.brand, backgroundColor: colors.brand + '22' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { color: colors.inkSecondary, fontSize: 12, fontWeight: '700' },
  replyBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: colors.surface1, borderTopWidth: 1, borderColor: colors.line, gap: 8,
  },
  replyBarText: { color: colors.inkSecondary, flex: 1, fontSize: 13 },
  replyBarClose: { color: colors.inkTertiary, fontSize: 16, padding: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8, borderTopWidth: 1, borderColor: colors.line },
  input: {
    flex: 1, backgroundColor: colors.surface2, borderRadius: 22, paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 10, color: colors.ink, fontSize: 15, maxHeight: 110,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#06281F', fontSize: 18, fontWeight: '800' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface1, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, paddingBottom: 28, gap: 4,
  },
  quickRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.line, marginBottom: 8 },
  quickEmoji: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  sheetItem: { paddingVertical: 13, paddingHorizontal: 8 },
  sheetItemText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
});
