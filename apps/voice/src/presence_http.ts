// Voice presence için HTTP endpoint — web istemcisi sesli kanala katılmadan da
// hangi kullanıcının bağlı olduğunu öğrenebilsin diye.
import { createServer } from 'node:http';
import { listPeerIds } from './room.js';
import pino from 'pino';

const log = pino({ name: 'voice/http', level: 'info' });

export function startHTTP() {
  const port = parseInt(process.env.VOICE_HTTP_PORT ?? '4444', 10);
  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (!req.url) {
      res.statusCode = 404;
      return res.end('{}');
    }

    if (req.url === '/health') {
      return res.end(JSON.stringify({ status: 'ok', service: 'sidcord-voice' }));
    }

    // /presence?channels=id1,id2,id3 → her kanal için peer listesi
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === '/presence') {
      const channels = (url.searchParams.get('channels') ?? '').split(',').filter(Boolean);
      const out: Record<string, string[]> = {};
      for (const c of channels) out[c] = listPeerIds(c);
      return res.end(JSON.stringify(out));
    }

    res.statusCode = 404;
    res.end('{}');
  });

  server.listen(port, () => {
    log.info({ port }, 'voice HTTP listening');
  });
}
