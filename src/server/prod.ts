// src/server/prod.ts — toodanguserver: dist/ + /api (sisselogimisega).
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './apiHandler';
import { serveStatic } from './static';

const PORT = Number(process.env.PORT ?? 8820);
const HOST = '127.0.0.1';
const DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const API_OPTIONS = {
  allowedOrigins: ['https://teris.ee', 'https://www.teris.ee'],
  requireAuth: true,
  platformAllowedOrigins: ['https://admin.teris.ee']
};

const server = http.createServer(async (req, res) => {
  try {
    if ((req.url ?? '').startsWith('/api')) {
      await handleApiRequest(req, res, API_OPTIONS);
    } else {
      await serveStatic(req, res, DIST_DIR);
    }
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Serveri viga');
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`teris map kuulab http://${HOST}:${PORT} (dist: ${DIST_DIR})`);
});
