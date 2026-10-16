// Sessiooni kehtivus: peatatud või puuduva ettevõtte kasutaja sessioon ei kehti.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authDb } from './db';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { findActiveSession, authGate } from './authGate';
import { hashToken, verifyPassword, hashPassword } from './auth';

const T = `test-sess-tenant-${process.pid}`;
const U = `test-sess-user-${process.pid}`;
process.env.MAIL_DISABLED = '1';
const TOKEN = hashToken(`test-sess-token-${process.pid}`);

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Sessioonitest', status: 'ACTIVE' } });
  await authDb().user.create({ data: { id: U, username: U, passwordHash: 'x', tenantId: T } });
  await authDb().session.create({ data: { userId: U, tokenHash: TOKEN, expiresAt: new Date(Date.now() + 3600_000) } });
});

afterAll(async () => {
  await authDb().session.deleteMany({ where: { userId: U } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().user.deleteMany({ where: { id: U } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().tenant.deleteMany({ where: { id: T } }).catch((e) => console.error('Testi puhastus', e));
});

describe('findActiveSession', () => {
  it('aktiivse ettevõtte sessioon kehtib', async () => {
    const s = await findActiveSession(TOKEN);
    expect(s?.user.id).toBe(U);
    expect(s?.user.tenantId).toBe(T);
  });
  it('peatatud ettevõtte sessioon ei kehti', async () => {
    await authDb().tenant.update({ where: { id: T }, data: { status: 'SUSPENDED' } });
    expect(await findActiveSession(TOKEN)).toBeNull();
    await authDb().tenant.update({ where: { id: T }, data: { status: 'ACTIVE' } });
  });
  it('tundmatu token ei kehti', async () => {
    expect(await findActiveSession(hashToken('olematu'))).toBeNull();
  });
});

// Paroolivood: peatatud ettevõtte kasutajale ei looda linke ega võeta neid vastu.
const ORIGIN = 'https://app.teris.ee';

async function authPost(path: string, body: unknown, ip: string) {
  const raw = JSON.stringify(body);
  const req = Readable.from([Buffer.from(raw)]) as any;
  req.method = 'POST';
  req.url = path;
  req.headers = {
    host: 'app.teris.ee',
    origin: ORIGIN,
    'content-type': 'application/json',
    'content-length': String(raw.length)
  };
  req.socket = { remoteAddress: ip };
  const out = { status: 0, body: '' };
  const res = {
    statusCode: 200,
    setHeader() {},
    appendHeader() {},
    writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; if (!out.status) out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  await authGate(req as IncomingMessage, res, path, 'POST', { allowedOrigins: [ORIGIN] } as any);
  return { status: out.status, data: out.body ? JSON.parse(out.body) : null };
}

describe('peatatud ettevõtte paroolivood', () => {
  const PT = `test-pw-tenant-${process.pid}`;
  const PU = `test-pw-user-${process.pid}`;
  const RAW = `test-pw-raw-${process.pid}`;
  const NEWPW = 'Uus-Parool-12345!';
  let oldHash = '';

  beforeAll(async () => {
    oldHash = await hashPassword('Vana-Parool-12345!');
    await authDb().tenant.create({ data: { id: PT, name: 'Paroolitest', status: 'ACTIVE' } });
    await authDb().user.create({ data: { id: PU, username: PU, email: `${PU}@example.com`, passwordHash: oldHash, tenantId: PT } });
  });

  afterAll(async () => {
    await authDb().passwordToken.deleteMany({ where: { userId: PU } }).catch((e) => console.error('Testi puhastus', e));
    await authDb().session.deleteMany({ where: { userId: PU } }).catch((e) => console.error('Testi puhastus', e));
    await authDb().user.deleteMany({ where: { id: PU } }).catch((e) => console.error('Testi puhastus', e));
    await authDb().tenant.deleteMany({ where: { id: PT } }).catch((e) => console.error('Testi puhastus', e));
  });

  it('forgot: aktiivse ettevõtte kasutajale tekib token, peatatule mitte (sama vastus)', async () => {
    const ok = await authPost('/api/auth/forgot', { login: PU }, '10.9.0.1');
    expect(ok).toEqual({ status: 200, data: { success: true } });
    await new Promise((r) => setTimeout(r, 300));
    expect(await authDb().passwordToken.count({ where: { userId: PU } })).toBe(1);
    await authDb().passwordToken.deleteMany({ where: { userId: PU } });

    await authDb().tenant.update({ where: { id: PT }, data: { status: 'SUSPENDED' } });
    const sus = await authPost('/api/auth/forgot', { login: PU }, '10.9.0.2');
    expect(sus).toEqual({ status: 200, data: { success: true } });
    await new Promise((r) => setTimeout(r, 300));
    expect(await authDb().passwordToken.count({ where: { userId: PU } })).toBe(0);
  });

  it('set-password ja token: peatatud ettevõtte kehtiv token ei kehti, parool ei muutu', async () => {
    await authDb().tenant.update({ where: { id: PT }, data: { status: 'SUSPENDED' } });
    await authDb().passwordToken.create({
      data: { userId: PU, purpose: 'RESET', tokenHash: hashToken(RAW), expiresAt: new Date(Date.now() + 3600_000) }
    });
    const chk = await authPost('/api/auth/token', { token: RAW }, '10.9.0.3');
    expect(chk.status).toBe(400);
    expect(chk.data.error).toBe('Link on aegunud või juba kasutatud');
    const r = await authPost('/api/auth/set-password', { token: RAW, password: NEWPW }, '10.9.0.3');
    expect(r.status).toBe(400);
    expect(r.data.error).toBe('Link on aegunud või juba kasutatud');
    const user = await authDb().user.findUnique({ where: { id: PU } });
    expect(user?.passwordHash).toBe(oldHash);
    expect(await verifyPassword(NEWPW, user!.passwordHash)).toBe(false);
    expect(await authDb().passwordToken.count({ where: { userId: PU, usedAt: null } })).toBe(1);

    await authDb().tenant.update({ where: { id: PT }, data: { status: 'ACTIVE' } });
    expect((await authPost('/api/auth/token', { token: RAW }, '10.9.0.3')).status).toBe(200);
  });
});
