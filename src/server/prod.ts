// src/server/prod.ts — toodanguserver: dist/ + /api (sisselogimisega) + avalik landing.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './apiHandler';
import { serveStatic, serveFile } from './static';
import { isPlatformHost } from './platformHost';
import { hasValidSession } from './authGate';
import { decideLandingRoute, needsSessionCheck, PUBLIC_ONLY_FILES } from './landing/landingRoute';
import { recordHit, startLandingRetention } from './landing/landingEvents';

const PORT = Number(process.env.PORT ?? 8820);
const HOST = '127.0.0.1';
const DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const API_OPTIONS = {
  allowedOrigins: ['https://teris.ee', 'https://www.teris.ee'],
  requireAuth: true,
  platformAllowedOrigins: ['https://admin.teris.ee']
};

async function serveTenantHost(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  // Sessiooni kontrolli viga → landing (sisselogitud kasutaja jõuab „Logi sisse“ kaudu edasi)
  const session = needsSessionCheck(pathname) ? await hasValidSession(req).catch(() => false) : false;
  const decision = decideLandingRoute(pathname, session);
  if (decision.kind === 'redirect') {
    res.statusCode = 302;
    res.setHeader('Location', decision.location);
    res.end();
    return;
  }
  if (decision.kind === 'file') {
    if (pathname === '/') res.setHeader('Vary', 'Cookie'); // sama URL, sisu sõltub sessioonist
    if (decision.hit) recordHit(req, pathname);
    await serveFile(req, res, DIST_DIR, decision.file);
    return;
  }
  await serveStatic(req, res, DIST_DIR, { spaEntry: 'index.html', blocked: ['admin.html', ...PUBLIC_ONLY_FILES] });
}

const server = http.createServer(async (req, res) => {
  try {
    if ((req.url ?? '').startsWith('/api')) {
      await handleApiRequest(req, res, API_OPTIONS);
    } else if (isPlatformHost(req)) {
      await serveStatic(req, res, DIST_DIR, { spaEntry: 'admin.html', blocked: ['index.html', ...PUBLIC_ONLY_FILES] });
    } else {
      await serveTenantHost(req, res);
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
  startLandingRetention();
});
