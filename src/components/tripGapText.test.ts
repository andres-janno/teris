// src/components/tripGapText.test.ts — sõitude vahe hoiatuse tekst.
import { describe, it, expect } from 'vitest';
import { gapParts, minutesText } from './tripGapText';
import type { TripGap } from '../types/fleet';

const gap = (o: Partial<TripGap> = {}): TripGap => ({
  id: 'g', startedAt: '2026-11-09T06:00:00Z', endedAt: '2026-11-09T20:05:00Z',
  powerLostMinutes: null, silentMinutes: 0, fuelDropPct: null, jumpM: 0, engineHoursGrowth: null,
  reviewedAt: null, reviewedBy: null, reviewNote: null, ...o
});

describe('minutesText', () => {
  it('minutid ja tunnid', () => {
    expect(minutesText(4.6)).toBe('5 min');
    expect(minutesText(130)).toBe('2 h 10 min');
    expect(minutesText(845)).toBe('14 h 05 min');
  });
});

describe('gapParts', () => {
  it('ainult piiri ületanud märgid', () => {
    expect(gapParts(gap({ powerLostMinutes: 4, silentMinutes: 179, fuelDropPct: 4.9, jumpM: 499 }))).toEqual([]);
  });
  it('kõik märgid Eesti formaadis', () => {
    expect(gapParts(gap({ powerLostMinutes: 130, silentMinutes: 225, fuelDropPct: 12, jumpM: 1412, engineHoursGrowth: 3 }))).toEqual([
      'toide kadus 2 h 10 min', 'seade vaikis 3 h 45 min', 'kütus −12%', 'asukoht +1,4 km', 'mootoritunnid +3 h'
    ]);
  });
  it('asukoht alla 1 km meetrites; mootoritunnid +1 h näidatakse', () => {
    expect(gapParts(gap({ jumpM: 800, engineHoursGrowth: 1 }))).toEqual(['asukoht +800 m', 'mootoritunnid +1 h']);
  });
  it('mootoritunnid alla 1 h ei näidata; komakohaga kütus', () => {
    expect(gapParts(gap({ fuelDropPct: 6.5, engineHoursGrowth: 0.5 }))).toEqual(['kütus −6,5%']);
  });
});
