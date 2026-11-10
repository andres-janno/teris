// src/server/weather/loader.test.ts — live-andmebaas; CDS on võltsitud; ainult punkt lat 10.7.
import { describe, it, expect, afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { prisma, authDb, runAsTenant } from '../db';
import { loadPoint, claimPoint, wantedPointIds, type LoaderDeps } from './loader';
import type { HourlyWeather } from './types';

const hoursFor = (from: string, to: string): HourlyWeather[] => {
  const out: HourlyWeather[] = [];
  // Tallinna päevad from..to: UTC 21:00 eelmisel päeval (suvi) — testis piisab, et kõik tunnid kaetud oleks
  for (let t = Date.parse(`${from}T00:00:00Z`) - 3 * 3_600_000; t <= Date.parse(`${to}T23:00:00Z`); t += 3_600_000) {
    out.push({ time: new Date(t), tempC: 10, precipMm: 0.1, solarJm2: 100000, soil1: 0.3, soil2: 0.3 });
  }
  return out;
};

let calls: [string, string][] = [];
let fail = false;
let pointId = 0;
const deps: LoaderDeps = {
  now: () => new Date('2015-03-10T12:00:00Z'),
  keyCandidates: async () => [{ tenantId: 'test-no-such-tenant', key: 'test-key' }],
  fetchHourly: async (_c, from, to) => {
    calls.push([from, to]);
    if (fail) throw new Error('CDS maas');
    return hoursFor(from, to);
  }
};

beforeEach(async () => {
  calls = [];
  fail = false;
  await prisma.weatherPoint.deleteMany({ where: { lat: 10.7, lon: 20.7 } });
  pointId = (await prisma.weatherPoint.create({ data: { lat: 10.7, lon: 20.7 } })).id;
});
afterAll(async () => { await prisma.weatherPoint.deleteMany({ where: { lat: 10.7, lon: 20.7 } }); });

describe('loadPoint', () => {
  it('esmalaadimine alates 2015-01-01 aasta kaupa kuni eilseni', async () => {
    await loadPoint(pointId, deps);
    expect(calls).toEqual([['2014-12-31', '2015-03-09']]);
    const p = await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } });
    expect(p.hasData).toBe(true);
    expect(p.loadedUntil!.toISOString().slice(0, 10)).toBe('2015-03-09');
    expect(p.failCount).toBe(0);
    expect(await prisma.weatherDaily.count({ where: { pointId } })).toBe(68);
    const first = await prisma.weatherDaily.findMany({ where: { pointId }, orderBy: { date: 'asc' }, take: 1 });
    expect(first[0].date.toISOString().slice(0, 10)).toBe('2015-01-01');
  });

  it('loadedFrom jääb esimese laetud päeva peale ka mitme aastatüki korral', async () => {
    await loadPoint(pointId, { ...deps, now: () => new Date('2017-02-10T12:00:00Z') });
    expect(calls.length).toBe(3); // 2015, 2016, 2017
    const p = await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } });
    expect(p.loadedFrom!.toISOString().slice(0, 10)).toBe('2015-01-01');
  });

  it('järgmine käik küsib ainult uusi päevi', async () => {
    await loadPoint(pointId, deps);
    calls = [];
    await loadPoint(pointId, { ...deps, now: () => new Date('2015-03-12T12:00:00Z') });
    expect(calls).toEqual([['2015-03-09', '2015-03-11']]);
    expect(await prisma.weatherDaily.count({ where: { pointId, date: new Date('2015-03-10T00:00:00Z') } })).toBe(1);
    expect(await prisma.weatherDaily.count({ where: { pointId } })).toBe(70);
  });

  it('refreshRecent laeb viimased 90 päeva üle', async () => {
    await loadPoint(pointId, deps);
    calls = [];
    await loadPoint(pointId, deps, { refreshRecent: true });
    expect(calls[0][0]).toBe('2014-12-31'); // 90 päeva tagasi < algus → algusest (+1 päev UTC-nihke tõttu)
  });

  it('viga: failCount kasvab, andmed jäävad alles', async () => {
    fail = true;
    await expect(loadPoint(pointId, deps)).rejects.toThrow('CDS maas');
    const p = await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } });
    expect(p.failCount).toBe(1);
    expect(p.lastError).toContain('CDS maas');
  });

  it('tühjad temperatuurid → hasData false', async () => {
    await loadPoint(pointId, { ...deps, fetchHourly: async (_c, f, t) => hoursFor(f, t).map((h) => ({ ...h, tempC: null })) });
    expect((await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } })).hasData).toBe(false);
  });

  it('vanunenud päevad saavad refreshRecentiga lõplikuks', async () => {
    await loadPoint(pointId, { ...deps, now: () => new Date('2015-06-10T12:00:00Z') });
    expect((await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } })).finalUntil!.toISOString().slice(0, 10)).toBe('2015-03-11');
    await loadPoint(pointId, { ...deps, now: () => new Date('2015-06-24T12:00:00Z') }, { refreshRecent: true });
    const p = await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } });
    expect(p.finalUntil!.toISOString().slice(0, 10)).toBe('2015-03-25');
    const d = (s: string) => prisma.weatherDaily.findUniqueOrThrow({ where: { pointId_date: { pointId, date: new Date(`${s}T00:00:00Z`) } } });
    expect((await d('2015-03-12')).isFinal).toBe(true);
    expect((await d('2015-03-25')).isFinal).toBe(true);
    expect((await d('2015-03-26')).isFinal).toBe(false);
  });

  it('claimPoint annab punkti ühele katsele 20 tunni jooksul', async () => {
    const t = new Date('2015-03-10T12:00:00Z');
    expect(await claimPoint(pointId, t)).toBe(true);
    expect(await claimPoint(pointId, new Date(t.getTime() + 3_600_000))).toBe(false);
    expect(await claimPoint(pointId, new Date(t.getTime() + 21 * 3_600_000))).toBe(true);
  });
});

