// Eraldi konfiguratsioon, et Vitest ei laeks vite.config.ts pluginaid
// (dbApiPlugin avaks andmebaasiühendused).
import { defineConfig } from 'vitest/config';
import { uiUsagePlugin } from './src/tooling/uiUsagePlugin.ts';

// Ainult ui-usage plugin: galerii import `virtual:ui-usage` vajab päris loendust (UiGalleryCaptions.test.ts).
export default defineConfig({
  plugins: [uiUsagePlugin()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
});
