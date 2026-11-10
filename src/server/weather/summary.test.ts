// src/server/weather/summary.test.ts
import { describe, it, expect } from 'vitest';
import { summarizeWeather, averageDays, calendarPeriod, seasonPeriod, meanAndSd, addDays } from './summary';
import type { DailyWeather } from './types';

const d = (date: string, p: Partial<DailyWeather> = {}): DailyWeather => ({
  date, tMin: 5, tMax: 15, tMean: 10, precipMm: 0, potEvapMm: 2, soilMoisture1: 0.3, soilMoisture2: 0.3, ...p
});
const range = (from: string, n: number, p: (i: number) => Partial<DailyWeather> = () => ({})) =>
  Array.from({ length: n }, (_, i) => d(addDays(from, i), p(i)));

describe('summarizeWeather', () => {
  it('GDD baasiga, alla baasi annab 0', () => {
    const s = summarizeWeather([d('2025-05-01', { tMean: 12 }), d('2025-05-02', { tMean: 3 })], { from: '2025-05-01', to: '2025-05-02', gddBaseC: 5 });
    expect(s.gdd).toBe(7);
  });
  it('sademed, vihmapäevad, veebilanss', () => {
    const s = summarizeWeather([d('2025-05-01', { precipMm: 3 }), d('2025-05-02', { precipMm: 0.5 })], { from: '2025-05-01', to: '2025-05-02', gddBaseC: 5 });
    expect(s.precipMm).toBe(3.5);
    expect(s.rainDays).toBe(1);
    expect(s.waterBalanceMm).toBe(-0.5);
  });
  it('pikim kuiv periood', () => {
    // i=0 kuiv, 1–2 vihm, 3–6 kuiv (4 päeva), 7–9 vihm
    const days = range('2025-05-01', 10, (i) => ({ precipMm: i === 0 || (i >= 3 && i <= 6) ? 0 : 2 }));
    const s = summarizeWeather(days, { from: '2025-05-01', to: '2025-05-10', gddBaseC: 5 });
    expect(s.longestDrySpell).toBe(4);
  });
  it('kuumapäevad ja öökülmad aknas', () => {
    const days = [d('2025-04-10', { tMin: -2 }), d('2025-07-01', { tMin: -1, tMax: 30 })];
    const s = summarizeWeather(days, { from: '2025-04-01', to: '2025-08-31', gddBaseC: 5, frostFrom: '2025-04-01', frostTo: '2025-06-30' });
    expect(s.frostDays).toBe(1);
    expect(s.hotDays).toBe(1);
  });
  it('puuduvad päevad: dataUntil ja complete', () => {
    const s = summarizeWeather(range('2025-05-01', 5), { from: '2025-05-01', to: '2025-05-10', gddBaseC: 5 });
    expect(s.days).toBe(5);
    expect(s.dataUntil).toBe('2025-05-05');
    expect(s.complete).toBe(false);
  });
  it('perioodivälised päevad ei loe', () => {
    const s = summarizeWeather([d('2025-03-31', { precipMm: 50 }), d('2025-04-01', { precipMm: 1 })], { from: '2025-04-01', to: '2025-04-01', gddBaseC: 5 });
    expect(s.precipMm).toBe(1);
    expect(s.complete).toBe(true);
  });
  it('aurumiseta veebilanss null', () => {
    const s = summarizeWeather([d('2025-05-01', { potEvapMm: null })], { from: '2025-05-01', to: '2025-05-01', gddBaseC: 5 });
    expect(s.waterBalanceMm).toBeNull();
  });
  it('mullaniiskus juurekihist', () => {
    const s = summarizeWeather([d('2025-05-01', { soilMoisture2: 0.2 }), d('2025-05-02', { soilMoisture2: 0.4 })], { from: '2025-05-01', to: '2025-05-02', gddBaseC: 5 });
    expect(s.soilMoistureAvg).toBeCloseTo(0.3, 5);
    expect(s.soilMoistureMin).toBe(0.2);
  });
});

describe('averageDays', () => {
  it('keskmistab sama kuupäeva; puuduv punktis jäetakse keskmisest välja', () => {
    const r = averageDays([[d('2025-05-01', { tMean: 10, precipMm: 2 })], [d('2025-05-01', { tMean: 12, precipMm: 4 }), d('2025-05-02')]]);
    expect(r).toHaveLength(2);
    expect(r[0].tMean).toBe(11);
    expect(r[0].precipMm).toBe(3);
  });
});

describe('perioodid', () => {
  it('kalendriperiood', () => {
    expect(calendarPeriod(2024)).toEqual({ from: '2024-04-01', to: '2024-08-31', frostFrom: '2024-04-01', frostTo: '2024-06-30' });
  });
  it('külvist koristuseni; öökülm 60 päeva', () => {
    const p = seasonPeriod({ seedingDate: new Date('2025-04-20T00:00:00Z'), harvestDate: new Date('2025-08-10T00:00:00Z') }, '2025-11-10');
    expect(p).toEqual({ from: '2025-04-20', to: '2025-08-10', frostFrom: '2025-04-20', frostTo: '2025-06-19' });
  });
  it('koristuseta → tänaseni; talivili üle aastavahetuse', () => {
    expect(seasonPeriod({ seedingDate: new Date('2024-09-05T00:00:00Z'), harvestDate: null }, '2025-05-01')!.to).toBe('2025-05-01');
    expect(seasonPeriod({ seedingDate: new Date('2024-09-05T00:00:00Z'), harvestDate: null }, '2025-05-01')!.from).toBe('2024-09-05');
  });
  it('külvikuupäevata null', () => {
    expect(seasonPeriod({ seedingDate: null, harvestDate: null }, '2025-05-01')).toBeNull();
  });
});

describe('meanAndSd', () => {
  it('populatsiooni standardhälve', () => {
    expect(meanAndSd([2, 4, 4, 4, 5, 5, 7, 9])).toEqual({ mean: 5, sd: 2 });
  });
});
