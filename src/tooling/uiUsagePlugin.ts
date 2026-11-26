// src/tooling/uiUsagePlugin.ts — Vite'i plugin: virtuaalne moodul `virtual:ui-usage` (ühiste ui komponentide
// kasutussagedus, vt uiUsage.ts). Failid loetakse üks kord (esimesel päringul); brauserisse läheb ainult
// kokkuvõtte JSON, mitte lähtekood. Arendusserveris arvutatakse uuesti, kui mõni src all olev .tsx muutub.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { countUiUsage, isCountedFile, type UiUsage } from './uiUsage.ts';

const VIRTUAL_ID = 'virtual:ui-usage';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

function collectTsx(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('._')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectTsx(full, out);
    else if (entry.name.endsWith('.tsx')) out.push(full);
  }
}

/** Loeb repo src/ failid ja loendab; `root` on projekti juurkaust. */
export function computeUiUsage(root: string): UiUsage {
  const paths: string[] = [];
  collectTsx(join(root, 'src'), paths);
  const files: Record<string, string> = {};
  for (const abs of paths) {
    const rel = relative(root, abs).split('\\').join('/');
    if (isCountedFile(rel)) files[rel] = readFileSync(abs, 'utf8');
  }
  const indexSource = readFileSync(join(root, 'src/components/ui/index.ts'), 'utf8');
  return countUiUsage({ indexSource, files });
}

export function uiUsagePlugin(): Plugin {
  let root = process.cwd();
  let cache: UiUsage | null = null;
  return {
    name: 'ui-usage',
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      cache ??= computeUiUsage(root);
      return `export default ${JSON.stringify(cache)};`;
    },
    configureServer(server) {
      const invalidate = (file: string) => {
        if (!file.endsWith('.tsx') && !file.endsWith('/index.ts')) return;
        cache = null;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      server.watcher.on('change', invalidate);
      server.watcher.on('add', invalidate);
      server.watcher.on('unlink', invalidate);
    }
  };
}
