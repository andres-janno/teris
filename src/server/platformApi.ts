// src/server/platformApi.ts — teenusepakkuja API: ettevõtted, litsentsid, peatamine, kutse, logi.
// Ettevõtte andmeid näidatakse ainult koondarvudena (groupBy / count), mitte ridadena.
import type { IncomingMessage, ServerResponse } from 'http';
import { Prisma, CropGroup, WorkPhase, WorkRepeatMode } from '@prisma/client';
import { authDb } from './db.ts';
import { json, parseBody, hasRequestBody } from './http.ts';
import { handlePlatformAuth, platformUserOf } from './platformAuth.ts';
import { copyCatalogToTenant } from './catalog.ts';
import { LICENSE_MODULES, licenseState, tallinnToday, loadLicenseState, parseLicenseDate, type LicenseModule } from './license.ts';
import { sendPasswordLink } from './passwordTokens.ts';
import { normalizeUsername, USERNAME_ERROR } from './adminRules.ts';
import { normalizeEmail } from './mail.ts';
import type { ApiOptions } from './apiHandler.ts';

type PlatformUser = { id: string; username: string };

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const NOT_FOUND = 'Ettevõtet ei leitud';
const DEVICE_NOT_FOUND = 'Seadet ei leitud';
const DEVICE_RELEASE_ROUTE = /^\/api\/platform\/devices\/([^/]+)\/release$/;
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
      if (target.includes('username')) throw new HttpError(409, 'Kasutajanimi on juba kasutusel');
      if (target.includes('email')) throw new HttpError(409, 'E-posti aadress on juba kasutusel');
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
  const tenant = await db.tenant.findUnique({ where: { id }, select: { status: true } });
  if (!tenant) throw new HttpError(404, NOT_FOUND);
  if (tenant.status !== 'ACTIVE') throw new HttpError(400, 'Ettevõte on peatatud');
  const username = normalizeUsername(body?.username);
  const user = username ? await db.user.findFirst({ where: { username, tenantId: id } }) : null;
  if (!user) throw new HttpError(400, 'Kasutajat ei leitud');
  if (!user.isActive) throw new HttpError(400, 'Kasutaja on keelatud');
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

// ---- Seadmed: kõik registreeritud tunnusega seadmed, viimased omandiperioodid, vabastamine ----

async function listDevices() {
  const db = authDb();
  const devices = await db.telemetryDevice.findMany({
    where: { OR: [{ imei: { not: null } }, { macAddress: { not: null } }] },
    orderBy: { createdAt: 'desc' }
  });
  const tenantIds = [...new Set(devices.map((d) => d.tenantId))];
  const [tenants, owns] = await Promise.all([
    db.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } }),
    db.deviceOwnership.findMany({
      where: { tenantId: { in: tenantIds }, validTo: null, identifier: { in: devices.flatMap((d) => [d.imei, d.macAddress]).filter((x): x is string => !!x) } },
      orderBy: { validFrom: 'desc' }
    })
  ]);
  const names = new Map(tenants.map((t) => [t.id, t.name]));
  return devices.map((d) => {
    const own = owns.find((o) => o.tenantId === d.tenantId && (o.identifier === d.imei || o.identifier === d.macAddress));
    return {
      id: d.id,
      tenantId: d.tenantId,
      tenantName: names.get(d.tenantId) ?? d.tenantId,
      connectivityType: d.connectivityType,
      imei: d.imei,
      macAddress: d.macAddress,
      model: d.model,
      createdAt: d.createdAt,
      ownership: own ? { validFrom: own.validFrom } : null
    };
  });
}

async function listRegistrations(url: URL) {
  const raw = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 200) : 50;
  const db = authDb();
  const rows = await db.deviceOwnership.findMany({ orderBy: [{ validFrom: 'desc' }, { id: 'desc' }], take: limit });
  const names = new Map(
    (await db.tenant.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.tenantId))] } }, select: { id: true, name: true } })).map((t) => [t.id, t.name])
  );
  return rows.map((r) => ({
    tenantName: names.get(r.tenantId) ?? r.tenantId,
    kind: r.kind,
    identifier: r.identifier,
    validFrom: r.validFrom,
    validTo: r.validTo
  }));
}

