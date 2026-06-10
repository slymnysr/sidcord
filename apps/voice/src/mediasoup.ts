// Worker havuzu + Router yönetimi
// Her CPU çekirdeği için bir mediasoup worker (ayrı process) açılır; kanallar
// round-robin dağıtılır. RTC port aralığı worker'lara eşit dilimlenir (çakışma olmaz).
import os from 'node:os';
import { createWorker, types as msTypes } from 'mediasoup';
import { config } from './config.js';
import pino from 'pino';

const log = pino({ name: 'voice/mediasoup', level: 'info' });

const workers: msTypes.Worker[] = [];
let nextWorkerIdx = 0;

export async function initWorker(): Promise<void> {
  if (workers.length) return;
  const cpuCount = Math.max(1, Math.min(os.cpus().length, 8));
  const totalPorts = config.worker.rtcMaxPort - config.worker.rtcMinPort + 1;
  const slice = Math.max(4, Math.floor(totalPorts / cpuCount));
  for (let i = 0; i < cpuCount; i++) {
    const min = config.worker.rtcMinPort + i * slice;
    const max = i === cpuCount - 1 ? config.worker.rtcMaxPort : min + slice - 1;
    const w = await createWorker({
      logLevel: config.worker.logLevel,
      logTags: config.worker.logTags,
      rtcMinPort: min,
      rtcMaxPort: max,
    });
    w.on('died', () => {
      log.error({ pid: w.pid }, 'mediasoup worker died — exiting');
      setTimeout(() => process.exit(1), 1000);
    });
    workers.push(w);
    log.info({ pid: w.pid, ports: `${min}-${max}` }, 'mediasoup worker started');
  }
  log.info({ count: workers.length }, 'worker havuzu hazır');
}

// Router cache: her sesli kanal için bir router (yaratılışta round-robin worker seçilir)
const routersByChannel = new Map<string, msTypes.Router>();

export async function getRouter(channelId: string): Promise<msTypes.Router> {
  let router = routersByChannel.get(channelId);
  if (router) return router;
  await initWorker();
  const w = workers[nextWorkerIdx % workers.length];
  nextWorkerIdx++;
  router = await w.createRouter({ mediaCodecs: config.router.mediaCodecs });
  routersByChannel.set(channelId, router);
  log.info({ channelId, workerPid: w.pid }, 'router created for channel');
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
