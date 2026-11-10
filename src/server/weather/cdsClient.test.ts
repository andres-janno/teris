// src/server/weather/cdsClient.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { parseCdsCsvFiles, fetchHourly, CdsError } from './cdsClient';

const fx = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');
const T2M = 'valid_time,d2m,t2m,latitude,longitude\n2025-06-10 00:00:00,280,283.15,58.1,25.8\n2025-06-10 01:00:00,280,282.15,58.1,25.8\n';
const TP = 'valid_time,tp,latitude,longitude\n2025-06-10 00:00:00,0.0005,58.1,25.8\n2025-06-10 01:00:00,-1e-9,58.1,25.8\n';
const SSRD = 'valid_time,ssrd,latitude,longitude\n2025-06-10 00:00:00,0.0,58.1,25.8\n2025-06-10 01:00:00,360000,58.1,25.8\n';
const SWVL = 'valid_time,swvl1,swvl2,latitude,longitude\n2025-06-10 00:00:00,0.43,0.39,58.1,25.8\n2025-06-10 01:00:00,0.42,0.40,58.1,25.8\n';

describe('parseCdsCsvFiles', () => {
  it('ühendab failid aja järgi ja teisendab ühikud', () => {
    const r = parseCdsCsvFiles([TP, T2M, SWVL, SSRD]);
    expect(r).toHaveLength(2);
    expect(r[0].time.toISOString()).toBe('2025-06-10T00:00:00.000Z');
    expect(r[0].tempC).toBeCloseTo(10, 5);
    expect(r[0].precipMm).toBeCloseTo(0.5, 5);
    expect(r[1].precipMm).toBe(0); // negatiivne müra kärbitud
    expect(r[1].solarJm2).toBe(360000);
    expect(r[1].soil2).toBeCloseTo(0.40, 5);
  });
  it('mullaniiskuse puudumisel null', () => {
    const r = parseCdsCsvFiles([T2M, TP, SSRD]);
    expect(r[0].soil1).toBeNull();
  });
  it('ei ole CSV (üks rida tekst) → CdsError', () => {
    expect(() => parseCdsCsvFiles(['Request failed: quota exceeded'])).toThrow(CdsError);
  });
  it('kohustuslik veerg puudu → viga', () => {
    expect(() => parseCdsCsvFiles([T2M, SSRD])).toThrow(/tp/);
  });
  it('päris näidisvastus: 72 tundi, mõistlikud väärtused', () => {
    const r = parseCdsCsvFiles(['t2m', 'tp', 'ssrd', 'swvl', 'wind'].map((n) => fx(`cds-sample-${n}.csv`)));
    expect(r).toHaveLength(72);
    expect(r.every((x) => x.tempC !== null && x.tempC > -40 && x.tempC < 40)).toBe(true);
    expect(r.every((x) => x.precipMm !== null && x.precipMm >= 0 && x.precipMm < 50)).toBe(true);
    expect(r.every((x) => x.soil1 !== null)).toBe(true);
  });
});

