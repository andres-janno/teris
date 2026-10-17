// Kasutajajuhendid: päris andmebaas. Registri võtme olemasolev sisu salvestatakse enne ja taastatakse pärast.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from './db';
import { hashPassword, generateSessionToken, hashToken } from './auth';
import { encryptTotpSecret } from './totp';
import { handlePlatformRequest } from './platformApi';
import { handleHelpRead, isBlankHelp } from './helpArticles';
import { HELP_MAX_LENGTH } from '../help/helpRegistry';

const KEY = 'c'.repeat(64);
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const PID = process.pid;
const USERNAME = `zz-help-${PID}`;
const OPTS = { allowedOrigins: [], platformAllowedOrigins: ['https://admin.teris.ee'] } as any;
const SPOT = 'fields.register.export-csv';
const ORPHAN = `zz-orphan-${PID}`;
let platformUserId = '';
let cookie = '';
let original: { html: string; updatedBy: string | null } | null = null;

function fakeRes() {
  const out = { status: 0, body: '', headers: {} as Record<string, string | string[]> };
  const res = {
    statusCode: 200,
    setHeader(k: string, v: string | string[]) { out.headers[k.toLowerCase()] = v; },
    appendHeader() {},
    writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; if (!out.status) out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  return { res, out };
}

async function call(method: string, path: string, body?: unknown) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(raw ? [Buffer.from(raw)] : []) as any;
  req.method = method;
  req.url = path;
  req.headers = {
    host: 'admin.teris.ee',
    origin: 'https://admin.teris.ee',
    'content-type': 'application/json',
    ...(raw ? { 'content-length': String(Buffer.byteLength(raw)) } : {}),
    cookie
  };
  req.socket = { remoteAddress: '127.0.0.9' };
  const { res, out } = fakeRes();
  await handlePlatformRequest(req as IncomingMessage, res, path, method, new URL(`http://x${path}`), OPTS);
  return { status: out.status, data: out.body ? JSON.parse(out.body) : null };
}

async function readTenantHelp() {
  const { res, out } = fakeRes();
  expect(await handleHelpRead(res, '/api/help', 'GET')).toBe(true);
  return JSON.parse(out.body).articles as Record<string, string>;
}

beforeAll(async () => {
  process.env.PLATFORM_TOTP_KEY = KEY;
  original = await authDb().helpArticle.findUnique({ where: { key: SPOT }, select: { html: true, updatedBy: true } });
  const u = await authDb().platformUser.create({
    data: { username: USERNAME, passwordHash: await hashPassword('x-parool-12345'), totpSecretEnc: encryptTotpSecret(SECRET, KEY) }
  });
  platformUserId = u.id;
  const token = generateSessionToken();
  await authDb().platformSession.create({ data: { platformUserId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) } });
  cookie = `__Host-teris_platform_session=${token}`;
});

afterAll(async () => {
  const db = authDb();
  if (original) await db.helpArticle.upsert({ where: { key: SPOT }, create: { key: SPOT, ...original }, update: original });
  else await db.helpArticle.deleteMany({ where: { key: SPOT } });
  await db.helpArticle.deleteMany({ where: { key: ORPHAN } });
  await db.platformAuditLog.deleteMany({ where: { platformUserId } });
  await db.platformSession.deleteMany({ where: { platformUserId } });
  await db.platformUser.deleteMany({ where: { id: platformUserId } });
});

describe('kasutajajuhendid', () => {
  it('tühjaks loetakse ainult siltidest ja tühikutest koosnev tekst', () => {
    expect(isBlankHelp('<p><br></p>')).toBe(true);
    expect(isBlankHelp('<p>&nbsp; </p>')).toBe(true);
    expect(isBlankHelp('<p>Tere</p>')).toBe(false);
  });

  it('salvestamine, lugemine ettevõtte poolelt ja kustutamine tühja tekstiga', async () => {
    const save = await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p>Ekspordi <strong>tabel</strong></p>' });
    expect(save.status).toBe(200);
    expect(save.data).toEqual({ success: true, deleted: false });

    const list = await call('GET', '/api/platform/help');
    const row = list.data.find((r: { key: string }) => r.key === SPOT);
    expect(row.html).toBe('<p>Ekspordi <strong>tabel</strong></p>');
    expect(row.updatedBy).toBe(USERNAME);
    expect((await readTenantHelp())[SPOT]).toBe('<p>Ekspordi <strong>tabel</strong></p>');

    const audit = await authDb().platformAuditLog.findFirst({ where: { platformUserId, action: 'HELP_UPDATE' } });
    expect(audit?.details).toEqual({ key: SPOT, op: 'save' });

    const del = await call('PUT', `/api/platform/help/${SPOT}`, { html: '<p><br></p>' });
    expect(del.data).toEqual({ success: true, deleted: true });
    expect(await authDb().helpArticle.findUnique({ where: { key: SPOT } })).toBeNull();
    expect((await readTenantHelp())[SPOT]).toBeUndefined();
  });

  it('registrist puuduv võti: salvestada ei saa, ettevõttele ei näidata, kustutada saab', async () => {
    const bad = await call('PUT', `/api/platform/help/${ORPHAN}`, { html: '<p>x</p>' });
    expect(bad.status).toBe(404);

    await authDb().helpArticle.create({ data: { key: ORPHAN, html: '<p>vana</p>' } });
    expect((await readTenantHelp())[ORPHAN]).toBeUndefined();
    const del = await call('PUT', `/api/platform/help/${ORPHAN}`, { html: '' });
    expect(del.data).toEqual({ success: true, deleted: true });
    expect(await authDb().helpArticle.findUnique({ where: { key: ORPHAN } })).toBeNull();
  });

  it('liiga pikk või puuduv tekst → 400', async () => {
    expect((await call('PUT', `/api/platform/help/${SPOT}`, { html: 'x'.repeat(HELP_MAX_LENGTH + 1) })).status).toBe(400);
    expect((await call('PUT', `/api/platform/help/${SPOT}`, {})).status).toBe(400);
  });
});
