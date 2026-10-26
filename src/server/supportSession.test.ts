// Tugisessioon ettevõtte rakenduses: ühekordne üleandmislink, ainult lugemine, loa tühistamine.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Readable } from 'stream';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb } from './db';
import { handleApiRequest } from './apiHandler';
import { hashToken } from './auth';

const T = `test-ss-t-${process.pid}`;
const T_SUSP = `test-ss-s-${process.pid}`;
const ORIGIN = 'http://localhost:test';
const READ_ONLY = 'Tugivaade on ainult lugemiseks';
const LINK_ERR = 'Tugivaate link on aegunud või juba kasutatud';
const PU = `ss-support-${process.pid}`;

function fakeRes() {
  const out = { status: 0, body: '', cookies: [] as string[] };
  const res = {
    statusCode: 200,
    setHeader(k: string, v: string | string[]) { if (k.toLowerCase() === 'set-cookie') out.cookies = ([] as string[]).concat(v); },
    appendHeader(k: string, v: string | string[]) { if (k.toLowerCase() === 'set-cookie') out.cookies.push(...([] as string[]).concat(v)); },
    writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  return { res, out };
}

async function call(cookie: string | null, method: string, url: string, body?: unknown) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const headers: Record<string, string> = {
    host: 'localhost', origin: ORIGIN, 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(raw))
  };
  if (cookie) headers.cookie = cookie;
  const req = Object.assign(Readable.from(raw ? [Buffer.from(raw)] : []), { method, url, headers, socket: {} }) as unknown as IncomingMessage;
  const { res, out } = fakeRes();
  await handleApiRequest(req, res, { allowedOrigins: [ORIGIN], requireAuth: true, platformAllowedOrigins: [] });
  return { status: out.status, json: out.body ? JSON.parse(out.body) : null, cookies: out.cookies };
}

let grantId = '';
let suspGrantId = '';
let platformUserId = '';
let n = 0;
async function newHandoff(opts: { expiresInMs?: number; tenant?: string; grant?: string } = {}) {
  const token = `ss-handoff-${process.pid}-${++n}`;
  await authDb().supportSession.create({
    data: {
      targetTenantId: opts.tenant ?? T, supportGrantId: opts.grant ?? grantId, platformUserId,
      handoffTokenHash: hashToken(token), handoffExpiresAt: new Date(Date.now() + (opts.expiresInMs ?? 60_000))
    }
  });
  return token;
}
const cookieOf = (cookies: string[]) => cookies.find((c) => c.startsWith('teris_support_session='))!.split(';')[0];

async function login(token: string) {
  const r = await call(null, 'POST', '/api/auth/support-login', { token });
  return { r, cookie: r.status === 200 ? cookieOf(r.cookies) : '' };
}

async function login0(cookie: string, token: string) {
  const r = await call(cookie, 'POST', '/api/auth/support-login', { token });
  return { r, cookie: r.status === 200 ? cookieOf(r.cookies) : '' };
}

beforeAll(async () => {
  await authDb().tenant.createMany({ data: [{ id: T, name: 'Test SS' }, { id: T_SUSP, name: 'Test SS susp', status: 'SUSPENDED' as any }] });
  await authDb().tenantLicense.createMany({
    data: [T, T_SUSP].map((t) => ({ tenantId: t, validUntil: new Date('2099-12-31'), modules: ['TELEMETRY', 'SATELLITE', 'WEATHER'] as any }))
  });
  const admin = await authDb().user.create({ data: { tenantId: T, username: `ss-admin-${process.pid}`, passwordHash: 'x', isAdmin: true } });
  const adminS = await authDb().user.create({ data: { tenantId: T_SUSP, username: `ss-sadmin-${process.pid}`, passwordHash: 'x', isAdmin: true } });
  const g = await authDb().supportGrant.create({ data: { tenantId: T, grantedByUserId: admin.id, validUntil: new Date(Date.now() + 3600_000) } });
  grantId = g.id;
  const gs = await authDb().supportGrant.create({ data: { tenantId: T_SUSP, grantedByUserId: adminS.id, validUntil: new Date(Date.now() + 3600_000) } });
  suspGrantId = gs.id;
  const pu = await authDb().platformUser.create({ data: { username: PU, passwordHash: 'x', totpSecretEnc: 'x' } });
  platformUserId = pu.id;
});

