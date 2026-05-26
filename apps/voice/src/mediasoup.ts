// Worker + Router yönetimi
import { createWorker, types as msTypes } from 'mediasoup';
import { config } from './config.js';
import pino from 'pino';

const log = pino({ name: 'voice/mediasoup', level: 'info' });

let worker: msTypes.Worker | null = null;

export async function initWorker(): Promise<msTypes.Worker> {
  if (worker) return worker;
  worker = await createWorker({
    logLevel: config.worker.logLevel,
    logTags: config.worker.logTags,
    rtcMinPort: config.worker.rtcMinPort,
    rtcMaxPort: config.worker.rtcMaxPort,
  });
  worker.on('died', () => {
    log.error('mediasoup worker died — exiting');
    setTimeout(() => process.exit(1), 1000);
  });
  log.info({ pid: worker.pid }, 'mediasoup worker started');
  return worker;
}

// Router cache: her sesli kanal için bir router
const routersByChannel = new Map<string, msTypes.Router>();

export async function getRouter(channelId: string): Promise<msTypes.Router> {
  let router = routersByChannel.get(channelId);
  if (router) return router;
  const w = await initWorker();
  router = await w.createRouter({ mediaCodecs: config.router.mediaCodecs });
  routersByChannel.set(channelId, router);
  log.info({ channelId }, 'router created for channel');
  return router;
}

export async function createWebRtcTransport(channelId: string): Promise<msTypes.WebRtcTransport> {
  const router = await getRouter(channelId);
  const transport = await router.createWebRtcTransport({
    listenIps: config.webRtcTransport.listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: config.webRtcTransport.initialAvailableOutgoingBitrate,
  });
  if (config.webRtcTransport.maxIncomingBitrate) {
    try {
      await transport.setMaxIncomingBitrate(config.webRtcTransport.maxIncomingBitrate);
    } catch {}
  }
  return transport;
}
