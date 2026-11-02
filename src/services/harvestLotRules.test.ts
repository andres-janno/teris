import { describe, expect, it } from 'vitest';
import { computeBunkerTonnes, entryHarvestTonnes, lotCostShares, defaultLotName, lotServicePrice } from './harvestLotRules';

const e = (key: string, bunkers: number | null, manual = false, tonnes = 0) => ({ key, bunkers, manual, tonnes });

describe('computeBunkerTonnes', () => {
  it('(kaalutud − lukustatud tonnid) / lukustamata punkrid', () => {
    expect(computeBunkerTonnes(30, [e('a', 4), e('b', 6), e('c', 2, true, 5)])).toEqual({ ok: true, bunkerTonnes: 2.5 });
  });
  it('lukustamata punkriteta ja negatiivse tulemusega keelatakse', () => {
    expect(computeBunkerTonnes(30, [e('c', 2, true, 5)])).toEqual({ ok: false, error: 'Partiis pole punkritega kandeid, mille tonne arvutada' });
    expect(computeBunkerTonnes(4, [e('a', 4), e('c', null, true, 5)])).toEqual({ ok: false, error: 'Kaalutud kogus on väiksem kui käsitsi sisestatud tonnid' });
  });
});

describe('entryHarvestTonnes', () => {
  it('punkrid × punkri kaal; lahtises partiis või punkriteta 0', () => {
    expect(entryHarvestTonnes(4, 2.5)).toBe(10);
    expect(entryHarvestTonnes(4, null)).toBe(0);
    expect(entryHarvestTonnes(null, 2.5)).toBe(0);
  });
});

describe('lotCostShares', () => {
  it('suletud partii: lukustatud kanne tonnid / punkri kaal, sama võti liidetakse', () => {
    const s = lotCostShares(2.5, [e('f1', 4), e('f2', 6), e('f1', 2, true, 5)]);
    expect(s.get('f1')).toBeCloseTo(0.5, 9); // (4 + 5/2,5) / 12
    expect(s.get('f2')).toBeCloseTo(0.5, 9);
  });
  it('lahtine partii: lukustatud kanne oma punkritega; punkriteta tühi', () => {
    const s = lotCostShares(null, [e('f1', 1), e('f2', 3, true, 9)]);
    expect(s.get('f1')).toBeCloseTo(0.25, 9);
    expect(s.get('f2')).toBeCloseTo(0.75, 9);
    expect(lotCostShares(null, [e('f1', null, true, 5)]).size).toBe(0);
  });
});

describe('defaultLotName ja lotServicePrice', () => {
  it('võetud nime korral number juurde', () => {
    expect(defaultLotName('Talinisu', 2026, [])).toBe('Talinisu 2026');
    expect(defaultLotName('Talinisu', 2026, ['Talinisu 2026', 'Talinisu 2026 2'])).toBe('Talinisu 2026 3');
  });
  it('teenuse hind: artikli hind, puudumisel vaikimisi teenuse hind', () => {
    expect(lotServicePrice(12, 30)).toBe(12);
    expect(lotServicePrice(null, 30)).toBe(30);
    expect(lotServicePrice(null, null)).toBeNull();
  });
});
