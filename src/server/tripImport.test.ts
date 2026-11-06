// src/server/tripImport.test.ts — sõitude import live-andmebaasis ajutise ettevõttega; telemeetria on võltsitud.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma, authDb, runAsTenant } from './db';
import { importDeviceTrips, refreshTripPlaces, refreshTripAssignments, importTenantTrips, type ImportDeps } from './tripImport';
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
// Põld katab punktid lat 58.1 … 58.105, lng 26.1
const FIELD_GEOMETRY = {
  type: 'Polygon' as const,
  coordinates: [[[26.0995, 58.0995], [26.1005, 58.0995], [26.1005, 58.106], [26.0995, 58.106], [26.0995, 58.0995]]]
};

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
let vehicleId = '';
let impl6 = '';
let impl12 = '';
let implAsgId = '';
let fsId = 0;
let fieldWorkId = '';
const fieldPlace = (): Place => ({ id: String(fsId), kind: 'FIELD', label: 'Nr 1 Testpõld', geometry: FIELD_GEOMETRY });

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test sõidud' } });
  await authDb().tenant.create({ data: { id: T2, name: 'Test sõidud 2' } });
  await run(async () => {
    deviceId = (await prisma.telemetryDevice.create({ data: { imei: IMEI, model: 'FMC650' } })).id;
    badDeviceId = (await prisma.telemetryDevice.create({ data: { imei: IMEI_BAD, model: 'FMC650' } })).id;
    await prisma.deviceOwnership.create({ data: { kind: 'IMEI', identifier: IMEI, deviceId, validFrom: at(-60) } });
    await prisma.deviceOwnership.create({ data: { kind: 'IMEI', identifier: IMEI_BAD, deviceId: badDeviceId, validFrom: at(-60) } });
    vehicleId = (await prisma.vehicle.create({ data: { name: 'Importtraktor', type: 'TRACTOR', model: 'X' } })).id;
    impl6 = (await prisma.implement.create({ data: { name: 'Kultivaator 6 m', type: 'CULTIVATOR', workingWidthM: 6 } })).id;
    impl12 = (await prisma.implement.create({ data: { name: 'Kultivaator 12 m', type: 'CULTIVATOR', workingWidthM: 12 } })).id;
    await prisma.deviceAssignment.create({ data: { deviceId, vehicleId, startedAt: at(-60) } });
    implAsgId = (await prisma.implementAssignment.create({ data: { vehicleId, implementId: impl6, startedAt: at(-60) } })).id;
    const field = await prisma.field.create({ data: { num: '1', name: 'Testpõld', fieldCode: `TI-${process.pid}` } });
    fsId = (await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 5, crop: 'test', geometry: FIELD_GEOMETRY } })).id;
    const wt = await prisma.workType.create({ data: { name: 'Testkultiveerimine', phase: 'PREPARATION' } });
    fieldWorkId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fsId, workTypeId: wt.id, phase: 'PREPARATION' } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.vehicleTrip.deleteMany({});
    await prisma.tripImportState.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.implementAssignment.deleteMany({});
    await prisma.deviceAssignment.deleteMany({});
    await prisma.implement.deleteMany({});
    await prisma.vehicle.deleteMany({});
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
    await prisma.workEntry.deleteMany({});
    await prisma.vehicleTrip.deleteMany({});
    await prisma.tripImportState.deleteMany({});
  });
});

const trips = () => run(() => prisma.vehicleTrip.findMany({ where: { deviceId }, orderBy: { startedAt: 'asc' } }));
const fieldRows = () => run(() => prisma.vehicleTripField.findMany({ orderBy: { arriveAt: 'asc' } }));
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

  it('sõidule tekivad põllured ja ha haakeriista laiusega', async () => {
    places = [fieldPlace()];
    samples = range(0, 30);
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    const [t] = await trips();
    const f = await fieldRows();
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ tripId: t.id, fieldSeasonId: fsId, activeMinutes: 30, implementId: impl6, widthM: 6 });
    expect(f[0].arriveAt).toEqual(at(0)); // esimene aken algab omandiperioodi algusest at(-60), punkt 0 on põllul
    expect(f[0].leaveAt).toEqual(at(30));
    expect(f[0].areaHa!).toBeGreaterThan(0.15);
    expect(t.areaHa).toBe(f[0].areaHa);
  });

  it('kandega seotud sõidu id säilib liitumisel', async () => {
    samples = [...range(0, 10), ...range(40, 50)];
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    const t = await trips();
    expect(t).toHaveLength(2);
    const entry = await run(() => prisma.workEntry.create({ data: { fieldWorkId, date: new Date('2026-10-22T00:00:00Z'), tripId: t[1].id } }));
    samples = range(0, 50); // auk täitus
    await run(() => importDeviceTrips(device(), deps));
    const merged = await trips();
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(t[1].id);
    const e = await run(() => prisma.workEntry.findUnique({ where: { id: entry.id } }));
    expect(e!.tripId).toBe(t[1].id);
  });

  it('liitumisel liiguvad mõlema vana sõidu kanded uuele sõidule', async () => {
    samples = [...range(0, 10), ...range(40, 50)];
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    const t = await trips();
    expect(t).toHaveLength(2);
    const day = new Date('2026-10-22T00:00:00Z');
    const e1 = await run(() => prisma.workEntry.create({ data: { fieldWorkId, date: day, tripId: t[0].id } }));
    const e2 = await run(() => prisma.workEntry.create({ data: { fieldWorkId, date: day, tripId: t[1].id } }));
    samples = range(0, 50);
    await run(() => importDeviceTrips(device(), deps));
    const merged = await trips();
    expect(merged).toHaveLength(1);
    const es = await run(() => prisma.workEntry.findMany({ where: { id: { in: [e1.id, e2.id] } } }));
    expect(es.map((e) => e.tripId)).toEqual([merged[0].id, merged[0].id]);
  });
});

