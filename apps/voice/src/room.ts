// Bir sesli kanal = bir Room
// Peer = kullanıcı bağlantısı, transport'lar, producer'lar, consumer'lar
import type { types as msTypes } from 'mediasoup';
import { getRouter, createWebRtcTransport } from './mediasoup.js';
import pino from 'pino';

const log = pino({ name: 'voice/room', level: 'info' });

export interface Peer {
  id: string;          // user_id (snowflake string)
  socketId: string;    // websocket bağlantısı kimliği
  sendTransport?: msTypes.WebRtcTransport;
  recvTransport?: msTypes.WebRtcTransport;
  producers: Map<string, msTypes.Producer>;   // producerId -> producer
  consumers: Map<string, msTypes.Consumer>;   // consumerId -> consumer
}

export class Room {
  channelId: string;
  peers = new Map<string, Peer>();

  constructor(channelId: string) {
    this.channelId = channelId;
  }

  async router(): Promise<msTypes.Router> {
    return await getRouter(this.channelId);
  }

  async addPeer(userId: string, socketId: string): Promise<Peer> {
    const peer: Peer = {
      id: userId,
      socketId,
      producers: new Map(),
      consumers: new Map(),
    };
    this.peers.set(userId, peer);
    log.info({ channelId: this.channelId, userId }, 'peer joined');
    return peer;
  }

  removePeer(userId: string) {
    const peer = this.peers.get(userId);
    if (!peer) return;
    for (const p of peer.producers.values()) p.close();
    for (const c of peer.consumers.values()) c.close();
    peer.sendTransport?.close();
    peer.recvTransport?.close();
    this.peers.delete(userId);
    log.info({ channelId: this.channelId, userId }, 'peer left');
  }

  async createTransport(peer: Peer, direction: 'send' | 'recv') {
    const transport = await createWebRtcTransport(this.channelId);
    if (direction === 'send') peer.sendTransport = transport;
    else peer.recvTransport = transport;
    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  // Diğer peer'ler için consumer üret
  otherProducers(excludeUserId: string): { peerId: string; producer: msTypes.Producer }[] {
    const out: { peerId: string; producer: msTypes.Producer }[] = [];
    for (const peer of this.peers.values()) {
      if (peer.id === excludeUserId) continue;
      for (const p of peer.producers.values()) out.push({ peerId: peer.id, producer: p });
    }
    return out;
  }
}

const rooms = new Map<string, Room>();

export function getRoom(channelId: string): Room {
  let room = rooms.get(channelId);
  if (!room) {
    room = new Room(channelId);
    rooms.set(channelId, room);
  }
  return room;
}

export function listPeerIds(channelId: string): string[] {
  return Array.from(rooms.get(channelId)?.peers.keys() ?? []);
}
