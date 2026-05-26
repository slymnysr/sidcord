// WebSocket signaling — istemci komutlarını routerlar
// İstemci akışı:
// 1) connect (token + channelId)
// 2) getRouterRtpCapabilities → server döner
// 3) createWebRtcTransport (send/recv)
// 4) connectTransport (dtlsParameters)
// 5) produce (kind, rtpParameters)
// 6) consume (producerId, rtpCapabilities)
// 7) leave

import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import pino from 'pino';
import { config } from './config.js';
import { getRoom, listPeerIds } from './room.js';

const log = pino({ name: 'voice/signaling', level: 'info' });

interface Message {
  id?: string;
  type: string;
  payload?: any;
  replyTo?: string;
}

type AuthedSocket = WebSocket & { userId?: string; channelId?: string; socketId?: string };

export function startSignaling() {
  const wss = new WebSocketServer({ port: config.port });
  log.info({ port: config.port }, 'voice signaling listening');

  wss.on('connection', (ws: AuthedSocket, req) => {
    const url = new URL(req.url ?? '/', `http://localhost`);
    const token = url.searchParams.get('token') ?? '';
    const channelId = url.searchParams.get('channel') ?? '';
    if (!channelId) {
      ws.close(4001, 'channel required');
      return;
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { uid?: number; sub?: string };
      ws.userId = String(decoded.uid ?? decoded.sub ?? '');
      if (!ws.userId) throw new Error('uid missing');
    } catch (e) {
      log.warn({ err: String(e) }, 'auth failed');
      ws.close(4002, 'unauthorized');
      return;
    }

    ws.socketId = uuid();
    ws.channelId = channelId;
    const room = getRoom(channelId);

    log.info({ userId: ws.userId, channelId }, 'ws connected');

    // Diğer üyelere bildir (yeni peer geldi)
    broadcast(wss, channelId, ws.userId!, {
      type: 'peer:joined',
      payload: { userId: ws.userId },
    });

    ws.on('message', async (raw) => {
      let msg: Message;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      try {
        await handleMessage(ws, wss, msg);
      } catch (e) {
        log.error({ err: String(e), type: msg.type }, 'handler error');
        send(ws, { type: 'error', replyTo: msg.id, payload: { message: String(e) } });
      }
    });

    ws.on('close', () => {
      if (!ws.userId || !ws.channelId) return;
      const r = getRoom(ws.channelId);
      r.removePeer(ws.userId);
      broadcast(wss, ws.channelId, ws.userId, {
        type: 'peer:left',
        payload: { userId: ws.userId },
      });
    });
  });
}

async function handleMessage(ws: AuthedSocket, wss: WebSocketServer, msg: Message) {
  if (!ws.userId || !ws.channelId) return;
  const room = getRoom(ws.channelId);

  switch (msg.type) {
    case 'getRouterRtpCapabilities': {
      const router = await room.router();
      send(ws, { type: 'routerRtpCapabilities', replyTo: msg.id, payload: router.rtpCapabilities });
      return;
    }

    case 'join': {
      await room.addPeer(ws.userId, ws.socketId!);
      const peerIds = listPeerIds(ws.channelId).filter((id) => id !== ws.userId);
      const existing = room.otherProducers(ws.userId).map((x) => ({
        producerId: x.producer.id,
        userId: x.peerId,
        kind: x.producer.kind,
        appData: x.producer.appData,
      }));
      send(ws, {
        type: 'joined',
        replyTo: msg.id,
        payload: { peers: peerIds, producers: existing },
      });
      return;
    }

    case 'getChannelPresence': {
      // Login olmuş ama kanala katılmamış birinin de sorgulayabilmesi için
      // ayrıca kullanılır (sidebar'da kim bağlı)
      const cid = msg.payload?.channelId as string | undefined;
      if (!cid) return;
      send(ws, {
        type: 'channelPresence',
        replyTo: msg.id,
        payload: { channelId: cid, peers: listPeerIds(cid) },
      });
      return;
    }

    case 'createWebRtcTransport': {
      const peer = room.peers.get(ws.userId);
      if (!peer) {
        send(ws, { type: 'error', replyTo: msg.id, payload: { message: 'peer not found' } });
        return;
      }
      const direction = msg.payload?.direction as 'send' | 'recv';
      const info = await room.createTransport(peer, direction);
      send(ws, { type: 'transportCreated', replyTo: msg.id, payload: info });
      return;
    }

    case 'connectTransport': {
      const peer = room.peers.get(ws.userId);
      if (!peer) return;
      const { transportId, dtlsParameters } = msg.payload;
      const t = peer.sendTransport?.id === transportId ? peer.sendTransport : peer.recvTransport;
      if (!t) return;
      await t.connect({ dtlsParameters });
      send(ws, { type: 'transportConnected', replyTo: msg.id, payload: { transportId } });
      return;
    }

    case 'produce': {
      const peer = room.peers.get(ws.userId);
      if (!peer || !peer.sendTransport) return;
      const { kind, rtpParameters, appData } = msg.payload;
      const producer = await peer.sendTransport.produce({ kind, rtpParameters, appData });
      peer.producers.set(producer.id, producer);
      send(ws, { type: 'produced', replyTo: msg.id, payload: { id: producer.id } });
      broadcast(wss, ws.channelId, ws.userId, {
        type: 'newProducer',
        payload: { producerId: producer.id, userId: ws.userId, kind, appData },
      });
      return;
    }

    case 'consume': {
      const peer = room.peers.get(ws.userId);
      if (!peer || !peer.recvTransport) return;
      const { producerId, rtpCapabilities } = msg.payload;
      const router = await room.router();
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        send(ws, { type: 'error', replyTo: msg.id, payload: { message: 'cannot consume' } });
        return;
      }
      const consumer = await peer.recvTransport.consume({
        producerId,
        rtpCapabilities,
        paused: false,
      });
      peer.consumers.set(consumer.id, consumer);
      send(ws, {
        type: 'consumed',
        replyTo: msg.id,
        payload: {
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        },
      });
      return;
    }

    case 'leave': {
      room.removePeer(ws.userId);
      send(ws, { type: 'left', replyTo: msg.id });
      return;
    }

    default:
      send(ws, { type: 'error', replyTo: msg.id, payload: { message: 'unknown type ' + msg.type } });
  }
}

function send(ws: WebSocket, m: Message) {
  ws.send(JSON.stringify(m));
}

function broadcast(wss: WebSocketServer, channelId: string, exceptUserId: string, m: Message) {
  for (const client of wss.clients) {
    const c = client as AuthedSocket;
    if (c.readyState !== WebSocket.OPEN) continue;
    if (c.channelId !== channelId) continue;
    if (c.userId === exceptUserId) continue;
    send(c, m);
  }
}
