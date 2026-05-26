// Sidcord WebSocket bağlantısı (Phoenix Channels) + presence
import { Socket, Channel, Presence } from 'phoenix';
import { tokenStore } from './api';

let socket: Socket | null = null;
const guildChannels = new Map<string, Channel>();
const guildPresences = new Map<string, Presence>();
let userChannel: Channel | null = null;
const guildEventHandlers: Map<string, Map<string, ((ev: any) => void)[]>> = new Map();

export function connectGateway(): Socket | null {
  const token = tokenStore.access();
  if (!token) return null;

  if (socket) return socket;

  socket = new Socket('/socket', { params: { token }, logger: () => {} });
  socket.connect();
  return socket;
}

export function disconnectGateway() {
  for (const ch of guildChannels.values()) ch.leave();
  guildChannels.clear();
  guildPresences.clear();
  socket?.disconnect();
  socket = null;
}

export interface PresenceMeta {
  online_at: number;
  status: string;
}

export function joinGuild(
  guildId: string,
  handlers: {
    onMessage?: (event: any) => void;
    onPresence?: (onlineUserIds: Set<string>) => void;
  } = {},
): Channel | null {
  const s = connectGateway();
  if (!s) return null;
  const existing = guildChannels.get(guildId);
  if (existing) return existing;

  const ch = s.channel(`guild:${guildId}`);
  if (handlers.onMessage) {
    ch.on('MESSAGE_CREATE', handlers.onMessage);
  }
  // Önceden register edilmiş extra eventleri ekle
  const handlerMap = guildEventHandlers.get(guildId);
  if (handlerMap) {
    for (const [event, fns] of handlerMap.entries()) {
      for (const fn of fns) ch.on(event, fn);
    }
  }

  const presence = new Presence(ch);
  guildPresences.set(guildId, presence);

  function emitPresence() {
    const ids = new Set<string>();
    presence.list((id) => {
      ids.add(id);
      return id;
    });
    handlers.onPresence?.(ids);
  }

  presence.onSync(emitPresence);

  ch.join();
  guildChannels.set(guildId, ch);
  return ch;
}

export function leaveGuild(guildId: string) {
  const ch = guildChannels.get(guildId);
  if (ch) {
    ch.leave();
    guildChannels.delete(guildId);
    guildPresences.delete(guildId);
  }
}

// Generic guild event subscription
export function onGuildEvent(guildId: string, event: string, handler: (ev: any) => void) {
  let map = guildEventHandlers.get(guildId);
  if (!map) {
    map = new Map();
    guildEventHandlers.set(guildId, map);
  }
  const arr = map.get(event) ?? [];
  arr.push(handler);
  map.set(event, arr);

  const ch = guildChannels.get(guildId);
  if (ch) {
    ch.on(event, handler);
  }

  return () => {
    const m = guildEventHandlers.get(guildId);
    if (!m) return;
    const list = m.get(event) ?? [];
    m.set(event, list.filter((h) => h !== handler));
  };
}

// Re-bind stored guild event handlers when joining
const origJoinGuild = joinGuild;
void origJoinGuild;

export function joinUser(
  userId: string,
  handlers: {
    onNotification?: (ev: any) => void;
    onDMMessage?: (ev: any) => void;
  } = {},
): Channel | null {
  const s = connectGateway();
  if (!s) return null;
  if (userChannel) return userChannel;

  // Phoenix Channel için user kanalına `dev_${userId}` ile mock token kabul edilmiyor;
  // gerçek JWT token kullanıcının user_id'sini taşıyor zaten.
  const ch = s.channel(`user:${userId}`);
  if (handlers.onNotification) ch.on('NOTIFICATION', handlers.onNotification);
  if (handlers.onDMMessage) ch.on('MESSAGE_CREATE', handlers.onDMMessage);
  ch.join();
  userChannel = ch;
  return ch;
}

export function leaveUser() {
  if (userChannel) {
    userChannel.leave();
    userChannel = null;
  }
}

// Typing — kullanıcı yazarken çağrılır (throttled önerilir)
export function sendTyping(guildId: string, channelId: string) {
  const ch = guildChannels.get(guildId);
  if (ch) ch.push('typing', { channel_id: channelId });
}
