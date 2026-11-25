// src/server/tripsApi.ts — sõitude register (HTTP): loend, impordi olek, sõidu rada, märkuse muutmine, sõitude vahed (jälgimata töö märgid) ja nende kontroll.
// Sõidud tulevad taustaimpordist (tripImport.ts); masin/haakeriist liidetakse lugemisel seoste registrist sõidu alguse ajal.
// Sõidu põllud (ha, kütus) ja nendega seotud kanded: vehicle_trip_fields + work_entries.tripId.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, tenantTransaction, tsdb } from './db.ts';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';
import { fetchTripSamples, fetchGapSamples } from './telemetryAccess.ts';
import { lockDevice, recomputeGaps } from './tripGapStore.ts';
import { computeTripFields, fieldRuns, tripAreaHa, type ImplementAt } from './tripFields.ts';
import { loadPlaces } from './tripPlaces.ts';
import type { Place } from './tripRoute.ts';
import { loadAssignmentResolver } from './tripAssignments.ts';
import { workTypeDisplayName } from '../services/workTypeName.ts';

const DEFAULT_DAYS = 7;
const MAX_NOTES = 1000;
const DELETE_FORBIDDEN = 'Sõitu saab kustutada ja taastada ainult admin';
const GAP_NOTE_REQUIRED = 'Lisa selgitus, miks hoiatus on kontrollitud';
const ENTRY_LINKED = 'Sõiduga on seotud kanne — eemalda enne kande seos';
const IMPLEMENT_NOT_FOUND = 'Haakeriista ei leitud';
const WIDTH_INVALID = 'Töölaius peab olema suurem kui 0';

type TripRow = Awaited<ReturnType<typeof prisma.vehicleTrip.findMany>>[number];

export type TripFieldEntryDto = { id: string; fieldWorkId: string; workTypeName: string; date: string };
export type TripFieldDto = {
  fieldSeasonId: number;
  year: number;
  label: string;
  arriveAt: string;
  leaveAt: string;
  activeMinutes: number;
  areaHa: number | null;
  implementName: string | null;
  widthM: number | null;
  fuelFieldL: number | null;
  fuelSharedL: number | null;
  entries: TripFieldEntryDto[];
};

export type TripGapDto = {
  id: string;
  startedAt: string;
  endedAt: string;
  powerLostMinutes: number | null;
  silentMinutes: number | null;
  fuelDropPct: number | null;
  jumpM: number | null;
  engineHoursGrowth: number | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
};

type GapRow = Awaited<ReturnType<typeof prisma.vehicleTripGap.findMany>>[number];

const gapDto = (g: GapRow): TripGapDto => ({
  id: g.id, startedAt: g.startedAt.toISOString(), endedAt: g.endedAt.toISOString(),
  powerLostMinutes: g.powerLostMinutes, silentMinutes: g.silentMinutes, fuelDropPct: g.fuelDropPct,
  jumpM: g.jumpM, engineHoursGrowth: g.engineHoursGrowth,
  reviewedAt: g.reviewedAt ? g.reviewedAt.toISOString() : null, reviewedBy: g.reviewedBy, reviewNote: g.reviewNote
});

// Vahe, mis lõpeb sõidu algusega (vahe võti on järgmine sõit)
async function loadGaps(trips: TripRow[]): Promise<(tripId: string) => TripGapDto | null> {
  if (trips.length === 0) return () => null;
  const rows = await prisma.vehicleTripGap.findMany({ where: { nextTripId: { in: trips.map((t) => t.id) } } });
  const byTrip = new Map(rows.map((g) => [g.nextTripId, gapDto(g)]));
  return (tripId) => byTrip.get(tripId) ?? null;
}

/** Sõidud → DTO-d koos masina, põldude ja vahega. */
async function toDtos(trips: TripRow[]) {
  const [target, fieldsOf, gapOf] = await Promise.all([resolveTargets(trips), loadTripFields(trips), loadGaps(trips)]);
  return trips.map((t) => toDto(t, target(t), fieldsOf(t.id), gapOf(t.id)));
}

