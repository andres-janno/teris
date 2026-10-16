// Platvormi API: päris andmebaas, võlts req/res.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { authDb, prisma, runAsTenant } from './db';
import { hashPassword, generateSessionToken, hashToken } from './auth';
import { encryptTotpSecret } from './totp';
import { handlePlatformRequest } from './platformApi';
import { handleApiRequest } from './apiHandler';
import { findActiveSession } from './authGate';
import { loadLicenseState } from './license';

process.env.MAIL_DISABLED = '1';
const KEY = 'c'.repeat(64);
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const PID = process.pid;
const USERNAME = `zz-plapi-${PID}`;
const ADM = `zz-adm-${PID}`;
const OPTS = { allowedOrigins: [], platformAllowedOrigins: ['https://admin.teris.ee'] } as any;
const LOISU = 'tenant-loisu-agro';
let platformUserId = '';
let cookie = '';
let newId = '';
const createdTenantIds = new Set<string>();

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
  req.socket = { remoteAddress: '127.0.0.9' };
  return req as IncomingMessage;
}

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

async function call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const req = fakeReq(method, path, body, { cookie, ...extra });
  const { res, out } = fakeRes();
  await handlePlatformRequest(req, res, path.split('?')[0], method, new URL(`http://x${path}`), OPTS);
  const data = out.body ? JSON.parse(out.body) : null;
  return { status: out.status, data, out };
}

const validBody = (over: Record<string, unknown> = {}) => ({
  name: `Test Agro ${PID}`,
  registryCode: '12345678',
  adminUsername: ADM,
  adminEmail: `${ADM}@example.invalid`,
  validUntil: '2027-12-31',
  modules: ['SATELLITE'],
  ...over
});

beforeAll(async () => {
  process.env.PLATFORM_TOTP_KEY = KEY;
  const u = await authDb().platformUser.create({
    data: { username: USERNAME, passwordHash: await hashPassword('x-parool-12345'), totpSecretEnc: encryptTotpSecret(SECRET, KEY) }
  });
  platformUserId = u.id;
  const token = generateSessionToken();
  await authDb().platformSession.create({
    data: { platformUserId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) }
  });
  cookie = `__Host-teris_platform_session=${token}`;
});

afterAll(async () => {
  const db = authDb();
  const step = async (label: string, fn: () => Promise<unknown>) => {
    try { await fn(); } catch (err) { console.error(`[platformApi.test] puhastus (${label}) ebaõnnestus`, err); }
  };
  const ids = [...createdTenantIds];
  const byName = await db.tenant.findMany({ where: { name: `Test Agro ${PID}` }, select: { id: true } }).catch(() => []);
  for (const t of byName) ids.push(t.id);
  for (const id of new Set(ids)) {
    const where = { tenantId: id };
    await step('work_template_items', () => db.workTemplateItem.deleteMany({ where }));
    await step('work_templates', () => db.workTemplate.deleteMany({ where }));
    await step('work_types', () => db.workType.deleteMany({ where }));
    await step('crop_varieties', () => db.cropVariety.deleteMany({ where }));
    await step('crops', () => db.crop.deleteMany({ where }));
    await step('password_tokens', () => db.passwordToken.deleteMany({ where: { user: where } }));
    await step('sessions', () => db.session.deleteMany({ where: { user: where } }));
    await step('users', () => db.user.deleteMany({ where }));
    await step('tenant primaryParty', () => db.tenant.updateMany({ where: { id }, data: { primaryPartyId: null } }));
    await step('related_parties', () => db.relatedParty.deleteMany({ where }));
    await step('tenant_licenses', () => db.tenantLicense.deleteMany({ where }));
    await step('audit', () => db.platformAuditLog.deleteMany({ where: { targetTenantId: id } }));
    await step('tenants', () => db.tenant.deleteMany({ where: { id } }));
  }
  await step('platform audit', () => db.platformAuditLog.deleteMany({ where: { platformUserId } }));
  await step('platform sessions', () => db.platformSession.deleteMany({ where: { platformUserId } }));
  await step('platform user', () => db.platformUser.deleteMany({ where: { id: platformUserId } }));
});

