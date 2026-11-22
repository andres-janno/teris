// src/server/guideDrafts.ts — mustandite laadimise tuum: peatükid (docs/juhend/<nr>-<võti>.html) ja kohtjuhendid
// (docs/juhend/spots/<võti>.html). Tekst kirjutatakse ainult tühja kohta: olemasolevat teksti ei puudutata kunagi
// (kasutaja parandused jäävad). Kohtjuhendi seotud peatükk pannakse ainult tühjale lingile. Hoidla on süstitav (test: mälus).
import { GUIDE_MAX_LENGTH, chapterNumber, isGuideChapterKey, type GuideChapterKey } from '../help/guideChapters.ts';
import { HELP_MAX_LENGTH, HELP_SPOTS, isHelpKey, type HelpKey } from '../help/helpRegistry.ts';
import { isBlankHelp } from './helpArticles.ts';

export interface DraftStore {
  isEmpty(key: string): Promise<boolean>;
  /** Kirjutab ainult tühja kohta (+ `guideLink` kohtjuhendile, kui real pole oma linki) ja teeb versioonirea; tagastab, kas kirjutas */
  writeIfEmpty(key: string, html: string, guideLink?: string | null): Promise<boolean>;
  /** Kas kohtjuhendil on tekst, aga link puudub */
  canSetLink(key: string): Promise<boolean>;
  /** Paneb lingi ainult tekstiga kohale, kus link on tühi; teksti ei muuda; tagastab, kas pani */
  setLinkIfEmpty(key: string, link: string): Promise<boolean>;
}

export type DraftStatus =
  | 'written' | 'would-write' | 'skipped-existing' | 'skipped-blank' | 'invalid-name' | 'number-mismatch' | 'too-long' | 'unknown-spot'
  | 'link-set' | 'would-link' | 'link-kept';

export interface DraftResult {
  file: string;
  key: string | null;
  status: DraftStatus;
}

type DraftFile = { name: string; html: string };
type SpotLinks = Record<string, { guideLink?: string }>;

/** `01-guide.getting-started.html` → peatüki võti; number peab klappima registri järjekorraga */
export function parseDraftName(file: string): { key: GuideChapterKey } | { error: 'invalid-name' | 'number-mismatch' } {
  const m = /^(\d{2})-(guide\.[a-z-]+)\.html$/.exec(file);
  if (!m || !isGuideChapterKey(m[2])) return { error: 'invalid-name' };
  if (Number(m[1]) !== chapterNumber(m[2])) return { error: 'number-mismatch' };
  return { key: m[2] };
}

/** `view.fields.html` → kohtjuhendi võti (peab olema `HELP_SPOTS`-is) */
export function parseSpotDraftName(file: string): { key: HelpKey } | { error: 'unknown-spot' } {
  const m = /^(.+)\.html$/.exec(file);
  return m && isHelpKey(m[1]) ? { key: m[1] } : { error: 'unknown-spot' };
}

export async function loadDrafts(files: DraftFile[], store: DraftStore, dryRun = false): Promise<DraftResult[]> {
  const out: DraftResult[] = [];
  for (const f of files) {
    const parsed = parseDraftName(f.name);
    if ('error' in parsed) {
      out.push({ file: f.name, key: null, status: parsed.error });
      continue;
    }
    const { key } = parsed;
    if (isBlankHelp(f.html)) out.push({ file: f.name, key, status: 'skipped-blank' });
    else if (f.html.length > GUIDE_MAX_LENGTH) out.push({ file: f.name, key, status: 'too-long' });
    else if (dryRun) out.push({ file: f.name, key, status: (await store.isEmpty(key)) ? 'would-write' : 'skipped-existing' });
    else out.push({ file: f.name, key, status: (await store.writeIfEmpty(key, f.html)) ? 'written' : 'skipped-existing' });
  }
  return out;
}

/** Kohtjuhendite tekstid: kirjutab tühja kohta koos registri vaikimisi seotud peatükiga (`guideLink`). */
export async function loadSpotDrafts(files: DraftFile[], store: DraftStore, dryRun = false, spots: SpotLinks = HELP_SPOTS): Promise<DraftResult[]> {
  const out: DraftResult[] = [];
  for (const f of files) {
    const parsed = parseSpotDraftName(f.name);
    if ('error' in parsed) {
      out.push({ file: f.name, key: null, status: parsed.error });
      continue;
    }
    const { key } = parsed;
    if (isBlankHelp(f.html)) out.push({ file: f.name, key, status: 'skipped-blank' });
    else if (f.html.length > HELP_MAX_LENGTH) out.push({ file: f.name, key, status: 'too-long' });
    else if (dryRun) out.push({ file: f.name, key, status: (await store.isEmpty(key)) ? 'would-write' : 'skipped-existing' });
    else out.push({ file: f.name, key, status: (await store.writeIfEmpty(key, f.html, spots[key]?.guideLink ?? null)) ? 'written' : 'skipped-existing' });
  }
  return out;
}

/** Kohtjuhendid, millel on tekst, aga seotud peatükk puudub (nt praegused 4): paneb registri vaikimisi lingi. Teksti ei muuda. */
export async function linkSpots(store: DraftStore, dryRun = false, spots: SpotLinks = HELP_SPOTS): Promise<DraftResult[]> {
  const out: DraftResult[] = [];
  for (const [key, s] of Object.entries(spots)) {
    if (!s.guideLink) continue;
    const set = dryRun ? await store.canSetLink(key) : await store.setLinkIfEmpty(key, s.guideLink);
    out.push({ file: key, key, status: set ? (dryRun ? 'would-link' : 'link-set') : 'link-kept' });
  }
  return out;
}
