// src/server/tripGaps.test.ts — sõitude vahede märgid ja piirid.
import { describe, it, expect } from 'vitest';
import { computeGaps, isFlagged, type GapSample, type GapTrip } from './tripGaps';

const T0 = Date.parse('2026-11-09T06:00:00Z');
const at = (m: number) => new Date(T0 + m * 60_000);
const trip = (id: string, a: number, b: number, o: Partial<GapTrip> = {}): GapTrip => ({
  id, startedAt: at(a), endedAt: at(b), startLat: 58.1, startLng: 26.1, endLat: 58.1, endLng: 26.1,
  fuelLevelStartPct: 50, fuelLevelEndPct: 50, ...o
});
const smp = (m: number, voltage: number | null = 13, canHours: number | null = null): GapSample => ({ time: at(m), voltage, canHours });
// Punktid iga 5 min järel [a, b], pinge 13 V
const every5 = (a: number, b: number) => Array.from({ length: Math.floor((b - a) / 5) + 1 }, (_, i) => smp(a + i * 5));

describe('computeGaps', () => {
  it('puhas vahe (punktid tihedalt, pinge korras, sama koht ja paak) → hoiatust pole', () => {
    expect(computeGaps([trip('a', 0, 60), trip('b', 120, 180)], every5(60, 120))).toEqual([]);
  });

  it('toide kadus 15 min → vahe koos märkidega', () => {
    const samples = every5(60, 120).map((s) => (s.time >= at(70) && s.time <= at(80) ? { ...s, voltage: 0 } : s));
    const gaps = computeGaps([trip('a', 0, 60), trip('b', 120, 180)], samples);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      prevTripId: 'a', nextTripId: 'b', startedAt: at(60), endedAt: at(120),
      powerLostMinutes: 15, silentMinutes: 5, fuelDropPct: 0, jumpM: 0, engineHoursGrowth: null
    });
  });

  it('toide kadus 4 min → alla piiri, hoiatust pole', () => {
    const samples = [smp(60), smp(70, 0), smp(74), ...every5(75, 120)];
    expect(computeGaps([trip('a', 0, 60), trip('b', 120, 180)], samples)).toEqual([]);
  });

  it('seade vaikis 225 min; vaikimise ajal toitekatkestust ei loeta', () => {
    const samples = [smp(60), smp(65, 0), smp(290), smp(295), smp(300)];
    const g = computeGaps([trip('a', 0, 60), trip('b', 300, 360)], samples)[0];
    expect(g.silentMinutes).toBe(225);
    expect(g.powerLostMinutes).toBe(0);
  });

  it('punkte pole üldse → seade vaikis kogu vahe, pinge tühi', () => {
    const g = computeGaps([trip('a', 0, 60), trip('b', 300, 360)], [])[0];
    expect(g.silentMinutes).toBe(240);
    expect(g.powerLostMinutes).toBeNull();
  });

  it('kütus langes 8 protsendipunkti → hoiatus; tankimine ei anna hoiatust', () => {
    const drop = computeGaps([trip('a', 0, 60, { fuelLevelEndPct: 60 }), trip('b', 120, 180, { fuelLevelStartPct: 52 })], every5(60, 120));
    expect(drop[0].fuelDropPct).toBe(8);
    const refuel = computeGaps([trip('a', 0, 60, { fuelLevelEndPct: 50 }), trip('b', 120, 180, { fuelLevelStartPct: 90 })], every5(60, 120));
    expect(refuel).toEqual([]);
  });

  it('kütuse näit puudub → kütuse märk tühi', () => {
    const g = computeGaps([trip('a', 0, 60, { fuelLevelEndPct: null }), trip('b', 300, 360)], [])[0];
    expect(g.fuelDropPct).toBeNull();
  });

  it('asukoht hüppas ~1,1 km → hoiatus', () => {
    const g = computeGaps([trip('a', 0, 60), trip('b', 120, 180, { startLat: 58.11 })], every5(60, 120))[0];
    expect(g.jumpM).toBeGreaterThan(1100);
    expect(g.jumpM).toBeLessThan(1125);
  });

  it('CAN mootoritunnid +3 h → hoiatus; näit otsitakse kuni 1 h väljapoolt vahet', () => {
    const samples = [smp(10, 13, 2797), ...every5(60, 120), smp(150, 13, 2800)];
    const g = computeGaps([trip('a', 0, 60), trip('b', 120, 180)], samples)[0];
    expect(g.engineHoursGrowth).toBe(3);
  });

  it('CAN mootoritunnid +1 h üksi hoiatust ei anna; koos asukohaga salvestub', () => {
    const samples = [smp(55, 13, 2797), ...every5(60, 120), smp(125, 13, 2798)];
    expect(computeGaps([trip('a', 0, 60), trip('b', 120, 180)], samples)).toEqual([]);
    const g = computeGaps([trip('a', 0, 60), trip('b', 120, 180, { startLat: 58.11 })], samples)[0];
    expect(g.engineHoursGrowth).toBe(1);
  });

  it('CAN näit üle 1 h väljaspool vahet → mootoritundide märk tühi', () => {
    const samples = [smp(-10, 13, 2797), ...every5(60, 120), smp(125, 13, 2805)];
    const g = computeGaps([trip('a', 0, 60), trip('b', 120, 180, { startLat: 58.11 })], samples)[0];
    expect(g.engineHoursGrowth).toBeNull();
  });

  it('kattuvad sõidud jäetakse vahele; mitme sõidu korral õiged paarid', () => {
    const trips = [trip('a', 0, 60), trip('b', 50, 70), trip('c', 400, 460)];
    const gaps = computeGaps(trips, []);
    expect(gaps.map((g) => [g.prevTripId, g.nextTripId])).toEqual([['b', 'c']]);
  });
});

describe('seisu ajal saatmata seade', () => {
  it('seade ei saada seisu ajal (parkedSigns: false) → toide ja vaikimine tühjad, vaikimine üksi hoiatust ei anna', () => {
    expect(computeGaps([trip('a', 0, 60), trip('b', 300, 360)], [], { parkedSigns: false })).toEqual([]);
    const samples = every5(60, 120).map((s) => ({ ...s, voltage: 0 }));
    expect(computeGaps([trip('a', 0, 60), trip('b', 120, 180)], samples, { parkedSigns: false })).toEqual([]);
    const g = computeGaps([trip('a', 0, 60), trip('b', 300, 360, { startLat: 58.11 })], [], { parkedSigns: false })[0];
    expect(g.powerLostMinutes).toBeNull();
    expect(g.silentMinutes).toBeNull();
    expect(g.jumpM).toBeGreaterThan(1100);
  });
});

describe('isFlagged', () => {
  const none = { powerLostMinutes: null, silentMinutes: 0, fuelDropPct: null, jumpM: 0, engineHoursGrowth: null };
  it('piirid', () => {
    expect(isFlagged(none)).toBe(false);
    expect(isFlagged({ ...none, powerLostMinutes: 5 })).toBe(true);
    expect(isFlagged({ ...none, silentMinutes: 180 })).toBe(true);
    expect(isFlagged({ ...none, silentMinutes: 179.9 })).toBe(false);
    expect(isFlagged({ ...none, silentMinutes: null })).toBe(false);
    expect(isFlagged({ ...none, fuelDropPct: 5 })).toBe(true);
    expect(isFlagged({ ...none, jumpM: 500 })).toBe(true);
    expect(isFlagged({ ...none, engineHoursGrowth: 2 })).toBe(true);
    expect(isFlagged({ ...none, engineHoursGrowth: 1 })).toBe(false);
  });
});
