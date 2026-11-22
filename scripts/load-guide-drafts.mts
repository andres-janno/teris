// scripts/load-guide-drafts.mts — laeb mustandid andmebaasi (help_articles): peatükid <kaust>/<nr>-<võti>.html ja
// kohtjuhendid <kaust>/spots/<võti>.html. Tekst kirjutatakse AINULT tühja kohta; olemasolevat teksti ei puudutata.
// Kohtjuhendile pannakse seotud peatükk (registri `guideLink`) ainult tühjale lingile. Iga kirjutis teeb versioonirea
// autoriga „mustand“. Live'is käivitatakse alles kasutaja „jah“ järel. Kasutus (serveris):
//   npx tsx scripts/load-guide-drafts.mts --dry-run          # ainult näitab, mida kirjutaks
//   npx tsx scripts/load-guide-drafts.mts [kaust]            # kirjutab (vaikimisi docs/juhend)
import 'dotenv/config';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canSetGuideLink, isHelpEmpty, setGuideLinkIfEmpty, writeHelpIfEmpty } from '../src/server/helpArticles.ts';
import { linkSpots, loadDrafts, loadSpotDrafts, type DraftResult, type DraftStore } from '../src/server/guideDrafts.ts';
import { authDb } from '../src/server/db.ts';

const AUTHOR = 'mustand';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dir = args.find((a) => !a.startsWith('--')) ?? 'docs/juhend';

const read = (d: string) =>
  existsSync(d)
    ? readdirSync(d)
        .filter((n) => n.endsWith('.html'))
        .sort()
        .map((name) => ({ name, html: readFileSync(join(d, name), 'utf8') }))
    : [];

const store: DraftStore = {
  isEmpty: isHelpEmpty,
  writeIfEmpty: (key, html, guideLink) => writeHelpIfEmpty(key, html, AUTHOR, guideLink ?? null),
  canSetLink: canSetGuideLink,
  setLinkIfEmpty: (key, link) => setGuideLinkIfEmpty(key, link, AUTHOR)
};

const chapters = await loadDrafts(read(dir), store, dryRun);
const spots = await loadSpotDrafts(read(join(dir, 'spots')), store, dryRun);
const links = await linkSpots(store, dryRun);

const print = (title: string, rs: DraftResult[]) => {
  console.log(`\n${title}`);
  for (const r of rs) console.log(`  ${r.status.padEnd(17)} ${r.file}${r.key && r.key !== r.file ? `  →  ${r.key}` : ''}`);
};
print('Peatükid', chapters);
print('Kohtjuhendid (tekst)', spots);
print('Kohtjuhendid (seotud peatükk)', links);

const all = [...chapters, ...spots, ...links];
const count = (...s: string[]) => all.filter((r) => s.includes(r.status)).length;
console.log(
  `\n${dryRun ? 'Kuiv jooks (midagi ei kirjutatud)' : 'Valmis'}: tekste ${count('written', 'would-write')}, linke ${count('link-set', 'would-link')}, ` +
    `olemas/jäetud ${count('skipped-existing', 'link-kept')}, tühje ${count('skipped-blank')}, vigaseid ${count('invalid-name', 'number-mismatch', 'too-long', 'unknown-spot')}`
);
await authDb().$disconnect();
