// src/server/tripImport.ts — sõitude taustaimport telemeetriast (iga 15 min).
// Seadme kaupa: punktid (finalizedUntil, now] omandiperioodi piires → segmentTrips → kohad (buildRoute) → vehicle_trips.
// Viimased 24 h arvutatakse igal käigul uuesti (seade puhverdab levita punkte ja saadab hiljem).
// Kattuv vana sõit annab uuele oma id (märkus ja hilisemad seosed püsivad).
import { prisma, tenantTransaction, authDb, runAsTenant, tsdb } from './db.ts';
import { ownershipWindows, fetchTripSamples } from './telemetryAccess.ts';
import { segmentTrips, type SegmentedTrip, type TripSample } from './tripSegments.ts';
import { buildRoute, DEFAULT_ROUTE_OPTIONS, type Place, type TripRoute } from './tripRoute.ts';
import { loadPlaces } from './tripPlaces.ts';

export type ImportDeps = {
  now: () => Date;
  fetchSamples: (imei: string, fromExclusive: Date, toInclusive: Date) => Promise<TripSample[]>;
  loadPlaces: (year: number) => Promise<Place[]>;
};

export const defaultDeps: ImportDeps = { now: () => new Date(), fetchSamples: fetchTripSamples, loadPlaces };

export const FINAL_AFTER_MS = 24 * 60 * 60 * 1000;
const CHUNK_MS = 2 * 24 * 60 * 60 * 1000;
const INTERVAL_MS = 15 * 60 * 1000;
const PLACE_MARGIN_DEG = 0.003; // ~200–300 m: lähima koha otsingu raadius
const MAX_ERROR_LEN = 500;

type Device = { id: string; imei: string };

function placesCache(deps: ImportDeps) {
  const cache = new Map<number, Promise<Place[]>>();
  return (year: number) => {
    if (!cache.has(year)) cache.set(year, deps.loadPlaces(year));
    return cache.get(year)!;
  };
}

function routeOf(t: { points: TripSample[] }, places: Place[]): TripRoute | null {
  try {
    return buildRoute(t.points, places, DEFAULT_ROUTE_OPTIONS);
  } catch (err) {
    console.warn('trip import: route failed', err);
    return null;
  }
}

const placeJson = (stop: TripRoute['start'] | undefined) =>
  stop ? { place: stop.place, ...(stop.near ? { near: stop.near } : {}) } : { place: null };

function tripData(t: SegmentedTrip, route: TripRoute | null, now: Date) {
  const first = t.points[0];
  const last = t.points[t.points.length - 1];
  return {
    startedAt: t.startedAt, endedAt: t.endedAt, status: t.status,
    startLat: first.lat, startLng: first.lng, startPlace: placeJson(route?.start),
    endLat: last.lat, endLng: last.lng, endPlace: placeJson(route?.end),
    visits: (route?.visits ?? []) as object[],
    distanceKm: t.distanceKm, movingMinutes: t.movingMinutes, idleMinutes: t.idleMinutes,
    pauseCount: t.pauseCount, pauseMinutes: t.pauseMinutes,
    maxSpeedKmh: t.maxSpeedKmh, avgSpeedKmh: t.avgSpeedKmh,
    fuelLiters: t.fuelLiters, fuelLevelStartPct: t.fuelLevelStartPct, fuelLevelEndPct: t.fuelLevelEndPct,
    engineHoursStart: t.engineHoursStart, engineHoursEnd: t.engineHoursEnd,
    minLat: t.minLat, minLng: t.minLng, maxLat: t.maxLat, maxLng: t.maxLng,
    pointCount: t.pointCount, computedAt: now
  };
}

