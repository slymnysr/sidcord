// Sidcord voice istemcisi — mediasoup-client + WebSocket signaling
// Audio + video (kamera) + ekran paylaşımı destekler.
import { Device, types as msTypes } from 'mediasoup-client';
import { tokenStore } from './api';

type Handler = (m: any) => void;
type RequestPending = { resolve: (v: any) => void; reject: (e: any) => void };

export interface RemoteStreamInfo {
  userId: string;
  producerId: string;
  kind: 'audio' | 'video';
  source: 'mic' | 'camera' | 'screen';
  stream: MediaStream;
}

class VoiceClient {
  private ws: WebSocket | null = null;
  private device: Device | null = null;
  private sendTransport: msTypes.Transport | null = null;
  private recvTransport: msTypes.Transport | null = null;
  private requestId = 0;
  private pending = new Map<string, RequestPending>();
  private eventHandlers: Record<string, Handler[]> = {};

  // Local stream'ler
  private micStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  // Local producers
  private audioProducer: msTypes.Producer | null = null;
  private cameraProducer: msTypes.Producer | null = null;
  private screenProducer: msTypes.Producer | null = null;

  channelId: string | null = null;

  // Uzak medyalar
  private remotes = new Map<string, RemoteStreamInfo>(); // producerId -> info
  private remoteAudioEls = new Map<string, HTMLAudioElement>();
  private producerSource = new Map<string, 'mic' | 'camera' | 'screen'>();

  on(event: string, h: Handler) {
    (this.eventHandlers[event] ??= []).push(h);
  }
  off(event: string, h: Handler) {
    const list = this.eventHandlers[event];
    if (!list) return;
    this.eventHandlers[event] = list.filter((x) => x !== h);
  }
  private emit(event: string, payload: any) {
    for (const h of this.eventHandlers[event] ?? []) h(payload);
  }

  remoteStreams(): RemoteStreamInfo[] {
    return Array.from(this.remotes.values());
  }

