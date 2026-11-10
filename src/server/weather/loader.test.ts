// src/server/weather/loader.test.ts — live-andmebaas; CDS on võltsitud; ainult punkt lat 10.7.
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { prisma } from '../db';
import { loadPoint, claimPoint, type LoaderDeps } from './loader';
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