afterAll(async () => {
  const ids = [T, T_SUSP];
  await authDb().supportSession.deleteMany({ where: { targetTenantId: { in: ids } } }).catch((e) => console.error('Puhastus: tugisessioonid', e));
  await authDb().supportAccessLog.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: logi', e));
  await authDb().supportGrant.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: load', e));
  await authDb().season.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: hooajad', e));
  await authDb().session.deleteMany({ where: { user: { tenantId: { in: ids } } } }).catch((e) => console.error('Puhastus: sessioonid', e));
  await authDb().user.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: kasutajad', e));
  await authDb().platformUser.deleteMany({ where: { username: PU } }).catch((e) => console.error('Puhastus: platvormi kasutaja', e));
  await authDb().tenantLicense.deleteMany({ where: { tenantId: { in: ids } } }).catch((e) => console.error('Puhastus: litsentsid', e));
  await authDb().tenant.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.error('Puhastus: ettevõtted', e));
});

describe('tugisessioon', () => {
  // Eelmine test võib olla peamise loa tühistanud
  beforeEach(async () => {
    await authDb().supportGrant.update({ where: { id: grantId }, data: { revokedAt: null } });
  });

  it('kehtiv token -> 200, küpsis, logi, handoff tühjendatud; kordus -> 400', async () => {
    const token = await newHandoff();
    const { r } = await login(token);
    expect(r.status).toBe(200);
    expect(r.json.user.supportView).toBe(true);
    expect(r.json.user.username).toBe('kasutajatugi');
    expect(new Date(r.json.user.supportValidUntil).getTime()).toBeGreaterThan(Date.now());
    const c = r.cookies.find((x) => x.startsWith('teris_support_session='))!;
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Path=/');
    expect(c).toMatch(/Max-Age=\d+/);
    const rows = await authDb().supportSession.findMany({ where: { targetTenantId: T, sessionTokenHash: { not: null } } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((s) => s.handoffTokenHash === null)).toBe(true);
    const logs = await authDb().supportAccessLog.findMany({ where: { tenantId: T } });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].platformUsername).toBe(PU);
    expect(logs[0].supportGrantId).toBe(grantId);
    const again = await call(null, 'POST', '/api/auth/support-login', { token });
    expect(again.status).toBe(400);
    expect(again.json.error).toBe(LINK_ERR);
  });

  it('aegunud üleandmistoken -> 400; tundmatu token -> 400; ilma tokenita -> 400', async () => {
    const token = await newHandoff({ expiresInMs: -1000 });
    expect((await call(null, 'POST', '/api/auth/support-login', { token })).status).toBe(400);
    expect((await call(null, 'POST', '/api/auth/support-login', { token: 'tundmatu' })).status).toBe(400);
    expect((await call(null, 'POST', '/api/auth/support-login', {})).status).toBe(400);
  });

  it('peatatud ettevõte -> 400 ja token jääb kasutamata', async () => {
    const token = await newHandoff({ tenant: T_SUSP, grant: suspGrantId });
    const r = await call(null, 'POST', '/api/auth/support-login', { token });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe(LINK_ERR);
  });

  it('tühistatud luba -> exchange 400', async () => {
    const g = await authDb().supportGrant.create({ data: { tenantId: T, grantedByUserId: (await authDb().user.findFirst({ where: { tenantId: T } }))!.id, validUntil: new Date(Date.now() + 3600_000), revokedAt: new Date() } });
    const token = await newHandoff({ grant: g.id });
    expect((await call(null, 'POST', '/api/auth/support-login', { token })).status).toBe(400);
  });

  it('tugiküpsisega GET andmed + me; kirjutamine 403; parool 403', async () => {
    const { cookie } = await login(await newHandoff());
    expect((await call(cookie, 'GET', '/api/seasons')).status).toBe(200);
    const me = await call(cookie, 'GET', '/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.json.user.supportView).toBe(true);
    expect(me.json.user.isAdmin).toBe(true);
    expect(me.json.user.displayName).toBe('Kasutajatugi');
    expect((await call(cookie, 'GET', '/api/admin/users')).status).toBe(200);
    const post = await call(cookie, 'POST', '/api/seasons', { year: 2099, name: 'x' });
    expect(post.status).toBe(403);
    expect(post.json.code).toBe('SUPPORT_READ_ONLY');
    expect(post.json.error).toBe(READ_ONLY);
    for (const url of ['/api/auth/password', '/api/auth/forgot', '/api/auth/set-password', '/api/auth/token']) {
      const r = await call(cookie, 'POST', url, { currentPassword: 'a', newPassword: 'b', login: 'a', token: 'a', password: 'a' });
      expect(r.status).toBe(403);
      expect(r.json.error).toBe(READ_ONLY);
    }
    // loa tühistamine tugivaatest ei ole lubatud
    const rev = await call(cookie, 'POST', `/api/support-grants/${grantId}/revoke`);
    expect(rev.status).toBe(403);
    expect(rev.json.code).toBe('SUPPORT_READ_ONLY');
    for (const m of ['PUT', 'PATCH', 'DELETE']) {
      const r = await call(cookie, m, '/api/seasons/1', {});
      expect(r.status).toBe(403);
      expect(r.json.code).toBe('SUPPORT_READ_ONLY');
    }
    expect(await authDb().season.count({ where: { tenantId: T } })).toBe(0);
  });

  it('ei näe teise ettevõtte andmeid', async () => {
    const { cookie } = await login(await newHandoff());
    const status = await call(cookie, 'GET', '/api/status');
    expect(status.status).toBe(200);
    expect(status.json.counts.fields).toBe(0);
    const mf = await call(cookie, 'GET', '/api/master-fields');
    expect(mf.status).toBe(200);
  });

  it('tavaline sessioon on eelistatud tugiküpsise ees', async () => {
    const { cookie } = await login(await newHandoff());
    const u = await authDb().user.findFirst({ where: { tenantId: T } });
    const tok = `ss-normal-${process.pid}`;
    await authDb().session.create({ data: { userId: u!.id, tokenHash: hashToken(tok), expiresAt: new Date(Date.now() + 3600_000) } });
    const me = await call(`teris_session=${tok}; ${cookie}`, 'GET', '/api/auth/me');
    expect(me.json.user.supportView).toBeUndefined();
    expect(me.json.user.username).toBe(u!.username);
  });

  it('edukas vahetus kustutab päringus oleva vana tugisessiooni rea', async () => {
    const { cookie: oldCookie } = await login(await newHandoff());
    const oldHash = hashToken(oldCookie.split('=')[1]);
    expect(await authDb().supportSession.findUnique({ where: { sessionTokenHash: oldHash } })).not.toBeNull();
    const { r, cookie: newCookie } = await login0(oldCookie, await newHandoff());
    expect(r.status).toBe(200);
    expect(newCookie).not.toBe(oldCookie);
    expect(await authDb().supportSession.findUnique({ where: { sessionTokenHash: oldHash } })).toBeNull();
    expect(await authDb().supportSession.findUnique({ where: { sessionTokenHash: hashToken(newCookie.split('=')[1]) } })).not.toBeNull();
  });

  it('ebaõnnestunud vahetus jätab vana tugisessiooni alles', async () => {
    const { cookie: oldCookie } = await login(await newHandoff());
    const oldHash = hashToken(oldCookie.split('=')[1]);
    const r = await call(oldCookie, 'POST', '/api/auth/support-login', { token: 'tundmatu' });
    expect(r.status).toBe(400);
    expect(await authDb().supportSession.findUnique({ where: { sessionTokenHash: oldHash } })).not.toBeNull();
  });

  it('kehtiv tavasessioon -> support-login 409', async () => {
    const u = await authDb().user.findFirst({ where: { tenantId: T } });
    const tok = `ss-409-${process.pid}`;
    await authDb().session.create({ data: { userId: u!.id, tokenHash: hashToken(tok), expiresAt: new Date(Date.now() + 3600_000) } });
    const r = await call(`teris_session=${tok}`, 'POST', '/api/auth/support-login', { token: await newHandoff() });
    expect(r.status).toBe(409);
    expect(r.cookies.length).toBe(0);
  });

  it('sessiooni lõpp ei ületa loa lõppu', async () => {
    const { r } = await login(await newHandoff());
    const until = new Date(r.json.user.supportValidUntil).getTime();
    const g = await authDb().supportGrant.findUnique({ where: { id: grantId } });
    expect(until).toBeLessThanOrEqual(g!.validUntil.getTime());
  });

  it('logout kustutab küpsise ja sessiooni', async () => {
    const { cookie } = await login(await newHandoff());
    const out = await call(cookie, 'POST', '/api/auth/logout');
    expect(out.status).toBe(200);
    expect(out.cookies.some((c) => c.startsWith('teris_support_session=;') && c.includes('Max-Age=0'))).toBe(true);
    expect(out.cookies.some((c) => c.startsWith('teris_session=;') && c.includes('Max-Age=0'))).toBe(true);
    expect((await call(cookie, 'GET', '/api/auth/me')).status).toBe(401);
    expect(await authDb().supportSession.count({ where: { sessionTokenHash: hashToken(cookie.split('=')[1]) } })).toBe(0);
  });

  it('loa tühistamine -> järgmine päring 401', async () => {
    const { cookie } = await login(await newHandoff());
    expect((await call(cookie, 'GET', '/api/seasons')).status).toBe(200);
    await authDb().supportGrant.update({ where: { id: grantId }, data: { revokedAt: new Date() } });
    expect((await call(cookie, 'GET', '/api/seasons')).status).toBe(401);
  });

  it('mitteaktiivne platvormi kasutaja: vahetus 400; kehtiv sessioon -> 401', async () => {
    const { cookie } = await login(await newHandoff());
    expect((await call(cookie, 'GET', '/api/seasons')).status).toBe(200);
    const pending = await newHandoff();
    await authDb().platformUser.update({ where: { id: platformUserId }, data: { isActive: false } });
    expect((await call(null, 'POST', '/api/auth/support-login', { token: pending })).status).toBe(400);
    expect((await call(cookie, 'GET', '/api/seasons')).status).toBe(401);
    await authDb().platformUser.update({ where: { id: platformUserId }, data: { isActive: true } });
  });

  it('GET /api/field-works ei kirjuta (ei tugivaates ega tavaliselt) — kultuuri ei pärita eelmisest aastast', async () => {
    const u = await authDb().user.findFirst({ where: { tenantId: T } });
    const year = new Date().getFullYear();
    const field = await authDb().field.create({ data: { tenantId: T, num: '1', name: 'SS', fieldCode: 'ss1' } as any });
    const mk = (y: number, crop: string) => authDb().fieldSeason.create({ data: { tenantId: T, fieldId: field.id, year: y, crop, areaHa: 1, geometry: {} } as any });
    const prev = await mk(year - 1, 'Talinisu');
    const cur = await mk(year, '');
    void prev;
    const { cookie } = await login(await newHandoff());
    await call(cookie, 'GET', `/api/field-works?year=${year}`);
    expect((await authDb().fieldSeason.findUnique({ where: { id: cur.id } }))!.crop).toBe('');
    const tok = `ss-fw-${process.pid}`;
    await authDb().session.create({ data: { userId: u!.id, tokenHash: hashToken(tok), expiresAt: new Date(Date.now() + 3600_000) } });
    await call(`teris_session=${tok}`, 'GET', `/api/field-works?year=${year}`);
    expect((await authDb().fieldSeason.findUnique({ where: { id: cur.id } }))!.crop).toBe('');
    await authDb().fieldSeason.deleteMany({ where: { fieldId: field.id } });
    await authDb().field.delete({ where: { id: field.id } });
  });
});

