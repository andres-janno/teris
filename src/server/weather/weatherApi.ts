// src/server/weather/weatherApi.ts — ilmaandmete API (/api/weather/*, v.a radar). Kokkuvõtted arvutatakse päringu ajal.
// Ettevõtte punktid = punktid, millega on seotud ettevõtte hooajad; „all“ = nende päevade keskmine.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma } from '../db';
import { json } from '../http';
import { bindWeatherPoints } from './points';
import { tallinnDate } from './daily';
import { summarizeWeather, averageDays, calendarPeriod, seasonPeriod, meanAndSd } from './summary';
import { WEATHER_START } from './loader';
import type { DailyWeather, WeatherSummary } from './types';

const MONTHS = [4, 5, 6, 7, 8];
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);
const firstYear = Number(WEATHER_START.slice(0, 4));
const r1 = (x: number) => Math.round(x * 10) / 10;

export async function loadDays(pointIds: number[], from: string, to: string): Promise<DailyWeather[]> {
  const rows = await prisma.weatherDaily.findMany({
    where: { pointId: { in: pointIds }, date: { gte: asDate(from), lte: asDate(to) } },
    orderBy: { date: 'asc' }
  });
  const by = new Map<number, DailyWeather[]>();
  for (const r of rows) {
    const d: DailyWeather = { date: r.date.toISOString().slice(0, 10), tMin: r.tMin, tMax: r.tMax, tMean: r.tMean, precipMm: r.precipMm, potEvapMm: r.potEvapMm, soilMoisture1: r.soilMoisture1, soilMoisture2: r.soilMoisture2 };
    (by.get(r.pointId) ?? by.set(r.pointId, []).get(r.pointId)!).push(d);
  }
  return averageDays([...by.values()].length ? [...by.values()] : [[]]);
}

/** Ettevõtte punktid; kui mõni hooaeg on sidumata, seotakse enne. */
async function tenantPointIds(): Promise<number[]> {
  if (await prisma.fieldSeason.count({ where: { weatherPointId: null } })) await bindWeatherPoints();
  const rows = await prisma.fieldSeason.findMany({ where: { weatherPointId: { not: null } }, select: { weatherPointId: true }, distinct: ['weatherPointId'] });
  return rows.map((r) => r.weatherPointId!);
}

async function resolvePoints(point: 'all' | number): Promise<number[]> {
  const ids = await tenantPointIds();
  if (point === 'all') return ids;
  if (!ids.includes(point)) throw Object.assign(new Error('Ilmapunkti ei leitud'), { status: 404 });
  return [point];
}

const NUMERIC: (keyof WeatherSummary)[] = ['gdd', 'precipMm', 'rainDays', 'waterBalanceMm', 'longestDrySpell', 'hotDays', 'frostDays'];

export async function yearsReport(point: 'all' | number, base: number) {
  const ids = await resolvePoints(point);
  const today = tallinnDate(new Date());
  const lastYear = Number(today.slice(0, 4));
  const days = ids.length ? await loadDays(ids, `${firstYear}-01-01`, today) : [];
  const years = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const p = calendarPeriod(y);
    if (p.from > today) break;
    years.push({ year: y, summary: summarizeWeather(days, { ...p, gddBaseC: base }) });
  }
  const full = years.filter((y) => y.summary.complete);
  const normal: Record<string, number | null> = {};
  const sd: Record<string, number | null> = {};
  for (const k of NUMERIC) {
    const vals = full.map((y) => y.summary[k]).filter((v): v is number => typeof v === 'number');
    const m = meanAndSd(vals);
    normal[k] = vals.length ? r1(m.mean) : null;
    sd[k] = vals.length ? r1(m.sd) : null;
  }
  return { years, normal, sd, normalYears: full.map((y) => y.year), dataUntil: days.length ? days[days.length - 1].date : null };
}

export async function monthsReport(year: number, point: 'all' | number, base: number) {
  const ids = await resolvePoints(point);
  const days = ids.length ? await loadDays(ids, `${firstYear}-01-01`, tallinnDate(new Date())) : [];
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const monthOf = (y: number, m: number) => summarizeWeather(days, { from: `${y}-${String(m).padStart(2, '0')}-01`, to: lastDay(y, m), gddBaseC: base });
  return {
    months: MONTHS.map((m) => {
      const cur = monthOf(year, m);
      const past = [];
      for (let y = firstYear; y < Number(tallinnDate(new Date()).slice(0, 4)); y++) { const s = monthOf(y, m); if (s.complete) past.push(s); }
      return {
        month: m, precipMm: cur.days ? cur.precipMm : null, gdd: cur.days ? cur.gdd : null,
        normalPrecipMm: past.length ? r1(meanAndSd(past.map((s) => s.precipMm)).mean) : null,
        normalGdd: past.length ? r1(meanAndSd(past.map((s) => s.gdd)).mean) : null
      };
    })
  };
}