// Sõidu kustutamine/taastamine muudab naabrite vahet: arvuta selle sõidu ja järgmise kustutamata sõidu vahed uuesti
async function recomputeGapsAround(trip: TripRow): Promise<void> {
  if (!tsdb) return; // telemeetriata oleks „seade vaikis“ igal vahel vale
  const device = await prisma.telemetryDevice.findUnique({ where: { id: trip.deviceId }, select: { id: true, imei: true } });
  if (!device?.imei) return;
  const next = await prisma.vehicleTrip.findFirst({
    where: { deviceId: trip.deviceId, deletedAt: null, startedAt: { gt: trip.startedAt } }, orderBy: { startedAt: 'asc' }, select: { startedAt: true }
  });
  try {
    await recomputeGaps({ id: device.id, imei: device.imei }, new Date(trip.startedAt.getTime() - 1), next?.startedAt ?? trip.startedAt, fetchGapSamples);
  } catch (err) {
    // Sõidu muudatus on salvestatud; vahe paraneb järgmisel impordil (viimased 24 h)
    console.error('trip gaps: ümberarvutus ebaõnnestus', err);
  }
}

const parseIso = (v: string | null): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const deviceLabelOf = (d: { model: string; imei: string | null }) => (d.imei ? `${d.model} (${d.imei.slice(-4)})` : d.model);

const normWidth = (w: number | null) => (w != null && w > 0 ? w : null);

async function resolveTargets(trips: TripRow[]) {
  const deviceIds = [...new Set(trips.map((t) => t.deviceId))];
  const manualImplIds = [...new Set(trips.filter((t) => t.manualImplement && t.implementId).map((t) => t.implementId!))];
  const [devices, resolve, manualImpls] = await Promise.all([
    prisma.telemetryDevice.findMany({ where: { id: { in: deviceIds } }, select: { id: true, model: true, imei: true } }),
    loadAssignmentResolver(deviceIds),
    manualImplIds.length ? prisma.implement.findMany({ where: { id: { in: manualImplIds } }, select: { id: true, name: true } }) : Promise.resolve([])
  ]);
  const implNameById = new Map(manualImpls.map((i) => [i.id, i.name]));
  return (t: TripRow) => {
    const dev = devices.find((d) => d.id === t.deviceId);
    const r = resolve(t.deviceId, t.startedAt);
    const implementId = t.manualImplement ? t.implementId : r.implementId;
    const implementName = t.manualImplement ? (t.implementId ? implNameById.get(t.implementId) ?? null : null) : r.implementName;
    const widthM = t.manualImplement ? normWidth(t.widthM) : r.widthM;
    return {
      deviceLabel: dev ? deviceLabelOf(dev) : t.deviceId,
      vehicleId: r.vehicleId,
      vehicleName: r.vehicleName,
      implementId,
      implementName,
      widthM,
      manualImplement: t.manualImplement
    };
  };
}

// Sõitude põllured koos põllu nime, haakeriista nime ja selle põllu kannetega (kanne = sama sõit + sama põld; sügistööd on järgmise aasta hooajal)
export type TripSwathDto = { fieldSeasonId: number; widthM: number; lines: [number, number][][] };

