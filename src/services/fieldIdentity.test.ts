// src/services/fieldIdentity.test.ts — põllu identiteet: massiiv + kuju kattuvus, numbri kirjapilt.
import { describe, it, expect } from 'vitest';
import { overlapRatio, linkSeasons, matchImportedFields, normalizeFieldNum } from './fieldIdentity';

// Ristkülik (lon0, lat0) – (lon0 + w, lat0 + h) kraadides
const rect = (lon0: number, lat0: number, w: number, h: number) => ({
  type: 'Polygon',
  coordinates: [[[lon0, lat0], [lon0 + w, lat0], [lon0 + w, lat0 + h], [lon0, lat0 + h], [lon0, lat0]]]
});
const big = rect(25, 58, 0.01, 0.01);
const left60 = rect(25, 58, 0.006, 0.01);  // 60% suurest
const right40 = rect(25.006, 58, 0.004, 0.01); // 40% suurest

describe('fieldIdentity', () => {
  it('kattuvus suurema kuju suhtes', () => {
    expect(overlapRatio(big, big)).toBeCloseTo(1, 3);
    expect(overlapRatio(big, left60)).toBeCloseTo(0.6, 2);
    expect(overlapRatio(right40, big)).toBeCloseTo(0.4, 2);
    expect(overlapRatio(big, rect(26, 58, 0.01, 0.01))).toBe(0);
    expect(overlapRatio(null, big)).toBe(0);
  });

  it('numbri kirjapilt ei loe', () => {
    expect(normalizeFieldNum('2,VARISOO SP')).toBe(normalizeFieldNum('2 Varisoo SP'));
    expect(normalizeFieldNum('2-VARISOO SP')).toBe('2varisoosp');
    expect(normalizeFieldNum('2-Varisoo SP-1')).not.toBe(normalizeFieldNum('2 Varisoo SP'));
  });

  it('jagamisel jätkab suurem tükk, väike tükk ei seo', () => {
    const shapes = [
      { fieldId: 1, year: 2024, geometry: big },
      { fieldId: 2, year: 2025, geometry: right40 },
      { fieldId: 3, year: 2025, geometry: left60 }
    ];
    const links = linkSeasons(shapes);
    expect(links.map((l) => [l.from.fieldId, l.to.fieldId])).toEqual([[1, 3]]);
  });

  it('import: sama massiiv ja kattuv kuju, number ja operaator ei loe; iga põld üks kord', () => {
    const fields = [
      { id: 10, fieldCode: '100', history: [{ year: 2024, geometry: big }] },
      { id: 11, fieldCode: '200', history: [{ year: 2024, geometry: big }] }
    ];
    const m = matchImportedFields(fields, [
      { fieldCode: '100', geometry: left60 },
      { fieldCode: '100', geometry: big },
      { fieldCode: '100', geometry: right40 }
    ], 2025);
    expect(m.map((x) => x?.id)).toEqual([10, undefined, undefined]);
  });

  it('import: sama aasta olemasolev hooaeg sobib ainult kattuva kujuga (kordusimport)', () => {
    const fields = [{ id: 10, fieldCode: '100', history: [{ year: 2025, geometry: left60 }, { year: 2024, geometry: big }] }];
    expect(matchImportedFields(fields, [{ fieldCode: '100', geometry: left60 }], 2025)[0]?.id).toBe(10);
    expect(matchImportedFields(fields, [{ fieldCode: '100', geometry: right40 }], 2025)[0]).toBeUndefined();
  });
});
