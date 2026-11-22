// @vitest-environment jsdom
// Mustandid (docs/juhend) läbivad sanitizeHelp-i muutmata: ühtegi elementi, linki ega teksti ei kao, kõik #guide-lingid kehtivad.
// Nii on mustandid enne laadimist kontrollitud (kuvamisel puhastatakse nagunii uuesti).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeHelp } from './sanitizeHelp';
import { isValidGuideLink } from './guideLink';

const root = join(process.cwd(), 'docs/juhend');
const files = [
  ...readdirSync(root).filter((n) => n.endsWith('.html')).map((n) => join(root, n)),
  ...readdirSync(join(root, 'spots')).filter((n) => n.endsWith('.html')).map((n) => join(root, 'spots', n))
];

const parse = (html: string) => {
  const box = document.createElement('div');
  box.innerHTML = html;
  return box;
};
const tags = (box: HTMLElement) => [...box.querySelectorAll('*')].map((e) => e.tagName);
const hrefs = (box: HTMLElement) => [...box.querySelectorAll('a')].map((a) => a.getAttribute('href'));
const text = (box: HTMLElement) => (box.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('mustandid ja sanitizeHelp', () => {
  it('mustandifaile leidub', () => {
    expect(files.length).toBeGreaterThanOrEqual(14);
  });

  for (const f of files) {
    it(`${f.slice(root.length + 1)}: puhastus ei eemalda midagi`, () => {
      const src = readFileSync(f, 'utf8');
      const a = parse(src);
      const b = parse(sanitizeHelp(src));
      expect(tags(b)).toEqual(tags(a));
      expect(hrefs(b)).toEqual(hrefs(a));
      expect(text(b)).toBe(text(a));
      for (const h of hrefs(a)) if (h?.startsWith('#')) expect(isValidGuideLink(h.slice(1)), h).toBe(true);
    });
  }
});