/** Põllulõigud haakeriista laiusega (ainult read, kus laius teada): kaardil lai kate. */
export async function buildSwaths(tripId: string, samples: Parameters<typeof fieldRuns>[0]): Promise<TripSwathDto[]> {
  const rows = await prisma.vehicleTripField.findMany({ where: { tripId }, orderBy: { arriveAt: 'asc' }, select: { fieldSeasonId: true, widthM: true } });
  const withWidth = rows.filter((r) => r.widthM != null && r.widthM > 0);
  if (withWidth.length === 0) return [];
  const seasons = await prisma.fieldSeason.findMany({ where: { id: { in: withWidth.map((r) => r.fieldSeasonId) } }, select: { id: true, geometry: true } });
  const places: Place[] = [];
  for (const s of seasons) {
    const g = s.geometry as any;
    if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon')) places.push({ id: String(s.id), kind: 'FIELD', label: String(s.id), geometry: g });
  }
  const runs = fieldRuns(samples, places);
  const out: TripSwathDto[] = [];
  for (const r of withWidth) {
    const lines = runs
      .filter((run) => run.fieldSeasonId === r.fieldSeasonId && run.points.length >= 2)
      .map((run) => run.points.map((p) => [p.lat, p.lng] as [number, number]));
    if (lines.length) out.push({ fieldSeasonId: r.fieldSeasonId, widthM: r.widthM as number, lines });
  }
  return out;
}

async function loadTripFields(trips: TripRow[]): Promise<(tripId: string) => TripFieldDto[]> {
  const tripIds = trips.map((t) => t.id);
  if (tripIds.length === 0) return () => [];
  const [rows, entries] = await Promise.all([
    prisma.vehicleTripField.findMany({
      where: { tripId: { in: tripIds } },
      include: { fieldSeason: { select: { year: true, fieldId: true, field: { select: { num: true, name: true } } } } },
      orderBy: { arriveAt: 'asc' }
    }),
    prisma.workEntry.findMany({
      where: { tripId: { in: tripIds } },
      select: {
        id: true, tripId: true, date: true, fieldWorkId: true,
        fieldWork: { select: { fieldSeason: { select: { fieldId: true } }, workType: { select: { name: true, shortName: true } } } }
      },
      orderBy: { date: 'asc' }
    })
  ]);
  const implIds = [...new Set(rows.map((r) => r.implementId).filter((x): x is string => !!x))];
  const impls = implIds.length ? await prisma.implement.findMany({ where: { id: { in: implIds } }, select: { id: true, name: true } }) : [];
  const byTrip = new Map<string, TripFieldDto[]>();
  for (const r of rows) {
    const list = byTrip.get(r.tripId) ?? [];
    list.push({
      fieldSeasonId: r.fieldSeasonId,
      year: r.fieldSeason.year,
      label: `Nr ${r.fieldSeason.field.num} ${r.fieldSeason.field.name}`.trim(),
      arriveAt: r.arriveAt.toISOString(),
      leaveAt: r.leaveAt.toISOString(),
      activeMinutes: r.activeMinutes,
      areaHa: r.areaHa,
      // Kustutatud haakeriista nime pole; laius jääb ajalukku
      implementName: impls.find((i) => i.id === r.implementId)?.name ?? null,
      widthM: r.widthM,
      fuelFieldL: r.fuelFieldL,
      fuelSharedL: r.fuelSharedL,
      entries: entries
        .filter((e) => e.tripId === r.tripId && e.fieldWork.fieldSeason.fieldId === r.fieldSeason.fieldId)
        .map((e) => ({ id: e.id, fieldWorkId: e.fieldWorkId, workTypeName: workTypeDisplayName(e.fieldWork.workType), date: e.date.toISOString().slice(0, 10) }))
    });
    byTrip.set(r.tripId, list);
  }
  return (tripId) => byTrip.get(tripId) ?? [];
}