// Kõik ettevõtte API muutvad teekonnad (koostatud apiHandler.ts, fieldWorks.ts, adminUsers.ts,
// supportGrants.ts ja authGate.ts põhjal). Parameetriga teekondadel on näite-id.
// Uue muutva marsruudi lisamisel peab siia lisama ka rea (vt valvetest all).
const MUTATING_ROUTES: Array<[string, string]> = [
  ['POST', '/api/seasons'], ['PUT', '/api/seasons/1'], ['PATCH', '/api/seasons/1'], ['DELETE', '/api/seasons/1'],
  ['POST', '/api/seasons/2026/fields'],
  ['POST', '/api/master-fields'], ['DELETE', '/api/master-fields/x1'],
  ['POST', '/api/poi'], ['DELETE', '/api/poi/x1'],
  ['POST', '/api/fleet/vehicles'], ['DELETE', '/api/fleet/vehicles/x1'],
  ['POST', '/api/fleet/implements'], ['DELETE', '/api/fleet/implements/x1'], ['POST', '/api/fleet/implements/assign'],
  ['POST', '/api/fleet/devices'], ['DELETE', '/api/fleet/devices/x1'], ['POST', '/api/fleet/devices/assign'],
  ['POST', '/api/fleet/implement-assignments'], ['PUT', '/api/fleet/implement-assignments/x1'],
  ['PATCH', '/api/fleet/implement-assignments/x1'], ['DELETE', '/api/fleet/implement-assignments/x1'],
  ['POST', '/api/fleet/device-assignments'], ['PUT', '/api/fleet/device-assignments/x1'],
  ['PATCH', '/api/fleet/device-assignments/x1'], ['DELETE', '/api/fleet/device-assignments/x1'],
  ['POST', '/api/parties'], ['DELETE', '/api/parties/x1'],
  ['POST', '/api/crops'], ['DELETE', '/api/crops/x1'],
  ['POST', '/api/soil-samples/import'], ['POST', '/api/field-book/import'],
  ['POST', '/api/work-types'], ['DELETE', '/api/work-types/x1'],
  ['POST', '/api/materials'], ['DELETE', '/api/materials/x1'],
  ['POST', '/api/field-works'], ['POST', '/api/field-works/clear'],
  ['PATCH', '/api/field-works/x1'], ['DELETE', '/api/field-works/x1'],
  ['POST', '/api/work-entries'], ['PUT', '/api/work-entries/x1'], ['DELETE', '/api/work-entries/x1'],
  ['PATCH', '/api/finance/entries/x1'],
  ['POST', '/api/admin/users'], ['PATCH', '/api/admin/users/x1'], ['DELETE', '/api/admin/users/x1'],
  ['POST', '/api/admin/users/x1/password'], ['POST', '/api/admin/users/x1/send-link'],
  ['POST', '/api/support-grants'], ['POST', '/api/support-grants/x1/revoke'],
  ['POST', '/api/auth/forgot'], ['POST', '/api/auth/token'],
  ['POST', '/api/auth/set-password'], ['POST', '/api/auth/password']
];
// Lubatud erandid (meetod + tee): logout (lõpetab sessiooni), login ja support-login (avalikud, ei muuda
// ettevõtte andmeid), cloud-check (isAllowedWhenReadOnly)
const SUPPORT_ALLOWED_MUTATIONS = [
  'POST /api/auth/logout', 'POST /api/auth/login', 'POST /api/auth/support-login', 'POST /api/satellite/cloud-check'
];
// Muutvate marsruudi-lausete arv failis, kus teekond koostatakse (adminUsers, supportGrants) ehk ei ole literaal
const COMPOSED_ROUTE_COUNTS: Record<string, number> = { 'adminUsers.ts': 5, 'supportGrants.ts': 2 };
// Failid, kus muutval real peab olema tuvastatav literaal-teekond; erandid failis (mitmerealine tingimus):
// authGate.ts: parooli-voogude blokk (`method === 'POST' &&` + teekondade massiiv järgmisel real)
const NO_LITERAL_PATH_LINES: Record<string, number> = { 'authGate.ts': 1 };
const MUTATING_RE = /method === '(POST|PUT|PATCH|DELETE)'/g;