// Vabastab seadme IMEI/MAC: tunnus tühjendatakse, omandiperiood suletakse, uus omanik saab seadme registreerida.
async function releaseDevice(id: string, pu: PlatformUser) {
  await authDb().$transaction(async (tx) => {
    const dev = await tx.telemetryDevice.findUnique({ where: { id } });
    if (!dev) throw new HttpError(404, DEVICE_NOT_FOUND);
    const released: { kind: 'IMEI' | 'MAC'; identifier: string }[] = [];
    if (dev.imei) released.push({ kind: 'IMEI', identifier: dev.imei });
    if (dev.macAddress) released.push({ kind: 'MAC', identifier: dev.macAddress });
    if (!released.length) throw new HttpError(400, 'Seadmel pole vabastatavat tunnust');
    const [y, m, d] = tallinnToday(new Date()).split('-');
    const note = `Vabastatud teenusepakkuja poolt ${d}.${m}.${y}`;
    await tx.telemetryDevice.update({
      where: { id },
      data: { imei: null, macAddress: null, notes: dev.notes ? `${dev.notes}\n${note}` : note }
    });
    const now = new Date();
    for (const r of released) {
      await tx.deviceOwnership.updateMany({
        where: { tenantId: dev.tenantId, kind: r.kind, identifier: r.identifier, validTo: null },
        data: { validTo: now, updatedBy: pu.username }
      });
      await tx.platformAuditLog.create({
        data: { action: 'DEVICE_RELEASE', platformUserId: pu.id, targetTenantId: dev.tenantId, details: { kind: r.kind, identifier: r.identifier } }
      });
    }
  });
}

async function readBody(req: IncomingMessage): Promise<any> {
  if (!hasRequestBody(req)) return {};
  try {
    return await parseBody(req, 64 * 1024);
  } catch {
    throw new HttpError(400, 'Vigane päring');
  }
}

// ---- Algkataloog (platvormi tabelid, ilma tenantId-ta) ----

type FieldSpec = { k: string; t: 'name' | 'text' | 'color' | 'float' | 'int' | 'bool' | 'enum'; max?: number; nullable?: boolean; values?: string[]; label: string };

const CROP_FIELDS: FieldSpec[] = [
  { k: 'name', t: 'name', label: 'Nimi' },
  { k: 'scientificName', t: 'text', max: 200, nullable: true, label: 'Ladinakeelne nimi' },
  { k: 'group', t: 'enum', values: Object.values(CropGroup), label: 'Kultuurirühm' },
  { k: 'color', t: 'color', label: 'Värv' },
  { k: 'icon', t: 'text', max: 100, nullable: true, label: 'Ikoon' },
  { k: 'priaCode', t: 'text', max: 50, nullable: true, label: 'PRIA kood' },
  { k: 'defaultSeedRateKgHa', t: 'float', nullable: true, label: 'Külvinorm' },
  { k: 'defaultYieldTonsHa', t: 'float', nullable: true, label: 'Saagikus' },
  { k: 'description', t: 'text', max: 2000, nullable: true, label: 'Kirjeldus' },
  { k: 'isWinterCrop', t: 'bool', label: 'Talikultuur' }
];
const VARIETY_FIELDS: FieldSpec[] = [
  { k: 'name', t: 'name', label: 'Nimi' },
  { k: 'breeder', t: 'text', max: 200, nullable: true, label: 'Aretaja' },
  { k: 'maturityDays', t: 'text', max: 100, nullable: true, label: 'Valmimisaeg' },
  { k: 'winterHardiness', t: 'text', max: 100, nullable: true, label: 'Talvekindlus' },
  { k: 'recommendedSeedRateKgHa', t: 'float', nullable: true, label: 'Soovitatav külvinorm' },
  { k: 'potentialYieldTonsHa', t: 'float', nullable: true, label: 'Potentsiaalne saagikus' },
  { k: 'qualityClass', t: 'text', max: 100, nullable: true, label: 'Kvaliteediklass' },
  { k: 'notes', t: 'text', max: 2000, nullable: true, label: 'Märkused' },
  { k: 'isActive', t: 'bool', label: 'Aktiivne' }
];
const WORK_TYPE_FIELDS: FieldSpec[] = [
  { k: 'name', t: 'name', label: 'Nimi' },
  { k: 'phase', t: 'enum', values: Object.values(WorkPhase), label: 'Tööfaas' },
  { k: 'repeatMode', t: 'enum', values: Object.values(WorkRepeatMode), label: 'Kordumisviis' },
  { k: 'maxRepeats', t: 'int', nullable: true, label: 'Kordumiste arv' },
  { k: 'intervalDays', t: 'int', nullable: true, label: 'Intervall päevades' },
  { k: 'usesMaterials', t: 'bool', label: 'Kasutab materjale' },
  { k: 'sortOrder', t: 'int', label: 'Järjekord' },
  { k: 'isActive', t: 'bool', label: 'Aktiivne' }
];

