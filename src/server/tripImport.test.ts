// src/server/tripImport.test.ts — sõitude import live-andmebaasis ajutise ettevõttega; telemeetria on võltsitud.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma, authDb, runAsTenant } from './db';
import { importDeviceTrips, refreshTripPlaces, importTenantTrips, type ImportDeps } from './tripImport';
import type { TripSample } from './tripSegments';
import type { Place } from './tripRoute';

const T = `test-tenant-trips-${process.pid}`;
const T2 = `test-tenant-trips2-${process.pid}`;
const IMEI = `35${String(process.pid).padStart(13, '0')}`.slice(0, 15);
const IMEI_BAD = `36${String(process.pid).padStart(13, '0')}`.slice(0, 15);
// async + await: Prisma päringud on laisad ja käivituksid muidu väljaspool ettevõtte konteksti
const run = <R>(fn: () => PromiseLike<R>, t = T): Promise<R> => runAsTenant(t, async () => await fn());

const BASE = new Date('2026-10-22T05:00:00Z').getTime();
const at = (m: number) => new Date(BASE + m * 60_000);
const pt = (m: number, on = true, lat = 58.1 + m * 0.0001): TripSample => ({
  time: at(m), lat, lng: 26.1, ignition: on, speedKmh: 15, fuelUsedL: null, fuelRateLph: null, fuelLevelPct: null, engineHours: null
});
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => pt(a + i));

let samples: TripSample[] = [];
let places: Place[] = [];
let nowMin = 0;
let failImei: string | null = null;
const deps: ImportDeps = {
  now: () => at(nowMin),
  fetchSamples: async (imei, from, to) => {
    if (imei === failImei) throw new Error('tsdb maas');
    return samples.filter((s) => s.time > from && s.time <= to);
  },
  loadPlaces: async () => places
};

let deviceId = '';
let badDeviceId = '';

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test sõidud' } });
  await authDb().tenant.create({ data: { id: T2, name: 'Test sõidud 2' } });
  await run(async () => {
    deviceId = (await prisma.telemetryDevice.create({ data: { imei: IMEI, model: 'FMC650' } })).id;
    badDeviceId = (await prisma.telemetryDevice.create({ data: { imei: IMEI_BAD, model: 'FMC650' } })).id;
    await prisma.deviceOwnership.create({ data: { kind: 'IMEI', identifier: IMEI, deviceId, validFrom: at(-60) } });
    await prisma.deviceOwnership.create({ data: { kind: 'IMEI', identifier: IMEI_BAD, deviceId: badDeviceId, validFrom: at(-60) } });
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.vehicleTrip.deleteMany({});
    await prisma.tripImportState.deleteMany({});
    await prisma.deviceOwnership.deleteMany({});
    await prisma.telemetryDevice.deleteMany({});
    await prisma.pointOfInterest.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: { in: [T, T2] } } });
});

beforeEach(async () => {
  samples = [];
  places = [];
  failImei = null;
  await run(async () => {
    await prisma.vehicleTrip.deleteMany({});
    await prisma.tripImportState.deleteMany({});
  });
});

const trips = () => run(() => prisma.vehicleTrip.findMany({ where: { deviceId }, orderBy: { startedAt: 'asc' } }));
const dev = { id: '', imei: IMEI };
const device = () => ({ ...dev, id: deviceId });

