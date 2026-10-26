// Uue hooaja kirje kopeerimine eelmisest aastast (puhas loogika, andmebaasita).
import { describe, it, expect } from 'vitest';
import { latestEarlierSeason, buildCopiedSeason, buildCopiedParcelLink, type SeasonSource } from './fieldSeasonCopy';

const src: SeasonSource = {
  year: 2025,
  areaHa: 12.5,
  eligibleAreaHa: 12.1,
  crop: 'Talinisu',
  cropVariety: 'Skagen',
  cropColor: '#eab308',
  cropId: 'c1',
  varietyId: 'v1',
  targetYieldTonsHa: 7,
  geometry: { type: 'Polygon', coordinates: [] },
  boundaryPointsCount: 40,
  perimeterM: 1500
};

describe('latestEarlierSeason', () => {
  it('valib viimase aasta enne sihtaastat', () => {
    const recs = [{ year: 2023 }, { year: 2025 }, { year: 2027 }, { year: 2024 }];
    expect(latestEarlierSeason(recs, 2026)?.year).toBe(2025);
  });
  it('varasema aasta puudumisel null', () => {
    expect(latestEarlierSeason([{ year: 2027 }], 2026)).toBeNull();
    expect(latestEarlierSeason([], 2026)).toBeNull();
  });
});

describe('buildCopiedSeason', () => {
  it('kopeerib pindala, kultuuri ja piirid; tööd nullist', () => {
    const rec = buildCopiedSeason(src, 7, 2026, 3);
    expect(rec).toMatchObject({
      fieldId: 7,
      seasonId: 3,
      year: 2026,
      areaHa: 12.5,
      eligibleAreaHa: 12.1,
      crop: 'Talinisu',
      cropVariety: 'Skagen',
      cropId: 'c1',
      varietyId: 'v1',
      targetYieldTonsHa: 7,
      boundaryPointsCount: 40,
      perimeterM: 1500,
      status: 'NOT_STARTED',
      workedAreaHa: 0,
      workProgress: 0
    });
    expect(rec.geometry).toBe(src.geometry);
    expect(rec).not.toHaveProperty('actualYieldTonsHa');
    expect(rec).not.toHaveProperty('seedingDate');
  });
});

describe('buildCopiedParcelLink', () => {
  it('sama katastriüksus ja omandiandmed uuele kirjele', () => {
    const link = buildCopiedParcelLink(
      { cadastralParcelId: 5, fieldAreaHa: 3.2, ownershipType: 'RENTED', ownerName: 'X', ownerPartyId: 'p1', landTaxEurHa: 1, landTaxEurYear: 3.2, rentFeeEurHa: 80, rentFeeEurYear: 256, notes: null },
      99
    );
    expect(link).toEqual({ fieldSeasonId: 99, cadastralParcelId: 5, fieldAreaHa: 3.2, ownershipType: 'RENTED', ownerName: 'X', ownerPartyId: 'p1', landTaxEurHa: 1, landTaxEurYear: 3.2, rentFeeEurHa: 80, rentFeeEurYear: 256, notes: null });
  });
});
