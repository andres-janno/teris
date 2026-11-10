// src/server/weather/weatherCredential.test.ts — live-andmebaas; ajutised ettevõtted, CDS on võltsitud.
// Katab: võtmekandidaatide valik, laadija võtmete läbiproovimine, võtme API (ainult admin, võtit ei tagastata).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, runAsTenant } from '../db';
import { setSessionUserForTest } from '../authGate';
import { encryptSecret, decryptSecret } from '../secretBox';
import { keyCandidatesForPoint, credentialsByPoint, NO_KEY_ERROR } from './credentials';
import { loadPoint, type LoaderDeps } from './loader';
import { handleWeather } from './weatherApi';
import { CdsError } from './cdsClient';
import type { HourlyWeather } from './types';

const SK = 'c'.repeat(64);
const lat = 10.5, lon = 20.5; // ainult sellel testil
const A = `test-tenant-wc-a-${process.pid}`;
const B = `test-tenant-wc-b-${process.pid}`;
const C = `test-tenant-wc-c-${process.pid}`; // litsentsita
const ALL = [A, B, C];
const run = <R>(t: string, fn: () => PromiseLike<R>): Promise<R> => runAsTenant(t, async () => await fn());
const prevSk = process.env.SECRETS_KEY;
let pointId = 0;

