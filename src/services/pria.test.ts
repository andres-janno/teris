import { describe, expect, it } from 'vitest';
import {
  PRIA_ACTIVITIES, LEGACY_WORK_TYPE_MAP, materialCategoryFor, baseUnit, totalFromRate, rateFromTotal, nameKey, daysApart
} from './pria';

describe('PRIA_ACTIVITIES', () => {
  it('sisaldab kõiki 29 tegevust unikaalsete nimedega', () => {
    expect(PRIA_ACTIVITIES).toHaveLength(29);
    expect(new Set(PRIA_ACTIVITIES.map((a) => a.name)).size).toBe(29);
  });
  it('vanad töötüübid viitavad olemasolevatele PRIA tegevustele', () => {
    const names = new Set(PRIA_ACTIVITIES.map((a) => a.name));
    for (const target of Object.values(LEGACY_WORK_TYPE_MAP)) expect(names.has(target)).toBe(true);
    expect(LEGACY_WORK_TYPE_MAP['Kõrrekoorimine']).toBe('Randaalimine');
    expect(LEGACY_WORK_TYPE_MAP['Leheväetamine']).toBe('Väetamine');
    expect(LEGACY_WORK_TYPE_MAP['Umbrohutõrje (enne külvi)']).toBe('Taimekaitsevahendi kasutamine');
  });
});

describe('materialCategoryFor', () => {
  it('kategooria tegevuse järgi', () => {
    expect(materialCategoryFor('Külvamine/istutamine')).toBe('SEED');
    expect(materialCategoryFor('Väetamine')).toBe('FERTILIZER');
    expect(materialCategoryFor('Lupjamine')).toBe('FERTILIZER');
    expect(materialCategoryFor('Taimekaitsevahendi kasutamine', 'Märgaja/kleepaine')).toBe('PLANT_PROTECTION');
    expect(materialCategoryFor('Kündmine')).toBe('OTHER');
  });
});

describe('ühikud ja kogused', () => {
  it('baseUnit eemaldab /ha', () => {
    expect(baseUnit('kg/ha')).toBe('kg');
    expect(baseUnit('l/ha')).toBe('l');
    expect(baseUnit('taime/m2')).toBe('taime/m2');
    expect(baseUnit(null)).toBe('');
  });
  it('kogus ha ↔ kokku kahe komakohaga', () => {
    expect(totalFromRate(250, 2.42)).toBe(605);
    expect(totalFromRate(0.15, 2.42)).toBe(0.36);
    expect(rateFromTotal(605, 2.42)).toBe(250);
    expect(totalFromRate(null, 2.42)).toBeNull();
    expect(rateFromTotal(10, 0)).toBeNull();
  });
});

describe('nameKey', () => {
  it('tõstutundetu ja tühikud normaliseeritud', () => {
    expect(nameKey('  Tombo   WG ')).toBe('tombo wg');
    expect(nameKey(null)).toBe('');
  });
});

describe('daysApart', () => {
  it('lõikuvad vahemikud → 0', () => {
    expect(daysApart({ from: '2026-04-27', to: '2026-04-30' }, { from: '2026-04-28', to: null })).toBe(0);
  });
  it('päevade vahe lähimate otste vahel', () => {
    expect(daysApart({ from: '2026-04-27', to: '2026-04-30' }, { from: '2026-05-02', to: null })).toBe(2);
    expect(daysApart({ from: '2026-05-10', to: null }, { from: '2026-05-01', to: '2026-05-07' })).toBe(3);
  });
});
