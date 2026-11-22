// @vitest-environment jsdom
// sanitizeHelp: h3 ankrud, peatükilingid (#guide.…) ja välislingid. DOMPurify vajab DOM-i, seega jsdom.
import { describe, it, expect } from 'vitest';
import { sanitizeHelp } from './sanitizeHelp';
import { anchorDomId, extractAnchors } from './anchors';

const parse = (html: string) => {
  const box = document.createElement('div');
  box.innerHTML = html;
  return box;
};

describe('sanitizeHelp ankrud', () => {
  it('h3 saab pealkirjast tuletatud id, korduv saab -2', () => {
    const box = parse(sanitizeHelp('<h3>Kuidas importida?</h3><p>x</p><h3>Kuidas importida?</h3><h3>Õun</h3>'));
    expect([...box.querySelectorAll('h3')].map((h) => h.id)).toEqual(['g-kuidas-importida', 'g-kuidas-importida-2', 'g-oun']);
  });

  it('id-d vastavad extractAnchors tulemusele (admin ja vaade viitavad samale kohale)', () => {
    const src = '<h3>Üks <b>pealkiri</b></h3><h3>Hea teada</h3><h3>Üks pealkiri</h3>';
    const ids = [...parse(sanitizeHelp(src)).querySelectorAll('h3')].map((h) => h.id);
    expect(ids).toEqual(extractAnchors(src).map((a) => anchorDomId(a.slug)));
  });

  it('korduv väljakutse alustab loendust otsast', () => {
    sanitizeHelp('<h3>A</h3><h3>A</h3>');
    expect(parse(sanitizeHelp('<h3>A</h3>')).querySelector('h3')!.id).toBe('g-a');
  });

  it('kleebitud id teistel elementidel eemaldatakse, h3 oma id kirjutatakse üle', () => {
    const box = parse(sanitizeHelp('<p id="x">a</p><h3 id="x">Pealkiri</h3>'));
    expect(box.querySelector('p')!.hasAttribute('id')).toBe(false);
    expect(box.querySelector('h3')!.id).toBe('g-pealkiri');
  });
});

describe('sanitizeHelp lingid', () => {
  it('peatükilink säilib ja ei avane uues aknas', () => {
    const a = parse(sanitizeHelp('<a href="#guide.fields#import" target="_blank">Import</a>')).querySelector('a')!;
    expect(a.getAttribute('href')).toBe('#guide.fields#import');
    expect(a.hasAttribute('target')).toBe(false);
    expect(a.hasAttribute('rel')).toBe(false);
  });

  it('ankruta peatükilink ja välislink', () => {
    expect(parse(sanitizeHelp('<a href="#guide.getting-started">x</a>')).querySelector('a')!.getAttribute('href')).toBe('#guide.getting-started');
    const ext = parse(sanitizeHelp('<a href="https://teris.ee">x</a>')).querySelector('a')!;
    expect(ext.getAttribute('target')).toBe('_blank');
    expect(ext.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('ohtlikud lingid ja sildid eemaldatakse', () => {
    const box = parse(sanitizeHelp('<a href="javascript:alert(1)">x</a><script>alert(1)</script><img src="x" onerror="alert(1)">'));
    expect(box.querySelector('a')!.hasAttribute('href')).toBe(false);
    expect(box.querySelector('script')).toBeNull();
    expect(box.querySelector('img')).toBeNull();
  });
});
