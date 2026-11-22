// Mustandite laadimine: ainult tühjadesse kohtadesse (peatükid ja kohtjuhendid), olemasolevat teksti ei puudutata,
// kohtjuhendi seotud peatükk pannakse ainult tühjale lingile, versioonirea autor „mustand“ (versioonirida teeb päris hoidla).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { linkSpots, loadDrafts, loadSpotDrafts, parseDraftName, parseSpotDraftName, type DraftStore } from './guideDrafts';
import { HELP_MAX_LENGTH, HELP_SPOTS } from '../help/helpRegistry';

const blank = (h: string) => h.replace(/<[^>]*>/g, '').trim() === '';

/** Mälus hoidla: sama lepe mis päris hoidlal (writeHelpIfEmpty, setGuideLinkIfEmpty), aga ilma andmebaasita. */
function memoryStore(initial: Record<string, { html: string; link?: string | null }> = {}) {
  const rows = new Map(Object.entries(initial).map(([k, v]) => [k, { html: v.html, link: v.link ?? null }]));
  const writes: { key: string; html: string; link: string | null }[] = [];
  const links: { key: string; link: string }[] = [];
  const store: DraftStore = {
    isEmpty: async (key) => blank(rows.get(key)?.html ?? ''),
    writeIfEmpty: async (key, html, guideLink = null) => {
      const row = rows.get(key);
      if (row && !blank(row.html)) return false;
      const link = row?.link ?? guideLink;
      rows.set(key, { html, link });
      writes.push({ key, html, link });
      return true;
    },
    canSetLink: async (key) => {
      const row = rows.get(key);
      return !!row && !blank(row.html) && !row.link;
    },
    setLinkIfEmpty: async (key, link) => {
      const row = rows.get(key);
      if (!row || blank(row.html) || row.link) return false;
      row.link = link;
      links.push({ key, link });
      return true;
    }
  };
  return { store, rows, writes, links };
}

describe('parseDraftName', () => {
  it('nr-võti.html, number peab klappima registri järjekorraga', () => {
    expect(parseDraftName('01-guide.getting-started.html')).toEqual({ key: 'guide.getting-started' });
    expect(parseDraftName('16-guide.settings.html')).toEqual({ key: 'guide.settings' });
    expect(parseDraftName('02-guide.getting-started.html')).toEqual({ error: 'number-mismatch' });
    expect(parseDraftName('01-guide.nope.html')).toEqual({ error: 'invalid-name' });
    expect(parseDraftName('notes.txt')).toEqual({ error: 'invalid-name' });
    expect(parseDraftName('1-guide.map.html')).toEqual({ error: 'invalid-name' });
  });
});

describe('parseSpotDraftName', () => {
  it('võti.html, võti peab olema registris', () => {
    expect(parseSpotDraftName('view.fields.html')).toEqual({ key: 'view.fields' });
    expect(parseSpotDraftName('fields.register.import-pria-zip.html')).toEqual({ key: 'fields.register.import-pria-zip' });
    expect(parseSpotDraftName('view.nope.html')).toEqual({ error: 'unknown-spot' });
    expect(parseSpotDraftName('view.fields.txt')).toEqual({ error: 'unknown-spot' });
  });
});

describe('loadDrafts (peatükid)', () => {
  const files = [
    { name: '01-guide.getting-started.html', html: '<p>Algus</p>' },
    { name: '02-guide.onboarding.html', html: '<p>Juurutamine</p>' },
    { name: '03-guide.map.html', html: '<p><br></p>' },
    { name: 'README.md', html: 'x' },
    { name: '04-guide.fields.html', html: 'x'.repeat(100001) }
  ];

  it('kirjutab tühjadesse, jätab olemasoleva, tühja faili ja vead vahele', async () => {
    const { store, rows, writes } = memoryStore({ 'guide.onboarding': { html: '<p>Kasutaja parandatud tekst</p>' } });
    const res = await loadDrafts(files, store);
    expect(Object.fromEntries(res.map((r) => [r.file, r.status]))).toEqual({
      '01-guide.getting-started.html': 'written',
      '02-guide.onboarding.html': 'skipped-existing',
      '03-guide.map.html': 'skipped-blank',
      'README.md': 'invalid-name',
      '04-guide.fields.html': 'too-long'
    });
    expect(writes).toEqual([{ key: 'guide.getting-started', html: '<p>Algus</p>', link: null }]);
    expect(rows.get('guide.onboarding')!.html).toBe('<p>Kasutaja parandatud tekst</p>');
  });

  it('teine käivitus ei kirjuta enam midagi (idempotentne); dry-run ei kirjuta', async () => {
    const { store, writes } = memoryStore();
    expect((await loadDrafts(files.slice(0, 2), store, true)).map((r) => r.status)).toEqual(['would-write', 'would-write']);
    expect(writes).toEqual([]);
    await loadDrafts(files.slice(0, 2), store);
    expect((await loadDrafts(files.slice(0, 2), store)).map((r) => r.status)).toEqual(['skipped-existing', 'skipped-existing']);
    expect(writes).toHaveLength(2);
  });
});