async function writeChunk(deviceId: string, from: Date, to: Date, trips: SegmentedTrip[], routes: (TripRoute | null)[], now: Date, finalizedUntil: Date) {
  await tenantTransaction(async (tx) => {
    // Üheaegsed impordid (CLI ja ajastaja) ei tohi sama uut sõitu kaks korda luua
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('trip-import:' || current_setting('app.tenant_id') || ':' || ${deviceId}))`;
    const existing = await tx.vehicleTrip.findMany({
      where: { deviceId, startedAt: { gt: from, lte: to } },
      orderBy: { startedAt: 'asc' },
      select: { id: true, startedAt: true, endedAt: true }
    });
    const used = new Set<string>();
    const matchIds = trips.map((t) => {
      const m = existing.find((e) => !used.has(e.id) && e.startedAt <= t.endedAt && e.endedAt >= t.startedAt);
      if (m) used.add(m.id);
      return m?.id ?? null;
    });
    const stale = existing.filter((e) => !used.has(e.id)).map((e) => e.id);
    if (stale.length) await tx.vehicleTrip.deleteMany({ where: { id: { in: stale } } });
    for (let i = 0; i < trips.length; i++) {
      const data = tripData(trips[i], routes[i], now);
      const id = matchIds[i];
      if (id) await tx.vehicleTrip.update({ where: { id }, data });
      else await tx.vehicleTrip.create({ data: { deviceId, ...data } });
    }
    await tx.tripImportState.upsert({
      where: { deviceId },
      create: { deviceId, finalizedUntil, lastRunAt: now, lastError: null, lastErrorAt: null },
      update: { finalizedUntil, lastRunAt: now, lastError: null, lastErrorAt: null }
    });
  }, { timeout: 60_000 });
}

export async function importDeviceTrips(device: Device, deps: ImportDeps = defaultDeps): Promise<void> {
  const windows = (await ownershipWindows('IMEI', [device.imei])).get(device.imei) ?? [];
  if (windows.length === 0) return;
  const state = await prisma.tripImportState.findUnique({ where: { deviceId: device.id } });
  const placesFor = placesCache(deps);
  const now = deps.now();
  let from = state?.finalizedUntil ?? new Date(Math.min(...windows.map((w) => w.from.getTime())));
  // Kui üle 24 h kestev sõit on aknas lõpetamata, ei liiguks lõplik piir edasi ja tsükkel jääks igavesti samale kohale.
  // Siis laiendame akent (span kahekordistub), kuni sõit lõpeb või aken jõuab tänaseni; lõpptulemus on sama, mis kogu vahemiku korraga töötlemisel.
  let span = CHUNK_MS;
  for (;;) {
    const to = new Date(Math.min(from.getTime() + span, now.getTime()));
    const samples = await deps.fetchSamples(device.imei, from, to);
    const trips = segmentTrips(samples, to);
    const routes: (TripRoute | null)[] = [];
    for (const t of trips) routes.push(routeOf(t, await placesFor(t.startedAt.getUTCFullYear())));
    const finalCut = to.getTime() - FINAL_AFTER_MS;
    const firstOpen = trips.find((t) => t.status === 'ACTIVE' || t.endedAt.getTime() > finalCut);
    let next = firstOpen ? Math.min(finalCut, firstOpen.startedAt.getTime() - 1) : finalCut;
    if (next < from.getTime()) next = from.getTime();
    const last = to.getTime() >= now.getTime();
    if (!last && next <= from.getTime()) {
      span *= 2;
      continue;
    }
    await writeChunk(device.id, from, to, trips, routes, now, new Date(next));
    if (last) return;
    from = new Date(next);
    span = CHUNK_MS;
  }
}

// --- Kohtade ümberarvutus --------------------------------------------------

async function placesFingerprint(): Promise<string> {
  const [poi, fs] = await Promise.all([
    prisma.pointOfInterest.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.fieldSeason.aggregate({ _count: { _all: true }, _max: { updatedAt: true } })
  ]);
  return `${poi._count._all}:${poi._max.updatedAt?.toISOString() ?? ''}:${fs._count._all}:${fs._max.updatedAt?.toISOString() ?? ''}`;
}

type Box = { minLat: number; minLng: number; maxLat: number; maxLng: number };

async function changedPlaceBoxes(since: Date): Promise<Box[]> {
  const [pois, seasons] = await Promise.all([
    prisma.pointOfInterest.findMany({ where: { updatedAt: { gt: since } }, select: { latitude: true, longitude: true } }),
    prisma.fieldSeason.findMany({ where: { updatedAt: { gt: since } }, select: { geometry: true } })
  ]);
  const boxes: Box[] = pois.map((p) => ({ minLat: p.latitude, maxLat: p.latitude, minLng: p.longitude, maxLng: p.longitude }));
  for (const s of seasons) {
    const g = s.geometry as any;
    const coords: number[][] = g?.type === 'Polygon' ? g.coordinates.flat() : g?.type === 'MultiPolygon' ? g.coordinates.flat(2) : [];
    if (coords.length === 0) continue;
    const lats = coords.map((c) => c[1]);
    const lngs = coords.map((c) => c[0]);
    boxes.push({ minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) });
  }
  return boxes;
}

const overlaps = (a: Box, b: Box) =>
  a.minLat - PLACE_MARGIN_DEG <= b.maxLat && a.maxLat + PLACE_MARGIN_DEG >= b.minLat &&
  a.minLng - PLACE_MARGIN_DEG <= b.maxLng && a.maxLng + PLACE_MARGIN_DEG >= b.minLng;

function referencedIds(t: { startPlace: unknown; endPlace: unknown; visits: unknown }): string[] {
  const ids: string[] = [];
  for (const p of [t.startPlace, t.endPlace] as any[]) {
    if (p?.place?.id) ids.push(p.place.id);
    if (p?.near?.id) ids.push(p.near.id);
  }
  for (const v of ((t.visits as any[]) ?? [])) if (v?.place?.id) ids.push(v.place.id);
  return ids;
}

export async function refreshTripPlaces(device: Device, deps: ImportDeps = defaultDeps): Promise<number> {
  const state = await prisma.tripImportState.findUnique({ where: { deviceId: device.id } });
  if (!state) return 0;
  const fp = await placesFingerprint();
  if (fp === state.placesFingerprint) return 0;
  const now = deps.now();
  let count = 0;
  if (state.placesCheckedAt && state.finalizedUntil) {
    const boxes = await changedPlaceBoxes(state.placesCheckedAt);
    const placesFor = placesCache(deps);
    const trips = await prisma.vehicleTrip.findMany({ where: { deviceId: device.id, startedAt: { lte: state.finalizedUntil } } });
    for (const t of trips) {
      const year = t.startedAt.getUTCFullYear();
      const places = await placesFor(year);
      const known = new Set(places.map((p) => p.id));
      const hit = boxes.some((b) => overlaps(t, b)) || referencedIds(t).some((id) => !known.has(id));
      if (!hit) continue;
      const samples = await deps.fetchSamples(device.imei, new Date(t.startedAt.getTime() - 1), t.endedAt);
      const points = samples.filter((s) => s.ignition !== false);
      if (points.length === 0) continue;
      const route = routeOf({ points }, places);
      if (!route) continue;
      await prisma.vehicleTrip.update({
        where: { id: t.id },
        data: { startPlace: placeJson(route.start), endPlace: placeJson(route.end), visits: route.visits as object[], computedAt: now }
      });
      count++;
    }
  }
  await prisma.tripImportState.update({ where: { deviceId: device.id }, data: { placesFingerprint: fp, placesCheckedAt: now } });
  return count;
}

// --- Ettevõte ja kõik ettevõtted ------------------------------------------------

export async function importTenantTrips(deps: ImportDeps = defaultDeps): Promise<{ devices: number; failed: number }> {
  const devices = await prisma.telemetryDevice.findMany({
    where: { connectivityType: 'CELLULAR', imei: { not: null } },
    select: { id: true, imei: true }
  });
  let failed = 0;
  for (const d of devices) {
    const device = { id: d.id, imei: d.imei! };
    try {
      await importDeviceTrips(device, deps);
      await refreshTripPlaces(device, deps);
    } catch (err) {
      failed++;
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LEN);
      console.error(`trip import: device ${device.imei} failed:`, err);
      const now = deps.now();
      await prisma.tripImportState.upsert({
        where: { deviceId: device.id },
        create: { deviceId: device.id, lastRunAt: now, lastError: msg, lastErrorAt: now },
        update: { lastRunAt: now, lastError: msg, lastErrorAt: now }
      }).catch((e) => console.error('trip import: state write failed', e));
    }
  }
  return { devices: devices.length, failed };
}

let running = false;

/** Kõik ettevõtted, kelle litsentsis on TELEMETRY. Kui eelmine käik veel käib, ei tee midagi. */
export async function runTripImport(deps: ImportDeps = defaultDeps): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (!tsdb) return;
    const licenses = await authDb().tenantLicense.findMany({ select: { tenantId: true, modules: true } });
    for (const l of licenses.filter((x) => x.modules.includes('TELEMETRY'))) {
      try {
        const r = await runAsTenant(l.tenantId, () => importTenantTrips(deps));
        if (r.failed) console.warn(`trip import: ${l.tenantId} ${r.failed}/${r.devices} seadet ebaõnnestus`);
      } catch (err) {
        console.error(`trip import: tenant ${l.tenantId} failed:`, err);
      }
    }
  } finally {
    running = false;
  }
}

export function startTripImportScheduler(): void {
  const tick = () => { runTripImport().catch((err) => console.error('trip import failed:', err)); };
  tick();
  setInterval(tick, INTERVAL_MS).unref();
}
