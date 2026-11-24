// scripts/changelog-note.mts — lisab inimkeelse muudatuse rea faili changelog/unreleased.jsonl.
// Kasutus:
//   npm run note -- --type feature --area "Ladu" "Artiklite vaates on nüüd näha kogu lao koguväärtus."
//   npm run note -- --type fix "Parandatud kaardi filtri lähtestamine."
import { appendFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { normalizeChangelogType } from '../src/server/releaseDraft.ts';

const FILE = resolve(process.cwd(), 'changelog/unreleased.jsonl');
const args = process.argv.slice(2);

let typeRaw = 'feature';
let area: string | undefined;
let commit: string | undefined;
const textParts: string[] = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--type' || a === '-t') {
    typeRaw = args[++i] ?? '';
  } else if (a === '--area' || a === '-a') {
    area = args[++i] ?? '';
  } else if (a === '--commit' || a === '-c') {
    commit = args[++i] ?? '';
  } else if (a === '--help' || a === '-h') {
    console.log('Kasutus: npm run note -- --type <feature|improvement|fix> [--area "Valdkond"] [--commit <hash>] "Inimkeelne kirjeldus"');
    process.exit(0);
  } else {
    textParts.push(a);
  }
}

const type = normalizeChangelogType(typeRaw);
if (!type) {
  console.error(`Tundmatu tüüp "${typeRaw}". Lubatud: feature, improvement, fix`);
  process.exit(1);
}

const text = textParts.join(' ').trim();
if (!text) {
  console.error('Kirjeldus puudub. Näide: npm run note -- --type feature --area "Ladu" "Uus koguväärtuse rida"');
  process.exit(1);
}

if (!commit) {
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    commit = undefined;
  }
}

const date = new Date().toISOString().slice(0, 10);
const entry = {
  ...(commit ? { commit } : {}),
  date,
  type,
  ...(area?.trim() ? { area: area.trim() } : {}),
  text
};

mkdirSync(dirname(FILE), { recursive: true });
appendFileSync(FILE, `${JSON.stringify(entry)}\n`, 'utf8');
console.log(`Lisatud changelog/unreleased.jsonl: [${type}]${entry.area ? ` (${entry.area})` : ''} ${text}`);
