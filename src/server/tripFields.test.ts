// src/server/tripFields.test.ts — sõidu põllud (puhas arvutus).
import { describe, it, expect } from 'vitest';
import type { Polygon } from 'geojson';
import { computeTripFields, tripAreaHa, type ImplementAt, type TripFieldCalc } from './tripFields';
import { coverageAreaHa } from './coverageArea';
import type { TripSample } from './tripSegments';
import type { Place } from './tripRoute';

const LAT0 = 58.12;
const LNG0 = 25.9;
const M_LAT = 1 / 110_574;
const M_LNG = 1 / (111_320 * Math.cos((LAT0 * Math.PI) / 180));
const at = (xM: number, yM: number) => ({ lat: LAT0 + yM * M_LAT, lng: LNG0 + xM * M_LNG });
// Ruut x ∈ [x0, x0+size], y ∈ [0, size] meetrites
const square = (x0: number, size: number): Polygon => {
  const c = [at(x0, 0), at(x0 + size, 0), at(x0 + size, size), at(x0, size), at(x0, 0)];
  return { type: 'Polygon', coordinates: [c.map((p) => [p.lng, p.lat])] };
};

const T0 = new Date('2026-10-21T05:00:00Z').getTime();
const min = (m: number) => new Date(T0 + m * 60_000);
const s = (m: number, xM: number, yM: number, o: Partial<TripSample> = {}): TripSample => ({
  time: min(m), ...at(xM, yM), ignition: true, speedKmh: 8,
  fuelUsedL: null, fuelRateLph: null, fuelLevelPct: null, engineHours: null, ...o
});
const range = (a: number, b: number, f: (m: number) => TripSample) => Array.from({ length: b - a + 1 }, (_, i) => f(a + i));

const A: Place = { id: '101', kind: 'FIELD', label: 'A', geometry: square(0, 200) };
const B: Place = { id: '102', kind: 'FIELD', label: 'B', geometry: square(400, 200) };
const POI: Place = { id: 'poi-1', kind: 'POI', label: 'Töökoda', lat: at(300, 100).lat, lng: at(300, 100).lng, radiusM: 30 };
const NO_IMPL: ImplementAt = () => ({ implementId: null, widthM: null });
const IMPL6: ImplementAt = () => ({ implementId: 'imp-6', widthM: 6 });
// A-l liikumine mööda y = 100 (x = 10 + 10 m minutis; m ≤ 18 jääb põllule)
const onA = (m: number, o: Partial<TripSample> = {}) => s(m, 10 + 10 * m, 100, o);
const calc = (samples: TripSample[], fuel: number | null = null, impl: ImplementAt = NO_IMPL): TripFieldCalc[] =>
  computeTripFields(samples, [A, B, POI], fuel, impl);

describe('computeTripFields', () => {
  it('põllu punktid: saabumine, lahkumine; väljas käimine katkestab aja', () => {
    const pts = [
      ...range(0, 10, (m) => onA(m)),
      ...range(11, 14, (m) => s(m, 300, 100)), // A ja B vahel
      ...range(15, 20, (m) => s(m, 150, 20 + 10 * (m - 15)))
    ];
    const f = calc(pts);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ fieldSeasonId: 101, arriveAt: min(0), leaveAt: min(20), activeMinutes: 15 });
  });

  it('paus (süüde väljas) ja üle 5 min vahe ei lähe põllul oldud aja sisse', () => {
    const pts = [
      ...range(0, 5, (m) => onA(m)),
      onA(6, { ignition: false }),
      ...range(8, 10, (m) => onA(m)),
      onA(17), onA(18)
    ];
    expect(calc(pts)[0].activeMinutes).toBe(8);
  });

  it('ha haakeriista laiusega põllu piires; laiuseta tühi', () => {
    const pts = range(0, 18, (m) => onA(m));
    const [withWidth] = calc(pts, null, IMPL6);
    const expected = coverageAreaHa(pts.map((p, i) => ({ lat: p.lat, lng: p.lng, brk: i === 0 })), A.geometry!, 6);
    expect(withWidth).toMatchObject({ implementId: 'imp-6', widthM: 6 });
    expect(withWidth.areaHa).toBeCloseTo(expected, 2);
    expect(withWidth.areaHa!).toBeGreaterThan(0.1);
    expect(calc(pts)[0]).toMatchObject({ areaHa: null, implementId: null, widthM: null });
    expect(calc(pts, null, () => ({ implementId: 'imp-x', widthM: null }))[0]).toMatchObject({ areaHa: null, implementId: 'imp-x', widthM: null });
  });

  it('kütus loendurist põldude kaupa; teekütus jagatakse põllul oldud aja järgi (summa = sõidu kütus)', () => {
    const c = (m: number) => ({ fuelUsedL: 100 + 0.5 * m });
    const pts = [
      ...range(0, 10, (m) => onA(m, c(m))),
      ...range(11, 15, (m) => s(m, 300, 100, c(m))),
      ...range(16, 20, (m) => s(m, 410 + 10 * (m - 16), 100, c(m)))
    ];
    const [a, b] = calc(pts, 10);
    expect(a).toMatchObject({ fieldSeasonId: 101, fuelFieldL: 5, activeMinutes: 10 });
    expect(b).toMatchObject({ fieldSeasonId: 102, fuelFieldL: 2, activeMinutes: 4 });
    expect(a.fuelSharedL).toBeCloseTo(7.14, 2);
    expect(b.fuelSharedL).toBeCloseTo(2.86, 2);
    expect(a.fuelSharedL! + b.fuelSharedL!).toBeCloseTo(10, 1);
  });

  it('kütus tunnikulust, kui loendurit pole', () => {
    const [a] = calc(range(0, 10, (m) => onA(m, { fuelRateLph: 12 })), 3);
    expect(a.fuelFieldL).toBeCloseTo(2, 2);
    expect(a.fuelSharedL).toBeCloseTo(3, 2);
  });

  it('kütuseandmeteta: põllu kütus ja jagatud kütus tühjad', () => {
    const [a] = calc(range(0, 10, (m) => onA(m)), null);
    expect(a).toMatchObject({ fuelFieldL: null, fuelSharedL: null });
  });

  it('läbisõit serva pealt (< 3 punkti või < 1 min) jääb välja', () => {
    const pts = [s(0, 410, 100), s(1, 420, 100), s(2, 300, 100), s(3, 300, 100), s(5, 50, 50), s(5.3, 55, 50), s(5.6, 60, 50)];
    expect(calc(pts)).toEqual([]);
  });

  it('haakeriist leitakse põllule jõudmise ajal', () => {
    const seen: Date[] = [];
    calc([...range(0, 3, (m) => s(m, 300, 100)), ...range(4, 10, (m) => onA(m))], null, (t) => {
      seen.push(t);
      return { implementId: null, widthM: null };
    });
    expect(seen).toEqual([min(4)]);
  });
});

describe('tripAreaHa', () => {
  const row = (areaHa: number | null): TripFieldCalc => ({
    fieldSeasonId: 1, arriveAt: min(0), leaveAt: min(1), activeMinutes: 1, areaHa,
    implementId: null, widthM: null, fuelFieldL: null, fuelSharedL: null
  });
  it('põldude summa; tühi, kui ühelgi põllul pole ha-d', () => {
    expect(tripAreaHa([row(1.2), row(null), row(0.3)])).toBe(1.5);
    expect(tripAreaHa([row(null)])).toBeNull();
    expect(tripAreaHa([])).toBeNull();
  });
});
