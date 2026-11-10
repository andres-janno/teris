import { describe, it, expect } from 'vitest';
import { deaccumulate, tallinnDate, hourlyToDaily } from './daily';
import type { HourlyWeather } from './types';

const h = (iso: string) => new Date(iso);

describe('deaccumulate', () => {
  it('kumulatiivne alates 00 UTC → tunnikogused; 01 UTC on esimene tund', () => {
    const r = deaccumulate([
      { time: h('2025-06-01T23:00Z'), value: 5 },
      { time: h('2025-06-02T00:00Z'), value: 6 }, // eelmise päeva summa
      { time: h('2025-06-02T01:00Z'), value: 0.5 },
      { time: h('2025-06-02T02:00Z'), value: 0.5 },
      { time: h('2025-06-02T03:00Z'), value: 2 }
    ]);
    expect(r.map((x) => x.value)).toEqual([null, 1, 0.5, 0, 1.5]);
  });
  it('negatiivne müra → 0', () => {
    const r = deaccumulate([{ time: h('2025-06-02T01:00Z'), value: 1 }, { time: h('2025-06-02T02:00Z'), value: 0.9999 }]);
    expect(r[1].value).toBe(0);
  });
});

describe('tallinnDate', () => {
  it('suveaeg UTC+3', () => {
    expect(tallinnDate(h('2025-06-01T20:59Z'))).toBe('2025-06-01');
    expect(tallinnDate(h('2025-06-01T21:00Z'))).toBe('2025-06-02');
  });
  it('talveaeg UTC+2', () => {
    expect(tallinnDate(h('2025-01-01T21:59Z'))).toBe('2025-01-01');
    expect(tallinnDate(h('2025-01-01T22:00Z'))).toBe('2025-01-02');
  });
});

// Tallinna päev 2025-06-02: temperatuur UTC 2025-06-01T21:00 … 2025-06-02T20:00, kogused tundidest, mis lõpevad 22:00 … 21:00 UTC
function day(tempOf: (i: number) => number, precip = 0.1): HourlyWeather[] {
  return Array.from({ length: 25 }, (_, i) => ({
    time: new Date(Date.UTC(2025, 5, 1, 21 + i)),
    tempC: tempOf(i), precipMm: precip, potEvapMm: 0.2, soil1: 0.3, soil2: 0.35
  }));
}

describe('hourlyToDaily', () => {
  it('min, max, keskmine, summad', () => {
    const [d] = hourlyToDaily(day((i) => i));
    expect(d.date).toBe('2025-06-02');
    expect(d.tMin).toBe(0);
    expect(d.tMax).toBe(23);
    expect(d.tMean).toBeCloseTo(11.5, 5);
    expect(d.precipMm).toBeCloseTo(2.4, 5);
    expect(d.potEvapMm).toBeCloseTo(4.8, 5);
    expect(d.soilMoisture2).toBeCloseTo(0.35, 5);
  });
  it('mittetäielik päev jäetakse välja', () => {
    expect(hourlyToDaily(day((i) => i).slice(0, 20))).toEqual([]);
  });
  it('kogus, mis lõpeb keskööl, kuulub eelmisele päevale', () => {
    const hours = day(() => 10, 0);
    hours[24] = { ...hours[24], precipMm: 7 };
    const [d] = hourlyToDaily(hours);
    expect(d.precipMm).toBeCloseTo(7, 5);
  });
  it('mullaniiskuse puudumisel null', () => {
    const [d] = hourlyToDaily(day(() => 5).map((x) => ({ ...x, soil1: null, soil2: null, potEvapMm: null })));
    expect(d.soilMoisture1).toBeNull();
    expect(d.potEvapMm).toBeNull();
  });
});