describe('kustutatud sõit', () => {
  it('müra ise (≥ 80% kustutatud ajas) jääb kustutatuks ja uut sõitu selle peale ei looda', async () => {
    samples = range(0, 10);
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    const t = await trips();
    expect(t).toHaveLength(1);
    await run(() => prisma.vehicleTrip.update({ where: { id: t[0].id }, data: { deletedAt: new Date(), deletedBy: 'test' } }));
    samples = [...range(0, 10), ...range(11, 11)]; // hilinenud punkt pikendab müra veidi
    await run(() => importDeviceTrips(device(), deps));
    await run(() => importDeviceTrips(device(), deps));
    const after = await trips();
    expect(after).toHaveLength(1);
    expect(after[0].deletedAt).not.toBeNull();
    expect(after[0].endedAt).toEqual(at(10));
  });

  it('müra liitub pikema päris sõiduga: ühendatud sõit kirjutatakse, kustutatud jääb kustutatuks, kanne ei kao', async () => {
    samples = [...range(0, 10), ...range(40, 50)];
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    let t = await trips();
    expect(t).toHaveLength(2);
    const [noise, real] = t;
    await run(async () => {
      await prisma.vehicleTrip.update({ where: { id: noise.id }, data: { deletedAt: new Date(), deletedBy: 'test' } });
      await prisma.workEntry.create({ data: { fieldWorkId, date: at(40), tripId: real.id } });
    });
    samples = range(0, 50); // auk täitus: müra on 10/50 = 20% ühendatud sõidust
    await run(() => importDeviceTrips(device(), deps));
    t = await trips();
    expect(t).toHaveLength(2);
    expect(t.find((x) => x.id === noise.id)?.deletedAt).not.toBeNull();
    const live = t.filter((x) => !x.deletedAt);
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe(real.id);
    expect(live[0].startedAt).toEqual(at(0));
    expect(live[0].endedAt).toEqual(at(50));
    expect(await run(() => prisma.workEntry.count({ where: { tripId: real.id } }))).toBe(1);
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

describe('refreshTripAssignments', () => {
  it('haakeriista vahetus haakimise registris arvutab lõpliku sõidu ha ümber', async () => {
    places = [fieldPlace()];
    samples = range(0, 30);
    nowMin = 30 * 60;
    await run(() => importDeviceTrips(device(), deps));
    expect(await run(() => refreshTripAssignments(device(), deps))).toBe(0); // esimene kord: ainult sõrmejälg
    const [before] = await fieldRows();
    expect(before.widthM).toBe(6);
    await run(() => prisma.tripImportState.update({ where: { deviceId }, data: { assignmentsCheckedAt: new Date() } }));
    await run(() => prisma.implementAssignment.update({ where: { id: implAsgId }, data: { implementId: impl12 } }));
    try {
      expect(await run(() => refreshTripAssignments(device(), deps))).toBe(1);
      const [after] = await fieldRows();
      expect(after).toMatchObject({ implementId: impl12, widthM: 12 });
      expect(after.areaHa!).toBeGreaterThan(before.areaHa! * 1.8);
      expect((await trips())[0].areaHa).toBe(after.areaHa);
      expect(await run(() => refreshTripAssignments(device(), deps))).toBe(0); // muutuseta
    } finally {
      await run(() => prisma.implementAssignment.update({ where: { id: implAsgId }, data: { implementId: impl6 } }));
    }
  });

  it('kustutatud haakimine: põllurea haakeriist ei vasta enam registrile → ha tühjaks', async () => {
    places = [fieldPlace()];
    samples = range(0, 30);
    nowMin = 30 * 60;
    await run(() => importDeviceTrips(device(), deps));
    await run(() => refreshTripAssignments(device(), deps));
    // Kontrollaeg päris kellaga: ainult põllurea võrdlus (mitte muudetud periood) leiab sõidu
    await run(() => prisma.tripImportState.update({ where: { deviceId }, data: { assignmentsCheckedAt: new Date() } }));
    await run(() => prisma.implementAssignment.delete({ where: { id: implAsgId } }));
    try {
      expect(await run(() => refreshTripAssignments(device(), deps))).toBe(1);
      const [f] = await fieldRows();
      expect(f).toMatchObject({ implementId: null, widthM: null, areaHa: null });
      expect((await trips())[0].areaHa).toBeNull();
    } finally {
      implAsgId = (await run(() => prisma.implementAssignment.create({ data: { vehicleId, implementId: impl6, startedAt: at(-60) } }))).id;
    }
  });

  it('ainult lahknevad sõidud arvutatakse ümber: kahest sõidust muutub üks', async () => {
    places = [fieldPlace()];
    const second = Array.from({ length: 31 }, (_, i) => pt(120 + i, true, 58.1 + i * 0.0001));
    samples = [...range(0, 30), ...second];
    nowMin = 30 * 60;
    await run(() => importDeviceTrips(device(), deps));
    expect(await trips()).toHaveLength(2);
    await run(() => refreshTripAssignments(device(), deps));
    await run(() => prisma.tripImportState.update({ where: { deviceId }, data: { assignmentsCheckedAt: new Date() } }));
    // Haakimine lõpeb pärast esimest sõitu; teisel sõidul on haakeriist 12 m
    await run(() => prisma.implementAssignment.update({ where: { id: implAsgId }, data: { endedAt: at(60) } }));
    const extra = await run(() => prisma.implementAssignment.create({ data: { vehicleId, implementId: impl12, startedAt: at(61) } }));
    try {
      expect(await run(() => refreshTripAssignments(device(), deps))).toBe(1);
      const f = await fieldRows();
      expect(f).toHaveLength(2);
      expect(f[0]).toMatchObject({ implementId: impl6, widthM: 6 });
      expect(f[1]).toMatchObject({ implementId: impl12, widthM: 12 });
    } finally {
      await run(() => prisma.implementAssignment.delete({ where: { id: extra.id } }));
      await run(() => prisma.implementAssignment.update({ where: { id: implAsgId }, data: { endedAt: null } }));
    }
  });

  it('ainult haakeriista laiuse muutus arvutab sõidu ha ümber', async () => {
    places = [fieldPlace()];
    samples = range(0, 30);
    nowMin = 30 * 60;
    await run(() => importDeviceTrips(device(), deps));
    await run(() => refreshTripAssignments(device(), deps));
    const [before] = await fieldRows();
    await run(() => prisma.tripImportState.update({ where: { deviceId }, data: { assignmentsCheckedAt: new Date() } }));
    await run(() => prisma.implement.update({ where: { id: impl6 }, data: { workingWidthM: 9 } }));
    try {
      expect(await run(() => refreshTripAssignments(device(), deps))).toBe(1);
      const [after] = await fieldRows();
      expect(after.widthM).toBe(9);
      expect(after.areaHa!).toBeGreaterThan(before.areaHa! * 1.4);
      expect((await trips())[0].areaHa).toBe(after.areaHa);
    } finally {
      await run(() => prisma.implement.update({ where: { id: impl6 }, data: { workingWidthM: 6 } }));
    }
  });

  it('ebaoluline muutus (nt märkus) ei arvuta midagi ümber', async () => {
    places = [fieldPlace()];
    samples = range(0, 30);
    nowMin = 30 * 60;
    await run(() => importDeviceTrips(device(), deps));
    await run(() => refreshTripAssignments(device(), deps));
    await run(() => prisma.implement.update({ where: { id: impl6 }, data: { name: `Kultivaator 6 m ${Date.now()}` } }));
    expect(await run(() => refreshTripAssignments(device(), deps))).toBe(0);
  });

  it('kohtade ümberarvutus kirjutab ka põllud', async () => {
    samples = range(0, 30);
    nowMin = 30 * 60;
    await run(() => importDeviceTrips(device(), deps));
    await run(() => refreshTripPlaces(device(), deps)); // esimene kord: ainult sõrmejälg
    expect(await fieldRows()).toHaveLength(0);
    // Uus hooaja geomeetria muudab kohtade sõrmejälge; põld on nüüd kohtade hulgas
    await run(() => prisma.fieldSeason.update({ where: { id: fsId }, data: { notes: `muudetud ${Date.now()}` } }));
    places = [fieldPlace()];
    expect(await run(() => refreshTripPlaces(device(), deps))).toBe(1);
    expect(await fieldRows()).toHaveLength(1);
  });
});
