// Seadme omandiperioodid: syncOwnership ja seadme registreerimise API (kaks ajutist ettevõtet live-andmebaasis).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { syncOwnership } from './deviceOwnership';
import { handleApiRequest } from './apiHandler';
import { hashToken } from './auth';
import { IMEI_ERROR } from './deviceIdentifiers';

const A = `test-own-a-${process.pid}`;
const B = `test-own-b-${process.pid}`;
const I1 = '490154203237518';
const I2 = '356938035643809';
const TOKEN_A = `test-token-a-${process.pid}`;
const TOKEN_B = `test-token-b-${process.pid}`;
const ORIGIN = 'http://localhost:test';
const TAKEN = 'Seade on juba registreeritud — võtke ühendust kasutajatoega';

function fakeRes() {
  const out = { status: 0, body: '' };
  const res = {
    statusCode: 200,
    setHeader() {},
    appendHeader() {},
    writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  return { res, out };
}

async function call(token: string, method: string, url: string, body?: unknown) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Object.assign(Readable.from(raw ? [Buffer.from(raw)] : []), {
    method, url,
    headers: {
      host: 'localhost', origin: ORIGIN, cookie: `teris_session=${token}`,
      'content-type': 'application/json', 'content-length': String(Buffer.byteLength(raw))
    },
    socket: {}
  }) as unknown as IncomingMessage;
  const { res, out } = fakeRes();
  await handleApiRequest(req, res, { allowedOrigins: [ORIGIN], requireAuth: true, platformAllowedOrigins: [] });
  return { status: out.status, json: out.body ? JSON.parse(out.body) : null };
}

const rows = (t: string, identifier?: string) =>
  runAsTenant(t, async () => await prisma.deviceOwnership.findMany({ where: identifier ? { identifier } : {}, orderBy: { validFrom: 'asc' } }));

beforeAll(async () => {
  // Kontroll: katse-IMEId ei tohi päris seadmete hulgas olla
  const existing = await authDb().telemetryDevice.count({ where: { imei: { in: [I1, I2] } } });
  if (existing) throw new Error('Test-IMEI on juba kasutusel');
  await authDb().tenant.createMany({ data: [{ id: A, name: 'Test Own A' }, { id: B, name: 'Test Own B' }] });
  await authDb().tenantLicense.createMany({
    data: [A, B].map((t) => ({ tenantId: t, validUntil: new Date('2099-12-31'), modules: ['TELEMETRY' as const] }))
  });
  for (const [t, tok] of [[A, TOKEN_A], [B, TOKEN_B]] as const) {
    const u = await authDb().user.create({ data: { tenantId: t, username: `own-admin-${t}`, passwordHash: 'x', isAdmin: true } });
    await authDb().session.create({ data: { userId: u.id, tokenHash: hashToken(tok), expiresAt: new Date(Date.now() + 3600_000) } });
  }
});

afterAll(async () => {
  const ids = [A, B];
  await authDb().deviceOwnership.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: omandiread', e));
  await authDb().telemetryDevice.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: seadmed', e));
  await authDb().session.deleteMany({ where: { user: { tenantId: { in: ids } } } }).catch((e) => console.error('Puhastus: sessioonid', e));
  await authDb().user.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: kasutajad', e));
  await authDb().tenantLicense.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: litsentsid', e));
  await authDb().tenant.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.error('Puhastus: ettevõtted', e));
});

const inTx = <T>(fn: Parameters<typeof tenantTransaction<T>>[0]) => runAsTenant(A, async () => await tenantTransaction(fn));

describe('syncOwnership', () => {
  it('uus seade avab IMEI perioodi', async () => {
    await inTx((tx) => syncOwnership(tx, null, { id: 'd1', imei: I1, macAddress: null }));
    const r = await rows(A, I1);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: 'IMEI', validTo: null, deviceId: 'd1' });
  });

  it('IMEI vahetus sulgeb vana ja avab uue', async () => {
    const now = new Date('2030-01-01T00:00:00Z');
    await inTx((tx) => syncOwnership(tx, { imei: I1, macAddress: null }, { id: 'd1', imei: I2, macAddress: null }, now));
    expect((await rows(A, I1))[0].validTo).toEqual(now);
    const r2 = await rows(A, I2);
    expect(r2).toHaveLength(1);
    expect(r2[0].validTo).toBeNull();
  });

  it('muutumatu tunnus ei muuda ridu', async () => {
    const before = (await rows(A)).length;
    await inTx((tx) => syncOwnership(tx, { imei: I2, macAddress: null }, { id: 'd1', imei: I2, macAddress: null }));
    expect((await rows(A)).length).toBe(before);
  });

  it('kustutamine sulgeb perioodi', async () => {
    const now = new Date('2031-01-01T00:00:00Z');
    await inTx((tx) => syncOwnership(tx, { imei: I2, macAddress: null }, null, now));
    expect((await rows(A, I2))[0].validTo).toEqual(now);
  });
});

describe('POST /api/fleet/devices', () => {
  const body = (imei: unknown) => ({ id: `dev-${process.pid}`, connectivityType: 'cellular', model: 'T', imei });

  it('vigane IMEI -> 400', async () => {
    const r = await call(TOKEN_A, 'POST', '/api/fleet/devices', body('123456789012345'));
    expect(r.status).toBe(400);
    expect(r.json.error).toBe(IMEI_ERROR);
  });

  it('vigane MAC -> 400', async () => {
    const r = await call(TOKEN_A, 'POST', '/api/fleet/devices', { id: 'x', connectivityType: 'eye_sensor', model: 'T', macAddress: 'zz' });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('Vigane MAC-aadress');
  });

  it('A registreerib -> 200 ja omandirida; B sama IMEI -> 409; kustutamine sulgeb perioodi', async () => {
    const ok = await call(TOKEN_A, 'POST', '/api/fleet/devices', body(I1));
    expect(ok.status).toBe(200);
    expect((await rows(A, I1)).filter((x) => x.validTo === null)).toHaveLength(1);

    const taken = await call(TOKEN_B, 'POST', '/api/fleet/devices', { ...body(I1), id: `dev-b-${process.pid}` });
    expect(taken.status).toBe(409);
    expect(taken.json.error).toBe(TAKEN);
    expect(await rows(B)).toHaveLength(0);

    const del = await call(TOKEN_A, 'DELETE', `/api/fleet/devices/dev-${process.pid}`);
    expect(del.status).toBe(200);
    expect((await rows(A, I1)).filter((x) => x.validTo === null)).toHaveLength(0);
  });
});
