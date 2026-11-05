// src/server/tripSegments.test.ts
import { describe, it, expect } from 'vitest';
import { segmentTrips, type TripSample } from './tripSegments';

const T0 = new Date('2026-10-22T06:00:00Z').getTime();
const min = (m: number) => new Date(T0 + m * 60_000);
// ~11 m põhja poole iga sammuga (0.0001° lat)
const s = (m: number, o: Partial<TripSample> = {}): TripSample => ({
  time: min(m), lat: 58 + m * 0.0001, lng: 26, ignition: true, speedKmh: 10,
  fuelUsedL: null, fuelRateLph: null, fuelLevelPct: null, engineHours: null, ...o
});
const run = (from: number, to: number, o: Partial<TripSample> = {}) =>
  Array.from({ length: to - from + 1 }, (_, i) => s(from + i, o));
const LATER = min(24 * 60);

describe('segmentTrips', () => {
  it('üks sõit süüte sees punktidest', () => {
    const trips = segmentTrips(run(0, 30), LATER);
    expect(trips).toHaveLength(1);
    expect(trips[0].startedAt).toEqual(min(0));
    expect(trips[0].endedAt).toEqual(min(30));
    expect(trips[0].status).toBe('CLOSED');
    expect(trips[0].pointCount).toBe(31);
  });

  it('süüde väljas ≤ 10 min → paus samas sõidus', () => {
    const pts = [...run(0, 10), s(13, { ignition: false }), s(16, { ignition: false }), ...run(18, 30)];
    const trips = segmentTrips(pts, LATER);
    expect(trips).toHaveLength(1);
    expect(trips[0].pauseCount).toBe(1);
    expect(trips[0].pauseMinutes).toBe(8);
    expect(trips[0].pointCount).toBe(24);
  });

  it('süüde väljas > 10 min → kaks sõitu', () => {
    const pts = [...run(0, 10), s(12, { ignition: false }), ...run(25, 35)];
    expect(segmentTrips(pts, LATER)).toHaveLength(2);
  });

  it('andmeauk > 20 min süütega → kaks sõitu; ≤ 20 min → üks', () => {
    expect(segmentTrips([...run(0, 10), ...run(31, 40)], LATER)).toHaveLength(2);
    expect(segmentTrips([...run(0, 10), ...run(29, 40)], LATER)).toHaveLength(1);
  });

  it('müra: < 3 punkti või < 1 min jääb välja', () => {
    expect(segmentTrips([s(0), s(0.5)], LATER)).toHaveLength(0);
    expect(segmentTrips([s(0), s(0.2), s(0.4), s(0.6)], LATER)).toHaveLength(0);
  });

  it('süüteväljata seadme punktid loetakse süüte sees olevaks', () => {
    expect(segmentTrips(run(0, 5, { ignition: null }), LATER)).toHaveLength(1);
  });

  it('olek: viimane punkt hiljuti süütega → ACTIVE', () => {
    const trips = segmentTrips(run(0, 10), min(25));
    expect(trips[0].status).toBe('ACTIVE');
    expect(segmentTrips(run(0, 10), min(31))[0].status).toBe('CLOSED');
  });

  it('olek: süüde väljas alla 10 min tagasi → ACTIVE (võib olla paus)', () => {
    const pts = [...run(0, 10), s(11, { ignition: false })];
    expect(segmentTrips(pts, min(18))[0].status).toBe('ACTIVE');
    expect(segmentTrips(pts, min(21))[0].status).toBe('CLOSED');
  });

  it('ainult viimane sõit saab olla ACTIVE', () => {
    const trips = segmentTrips([...run(0, 10), s(11, { ignition: false }), ...run(30, 40)], min(45));
    expect(trips.map((t) => t.status)).toEqual(['CLOSED', 'ACTIVE']);
  });

  it('km: liikumine loetakse, paigal hüplemine mitte', () => {
    const moving = segmentTrips(run(0, 10), LATER)[0];
    expect(moving.distanceKm).toBeGreaterThan(0.1);
    expect(moving.distanceKm).toBeLessThan(0.13);
    const jitter = run(0, 10).map((p, i) => ({ ...p, lat: 58 + (i % 2) * 0.00002, speedKmh: 0 }));
    expect(segmentTrips(jitter, LATER)[0].distanceKm).toBe(0);
  });

  it('liikumis- ja seisuaeg kiiruse järgi; paus ei lähe kumbagi', () => {
    const pts = [...run(0, 5), ...run(6, 10, { speedKmh: 0 }), s(12, { ignition: false }), ...run(15, 20)];
    const t = segmentTrips(pts, LATER)[0];
    expect(t.movingMinutes).toBe(10); // 0→5 ja 15→20
    expect(t.idleMinutes).toBe(5);    // 5→10 (6..10 kiirus 0)
    expect(t.pauseMinutes).toBe(5);   // 10→15
  });

  it('max ja keskmine kiirus', () => {
    const pts = run(0, 10).map((p, i) => ({ ...p, speedKmh: i === 5 ? 40 : 10 }));
    const t = segmentTrips(pts, LATER)[0];
    expect(t.maxSpeedKmh).toBe(40);
    expect(t.avgSpeedKmh).toBeCloseTo(t.distanceKm / (t.movingMinutes / 60), 1);
  });

  it('kütus loendurist (positiivsete juurdekasvude summa, nullimine ei loe)', () => {
    const vals = [100, 100.5, 101, 0.2, 0.7, 1.2];
    const pts = vals.map((v, i) => s(i * 2, { fuelUsedL: v }));
    expect(segmentTrips(pts, LATER)[0].fuelLiters).toBeCloseTo(2.0, 2);
  });

  it('kütus tunnikulust, kui loendurit pole', () => {
    const pts = run(0, 60, { fuelRateLph: 12 });
    expect(segmentTrips(pts, LATER)[0].fuelLiters).toBeCloseTo(12, 1);
  });

  it('kütus tühi, kui seade ei saada kütuseandmeid', () => {
    expect(segmentTrips(run(0, 10), LATER)[0].fuelLiters).toBeNull();
  });

  it('kütusetase ja mootoritunnid: esimene ja viimane näit', () => {
    const pts = run(0, 10).map((p, i) => ({ ...p, fuelLevelPct: i === 0 ? null : 80 - i, engineHours: i < 5 ? 2789 : 2790 }));
    const t = segmentTrips(pts, LATER)[0];
    expect(t.fuelLevelStartPct).toBe(79);
    expect(t.fuelLevelEndPct).toBe(70);
    expect(t.engineHoursStart).toBe(2789);
    expect(t.engineHoursEnd).toBe(2790);
  });

  it('raja ristkülik', () => {
    const t = segmentTrips(run(0, 10), LATER)[0];
    expect(t.minLat).toBeCloseTo(58, 6);
    expect(t.maxLat).toBeCloseTo(58.001, 6);
    expect(t.minLng).toBe(26);
    expect(t.maxLng).toBe(26);
  });
});