function toDto(t: TripRow, target: ReturnType<Awaited<ReturnType<typeof resolveTargets>>>, fields: TripFieldDto[], gapBefore: TripGapDto | null) {
  const sp = (t.startPlace ?? { place: null }) as any;
  const ep = (t.endPlace ?? { place: null }) as any;
  return {
    id: t.id, deviceId: t.deviceId, ...target,
    startedAt: t.startedAt.toISOString(), endedAt: t.endedAt.toISOString(), status: t.status,
    start: { lat: t.startLat, lng: t.startLng, place: sp.place ?? null, ...(sp.near ? { near: sp.near } : {}) },
    end: { lat: t.endLat, lng: t.endLng, place: ep.place ?? null, ...(ep.near ? { near: ep.near } : {}) },
    visits: (t.visits as any[]) ?? [],
    distanceKm: t.distanceKm, movingMinutes: t.movingMinutes, idleMinutes: t.idleMinutes,
    pauseCount: t.pauseCount, pauseMinutes: t.pauseMinutes,
    maxSpeedKmh: t.maxSpeedKmh, avgSpeedKmh: t.avgSpeedKmh, fuelLiters: t.fuelLiters,
    fuelLevelStartPct: t.fuelLevelStartPct, fuelLevelEndPct: t.fuelLevelEndPct,
    engineHoursStart: t.engineHoursStart, engineHoursEnd: t.engineHoursEnd,
    pointCount: t.pointCount, areaHa: t.areaHa, notes: t.notes,
    deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
    fields,
    gapBefore
  };
}

