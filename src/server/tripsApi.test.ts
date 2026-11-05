// src/server/tripsApi.test.ts — sõitude API live-andmebaasis ajutise ettevõttega.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, runAsTenant } from './db';
import { setSessionUserForTest } from './authGate';
import { handleTrips } from './tripsApi';

const T = `test-tenant-tripsapi-${process.pid}`;
const T2 = `test-tenant-tripsapi2-${process.pid}`;
const IMEI = `37${String(process.pid).padStart(13, '0')}`.slice(0, 15);
const run = <R>(fn: () => Promise<R>, t = T): Promise<R> => runAsTenant(t, async () => await fn());
const USER = (tenantId: string) => ({
  id: `tripsapi-u-${tenantId}`, username: `tripsapi-${tenantId}`, displayName: null, passwordHash: '', isActive: true,
  isAdmin: false, isFinanceManager: false, mustChangePassword: false, tenantId
});

async function call(method: string, path: string, body?: unknown, tenant = T) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Object.assign(Readable.from(raw ? [Buffer.from(raw)] : []), {
    method, url: path, headers: { host: 'localhost', 'content-type': 'application/json' }, socket: {}
  }) as unknown as IncomingMessage;
  setSessionUserForTest(req, USER(tenant));
  const out = { status: 200, body: '' };
  const res = {
    statusCode: 200,
    setHeader() {}, writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  const url = new URL(path, 'http://localhost');
  const handled = await run(() => handleTrips(req, res, url.pathname, method, url), tenant);
  return { handled, status: out.status, json: out.body ? JSON.parse(out.body) : null };
}

const d = (s: string) => new Date(s);
let tripId = '';
let vehicleId = '';
let deviceId = '';

const tripRow = (startedAt: Date, endedAt: Date, extra: Record<string, unknown> = {}) => ({
  deviceId, startedAt, endedAt, status: 'CLOSED' as const,
  startLat: 58, startLng: 26, startPlace: { place: { id: 'p1', kind: 'POI', label: 'Töökoda' } },
  endLat: 58.01, endLng: 26, endPlace: { place: null },
  visits: [], distanceKm: 1.5, movingMinutes: 10, idleMinutes: 2, pauseCount: 0, pauseMinutes: 0,
  maxSpeedKmh: 20, avgSpeedKmh: 9, fuelLiters: null, fuelLevelStartPct: null, fuelLevelEndPct: null,
  engineHoursStart: null, engineHoursEnd: null, minLat: 58, minLng: 26, maxLat: 58.01, maxLng: 26,
  pointCount: 12, computedAt: new Date(), ...extra
});

beforeAll(async () => {
  for (const t of [T, T2]) await authDb().tenant.create({ data: { id: t, name: `Test ${t}` } });
  await run(async () => {
    deviceId = (await prisma.telemetryDevice.create({ data: { imei: IMEI, model: 'FMC650' } })).id;
    vehicleId = (await prisma.vehicle.create({ data: { name: 'Testtraktor', type: 'TRACTOR', model: 'X' } })).id;
    await prisma.deviceAssignment.create({ data: { deviceId, vehicleId, startedAt: d('2026-10-01T00:00:00Z') } });
    tripId = (await prisma.vehicleTrip.create({ data: tripRow(d('2026-11-03T06:00:00Z'), d('2026-11-03T07:00:00Z')) })).id;
    await prisma.vehicleTrip.create({ data: tripRow(d('2026-11-04T06:00:00Z'), d('2026-11-04T06:30:00Z'), { status: 'ACTIVE' }) });
    await prisma.tripImportState.create({ data: { deviceId, lastRunAt: d('2026-11-04T07:00:00Z'), lastError: 'tsdb maas', lastErrorAt: d('2026-11-04T07:00:00Z') } });
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.vehicleTrip.deleteMany({});
    await prisma.tripImportState.deleteMany({});
    await prisma.deviceAssignment.deleteMany({});
    await prisma.telemetryDevice.deleteMany({});
    await prisma.vehicle.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: { in: [T, T2] } } });
});

const Q = '?from=2026-11-01T00:00:00Z&to=2026-11-05T00:00:00Z';

describe('tripsApi', () => {
  it('loend: uuemad ees, masin seoste registrist', async () => {
    const r = await call('GET', `/api/fleet/trips${Q}`);
    expect(r.status).toBe(200);
    expect(r.json).toHaveLength(2);
    expect(r.json[0].status).toBe('ACTIVE');
    expect(r.json[1].vehicleName).toBe('Testtraktor');
    expect(r.json[1].start.place.label).toBe('Töökoda');
  });

  it('filtrid: olek, masin, tundmatu koht', async () => {
    expect((await call('GET', `/api/fleet/trips${Q}&status=CLOSED`)).json).toHaveLength(1);
    expect((await call('GET', `/api/fleet/trips${Q}&vehicleId=${vehicleId}`)).json).toHaveLength(2);
    expect((await call('GET', `/api/fleet/trips${Q}&vehicleId=muu`)).json).toHaveLength(0);
    expect((await call('GET', `/api/fleet/trips${Q}&unknownPlace=1`)).json).toHaveLength(2); // lõpp tundmatu
  });

  it('teise ettevõtte sõidud pole nähtavad', async () => {
    expect((await call('GET', `/api/fleet/trips${Q}`, undefined, T2)).json).toHaveLength(0);
    expect((await call('PATCH', `/api/fleet/trips/${tripId}`, { notes: 'x' }, T2)).status).toBe(404);
  });

  it('PATCH muudab ainult märkust', async () => {
    const r = await call('PATCH', `/api/fleet/trips/${tripId}`, { notes: 'Tankimine', distanceKm: 999 });
    expect(r.status).toBe(200);
    expect(r.json.notes).toBe('Tankimine');
    expect(r.json.distanceKm).toBe(1.5);
  });

  it('impordi olek näitab seadme viga', async () => {
    const r = await call('GET', '/api/fleet/trips/import-status');
    expect(r.json.lastRunAt).toBe('2026-11-04T07:00:00.000Z');
    expect(r.json.devices[0].lastError).toBe('tsdb maas');
  });

  it('muud teed ei kuulu siia', async () => {
    expect((await call('GET', '/api/fleet/vehicles')).handled).toBe(false);
  });
});