// Kontrollib ja kärbib sisendi; `partial` korral loetakse ainult antud väljad, muidu nõutakse `required` väljad.
function parseFields(body: any, spec: FieldSpec[], required: string[], partial: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of spec) {
    const present = body && typeof body === 'object' && f.k in body && body[f.k] !== undefined;
    if (!present) {
      if (!partial && required.includes(f.k)) throw new HttpError(400, `${f.label} on kohustuslik`);
      continue;
    }
    const v = body[f.k];
    if (v === null) {
      if (!f.nullable) throw new HttpError(400, `${f.label} on kohustuslik`);
      out[f.k] = null;
      continue;
    }
    switch (f.t) {
      case 'name': {
        const s = str(v, 100);
        if (!s || s.length > 100) throw new HttpError(400, `${f.label} peab olema 1–100 märki`);
        out[f.k] = s;
        break;
      }
      case 'text': {
        const s = str(v, f.max!);
        if (s.length > f.max!) throw new HttpError(400, `${f.label} on liiga pikk (kuni ${f.max} märki)`);
        out[f.k] = s || null;
        break;
      }
      case 'color':
        if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v.trim())) throw new HttpError(400, `${f.label} peab olema kujul #rrggbb`);
        out[f.k] = v.trim().toLowerCase();
        break;
      case 'float':
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new HttpError(400, `${f.label} peab olema arv ≥ 0`);
        out[f.k] = v;
        break;
      case 'int':
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 1_000_000) throw new HttpError(400, `${f.label} peab olema täisarv ≥ 0`);
        out[f.k] = v;
        break;
      case 'bool':
        if (typeof v !== 'boolean') throw new HttpError(400, `${f.label}: oodatud jah/ei`);
        out[f.k] = v;
        break;
      case 'enum':
        if (typeof v !== 'string' || !f.values!.includes(v)) throw new HttpError(400, `${f.label}: vigane väärtus`);
        out[f.k] = v;
        break;
    }
  }
  return out;
}

function decodeId(raw: string, message: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new HttpError(404, message);
  }
}

const CROP_NOT_FOUND = 'Kultuuri ei leitud';
const VARIETY_NOT_FOUND = 'Sorti ei leitud';
const WORK_TYPE_NOT_FOUND = 'Tööliiki ei leitud';
const WORK_TYPE_IN_USE = 'Tööliiki kasutatakse mallis';
const DUPLICATE_NAME: Record<string, string> = {
  crop: 'Sellise nimega kultuur on juba olemas',
  variety: 'Sellise nimega sort on juba olemas',
  workType: 'Sellise nimega tööliik on juba olemas'
};

type CatalogEntity = 'crop' | 'variety' | 'workType' | 'template';
type Tx = Prisma.TransactionClient;