describe('platvormi API', () => {
  it('ilma platvormi sessioonita 401, ettevõtte hostil 404', async () => {
    const a = await call('GET', '/api/platform/tenants', undefined, { cookie: '' });
    expect(a.status).toBe(401);
    expect(a.out.headers['cache-control']).toBe('no-store');
    // Ettevõtte host: marsruutimine apiHandleris annab 404
    const req = fakeReq('GET', '/api/platform/tenants', undefined, { host: 'teris.ee', cookie });
    const { res, out } = fakeRes();
    await handleApiRequest(req, res, OPTS);
    expect(out.status).toBe(404);
  });

  it('valideerimine: 400', async () => {
    expect((await call('POST', '/api/platform/tenants', validBody({ name: '  ' }))).status).toBe(400);
    expect((await call('POST', '/api/platform/tenants', validBody({ validUntil: '2027-02-30' }))).status).toBe(400);
    expect((await call('POST', '/api/platform/tenants', validBody({ modules: ['FOO'] }))).status).toBe(400);
    expect((await call('POST', '/api/platform/tenants', validBody({ adminEmail: 'vigane' }))).status).toBe(400);
    expect((await call('POST', '/api/platform/tenants', validBody({ adminUsername: 'Vigane Nimi!' }))).status).toBe(400);
    expect(await authDb().tenant.count({ where: { name: `Test Agro ${PID}` } })).toBe(0);
  });

  it('uue ettevõtte loomine', async () => {
    const r = await call('POST', '/api/platform/tenants', validBody());
    expect(r.status).toBe(201);
    newId = r.data.id;
    createdTenantIds.add(newId);
    const db = authDb();
    const t = await db.tenant.findUnique({ where: { id: newId } });
    expect(t?.status).toBe('ACTIVE');
    const party = await db.relatedParty.findUnique({ where: { id: t!.primaryPartyId! } });
    expect(party?.tenantId).toBe(newId);
    expect(party?.name).toBe(`Test Agro ${PID}`);
    expect(party?.roles).toContain('OPERATOR');
    expect(party?.type).toBe('LEGAL_ENTITY');
    expect(party?.code).toBe('12345678');
    const lic = await db.tenantLicense.findUnique({ where: { tenantId: newId } });
    expect(lic?.validUntil.toISOString().slice(0, 10)).toBe('2027-12-31');
    expect(lic?.modules).toEqual(['SATELLITE']);
    const user = await db.user.findUnique({ where: { username: ADM } });
    expect(user?.tenantId).toBe(newId);
    expect(user?.isAdmin).toBe(true);
    expect(user?.passwordHash).toBe('');
    expect(user?.email).toBe(`${ADM}@example.invalid`);
    expect(await db.passwordToken.count({ where: { userId: user!.id, purpose: 'INVITE' } })).toBe(1);
    const log = await db.platformAuditLog.findFirst({ where: { targetTenantId: newId, action: 'TENANT_CREATE' } });
    expect(log?.platformUserId).toBe(platformUserId);
    // Algkataloogi koopia
    const [cc, cw, ct] = await Promise.all([db.catalogCrop.count(), db.catalogWorkType.count(), db.catalogWorkTemplate.count()]);
    expect(r.data.catalog).toMatchObject({ crops: cc, workTypes: cw, templates: ct });
    expect(await runAsTenant(newId, async () => prisma.crop.count())).toBe(cc);
    expect(await runAsTenant(newId, async () => prisma.workType.count())).toBe(cw);
    expect(await runAsTenant(newId, async () => prisma.workTemplate.count())).toBe(ct);
  });

  it('eraldus teistest ettevõtetest', async () => {
    expect(await runAsTenant(newId, async () => prisma.field.count())).toBe(0);
    expect(await runAsTenant(newId, async () => prisma.relatedParty.count())).toBe(1);
    const inLoisu = await runAsTenant(LOISU, async () => prisma.relatedParty.count({ where: { name: `Test Agro ${PID}` } }));
    expect(inLoisu).toBe(0);
  });

  it('atomaarsus: korduv kasutajanimi -> 409', async () => {
    const r = await call('POST', '/api/platform/tenants', validBody({ name: `Test Agro ${PID}`, adminEmail: `other-${PID}@example.invalid` }));
    expect(r.status).toBe(409);
    expect(r.data.error).toBe('Kasutajanimi on juba kasutusel');
    expect(await authDb().tenant.count({ where: { name: `Test Agro ${PID}` } })).toBe(1);
  });

  it('litsentsi uuendamine', async () => {
    const bad = await call('PATCH', `/api/platform/tenants/${newId}/license`, { validUntil: '2028-13-01', modules: [] });
    expect(bad.status).toBe(400);
    const r = await call('PATCH', `/api/platform/tenants/${newId}/license`, { validUntil: '2028-06-30', modules: ['TELEMETRY', 'WEATHER'] });
    expect(r.status).toBe(200);
    const st = await loadLicenseState(newId);
    expect(st.validUntil).toBe('2028-06-30');
    expect([...st.modules].sort()).toEqual(['TELEMETRY', 'WEATHER']);
    const log = await authDb().platformAuditLog.findFirst({ where: { targetTenantId: newId, action: 'LICENSE_UPDATE' } });
    const d = log?.details as any;
    expect(d.old.validUntil).toBe('2027-12-31');
    expect(d.old.modules).toEqual(['SATELLITE']);
    expect(d.new.validUntil).toBe('2028-06-30');
    expect(d.new.modules).toEqual(['TELEMETRY', 'WEATHER']);
    expect((await call('PATCH', '/api/platform/tenants/puudub/license', { validUntil: '2028-06-30', modules: [] })).status).toBe(404);
  });

  it('kutse uuesti', async () => {
    expect((await call('POST', `/api/platform/tenants/${newId}/resend-invite`, { username: 'olematu' })).status).toBe(400);
    expect((await call('POST', `/api/platform/tenants/${LOISU}/resend-invite`, { username: ADM })).status).toBe(400);
    const r = await call('POST', `/api/platform/tenants/${newId}/resend-invite`, { username: ADM });
    expect(r.status).toBe(200);
    expect(await authDb().platformAuditLog.count({ where: { targetTenantId: newId, action: 'INVITE_RESEND' } })).toBe(1);
  });

  it('kutse uuesti: peatatud ettevõte ja keelatud kasutaja', async () => {
    await authDb().tenant.update({ where: { id: newId }, data: { status: 'SUSPENDED' } });
    try {
      const sus = await call('POST', `/api/platform/tenants/${newId}/resend-invite`, { username: ADM });
      expect(sus.status).toBe(400);
      expect(sus.data.error).toBe('Ettevõte on peatatud');
    } finally {
      await authDb().tenant.update({ where: { id: newId }, data: { status: 'ACTIVE' } });
    }
    await authDb().user.updateMany({ where: { username: ADM }, data: { isActive: false } });
    try {
      const off = await call('POST', `/api/platform/tenants/${newId}/resend-invite`, { username: ADM });
      expect(off.status).toBe(400);
      expect(off.data.error).toBe('Kasutaja on keelatud');
    } finally {
      await authDb().user.updateMany({ where: { username: ADM }, data: { isActive: true } });
    }
  });

  it('peatamine ja aktiveerimine', async () => {
    const user = await authDb().user.findUnique({ where: { username: ADM } });
    const token = generateSessionToken();
    await authDb().session.create({ data: { userId: user!.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 3600_000) } });
    expect(await findActiveSession(hashToken(token))).not.toBeNull();
    expect((await call('POST', `/api/platform/tenants/${newId}/suspend`)).status).toBe(200);
    expect((await authDb().tenant.findUnique({ where: { id: newId } }))?.status).toBe('SUSPENDED');
    expect(await authDb().session.count({ where: { userId: user!.id } })).toBe(0);
    expect(await findActiveSession(hashToken(token))).toBeNull();
    expect((await call('POST', `/api/platform/tenants/${newId}/activate`)).status).toBe(200);
    expect((await authDb().tenant.findUnique({ where: { id: newId } }))?.status).toBe('ACTIVE');
  });

  it('nimekiri ja üksik ettevõte', async () => {
    const r = await call('GET', '/api/platform/tenants');
    expect(r.status).toBe(200);
    const loisu = r.data.find((t: any) => t.id === LOISU);
    expect(loisu.fieldCount).toBeGreaterThan(0);
    const mine = r.data.find((t: any) => t.id === newId);
    expect(mine.userCount).toBe(1);
    expect(mine.activeUserCount).toBe(1);
    expect(mine.fieldCount).toBe(0);
    expect(mine.areaHa).toBe(0);
    expect(mine.license.validUntil).toBe('2028-06-30');
    const one = await call('GET', `/api/platform/tenants/${newId}`);
    expect(one.status).toBe(200);
    expect(one.data.users).toEqual([
      { username: ADM, displayName: null, email: `${ADM}@example.invalid`, isAdmin: true, isActive: true, lastLoginAt: null, hasPassword: false }
    ]);
    expect((await call('GET', '/api/platform/tenants/puudub')).status).toBe(404);
    expect((await call('GET', '/api/platform/tenants/%E0')).status).toBe(404);
  });

  it('logi', async () => {
    const r = await call('GET', `/api/platform/audit?tenantId=${newId}&limit=500`);
    expect(r.status).toBe(200);
    const actions = r.data.map((x: any) => x.action);
    expect(actions).toEqual(expect.arrayContaining(['TENANT_CREATE', 'LICENSE_UPDATE', 'TENANT_SUSPEND', 'TENANT_ACTIVATE', 'INVITE_RESEND']));
    expect(r.data[0].platformUsername).toBe(USERNAME);
    expect(JSON.stringify(r.data)).not.toMatch(/passwordHash|tokenHash/);
    const lim = await call('GET', `/api/platform/audit?tenantId=${newId}&limit=2`);
    expect(lim.data.length).toBe(2);
  });
});

