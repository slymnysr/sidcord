// Sidcord voice config — mediasoup ayarları + JWT secret + portlar
import type { types as msTypes } from 'mediasoup';

export const config = {
  port: parseInt(process.env.VOICE_PORT ?? '4443', 10),
  jwtSecret: process.env.SIDCORD_JWT_SECRET ?? 'dev_jwt_secret_change_in_prod_at_least_32_chars',

  // mediasoup worker
  worker: {
    rtcMinPort: parseInt(process.env.MS_RTC_MIN_PORT ?? '40000', 10),
    rtcMaxPort: parseInt(process.env.MS_RTC_MAX_PORT ?? '40100', 10),
    logLevel: 'warn' as msTypes.WorkerLogLevel,
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'] as msTypes.WorkerLogTag[],
  },

  // Router (codec) yapılandırması
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        preferredPayloadType: 100,
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        preferredPayloadType: 101,
        clockRate: 90000,
        parameters: { 'x-google-start-bitrate': 1000 },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        preferredPayloadType: 102,
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
        },
      },
    ] satisfies msTypes.RtpCodecCapability[],
  },

  // WebRtcTransport listenIps
  // Production'da public IP'yi announcedIp olarak ver
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MS_LISTEN_IP ?? '0.0.0.0',
        announcedIp: process.env.MS_ANNOUNCED_IP ?? '127.0.0.1',
      },
    ],
    initialAvailableOutgoingBitrate: 1_000_000,
    minimumAvailableOutgoingBitrate: 600_000,
    maxIncomingBitrate: 1_500_000,
  },
};