const hours = (from: string, to: string): HourlyWeather[] => {
  const out: HourlyWeather[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`) - 3 * 3_600_000; t <= Date.parse(`${to}T23:00:00Z`); t += 3_600_000) out.push({ time: new Date(t), tempC: 10, precipMm: 0.1, solarJm2: 1000, soil1: 0.3, soil2: 0.3 });
  return out;
};
const setCred = (t: string, key: string, lastUsedAt: Date | null = null) =>
  run(t, () => prisma.tenantWeatherCredential.upsert({ where: { tenantId: t }, create: { cdsKeyEnc: encryptSecret(key, SK), lastUsedAt }, update: { cdsKeyEnc: encryptSecret(key, SK), lastUsedAt, lastError: null } }));
const credOf = (t: string) => authDb().tenantWeatherCredential.findUniqueOrThrow({ where: { tenantId: t } });

beforeAll(async () => {
  process.env.SECRETS_KEY = SK;
  await authDb().tenant.createMany({ data: ALL.map((id) => ({ id, name: `WC ${id.slice(-8)}` })) });
  const lic = (id: string) => ({ tenantId: id, validUntil: new Date('2099-01-01T00:00:00Z'), modules: ['WEATHER' as const] });
  await authDb().tenantLicense.createMany({ data: [lic(A), lic(B)] });
  pointId = (await prisma.weatherPoint.upsert({ where: { lat_lon: { lat, lon } }, create: { lat, lon }, update: {} })).id;
  for (const t of ALL) {
    await run(t, async () => {
      const f = await prisma.field.create({ data: { num: '1', name: 'W', fieldCode: `WC${t.slice(-3)}` } });
      const g = { type: 'Polygon', coordinates: [[[lon, lat], [lon + 0.01, lat], [lon + 0.01, lat + 0.01], [lon, lat]]] };
      await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2025, areaHa: 1, crop: 'Oder', geometry: g, weatherPointId: pointId } });
    });
  }
});

afterAll(async () => {
  for (const t of ALL) {
    await run(t, async () => {
      await prisma.tenantWeatherCredential.deleteMany({});
      await prisma.fieldSeason.deleteMany({});
      await prisma.field.deleteMany({});
    }).catch((e) => console.error('cleanup', t, e));
  }
  await authDb().tenantLicense.deleteMany({ where: { tenantId: { in: ALL } } });
  await authDb().tenant.deleteMany({ where: { id: { in: ALL } } });
  await prisma.weatherPoint.deleteMany({ where: { lat, lon } });
  if (prevSk === undefined) delete process.env.SECRETS_KEY; else process.env.SECRETS_KEY = prevSk;
});

afterEach(async () => {
  for (const t of ALL) await run(t, () => prisma.tenantWeatherCredential.deleteMany({}));
  await prisma.weatherPoint.update({ where: { id: pointId }, data: { hasData: null, loadedFrom: null, loadedUntil: null, finalUntil: null, lastError: null, failCount: 0 } });
  await prisma.weatherDaily.deleteMany({ where: { pointId } });
  vi.restoreAllMocks();
});

describe('võtmekandidaadid', () => {
  it('ainult kehtiva WEATHER litsentsiga ettevõtted, viimati kasutatud esimesena, kasutamata viimaseks', async () => {
    await setCred(A, 'key-a', new Date('2026-01-01T00:00:00Z'));
    await setCred(B, 'key-b', new Date('2026-02-01T00:00:00Z'));
    await setCred(C, 'key-c'); // litsentsita → välja
    const c = await keyCandidatesForPoint(pointId, new Date());
    expect(c.map((x) => x.key)).toEqual(['key-b', 'key-a']);
    expect(c.map((x) => x.tenantId)).toEqual([B, A]);
    await setCred(A, 'key-a'); // lastUsedAt null → viimaseks
    expect((await keyCandidatesForPoint(pointId, new Date())).map((x) => x.key)).toEqual(['key-b', 'key-a']);
  });
  it('aegunud litsents jätab võtme välja', async () => {
    await setCred(A, 'key-a');
    await authDb().tenantLicense.update({ where: { tenantId: A }, data: { validUntil: new Date('2020-01-01T00:00:00Z') } });
    try { expect(await keyCandidatesForPoint(pointId, new Date())).toEqual([]); }
    finally { await authDb().tenantLicense.update({ where: { tenantId: A }, data: { validUntil: new Date('2099-01-01T00:00:00Z') } }); }
  });
  it('võtmeta → tühi; SECRETS_KEY puudub → tühi hoiatusega', async () => {
    expect(await keyCandidatesForPoint(pointId, new Date())).toEqual([]);
    await setCred(A, 'key-a');
    delete process.env.SECRETS_KEY;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try { expect(await keyCandidatesForPoint(pointId, new Date())).toEqual([]); expect(warn).toHaveBeenCalled(); }
    finally { process.env.SECRETS_KEY = SK; }
  });
  it('credentialsByPoint annab ettevõtte nime platvormi vaatele, ilma võtmeta väljadeta', async () => {
    await setCred(B, 'key-b');
    const m = await credentialsByPoint(new Date(), [pointId]);
    expect(m.get(pointId)![0].tenantId).toBe(B);
    expect(m.get(pointId)![0].name).toContain('WC');
  });
});

describe('loadPoint võtmetega', () => {
  const now = () => new Date('2015-03-10T12:00:00Z');
  it('võtmeta: punkt jäetakse vahele, failCount ei kasva, fetch\'i ei tehta', async () => {
    let called = 0;
    const deps: LoaderDeps = { now, fetchHourly: async () => { called++; return []; } };
    const r = await loadPoint(pointId, deps);
    expect(r.days).toBe(0);
    expect(called).toBe(0);
    const p = await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } });
    expect(p.lastError).toBe(NO_KEY_ERROR);
    expect(p.failCount).toBe(0);
  });
  it('401 esimese võtmega → teine võti; kasutus ja viga märgitakse; võti ei lähe logisse/veasse', async () => {
    await setCred(A, 'key-bad', new Date('2026-02-01T00:00:00Z'));
    await setCred(B, 'key-good', new Date('2026-01-01T00:00:00Z'));
    const used: string[] = [];
    const before = [(await credOf(A)).updatedAt.getTime(), (await credOf(B)).updatedAt.getTime()];
    const deps: LoaderDeps = {
      now,
      fetchHourly: async (_c, f, t, key) => {
        used.push(key);
        if (key === 'key-bad') throw new CdsError('CDS päring 401: unauthorized', 401);
        return hours(f, t);
      }
    };
    const r = await loadPoint(pointId, deps);
    expect(r.days).toBeGreaterThan(0);
    expect(used).toEqual(['key-bad', 'key-good']); // halba võtit proovitakse ainult kord, järgmised tükid lähevad kohe heaga
    const a = await credOf(A), b = await credOf(B);
    expect(a.lastError).toBe('Võti ei kehti');
    expect(a.lastUsedAt!.toISOString()).toBe('2026-02-01T00:00:00.000Z'); // ebaõnnestunu lastUsedAt ei muutu
    expect(b.lastUsedAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(b.lastError).toBeNull();
    expect([a.updatedAt.getTime(), b.updatedAt.getTime()]).toEqual(before); // „muudetud“ ei liigu kasutuse märkimisega
    const p = await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } });
    expect(p.failCount).toBe(0);
    expect(p.lastError).toBeNull();
  });
  it('kõik võtmed 403 → viga, failCount kasvab, mõlemad märgitud', async () => {
    await setCred(A, 'k1'); await setCred(B, 'k2');
    const deps: LoaderDeps = { now, fetchHourly: async () => { throw new CdsError('CDS päring 403: x', 403); } };
    await expect(loadPoint(pointId, deps)).rejects.toThrow(/403/);
    expect((await credOf(A)).lastError).toContain('litsentsi');
    expect((await credOf(B)).lastError).toContain('litsentsi');
    expect((await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } })).failCount).toBe(1);
  });
  it('muu viga (500) ei vaheta võtit', async () => {
    await setCred(A, 'k1'); await setCred(B, 'k2');
    const used: string[] = [];
    const deps: LoaderDeps = { now, fetchHourly: async (_c, _f, _t, key) => { used.push(key); throw new CdsError('CDS 500', 500); } };
    await expect(loadPoint(pointId, deps)).rejects.toThrow(/500/);
    expect(used).toHaveLength(1);
    expect((await credOf(A)).lastError ?? null).toBeNull();
  });
});

describe('võtme API', () => {
  const user = (t: string, isAdmin: boolean, extra: object = {}) => ({ id: `u-${t}`, tenantId: t, username: `wc-${isAdmin ? 'admin' : 'user'}`, displayName: null, isAdmin, isFinanceManager: false, mustChangePassword: false, ...extra }) as any;
  async function call(t: string, u: object | null, method: string, body?: unknown) {
    const req = Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]), { headers: {}, socket: {} }) as unknown as IncomingMessage;
    setSessionUserForTest(req, u as any);
    const out = { status: 0, body: '' };
    const res = { statusCode: 200, setHeader() {}, writeHead(c: number) { out.status = c; }, end(ch?: string) { out.body += ch ?? ''; if (!out.status) out.status = (res as any).statusCode; } } as unknown as ServerResponse;
    const handled = await run(t, () => handleWeather(req, res, '/api/weather/credential', method, new URL('http://x/api/weather/credential')));
    expect(handled).toBe(true);
    return { status: out.status, data: out.body ? JSON.parse(out.body) : null, raw: out.body };
  }
  const okFetch = () => vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ jobID: 'j' }), { status: 201 }));
  const KEY = 'secret-token-0123456789abcdef';

  it('GET: tavakasutaja näeb olekut, canEdit=false', async () => {
    const r = await call(A, user(A, false), 'GET');
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ configured: false, canEdit: false, updatedAt: null });
  });
  it('PUT/DELETE: mitte-admin → 403, midagi ei salvestata', async () => {
    const f = okFetch();
    expect((await call(A, user(A, false), 'PUT', { key: KEY })).status).toBe(403);
    expect((await call(A, user(A, false), 'DELETE')).status).toBe(403);
    expect(f).not.toHaveBeenCalled();
    expect(await authDb().tenantWeatherCredential.count({ where: { tenantId: A } })).toBe(0);
  });
  it('PUT: tugivaade → 403', async () => {
    expect((await call(A, user(A, true, { supportView: true }), 'PUT', { key: KEY })).status).toBe(403);
  });
  it('PUT: sobimatu pikkus → 400', async () => {
    okFetch();
    expect((await call(A, user(A, true), 'PUT', { key: 'lühike' })).status).toBe(400);
    expect((await call(A, user(A, true), 'PUT', { key: 'x'.repeat(201) })).status).toBe(400);
    expect((await call(A, user(A, true), 'PUT', {})).status).toBe(400);
  });
  it('PUT: CDS lükkab tagasi → 400 eestikeelse teatega, ei salvestata', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 401 }));
    const r = await call(A, user(A, true), 'PUT', { key: KEY });
    expect(r.status).toBe(400);
    expect(r.data.error).toBe('Võti ei kehti');
    expect(r.raw).not.toContain(KEY);
    expect(await authDb().tenantWeatherCredential.count({ where: { tenantId: A } })).toBe(0);
  });
  it('PUT: õnnestub → krüpteeritult salvestatud, vastuses võtit pole; GET, DELETE', async () => {
    okFetch();
    const r = await call(A, user(A, true), 'PUT', { key: `  ${KEY}  ` });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ configured: true, canEdit: true, updatedBy: 'wc-admin' });
    expect(r.raw).not.toContain(KEY);
    const row = await credOf(A);
    expect(row.cdsKeyEnc).not.toContain(KEY);
    expect(decryptSecret(row.cdsKeyEnc, SK)).toBe(KEY); // trimmitud
    const g = await call(A, user(A, false), 'GET');
    expect(g.data.configured).toBe(true);
    expect(g.raw).not.toContain('cdsKeyEnc');
    const d = await call(A, user(A, true), 'DELETE');
    expect(d.data.configured).toBe(false);
    expect(await authDb().tenantWeatherCredential.count({ where: { tenantId: A } })).toBe(0);
  });
  it('PUT: SECRETS_KEY puudub → selge eestikeelne viga', async () => {
    delete process.env.SECRETS_KEY;
    try {
      const r = await call(A, user(A, true), 'PUT', { key: KEY });
      expect(r.status).toBe(503);
      expect(r.data.error).toContain('SECRETS_KEY');
    } finally { process.env.SECRETS_KEY = SK; }
  });
  it('ettevõtted ei näe üksteise võtit', async () => {
    okFetch();
    await call(A, user(A, true), 'PUT', { key: KEY });
    expect((await call(B, user(B, true), 'GET')).data.configured).toBe(false);
  });
});
