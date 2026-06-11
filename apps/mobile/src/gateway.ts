// Phoenix WS — gerçek zamanlı mesajlar (web gateway.ts'in mobil uyarlaması).
import { Socket, Channel } from 'phoenix';
import { gatewayUrl } from './config';
import { getAccessToken } from './api';

let socket: Socket | null = null;
const guildChannels = new Map<string, Channel>();

export function connectGateway(): Socket | null {
  const token = getAccessToken();
  if (!token) return null;
  if (socket) return socket;
  socket = new Socket(gatewayUrl(), { params: { token } });
  socket.connect();
  return socket;
}

export function disconnectGateway() {
  for (const ch of guildChannels.values()) ch.leave();
  guildChannels.clear();
  socket?.disconnect();
  socket = null;
}

export function joinGuild(guildId: string, onEvent: (event: string, payload: any) => void): Channel | null {
  const s = connectGateway();
  if (!s) return null;
  const existing = guildChannels.get(guildId);
  if (existing) return existing;
  const ch = s.channel(`guild:${guildId}`, {});
  for (const ev of ['MESSAGE_CREATE', 'MESSAGE_UPDATE', 'MESSAGE_DELETE', 'TYPING_START', 'REACTION_ADD', 'REACTION_REMOVE']) {
    ch.on(ev, (payload: any) => onEvent(ev, payload));
  }
  ch.join();
  guildChannels.set(guildId, ch);
  return ch;
}

export function leaveGuild(guildId: string) {
  guildChannels.get(guildId)?.leave();
  guildChannels.delete(guildId);
}

export function sendTyping(guildId: string, channelId: string) {
  guildChannels.get(guildId)?.push('typing', { channel_id: channelId });
}