export async function cumulativeReport(years: number[], point: 'all' | number, base: number) {
  const ids = await resolvePoints(point);
  const series = [];
  for (const y of years) {
    const p = calendarPeriod(y);
    const days = ids.length ? await loadDays(ids, p.from, p.to) : [];
    let gdd = 0, precip = 0;
    series.push({
      year: y,
      points: days.map((d) => {
        gdd += Math.max(0, d.tMean - base); precip += d.precipMm;
        return { day: Math.round((Date.parse(d.date) - Date.parse(p.from)) / 86_400_000), gdd: r1(gdd), precipMm: r1(precip) };
      })
    });
  }
  return { series };
}

export async function seasonReport(fieldSeasonId: number) {
  const s = await prisma.fieldSeason.findUniqueOrThrow({
    where: { id: fieldSeasonId },
    select: { seedingDate: true, harvestDate: true, weatherPointId: true, weatherPoint: { select: { loadedUntil: true } }, cropEntity: { select: { gddBaseC: true } } }
  });
  const gddBaseC = s.cropEntity?.gddBaseC ?? 5;
  const period = seasonPeriod(s, tallinnDate(new Date()));
  if (!period) return { summary: null, reason: 'NO_SEEDING' as const, gddBaseC };
  if (!s.weatherPointId) return { summary: null, reason: 'NO_POINT' as const, gddBaseC };
  if (!s.weatherPoint?.loadedUntil) return { summary: null, reason: 'LOADING' as const, gddBaseC };
  const days = await loadDays([s.weatherPointId], period.from, period.to);
  return { summary: summarizeWeather(days, { ...period, gddBaseC }), reason: null, gddBaseC };
}

export async function seasonsReport(year: number) {
  const rows = await prisma.fieldSeason.findMany({ where: { year, seedingDate: { not: null } }, select: { id: true } });
  const out = [];
  for (const r of rows) {
    const rep = await seasonReport(r.id);
    if (rep.summary) out.push({ fieldSeasonId: r.id, gdd: rep.summary.gdd, precipMm: rep.summary.precipMm });
  }
  return { rows: out };
}

async function pointsReport() {
  const ids = await tenantPointIds();
  const points = await prisma.weatherPoint.findMany({ where: { id: { in: ids } }, orderBy: [{ lat: 'desc' }, { lon: 'asc' }] });
  const counts = await prisma.fieldSeason.groupBy({ by: ['weatherPointId'], where: { weatherPointId: { in: ids } }, _count: { _all: true } });
  const cnt = new Map(counts.map((c) => [c.weatherPointId, c._count._all]));
  return {
    points: points.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, hasData: p.hasData, loadedUntil: p.loadedUntil?.toISOString().slice(0, 10) ?? null, fieldCount: cnt.get(p.id) ?? 0 })),
    loading: points.some((p) => p.hasData !== false && !p.loadedUntil)
  };
}

const parsePoint = (v: string | null): 'all' | number => (v && v !== 'all' && Number.isInteger(Number(v)) ? Number(v) : 'all');
const parseBase = (v: string | null): number => { const n = Number(v); return v !== null && Number.isFinite(n) && n >= 0 && n <= 15 ? n : 5; };
const parseYear = (v: string | null): number | null => (v && /^\d{4}$/.test(v) ? Number(v) : null);
const SEASON_ROUTE = /^\/api\/weather\/season\/(\d+)$/;

export async function handleWeather(_req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL): Promise<boolean> {
  if (!pathname.startsWith('/api/weather/') || pathname.startsWith('/api/weather/radar') || method !== 'GET') return false;
  const q = url.searchParams;
  try {
    if (pathname === '/api/weather/points') { json(res, await pointsReport()); return true; }
    if (pathname === '/api/weather/years') { json(res, await yearsReport(parsePoint(q.get('point')), parseBase(q.get('base')))); return true; }
    if (pathname === '/api/weather/months') {
      const y = parseYear(q.get('year'));
      if (!y) { json(res, { error: 'Aasta puudub' }, 400); return true; }
      json(res, await monthsReport(y, parsePoint(q.get('point')), parseBase(q.get('base'))));
      return true;
    }
    if (pathname === '/api/weather/cumulative') {
      const years = (q.get('years') ?? '').split(',').map(parseYear).filter((y): y is number => y !== null).slice(0, 12);
      json(res, await cumulativeReport(years, parsePoint(q.get('point')), parseBase(q.get('base'))));
      return true;
    }
    if (pathname === '/api/weather/seasons') {
      const y = parseYear(q.get('year'));
      if (!y) { json(res, { error: 'Aasta puudub' }, 400); return true; }
      json(res, await seasonsReport(y));
      return true;
    }
    const m = SEASON_ROUTE.exec(pathname);
    if (m) {
      const exists = await prisma.fieldSeason.count({ where: { id: Number(m[1]) } });
      if (!exists) { json(res, { error: 'Hooaega ei leitud' }, 404); return true; }
      json(res, await seasonReport(Number(m[1])));
      return true;
    }
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) { json(res, { error: (err as Error).message }, 404); return true; }
    throw err;
  }
  return false;
}