describe('platvormi API: catalog (algkataloog)', () => {
  const ZZ = `ZZ test ${PID}`;
  const base = { crops: 0, workTypes: 0, templates: 0 };
  let cropId = '';
  let varId = '';
  let wtId = '';

  const cleanup = async () => {
    const db = authDb();
    await db.catalogWorkTemplate.deleteMany({ where: { crop: { name: { startsWith: 'ZZ test' } } } });
    await db.catalogCrop.deleteMany({ where: { name: { startsWith: 'ZZ test' } } });
    await db.catalogWorkType.deleteMany({ where: { name: { startsWith: 'ZZ test' } } });
    await db.platformAuditLog.deleteMany({ where: { platformUserId, action: 'CATALOG_UPDATE' } });
  };

  beforeAll(async () => {
    await cleanup();
    const db = authDb();
    const [crops, workTypes, templates] = await Promise.all([db.catalogCrop.count(), db.catalogWorkType.count(), db.catalogWorkTemplate.count()]);
    Object.assign(base, { crops, workTypes, templates });
  });

  afterAll(cleanup);

  it('GET catalog annab kultuurid, tööliigid ja mallid', async () => {
    const r = await call('GET', '/api/platform/catalog');
    expect(r.status).toBe(200);
    expect(r.data.crops).toHaveLength(base.crops);
    expect(r.data.workTypes).toHaveLength(base.workTypes);
    expect(r.data.templates).toHaveLength(base.templates);
    expect(r.data.crops[0]).toHaveProperty('varieties');
    const t = r.data.templates.find((x: any) => x.items.length > 0);
    expect(t.items[0]).toEqual(expect.objectContaining({ workTypeName: expect.any(String), sortOrder: expect.any(Number) }));
    expect((await call('GET', '/api/platform/catalog', undefined, { cookie: '' })).status).toBe(401);
  });

  it('kultuur: loomine, topeltnimi, muutmine, valideerimine', async () => {
    const r = await call('POST', '/api/platform/catalog/crops', { name: `  ${ZZ}  `, group: 'CEREAL', color: '#112233' });
    expect(r.status).toBe(201);
    cropId = r.data.id;
    expect(r.data.name).toBe(ZZ);
    const dup = await call('POST', '/api/platform/catalog/crops', { name: ZZ });
    expect(dup.status).toBe(409);
    expect(dup.data.error).toBe('Sellise nimega kultuur on juba olemas');
    expect((await call('POST', '/api/platform/catalog/crops', { name: '' })).status).toBe(400);
    expect((await call('POST', '/api/platform/catalog/crops', { name: 'x'.repeat(101) })).status).toBe(400);
    expect((await call('POST', '/api/platform/catalog/crops', { name: `${ZZ} b`, color: 'punane' })).status).toBe(400);
    expect((await call('POST', '/api/platform/catalog/crops', { name: `${ZZ} b`, defaultSeedRateKgHa: -1 })).status).toBe(400);
    expect((await call('POST', '/api/platform/catalog/crops', { name: `${ZZ} b`, group: 'FOO' })).status).toBe(400);
    const p = await call('PATCH', `/api/platform/catalog/crops/${cropId}`, { color: '#abcdef', defaultSeedRateKgHa: 180, defaultYieldTonsHa: null });
    expect(p.status).toBe(200);
    expect(p.data.color).toBe('#abcdef');
    expect(p.data.defaultSeedRateKgHa).toBe(180);
    expect(p.data.name).toBe(ZZ);
    expect((await call('PATCH', '/api/platform/catalog/crops/puudub', { color: '#abcdef' })).status).toBe(404);
    expect((await call('PATCH', '/api/platform/catalog/crops/%E0', { color: '#abcdef' })).status).toBe(404);
  });

  it('sort: loomine, topeltnimi, muutmine, kustutamine', async () => {
    const r = await call('POST', `/api/platform/catalog/crops/${cropId}/varieties`, { name: `${ZZ} sort`, breeder: 'Test', recommendedSeedRateKgHa: 200 });
    expect(r.status).toBe(201);
    varId = r.data.id;
    expect((await call('POST', `/api/platform/catalog/crops/${cropId}/varieties`, { name: `${ZZ} sort` })).status).toBe(409);
    expect((await call('POST', '/api/platform/catalog/crops/puudub/varieties', { name: 'a' })).status).toBe(404);
    const p = await call('PATCH', `/api/platform/catalog/crops/${cropId}/varieties/${varId}`, { qualityClass: 'A', isActive: false });
    expect(p.status).toBe(200);
    expect(p.data.qualityClass).toBe('A');
    expect(p.data.isActive).toBe(false);
    expect((await call('PATCH', `/api/platform/catalog/crops/${cropId}/varieties/puudub`, { notes: 'x' })).status).toBe(404);
    const g = await call('GET', '/api/platform/catalog');
    expect(g.data.crops.find((c: any) => c.id === cropId).varieties).toHaveLength(1);
    expect((await call('DELETE', `/api/platform/catalog/crops/${cropId}/varieties/${varId}`)).status).toBe(200);
    expect(await authDb().catalogCropVariety.count({ where: { catalogCropId: cropId } })).toBe(0);
  });

  it('tööliik: loomine, valideerimine, muutmine', async () => {
    const bad = await call('POST', '/api/platform/catalog/work-types', { name: `${ZZ} töö`, phase: 'FOO' });
    expect(bad.status).toBe(400);
    expect((await call('POST', '/api/platform/catalog/work-types', { name: `${ZZ} töö`, phase: 'CARE', repeatMode: 'FOO' })).status).toBe(400);
    expect((await call('POST', '/api/platform/catalog/work-types', { name: `${ZZ} töö` })).status).toBe(400);
    const r = await call('POST', '/api/platform/catalog/work-types', { name: `${ZZ} töö`, phase: 'CARE', repeatMode: 'UP_TO', maxRepeats: 3, usesMaterials: true });
    expect(r.status).toBe(201);
    wtId = r.data.id;
    expect(r.data).toMatchObject({ phase: 'CARE', repeatMode: 'UP_TO', maxRepeats: 3, usesMaterials: true });
    const dup = await call('POST', '/api/platform/catalog/work-types', { name: `${ZZ} töö`, phase: 'CARE' });
    expect(dup.status).toBe(409);
    const p = await call('PATCH', `/api/platform/catalog/work-types/${wtId}`, { phase: 'HARVEST', maxRepeats: null });
    expect(p.status).toBe(200);
    expect(p.data).toMatchObject({ phase: 'HARVEST', maxRepeats: null });
    expect((await call('PATCH', `/api/platform/catalog/work-types/${wtId}`, { phase: 'FOO' })).status).toBe(400);
    expect((await call('PATCH', '/api/platform/catalog/work-types/puudub', { sortOrder: 1 })).status).toBe(404);
  });

  it('mall: PUT asendab read, tööliiki ei saa kustutada kuni mall olemas', async () => {
    const wt2 = await call('POST', '/api/platform/catalog/work-types', { name: `${ZZ} töö2`, phase: 'SOWING' });
    expect(wt2.status).toBe(201);
    const put = await call('PUT', '/api/platform/catalog/templates', {
      catalogCropId: cropId,
      isWinter: false,
      items: [{ catalogWorkTypeId: wt2.data.id, typicalTiming: 'mai', plannedCount: 1 }, { catalogWorkTypeId: wtId }]
    });
    expect(put.status).toBe(200);
    let g = await call('GET', '/api/platform/catalog');
    let tpl = g.data.templates.find((t: any) => t.catalogCropId === cropId && t.isWinter === false);
    expect(tpl.cropName).toBe(ZZ);
    expect(tpl.items.map((i: any) => i.catalogWorkTypeId)).toEqual([wt2.data.id, wtId]);
    expect(tpl.items[0]).toMatchObject({ typicalTiming: 'mai', plannedCount: 1, workTypeName: `${ZZ} töö2` });
    // Asendus: järjekord muutub
    const put2 = await call('PUT', '/api/platform/catalog/templates', { catalogCropId: cropId, isWinter: false, items: [{ catalogWorkTypeId: wtId }, { catalogWorkTypeId: wt2.data.id }] });
    expect(put2.status).toBe(200);
    g = await call('GET', '/api/platform/catalog');
    tpl = g.data.templates.find((t: any) => t.catalogCropId === cropId && t.isWinter === false);
    expect(tpl.items.map((i: any) => i.catalogWorkTypeId)).toEqual([wtId, wt2.data.id]);
    expect(g.data.templates.filter((t: any) => t.catalogCropId === cropId)).toHaveLength(1);
    // Vead
    expect((await call('PUT', '/api/platform/catalog/templates', { catalogCropId: 'puudub', isWinter: false, items: [] })).status).toBe(404);
    expect((await call('PUT', '/api/platform/catalog/templates', { catalogCropId: cropId, isWinter: false, items: [{ catalogWorkTypeId: 'puudub' }] })).status).toBe(404);
    expect((await call('PUT', '/api/platform/catalog/templates', { catalogCropId: cropId, isWinter: false, items: [{ catalogWorkTypeId: wtId }, { catalogWorkTypeId: wtId }] })).status).toBe(400);
    expect((await call('PUT', '/api/platform/catalog/templates', { catalogCropId: cropId, isWinter: 'jah', items: [] })).status).toBe(400);
    // Tööliigi kustutamine
    const del = await call('DELETE', `/api/platform/catalog/work-types/${wtId}`);
    expect(del.status).toBe(409);
    expect(del.data.error).toBe('Tööliiki kasutatakse mallis');
    // Tühi items kustutab malli
    const empty = await call('PUT', '/api/platform/catalog/templates', { catalogCropId: cropId, isWinter: false, items: [] });
    expect(empty.status).toBe(200);
    g = await call('GET', '/api/platform/catalog');
    expect(g.data.templates.filter((t: any) => t.catalogCropId === cropId)).toHaveLength(0);
    expect(g.data.templates).toHaveLength(base.templates);
    expect((await call('DELETE', `/api/platform/catalog/work-types/${wtId}`)).status).toBe(200);
    expect((await call('DELETE', `/api/platform/catalog/work-types/${wt2.data.id}`)).status).toBe(200);
    expect((await call('DELETE', `/api/platform/catalog/work-types/${wtId}`)).status).toBe(404);
  });

  it('kultuuri kustutamine viib sordid ja erimallid kaasa', async () => {
    const wt = await call('POST', '/api/platform/catalog/work-types', { name: `${ZZ} töö3`, phase: 'CARE' });
    await call('POST', `/api/platform/catalog/crops/${cropId}/varieties`, { name: `${ZZ} sort2` });
    await call('PUT', '/api/platform/catalog/templates', { catalogCropId: cropId, isWinter: true, items: [{ catalogWorkTypeId: wt.data.id }] });
    expect(await authDb().catalogWorkTemplate.count({ where: { catalogCropId: cropId } })).toBe(1);
    expect((await call('DELETE', `/api/platform/catalog/crops/${cropId}`)).status).toBe(200);
    expect(await authDb().catalogCropVariety.count({ where: { catalogCropId: cropId } })).toBe(0);
    expect(await authDb().catalogWorkTemplate.count({ where: { catalogCropId: cropId } })).toBe(0);
    expect((await call('DELETE', `/api/platform/catalog/crops/${cropId}`)).status).toBe(404);
    expect((await call('DELETE', `/api/platform/catalog/work-types/${wt.data.id}`)).status).toBe(200);
  });

  it('üldmall on isWinter kohta unikaalne ja logi tekib', async () => {
    // Olemasolevat üldmalli ei muudeta sisuliselt: asendame selle samade ridadega
    const g = await call('GET', '/api/platform/catalog');
    const gen = g.data.templates.find((t: any) => t.catalogCropId === null && t.isWinter === false);
    expect(gen).toBeTruthy();
    const items = gen.items.map((i: any) => ({ catalogWorkTypeId: i.catalogWorkTypeId, typicalTiming: i.typicalTiming, plannedCount: i.plannedCount }));
    const r = await call('PUT', '/api/platform/catalog/templates', { catalogCropId: null, isWinter: false, items });
    expect(r.status).toBe(200);
    expect(await authDb().catalogWorkTemplate.count({ where: { catalogCropId: null, isWinter: false } })).toBe(1);
    const after = await call('GET', '/api/platform/catalog');
    const gen2 = after.data.templates.find((t: any) => t.catalogCropId === null && t.isWinter === false);
    expect(gen2.items.map((i: any) => [i.catalogWorkTypeId, i.sortOrder, i.typicalTiming, i.plannedCount]))
      .toEqual(gen.items.map((i: any) => [i.catalogWorkTypeId, i.sortOrder, i.typicalTiming, i.plannedCount]));
    expect(after.data.templates).toHaveLength(base.templates);
    // Logi
    const logs = await authDb().platformAuditLog.findMany({ where: { platformUserId, action: 'CATALOG_UPDATE' } });
    expect(logs.length).toBeGreaterThan(5);
    expect(logs.every((l) => l.targetTenantId === null)).toBe(true);
    const details = logs.map((l) => l.details as any);
    expect(details).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'crop', op: 'create', name: ZZ }),
      expect.objectContaining({ entity: 'variety', op: 'create' }),
      expect.objectContaining({ entity: 'workType', op: 'delete' }),
      expect.objectContaining({ entity: 'template', op: 'replace' })
    ]));
  });

  it('kataloogi loendused on lõpus samad mis alguses', async () => {
    await cleanup();
    const db = authDb();
    expect(await db.catalogCrop.count()).toBe(base.crops);
    expect(await db.catalogWorkType.count()).toBe(base.workTypes);
    expect(await db.catalogWorkTemplate.count()).toBe(base.templates);
  });
});
