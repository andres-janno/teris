// src/server/weather/weatherApi.test.ts — live-andmebaas: ajutine ettevõte, punkt lat 10.9 sünteetiliste päevadega.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant } from '../db';
import { yearsReport, seasonReport, loadDays } from './weatherApi';
import { addDays } from './summary';

const T = `test-tenant-weatherapi-${process.pid}`;
const run = <R>(fn: () => PromiseLike<R>): Promise<R> => runAsTenant(T, async () => await fn());
let pointId = 0, seeded = 0, unseeded = 0, future = 0, invalid = 0;
const thisYear = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Tallinn' }).slice(0, 4));

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Ilma API test' } });
  pointId = (await prisma.weatherPoint.create({ data: { lat: 10.9, lon: 20.9, hasData: true, loadedUntil: new Date('2016-12-31') } })).id;
  const rows = [];
  for (let d = '2015-01-01'; d <= '2016-12-31'; d = addDays(d, 1)) {
    const wet = d.startsWith('2016'); // 2016 märg
    rows.push({ pointId, date: new Date(`${d}T00:00:00Z`), tMin: 5, tMax: 15, tMean: 10, precipMm: wet ? 4 : 1, potEvapMm: 2, soilMoisture1: 0.3, soilMoisture2: 0.3, isFinal: true });
  }
  // Jooksev aasta 01.04–31.08 täielikult (väga märg) — ei tohi pikaajalisse keskmisse sattuda
  for (let d = `${thisYear}-04-01`; d <= `${thisYear}-08-31`; d = addDays(d, 1)) {
    rows.push({ pointId, date: new Date(`${d}T00:00:00Z`), tMin: 5, tMax: 15, tMean: 10, precipMm: 50, potEvapMm: 2, soilMoisture1: 0.3, soilMoisture2: 0.3, isFinal: false });
  }
  await prisma.weatherDaily.createMany({ data: rows });
  await run(async () => {
    const crop = await prisma.crop.create({ data: { id: `c-${process.pid}`, name: 'Mais', gddBaseC: 8 } });
    const f = await prisma.field.create({ data: { num: '1', name: 'A', fieldCode: 'WA' } });
    const g = { type: 'Polygon', coordinates: [[[20.9, 10.9], [20.91, 10.9], [20.91, 10.91], [20.9, 10.9]]] };
    seeded = (await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2016, areaHa: 1, crop: 'Mais', cropId: crop.id, geometry: g, weatherPointId: pointId, seedingDate: new Date('2016-05-01T00:00:00Z'), harvestDate: new Date('2016-05-10T00:00:00Z') } })).id;
    future = (await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2017, areaHa: 1, crop: 'Mais', geometry: g, weatherPointId: pointId, seedingDate: new Date(Date.now() + 30 * 86_400_000) } })).id;
    invalid = (await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2018, areaHa: 1, crop: 'Mais', geometry: g, weatherPointId: pointId, seedingDate: new Date('2016-05-10T00:00:00Z'), harvestDate: new Date('2016-05-01T00:00:00Z') } })).id;
    unseeded = (await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2015, areaHa: 1, crop: 'Mais', geometry: g, weatherPointId: pointId } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.crop.deleteMany({});
  }).catch(() => {});
  await authDb().tenant.delete({ where: { id: T } }).catch(() => {});
  await prisma.weatherPoint.deleteMany({ where: { lat: 10.9, lon: 20.9 } });
});

describe('weather API', () => {
  it('loadDays', async () => {
    expect(await loadDays([pointId], '2016-05-01', '2016-05-03')).toHaveLength(3);
  });
  it('aastate tabel ja norm', async () => {
    const r = await run(() => yearsReport('all', 5));
    const y = Object.fromEntries(r.years.map((x) => [x.year, x.summary]));
    expect(y[2015].precipMm).toBe(153);   // 153 päeva × 1 mm (01.04–31.08)
    expect(y[2016].precipMm).toBe(612);
    expect(y[2015].gdd).toBe(765);        // 153 × (10 − 5)
    expect(r.normal.precipMm).toBeCloseTo(382.5, 1);
    expect(r.sd.precipMm).toBeCloseTo(229.5, 1);
  });
  it('pikaajaline keskmine ei sisalda jooksvat aastat', async () => {
    const r = await run(() => yearsReport('all', 5));
    expect(r.years.find((x) => x.year === thisYear)!.summary.complete).toBe(true);
    expect(r.normalYears).toEqual([2015, 2016]);
    expect(r.normal.precipMm).toBeCloseTo(382.5, 1);
  });
  it('põllu hooaeg kultuuri baasiga', async () => {
    const r = await run(() => seasonReport(seeded));
    expect(r.gddBaseC).toBe(8);
    expect(r.summary!.gdd).toBe(20);      // 10 päeva × (10 − 8)
    expect(r.summary!.precipMm).toBe(40);
  });
  it('külv tulevikus → NOT_STARTED, koristus enne külvi → INVALID_DATES', async () => {
    expect((await run(() => seasonReport(future))).reason).toBe('NOT_STARTED');
    expect((await run(() => seasonReport(invalid))).reason).toBe('INVALID_DATES');
  });
  it('külvikuupäevata', async () => {
    expect((await run(() => seasonReport(unseeded))).reason).toBe('NO_SEEDING');
  });
});