describe('wantedPointIds', () => {
  const T = `test-tenant-loader-${process.pid}`;
  const run = <R>(fn: () => PromiseLike<R>): Promise<R> => runAsTenant(T, async () => await fn());
  const lic = (modules: string[], validUntil: string) => [{ tenantId: T, modules, validUntil: new Date(`${validUntil}T00:00:00Z`) }];
  beforeAll(async () => {
    await authDb().tenant.create({ data: { id: T, name: 'Laadija test' } });
    await run(async () => {
      const f = await prisma.field.create({ data: { num: '1', name: 'L', fieldCode: 'WL' } });
      const g = { type: 'Polygon', coordinates: [[[20.7, 10.7], [20.71, 10.7], [20.71, 10.71], [20.7, 10.71], [20.7, 10.7]]] };
      await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2025, areaHa: 1, crop: 'Oder', geometry: g } });
    });
  });
  afterAll(async () => {
    await run(async () => { await prisma.fieldSeason.deleteMany({}); await prisma.field.deleteMany({}); }).catch(() => {});
    await authDb().tenant.delete({ where: { id: T } }).catch(() => {});
  });

  afterEach(async () => { await run(() => prisma.fieldSeason.updateMany({ data: { weatherPointId: null } })); });

  it('kehtiv litsents + WEATHER → punkt kaasatakse', async () => {
    const ids = await wantedPointIds(lic(['WEATHER'], '2030-01-01'), '2026-06-01');
    expect(ids.size).toBe(1);
    expect((await prisma.weatherPoint.findUniqueOrThrow({ where: { id: [...ids][0] } })).lat).toBe(10.7);
  });
  it('aegunud litsents → vahele', async () => {
    expect((await wantedPointIds(lic(['WEATHER'], '2026-05-31'), '2026-06-01')).size).toBe(0);
  });
  it('viimane kehtiv päev loeb veel kehtivaks', async () => {
    expect((await wantedPointIds(lic(['WEATHER'], '2026-06-01'), '2026-06-01')).size).toBe(1);
  });
  it('WEATHER moodulita → vahele', async () => {
    expect((await wantedPointIds(lic(['SATELLITE'], '2030-01-01'), '2026-06-01')).size).toBe(0);
  });
});
