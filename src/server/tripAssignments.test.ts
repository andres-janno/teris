// src/server/tripAssignments.test.ts — seadme seoste lahendaja live-andmebaasis ajutise ettevõttega.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant } from './db';
import { loadAssignmentResolver } from './tripAssignments';

const T = `test-tenant-tripassign-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(s);
const ids: Record<string, string> = {};

const mkDevice = async (key: string) => { ids[key] = (await prisma.telemetryDevice.create({ data: { model: 'FMC650' } })).id; };
const mkVehicle = async (key: string) => { ids[key] = (await prisma.vehicle.create({ data: { name: key, type: 'TRACTOR', model: 'X' } })).id; };
const mkImpl = async (key: string, w: number | null) => { ids[key] = (await prisma.implement.create({ data: { name: key, type: 'OTHER' as any, workingWidthM: w } })).id; };

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: `Test ${T}` } });
  await run(async () => {
    for (const k of ['dWidth', 'dZero', 'dNull', 'dBound', 'dOver', 'dVehImpl', 'dImplDev', 'dNone']) await mkDevice(k);
    for (const k of ['vWidth', 'vZero', 'vNull', 'vBound', 'vOld', 'vNew', 'vHitch']) await mkVehicle(k);
    await mkImpl('iWidth', 6.5); await mkImpl('iZero', 0); await mkImpl('iNull', null);
    await mkImpl('iBound', 4); await mkImpl('iHitch', 8); await mkImpl('iDev', 3);
    const da = (device: string, vehicle: string | null, implement: string | null, startedAt: string, endedAt?: string) =>
      prisma.deviceAssignment.create({ data: { deviceId: ids[device], vehicleId: vehicle ? ids[vehicle] : null, implementId: implement ? ids[implement] : null, startedAt: d(startedAt), endedAt: endedAt ? d(endedAt) : null } });
    await da('dWidth', 'vWidth', 'iWidth', '2026-10-01T00:00:00Z');
    await da('dZero', 'vZero', 'iZero', '2026-10-01T00:00:00Z');
    await da('dNull', 'vNull', 'iNull', '2026-10-01T00:00:00Z');
    await da('dBound', 'vBound', 'iBound', '2026-10-10T00:00:00Z', '2026-10-20T00:00:00Z');
    await da('dOver', 'vOld', null, '2026-10-01T00:00:00Z');
    await da('dOver', 'vNew', null, '2026-10-05T00:00:00Z');
    await da('dVehImpl', 'vHitch', null, '2026-10-01T00:00:00Z');
    await da('dImplDev', null, 'iDev', '2026-10-01T00:00:00Z');
    await prisma.implementAssignment.create({ data: { vehicleId: ids.vHitch, implementId: ids.iHitch, startedAt: d('2026-10-01T00:00:00Z') } });
    await prisma.implementAssignment.create({ data: { vehicleId: ids.vOld, implementId: ids.iHitch, startedAt: d('2026-10-01T00:00:00Z'), endedAt: d('2026-10-02T00:00:00Z') } });
    await prisma.implementAssignment.create({ data: { vehicleId: ids.vNew, implementId: ids.iDev, startedAt: d('2026-10-01T00:00:00Z') } });
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.deviceAssignment.deleteMany({});
    await prisma.implementAssignment.deleteMany({});
    await prisma.implement.deleteMany({});
    await prisma.telemetryDevice.deleteMany({});
    await prisma.vehicle.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

const resolver = (keys: string[]) => run(() => loadAssignmentResolver(keys.map((k) => ids[k])));

describe('loadAssignmentResolver', () => {
  it('laius olemas', async () => {
    const r = (await resolver(['dWidth']))(ids.dWidth, d('2026-11-01T00:00:00Z'));
    expect(r).toEqual({ vehicleId: ids.vWidth, vehicleName: 'vWidth', implementId: ids.iWidth, implementName: 'iWidth', widthM: 6.5 });
  });
  it('laius 0 → null', async () => {
    const r = (await resolver(['dZero']))(ids.dZero, d('2026-11-01T00:00:00Z'));
    expect(r.implementId).toBe(ids.iZero);
    expect(r.widthM).toBeNull();
  });
  it('laius puudub → null', async () => {
    const r = (await resolver(['dNull']))(ids.dNull, d('2026-11-01T00:00:00Z'));
    expect(r.implementId).toBe(ids.iNull);
    expect(r.widthM).toBeNull();
  });
  it('piirid kaasavad: at = startedAt ja at = endedAt', async () => {
    const f = await resolver(['dBound']);
    expect(f(ids.dBound, d('2026-10-10T00:00:00Z')).implementId).toBe(ids.iBound);
    expect(f(ids.dBound, d('2026-10-20T00:00:00Z')).implementId).toBe(ids.iBound);
    expect(f(ids.dBound, d('2026-10-09T23:59:59Z')).implementId).toBeNull();
    expect(f(ids.dBound, d('2026-10-20T00:00:01Z')).vehicleId).toBeNull();
  });
  it('kattuvad seosed: hilisem algus võidab', async () => {
    const f = await resolver(['dOver']);
    expect(f(ids.dOver, d('2026-10-03T00:00:00Z')).vehicleId).toBe(ids.vOld);
    expect(f(ids.dOver, d('2026-10-06T00:00:00Z')).vehicleId).toBe(ids.vNew);
  });
  it('haakeriist masina haakimise registrist', async () => {
    const r = (await resolver(['dVehImpl']))(ids.dVehImpl, d('2026-11-01T00:00:00Z'));
    expect(r).toMatchObject({ vehicleId: ids.vHitch, implementId: ids.iHitch, implementName: 'iHitch', widthM: 8 });
  });
  it('seade haakeriistal: masin haakimise registrist', async () => {
    const r = (await resolver(['dImplDev']))(ids.dImplDev, d('2026-11-01T00:00:00Z'));
    expect(r).toMatchObject({ vehicleId: ids.vNew, vehicleName: 'vNew', implementId: ids.iDev, widthM: 3 });
  });
  it('seost pole → kõik tühjad', async () => {
    const r = (await resolver(['dNone']))(ids.dNone, d('2026-11-01T00:00:00Z'));
    expect(r).toEqual({ vehicleId: null, vehicleName: null, implementId: null, implementName: null, widthM: null });
  });
});
