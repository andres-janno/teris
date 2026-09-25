import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dbApiPlugin } from './src/server/dbApiPlugin.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dbApiPlugin()],
  server: {
    // Ainult localhost — avalik ligipääs käib Apache'i kaudu (HTTPS + parool),
    // vt /etc/apache2/sites-available/agro.ventcap.ee.conf
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'agro.ventcap.ee'
    ],
    hmr: {
      host: 'agro.ventcap.ee',
      protocol: 'wss',
      clientPort: 443
    }
  }
});
