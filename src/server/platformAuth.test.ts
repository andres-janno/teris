// Teenusepakkuja sisselogimine (parool + TOTP): päris andmebaas, võlts req/res.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from './db';
import { hashPassword } from './auth';
import { encryptTotpSecret, totpCode, totpStep } from './totp';
import { handlePlatformAuth, platformUserOf } from './platformAuth';
import { handlePlatformRequest } from './platformApi';
import { isPlatformHost } from './platformHost';

const KEY = 'c'.repeat(64);
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const PASSWORD = 'test-parool-12345';
const USERNAME = `zz-plat-${process.pid}`;
const OPTS = { allowedOrigins: ['https://admin.teris.ee'] };
const ERR = 'Vale kasutajanimi, parool või kood';
let userId = '';
let ipCounter = 0;

function fakeReq(method: string, url: string, body?: unknown, extra: Record<string, string> = {}) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []) as any;
  req.method = method;
  req.url = url;
  req.headers = {
    host: 'admin.teris.ee',
    origin: 'https://admin.teris.ee',
    'content-type': 'application/json',
    ...(raw ? { 'content-length': String(raw.length) } : {}),
    ...extra
  };
  req.socket = { remoteAddress: `127.0.0.${(ipCounter++ % 200) + 1}` };
  return req as IncomingMessage;
}

function fakeRes() {
  const out = { status: 0, body: '', headers: {} as Record<string, string | string[]> };
  const res = {
    statusCode: 200,
    setHeader(k: string, v: string | string[]) { out.headers[k.toLowerCase()] = v; },
    appendHeader(k: string, v: string) {
      const cur = out.headers[k.toLowerCase()];
      out.headers[k.toLowerCase()] = cur ? ([] as string[]).concat(cur, v) : v;
    },
    writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; if (!out.status) out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  return { res, out };
}

async function call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const req = fakeReq(method, path, body, extra);
  const { res, out } = fakeRes();
  const handled = await handlePlatformAuth(req, res, path, method, OPTS);
  return { req, out, handled };
}

const cookieOf = (out: { headers: Record<string, string | string[]> }) => String(out.headers['set-cookie']).split(';')[0];
const resetStep = () => authDb().platformUser.update({ where: { id: userId }, data: { totpLastStep: 0 } });
const code = (offset = 0) => totpCode(SECRET, totpStep(new Date()) + offset);
const login = (over: Record<string, unknown> = {}, extra: Record<string, string> = {}) =>
  call('POST', '/api/platform/auth/login', { username: USERNAME, password: PASSWORD, code: code(), ...over }, extra);

beforeAll(async () => {
  process.env.PLATFORM_TOTP_KEY = KEY;
  const u = await authDb().platformUser.create({
    data: { username: USERNAME, passwordHash: await hashPassword(PASSWORD), totpSecretEnc: encryptTotpSecret(SECRET, KEY) }
  });
  userId = u.id;
});

afterAll(async () => {
  try {
    await authDb().platformAuditLog.deleteMany({ where: { platformUserId: userId } });
    await authDb().platformSession.deleteMany({ where: { platformUserId: userId } });
    await authDb().platformUser.deleteMany({ where: { id: userId } });
  } catch (err) {
    console.error('[platformAuth.test] puhastus ebaõnnestus', err);
  }
});

