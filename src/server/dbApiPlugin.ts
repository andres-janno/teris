// src/server/dbApiPlugin.ts
// Vite'i arendusserveri ümbris: /api päringud → handleApiRequest.
// Toodangus kasutab sama käsitlejat src/server/prod.ts.
import type { Plugin } from 'vite';
import { handleApiRequest } from './apiHandler';

const DEV_OPTIONS = {
  allowedOrigins: ['https://agro.ventcap.ee', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  // Kuni toodanguserverile üleminekuni kaitseb arendusserverit Apache'i Basic Auth.
  requireAuth: false
};

export function dbApiPlugin(): Plugin {
  return {
    name: 'db-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api')) return next();
        await handleApiRequest(req, res, DEV_OPTIONS);
      });
    }
  };
}
