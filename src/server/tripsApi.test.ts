// src/server/tripsApi.test.ts — sõitude API live-andmebaasis ajutise ettevõttega.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, runAsTenant } from './db';
import { setSessionUserForTest } from './authGate';
import { handleTrips, buildSwaths } from './tripsApi';
import type { TripSample } from './tripSegments';

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
let activeTripId = '';
let vehicleId = '';
let deviceId = '';
let fsId = 0;
let entryId = '';
let fieldWorkId = '';

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
    tripId = (await prisma.vehicleTrip.create({ data: tripRow(d('2026-11-03T06:00:00Z'), d('2026-11-03T07:00:00Z'), { areaHa: 1.2 }) })).id;
    activeTripId = (await prisma.vehicleTrip.create({ data: tripRow(d('2026-11-04T06:00:00Z'), d('2026-11-04T06:30:00Z'), { status: 'ACTIVE' }) })).id;
    const field = await prisma.field.create({ data: { num: '7', name: 'Testpõld', fieldCode: 'TA-7' } });
    fsId = (await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 5, crop: 'test', geometry: {} } })).id;
    const wt = await prisma.workType.create({ data: { name: 'Testkünd', shortName: 'Künd', phase: 'PREPARATION' } });
    fieldWorkId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fsId, workTypeId: wt.id, phase: 'PREPARATION' } })).id;
    const plow = (await prisma.implement.create({ data: { name: 'Adra', type: 'PLOW', workingWidthM: 2.5 } })).id;
    await prisma.vehicleTripField.create({ data: {
      tripId, fieldSeasonId: fsId, arriveAt: d('2026-11-03T06:10:00Z'), leaveAt: d('2026-11-03T06:50:00Z'),
      activeMinutes: 38, areaHa: 1.2, implementId: plow, widthM: 2.5, fuelFieldL: 6, fuelSharedL: 7.5, computedAt: new Date()
    } });
    await prisma.vehicleTripField.create({ data: {
      tripId: activeTripId, fieldSeasonId: fsId, arriveAt: d('2026-11-04T06:05:00Z'), leaveAt: d('2026-11-04T06:25:00Z'),
      activeMinutes: 20, computedAt: new Date()
    } });
    entryId = (await prisma.workEntry.create({ data: { fieldWorkId, date: d('2026-11-03T00:00:00Z'), tripId } })).id;
    await prisma.tripImportState.create({ data: { deviceId, lastRunAt: d('2026-11-04T07:00:00Z'), lastError: 'tsdb maas', lastErrorAt: d('2026-11-04T07:00:00Z') } });
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.vehicleTrip.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.tripImportState.deleteMany({});
    await prisma.deviceAssignment.deleteMany({});
    await prisma.implementAssignment.deleteMany({});
    await prisma.implement.deleteMany({});
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

  it('seade haakeriistal: masin leitakse haakimise registrist sõidu alguse ajal', async () => {
    const ids = await run(async () => {
      const dev2 = (await prisma.telemetryDevice.create({ data: { imei: `39${String(process.pid).padStart(13, '0')}`.slice(0, 15), model: 'FMC650' } })).id;
      const impl = (await prisma.implement.create({ data: { name: 'Testhaake', type: 'PLOW' } })).id;
      const v2 = (await prisma.vehicle.create({ data: { name: 'Teine traktor', type: 'TRACTOR', model: 'Y' } })).id;
      await prisma.deviceAssignment.create({ data: { deviceId: dev2, implementId: impl, startedAt: d('2026-10-01T00:00:00Z') } });
      await prisma.implementAssignment.create({ data: { vehicleId, implementId: impl, startedAt: d('2026-12-01T00:00:00Z'), endedAt: d('2026-12-10T00:00:00Z') } });
      await prisma.implementAssignment.create({ data: { vehicleId: v2, implementId: impl, startedAt: d('2026-12-10T00:00:00Z') } });
      await prisma.vehicleTrip.create({ data: { ...tripRow(d('2026-12-05T06:00:00Z'), d('2026-12-05T07:00:00Z')), deviceId: dev2 } });
      await prisma.vehicleTrip.create({ data: { ...tripRow(d('2026-12-12T06:00:00Z'), d('2026-12-12T07:00:00Z')), deviceId: dev2 } });
      return { dev2, impl };
    });
    expect(ids.dev2).toBeTruthy();
    const r = await call('GET', '/api/fleet/trips?from=2026-12-01T00:00:00Z&to=2026-12-20T00:00:00Z');
    expect(r.json).toHaveLength(2);
    expect(r.json[0].vehicleName).toBe('Teine traktor'); // hilisem sõit
    expect(r.json[1].vehicleName).toBe('Testtraktor');
    expect(r.json[1].implementName).toBe('Testhaake');
    // haakeriista filter
    expect((await call('GET', `/api/fleet/trips?from=2026-12-01T00:00:00Z&to=2026-12-20T00:00:00Z&implementId=${ids.impl}`)).json).toHaveLength(2);
    expect((await call('GET', '/api/fleet/trips?from=2026-12-01T00:00:00Z&to=2026-12-20T00:00:00Z&implementId=muu')).json).toHaveLength(0);
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

  it('põllud: ha, haakeriist, kütus ja seotud kanne', async () => {
    const r = await call('GET', `/api/fleet/trips${Q}`);
    const closed = r.json.find((t: any) => t.id === tripId);
    expect(closed.areaHa).toBe(1.2);
    expect(closed.fields).toHaveLength(1);
    expect(closed.fields[0]).toMatchObject({
      fieldSeasonId: fsId, year: 2026, label: 'Nr 7 Testpõld', arriveAt: '2026-11-03T06:10:00.000Z', leaveAt: '2026-11-03T06:50:00.000Z',
      activeMinutes: 38, areaHa: 1.2, implementName: 'Adra', widthM: 2.5, fuelFieldL: 6, fuelSharedL: 7.5
    });
    expect(closed.fields[0].entries).toEqual([{ id: entryId, fieldWorkId, workTypeName: 'Künd', date: '2026-11-03' }]);
    const active = r.json.find((t: any) => t.id === activeTripId);
    expect(active.areaHa).toBeNull();
    expect(active.fields[0]).toMatchObject({ areaHa: null, implementName: null, entries: [] });
  });

  it('unlinkedOnly: ainult kandeta põllureaga sõidud', async () => {
    const r = await call('GET', `/api/fleet/trips${Q}&unlinkedOnly=1`);
    expect(r.json.map((t: any) => t.id)).toEqual([activeTripId]);
  });

  it('kanne teise hooaja (sama põld) tööl kuulub sõidu põllurea alla ega jää kirjapanemata', async () => {
    let seasonTripId = '';
    let seasonEntryId = '';
    let seasonWorkId = '';
    await run(async () => {
      const fs26 = await prisma.fieldSeason.findUniqueOrThrow({ where: { id: fsId } });
      const fs27 = await prisma.fieldSeason.create({ data: { fieldId: fs26.fieldId, year: 2027, areaHa: 5, crop: 'test', geometry: {} } });
      const wt = await prisma.workType.create({ data: { name: 'Sügiskülv2', shortName: 'SK', phase: 'SOWING' } });
      seasonWorkId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fs27.id, workTypeId: wt.id, phase: 'SOWING' } })).id;
      seasonTripId = (await prisma.vehicleTrip.create({ data: tripRow(d('2026-11-02T06:00:00Z'), d('2026-11-02T07:00:00Z')) })).id;
      await prisma.vehicleTripField.create({ data: {
        tripId: seasonTripId, fieldSeasonId: fsId, arriveAt: d('2026-11-02T06:10:00Z'), leaveAt: d('2026-11-02T06:50:00Z'),
        activeMinutes: 30, computedAt: new Date()
      } });
      seasonEntryId = (await prisma.workEntry.create({ data: { fieldWorkId: seasonWorkId, date: d('2026-11-02T00:00:00Z'), tripId: seasonTripId } })).id;
    });
    const r = await call('GET', `/api/fleet/trips${Q}`);
    const t = r.json.find((x: any) => x.id === seasonTripId);
    expect(t.fields[0].entries.map((e: any) => e.id)).toEqual([seasonEntryId]);
    const u = await call('GET', `/api/fleet/trips${Q}&unlinkedOnly=1`);
    expect(u.json.map((x: any) => x.id)).not.toContain(seasonTripId);
  });

  it('põllulõigud kaardile: ainult read laiusega, lõigud katkevad põllult väljas', async () => {
    const sq = (x0: number, x1: number): number[][] => [[x0, 58], [x1, 58], [x1, 58.01], [x0, 58.01], [x0, 58]];
    const smp = (m: number, lng: number, lat = 58.005): TripSample => ({
      time: new Date(Date.UTC(2026, 10, 3, 6, m)), lat, lng, ignition: true, speedKmh: 8,
      fuelUsedL: null, fuelRateLph: null, fuelLevelPct: null, engineHours: null
    });
    await run(async () => {
      const mk = async (num: string, x0: number, x1: number) => {
        const f = await prisma.field.create({ data: { num, name: `Lõik ${num}`, fieldCode: `TA-${num}` } });
        return (await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2026, areaHa: 1, crop: 'test', geometry: { type: 'Polygon', coordinates: [sq(x0, x1)] } } })).id;
      };
      const withW = await mk('81', 26, 26.01);
      const noW = await mk('82', 26.1, 26.11);
      const base = { tripId, arriveAt: d('2026-11-03T06:00:00Z'), leaveAt: d('2026-11-03T06:30:00Z'), activeMinutes: 10, computedAt: new Date() };
      await prisma.vehicleTripField.create({ data: { ...base, fieldSeasonId: withW, widthM: 6 } });
      await prisma.vehicleTripField.create({ data: { ...base, fieldSeasonId: noW, widthM: null } });
      const samples = [
        smp(0, 26.002), smp(1, 26.004), smp(2, 26.006), // sees
        smp(3, 26.05), // väljas
        smp(4, 26.002), smp(5, 26.004), // sees
        smp(6, 26.006), // üksik punkt pärast 1 min — jätkab eelmist lõiku
        smp(30, 26.002), // üksik punkt pärast pikka vahet — langeb välja
        smp(31, 26.105), smp(32, 26.106) // põld ilma laiuseta
      ];
      const sw = await buildSwaths(tripId, samples);
      expect(sw).toHaveLength(1);
      expect(sw[0]).toMatchObject({ fieldSeasonId: withW, widthM: 6 });
      expect(sw[0].lines.map((l) => l.length)).toEqual([3, 3]);
    });
  });

  it('muud teed ei kuulu siia', async () => {
    expect((await call('GET', '/api/fleet/vehicles')).handled).toBe(false);
  });
});
