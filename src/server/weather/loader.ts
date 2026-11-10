// src/server/weather/loader.ts — ilmapunktide laadimine CDS-ist (ERA5-Land) ja öine ajasti.
// Esmalaadimine alates 2015 aasta kaupa; edasi ainult puuduvad päevad. ERA5T (esialgne) = viimased 90 päeva:
// need laetakse kord nädalas (esmaspäeval) uuesti ja kirjutatakse üle. Viga ei kustuta midagi; järgmine käik proovib uuesti.
import { prisma, authDb, runAsTenant } from '../db';
import { fetchHourly as cdsFetchHourly } from './cdsClient';
import { hourlyToDaily, tallinnDate } from './daily';
import { addDays } from './summary';
import { bindWeatherPoints } from './points';
import { licenseState, tallinnToday } from '../license';
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
  const finalUntil = iso(p.finalUntil);
  if (opts.refreshRecent && loadedUntil) {
    // Uuesti tuleb laadida ka päevad, mis on vahepeal 90-päevasest aknast välja vanunud (siis saavad isFinal=true).
    from = finalUntil && addDays(finalUntil, 1) < provisionalFrom ? addDays(finalUntil, 1) : provisionalFrom;
    if (from < WEATHER_START) from = WEATHER_START;
  }
  if (from > yesterday) return { days: 0 };

  await prisma.weatherPoint.update({ where: { id: pointId }, data: { lastAttemptAt: now } });
  let total = 0;
  let loadedFromSet = p.loadedFrom !== null; // loadedFrom seatakse ainult esimese õnnestunud tüki juures
  let finalSoFar = finalUntil; // viimane päev, mille rida on tegelikult isFinal=true
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
      const finalDays = days.filter((d) => d.date < provisionalFrom);
      if (finalDays.length > 0) {
        const lastFinal = finalDays[finalDays.length - 1].date;
        if (!finalSoFar || lastFinal > finalSoFar) finalSoFar = lastFinal;
      }
      await prisma.$transaction([
        prisma.weatherDaily.deleteMany({ where: { pointId, date: { in: days.map((d) => asDate(d.date)) } } }),
        prisma.weatherDaily.createMany({
          data: days.map((d) => ({ pointId, ...d, date: asDate(d.date), isFinal: d.date < provisionalFrom }))
        }),
        prisma.weatherPoint.update({
          where: { id: pointId },
          data: {
            hasData: true,
            ...(loadedFromSet ? {} : { loadedFrom: asDate(days[0].date) }),
            ...(loadedUntil === null || last > loadedUntil ? { loadedUntil: asDate(last) } : {}),
            ...(finalSoFar ? { finalUntil: asDate(finalSoFar) } : {})
          }
        })
      ]);
      loadedFromSet = true;
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

/** Kas selles protsessis käib parajasti kogu punktide laadimine (öine ajasti või CLI). */
export const isWeatherLoadRunning = (): boolean => running;

/**
 * Punkti "laenutus": üks atomaarne UPDATE võtab punkti enda kätte ainult siis, kui viimasest katsest on piisavalt aega.
 * Annab ühe katse öö kohta (ka vea korral) ning takistab CLI ja serveri ajasti samaaegset laadimist.
 * Valitud advisory-lukule eelistatult: Prismal pole garanteeritud sama ühendus tundide kaupa, rida-põhine claim töötab ilma selleta.
 */
export async function claimPoint(pointId: number, now: Date): Promise<boolean> {
  const { count } = await prisma.weatherPoint.updateMany({
    where: { id: pointId, OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: new Date(now.getTime() - MIN_HOURS_BETWEEN_RUNS * 3_600_000) } }] },
    data: { lastAttemptAt: now }
  });
  return count > 0;
}

/**
 * Seob ja kogub punktid, mida laadida: ainult need, mis on seotud ettevõtete hooaegadega, kelle litsents sisaldab
 * WEATHER moodulit ja kehtib praegu (validUntil on viimane kehtiv päev). Teiste ettevõtete punkte ei laeta.
 */
export async function wantedPointIds(licenses: { tenantId: string; modules: string[]; validUntil: Date }[], today: string): Promise<Set<number>> {
  const wanted = new Set<number>();
  for (const l of licenses.filter((x) => x.modules.includes('WEATHER') && !licenseState(x, today).readOnly)) {
    try {
      await runAsTenant(l.tenantId, async () => {
        await bindWeatherPoints();
        const rows = await prisma.fieldSeason.findMany({ where: { weatherPointId: { not: null } }, select: { weatherPointId: true }, distinct: ['weatherPointId'] });
        for (const r of rows) wanted.add(r.weatherPointId!);
      });
    } catch (err) { console.error(`weather: bind ${l.tenantId} failed:`, err); }
  }
  return wanted;
}

/** Kõigi WEATHER mooduliga ettevõtete hooajad seotakse punktidega, siis laetakse kõik punktid. */
export async function runWeatherLoad(deps: LoaderDeps = defaultLoaderDeps, opts: { force?: boolean } = {}): Promise<void> {
  if (running) return;
  if (!process.env.CDS_API_KEY && deps === defaultLoaderDeps) { console.warn('weather: CDS_API_KEY puudub, laadimine vahele'); return; }
  running = true;
  try {
    const licenses = await authDb().tenantLicense.findMany({ select: { tenantId: true, modules: true, validUntil: true } });
    const now = deps.now();
    const today = tallinnToday(now);
    const wanted = await wantedPointIds(licenses, today);
    const monday = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Tallinn' })).getDay() === 1;
    // Prisma `not: false` jätaks NULL-id välja (SQL kolmeväärtuseloogika), seetõttu OR
    const points = await prisma.weatherPoint.findMany({ where: { id: { in: [...wanted] }, OR: [{ hasData: null }, { hasData: true }] } });
    for (const p of points) {
      if (!opts.force && !(await claimPoint(p.id, now))) continue;
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
