import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dbApiPlugin } from './src/server/dbApiPlugin.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dbApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      'agro.ventcap.ee'
    ]
  }
});