describe('loadSpotDrafts ja linkSpots (kohtjuhendid)', () => {
  const spots = {
    'view.fields': { guideLink: 'guide.fields' },
    'view.crops': { guideLink: 'guide.crops' },
    'fields.register.import-pria-zip': { guideLink: 'guide.fields' }
  };
  const files = [
    { name: 'view.fields.html', html: '<p>Põllud</p>' },
    { name: 'view.crops.html', html: '<p>Kultuurid</p>' },
    { name: 'view.nope.html', html: '<p>x</p>' },
    { name: 'view.map.html', html: '<p> </p>' },
    { name: 'view.stock.html', html: 'x'.repeat(HELP_MAX_LENGTH + 1) }
  ];

  it('kirjutab tühja kohtjuhendisse koos vaikimisi lingiga, olemasolevat teksti ja linki ei puuduta', async () => {
    const { store, rows, writes } = memoryStore({ 'view.crops': { html: '<p>Käsitsi parandatud</p>', link: 'guide.crops#sordid' } });
    const res = await loadSpotDrafts(files, store, false, { ...spots, 'view.map': { guideLink: 'guide.map' }, 'view.stock': { guideLink: 'guide.stock' } });
    expect(Object.fromEntries(res.map((r) => [r.file, r.status]))).toEqual({
      'view.fields.html': 'written',
      'view.crops.html': 'skipped-existing',
      'view.nope.html': 'unknown-spot',
      'view.map.html': 'skipped-blank',
      'view.stock.html': 'too-long'
    });
    expect(writes).toEqual([{ key: 'view.fields', html: '<p>Põllud</p>', link: 'guide.fields' }]);
    expect(rows.get('view.crops')).toEqual({ html: '<p>Käsitsi parandatud</p>', link: 'guide.crops#sordid' });
  });

  it('linkSpots paneb lingi ainult olemasolevale tekstile ja tühjale lingile; teksti ei muuda', async () => {
    const { store, rows, links } = memoryStore({
      'fields.register.import-pria-zip': { html: '<p>Vana tekst</p>' }, // tekst olemas, link puudub → pannakse
      'view.crops': { html: '<p>x</p>', link: 'guide.crops#sordid' }, // link olemas → jääb
      'view.fields': { html: '<p><br></p>' } // tühi tekst → ei panda
    });
    const res = await linkSpots(store, false, spots);
    expect(Object.fromEntries(res.map((r) => [r.key, r.status]))).toEqual({
      'view.fields': 'link-kept',
      'view.crops': 'link-kept',
      'fields.register.import-pria-zip': 'link-set'
    });
    expect(links).toEqual([{ key: 'fields.register.import-pria-zip', link: 'guide.fields' }]);
    expect(rows.get('fields.register.import-pria-zip')).toEqual({ html: '<p>Vana tekst</p>', link: 'guide.fields' });
    expect(rows.get('view.crops')!.link).toBe('guide.crops#sordid');
  });

  it('dry-run ei kirjuta ei teksti ega linki', async () => {
    const { store, writes, links } = memoryStore({ 'fields.register.import-pria-zip': { html: '<p>Vana</p>' } });
    const a = await loadSpotDrafts(files.slice(0, 1), store, true, spots);
    const b = await linkSpots(store, true, spots);
    expect(a.map((r) => r.status)).toEqual(['would-write']);
    expect(b.find((r) => r.key === 'fields.register.import-pria-zip')!.status).toBe('would-link');
    expect(writes).toEqual([]);
    expect(links).toEqual([]);
  });
});

describe('docs/juhend/spots mustandid', () => {
  const dir = join(process.cwd(), 'docs/juhend/spots');
  const names = readdirSync(dir).filter((n) => n.endsWith('.html')).sort();
  const viewKeys = Object.keys(HELP_SPOTS).filter((k) => k.startsWith('view.'));

  it('igal view.* kohtjuhendil on mustandifail ja ainult tuntud võtmed', () => {
    expect(names).toEqual(expect.arrayContaining(viewKeys.map((k) => `${k}.html`)));
    for (const n of names) expect('error' in parseSpotDraftName(n), n).toBe(false);
  });

  it('iga mustand on 1–2 lauset ühes lõigus ja ilma pealkirjade/loenditeta', () => {
    for (const n of names) {
      const html = readFileSync(join(dir, n), 'utf8').trim();
      const text = html.replace(/<[^>]*>/g, '').trim();
      expect(blank(html), n).toBe(false);
      expect(html.length, n).toBeLessThan(500);
      expect(html.match(/<p>/g)?.length, n).toBe(1);
      expect(html, n).not.toMatch(/<(h\d|ul|ol|li|a|br|img)\b/i);
      const sentences = text.match(/[.!?](?=\s|$)/g)?.length ?? 0;
      expect(sentences, n).toBeGreaterThanOrEqual(1);
      expect(sentences, n).toBeLessThanOrEqual(2);
    }
  });

  it('laadimine päris failidega kirjutab iga view.* tühjale kohale koos peatükilingiga', async () => {
    const { store, writes } = memoryStore();
    const files = names.map((name) => ({ name, html: readFileSync(join(dir, name), 'utf8') }));
    const res = await loadSpotDrafts(files, store);
    expect(res.every((r) => r.status === 'written')).toBe(true);
    for (const w of writes) expect(w.link).toBe((HELP_SPOTS as Record<string, { guideLink: string }>)[w.key].guideLink);
  });
});