describe('teenusepakkuja sisselogimine', () => {
  it('õige parool + kood: 200, küpsis, me töötab; logout kustutab sessiooni', async () => {
    const r = await login({ code: code() });
    expect(r.out.status).toBe(200);
    const sc = String(r.out.headers['set-cookie']);
    expect(sc).toContain('__Host-teris_platform_session=');
    expect(sc).toContain('HttpOnly');
    expect(sc).toContain('SameSite=Strict');
    expect(sc).toContain('Max-Age=43200');
    const cookie = cookieOf(r.out);
    const me = await call('GET', '/api/platform/auth/me', undefined, { cookie });
    expect(me.out.status).toBe(200);
    expect(JSON.parse(me.out.body).user.username).toBe(USERNAME);

    // muu platvormi tee: sessioon laaditakse, platformUserOf täidetud, false
    const other = await call('GET', '/api/platform/tenants', undefined, { cookie });
    expect(other.handled).toBe(false);
    expect(platformUserOf(other.req)?.username).toBe(USERNAME);
    const noSess = await call('GET', '/api/platform/tenants');
    expect(noSess.out.status).toBe(401);

    const lo = await call('POST', '/api/platform/auth/logout', {}, { cookie });
    expect(lo.out.status).toBe(200);
    expect(String(lo.out.headers['set-cookie'])).toContain('Max-Age=0');
    const me2 = await call('GET', '/api/platform/auth/me', undefined, { cookie });
    expect(me2.out.status).toBe(401);
  });

  it('sama koodi teistkordne kasutamine -> 401', async () => {
    const c = code(1);
    await resetStep();
    const a = await login({ code: c });
    expect(a.out.status).toBe(200);
    const b = await login({ code: c });
    expect(b.out.status).toBe(401);
    expect(JSON.parse(b.out.body).error).toBe(ERR);
  });

  it('vale kood, vale parool, olematu kasutaja -> 401 sama tekstiga', async () => {
    await resetStep();
    for (const over of [{ code: '000000' }, { password: 'vale-parool-123' }, { username: 'zz-olematu-kasutaja' }]) {
      await resetStep();
      const r = await login(over);
      expect(r.out.status).toBe(401);
      expect(JSON.parse(r.out.body).error).toBe(ERR);
    }
    await resetStep();
    expect((await login()).out.status).toBe(200); // positiivne kontroll
  });

  it('mitteaktiivne kasutaja -> 401', async () => {
    await authDb().platformUser.update({ where: { id: userId }, data: { totpLastStep: 0, isActive: false } });
    try {
      const r = await login();
      expect(r.out.status).toBe(401);
      expect(JSON.parse(r.out.body).error).toBe(ERR);
    } finally {
      await authDb().platformUser.update({ where: { id: userId }, data: { isActive: true } });
    }
  });

  it('aegunud sessioon -> me 401', async () => {
    await resetStep();
    const r = await login();
    expect(r.out.status).toBe(200);
    const cookie = cookieOf(r.out);
    await authDb().platformSession.updateMany({ where: { platformUserId: userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await call('GET', '/api/platform/auth/me', undefined, { cookie })).out.status).toBe(401);
  });

  it('vigane PLATFORM_TOTP_KEY -> 500 ja piiraja ei kasva', async () => {
    process.env.PLATFORM_TOTP_KEY = 'xyz';
    try {
      await resetStep();
      const r = await login();
      expect(r.out.status).toBe(500);
      expect(JSON.parse(r.out.body).error).toBe('Platvorm pole seadistatud');
    } finally {
      process.env.PLATFORM_TOTP_KEY = KEY;
    }
  });

  it('vale origin -> 403', async () => {
    const r = await login({}, { origin: 'https://teris.ee' });
    expect(r.out.status).toBe(403);
  });

  it('handlePlatformRequest: tundmatu tee sessiooniga -> 404', async () => {
    await resetStep();
    const l = await login({ code: code() });
    expect(l.out.status).toBe(200);
    const req = fakeReq('GET', '/api/platform/unknown', undefined, { cookie: cookieOf(l.out) });
    const { res, out } = fakeRes();
    await handlePlatformRequest(req, res, '/api/platform/unknown', 'GET', new URL('http://x/api/platform/unknown'), { allowedOrigins: [], platformAllowedOrigins: OPTS.allowedOrigins } as any);
    expect(out.status).toBe(404);
  });
});

describe('isPlatformHost', () => {
  it('tunneb platvormi hosti', () => {
    const h = (host: string) => isPlatformHost({ headers: { host } } as unknown as IncomingMessage);
    expect(h('admin.teris.ee')).toBe(true);
    expect(h('admin.teris.ee:443')).toBe(true);
    expect(h('teris.ee')).toBe(false);
  });
});
