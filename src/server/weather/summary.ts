// src/server/weather/summary.ts — ilmakokkuvõte päevaandmetest (arvutatakse päringu ajal, ei salvestata).
import { tallinnDate } from './daily.ts';
import type { DailyWeather, WeatherSummary } from './types.ts';

export const RAIN_MM = 1;
export const HOT_C = 28;
export const FROST_C = 0;
export const SEASON_FROST_DAYS = 60;

export function addDays(date: string, n: number): string {
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;
const r1 = (x: number) => Math.round(x * 10) / 10;

export function summarizeWeather(
  all: DailyWeather[], o: { from: string; to: string; gddBaseC: number; frostFrom?: string; frostTo?: string }
): WeatherSummary {
  const days = all.filter((x) => x.date >= o.from && x.date <= o.to).sort((a, b) => a.date.localeCompare(b.date));
  let gdd = 0, precip = 0, rain = 0, dry = 0, longest = 0, hot = 0, frost = 0, balance = 0;
  let evapMissing = false;
  const soil: number[] = [];
  for (const x of days) {
    gdd += Math.max(0, x.tMean - o.gddBaseC);
    precip += x.precipMm;
    if (x.precipMm >= RAIN_MM) { rain++; dry = 0; } else { dry++; longest = Math.max(longest, dry); }
    if (x.tMax > HOT_C) hot++;
    if (x.tMin < FROST_C && x.date >= (o.frostFrom ?? o.from) && x.date <= (o.frostTo ?? o.to)) frost++;
    if (x.potEvapMm === null) evapMissing = true; else balance += x.precipMm - x.potEvapMm;
    if (x.soilMoisture2 !== null) soil.push(x.soilMoisture2);
  }
  const dataUntil = days.length ? days[days.length - 1].date : null;
  return {
    from: o.from, to: o.to, days: days.length,
    gdd: r1(gdd), precipMm: r1(precip), rainDays: rain,
    waterBalanceMm: days.length && !evapMissing ? r1(balance) : null,
    longestDrySpell: longest, hotDays: hot, frostDays: frost,
    soilMoistureAvg: soil.length ? soil.reduce((s, v) => s + v, 0) / soil.length : null,
    soilMoistureMin: soil.length ? Math.min(...soil) : null,
    dataUntil,
    complete: days.length === daysBetween(o.from, o.to)
  };
}

export function averageDays(series: DailyWeather[][]): DailyWeather[] {
  if (series.length === 1) return series[0];
  const byDate = new Map<string, DailyWeather[]>();
  for (const s of series) for (const x of s) (byDate.get(x.date) ?? byDate.set(x.date, []).get(x.date)!).push(x);
  const mean = (a: (number | null)[]) => {
    const v = a.filter((x): x is number => x !== null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  };
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, xs]) => ({
    date,
    tMin: mean(xs.map((x) => x.tMin))!, tMax: mean(xs.map((x) => x.tMax))!, tMean: mean(xs.map((x) => x.tMean))!,
    precipMm: mean(xs.map((x) => x.precipMm))!,
    potEvapMm: mean(xs.map((x) => x.potEvapMm)), soilMoisture1: mean(xs.map((x) => x.soilMoisture1)), soilMoisture2: mean(xs.map((x) => x.soilMoisture2))
  }));
}

export function calendarPeriod(year: number) {
  return { from: `${year}-04-01`, to: `${year}-08-31`, frostFrom: `${year}-04-01`, frostTo: `${year}-06-30` };
}

export function seasonPeriod(s: { seedingDate: Date | null; harvestDate: Date | null }, today: string) {
  if (!s.seedingDate) return null;
  const from = tallinnDate(s.seedingDate);
  const to = s.harvestDate ? tallinnDate(s.harvestDate) : today;
  if (to < from) return null;
  return { from, to, frostFrom: from, frostTo: addDays(from, SEASON_FROST_DAYS) };
}

export function meanAndSd(values: number[]): { mean: number; sd: number } {
  if (!values.length) return { mean: 0, sd: 0 };
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length);
  return { mean, sd };
}
