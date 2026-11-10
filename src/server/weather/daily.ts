// src/server/weather/daily.ts — ERA5-Landi tunniandmed → Tallinna kalendripäevad.
// Temperatuur ja mullaniiskus on hetkeväärtused (päev = Tallinna päev ajast `time`);
// sademed ja päikesekiirgus on tunni kogused, mis lõpevad ajal `time` (päev = Tallinna päev ajast time − 30 min).
// Potentsiaalne aurumine arvutatakse päeva kaupa Makkinki valemiga (päikesekiirgus + keskmine temperatuur); ERA5 pev-i ei kasutata.
import type { DailyWeather, HourlyWeather } from './types.ts';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit' });
export const tallinnDate = (d: Date): string => fmt.format(d);

const MIN_HOURS = 23; // suveaja vahetuse päevas on 23 tundi

/** ERA5-Land: kogused kogunevad alates 00 UTC; 00 UTC väärtus on eelmise päeva summa. */
export function deaccumulate(values: { time: Date; value: number | null }[]): { time: Date; value: number | null }[] {
  return values.map((v, i) => {
    if (v.value === null) return { time: v.time, value: null };
    if (v.time.getUTCHours() === 1) return { time: v.time, value: Math.max(0, v.value) };
    const prev = values[i - 1];
    if (!prev || prev.value === null || v.time.getTime() - prev.time.getTime() !== 3_600_000) return { time: v.time, value: null };
    return { time: v.time, value: Math.max(0, v.value - prev.value) };
  });
}

type Acc = { temps: number[]; precip: number[]; solar: number[]; s1: number[]; s2: number[] };
const empty = (): Acc => ({ temps: [], precip: [], solar: [], s1: [], s2: [] });
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const avg = (a: number[]) => (a.length ? sum(a) / a.length : null);

/** Makkinki võrdlusaurumine (mm/päevas) päeva keskmisest temperatuurist ja päikesekiirgusest (MJ/m²). */
export function makkinkEt0(tMeanC: number, solarMJm2: number): number {
  const es = 0.6108 * Math.exp((17.27 * tMeanC) / (tMeanC + 237.3));
  const delta = (4098 * es) / (tMeanC + 237.3) ** 2; // küllastusrõhu kõvera tõus, kPa/°C
  const gamma = 0.066; // psühromeetriline konstant, kPa/°C
  return Math.max(0, 0.61 * (delta / (delta + gamma)) * (solarMJm2 / 2.45) - 0.12);
}

export function hourlyToDaily(hours: HourlyWeather[]): DailyWeather[] {
  const byDay = new Map<string, Acc>();
  const get = (k: string) => byDay.get(k) ?? byDay.set(k, empty()).get(k)!;
  for (const h of hours) {
    const instant = get(tallinnDate(h.time));
    if (h.tempC !== null) instant.temps.push(h.tempC);
    if (h.soil1 !== null) instant.s1.push(h.soil1);
    if (h.soil2 !== null) instant.s2.push(h.soil2);
    const amount = get(tallinnDate(new Date(h.time.getTime() - 30 * 60_000)));
    if (h.precipMm !== null) amount.precip.push(h.precipMm);
    if (h.solarJm2 !== null) amount.solar.push(h.solarJm2);
  }
  const out: DailyWeather[] = [];
  for (const [date, a] of [...byDay.entries()].sort(([x], [y]) => x.localeCompare(y))) {
    if (a.temps.length < MIN_HOURS || a.precip.length < MIN_HOURS) continue;
    out.push({
      date,
      tMin: Math.min(...a.temps),
      tMax: Math.max(...a.temps),
      tMean: sum(a.temps) / a.temps.length,
      precipMm: sum(a.precip),
      potEvapMm: a.solar.length >= MIN_HOURS ? makkinkEt0(sum(a.temps) / a.temps.length, sum(a.solar) / 1e6) : null,
      soilMoisture1: avg(a.s1),
      soilMoisture2: avg(a.s2)
    });
  }
  return out;
}
