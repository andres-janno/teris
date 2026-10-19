// src/server/dbApiPlugin.ts
// Vite'i arendusserveri ümbris: /api päringud → handleApiRequest.
// Toodangus kasutab sama käsitlejat src/server/prod.ts.
import type { Plugin } from 'vite';
import { handleApiRequest } from './apiHandler.ts';
import { hasValidSession } from './authGate.ts';
import { decideLandingRoute, needsSessionCheck } from './landing/landingRoute.ts';

const DEV_OPTIONS = {
  allowedOrigins: ['https://teris.ee', 'https://www.teris.ee', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  // Basic Auth on kadunud — arendusserver kasutab sama sisselogimist/sessiooni nõuet mis toodang.
  requireAuth: true,
  platformAllowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  platformOnAnyHost: true
};

export function dbApiPlugin(): Plugin {
  return {
    name: 'db-api-plugin',
    configureServer(server) {
      server.watcher.on('change', async (file) => {
        if (file.includes('/src/server/')) {
          await server.restart();
        }
      });
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
          if (!needsSessionCheck(pathname) && pathname !== '/privacy') return next();
          const d = decideLandingRoute(pathname, needsSessionCheck(pathname) ? await hasValidSession(req).catch(() => false) : false);
          if (d.kind === 'redirect') {
            res.statusCode = 302;
            res.setHeader('Location', d.location);
            res.end();
            return;
          }
          // Vite serveerib ja teisendab mitmelehelise sisendi ise (landingHtmlPlugin süstib sisu)
          if (d.kind === 'file' && (d.file === 'landing.html' || d.file === 'privacy.html')) req.url = `/${d.file}`;
          return next();
        }
        await handleApiRequest(req, res, DEV_OPTIONS);
      });
    }
  };
}
