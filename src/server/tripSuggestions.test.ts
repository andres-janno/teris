// src/server/tripSuggestions.test.ts — kande soovitused sõitude registrist ja kande sõidu seos (live-andmebaas, ajutine ettevõte).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, runAsTenant } from './db';
import { setSessionUserForTest } from './authGate';
import { handleFieldWorks } from './fieldWorks';
import { TRIP_NOT_ON_FIELD, TRIP_TAKEN } from './tripSuggestions';

const T = `test-tenant-tripsug-${process.pid}`;
const IMEI = `38${String(process.pid).padStart(13, '0')}`.slice(0, 15);
const run = <R>(fn: () => PromiseLike<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(s);

const ADMIN = {
  id: `tripsug-u-${process.pid}`, username: `tripsug-${process.pid}`, displayName: null, passwordHash: '', isActive: true,
  isAdmin: true, isFinanceManager: true, mustChangePassword: false, tenantId: T
};

async function call(method: string, path: string, body?: unknown) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Object.assign(Readable.from(raw ? [Buffer.from(raw)] : []), {
    method, url: path, headers: { host: 'localhost', 'content-type': 'application/json' }, socket: {}
  }) as unknown as IncomingMessage;
  setSessionUserForTest(req, ADMIN);
  const out = { status: 200, body: '' };
  const res = {
    statusCode: 200,
    setHeader() {}, writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  const url = new URL(path, 'http://localhost');
  await run(() => handleFieldWorks(req, res, url.pathname, method, url));
  return { status: out.status, json: out.body ? JSON.parse(out.body) : null };
}

const s = { fsA: 0, fsB: 0, fwA: '', fwA2: '', fwB: '', trip: '', trip2: '', vehicle: '', implement: '' };

const tripRow = (deviceId: string, startedAt: Date, endedAt: Date) => ({
  deviceId, startedAt, endedAt, status: 'CLOSED' as const,
  startLat: 58, startLng: 26, startPlace: { place: null }, endLat: 58.01, endLng: 26, endPlace: { place: null },
  visits: [], distanceKm: 5, movingMinutes: 100, idleMinutes: 10, pauseCount: 0, pauseMinutes: 0,
  maxSpeedKmh: 20, avgSpeedKmh: 9, fuelLiters: 30, fuelLevelStartPct: null, fuelLevelEndPct: null,
  engineHoursStart: null, engineHoursEnd: null, minLat: 58, minLng: 26, maxLat: 58.01, maxLng: 26,
  pointCount: 120, computedAt: new Date()
});

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test sõidu soovitused' } });
  await authDb().user.create({ data: { id: ADMIN.id, username: ADMIN.username, passwordHash: '', isAdmin: true, isFinanceManager: true, tenantId: T } });
  await run(async () => {
    const device = (await prisma.telemetryDevice.create({ data: { imei: IMEI, model: 'FMC650' } })).id;
    s.vehicle = (await prisma.vehicle.create({ data: { name: 'Soovitustraktor', type: 'TRACTOR', model: 'X' } })).id;
    s.implement = (await prisma.implement.create({ data: { name: 'Külvik 6 m', type: 'SEEDER', workingWidthM: 6 } })).id;
    await prisma.deviceAssignment.create({ data: { deviceId: device, vehicleId: s.vehicle, startedAt: d('2026-10-01T00:00:00Z') } });
    await prisma.implementAssignment.create({ data: { vehicleId: s.vehicle, implementId: s.implement, startedAt: d('2026-10-01T00:00:00Z') } });
    const fieldA = await prisma.field.create({ data: { num: '1', name: 'Kodu', fieldCode: 'S-1' } });
    const fieldB = await prisma.field.create({ data: { num: '2', name: 'Taga', fieldCode: 'S-2' } });
    s.fsA = (await prisma.fieldSeason.create({ data: { fieldId: fieldA.id, year: 2026, areaHa: 10, crop: 'test', geometry: {} } })).id;
    s.fsB = (await prisma.fieldSeason.create({ data: { fieldId: fieldB.id, year: 2026, areaHa: 10, crop: 'test', geometry: {} } })).id;
    const sowing = await prisma.workType.create({ data: { name: 'Testkülv', phase: 'SOWING' } });
    const harrow = await prisma.workType.create({ data: { name: 'Testäestus', phase: 'PREPARATION' } });
    s.fwA = (await prisma.fieldWork.create({ data: { fieldSeasonId: s.fsA, workTypeId: sowing.id, phase: 'SOWING' } })).id;
    s.fwA2 = (await prisma.fieldWork.create({ data: { fieldSeasonId: s.fsA, workTypeId: harrow.id, phase: 'PREPARATION' } })).id;
    s.fwB = (await prisma.fieldWork.create({ data: { fieldSeasonId: s.fsB, workTypeId: sowing.id, phase: 'SOWING' } })).id;
    // 10.10.2026 (EEST, UTC+3): sõit 09:00–12:00, põld A 09:30–10:30, põld B 10:45–11:45
    s.trip = (await prisma.vehicleTrip.create({ data: tripRow(device, d('2026-10-10T06:00:00Z'), d('2026-10-10T09:00:00Z')) })).id;
    s.trip2 = (await prisma.vehicleTrip.create({ data: tripRow(device, d('2026-10-10T10:00:00Z'), d('2026-10-10T11:00:00Z')) })).id;
    const now = new Date();
    await prisma.vehicleTripField.create({ data: {
      tripId: s.trip, fieldSeasonId: s.fsA, arriveAt: d('2026-10-10T06:30:00Z'), leaveAt: d('2026-10-10T07:30:00Z'),
      activeMinutes: 55, areaHa: 3.5, implementId: s.implement, widthM: 6, fuelFieldL: 15, fuelSharedL: 20, computedAt: now
    } });
    await prisma.vehicleTripField.create({ data: {
      tripId: s.trip, fieldSeasonId: s.fsB, arriveAt: d('2026-10-10T07:45:00Z'), leaveAt: d('2026-10-10T08:45:00Z'),
      activeMinutes: 50, areaHa: 2, implementId: s.implement, widthM: 6, fuelFieldL: 8, fuelSharedL: 10, computedAt: now
    } });
    await prisma.vehicleTripField.create({ data: {
      tripId: s.trip2, fieldSeasonId: s.fsB, arriveAt: d('2026-10-10T10:10:00Z'), leaveAt: d('2026-10-10T10:50:00Z'),
      activeMinutes: 40, computedAt: now
    } });
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.vehicleTrip.deleteMany({});
    await prisma.implementAssignment.deleteMany({});
    await prisma.deviceAssignment.deleteMany({});
    await prisma.implement.deleteMany({});
    await prisma.vehicle.deleteMany({});
    await prisma.telemetryDevice.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.stockDocument.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().user.deleteMany({ where: { id: ADMIN.id } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().tenant.delete({ where: { id: T } });
});

const SUG = (fs: number, extra = '') => `/api/field-works/telemetry-suggestions?fieldSeasonId=${fs}&date=2026-10-10${extra}`;

describe('kande soovitused sõitude registrist', () => {
  it('põld A: sõidu algus; lõpp põllult lahkumisel (järgmine põld); aeg, ha ja kütus registrist', async () => {
    const r = await call('GET', SUG(s.fsA));
    expect(r.status).toBe(200);
    expect(r.json).toHaveLength(1);
    expect(r.json[0]).toMatchObject({
      id: s.trip, tripId: s.trip, vehicleId: s.vehicle, vehicleName: 'Soovitustraktor',
      implementId: s.implement, implementName: 'Külvik 6 m',
      startTime: '09:00', endTime: '10:30', fieldStartTime: '09:30', fieldEndTime: '10:30',
      durationHours: 0.92, workedAreaHa: 3.5, fuelLiters: 20, pointCount: 120, linked: false
    });
    expect(r.json[0].route.start.time).toBe('2026-10-10T06:00:00.000Z');
    expect(r.json[0].route.end.time).toBe('2026-10-10T09:00:00.000Z');
  });

  it('põld B: algus põllule jõudmisel (enne käis teisel põllul), lõpp sõidu lõpus; laiuseta ha tühi', async () => {
    const r = await call('GET', SUG(s.fsB));
    expect(r.json.find((x: any) => x.tripId === s.trip)).toMatchObject({ startTime: '10:45', endTime: '12:00' });
    expect(r.json.find((x: any) => x.tripId === s.trip2)).toMatchObject({ workedAreaHa: null, fuelLiters: null });
  });

  it('teisel päeval soovitusi pole', async () => {
    const r = await call('GET', `/api/field-works/telemetry-suggestions?fieldSeasonId=${s.fsA}&date=2026-10-11`);
    expect(r.json).toEqual([]);
  });
});

describe('kande sõidu seos', () => {
  let entryA = '';

  it('kanne seotakse sõiduga; sama hooaja teisele kandele sõitu ei pakuta, muudetavale on see seotud', async () => {
    const r = await call('POST', '/api/work-entries', { fieldWorkId: s.fwA, date: '2026-10-10', tripId: s.trip });
    expect(r.status).toBe(200);
    expect(r.json.tripId).toBe(s.trip);
    entryA = r.json.id;
    expect((await call('GET', SUG(s.fsA))).json).toHaveLength(0);
    const own = await call('GET', SUG(s.fsA, `&excludeEntryId=${entryA}`));
    expect(own.json).toHaveLength(1);
    expect(own.json[0].linked).toBe(true);
  });

  it('sama hooaja teine kanne samale sõidule → 400', async () => {
    const r = await call('POST', '/api/work-entries', { fieldWorkId: s.fwA2, date: '2026-10-10', tripId: s.trip });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe(TRIP_TAKEN);
  });

  it('teise põllu kanne samale sõidule on lubatud', async () => {
    const r = await call('POST', '/api/work-entries', { fieldWorkId: s.fwB, date: '2026-10-10', tripId: s.trip });
    expect(r.status).toBe(200);
    expect(r.json.tripId).toBe(s.trip);
  });

  it('sõit, mis põllul ei käinud → 400', async () => {
    const r = await call('POST', '/api/work-entries', { fieldWorkId: s.fwA2, date: '2026-10-10', tripId: s.trip2 });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe(TRIP_NOT_ON_FIELD);
  });

  it('muutmine ilma tripId võtmeta jätab seose; tripId null eemaldab', async () => {
    const keep = await call('PUT', `/api/work-entries/${entryA}`, { date: '2026-10-10', notes: 'muudetud' });
    expect(keep.status).toBe(200);
    expect(keep.json.tripId).toBe(s.trip);
    const r = await call('PUT', `/api/work-entries/${entryA}`, { date: '2026-10-10', tripId: null });
    expect(r.status).toBe(200);
    expect(r.json.tripId).toBeNull();
    expect((await call('GET', SUG(s.fsA))).json).toHaveLength(1);
  });
});
