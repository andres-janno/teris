// src/server/weather/points.test.ts — live-andmebaas ajutise ettevõttega; punktid lat 9.95–10.65 kustutatakse lõpus
// (loader.test kasutab 10.7, weatherApi.test 10.9 — failid jooksevad paralleelselt, vahemikud ei tohi kattuda).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant } from '../db';
import { bindWeatherPoints } from './points';

const T = `test-tenant-weather-${process.pid}`;
const run = <R>(fn: () => PromiseLike<R>): Promise<R> => runAsTenant(T, async () => await fn());
const square = (lat: number, lon: number) => ({ type: 'Polygon', coordinates: [[[lon, lat], [lon + 0.01, lat], [lon + 0.01, lat + 0.01], [lon, lat + 0.01], [lon, lat]]] });

let fsA = 0, fsB = 0, fsC = 0;

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Ilma test' } });
  await run(async () => {
    const mk = async (num: string, lat: number, lon: number) => {
      const f = await prisma.field.create({ data: { num, name: num, fieldCode: `W${num}` } });
      return (await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2025, areaHa: 1, crop: 'Oder', geometry: square(lat, lon) } })).id;
    };
    fsA = await mk('1', 10.12, 20.12);
    fsB = await mk('2', 10.13, 20.13); // sama ruut mis A
    fsC = await mk('3', 10.31, 20.12);
  });
});

afterAll(async () => {
  // Tenant ei kaskaadi põldudele (tenantId on lihtne string) — kustuta ise
  await run(async () => {
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
  }).catch((e) => console.error('points.test puhastus (põllud):', e));
  await authDb().tenant.delete({ where: { id: T } }).catch((e) => console.error('points.test puhastus (ettevõte):', e));
  await authDb().weatherPoint.deleteMany({ where: { lat: { gte: 9.95, lt: 10.65 } } });
});

describe('bindWeatherPoints', () => {
  it('seob lähima ruuduga, sama ruut jagatakse', async () => {
    await run(() => bindWeatherPoints());
    const rows = await run(() => prisma.fieldSeason.findMany({ where: { id: { in: [fsA, fsB, fsC] } }, include: { weatherPoint: true } }));
    const by = new Map(rows.map((r) => [r.id, r.weatherPoint]));
    expect(by.get(fsA)).toMatchObject({ lat: 10.1, lon: 20.1 });
    expect(by.get(fsB)!.id).toBe(by.get(fsA)!.id);
    expect(by.get(fsC)).toMatchObject({ lat: 10.3, lon: 20.1 });
  });

  it('teine käik ei muuda midagi', async () => {
    expect((await run(() => bindWeatherPoints())).changed).toBe(0);
  });

  it('andmeteta ruut (üle vee) asendatakse naabriga', async () => {
    await authDb().weatherPoint.update({ where: { lat_lon: { lat: 10.3, lon: 20.1 } }, data: { hasData: false } });
    await run(() => bindWeatherPoints());
    const c = await run(() => prisma.fieldSeason.findUniqueOrThrow({ where: { id: fsC }, include: { weatherPoint: true } }));
    expect(c.weatherPoint).toMatchObject({ lat: 10.4, lon: 20.1 }); // esimene külgnaaber
  });

  it('geomeetria nihkumisel uus seos', async () => {
    await run(() => prisma.fieldSeason.update({ where: { id: fsA }, data: { geometry: square(10.52, 20.52) } }));
    const r = await run(() => bindWeatherPoints());
    expect(r.changed).toBe(1);
    const a = await run(() => prisma.fieldSeason.findUniqueOrThrow({ where: { id: fsA }, include: { weatherPoint: true } }));
    expect(a.weatherPoint).toMatchObject({ lat: 10.5, lon: 20.5 });
  });
});
