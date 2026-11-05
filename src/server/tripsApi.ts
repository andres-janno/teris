// src/server/tripsApi.ts — sõitude register (HTTP): loend, impordi olek, sõidu rada, märkuse muutmine.
// Sõidud tulevad taustaimpordist (tripImport.ts); masin/haakeriist liidetakse lugemisel seoste registrist sõidu alguse ajal.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma } from './db.ts';
import { json, parseBody } from './http.ts';
import { fetchTripSamples } from './telemetryAccess.ts';

const DEFAULT_DAYS = 7;
const MAX_NOTES = 1000;

type TripRow = Awaited<ReturnType<typeof prisma.vehicleTrip.findMany>>[number];

const parseIso = (v: string | null): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const deviceLabelOf = (d: { model: string; imei: string | null }) => (d.imei ? `${d.model} (${d.imei.slice(-4)})` : d.model);

async function resolveTargets(trips: TripRow[]) {
  const deviceIds = [...new Set(trips.map((t) => t.deviceId))];
  const [devices, assignments] = await Promise.all([
    prisma.telemetryDevice.findMany({ where: { id: { in: deviceIds } }, select: { id: true, model: true, imei: true } }),
    prisma.deviceAssignment.findMany({
      where: { deviceId: { in: deviceIds } },
      include: { vehicle: { select: { id: true, name: true } }, implement: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' }
    })
  ]);
  const vehicleIds = [...new Set(assignments.map((a) => a.vehicleId).filter((x): x is string => !!x))];
  const implAssignments = vehicleIds.length
    ? await prisma.implementAssignment.findMany({
        where: { vehicleId: { in: vehicleIds } },
        include: { implement: { select: { id: true, name: true } } },
        orderBy: { startedAt: 'desc' }
      })
    : [];
  const covers = (a: { startedAt: Date; endedAt: Date | null }, t: Date) => a.startedAt <= t && (!a.endedAt || a.endedAt >= t);
  return (t: TripRow) => {
    const dev = devices.find((d) => d.id === t.deviceId);
    const a = assignments.find((x) => x.deviceId === t.deviceId && covers(x, t.startedAt));
    let implement = a?.implement ?? null;
    if (!implement && a?.vehicleId) {
      implement = implAssignments.find((x) => x.vehicleId === a.vehicleId && covers(x, t.startedAt))?.implement ?? null;
    }
    return {
      deviceLabel: dev ? deviceLabelOf(dev) : t.deviceId,
      vehicleId: a?.vehicle?.id ?? null,
      vehicleName: a?.vehicle?.name ?? null,
      implementId: implement?.id ?? null,
      implementName: implement?.name ?? null
    };
  };
}

function toDto(t: TripRow, target: ReturnType<Awaited<ReturnType<typeof resolveTargets>>>) {
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
    pointCount: t.pointCount, notes: t.notes
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
    const target = await resolveTargets(rows);
    let list = rows.map((t) => toDto(t, target(t)));
    const vehicleId = url.searchParams.get('vehicleId');
    if (vehicleId) list = list.filter((t) => t.vehicleId === vehicleId);
    if (url.searchParams.get('unknownPlace') === '1') list = list.filter((t) => !t.start.place || !t.end.place);
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
    const target = await resolveTargets([saved]);
    json(res, toDto(saved, target(saved)));
    return true;
  }

  return false;
}
