import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dbApiPlugin } from './src/server/dbApiPlugin.ts';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Commit, millest ehitus tehti (kuvatakse kasutajamenüüs versiooni kõrval).
function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dbApiPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(gitCommit())
  },
  server: {
    // Ainult localhost — arendus käib kohapeal (nt SSH tunneli kaudu), avalikku
    // ligipääsu pole. Toodang jookseb eraldi (vt src/server/prod.ts, agro.service).
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  }
});
