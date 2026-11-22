// h3 ankrud: pealkirjast tuletatud lühinimi (eesti tähed), korduvad pealkirjad, ankrute nimekiri HTML-ist.
import { describe, it, expect } from 'vitest';
import { anchorDomId, extractAnchors, nextSlug, slugify, textOfHtml } from './anchors';

describe('slugify', () => {
  it('eesti tähed ja kirjavahemärgid', () => {
    expect(slugify('Kuidas importida PRIA ZIP-i?')).toBe('kuidas-importida-pria-zip-i');
    expect(slugify('Õun ja päike')).toBe('oun-ja-paike');
    expect(slugify('Šokolaad ja žürii')).toBe('sokolaad-ja-zurii');
    expect(slugify('  Hea teada  ')).toBe('hea-teada');
  });

  it('tühi või ainult märgid → jaotis', () => {
    expect(slugify('')).toBe('jaotis');
    expect(slugify('???')).toBe('jaotis');
  });
});

describe('nextSlug ja extractAnchors', () => {
  it('korduvad pealkirjad saavad -2, -3', () => {
    const seen = new Map<string, number>();
    expect([nextSlug(seen, 'Import'), nextSlug(seen, 'Import'), nextSlug(seen, 'Import'), nextSlug(seen, 'Muu')]).toEqual(['import', 'import-2', 'import-3', 'muu']);
  });

  it('slugid on kordumatud ka juhul Import, Import, Import 2', () => {
    const seen = new Map<string, number>();
    const out = ['Import', 'Import', 'Import 2', 'Import'].map((t) => nextSlug(seen, t));
    expect(out).toEqual(['import', 'import-2', 'import-2-2', 'import-3']);
    expect(new Set(out).size).toBe(out.length);
  });

  it('ankur on kuni 80 märki ka järelliitega', () => {
    const seen = new Map<string, number>();
    const long = 'a'.repeat(200);
    const out = [nextSlug(seen, long), nextSlug(seen, long)];
    expect(out.every((s) => s.length <= 80)).toBe(true);
    expect(out[0]).not.toBe(out[1]);
  });

  it('extractAnchors võtab ainult h3, tekst ilma siltide ja olemitega', () => {
    const html = '<p>x</p><h3>Kuidas <strong>importida</strong>?</h3><h4>Alam</h4><h3 class="a">Hea&nbsp;teada &amp; nipid</h3><h3>Kuidas importida?</h3>';
    expect(extractAnchors(html)).toEqual([
      { slug: 'kuidas-importida', text: 'Kuidas importida?' },
      { slug: 'hea-teada-nipid', text: 'Hea teada & nipid' },
      { slug: 'kuidas-importida-2', text: 'Kuidas importida?' }
    ]);
    expect(extractAnchors('<p>pole pealkirju</p>')).toEqual([]);
  });

  it('DOM-i id on g-eesliitega', () => {
    expect(anchorDomId('import')).toBe('g-import');
  });

  it('textOfHtml normaliseerib tühikud', () => {
    expect(textOfHtml('<p>a  <b>b</b>\n c&nbsp;d</p>')).toBe('a b c d');
  });
});
