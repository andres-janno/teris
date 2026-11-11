// src/server/weather/weatherApi.ts — ilmaandmete API (/api/weather/*, v.a radar). Kokkuvõtted arvutatakse päringu ajal.
// Ettevõtte punktid = punktid, millega on seotud ettevõtte hooajad; „all“ = nende päevade keskmine.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, requireTenantId } from '../db.ts';
import { json, parseBody } from '../http.ts';
import { sessionUserOf } from '../authGate.ts';
import { encryptSecret } from '../secretBox.ts';
import { checkCdsKey } from './cdsClient.ts';
import { secretsKey, NO_SECRETS_KEY_MESSAGE } from './credentials.ts';
import { bindWeatherPoints } from './points.ts';
import { tallinnDate } from './daily.ts';
import { summarizeWeather, averageDays, calendarPeriod, seasonPeriod, meanAndSd, addDays, SEASON_FROST_DAYS } from './summary.ts';
import { WEATHER_START } from './loader.ts';
import type { DailyWeather, WeatherSummary } from './types.ts';

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
  // Pikaajaline keskmine = 2015 … eelmine täisaasta; jooksev aasta ei lähe sisse (nagu monthsReport)
  const full = years.filter((y) => y.summary.complete && y.year < lastYear);
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

export async function monthsReport(years: number[], point: 'all' | number, base: number) {
  const ids = await resolvePoints(point);
  const days = ids.length ? await loadDays(ids, `${firstYear}-01-01`, tallinnDate(new Date())) : [];
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const monthOf = (y: number, m: number) => summarizeWeather(days, { from: `${y}-${String(m).padStart(2, '0')}-01`, to: lastDay(y, m), gddBaseC: base });
  const thisYear = Number(tallinnDate(new Date()).slice(0, 4));
  return {
    months: MONTHS.map((m) => {
      const past = [];
      for (let y = firstYear; y < thisYear; y++) { const s = monthOf(y, m); if (s.complete) past.push(s); }
      return {
        month: m,
        years: years.map((y) => { const s = monthOf(y, m); return { year: y, precipMm: s.days ? s.precipMm : null, gdd: s.days ? s.gdd : null }; }),
        normalPrecipMm: past.length ? r1(meanAndSd(past.map((s) => s.precipMm)).mean) : null,
        normalGdd: past.length ? r1(meanAndSd(past.map((s) => s.gdd)).mean) : null
      };
    })
  };
}

type CumulativePoint = { day: number; gdd: number; precipMm: number };
function cumulate(days: DailyWeather[], from: string, base: number): CumulativePoint[] {
  let gdd = 0, precip = 0;
  return days.map((d) => {
    gdd += Math.max(0, d.tMean - base); precip += d.precipMm;
    return { day: Math.round((Date.parse(d.date) - Date.parse(from)) / 86_400_000), gdd, precipMm: precip };
  });
}
const round = (pts: CumulativePoint[]) => pts.map((p) => ({ day: p.day, gdd: r1(p.gdd), precipMm: r1(p.precipMm) }));