export async function handleTrips(
  req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL,
  deps: { fetchSamples?: typeof fetchTripSamples } = {}
): Promise<boolean> {
  if (pathname !== '/api/fleet/trips' && !pathname.startsWith('/api/fleet/trips/')) return false;

  if (pathname === '/api/fleet/trips' && method === 'GET') {
    const to = parseIso(url.searchParams.get('to')) ?? new Date();
    const from = parseIso(url.searchParams.get('from')) ?? new Date(to.getTime() - DEFAULT_DAYS * 86_400_000);
    const status = url.searchParams.get('status');
    const rows = await prisma.vehicleTrip.findMany({
      where: {
        startedAt: { gte: from, lt: to },
        deletedAt: url.searchParams.get('deleted') === '1' ? { not: null } : null,
        ...(status === 'ACTIVE' || status === 'CLOSED' ? { status } : {})
      },
      orderBy: { startedAt: 'desc' }
    });
    let list = await toDtos(rows);
    const vehicleId = url.searchParams.get('vehicleId');
    if (vehicleId) list = list.filter((t) => t.vehicleId === vehicleId);
    // Haakeriist seoste registri järgi sõidu alguses
    const implementId = url.searchParams.get('implementId');
    if (implementId) list = list.filter((t) => t.implementId === implementId);
    if (url.searchParams.get('unknownPlace') === '1') list = list.filter((t) => !t.start.place || !t.end.place);
    // Kirja panemata põllusõit: vähemalt ühel põllureal pole kannet
    if (url.searchParams.get('unlinkedOnly') === '1') list = list.filter((t) => t.fields.some((f) => f.entries.length === 0));
    // Sõitude vahed: ainult sõidud, mille ees on hoiatus (kõik / kontrollimata)
    const gaps = url.searchParams.get('gaps');
    if (gaps === 'all') list = list.filter((t) => t.gapBefore);
    if (gaps === 'unreviewed') list = list.filter((t) => t.gapBefore && !t.gapBefore.reviewedAt);
    json(res, list);
    return true;
  }

  if (pathname === '/api/fleet/trips/import-status' && method === 'GET') {
    const states = await prisma.tripImportState.findMany({ include: { device: { select: { model: true, imei: true } } } });
    const last = states.map((s) => s.lastRunAt).filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0];
    json(res, {
      lastRunAt: last ? last.toISOString() : null,
      devices: states.map((s) => ({
        deviceId: s.deviceId, deviceLabel: deviceLabelOf(s.device),
        lastError: s.lastError, lastErrorAt: s.lastErrorAt ? s.lastErrorAt.toISOString() : null
      }))
    });
    return true;
  }

  const trackMatch = /^\/api\/fleet\/trips\/([^/]+)\/track$/.exec(pathname);
  if (trackMatch && method === 'GET') {
    const trip = await prisma.vehicleTrip.findUnique({ where: { id: trackMatch[1] }, include: { device: { select: { imei: true } } } });
    if (!trip || !trip.device.imei) { json(res, { error: 'Sõitu ei leitud' }, 404); return true; }
    const samples = await fetchTripSamples(trip.device.imei, new Date(trip.startedAt.getTime() - 1), trip.endedAt);
    const points = samples.filter((s) => s.ignition !== false).map((s) => [s.lat, s.lng]);
    json(res, { points, swaths: await buildSwaths(trip.id, samples) });
    return true;
  }

  // Vahe kontrolli märge: kontrollituks (kohustuslik selgitus) või tagasi kontrollimata; õigus sama mis märkusel
  const gapMatch = /^\/api\/fleet\/trips\/gaps\/([^/]+)$/.exec(pathname);
  if (gapMatch && method === 'PATCH') {
    const id = gapMatch[1];
    const existing = await prisma.vehicleTripGap.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { json(res, { error: 'Hoiatust ei leitud' }, 404); return true; }
    const body = await parseBody(req);
    const reviewed = body?.reviewed === true;
    const note = String(body?.note ?? '').trim().slice(0, MAX_NOTES);
    if (reviewed && !note) { json(res, { error: GAP_NOTE_REQUIRED }, 400); return true; }
    const saved = await prisma.vehicleTripGap.update({
      where: { id },
      data: reviewed
        ? { reviewedAt: new Date(), reviewedBy: sessionUserOf(req)?.username ?? null, reviewNote: note }
        : { reviewedAt: null, reviewedBy: null, reviewNote: null }
    });
    json(res, gapDto(saved));
    return true;
  }

  // Sõidu kustutamine (müra) ja taastamine: ainult admin; telemeetria toorandmeid ei puututa
  const restoreMatch = /^\/api\/fleet\/trips\/([^/]+)\/restore$/.exec(pathname);
  const delMatch = /^\/api\/fleet\/trips\/([^/]+)$/.exec(pathname);
  if ((restoreMatch && method === 'POST') || (delMatch && method === 'DELETE')) {
    const user = sessionUserOf(req);
    if (user?.isAdmin !== true) { json(res, { error: DELETE_FORBIDDEN }, 403); return true; }
    const id = (restoreMatch ?? delMatch)![1];
    const existing = await prisma.vehicleTrip.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { json(res, { error: 'Sõitu ei leitud' }, 404); return true; }
    if (restoreMatch) {
      const saved = await prisma.vehicleTrip.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
      await recomputeGapsAround(saved);
      json(res, (await toDtos([saved]))[0]);
      return true;
    }
    if (await prisma.workEntry.count({ where: { tripId: id } }) > 0) { json(res, { error: ENTRY_LINKED }, 409); return true; }
    const saved = await prisma.vehicleTrip.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: user.username } });
    await recomputeGapsAround(saved);
    json(res, (await toDtos([saved]))[0]);
    return true;
  }

  const idMatch = /^\/api\/fleet\/trips\/([^/]+)$/.exec(pathname);
  if (idMatch && (method === 'PATCH' || method === 'PUT')) {
    const id = idMatch[1];
    const existing = await prisma.vehicleTrip.findUnique({
      where: { id },
      include: { device: { select: { imei: true } }, fields: { select: { id: true, arriveAt: true, widthM: true, areaHa: true } } }
    });
    if (!existing) { json(res, { error: 'Sõitu ei leitud' }, 404); return true; }
    const body = (await parseBody(req)) ?? {};
    const data: { notes?: string | null; manualImplement?: boolean; implementId?: string | null; widthM?: number | null; areaHa?: number | null; computedAt?: Date } = {};
    if ('notes' in body) {
      data.notes = String(body.notes ?? '').trim().slice(0, MAX_NOTES) || null;
    }
    const updatingImpl = 'manualImplement' in body || 'implementId' in body || 'widthM' in body;
    let nextManual = existing.manualImplement;
    let nextImplId = existing.implementId;
    let nextWidthM = existing.widthM;
    if (updatingImpl) {
      if (body.manualImplement === false) {
        nextManual = false;
        nextImplId = null;
        nextWidthM = null;
      } else {
        nextManual = true;
        if ('implementId' in body) {
          const rawImpl = body.implementId;
          if (rawImpl == null || rawImpl === '') {
            nextImplId = null;
          } else {
            const impl = await prisma.implement.findUnique({ where: { id: String(rawImpl) }, select: { id: true } });
            if (!impl) { json(res, { error: IMPLEMENT_NOT_FOUND }, 400); return true; }
            nextImplId = impl.id;
          }
        }
        if ('widthM' in body) {
          const rawW = body.widthM;
          if (rawW == null || rawW === '') {
            nextWidthM = null;
          } else {
            const w = Number(rawW);
            if (!Number.isFinite(w) || w <= 0) { json(res, { error: WIDTH_INVALID }, 400); return true; }
            nextWidthM = Math.round(w * 100) / 100;
          }
        }
      }
      data.manualImplement = nextManual;
      data.implementId = nextImplId;
      data.widthM = nextWidthM;
    }

    let saved: TripRow;
    if (updatingImpl) {
      const resolve = nextManual ? null : await loadAssignmentResolver([existing.deviceId]);
      const implementAt: ImplementAt = nextManual
        ? () => ({ implementId: nextImplId, widthM: normWidth(nextWidthM) })
        : (at) => {
            const r = resolve!(existing.deviceId, at);
            return { implementId: r.implementId, widthM: r.widthM };
          };
      const fetchFn = deps.fetchSamples ?? (tsdb ? fetchTripSamples : null);
      const samples = fetchFn && existing.device.imei
        ? await fetchFn(existing.device.imei, new Date(existing.startedAt.getTime() - 1), existing.endedAt)
        : [];
      const now = new Date();
      if (samples.length > 0) {
        const places = await loadPlaces(existing.startedAt.getUTCFullYear());
        const fields = computeTripFields(samples, places, existing.fuelLiters, implementAt);
        data.areaHa = tripAreaHa(fields);
        data.computedAt = now;
        saved = await tenantTransaction(async (tx) => {
          await lockDevice(tx, existing.deviceId);
          const u = await tx.vehicleTrip.update({ where: { id }, data });
          await tx.vehicleTripField.deleteMany({ where: { tripId: id } });
          if (fields.length) await tx.vehicleTripField.createMany({ data: fields.map((f) => ({ ...f, tripId: id, computedAt: now })) });
          return u;
        }, { timeout: 60_000 });
      } else {
        // Telemeetria punkte pole (nt test või puhastatud tsdb): uuenda olemasolevate põlluridade haakeriist ja laius
        const updates = existing.fields.map((f) => {
          const cur = implementAt(f.arriveAt);
          const w = normWidth(cur.widthM);
          const areaHa = w == null ? null : w === f.widthM ? f.areaHa : null;
          return { id: f.id, implementId: cur.implementId, widthM: w, areaHa };
        });
        const nonNullAreas = updates.map((u) => u.areaHa).filter((a): a is number => a != null);
        data.areaHa = nonNullAreas.length ? Math.round(nonNullAreas.reduce((s, a) => s + a, 0) * 100) / 100 : null;
        saved = await tenantTransaction(async (tx) => {
          await lockDevice(tx, existing.deviceId);
          const u = await tx.vehicleTrip.update({ where: { id }, data });
          for (const f of updates) {
            await tx.vehicleTripField.update({ where: { id: f.id }, data: { implementId: f.implementId, widthM: f.widthM, areaHa: f.areaHa, computedAt: now } });
          }
          return u;
        }, { timeout: 60_000 });
      }
    } else {
      saved = await prisma.vehicleTrip.update({ where: { id }, data });
    }
    json(res, (await toDtos([saved]))[0]);
    return true;
  }

  return false;
}