describe('fetchHourly', () => {
  const zipOf = async (files: Record<string, string>) => {
    const z = new JSZip();
    for (const [n, t] of Object.entries(files)) z.file(n, t);
    return z.generateAsync({ type: 'arraybuffer' });
  };
  it('saadab päringu, ootab tööd, laeb zip-i', async () => {
    let polls = 0;
    const zip = await zipOf({ 'a.csv': T2M, 'b.csv': TP, 'c.csv': SSRD, 'd.csv': SWVL });
    const fake = (async (url: string, init?: RequestInit) => {
      if (url.endsWith('/execution')) {
        const body = JSON.parse(String(init!.body));
        expect(body.inputs.location).toEqual({ latitude: 58.1, longitude: 25.8 });
        expect(body.inputs.date).toEqual(['2025-06-10/2025-06-10']);
        expect(body.inputs.variable).toContain('surface_solar_radiation_downwards');
        return new Response(JSON.stringify({ jobID: 'j1' }), { status: 201 });
      }
      if (url.endsWith('/jobs/j1')) return new Response(JSON.stringify({ status: ++polls < 2 ? 'running' : 'successful' }));
      if (url.endsWith('/jobs/j1/results')) return new Response(JSON.stringify({ asset: { value: { href: 'https://dl/x.zip' } } }));
      if (url === 'https://dl/x.zip') return new Response(zip);
      throw new Error(url);
    }) as typeof fetch;
    const r = await fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', { fetchImpl: fake, pollMs: 1 });
    expect(r).toHaveLength(2);
    expect(polls).toBe(2);
  });
  it('ebaõnnestunud töö → CdsError', async () => {
    const fake = (async (url: string) => {
      if (url.endsWith('/execution')) return new Response(JSON.stringify({ jobID: 'j2' }), { status: 201 });
      return new Response(JSON.stringify({ status: 'failed', detail: 'boom' }));
    }) as typeof fetch;
    await expect(fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', { fetchImpl: fake, pollMs: 1 })).rejects.toThrow(/boom|failed/);
  });
  const statusFake = (statusRes: () => Response) => (async (url: string) => {
    if (url.endsWith('/execution')) return new Response(JSON.stringify({ jobID: 'j3' }), { status: 201 });
    return statusRes();
  }) as typeof fetch;
  it('staatuse päring 500 JSON-vastusega → kohe viga, mitte ajaleotus', async () => {
    const t0 = Date.now();
    await expect(fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', {
      fetchImpl: statusFake(() => new Response(JSON.stringify({ detail: 'internal' }), { status: 500 })), pollMs: 1, timeoutMs: 60_000
    })).rejects.toThrow(/500/);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
  it('staatuse päring 502 mitte-JSON-vastusega → CdsError', async () => {
    await expect(fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', {
      fetchImpl: statusFake(() => new Response('Bad Gateway', { status: 502 })), pollMs: 1
    })).rejects.toBeInstanceOf(CdsError);
  });
  it('staatuse vastus ilma status-väljata → kohe CdsError', async () => {
    const t0 = Date.now();
    await expect(fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', {
      fetchImpl: statusFake(() => new Response(JSON.stringify({ detail: 'x' }), { status: 200 })), pollMs: 1, timeoutMs: 60_000
    })).rejects.toBeInstanceOf(CdsError);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
  it('tundmatu staatuse väärtus → kohe CdsError', async () => {
    const t0 = Date.now();
    await expect(fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', {
      fetchImpl: statusFake(() => new Response(JSON.stringify({ status: 'weird' }), { status: 200 })), pollMs: 1, timeoutMs: 60_000
    })).rejects.toBeInstanceOf(CdsError);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
  it('päring 201 ilma jobID-ta → CdsError', async () => {
    const fake = (async () => new Response(JSON.stringify({}), { status: 201 })) as typeof fetch;
    await expect(fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', { fetchImpl: fake, pollMs: 1 })).rejects.toThrow(/jobID/);
  });
  it('tulemusest puudub allalaadimise link → CdsError', async () => {
    const fake = (async (url: string) => {
      if (url.endsWith('/execution')) return new Response(JSON.stringify({ jobID: 'j5' }), { status: 201 });
      if (url.endsWith('/jobs/j5/results')) return new Response(JSON.stringify({}));
      return new Response(JSON.stringify({ status: 'successful' }));
    }) as typeof fetch;
    await expect(fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', { fetchImpl: fake, pollMs: 1 })).rejects.toBeInstanceOf(CdsError);
  });
  it('allalaaditud keha on üks rida ei-CSV teksti → CdsError', async () => {
    const fake = (async (url: string) => {
      if (url.endsWith('/execution')) return new Response(JSON.stringify({ jobID: 'j4' }), { status: 201 });
      if (url.endsWith('/jobs/j4/results')) return new Response(JSON.stringify({ asset: { value: { href: 'https://dl/err' } } }));
      if (url === 'https://dl/err') return new Response('Request failed: quota exceeded');
      return new Response(JSON.stringify({ status: 'successful' }));
    }) as typeof fetch;
    await expect(fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', { fetchImpl: fake, pollMs: 1 })).rejects.toBeInstanceOf(CdsError);
  });
  it('litsents nõustumata (403) → selge viga', async () => {
    const fake = (async () => new Response('required licences not accepted', { status: 403 })) as typeof fetch;
    await expect(fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', { fetchImpl: fake, pollMs: 1 })).rejects.toThrow(/403/);
  });
});