export async function cumulativeReport(years: number[], point: 'all' | number, base: number) {
  const ids = await resolvePoints(point);
  const today = tallinnDate(new Date());
  const thisYear = Number(today.slice(0, 4));
  const all = ids.length ? await loadDays(ids, `${firstYear}-01-01`, today) : [];
  const ofYear = (y: number) => { const p = calendarPeriod(y); return { p, days: all.filter((d) => d.date >= p.from && d.date <= p.to) }; };
  const series = years.map((y) => { const { p, days } = ofYear(y); return { year: y, points: round(cumulate(days, p.from, base)) }; });
  // Keskmine kasvukõver = täisaastad kuni eelmise aastani (nagu aastate tabeli keskmine), päevade kaupa
  const full: { year: number; pts: CumulativePoint[] }[] = [];
  for (let y = firstYear; y < thisYear; y++) {
    const { p, days } = ofYear(y);
    const len = Math.round((Date.parse(p.to) - Date.parse(p.from)) / 86_400_000) + 1;
    if (days.length === len) full.push({ year: y, pts: cumulate(days, p.from, base) });
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const normal = full.length
    ? { years: full.map((f) => f.year), points: full[0].pts.map((pt, i) => ({ day: pt.day, gdd: r1(mean(full.map((f) => f.pts[i].gdd))), precipMm: r1(mean(full.map((f) => f.pts[i].precipMm))) })) }
    : null;
  return { series, normal };
}

export async function seasonReport(fieldSeasonId: number) {
  const s = await prisma.fieldSeason.findUniqueOrThrow({
    where: { id: fieldSeasonId },
    select: { seedingDate: true, harvestDate: true, weatherPointId: true, weatherPoint: { select: { loadedUntil: true } }, cropEntity: { select: { gddBaseC: true } } }
  });
  const gddBaseC = s.cropEntity?.gddBaseC ?? 5;
  const today = tallinnDate(new Date());
  if (!s.seedingDate) return { summary: null, reason: 'NO_SEEDING' as const, gddBaseC, harvested: false };
  const harvested = !!s.harvestDate;
  if (s.harvestDate && tallinnDate(s.harvestDate) < tallinnDate(s.seedingDate)) return { summary: null, reason: 'INVALID_DATES' as const, gddBaseC, harvested };
  if (tallinnDate(s.seedingDate) > today) return { summary: null, reason: 'NOT_STARTED' as const, gddBaseC, harvested };
  const period = seasonPeriod(s, today)!; // külv olemas ja koristus pole külvist varasem
  if (!s.weatherPointId) return { summary: null, reason: 'NO_POINT' as const, gddBaseC, harvested };
  if (!s.weatherPoint?.loadedUntil) return { summary: null, reason: 'LOADING' as const, gddBaseC, harvested };
  // Külv on hilisem kui viimane laetud päev (andmeviide) — päevi veel pole
  if (s.weatherPoint.loadedUntil.toISOString().slice(0, 10) < period.from) return { summary: null, reason: 'NOT_STARTED' as const, gddBaseC, harvested };
  const days = await loadDays([s.weatherPointId], period.from, period.to);
  return { summary: summarizeWeather(days, { ...period, gddBaseC }), reason: null, gddBaseC, harvested };
}

const HISTORY_YEARS = 5;

// Kuupäeva nihutamine teise aastasse (29.02 → 28.02)
function shiftYear(date: string, year: number): string {
  const md = date.slice(5) === '02-29' ? '02-28' : date.slice(5);
  return `${year}-${md}`;
}

/** Sama põllu eelmise viie aasta ilm. Aasta oma külvi- ja koristuskuupäevaga, kui need on;
 *  muidu valitud hooaja periood nihutatuna sellesse aastasse (ownDates=false). */
export async function seasonHistoryReport(fieldSeasonId: number) {
  const cur = await prisma.fieldSeason.findUniqueOrThrow({
    where: { id: fieldSeasonId },
    select: { fieldId: true, year: true, seedingDate: true, harvestDate: true, weatherPointId: true }
  });
  const today = tallinnDate(new Date());
  const curPeriod = cur.seedingDate && tallinnDate(cur.seedingDate) <= today ? seasonPeriod(cur, today) : null;
  const past = await prisma.fieldSeason.findMany({
    where: { fieldId: cur.fieldId, year: { gte: cur.year - HISTORY_YEARS, lt: cur.year } },
    select: { year: true, crop: true, actualYieldTonsHa: true, seedingDate: true, harvestDate: true, weatherPointId: true, cropEntity: { select: { gddBaseC: true } } }
  });
  const byYear = new Map(past.map((p) => [p.year, p]));
  const rows = [];
  for (let year = cur.year - 1; year >= cur.year - HISTORY_YEARS; year--) {
    const s = byYear.get(year);
    const own = s?.seedingDate && tallinnDate(s.seedingDate) <= today ? seasonPeriod(s, today) : null;
    let period = own;
    if (!period && curPeriod) {
      // Valitud hooaja periood selles aastas; avatud hooaja „tänaseni“ nihutatakse samuti
      // Mõlemad kuupäevad nihkuvad sama arvu aastate võrra (talikultuuri külv on eelmisel aastal)
      const back = cur.year - year;
      const from = shiftYear(curPeriod.from, Number(curPeriod.from.slice(0, 4)) - back);
      const to = shiftYear(curPeriod.to, Number(curPeriod.to.slice(0, 4)) - back);
      period = { from, to, frostFrom: from, frostTo: addDays(from, SEASON_FROST_DAYS) };
    }
    if (!period || period.from < WEATHER_START) continue;
    const pointId = s?.weatherPointId ?? cur.weatherPointId;
    if (!pointId) continue;
    const gddBaseC = s?.cropEntity?.gddBaseC ?? 5;
    const days = await loadDays([pointId], period.from, period.to);
    if (!days.length) continue;
    rows.push({
      year, crop: s?.crop ?? null, actualYieldTonsHa: s?.actualYieldTonsHa ?? null, ownDates: !!own, gddBaseC,
      summary: summarizeWeather(days, { ...period, gddBaseC })
    });
  }
  return { rows };
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
const SEASON_HISTORY_ROUTE = /^\/api\/weather\/season\/(\d+)\/history$/;

const CREDENTIAL_ROUTE = '/api/weather/credential';
const KEY_MIN = 20;
const KEY_MAX = 200;
const KEY_ADMIN_ONLY = 'Ilmaandmete ühendust saab muuta ainult administraator';

/** Ettevõtte CDS võtme olek; võtit ennast ei tagastata kunagi. */
async function credentialStatus(canEdit: boolean) {
  const c = await prisma.tenantWeatherCredential.findFirst();
  return {
    configured: !!c,
    updatedAt: c?.updatedAt.toISOString() ?? null,
    updatedBy: c?.updatedBy ?? null,
    lastUsedAt: c?.lastUsedAt?.toISOString() ?? null,
    lastError: c?.lastError ?? null,
    canEdit
  };
}

async function handleCredential(req: IncomingMessage, res: ServerResponse, method: string): Promise<boolean> {
  const user = sessionUserOf(req);
  if (!user) { json(res, { error: 'Pole sisse logitud' }, 401); return true; }
  const canEdit = user.isAdmin === true && user.supportView !== true;
  if (method === 'GET') { json(res, await credentialStatus(canEdit)); return true; }
  if (method !== 'PUT' && method !== 'DELETE') { json(res, { error: 'Meetod pole lubatud' }, 405); return true; }
  if (!canEdit) { json(res, { error: KEY_ADMIN_ONLY }, 403); return true; }
  if (method === 'DELETE') {
    await prisma.tenantWeatherCredential.deleteMany({});
    json(res, await credentialStatus(canEdit));
    return true;
  }
  const sk = secretsKey();
  if (!sk) { json(res, { error: NO_SECRETS_KEY_MESSAGE }, 503); return true; }
  let body: { key?: unknown };
  try { body = (await parseBody(req, 4 * 1024)) ?? {}; } catch { json(res, { error: 'Vigane päring' }, 400); return true; }
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (key.length < KEY_MIN || key.length > KEY_MAX) { json(res, { error: `Võti peab olema ${KEY_MIN}–${KEY_MAX} märki` }, 400); return true; }
  const check = await checkCdsKey(key);
  if (!check.ok) { json(res, { error: check.message }, 400); return true; }
  const enc = encryptSecret(key, sk);
  const by = user.username;
  await prisma.tenantWeatherCredential.upsert({
    where: { tenantId: requireTenantId() },
    create: { cdsKeyEnc: enc, updatedBy: by },
    update: { cdsKeyEnc: enc, updatedBy: by, lastUsedAt: null, lastError: null }
  });
  json(res, await credentialStatus(canEdit));
  return true;
}

export async function handleWeather(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL): Promise<boolean> {
  if (pathname === CREDENTIAL_ROUTE) return handleCredential(req, res, method);
  if (!pathname.startsWith('/api/weather/') || pathname.startsWith('/api/weather/radar') || method !== 'GET') return false;
  const q = url.searchParams;
  try {
    if (pathname === '/api/weather/points') { json(res, await pointsReport()); return true; }
    if (pathname === '/api/weather/years') { json(res, await yearsReport(parsePoint(q.get('point')), parseBase(q.get('base')))); return true; }
    if (pathname === '/api/weather/months') {
      const years = (q.get('years') ?? q.get('year') ?? '').split(',').map(parseYear).filter((y): y is number => y !== null).slice(0, 12);
      if (!years.length) { json(res, { error: 'Aasta puudub' }, 400); return true; }
      json(res, await monthsReport(years, parsePoint(q.get('point')), parseBase(q.get('base'))));
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
    const h = SEASON_HISTORY_ROUTE.exec(pathname);
    if (h) {
      const exists = await prisma.fieldSeason.count({ where: { id: Number(h[1]) } });
      if (!exists) { json(res, { error: 'Hooaega ei leitud' }, 404); return true; }
      json(res, await seasonHistoryReport(Number(h[1])));
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