  async connect(channelId: string) {
    const token = tokenStore.access();
    if (!token) throw new Error('no token');
    if (this.ws) await this.disconnect();
    this.channelId = channelId;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/voice-ws/?token=${encodeURIComponent(token)}&channel=${channelId}`;
    this.ws = new WebSocket(url);

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('no ws'));
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
    });

    this.ws.onmessage = (evt) => this.onMessage(evt.data as string);
    this.ws.onclose = () => this.emit('disconnected', {});

    const caps = await this.request('getRouterRtpCapabilities');
    this.device = new Device();
    await this.device.load({ routerRtpCapabilities: caps });

    const { peers, producers: existing } = await this.request('join');
    this.emit('joined', { peers });
    // Mevcut producer'lar transportlar hazır olduktan sonra tüketilecek
    if (Array.isArray(existing)) {
      (this as any).__pendingProducers = existing;
    }

    await this.createSendTransport();
    await this.createRecvTransport();

    // İlk tüketim için recv transport'un connect'i gereklidir.
    // mediasoup connect olayı ilk consume çağrısında ateşlenir.
    // O yüzden mevcut producer'ları join yanıtından sonra tüketelim
    if (Array.isArray((this as any).__pendingProducers)) {
      for (const p of (this as any).__pendingProducers) {
        const src = (p.appData?.source as 'mic' | 'camera' | 'screen') ?? 'mic';
        try {
          await this.consume(p.producerId, p.userId, src);
        } catch (e) {
          console.warn('initial consume failed', e);
        }
      }
      (this as any).__pendingProducers = undefined;
    }

    // Mikrofonu otomatik aç
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    const audioTrack = this.micStream.getAudioTracks()[0];
    this.audioProducer = await this.sendTransport!.produce({
      track: audioTrack,
      appData: { source: 'mic' },
    });
    this.producerSource.set(this.audioProducer.id, 'mic');
    this.emit('connected', { channelId });
  }

  async publishCamera(): Promise<MediaStream> {
    if (!this.sendTransport) throw new Error('not connected');
    if (this.cameraStream) return this.cameraStream;
    this.cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720, frameRate: 30 },
      audio: false,
    });
    const track = this.cameraStream.getVideoTracks()[0];
    this.cameraProducer = await this.sendTransport.produce({
      track,
      appData: { source: 'camera' },
    });
    this.producerSource.set(this.cameraProducer.id, 'camera');
    this.emit('local:camera', { stream: this.cameraStream });
    return this.cameraStream;
  }

  async unpublishCamera() {
    this.cameraProducer?.close();
    this.cameraStream?.getTracks().forEach((t) => t.stop());
    if (this.cameraProducer) this.producerSource.delete(this.cameraProducer.id);
    this.cameraProducer = null;
    this.cameraStream = null;
    this.emit('local:camera', { stream: null });
  }

  async publishScreen(): Promise<MediaStream> {
    if (!this.sendTransport) throw new Error('not connected');
    if (this.screenStream) return this.screenStream;
    // @ts-ignore — getDisplayMedia
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });
    const track = this.screenStream.getVideoTracks()[0];
    track.onended = () => this.unpublishScreen();
    this.screenProducer = await this.sendTransport.produce({
      track,
      appData: { source: 'screen' },
    });
    this.producerSource.set(this.screenProducer.id, 'screen');
    this.emit('local:screen', { stream: this.screenStream });
    return this.screenStream;
  }

  async unpublishScreen() {
    this.screenProducer?.close();
    this.screenStream?.getTracks().forEach((t) => t.stop());
    if (this.screenProducer) this.producerSource.delete(this.screenProducer.id);
    this.screenProducer = null;
    this.screenStream = null;
    this.emit('local:screen', { stream: null });
  }

  setMicrophoneEnabled(enabled: boolean) {
    if (!this.audioProducer) return;
    if (enabled) this.audioProducer.resume();
    else this.audioProducer.pause();
    this.emit('mic:changed', { enabled });
  }

  isConnected(): boolean {
    return this.channelId != null && !!this.audioProducer;
  }

  isMicrophoneEnabled(): boolean {
    return this.audioProducer ? !this.audioProducer.paused : true;
  }

  async disconnect() {
    try {
      this.audioProducer?.close();
      this.cameraProducer?.close();
      this.screenProducer?.close();
      this.micStream?.getTracks().forEach((t) => t.stop());
      this.cameraStream?.getTracks().forEach((t) => t.stop());
      this.screenStream?.getTracks().forEach((t) => t.stop());
      this.sendTransport?.close();
      this.recvTransport?.close();
      for (const el of this.remoteAudioEls.values()) {
        el.pause();
        el.remove();
      }
      this.remoteAudioEls.clear();
      this.remotes.clear();
      this.producerSource.clear();
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        await this.request('leave').catch(() => {});
        this.ws.close();
      }
    } catch (e) {
      console.warn('disconnect error', e);
    }
    this.ws = null;
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.audioProducer = null;
    this.cameraProducer = null;
    this.screenProducer = null;
    this.micStream = null;
    this.cameraStream = null;
    this.screenStream = null;
    this.channelId = null;
    this.emit('remotes:changed', {});
  }

  private async createSendTransport() {
    if (!this.device) return;
    const info = await this.request('createWebRtcTransport', { direction: 'send' });
    this.sendTransport = this.device.createSendTransport({
      id: info.id,
      iceParameters: info.iceParameters,
      iceCandidates: info.iceCandidates,
      dtlsParameters: info.dtlsParameters,
    });
    this.sendTransport.on('connect', ({ dtlsParameters }, cb, eb) => {
      this.request('connectTransport', { transportId: info.id, dtlsParameters })
        .then(() => cb())
        .catch(eb);
    });
    this.sendTransport.on('produce', ({ kind, rtpParameters, appData }, cb, eb) => {
      this.request('produce', { kind, rtpParameters, appData })
        .then(({ id }: { id: string }) => cb({ id }))
        .catch(eb);
    });
  }

  private async createRecvTransport() {
    if (!this.device) return;
    const info = await this.request('createWebRtcTransport', { direction: 'recv' });
    this.recvTransport = this.device.createRecvTransport({
      id: info.id,
      iceParameters: info.iceParameters,
      iceCandidates: info.iceCandidates,
      dtlsParameters: info.dtlsParameters,
    });
    this.recvTransport.on('connect', ({ dtlsParameters }, cb, eb) => {
      this.request('connectTransport', { transportId: info.id, dtlsParameters })
        .then(() => cb())
        .catch(eb);
    });
  }

  private async consume(producerId: string, userId: string, source: 'mic' | 'camera' | 'screen' = 'mic') {
    if (!this.device || !this.recvTransport) return;
    const data = await this.request('consume', {
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });
    const consumer = await this.recvTransport.consume({
      id: data.id,
      producerId: data.producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });
    const stream = new MediaStream([consumer.track]);
    const info: RemoteStreamInfo = {
      userId,
      producerId,
      kind: data.kind as 'audio' | 'video',
      source,
      stream,
    };
    this.remotes.set(producerId, info);

    if (data.kind === 'audio') {
      const el = document.createElement('audio');
      el.srcObject = stream;
      el.autoplay = true;
      document.body.appendChild(el);
      this.remoteAudioEls.set(producerId, el);
    }
    this.emit('remotes:changed', {});
    this.emit('consumed', info);
  }

  private async onMessage(raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.replyTo) {
      const p = this.pending.get(msg.replyTo);
      if (p) {
        this.pending.delete(msg.replyTo);
        if (msg.type === 'error') p.reject(new Error(msg.payload?.message ?? 'error'));
        else p.resolve(msg.payload);
      }
      return;
    }

    switch (msg.type) {
      case 'peer:joined':
        this.emit('peer:joined', msg.payload);
        break;
      case 'peer:left':
        for (const [pid, info] of this.remotes.entries()) {
          if (info.userId === msg.payload.userId) {
            const el = this.remoteAudioEls.get(pid);
            el?.pause();
            el?.remove();
            this.remoteAudioEls.delete(pid);
            this.remotes.delete(pid);
          }
        }
        this.emit('remotes:changed', {});
        this.emit('peer:left', msg.payload);
        break;
      case 'newProducer': {
        const src = (msg.payload.appData?.source as 'mic' | 'camera' | 'screen') ?? 'mic';
        this.consume(msg.payload.producerId, msg.payload.userId, src).catch((e) =>
          console.warn('consume failed', e),
        );
        break;
      }
    }
  }

  private request(type: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('ws not open'));
        return;
      }
      const id = String(++this.requestId);
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, type, payload }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout: ${type}`));
        }
      }, 10000);
    });
  }
}

export const voice = new VoiceClient();
