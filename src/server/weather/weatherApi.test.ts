// src/server/weather/weatherApi.test.ts — live-andmebaas: ajutine ettevõte, punkt lat 10.9 sünteetiliste päevadega.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant } from '../db';
import { yearsReport, monthsReport, cumulativeReport, seasonReport, seasonHistoryReport, loadDays } from './weatherApi';
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
  it('kuud mitme aastaga ja keskmisega', async () => {
    const r = await run(() => monthsReport([2015, 2016], 'all', 5));
    const apr = r.months.find((m) => m.month === 4)!;
    expect(apr.years).toEqual([{ year: 2015, precipMm: 30, gdd: 150 }, { year: 2016, precipMm: 120, gdd: 150 }]);
    expect(apr.normalPrecipMm).toBe(75);
  });
  it('kasvukõverad ja keskmine kõver täisaastatest', async () => {
    const r = await run(() => cumulativeReport([2016], 'all', 5));
    expect(r.series[0].points.at(-1)).toEqual({ day: 152, gdd: 765, precipMm: 612 });
    expect(r.normal!.years).toEqual([2015, 2016]);
    expect(r.normal!.points).toHaveLength(153);
    expect(r.normal!.points.at(-1)).toEqual({ day: 152, gdd: 765, precipMm: 382.5 });
  });
  it('perioodi valik: kogu aasta ja taliviljad', async () => {
    const y = await run(() => yearsReport('all', 5, 'year'));
    const by = Object.fromEntries(y.years.map((x) => [x.year, x.summary]));
    expect(by[2015].precipMm).toBe(365);
    expect(by[2016].precipMm).toBe(1464);  // liigaasta 366 × 4 mm
    expect(by[2015].frostDays).toBe(0);
    const w = await run(() => monthsReport([2015], 'all', 5, 'winter'));
    expect(w.months.map((m) => m.month)).toEqual([7, 8, 9, 10, 11]);
    const c = await run(() => cumulativeReport([2016], 'all', 5, 'year'));
    expect(c.series[0].points).toHaveLength(366);
    expect(c.normal!.points).toHaveLength(365);
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
  it('eelmiste aastate ajalugu: kuupäevata aasta saab valitud hooaja perioodi', async () => {
    const r = await run(() => seasonHistoryReport(seeded));
    // 2016 hooaeg → eelmised 2011–2015; andmed on alates 2015, 2015 külvikuupäevata → nihutatud 01.05–10.05
    expect(r.rows).toHaveLength(1);
    const y = r.rows[0];
    expect(y.year).toBe(2015);
    expect(y.ownDates).toBe(false);
    expect(y.summary.from).toBe('2015-05-01');
    expect(y.summary.to).toBe('2015-05-10');
    expect(y.gddBaseC).toBe(5);           // 2015 kultuuril pole registri seost → baas 5
    expect(y.summary.gdd).toBe(50);       // 10 päeva × (10 − 5)
    expect(y.summary.precipMm).toBe(10);
  });
  it('ajalugu: aasta oma külvikuupäevaga', async () => {
    const r = await run(() => seasonHistoryReport(future));
    // 2017 hooaeg (külv tulevikus) → 2016 oma kuupäevadega; 2015 kuupäevata ja nihutatav periood puudub → välja
    expect(r.rows.map((x) => [x.year, x.ownDates])).toEqual([[2016, true]]);
    expect(r.rows[0].summary.gdd).toBe(20);
  });
  it('ajalugu: talikultuur — külv eelmisel aastal nihkub koos koristusega', async () => {
    const id = await run(async () => {
      const f = await prisma.field.create({ data: { num: '2', name: 'B', fieldCode: 'WB' } });
      const g = { type: 'Polygon', coordinates: [[[20.9, 10.9], [20.91, 10.9], [20.91, 10.91], [20.9, 10.9]]] };
      return (await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2017, areaHa: 1, crop: 'Talinisu', geometry: g, weatherPointId: pointId, seedingDate: new Date('2016-10-08T00:00:00Z'), harvestDate: new Date('2017-08-17T00:00:00Z') } })).id;
    });
    const r = await run(() => seasonHistoryReport(id));
    // 2016 hooaeg (kirjet pole) → 08.10.2015 – 17.08.2016; 2015 hooaeg algaks 2014 → välja
    expect(r.rows.map((x) => [x.year, x.summary.from, x.summary.to])).toEqual([[2016, '2015-10-08', '2016-08-17']]);
    expect(r.rows[0].ownDates).toBe(false);
    expect(r.rows[0].crop).toBeNull();
  });
});
