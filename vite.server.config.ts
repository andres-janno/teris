// vite.server.config.ts — serveri SSR-ehitus (ilma rakenduse pluginateta).
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: true,
    outDir: 'dist-server',
    emptyOutDir: true,
    target: 'node22',
    rolldownOptions: {
      input: {
        userCli: 'src/server/userCli.ts'
      },
      output: {
        entryFileNames: '[name].js',
        format: 'es'
      }
    }
  }
});
