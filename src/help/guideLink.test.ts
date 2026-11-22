// Peatükiviide: parsimine (sügavlink ja HTML-link), vormindamine, kohtjuhendi guide_link kontroll.
import { describe, it, expect } from 'vitest';
import { GUIDE_ANCHOR_MAX, GUIDE_LINK_MAX, formatGuideRef, guideHash, isValidGuideLink, markModuleLinks, parseGuideRef } from './guideLink';

describe('parseGuideRef', () => {
  it('peatükk ankruga, hash-iga ja ilma', () => {
    expect(parseGuideRef('#guide.fields#import')).toEqual({ chapter: 'guide.fields', anchor: 'import' });
    expect(parseGuideRef('guide.fields#import')).toEqual({ chapter: 'guide.fields', anchor: 'import' });
    expect(parseGuideRef('#guide.getting-started')).toEqual({ chapter: 'guide.getting-started', anchor: null });
  });

  it('ainult #guide avab juhendi esimese peatükiga', () => {
    expect(parseGuideRef('#guide')).toEqual({ chapter: null, anchor: null });
    expect(parseGuideRef('guide')).toEqual({ chapter: null, anchor: null });
  });

  it('vigased viited annavad null', () => {
    for (const bad of ['', '#', '#guide.', '#guide.nope', '#guide.fields#', '#guide.fields#Import', '#guide#import', '#other.fields', '#guide.fields#a b', 'https://x']) {
      expect(parseGuideRef(bad), bad).toBeNull();
    }
  });
});

describe('formatGuideRef ja isValidGuideLink', () => {
  it('vormindab ilma hash-ita', () => {
    expect(formatGuideRef('guide.fields', 'import')).toBe('guide.fields#import');
    expect(formatGuideRef('guide.fields')).toBe('guide.fields');
    expect(formatGuideRef('guide.fields', null)).toBe('guide.fields');
  });

  it('kohtjuhendi link peab osutama peatükile ega alga #-ga', () => {
    expect(isValidGuideLink('guide.rotation#csv-eksport')).toBe(true);
    expect(isValidGuideLink('guide.rotation')).toBe(true);
    expect(isValidGuideLink('#guide.rotation')).toBe(false);
    expect(isValidGuideLink('guide')).toBe(false);
    expect(isValidGuideLink('guide.nope')).toBe(false);
    expect(isValidGuideLink('')).toBe(false);
  });

  it('liiga pikk ankur või link lükatakse tagasi', () => {
    const ok = 'a'.repeat(GUIDE_ANCHOR_MAX);
    expect(parseGuideRef(`#guide.fields#${ok}`)?.anchor).toBe(ok);
    expect(parseGuideRef(`#guide.fields#${ok}a`)).toBeNull();
    expect(isValidGuideLink(`guide.fields#${ok}a`)).toBe(false);
    expect(isValidGuideLink(`guide.fields#${'a'.repeat(GUIDE_LINK_MAX)}`)).toBe(false);
  });
});

describe('guideHash', () => {
  it('hash sügavlingi jaoks', () => {
    expect(guideHash({ chapter: null, anchor: null })).toBe('#guide');
    expect(guideHash({ chapter: 'guide.fields', anchor: null })).toBe('#guide.fields');
    expect(guideHash({ chapter: 'guide.fields', anchor: 'import' })).toBe('#guide.fields#import');
    // tagasi parsitav
    expect(parseGuideRef(guideHash({ chapter: 'guide.map', anchor: 'kihid' }))).toEqual({ chapter: 'guide.map', anchor: 'kihid' });
  });
});

describe('markModuleLinks', () => {
  const html = '<p>Vaata <a href="#guide.weather#aastad">ilmaandmeid</a> ja <a href="#guide.fields">põlde</a> ning <a href="https://x.ee">välist</a>.</p>';
  const missing = (key: string) => (key === 'guide.weather' ? 'Ilm' : null);

  it('moodulita peatüki link muutub märkega tekstiks, teised jäävad', () => {
    expect(markModuleLinks(html, missing)).toBe(
      '<p>Vaata <span>ilmaandmeid (vajab moodulit „Ilm“)</span> ja <a href="#guide.fields">põlde</a> ning <a href="https://x.ee">välist</a>.</p>'
    );
  });

  it('kui kõik moodulid on olemas, HTML ei muutu', () => {
    expect(markModuleLinks(html, () => null)).toBe(html);
  });
});
