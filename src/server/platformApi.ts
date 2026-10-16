// src/server/platformApi.ts — teenusepakkuja API: ettevõtted, litsentsid, peatamine, kutse, logi.
// Ettevõtte andmeid näidatakse ainult koondarvudena (groupBy / count), mitte ridadena.
import type { IncomingMessage, ServerResponse } from 'http';
import { Prisma } from '@prisma/client';
import { authDb } from './db.ts';
import { json, parseBody, hasRequestBody } from './http.ts';
import { handlePlatformAuth, platformUserOf } from './platformAuth.ts';
import { copyCatalogToTenant } from './catalog.ts';
import { LICENSE_MODULES, licenseState, tallinnToday, loadLicenseState, parseLicenseDate, type LicenseModule } from './license.ts';
import { sendPasswordLink } from './passwordTokens.ts';
import { normalizeUsername, USERNAME_ERROR } from './adminRules.ts';
import { normalizeEmail } from './mail.ts';
import type { ApiOptions } from './apiHandler.ts';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const NOT_FOUND = 'Ettevõtet ei leitud';
const TENANT_ROUTE = /^\/api\/platform\/tenants\/([^/]+)(?:\/(license|suspend|activate|resend-invite))?$/;

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max + 1) : '';
}

function parseLicenseInput(body: any): { validUntil: Date; modules: LicenseModule[] } {
  const validUntil = parseLicenseDate(typeof body?.validUntil === 'string' ? body.validUntil : '');
  if (!validUntil) throw new HttpError(400, 'Vigane kuupäev (YYYY-MM-DD)');
  if (!Array.isArray(body?.modules)) throw new HttpError(400, 'Moodulite loend puudub');
  const list = body.modules.map((m: unknown) => String(m).trim().toUpperCase());
  const bad = list.filter((m: string) => !LICENSE_MODULES.includes(m as LicenseModule));
  if (bad.length) throw new HttpError(400, `Tundmatu moodul: ${bad.join(', ')}`);
  return { validUntil, modules: [...new Set(list)] as LicenseModule[] };
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

async function tenantSummaries(onlyId?: string) {
  const db = authDb();
  const tw = onlyId ? { tenantId: onlyId } : {};
  const year = new Date().getFullYear();
  const [tenants, licenses, users, active, fields, areas, logins] = await Promise.all([
    db.tenant.findMany({ where: onlyId ? { id: onlyId } : {}, orderBy: { createdAt: 'asc' } }),
    db.tenantLicense.findMany({ where: tw }),
    db.user.groupBy({ by: ['tenantId'], where: tw, _count: true }),
    db.user.groupBy({ by: ['tenantId'], where: { ...tw, isActive: true }, _count: true }),
    db.field.groupBy({ by: ['tenantId'], where: tw, _count: true }),
    db.fieldSeason.groupBy({ by: ['tenantId'], where: { ...tw, year }, _sum: { areaHa: true } }),
    db.user.groupBy({ by: ['tenantId'], where: tw, _max: { lastLoginAt: true } })
  ]);
  const today = tallinnToday(new Date());
  return tenants.map((t) => ({
    id: t.id,
    name: t.name,
    registryCode: t.registryCode,
    status: t.status,
    createdAt: t.createdAt,
    license: licenseState(licenses.find((l) => l.tenantId === t.id) ?? null, today),
    userCount: users.find((x) => x.tenantId === t.id)?._count ?? 0,
    activeUserCount: active.find((x) => x.tenantId === t.id)?._count ?? 0,
    fieldCount: fields.find((x) => x.tenantId === t.id)?._count ?? 0,
    areaHa: areas.find((x) => x.tenantId === t.id)?._sum.areaHa ?? 0,
    lastLoginAt: logins.find((x) => x.tenantId === t.id)?._max.lastLoginAt ?? null
  }));
}

async function createTenant(body: any, platformUser: { id: string; username: string }) {
  const name = str(body?.name, 200);
  if (!name || name.length > 200) throw new HttpError(400, 'Ettevõtte nimi peab olema 1–200 märki');
  const registryCode = str(body?.registryCode, 20) || null;
  if (registryCode && registryCode.length > 20) throw new HttpError(400, 'Registrikood on liiga pikk (kuni 20 märki)');
  const username = normalizeUsername(body?.adminUsername);
  if (!username) throw new HttpError(400, USERNAME_ERROR);
  const email = normalizeEmail(body?.adminEmail);
  if (!email) throw new HttpError(400, 'Vigane e-posti aadress');
  const displayName = str(body?.adminDisplayName, 200) || null;
  if (displayName && displayName.length > 200) throw new HttpError(400, 'Kuvatav nimi on liiga pikk');
  const { validUntil, modules } = parseLicenseInput(body);

  let result;
  try {
    result = await authDb().$transaction(async (tx) => {
      const t = await tx.tenant.create({ data: { name, registryCode } });
      const party = await tx.relatedParty.create({
        data: { tenantId: t.id, name, type: 'LEGAL_ENTITY', code: registryCode, roles: ['OPERATOR'] }
      });
      await tx.tenant.update({ where: { id: t.id }, data: { primaryPartyId: party.id } });
      await tx.tenantLicense.create({
        data: { tenantId: t.id, validUntil, modules, updatedBy: platformUser.username }
      });
      const catalog = await copyCatalogToTenant(tx, t.id);
      const user = await tx.user.create({
        data: { tenantId: t.id, username, displayName, email, passwordHash: '', isAdmin: true }
      });
      await tx.platformAuditLog.create({
        data: {
          action: 'TENANT_CREATE',
          platformUserId: platformUser.id,
          targetTenantId: t.id,
          details: { name, adminUsername: username, validUntil: isoDay(validUntil), modules, catalog }
        }
      });
      return { id: t.id, user, catalog };
    }, { timeout: 30000 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = String(err.meta?.target ?? '');
      throw new HttpError(409, target.includes('email') ? 'E-posti aadress on juba kasutusel' : 'Kasutajanimi on juba kasutusel');
    }
    throw err;
  }
  let inviteSent = false;
  try {
    inviteSent = await sendPasswordLink({ ...result.user, email }, 'INVITE');
  } catch (err) {
    console.error('[platformApi] kutse saatmine ebaõnnestus', (err as Error).message);
  }
  return { id: result.id, inviteSent, catalog: result.catalog };
}

async function updateLicense(id: string, body: any, platformUser: { id: string; username: string }) {
  const { validUntil, modules } = parseLicenseInput(body);
  const db = authDb();
  await db.$transaction(async (tx) => {
    if (!(await tx.tenant.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, NOT_FOUND);
    const old = await tx.tenantLicense.findUnique({ where: { tenantId: id } });
    await tx.tenantLicense.upsert({
      where: { tenantId: id },
      create: { tenantId: id, validUntil, modules, updatedBy: platformUser.username },
      update: { validUntil, modules, updatedBy: platformUser.username }
    });
    await tx.platformAuditLog.create({
      data: {
        action: 'LICENSE_UPDATE',
        platformUserId: platformUser.id,
        targetTenantId: id,
        details: {
          old: old ? { validUntil: isoDay(old.validUntil), modules: old.modules } : null,
          new: { validUntil: isoDay(validUntil), modules }
        }
      }
    });
  });
}

async function setStatus(id: string, status: 'ACTIVE' | 'SUSPENDED', platformUser: { id: string }) {
  await authDb().$transaction(async (tx) => {
    const t = await tx.tenant.findUnique({ where: { id }, select: { status: true } });
    if (!t) throw new HttpError(404, NOT_FOUND);
    await tx.tenant.update({ where: { id }, data: { status } });
    if (status === 'SUSPENDED') await tx.session.deleteMany({ where: { user: { tenantId: id } } });
    await tx.platformAuditLog.create({
      data: {
        action: status === 'SUSPENDED' ? 'TENANT_SUSPEND' : 'TENANT_ACTIVATE',
        platformUserId: platformUser.id,
        targetTenantId: id,
        details: { from: t.status }
      }
    });
  });
}

async function resendInvite(id: string, body: any, platformUser: { id: string }) {
  const db = authDb();
  if (!(await db.tenant.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, NOT_FOUND);
  const username = normalizeUsername(body?.username);
  const user = username ? await db.user.findFirst({ where: { username, tenantId: id } }) : null;
  if (!user) throw new HttpError(400, 'Kasutajat ei leitud');
  if (user.passwordHash !== '') throw new HttpError(400, 'Kasutajal on parool juba määratud');
  if (!user.email) throw new HttpError(400, 'Kasutajal puudub e-posti aadress');
  const sent = await sendPasswordLink({ id: user.id, username: user.username, displayName: user.displayName, email: user.email }, 'INVITE');
  await db.platformAuditLog.create({
    data: { action: 'INVITE_RESEND', platformUserId: platformUser.id, targetTenantId: id, details: { username: user.username, sent } }
  });
  return { inviteSent: sent };
}

async function listAudit(url: URL) {
  const tenantId = url.searchParams.get('tenantId');
  const raw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 200) : 50;
  const db = authDb();
  const rows = await db.platformAuditLog.findMany({
    where: tenantId ? { targetTenantId: tenantId } : {},
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit
  });
  const ids = [...new Set(rows.map((r) => r.platformUserId).filter((x): x is string => !!x))];
  const names = new Map(
    (await db.platformUser.findMany({ where: { id: { in: ids } }, select: { id: true, username: true } })).map((u) => [u.id, u.username])
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    targetTenantId: r.targetTenantId,
    details: r.details,
    createdAt: r.createdAt,
    platformUsername: r.platformUserId ? names.get(r.platformUserId) ?? null : null
  }));
}

async function readBody(req: IncomingMessage): Promise<any> {
  if (!hasRequestBody(req)) return {};
  try {
    return await parseBody(req, 64 * 1024);
  } catch {
    throw new HttpError(400, 'Vigane päring');
  }
}

async function route(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL) {
  const pu = platformUserOf(req)!;

  if (pathname === '/api/platform/tenants') {
    if (method === 'GET') return json(res, await tenantSummaries());
    if (method === 'POST') return json(res, await createTenant(await readBody(req), pu), 201);
  }
  if (pathname === '/api/platform/audit' && method === 'GET') return json(res, await listAudit(url));

  const m = TENANT_ROUTE.exec(pathname);
  if (m) {
    let id: string;
    try {
      id = decodeURIComponent(m[1]);
    } catch {
      throw new HttpError(404, NOT_FOUND);
    }
    const action = m[2];
    if (!action && method === 'GET') {
      const [summary] = await tenantSummaries(id);
      if (!summary) throw new HttpError(404, NOT_FOUND);
      const users = await authDb().user.findMany({ where: { tenantId: id }, orderBy: { username: 'asc' } });
      return json(res, {
        ...summary,
        users: users.map((u) => ({
          username: u.username,
          displayName: u.displayName,
          email: u.email,
          isAdmin: u.isAdmin,
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt,
          hasPassword: u.passwordHash !== ''
        }))
      });
    }
    if (action === 'license' && method === 'PATCH') {
      await updateLicense(id, await readBody(req), pu);
      return json(res, { license: await loadLicenseState(id) });
    }
    if (action === 'suspend' && method === 'POST') {
      await setStatus(id, 'SUSPENDED', pu);
      return json(res, { success: true });
    }
    if (action === 'activate' && method === 'POST') {
      await setStatus(id, 'ACTIVE', pu);
      return json(res, { success: true });
    }
    if (action === 'resend-invite' && method === 'POST') return json(res, await resendInvite(id, await readBody(req), pu));
  }
  json(res, { error: 'Not found' }, 404);
}

export async function handlePlatformRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  method: string,
  url: URL,
  options: ApiOptions
): Promise<void> {
  if (!pathname.startsWith('/api/platform/')) return json(res, { error: 'Not found' }, 404);
  if (await handlePlatformAuth(req, res, pathname, method, { allowedOrigins: options.platformAllowedOrigins })) return;
  try {
    await route(req, res, pathname, method, url);
  } catch (err) {
    if (err instanceof HttpError) return json(res, { error: err.message }, err.status);
    console.error('[platformApi] viga', err);
    json(res, { error: 'Serveri viga' }, 500);
  }
}
