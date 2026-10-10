import { describe, it, expect } from 'vitest';
import { ndviFromColor, isCloudPixel, pointInRings, summarizeNdvi } from './ndvi';

describe('ndviFromColor', () => {
  it('pöörab Satiladu NDVI skaala värvid väärtusteks', () => {
    expect(ndviFromColor(0, 5, 50)).toBeCloseTo(0, 2);
    expect(ndviFromColor(170, 0, 44)).toBeCloseTo(0.1, 2);
    expect(ndviFromColor(255, 238, 169)).toBeCloseTo(0.5, 2);
    expect(ndviFromColor(1, 105, 61)).toBeCloseTo(0.9, 2);
    // Legendipildi vahepealsed värvid
    expect(ndviFromColor(224, 150, 122)).toBeGreaterThan(0.3);
    expect(ndviFromColor(224, 150, 122)).toBeLessThan(0.4);
  });

  it('vesi (sinine skaala) on 0, võõras värv null', () => {
    expect(ndviFromColor(0, 30, 80)).toBe(0);
    expect(ndviFromColor(0, 0, 255)).toBeNull();
  });
});

describe('isCloudPixel', () => {
  it('hele hall on pilv, roheline ja muld mitte', () => {
    expect(isCloudPixel(230, 232, 235)).toBe(true);
    expect(isCloudPixel(80, 140, 60)).toBe(false);
    expect(isCloudPixel(200, 170, 130)).toBe(false);
    expect(isCloudPixel(225, 205, 180)).toBe(false); // hele kuiv muld
  });
});

describe('pointInRings', () => {
  const outer: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const hole: [number, number][] = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
  it('arvestab auke', () => {
    expect(pointInRings(1, 1, [outer, hole])).toBe(true);
    expect(pointInRings(5, 5, [outer, hole])).toBe(false);
    expect(pointInRings(11, 5, [outer, hole])).toBe(false);
  });
});

describe('summarizeNdvi', () => {
  it('keskmine, klassid ja kaetus', () => {
    const s = summarizeNdvi([0.1, 0.3, 0.7, 0.8], 5, 1)!;
    expect(s.mean).toBeCloseTo(0.475);
    expect(s.classShares).toEqual([0.25, 0.25, 0.5]);
    expect(s.coverage).toBeCloseTo(0.8);
    expect(s.cloudShare).toBeCloseTo(0.2);
  });
  it('andmeteta null', () => {
    expect(summarizeNdvi([], 10, 10)).toBeNull();
  });
});
