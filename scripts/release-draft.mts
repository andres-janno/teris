// scripts/release-draft.mts — koostab changelog/unreleased.jsonl ja git logi põhjal
// uue ReleaseNote mustandi (DRAFT) andmebaasi, et see admin.teris.ee-s üle vaadata ja avaldada.
//
// Kasutus:
//   npm run release:draft -- --dry-run
//   npm run release:draft -- [--title "Pealkiri"] [--since <tag-või-commit>] [--include-git-fallback] [--keep-unreleased] [--tag]
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { Prisma } from '@prisma/client';
import { authDb } from '../src/server/db.ts';
import { buildDraftItems, nextDateVersion, parseChangelogJsonl } from '../src/server/releaseDraft.ts';
import type { ReleaseNoteSourceCommit } from '../src/types/releaseNotes.ts';

const FILE = resolve(process.cwd(), 'changelog/unreleased.jsonl');
const args = process.argv.slice(2);

const hasFlag = (f: string) => args.includes(f);
const getOpt = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const dryRun = hasFlag('--dry-run');
const includeGitFallback = hasFlag('--include-git-fallback');
const keepUnreleased = hasFlag('--keep-unreleased');
const createTag = hasFlag('--tag');
const customTitle = getOpt('--title');
const customVersion = getOpt('--version');
const sinceArg = getOpt('--since');

function git(cmdArgs: string[]): string | null {
  try {
    return execFileSync('git', cmdArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const lastTag = sinceArg ?? git(['describe', '--tags', '--abbrev=0', '--match', 'v*']);
const headHash = git(['rev-parse', '--short', 'HEAD']) ?? undefined;
const range = lastTag ? `${lastTag}..HEAD` : '-n 30';
const logArgs = lastTag
  ? ['log', range, '--pretty=format:%h%x09%ad%x09%s', '--date=short']
  : ['log', '-n', '30', '--pretty=format:%h%x09%ad%x09%s', '--date=short'];

const rawLog = git(logArgs) ?? '';
const commits: ReleaseNoteSourceCommit[] = rawLog
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => {
    const [hash, date, ...rest] = l.split('\t');
    return { hash, date, subject: rest.join('\t') };
  });

const jsonlContent = existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
const { entries, errors } = parseChangelogJsonl(jsonlContent);
if (errors.length > 0) {
  console.error('Vigased read failis changelog/unreleased.jsonl:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

const { items, uncoveredCommits } = buildDraftItems(entries, commits, includeGitFallback);

const existingRows = await authDb().releaseNote.findMany({ select: { version: true } });
const version = customVersion?.trim() || nextDateVersion(existingRows.map((r) => r.version));
const title = customTitle?.trim() || `TERIS uuendused ${version}`;

console.log(`Versioon:  ${version}`);
console.log(`Pealkiri:  ${title}`);
console.log(`Vahemik:   ${lastTag ?? '(esimene release)'} → ${headHash ?? 'HEAD'} (${commits.length} committi)`);
console.log(`Punkte:    ${items.length} (unreleased.jsonl: ${entries.length})`);

for (const item of items) {
  console.log(`  [${item.category}]${item.area ? ` (${item.area})` : ''} ${item.text}`);
}

if (uncoveredCommits.length > 0 && !includeGitFallback) {
  console.log(`\nHoiatus: ${uncoveredCommits.length} feat/fix committi pole failis changelog/unreleased.jsonl:`);
  for (const c of uncoveredCommits) console.log(`  ${c.hash}  ${c.subject}`);
  console.log('Kasuta --include-git-fallback, kui soovid need toorikuna mustandisse lisada.');
}

if (items.length === 0) {
  console.log('\nMustandis pole ühtegi punkti — midagi ei loodud.');
  await authDb().$disconnect();
  process.exit(0);
}

if (dryRun) {
  console.log('\nKuiv jooks (--dry-run): andmebaasi ei kirjutatud.');
  await authDb().$disconnect();
  process.exit(0);
}

const created = await authDb().releaseNote.create({
  data: {
    version,
    title,
    summary: null,
    itemsJson: items as unknown as Prisma.InputJsonValue,
    sourceCommitsJson: commits.length ? (commits as unknown as Prisma.InputJsonValue) : undefined,
    fromCommit: lastTag ?? null,
    toCommit: headHash ?? null,
    status: 'DRAFT',
    createdBy: 'release-draft',
    updatedBy: 'release-draft'
  }
});

if (!keepUnreleased && existsSync(FILE)) {
  writeFileSync(FILE, '', 'utf8');
}

if (createTag) {
  const tagName = `v${version}`;
  try {
    execFileSync('git', ['tag', tagName], { stdio: 'inherit' });
    console.log(`Loodud git tag: ${tagName}`);
  } catch {
    console.warn(`Git tagi ${tagName} loomine ebaõnnestus (võib juba olemas olla).`);
  }
}

console.log(`\nMustand loodud (id: ${created.id}). Ava admin.teris.ee → Uuendused, et üle vaadata ja avaldada.`);
await authDb().$disconnect();
