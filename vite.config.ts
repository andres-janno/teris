import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dbApiPlugin } from './src/server/dbApiPlugin.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dbApiPlugin()],
  server: {
    // Ainult localhost — arendus käib kohapeal (nt SSH tunneli kaudu), avalikku
    // ligipääsu pole. Toodang jookseb eraldi (vt src/server/prod.ts, agro.service).
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  }
});
