// src/server/tripsApi.ts — sõitude register (HTTP): loend, impordi olek, sõidu rada, märkuse muutmine.
// Sõidud tulevad taustaimpordist (tripImport.ts); masin/haakeriist liidetakse lugemisel seoste registrist sõidu alguse ajal.
// Sõidu põllud (ha, kütus) ja nendega seotud kanded: vehicle_trip_fields + work_entries.tripId.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma } from './db.ts';
import { json, parseBody } from './http.ts';
import { fetchTripSamples } from './telemetryAccess.ts';
import { loadAssignmentResolver } from './tripAssignments.ts';
import { workTypeDisplayName } from '../services/workTypeName.ts';

const DEFAULT_DAYS = 7;
const MAX_NOTES = 1000;

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

const parseIso = (v: string | null): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const deviceLabelOf = (d: { model: string; imei: string | null }) => (d.imei ? `${d.model} (${d.imei.slice(-4)})` : d.model);

async function resolveTargets(trips: TripRow[]) {
  const deviceIds = [...new Set(trips.map((t) => t.deviceId))];
  const [devices, resolve] = await Promise.all([
    prisma.telemetryDevice.findMany({ where: { id: { in: deviceIds } }, select: { id: true, model: true, imei: true } }),
    loadAssignmentResolver(deviceIds)
  ]);
  return (t: TripRow) => {
    const dev = devices.find((d) => d.id === t.deviceId);
    const r = resolve(t.deviceId, t.startedAt);
    return {
      deviceLabel: dev ? deviceLabelOf(dev) : t.deviceId,
      vehicleId: r.vehicleId,
      vehicleName: r.vehicleName,
      implementId: r.implementId,
      implementName: r.implementName
    };
  };
}

// Sõitude põllured koos põllu nime, haakeriista nime ja selle põllu kannetega (kanne = sama sõit + sama põld; sügistööd on järgmise aasta hooajal)
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

function toDto(t: TripRow, target: ReturnType<Awaited<ReturnType<typeof resolveTargets>>>, fields: TripFieldDto[]) {
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
    fields
  };
}

export async function handleTrips(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL): Promise<boolean> {
  if (pathname !== '/api/fleet/trips' && !pathname.startsWith('/api/fleet/trips/')) return false;

  if (pathname === '/api/fleet/trips' && method === 'GET') {
    const to = parseIso(url.searchParams.get('to')) ?? new Date();
    const from = parseIso(url.searchParams.get('from')) ?? new Date(to.getTime() - DEFAULT_DAYS * 86_400_000);
    const status = url.searchParams.get('status');
    const rows = await prisma.vehicleTrip.findMany({
      where: {
        startedAt: { gte: from, lt: to },
        ...(status === 'ACTIVE' || status === 'CLOSED' ? { status } : {})
      },
      orderBy: { startedAt: 'desc' }
    });
    const [target, fieldsOf] = await Promise.all([resolveTargets(rows), loadTripFields(rows)]);
    let list = rows.map((t) => toDto(t, target(t), fieldsOf(t.id)));
    const vehicleId = url.searchParams.get('vehicleId');
    if (vehicleId) list = list.filter((t) => t.vehicleId === vehicleId);
    // Haakeriist seoste registri järgi sõidu alguses
    const implementId = url.searchParams.get('implementId');
    if (implementId) list = list.filter((t) => t.implementId === implementId);
    if (url.searchParams.get('unknownPlace') === '1') list = list.filter((t) => !t.start.place || !t.end.place);
    // Kirja panemata põllusõit: vähemalt ühel põllureal pole kannet
    if (url.searchParams.get('unlinkedOnly') === '1') list = list.filter((t) => t.fields.some((f) => f.entries.length === 0));
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
    json(res, { points: samples.filter((s) => s.ignition !== false).map((s) => [s.lat, s.lng]) });
    return true;
  }

  const idMatch = /^\/api\/fleet\/trips\/([^/]+)$/.exec(pathname);
  if (idMatch && (method === 'PATCH' || method === 'PUT')) {
    const id = idMatch[1];
    const existing = await prisma.vehicleTrip.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { json(res, { error: 'Sõitu ei leitud' }, 404); return true; }
    const body = await parseBody(req);
    const notes = String(body?.notes ?? '').trim().slice(0, MAX_NOTES) || null;
    const saved = await prisma.vehicleTrip.update({ where: { id }, data: { notes } });
    const [target, fieldsOf] = await Promise.all([resolveTargets([saved]), loadTripFields([saved])]);
    json(res, toDto(saved, target(saved), fieldsOf(saved.id)));
    return true;
  }

  return false;
}
