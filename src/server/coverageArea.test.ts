import { describe, it, expect } from 'vitest';
import type { Polygon } from 'geojson';
import { coverageAreaHa } from './coverageArea';

const LAT0 = 58.12;
const LNG0 = 25.9;
const M_LAT = 1 / 110_540;
const M_LNG = 1 / (111_320 * Math.cos((LAT0 * Math.PI) / 180));
const at = (xM: number, yM: number) => ({ lat: LAT0 + yM * M_LAT, lng: LNG0 + xM * M_LNG });

// Ruut x ∈ [0, sizeM], y ∈ [0, sizeM] meetrites
const square = (sizeM: number): Polygon => {
  const c = [at(0, 0), at(sizeM, 0), at(sizeM, sizeM), at(0, sizeM), at(0, 0)];
  return { type: 'Polygon', coordinates: [c.map((p) => [p.lng, p.lat])] };
};

describe('coverageAreaHa', () => {
  it('sirge 100 m lõik 6 m laiusega ≈ 0.06 ha', () => {
    const pts = Array.from({ length: 11 }, (_, i) => at(50 + i * 10, 100));
    // 100 × 6 + otsapoolringid π·3² ≈ 628 m²
    expect(coverageAreaHa(pts, square(300), 6)).toBeCloseTo(0.063, 2);
  });

  it('arvestab ainult põllu sisse jäävat osa', () => {
    const pts = Array.from({ length: 21 }, (_, i) => at(-100 + i * 10, 50));
    // põld x ∈ [0, 100]: põllule jääb 100 × 6 m
    expect(coverageAreaHa(pts, square(100), 6)).toBeCloseTo(0.06, 2);
  });

  it('sama raja korduv läbimine ei loe pinda topelt', () => {
    const there = Array.from({ length: 11 }, (_, i) => at(50 + i * 10, 100));
    const once = coverageAreaHa(there, square(300), 6);
    const twice = coverageAreaHa([...there, ...[...there].reverse(), ...there], square(300), 6);
    expect(twice).toBe(once);
  });

  it('15 000 punktiga edasi-tagasi sõit arvutub kiiresti', () => {
    // 5,5 m vahega rajad 400 m põllul, punkt iga 1 m järel
    const pts: { lat: number; lng: number }[] = [];
    for (let lane = 0; pts.length < 15_000; lane++) {
      const y = 10 + lane * 5.5;
      for (let x = 0; x <= 380; x++) pts.push(at(lane % 2 ? 390 - x : 10 + x, y));
    }
    const t = Date.now();
    const ha = coverageAreaHa(pts, square(400), 5.5);
    expect(Date.now() - t).toBeLessThan(3000);
    expect(ha).toBeGreaterThan(8);
  });
});