describe('importDeviceTrips', () => {
  it('loob sõidud ja korduv käik ei tekita duplikaate', async () => {
    samples = [...range(0, 30), pt(31, false), ...range(60, 90), pt(91, false)];
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    await run(() => importDeviceTrips(device(), deps));
    const t = await trips();
    expect(t).toHaveLength(2);
    expect(t[0].startedAt).toEqual(at(0));
    expect(t[1].endedAt).toEqual(at(90));
    expect(t.every((x) => x.status === 'CLOSED')).toBe(true);
  });

  it('üheaegsed impordid sama seadme kohta ei tekita duplikaate', async () => {
    samples = [...range(0, 30), pt(31, false), ...range(60, 90), pt(91, false)];
    nowMin = 120;
    await Promise.all([
      run(() => importDeviceTrips(device(), deps)),
      run(() => importDeviceTrips(device(), deps))
    ]);
    const t = await trips();
    expect(t).toHaveLength(2);
    expect(new Set(t.map((x) => x.startedAt.getTime())).size).toBe(2);
  });

  it('pooleli sõit on ACTIVE ja kasvab järgmisel käigul', async () => {
    samples = range(0, 20);
    nowMin = 25;
    await run(() => importDeviceTrips(device(), deps));
    let t = await trips();
    expect(t).toHaveLength(1);
    expect(t[0].status).toBe('ACTIVE');
    const id = t[0].id;
    samples = [...range(0, 40), pt(41, false)];
    nowMin = 70;
    await run(() => importDeviceTrips(device(), deps));
    t = await trips();
    expect(t).toHaveLength(1);
    expect(t[0].id).toBe(id);
    expect(t[0].status).toBe('CLOSED');
    expect(t[0].endedAt).toEqual(at(40));
  });

  it('hilinenud punktid liidavad kaks sõitu; id ja märkus säilivad', async () => {
    samples = [...range(0, 10), ...range(40, 50)];
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    let t = await trips();
    expect(t).toHaveLength(2);
    await run(() => prisma.vehicleTrip.update({ where: { id: t[0].id }, data: { notes: 'test' } }));
    samples = range(0, 50); // auk täitus
    await run(() => importDeviceTrips(device(), deps));
    const merged = await trips();
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(t[0].id);
    expect(merged[0].notes).toBe('test');
  });

  it('lõplikku sõitu (> 24 h) ei puututa', async () => {
    samples = range(0, 30);
    nowMin = 30 * 60; // 30 h hiljem
    await run(() => importDeviceTrips(device(), deps));
    const before = await trips();
    expect(before).toHaveLength(1);
    const st = await run(() => prisma.tripImportState.findUnique({ where: { deviceId } }));
    expect(st!.finalizedUntil!.getTime()).toBeGreaterThanOrEqual(at(30).getTime());
    samples = range(0, 35); // hilinenud punktid juba lõplikule ajale
    nowMin = 31 * 60;
    await run(() => importDeviceTrips(device(), deps));
    const after = await trips();
    expect(after[0].endedAt).toEqual(at(30));
  });

  it('ajalugu töödeldakse päevahaaval kuni tänaseni', async () => {
    samples = [...range(0, 20), ...range(3 * 1440, 3 * 1440 + 20), ...range(6 * 1440, 6 * 1440 + 20)];
    nowMin = 6 * 1440 + 120;
    await run(() => importDeviceTrips(device(), deps));
    expect(await trips()).toHaveLength(3);
  });

  it('3 päeva kestev sõit ei jää tsüklisse; üks lõppenud sõit', async () => {
    samples = [...range(0, 3 * 1440), pt(3 * 1440 + 1, false)];
    nowMin = 4 * 1440 + 120;
    await run(() => importDeviceTrips(device(), deps));
    const t = await trips();
    expect(t).toHaveLength(1);
    expect(t[0].startedAt).toEqual(at(0));
    expect(t[0].endedAt).toEqual(at(3 * 1440));
    expect(t[0].status).toBe('CLOSED');
  }, 30_000);

  it('üle 2 päeva kestev pooleli sõit jõuab tänaseni ja jääb ACTIVE', async () => {
    samples = range(0, 3 * 1440);
    nowMin = 3 * 1440 + 5;
    await run(() => importDeviceTrips(device(), deps));
    const t = await trips();
    expect(t).toHaveLength(1);
    expect(t[0].startedAt).toEqual(at(0));
    expect(t[0].status).toBe('ACTIVE');
  }, 30_000);

  it('mõõdikud ja kohad salvestuvad', async () => {
    places = [{ id: 'poi-x', kind: 'POI', label: 'Töökoda', lat: 58.1, lng: 26.1, radiusM: 50 }];
    samples = range(0, 30);
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    const [t] = await trips();
    expect(t.distanceKm).toBeGreaterThan(0.3);
    expect((t.startPlace as any).place.label).toBe('Töökoda');
    expect(t.pointCount).toBe(31);
  });
});

describe('importTenantTrips', () => {
  it('ühe seadme viga ei peata teist; viga salvestub', async () => {
    failImei = IMEI_BAD;
    samples = range(0, 30);
    nowMin = 120;
    const r = await run(() => importTenantTrips(deps));
    expect(r.failed).toBe(1);
    expect(await trips()).toHaveLength(1);
    const bad = await run(() => prisma.tripImportState.findUnique({ where: { deviceId: badDeviceId } }));
    expect(bad!.lastError).toContain('tsdb maas');
    expect(bad!.finalizedUntil).toBeNull();
  });

  it('teine ettevõte sõite ei näe', async () => {
    samples = range(0, 30);
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    expect(await run(() => prisma.vehicleTrip.count(), T2)).toBe(0);
  });
});

describe('refreshTripPlaces', () => {
  it('uus huvipunkt annab lõplikule sõidule nime', async () => {
    samples = range(0, 30);
    nowMin = 30 * 60;
    await run(() => importDeviceTrips(device(), deps));
    await run(() => refreshTripPlaces(device(), deps)); // esimene kord: ainult sõrmejälg
    let [t] = await trips();
    expect((t.startPlace as any).place).toBeNull();
    await run(() => prisma.pointOfInterest.create({ data: { id: `poi-trip-${process.pid}`, name: 'Kuivati', category: 'DRYER', latitude: 58.1, longitude: 26.1, radiusM: 50 } }));
    places = [{ id: `poi-trip-${process.pid}`, kind: 'POI', label: 'Kuivati (kuivati)', lat: 58.1, lng: 26.1, radiusM: 50 }];
    const n = await run(() => refreshTripPlaces(device(), deps));
    expect(n).toBe(1);
    [t] = await trips();
    expect((t.startPlace as any).place.label).toBe('Kuivati (kuivati)');
  });
});
