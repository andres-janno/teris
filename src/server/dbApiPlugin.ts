// src/server/dbApiPlugin.ts
// Vite'i arendusserveri ümbris: /api päringud → handleApiRequest.
// Toodangus kasutab sama käsitlejat src/server/prod.ts.
import type { Plugin } from 'vite';
import { handleApiRequest } from './apiHandler.ts';

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
        if (!req.url?.startsWith('/api')) return next();
        await handleApiRequest(req, res, DEV_OPTIONS);
      });
    }
  };
}
