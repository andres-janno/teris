// Juhendiregistri väikesed reeglid: pikkuse piir võtme kohta.
import { describe, it, expect } from 'vitest';
import { HELP_MAX_LENGTH, HELP_SPOTS, helpMaxLength } from './helpRegistry';
import { isValidGuideLink, parseGuideRef } from './guideLink';

describe('helpMaxLength', () => {
  it('peatükk on suurem kui kohtjuhend', () => {
    expect(helpMaxLength('guide.fields')).toBe(100000);
    expect(helpMaxLength('fields.register.export-csv')).toBe(HELP_MAX_LENGTH);
    expect(helpMaxLength('tundmatu')).toBe(HELP_MAX_LENGTH);
  });
});

describe('view.* kohtjuhendid', () => {
  // Peamenüü vaated (Header MAIN_VIEWS): igaühel on pealkirja kõrvale „?“-koht
  const VIEWS = ['map', 'fields', 'crops', 'rotation', 'works', 'stock', 'fleet', 'infrastructure', 'parties', 'weather', 'seasons'];

  it('iga vaate kohta üks kirje alal „Vaated“', () => {
    const keys = Object.keys(HELP_SPOTS).filter((k) => k.startsWith('view.'));
    expect(keys.sort()).toEqual(VIEWS.map((v) => `view.${v}`).sort());
    for (const k of keys) expect(HELP_SPOTS[k as keyof typeof HELP_SPOTS].area).toBe('Vaated');
  });

  it('olemasolevad 4 kohta jäävad', () => {
    expect(Object.keys(HELP_SPOTS).filter((k) => k.startsWith('fields.register.'))).toHaveLength(4);
  });
});

describe('kohtjuhendite vaikimisi seotud peatükk (guideLink)', () => {
  const spots = HELP_SPOTS as Record<string, { guideLink?: string }>;

  it('igal kohal on kehtiv peatükiviide (ilma #-ta, ilma ankruta)', () => {
    for (const [key, s] of Object.entries(spots)) {
      expect(s.guideLink, key).toBeDefined();
      expect(isValidGuideLink(s.guideLink!), key).toBe(true);
      expect(parseGuideRef(s.guideLink!)!.anchor, key).toBeNull();
    }
  });

  it('view.<vaade> viitab peatükile guide.<vaade>; olemasolevad 4 Külvikorda ja Põldudesse', () => {
    for (const k of Object.keys(spots).filter((k) => k.startsWith('view.'))) expect(spots[k].guideLink).toBe(`guide.${k.slice('view.'.length)}`);
    expect(spots['fields.register.export-csv'].guideLink).toBe('guide.rotation');
    for (const k of ['import-soil-samples', 'import-field-book', 'import-pria-zip']) expect(spots[`fields.register.${k}`].guideLink).toBe('guide.fields');
  });
});