// Käivitab muudatuse tehingus koos auditilogiga; Prisma vead tõlgitakse HTTP-vigadeks.
async function catalogMutation<T>(
  pu: PlatformUser,
  entity: CatalogEntity,
  op: 'create' | 'update' | 'delete' | 'replace',
  fn: (tx: Tx) => Promise<{ id: string; name: string; result: T }>
): Promise<T> {
  try {
    return await authDb().$transaction(async (tx) => {
      const { id, name, result } = await fn(tx);
      await tx.platformAuditLog.create({
        data: { action: 'CATALOG_UPDATE', platformUserId: pu.id, targetTenantId: null, details: { entity, op, id, name } }
      });
      return result;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002' && entity === 'template') throw new HttpError(409, 'Mall on samal ajal muudetud — proovi uuesti');
      if (err.code === 'P2002' && DUPLICATE_NAME[entity]) throw new HttpError(409, DUPLICATE_NAME[entity]);
      if (err.code === 'P2003' && entity === 'workType') throw new HttpError(409, WORK_TYPE_IN_USE);
    }
    throw err;
  }
}

async function getCatalog() {
  const db = authDb();
  const [crops, workTypes, templates] = await Promise.all([
    db.catalogCrop.findMany({ orderBy: { name: 'asc' }, include: { varieties: { orderBy: { name: 'asc' } } } }),
    db.catalogWorkType.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    db.catalogWorkTemplate.findMany({
      include: { crop: { select: { name: true } }, items: { orderBy: { sortOrder: 'asc' }, include: { workType: { select: { name: true } } } } }
    })
  ]);
  const tpl = templates.map((t) => ({
    id: t.id,
    catalogCropId: t.catalogCropId,
    cropName: t.crop?.name ?? null,
    isWinter: t.isWinter,
    items: t.items.map((i) => ({
      id: i.id,
      catalogWorkTypeId: i.catalogWorkTypeId,
      workTypeName: i.workType.name,
      sortOrder: i.sortOrder,
      typicalTiming: i.typicalTiming,
      plannedCount: i.plannedCount
    }))
  }));
  tpl.sort((a, b) => (a.cropName ?? '').localeCompare(b.cropName ?? '', 'et') || Number(a.isWinter) - Number(b.isWinter));
  return { crops, workTypes, templates: tpl };
}

async function replaceTemplate(body: any, pu: PlatformUser) {
  const cropId = body?.catalogCropId ?? null;
  if (cropId !== null && typeof cropId !== 'string') throw new HttpError(400, 'Vigane kultuur');
  if (typeof body?.isWinter !== 'boolean') throw new HttpError(400, 'Suve/talve valik puudub');
  const isWinter: boolean = body.isWinter;
  if (!Array.isArray(body?.items) || body.items.length > 200) throw new HttpError(400, 'Mallirea loend puudub või on liiga pikk');
  const items = body.items.map((raw: any) => {
    const id = typeof raw?.catalogWorkTypeId === 'string' ? raw.catalogWorkTypeId : '';
    if (!id) throw new HttpError(400, 'Tööliik puudub');
    const opts = parseFields(
      raw,
      [
        { k: 'typicalTiming', t: 'text', max: 100, nullable: true, label: 'Tüüpiline aeg' },
        { k: 'plannedCount', t: 'int', nullable: true, label: 'Planeeritud kordi' }
      ],
      [],
      true
    );
    return { catalogWorkTypeId: id, typicalTiming: (opts.typicalTiming as string | null | undefined) ?? null, plannedCount: (opts.plannedCount as number | null | undefined) ?? null };
  });
  if (new Set(items.map((i: { catalogWorkTypeId: string }) => i.catalogWorkTypeId)).size !== items.length) {
    throw new HttpError(400, 'Sama tööliik on mallis mitu korda');
  }
  return catalogMutation(pu, 'template', items.length ? 'replace' : 'delete', async (tx) => {
    let cropName: string | null = null;
    if (cropId !== null) {
      const crop = await tx.catalogCrop.findUnique({ where: { id: cropId }, select: { name: true } });
      if (!crop) throw new HttpError(404, CROP_NOT_FOUND);
      cropName = crop.name;
    }
    const found = await tx.catalogWorkType.count({ where: { id: { in: items.map((i: { catalogWorkTypeId: string }) => i.catalogWorkTypeId) } } });
    if (found !== items.length) throw new HttpError(404, WORK_TYPE_NOT_FOUND);
    // NULL catalogCropId korral unikaalsusindeks ei kehti, seepärast otsime üldmalli ise
    const existing = await tx.catalogWorkTemplate.findFirst({ where: { catalogCropId: cropId, isWinter } });
    const name = `${cropName ?? 'Üldmall'} (${isWinter ? 'talv' : 'suvi'})`;
    if (!items.length) {
      if (existing) await tx.catalogWorkTemplate.delete({ where: { id: existing.id } });
      return { id: existing?.id ?? '', name, result: { success: true, templateId: null as string | null } };
    }
    const tpl = existing ?? (await tx.catalogWorkTemplate.create({ data: { catalogCropId: cropId, isWinter } }));
    await tx.catalogWorkTemplateItem.deleteMany({ where: { templateId: tpl.id } });
    await tx.catalogWorkTemplateItem.createMany({
      data: items.map((i: { catalogWorkTypeId: string; typicalTiming: string | null; plannedCount: number | null }, idx: number) => ({ ...i, templateId: tpl.id, sortOrder: idx }))
    });
    return { id: tpl.id, name, result: { success: true, templateId: tpl.id as string | null } };
  });
}

const CATALOG_CROP_ROUTE = /^\/api\/platform\/catalog\/crops(?:\/([^/]+)(?:\/(varieties)(?:\/([^/]+))?)?)?$/;
const CATALOG_WORK_TYPE_ROUTE = /^\/api\/platform\/catalog\/work-types(?:\/([^/]+))?$/;

// Tagastab true, kui päring käsitleti.
async function routeCatalog(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, pu: PlatformUser): Promise<boolean> {
  if (pathname === '/api/platform/catalog') {
    if (method !== 'GET') return false;
    json(res, await getCatalog());
    return true;
  }
  if (pathname === '/api/platform/catalog/templates') {
    if (method !== 'PUT') return false;
    json(res, await replaceTemplate(await readBody(req), pu));
    return true;
  }

  const c = CATALOG_CROP_ROUTE.exec(pathname);
  if (c) {
    const cropId = c[1] ? decodeId(c[1], CROP_NOT_FOUND) : null;
    if (!cropId) {
      if (method !== 'POST') return false;
      const data = parseFields(await readBody(req), CROP_FIELDS, ['name'], false);
      const crop = await catalogMutation(pu, 'crop', 'create', async (tx) => {
        const row = await tx.catalogCrop.create({ data: data as Prisma.CatalogCropCreateInput });
        return { id: row.id, name: row.name, result: row };
      });
      json(res, crop, 201);
      return true;
    }
    if (!c[2]) {
      if (method === 'PATCH') {
        const data = parseFields(await readBody(req), CROP_FIELDS, [], true);
        json(res, await catalogMutation(pu, 'crop', 'update', async (tx) => {
          if (!(await tx.catalogCrop.findUnique({ where: { id: cropId }, select: { id: true } }))) throw new HttpError(404, CROP_NOT_FOUND);
          const row = await tx.catalogCrop.update({ where: { id: cropId }, data: data as Prisma.CatalogCropUpdateInput });
          return { id: row.id, name: row.name, result: row };
        }));
        return true;
      }
      if (method === 'DELETE') {
        json(res, await catalogMutation(pu, 'crop', 'delete', async (tx) => {
          const row = await tx.catalogCrop.findUnique({ where: { id: cropId }, select: { id: true, name: true } });
          if (!row) throw new HttpError(404, CROP_NOT_FOUND);
          await tx.catalogCrop.delete({ where: { id: cropId } }); // sordid ja erimallid kaovad cascade'iga
          return { id: row.id, name: row.name, result: { success: true } };
        }));
        return true;
      }
      return false;
    }
    const varietyId = c[3] ? decodeId(c[3], VARIETY_NOT_FOUND) : null;
    if (!varietyId) {
      if (method !== 'POST') return false;
      const data = parseFields(await readBody(req), VARIETY_FIELDS, ['name'], false);
      json(res, await catalogMutation(pu, 'variety', 'create', async (tx) => {
        if (!(await tx.catalogCrop.findUnique({ where: { id: cropId }, select: { id: true } }))) throw new HttpError(404, CROP_NOT_FOUND);
        const row = await tx.catalogCropVariety.create({ data: { ...(data as { name: string }), catalogCropId: cropId } });
        return { id: row.id, name: row.name, result: row };
      }), 201);
      return true;
    }
    if (method === 'PATCH') {
      const data = parseFields(await readBody(req), VARIETY_FIELDS, [], true);
      json(res, await catalogMutation(pu, 'variety', 'update', async (tx) => {
        if (!(await tx.catalogCropVariety.findFirst({ where: { id: varietyId, catalogCropId: cropId }, select: { id: true } }))) throw new HttpError(404, VARIETY_NOT_FOUND);
        const row = await tx.catalogCropVariety.update({ where: { id: varietyId }, data });
        return { id: row.id, name: row.name, result: row };
      }));
      return true;
    }
    if (method === 'DELETE') {
      json(res, await catalogMutation(pu, 'variety', 'delete', async (tx) => {
        const row = await tx.catalogCropVariety.findFirst({ where: { id: varietyId, catalogCropId: cropId }, select: { id: true, name: true } });
        if (!row) throw new HttpError(404, VARIETY_NOT_FOUND);
        await tx.catalogCropVariety.delete({ where: { id: varietyId } });
        return { id: row.id, name: row.name, result: { success: true } };
      }));
      return true;
    }
    return false;
  }

  const w = CATALOG_WORK_TYPE_ROUTE.exec(pathname);
  if (w) {
    const id = w[1] ? decodeId(w[1], WORK_TYPE_NOT_FOUND) : null;
    if (!id) {
      if (method !== 'POST') return false;
      const data = parseFields(await readBody(req), WORK_TYPE_FIELDS, ['name', 'phase'], false);
      json(res, await catalogMutation(pu, 'workType', 'create', async (tx) => {
        const row = await tx.catalogWorkType.create({ data: data as Prisma.CatalogWorkTypeCreateInput });
        return { id: row.id, name: row.name, result: row };
      }), 201);
      return true;
    }
    if (method === 'PATCH') {
      const data = parseFields(await readBody(req), WORK_TYPE_FIELDS, [], true);
      json(res, await catalogMutation(pu, 'workType', 'update', async (tx) => {
        if (!(await tx.catalogWorkType.findUnique({ where: { id }, select: { id: true } }))) throw new HttpError(404, WORK_TYPE_NOT_FOUND);
        const row = await tx.catalogWorkType.update({ where: { id }, data: data as Prisma.CatalogWorkTypeUpdateInput });
        return { id: row.id, name: row.name, result: row };
      }));
      return true;
    }
    if (method === 'DELETE') {
      json(res, await catalogMutation(pu, 'workType', 'delete', async (tx) => {
        const row = await tx.catalogWorkType.findUnique({ where: { id }, select: { id: true, name: true } });
        if (!row) throw new HttpError(404, WORK_TYPE_NOT_FOUND);
        if (await tx.catalogWorkTemplateItem.count({ where: { catalogWorkTypeId: id } })) throw new HttpError(409, WORK_TYPE_IN_USE);
        await tx.catalogWorkType.delete({ where: { id } });
        return { id: row.id, name: row.name, result: { success: true } };
      }));
      return true;
    }
    return false;
  }
  return false;
}

async function route(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL) {
  const pu = platformUserOf(req)!;

  if (pathname === '/api/platform/tenants') {
    if (method === 'GET') return json(res, await tenantSummaries());
    if (method === 'POST') return json(res, await createTenant(await readBody(req), pu), 201);
  }
  if (pathname === '/api/platform/audit' && method === 'GET') return json(res, await listAudit(url));
  if (pathname === '/api/platform/devices' && method === 'GET') return json(res, await listDevices());
  if (pathname === '/api/platform/devices/registrations' && method === 'GET') return json(res, await listRegistrations(url));
  const dr = DEVICE_RELEASE_ROUTE.exec(pathname);
  if (dr && method === 'POST') {
    await releaseDevice(decodeId(dr[1], DEVICE_NOT_FOUND), pu);
    return json(res, { success: true });
  }
  if (pathname.startsWith('/api/platform/catalog') && (await routeCatalog(req, res, pathname, method, pu))) return;

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