describe('tugivaade ei pääse ühelegi muutvale teekonnale', () => {
  const digest = async () => JSON.stringify({
    seasons: await authDb().season.findMany({ where: { tenantId: T }, orderBy: { id: 'asc' } }),
    fields: await authDb().field.findMany({ where: { tenantId: T }, orderBy: { id: 'asc' } }),
    fieldWorks: await authDb().fieldWork.findMany({ where: { tenantId: T }, orderBy: { id: 'asc' } }),
    workEntries: await authDb().workEntry.findMany({ where: { tenantId: T }, orderBy: { id: 'asc' } }),
    users: await authDb().user.findMany({ where: { tenantId: T }, orderBy: { id: 'asc' } }),
    supportGrants: await authDb().supportGrant.findMany({ where: { tenantId: T }, orderBy: { id: 'asc' } })
  });
  const countTables = async () => ({
    seasons: await authDb().season.count({ where: { tenantId: T } }),
    fields: await authDb().field.count({ where: { tenantId: T } }),
    fieldWorks: await authDb().fieldWork.count({ where: { tenantId: T } }),
    workEntries: await authDb().workEntry.count({ where: { tenantId: T } }),
    users: await authDb().user.count({ where: { tenantId: T } }),
    supportGrants: await authDb().supportGrant.count({ where: { tenantId: T } })
  });

  it('iga muutev teekond -> 403 ja andmed muutumata', async () => {
    await authDb().supportGrant.update({ where: { id: grantId }, data: { revokedAt: null } });
    const season = await authDb().season.create({ data: { tenantId: T, year: 2098, name: 'SS sweep' } });
    const field = await authDb().field.create({ data: { tenantId: T, num: '7', name: 'SS sweep', fieldCode: 'ss-sweep' } as any });
    try {
      const { cookie } = await login(await newHandoff());
      expect(cookie).not.toBe('');
      const before = await countTables();
      const digestBefore = await digest();
      for (const [m, url] of MUTATING_ROUTES) {
        const r = await call(cookie, m, url, { year: 2099, name: 'x', currentPassword: 'a', newPassword: 'b', login: 'a', token: 'a', password: 'a' });
        expect(r.status, `${m} ${url}`).toBe(403);
        expect(r.json?.error, `${m} ${url}`).toBe(READ_ONLY);
      }
      // cloud-check on isAllowedWhenReadOnly erand: tugivaates ei lükata tagasi (vigane keha -> 400, mitte 403)
      expect((await call(cookie, 'POST', '/api/satellite/cloud-check', {})).status).toBe(400);
      // avalik login valede andmetega: 401 ega tekita uut sessiooni
      const sessionsBefore = await authDb().session.count({ where: { user: { tenantId: T } } });
      const lg = await call(cookie, 'POST', '/api/auth/login', { username: `ss-admin-${process.pid}`, password: 'vale-parool' });
      expect(lg.status).toBe(401);
      expect(await authDb().session.count({ where: { user: { tenantId: T } } })).toBe(sessionsBefore);
      expect(await countTables()).toEqual(before);
      expect(await digest()).toBe(digestBefore);
      // logout viimasena
      expect((await call(cookie, 'POST', '/api/auth/logout')).status).toBe(200);
    } finally {
      await authDb().field.delete({ where: { id: field.id } });
      await authDb().season.delete({ where: { id: season.id } });
    }
  });

  it('valve: iga serveri muutev teekond on loendis', () => {
    const dir = fileURLToPath(new URL('.', import.meta.url));
    const known = [...MUTATING_ROUTES.map(([m, u]) => `${m} ${u}`), ...SUPPORT_ALLOWED_MUTATIONS];
    const missing: string[] = [];
    for (const file of ['apiHandler.ts', 'fieldWorks.ts', 'adminUsers.ts', 'supportGrants.ts', 'authGate.ts']) {
      const lines = readFileSync(dir + file, 'utf8').split('\n');
      let composed = 0;
      let noLiteral = 0;
      for (const line of lines) {
        const methods = [...line.matchAll(MUTATING_RE)].map((x) => x[1]);
        if (methods.length === 0) continue;
        const lit = /pathname( ===|\.startsWith\() ?'(\/api\/[^']*)'/.exec(line);
        // Koostatud teekondadega failis loetakse literaal-teekonnaga read ikkagi loendi vastu
        // (uus literaal-marsruut peab olema loendis); ülejäänud read lähevad COMPOSED_ROUTE_COUNTS alla.
        if (file in COMPOSED_ROUTE_COUNTS && !lit) { composed++; continue; }
        if (!lit) { noLiteral++; continue; }
        for (const m of methods) {
          const path = lit[2];
          const ok = lit[1] === ' ===' ? known.includes(`${m} ${path}`) : known.some((k) => k.startsWith(`${m} ${path}`));
          if (!ok) missing.push(`${file}: ${m} ${path}`);
        }
      }
      if (file in COMPOSED_ROUTE_COUNTS) {
        expect(composed, `${file} muutvate marsruutide arv muutunud: uuenda loendit ja COMPOSED_ROUTE_COUNTS`).toBe(COMPOSED_ROUTE_COUNTS[file]);
      } else {
        expect(noLiteral, `${file}: muutval real puudub tuvastatav teekond; uuenda NO_LITERAL_PATH_LINES`).toBe(NO_LITERAL_PATH_LINES[file] ?? 0);
      }
    }
    expect(missing, 'Muutvad teekonnad puuduvad MUTATING_ROUTES loendist').toEqual([]);
  });
});
