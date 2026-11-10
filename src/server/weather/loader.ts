// src/server/weather/loader.ts — ilmapunktide laadimine CDS-ist (ERA5-Land) ja öine ajasti.
// Esmalaadimine alates 2015 aasta kaupa; edasi ainult puuduvad päevad. ERA5T (esialgne) = viimased 90 päeva:
// need laetakse kord nädalas (esmaspäeval) uuesti ja kirjutatakse üle. Viga ei kustuta midagi; järgmine käik proovib uuesti.
import { prisma, authDb, runAsTenant } from '../db';
import { fetchHourly as cdsFetchHourly } from './cdsClient';
import { hourlyToDaily, tallinnDate } from './daily';
import { addDays } from './summary';
import { bindWeatherPoints } from './points';
import type { HourlyWeather } from './types';

export const WEATHER_START = '2015-01-01';
export const PROVISIONAL_DAYS = 90;
export const FAIL_WARN = 3;
const MIN_HOURS_BETWEEN_RUNS = 20;
const CHECK_INTERVAL_MS = 60 * 60_000;
const MAX_ERROR_LEN = 500;

export type LoaderDeps = {
  now: () => Date;
  fetchHourly: (cell: { lat: number; lon: number }, from: string, to: string) => Promise<HourlyWeather[]>;
};
export const defaultLoaderDeps: LoaderDeps = { now: () => new Date(), fetchHourly: (c, f, t) => cdsFetchHourly(c, f, t) };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);

/** [from, to] tükeldatud kalendriaastate kaupa. */
function yearChunks(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    const a = y === Number(from.slice(0, 4)) ? from : `${y}-01-01`;
    const b = y === Number(to.slice(0, 4)) ? to : `${y}-12-31`;
    if (a <= b) out.push([a, b]);
  }
  return out;
}

export async function loadPoint(pointId: number, deps: LoaderDeps = defaultLoaderDeps, opts: { refreshRecent?: boolean } = {}): Promise<{ days: number }> {
  const p = await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } });
  const now = deps.now();
  const yesterday = addDays(tallinnDate(now), -1);
  const provisionalFrom = addDays(tallinnDate(now), -PROVISIONAL_DAYS);
  const loadedUntil = iso(p.loadedUntil);
  let from = loadedUntil ? addDays(loadedUntil, 1) : WEATHER_START;
  if (opts.refreshRecent && loadedUntil) from = provisionalFrom < WEATHER_START ? WEATHER_START : provisionalFrom;
  if (from > yesterday) return { days: 0 };

  await prisma.weatherPoint.update({ where: { id: pointId }, data: { lastAttemptAt: now } });
  let total = 0;
  try {
    for (const [a, b] of yearChunks(from, yesterday)) {
      // CDS tunnid on UTC ja algavad päeva 00:00 UTC-st; Tallinna päev `a` algab aga eelmisel UTC-päeval (21/22 UTC),
      // seega küsime ühe päeva varem — see lisapäev täidab ainult päeva `a`, filter jätab ülejäänu välja.
      const days = hourlyToDaily(await deps.fetchHourly({ lat: p.lat, lon: p.lon }, addDays(a, -1), b)).filter((d) => d.date >= a && d.date <= b);
      if (days.length === 0) {
        if (!loadedUntil && total === 0) {
          await prisma.weatherPoint.update({ where: { id: pointId }, data: { hasData: false, lastSuccessAt: now, failCount: 0, lastError: null } });
          return { days: 0 };
        }
        continue; // CDS-is pole veel neid päevi (viide)
      }
      const last = days[days.length - 1].date;
      await prisma.$transaction([
        prisma.weatherDaily.deleteMany({ where: { pointId, date: { gte: asDate(days[0].date), lte: asDate(last) } } }),
        prisma.weatherDaily.createMany({
          data: days.map((d) => ({ pointId, ...d, date: asDate(d.date), isFinal: d.date < provisionalFrom }))
        }),
        prisma.weatherPoint.update({
          where: { id: pointId },
          data: {
            hasData: true,
            loadedFrom: p.loadedFrom ?? asDate(days[0].date),
            ...(loadedUntil === null || last > loadedUntil ? { loadedUntil: asDate(last) } : {}),
            finalUntil: asDate(addDays(provisionalFrom, -1) < last ? addDays(provisionalFrom, -1) : last)
          }
        })
      ]);
      total += days.length;
    }
    await prisma.weatherPoint.update({ where: { id: pointId }, data: { lastSuccessAt: now, failCount: 0, lastError: null } });
    return { days: total };
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LEN);
    await prisma.weatherPoint.update({ where: { id: pointId }, data: { lastError: msg, failCount: { increment: 1 } } });
    throw err;
  }
}

let running = false;

/** Kõigi WEATHER mooduliga ettevõtete hooajad seotakse punktidega, siis laetakse kõik punktid. */
export async function runWeatherLoad(deps: LoaderDeps = defaultLoaderDeps, opts: { force?: boolean } = {}): Promise<void> {
  if (running) return;
  if (!process.env.CDS_API_KEY && deps === defaultLoaderDeps) { console.warn('weather: CDS_API_KEY puudub, laadimine vahele'); return; }
  running = true;
  try {
    const licenses = await authDb().tenantLicense.findMany({ select: { tenantId: true, modules: true } });
    for (const l of licenses.filter((x) => x.modules.includes('WEATHER'))) {
      try { await runAsTenant(l.tenantId, () => bindWeatherPoints()); } catch (err) { console.error(`weather: bind ${l.tenantId} failed:`, err); }
    }
    const now = deps.now();
    const monday = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Tallinn' })).getDay() === 1;
    // Prisma `not: false` jätaks NULL-id välja (SQL kolmeväärtuseloogika), seetõttu OR
    const points = await prisma.weatherPoint.findMany({ where: { OR: [{ hasData: null }, { hasData: true }] } });
    for (const p of points) {
      const recent = p.lastSuccessAt && now.getTime() - p.lastSuccessAt.getTime() < MIN_HOURS_BETWEEN_RUNS * 3_600_000;
      if (recent && !opts.force) continue;
      try { await loadPoint(p.id, deps, { refreshRecent: monday || opts.force }); } catch (err) { console.error(`weather: point ${p.id} failed:`, err); }
    }
  } finally {
    running = false;
  }
}

export function startWeatherScheduler(): void {
  const tick = () => {
    const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'Europe/Tallinn', hour: 'numeric', hour12: false }));
    if (hour < 3 || hour > 6) return; // öösel
    runWeatherLoad().catch((err) => console.error('weather load failed:', err));
  };
  setInterval(tick, CHECK_INTERVAL_MS).unref();
}
