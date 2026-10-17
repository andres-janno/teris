// Tugiloa haldus ettevõtte poolel (kaks ajutist ettevõtet live-andmebaasis).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from './db';
import { handleApiRequest } from './apiHandler';
import { hashToken } from './auth';

const A = `test-sg-a-${process.pid}`;
const B = `test-sg-b-${process.pid}`;
const TOKEN_ADMIN = `test-sg-admin-${process.pid}`;
const TOKEN_USER = `test-sg-user-${process.pid}`;
const C = `test-sg-c-${process.pid}`;
const TOKEN_OTHER = `test-sg-other-${process.pid}`;
const TOKEN_EXPIRED = `test-sg-expired-${process.pid}`;
const ORIGIN = 'http://localhost:test';
const FORBIDDEN = 'Ainult admin saab kasutajatoe ligipääsu hallata';

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

beforeAll(async () => {
  await authDb().tenant.createMany({ data: [{ id: A, name: 'Test SG A' }, { id: B, name: 'Test SG B' }, { id: C, name: 'Test SG C' }] });
  await authDb().tenantLicense.createMany({
    data: [A, B].map((t) => ({ tenantId: t, validUntil: new Date('2099-12-31'), modules: ['TELEMETRY' as const] }))
  });
  await authDb().tenantLicense.create({ data: { tenantId: C, validUntil: new Date('2020-01-01'), modules: ['TELEMETRY' as const] } });
  const mk = async (tenantId: string, username: string, isAdmin: boolean, token: string) => {
    const u = await authDb().user.create({ data: { tenantId, username, passwordHash: 'x', isAdmin } });
    await authDb().session.create({ data: { userId: u.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) } });
  };
  await mk(A, `sg-admin-${process.pid}`, true, TOKEN_ADMIN);
  await mk(A, `sg-user-${process.pid}`, false, TOKEN_USER);
  await mk(B, `sg-badmin-${process.pid}`, true, TOKEN_OTHER);
  await mk(C, `sg-cadmin-${process.pid}`, true, TOKEN_EXPIRED);
});

afterAll(async () => {
  const ids = [A, B, C];
  await authDb().supportSession.deleteMany({ where: { targetTenantId: { in: ids } } }).catch((e) => console.error('Puhastus: tugisessioonid', e));
  await authDb().supportAccessLog.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: logi', e));
  await authDb().supportGrant.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: load', e));
  await authDb().session.deleteMany({ where: { user: { tenantId: { in: ids } } } }).catch((e) => console.error('Puhastus: sessioonid', e));
  await authDb().user.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: kasutajad', e));
  await authDb().tenantLicense.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: litsentsid', e));
  await authDb().tenant.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.error('Puhastus: ettevõtted', e));
});

describe('/api/support-grants', () => {
  it('tavakasutaja -> 403', async () => {
    for (const [m, u] of [['GET', '/api/support-grants'], ['POST', '/api/support-grants'], ['GET', '/api/support-access-log'], ['POST', '/api/support-grants/x/revoke']] as const) {
      const r = await call(TOKEN_USER, m, u, m === 'POST' ? { duration: '1h' } : undefined);
      expect(r.status).toBe(403);
      expect(r.json.error).toBe(FORBIDDEN);
    }
  });

  it('vigane kestus -> 400', async () => {
    const r = await call(TOKEN_ADMIN, 'POST', '/api/support-grants', { duration: '2h' });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('Vigane kestus');
  });

  let grantId = '';
  it('admin loob 24h loa ja see on loendis aktiivne', async () => {
    const r = await call(TOKEN_ADMIN, 'POST', '/api/support-grants', { duration: '24h' });
    expect(r.status).toBe(201);
    grantId = r.json.id;
    expect(Math.abs(new Date(r.json.validUntil).getTime() - (Date.now() + 24 * 3600_000))).toBeLessThan(60_000);
    const list = await call(TOKEN_ADMIN, 'GET', '/api/support-grants');
    expect(list.status).toBe(200);
    const g = list.json.find((x: any) => x.id === grantId);
    expect(g.active).toBe(true);
    expect(g.revokedAt).toBeNull();
    expect(g.grantedBy.username).toBe(`sg-admin-${process.pid}`);
  });

  it('aktiivse loa olemasolul uus luba -> 409', async () => {
    const r = await call(TOKEN_ADMIN, 'POST', '/api/support-grants', { duration: '1h' });
    expect(r.status).toBe(409);
    expect(r.json.error).toBe('Kasutajatoel on juba kehtiv ligipääs');
  });

  it('vigane loa ID kodeering -> 404', async () => {
    const r = await call(TOKEN_ADMIN, 'POST', '/api/support-grants/%E0%A4%A/revoke');
    expect(r.status).toBe(404);
  });

  it('teise ettevõtte loa tühistamine -> 404', async () => {
    const r = await call(TOKEN_OTHER, 'POST', `/api/support-grants/${grantId}/revoke`);
    expect(r.status).toBe(404);
  });

  it('tühistamine -> active false ja tugisessioon kustub; kordus on muutmata', async () => {
    await authDb().supportSession.create({
      data: { supportGrantId: grantId, targetTenantId: A, platformUserId: 'sg-test', handoffExpiresAt: new Date(Date.now() + 60_000), expiresAt: new Date(Date.now() + 3600_000) }
    });
    const r = await call(TOKEN_ADMIN, 'POST', `/api/support-grants/${grantId}/revoke`);
    expect(r.status).toBe(200);
    expect(r.json.active).toBe(false);
    expect(await authDb().supportSession.count({ where: { supportGrantId: grantId } })).toBe(0);
    const again = await call(TOKEN_ADMIN, 'POST', `/api/support-grants/${grantId}/revoke`);
    expect(again.status).toBe(200);
    expect(again.json.revokedAt).toBe(r.json.revokedAt);
    const list = await call(TOKEN_ADMIN, 'GET', '/api/support-grants');
    expect(list.json.find((x: any) => x.id === grantId).active).toBe(false);
  });

  it('sisenemiste logi on tühi', async () => {
    const r = await call(TOKEN_ADMIN, 'GET', '/api/support-access-log');
    expect(r.status).toBe(200);
    expect(r.json).toEqual([]);
  });

  it('aegunud litsentsiga ettevõttes saab loa tühistada, kuid mitte luua', async () => {
    const g = await authDb().supportGrant.create({
      data: { tenantId: C, grantedByUserId: (await authDb().user.findFirstOrThrow({ where: { tenantId: C } })).id, validUntil: new Date(Date.now() + 3600_000) }
    });
    const create = await call(TOKEN_EXPIRED, 'POST', '/api/support-grants', { duration: '1h' });
    expect(create.status).toBe(403);
    const r = await call(TOKEN_EXPIRED, 'POST', `/api/support-grants/${g.id}/revoke`);
    expect(r.status).toBe(200);
    expect(r.json.active).toBe(false);
  });
});
