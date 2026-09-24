// Eraldi konfiguratsioon, et Vitest ei laeks vite.config.ts pluginaid
// (dbApiPlugin avaks andmebaasiühendused).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
