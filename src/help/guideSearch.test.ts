// Otsing üle peatükkide: lõigu katkend, lähim eelnev h3 ankur, kõik sõnad peavad esinema.
import { describe, it, expect } from 'vitest';
import { searchGuide, type SearchChapter } from './guideSearch';
import { extractAnchors } from './anchors';

const fields: SearchChapter = {
  key: 'guide.fields',
  title: 'Põllud',
  html: '<p>Põldude register näitab kõiki põlde.</p><h3>Kuidas importida PRIA ZIP-i?</h3><ol><li>Ava Põllud ja vali <strong>Impordi PRIA ZIP</strong>.</li><li>Kontrolli eelvaadet.</li></ol><h3>Hea teada</h3><p>Import ei kustuta olemasolevaid põlde.</p>'
};
const crops: SearchChapter = { key: 'guide.crops', title: 'Kultuurid', html: '<p>Kultuuride register. PRIA nimetus tuletatakse automaatselt.</p>' };

describe('searchGuide', () => {
  it('leiab lõigu, annab peatüki, ankru ja katkendi', () => {
    const hits = searchGuide([fields, crops], 'pria zip');
    expect(hits).toHaveLength(2); // h3 pealkiri ja loendipunkt
    const li = hits.find((h) => h.anchorText === 'Kuidas importida PRIA ZIP-i?' && h.before.includes('Ava'))!;
    expect(li.chapter).toBe('guide.fields');
    expect(li.chapterTitle).toBe('Põllud');
    expect(li.anchor).toBe(extractAnchors(fields.html)[0].slug);
    expect(li.match.toLowerCase()).toBe('pria');
  });

  it('kõik sõnad peavad samas lõigus olema (AND), tõstutundetu', () => {
    expect(searchGuide([fields, crops], 'PRIA nimetus').map((h) => h.chapter)).toEqual(['guide.crops']);
    expect(searchGuide([fields, crops], 'pria olemasolevaid')).toEqual([]);
  });

  it('ankruta lõik (enne esimest h3) saab anchor null', () => {
    const hit = searchGuide([fields], 'register')[0];
    expect(hit.anchor).toBeNull();
    expect(hit.anchorText).toBeNull();
  });

  it('tühi päring ja piir', () => {
    expect(searchGuide([fields], '   ')).toEqual([]);
    const many: SearchChapter = { key: 'guide.map', title: 'Kaart', html: Array.from({ length: 40 }, () => '<p>kiht</p>').join('') };
    expect(searchGuide([many], 'kiht')).toHaveLength(30);
    expect(searchGuide([many], 'kiht', 5)).toHaveLength(5);
  });

  it('pikk lõik lõigatakse katkendiks (…)', () => {
    const long: SearchChapter = { key: 'guide.map', title: 'Kaart', html: `<p>${'a '.repeat(80)}märksõna${' b'.repeat(80)}</p>` };
    const hit = searchGuide([long], 'märksõna')[0];
    expect(hit.before.startsWith('…')).toBe(true);
    expect(hit.after.endsWith('…')).toBe(true);
    expect(hit.before.length + hit.match.length + hit.after.length).toBeLessThan(180);
  });
});
