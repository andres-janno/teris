// src/server/apiHandler.ts
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, tsdb, runInRequestContext, setRequestUser, canDelete, DELETE_FORBIDDEN_MESSAGE } from './db.ts';
import { json, parseBody } from './http.ts';
import { authGate, sessionUserOf } from './authGate.ts';
import { handleAdminUsers } from './adminUsers.ts';
import { handleFieldWorks, applyCropTemplate } from './fieldWorks.ts';
import { resolveHistoryWindow, HISTORY_MAX_POINTS } from './historyWindow.ts';
import { getRecentRadarFrames, getCachedRadarFrame } from './weatherRadar.ts';
import { getSatiladuDates, validateSatiladuQuery, type SatiladuQuery } from './satiladu.ts';
import { checkFieldClouds, validateCloudCheckPolygons } from './satelliteClouds.ts';

const TELEMETRY_STALE_MS = 10 * 60 * 1000; // 10 min ilma uue kirjeta = 'offline'

type RawMeasurementRow = {
  device: string;
  measurement: string;
  field: string;
  value_bool: boolean | null;
  value_int: number | null;
  value_bigint: bigint | null;
  value_double: number | null;
  value_text: string | null;
  time: Date;
};

type LiveFields = Record<string, boolean | number | string> & { lastUpdate: string };

function coalesceValue(row: RawMeasurementRow): boolean | number | string | null {
  if (row.value_bool !== null) return row.value_bool;
  if (row.value_int !== null) return row.value_int;
  if (row.value_bigint !== null) return Number(row.value_bigint);
  if (row.value_double !== null) return row.value_double;
  if (row.value_text !== null) return row.value_text;
  return null;
}

// Mobiilsed (cellular) telemeetriaseadmed raporteerivad otse oma IMEI all,
// measurement='data' ridadena (üks rida välja kohta).
async function fetchCellularTelemetry(imeis: string[]): Promise<Map<string, LiveFields>> {
  const result = new Map<string, LiveFields>();
  if (!tsdb || imeis.length === 0) return result;

  try {
    const rows = await tsdb.$queryRaw<RawMeasurementRow[]>`
      SELECT DISTINCT ON (device, field)
        device, measurement, field, value_bool, value_int, value_bigint, value_double, value_text, time
      FROM measurements
      WHERE measurement = 'data' AND device = ANY(${imeis}::text[])
      ORDER BY device, field, time DESC
    `;

    for (const row of rows) {
      const entry = (result.get(row.device) ?? { lastUpdate: '' }) as LiveFields;
      const value = coalesceValue(row);
      if (value !== null) entry[row.field] = value;
      const t = row.time.toISOString();
      if (!entry.lastUpdate || t > entry.lastUpdate) entry.lastUpdate = t;
      result.set(row.device, entry);
    }
  } catch (err) {
    console.error('telemetry_tsdb: cellular telemetry query failed:', err);
  }

  return result;
}

// Eye sensorid ei raporteeri iseseisvalt — nad on nähtavad mõne mobiilse
// telemeetriaseadme (gateway) alt kuni 3 "pesa" kaudu (eye1/eye2/eye3),
// kus field='mac' ütleb, milline füüsiline sensor hetkel selles pesas on.
// Kuna me ei tea ette, milline gateway+pesa kombinatsioon millisele MAC-ile
// vastab, loeme kõik pesad ja otsime vastet meid huvitavate MAC-ide seas.
async function fetchEyeTelemetry(macAddresses: string[]): Promise<Map<string, LiveFields>> {
  const result = new Map<string, LiveFields>();
  if (!tsdb || macAddresses.length === 0) return result;

  try {
    const rows = await tsdb.$queryRaw<RawMeasurementRow[]>`
      SELECT DISTINCT ON (device, measurement, field)
        device, measurement, field, value_bool, value_int, value_bigint, value_double, value_text, time
      FROM measurements
      WHERE measurement IN ('eye1', 'eye2', 'eye3')
      ORDER BY device, measurement, field, time DESC
    `;

    const slots = new Map<string, LiveFields>();
    for (const row of rows) {
      const slotKey = `${row.device}:${row.measurement}`;
      const entry = (slots.get(slotKey) ?? { lastUpdate: '' }) as LiveFields;
      const value = coalesceValue(row);
      if (value !== null) entry[row.field] = value;
      const t = row.time.toISOString();
      if (!entry.lastUpdate || t > entry.lastUpdate) entry.lastUpdate = t;
      slots.set(slotKey, entry);
    }

    const wanted = new Set(macAddresses.map((m) => m.toUpperCase()));
    for (const entry of slots.values()) {
      const mac = typeof entry.mac === 'string' ? entry.mac.toUpperCase() : null;
      if (mac && wanted.has(mac)) {
        result.set(mac, entry);
      }
    }
  } catch (err) {
    console.error('telemetry_tsdb: eye sensor telemetry query failed:', err);
  }

  return result;
}

type HistoryRow = {
  time: Date;
  fields: Record<string, number>;
};

// Toore GPS-jälje ajalugu ühe mobiilse seadme kohta (kasutusel harimise
// taasesituse paneelis) — pivotib measurement='data' read ajatempli järgi
// üheks JSON-objektiks per pakett, kuna seade saadab kõik väljad
// (lat/lng/kiirus/suund) sama ajatempliga korraga.
async function fetchDeviceHistory(imei: string, hours: number, from?: string | null, to?: string | null): Promise<HistoryRow[]> {
  if (!tsdb) return [];
  try {
    // Seotud seadme puhul piirab akent nii seotuse vahemik kui ka valitud tundide arv.
    // Kui pakette on rohkem kui HISTORY_MAX_POINTS, hõrendatakse neid ühtlaselt üle kogu akna
    // (mitte ei võeta viimaseid N), et sagedase saatmise korral ei kahaneks aken paarile minutile.
    const { start, end } = resolveHistoryWindow(hours, from, to);
    return await tsdb.$queryRaw<HistoryRow[]>`
      WITH packets AS (
        SELECT time,
          jsonb_object_agg(
            field,
            COALESCE(value_double, value_int::double precision, value_bigint::double precision)
          ) AS fields
        FROM measurements
        WHERE device = ${imei}
          AND measurement = 'data'
          AND field IN ('latitude', 'longitude', 'angle', 'speed', 'speed_avl_kmh', 'altitude')
          AND time >= ${start}
          AND time <= ${end}
        GROUP BY time
        HAVING bool_or(field = 'latitude') AND bool_or(field = 'longitude')
      ),
      numbered AS (
        SELECT time, fields,
          row_number() OVER (ORDER BY time) AS rn,
          count(*) OVER () AS cnt
        FROM packets
      )
      SELECT time, fields FROM numbered
      WHERE (rn - 1) % GREATEST(1, CEIL(cnt / ${HISTORY_MAX_POINTS}::numeric))::bigint = 0
        OR rn = cnt
      ORDER BY time ASC
    `;
  } catch (err) {
    console.error('telemetry_tsdb: device history query failed:', err);
    return [];
  }
}

// Asendab hooaja katastriüksuste seosed kliendi saadetud nimekirjaga; tundmatu tunnus lisatakse registrisse.
async function syncSeasonCadastralParcels(fieldSeasonId: number, links: any[]): Promise<void> {
  const num = (v: unknown) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));
  const keepParcelIds: number[] = [];
  for (const l of links) {
    const cadastralCode = String(l?.cadastralCode ?? '').trim();
    if (!cadastralCode) continue;
    const parcelName = String(l?.parcelName ?? '').trim() || null;
    const parcel = await prisma.cadastralParcel.upsert({
      where: { cadastralCode },
      update: parcelName ? { name: parcelName } : {},
      create: { cadastralCode, name: parcelName }
    });
    const data = {
      fieldAreaHa: num(l?.fieldAreaHa) ?? 0,
      ownershipType: (l?.ownershipType === 'RENTED' ? 'RENTED' : 'OWNED') as 'OWNED' | 'RENTED',
      ownerName: String(l?.ownerName ?? '').trim() || null,
      landTaxEurHa: num(l?.landTaxEurHa),
      landTaxEurYear: num(l?.landTaxEurYear),
      rentFeeEurHa: num(l?.rentFeeEurHa),
      rentFeeEurYear: num(l?.rentFeeEurYear),
      notes: String(l?.notes ?? '').trim() || null
    };
    await prisma.fieldCadastralParcel.upsert({
      where: { fieldSeasonId_cadastralParcelId: { fieldSeasonId, cadastralParcelId: parcel.id } },
      update: data,
      create: { fieldSeasonId, cadastralParcelId: parcel.id, ...data }
    });
    keepParcelIds.push(parcel.id);
  }
  await prisma.fieldCadastralParcel.deleteMany({
    where: { fieldSeasonId, cadastralParcelId: { notIn: keepParcelIds } }
  });
}

// Andmete importimine (PRIA, mullaproovid, põlluraamat) on lubatud ainult adminile.
const IMPORT_FORBIDDEN = 'Andmete importimine on lubatud ainult adminile';
const isAdmin = (req: IncomingMessage) => sessionUserOf(req)?.isAdmin === true;

// Kustutada saab ainult kirje looja või admin. Tagastab true, kui keelduv vastus on saadetud.
function denyDelete(req: IncomingMessage, res: ServerResponse, record: { createdBy: string | null } | null): boolean {
  if (!record || canDelete(sessionUserOf(req), record.createdBy)) return false;
  json(res, { error: DELETE_FORBIDDEN_MESSAGE }, 403);
  return true;
}

// Vabatekst (liik, VIN / seerianumber): tühikud kärbitud, tühi → null
function cleanText(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  return s || null;
}

function toPositiveNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return value != null && value !== '' && Number.isFinite(n) && n > 0 ? n : null;
}

// Kuupäev ilma kellaajata (@db.Date): 'YYYY-MM-DD' ↔ Date (UTC südaöö)
function dateOnlyIn(value: unknown): Date | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : null;
}

function dateOnlyOut(value: Date | null): string | undefined {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

// Soetusmaksumus ja amortisatsioon (masinad ja haakeriistad). Meetod andmebaasis suurtähtedega.
const DEPRECIATION_METHODS = ['LINEAR', 'DECLINING'];

function depreciationIn(body: any) {
  const method = typeof body.depreciationMethod === 'string' ? body.depreciationMethod.toUpperCase() : '';
  const rate = toPositiveNumber(body.depreciationRate);
  return {
    acquisitionCost: toPositiveNumber(body.acquisitionCost),
    acquisitionDate: dateOnlyIn(body.acquisitionDate),
    depreciationRate: rate != null && rate <= 100 ? rate : null,
    depreciationMethod: DEPRECIATION_METHODS.includes(method) ? method : null
  };
}

function depreciationOut(row: { acquisitionCost: number | null; acquisitionDate: Date | null; depreciationRate: number | null; depreciationMethod: string | null }) {
  return {
    acquisitionCost: row.acquisitionCost ?? undefined,
    acquisitionDate: dateOnlyOut(row.acquisitionDate),
    depreciationRate: row.depreciationRate ?? undefined,
    depreciationMethod: row.depreciationMethod?.toLowerCase() ?? undefined
  };
}

// Hetkel kehtivad haakimised haakimise registrist (ainus tõeallikas). Kui register sisaldab
// kattuvaid kirjeid, loeb iga masina ja haakeriista puhul viimasena alanud kirje.
async function activeHitches() {
  const now = new Date();
  const rows = await prisma.implementAssignment.findMany({
    where: { startedAt: { lte: now }, OR: [{ endedAt: null }, { endedAt: { gt: now } }] },
    orderBy: { startedAt: 'desc' }
  });
  const byVehicle = new Map<string, string>();
  const byImplement = new Map<string, string>();
  for (const r of rows) {
    if (byVehicle.has(r.vehicleId) || byImplement.has(r.implementId)) continue;
    byVehicle.set(r.vehicleId, r.implementId);
    byImplement.set(r.implementId, r.vehicleId);
  }
  return { byVehicle, byImplement };
}

// Hetkel kehtivad seadmete seosed seadmete seoste registrist (ainus tõeallikas).
// Kattuvate kirjete korral loeb iga seadme, masina ja haakeriista puhul viimasena alanud kirje.
async function activeDeviceLinks() {
  const now = new Date();
  const rows = await prisma.deviceAssignment.findMany({
    where: { startedAt: { lte: now }, OR: [{ endedAt: null }, { endedAt: { gt: now } }] },
    orderBy: { startedAt: 'desc' }
  });
  const byDevice = new Map<string, { vehicleId?: string; implementId?: string }>();
  const byVehicle = new Map<string, string>();
  const byImplement = new Map<string, string>();
  for (const r of rows) {
    if (byDevice.has(r.deviceId)) continue;
    if (r.vehicleId && !byVehicle.has(r.vehicleId)) {
      byVehicle.set(r.vehicleId, r.deviceId);
      byDevice.set(r.deviceId, { vehicleId: r.vehicleId });
    } else if (r.implementId && !byImplement.has(r.implementId)) {
      byImplement.set(r.implementId, r.deviceId);
      byDevice.set(r.deviceId, { implementId: r.implementId });
    }
  }
  return { byDevice, byVehicle, byImplement };
}

const DEVICE_ASSIGNMENT_INCLUDE = {
  device: { select: { id: true, model: true, imei: true, macAddress: true, connectivityType: true } },
  vehicle: { select: { id: true, name: true } },
  implement: { select: { id: true, name: true } }
} as const;

function formatDeviceAssignment(a: any) {
  return {
    id: a.id,
    deviceId: a.deviceId,
    deviceModel: a.device?.model,
    deviceIdentifier: a.device?.imei ?? a.device?.macAddress ?? undefined,
    deviceConnectivity: a.device?.connectivityType?.toLowerCase(),
    vehicleId: a.vehicleId ?? undefined,
    vehicleName: a.vehicle?.name,
    implementId: a.implementId ?? undefined,
    implementName: a.implement?.name,
    startedAt: a.startedAt.toISOString(),
    endedAt: a.endedAt ? a.endedAt.toISOString() : undefined,
    notes: a.notes ?? undefined,
    createdAt: a.createdAt.toISOString()
  };
}

// Registri kirje sisend: seade + täpselt üks sihtmärk (masin VÕI haakeriist), algus ≤ lõpp
function parseDeviceAssignmentBody(body: any): { data?: any; error?: string } {
  const { deviceId, vehicleId, implementId, startedAt, endedAt, notes } = body;
  if (!deviceId) return { error: 'Vali seade.' };
  if (!vehicleId === !implementId) return { error: 'Vali kas masin või haakeriist (üks neist).' };
  const start = startedAt ? new Date(startedAt) : new Date();
  const end = endedAt ? new Date(endedAt) : null;
  if (isNaN(start.getTime()) || (end && isNaN(end.getTime()))) return { error: 'Vigane kuupäev või kellaaeg.' };
  if (end && end < start) return { error: 'Lõppaeg ei saa olla varasem kui algusaeg.' };
  return {
    data: {
      deviceId,
      vehicleId: vehicleId || null,
      implementId: implementId || null,
      startedAt: start,
      endedAt: end,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null
    }
  };
}

export interface ApiOptions {
  allowedOrigins: string[];
  requireAuth: boolean;
}

// Task 5 asendab sessiooni kasutaja ettevõttega ja eemaldab selle konstandi
const TEMP_SINGLE_TENANT_ID = 'tenant-loisu-agro';

export function handleApiRequest(req: IncomingMessage, res: ServerResponse, options: ApiOptions): Promise<void> {
  // Kirjete looja/muutja (createdBy/updatedBy) täidetakse selle päringu kasutaja järgi
  return runInRequestContext(() => routeApiRequest(req, res, options));
}

async function routeApiRequest(req: IncomingMessage, res: ServerResponse, options: ApiOptions): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase() || 'GET';

  try {
    if (await authGate(req, res, pathname, method, options)) return;
    const sessionUser = sessionUserOf(req);
    setRequestUser(sessionUser ? { username: sessionUser.username, tenantId: TEMP_SINGLE_TENANT_ID } : null);
    if (await handleAdminUsers(req, res, pathname, method)) return;
    if (await handleFieldWorks(req, res, pathname, method, url)) return;

    // 1. Health check / status
    if (pathname === '/api/status' && method === 'GET') {
      const [seasonsCount, fieldsCount, fieldSeasonsCount, poisCount, vehiclesCount, cropsCount] =
        await Promise.all([
          prisma.season.count(),
          prisma.field.count(),
          prisma.fieldSeason.count(),
          prisma.pointOfInterest.count(),
          prisma.vehicle.count(),
          prisma.crop.count()
        ]);

      return json(res, {
        status: 'connected',
        database: 'teris_db',
        counts: {
          seasons: seasonsCount,
          fields: fieldsCount,
          fieldSeasons: fieldSeasonsCount,
          pois: poisCount,
          vehicles: vehiclesCount,
          crops: cropsCount
        }
      });
    }

    // 2. Seasons
    if (pathname === '/api/seasons' && method === 'GET') {
      const dbSeasons = await prisma.season.findMany({
        orderBy: { year: 'desc' }
      });
      const mapped = dbSeasons.map((s) => ({
        id: s.id,
        year: s.year,
        name: s.name,
        status: s.status.toLowerCase(),
        isLocked: s.isLocked,
        preparationStartDate: s.preparationStartDate?.toISOString().split('T')[0] ?? null,
        seedingStartDate: s.seedingStartDate?.toISOString().split('T')[0] ?? null,
        harvestStartDate: s.harvestStartDate?.toISOString().split('T')[0] ?? null,
        harvestEndDate: s.harvestEndDate?.toISOString().split('T')[0] ?? null,
        closedAt: s.closedAt?.toISOString().split('T')[0] ?? null,
        closedBy: s.closedBy,
        totalAreaHa: s.totalAreaHa,
        fieldsCount: s.fieldsCount,
        targetYieldTons: s.targetYieldTons,
        actualYieldTons: s.actualYieldTons,
        notes: s.notes
      }));
      return json(res, mapped);
    }

    if (pathname === '/api/seasons' && method === 'POST') {
      const body = await parseBody(req);
      const statusUpper = (body.status || 'planning').toUpperCase();
      const saved = await prisma.season.upsert({
        where: { year: Number(body.year) },
        update: {
          name: body.name,
          status: statusUpper as any,
          isLocked: Boolean(body.isLocked),
          preparationStartDate: body.preparationStartDate ? new Date(body.preparationStartDate) : null,
          seedingStartDate: body.seedingStartDate ? new Date(body.seedingStartDate) : null,
          harvestStartDate: body.harvestStartDate ? new Date(body.harvestStartDate) : null,
          harvestEndDate: body.harvestEndDate ? new Date(body.harvestEndDate) : null,
          closedAt: body.closedAt ? new Date(body.closedAt) : null,
          closedBy: body.closedBy ?? null,
          totalAreaHa: body.totalAreaHa != null ? Number(body.totalAreaHa) : null,
          fieldsCount: body.fieldsCount != null ? Number(body.fieldsCount) : null,
          targetYieldTons: body.targetYieldTons != null ? Number(body.targetYieldTons) : null,
          actualYieldTons: body.actualYieldTons != null ? Number(body.actualYieldTons) : null,
          notes: body.notes ?? null
        },
        create: {
          year: Number(body.year),
          name: body.name,
          status: statusUpper as any,
          isLocked: Boolean(body.isLocked),
          preparationStartDate: body.preparationStartDate ? new Date(body.preparationStartDate) : null,
          seedingStartDate: body.seedingStartDate ? new Date(body.seedingStartDate) : null,
          harvestStartDate: body.harvestStartDate ? new Date(body.harvestStartDate) : null,
          harvestEndDate: body.harvestEndDate ? new Date(body.harvestEndDate) : null,
          closedAt: body.closedAt ? new Date(body.closedAt) : null,
          closedBy: body.closedBy ?? null,
          totalAreaHa: body.totalAreaHa != null ? Number(body.totalAreaHa) : null,
          fieldsCount: body.fieldsCount != null ? Number(body.fieldsCount) : null,
          targetYieldTons: body.targetYieldTons != null ? Number(body.targetYieldTons) : null,
          actualYieldTons: body.actualYieldTons != null ? Number(body.actualYieldTons) : null,
          notes: body.notes ?? null
        }
      });
      return json(res, saved);
    }

    // 3. Master Fields (Fields + FieldSeasons)
    if (pathname === '/api/master-fields' && method === 'GET') {
      const dbFields = await prisma.field.findMany({
        include: {
          fieldSeasons: {
            orderBy: { year: 'desc' },
            include: {
              _count: { select: { operations: true } },
              cadastralParcels: { include: { cadastralParcel: true }, orderBy: { id: 'asc' } }
            }
          },
          operator: true
        },
        orderBy: { id: 'asc' }
      });

      const mapped = dbFields.map((f) => ({
        id: f.id,
        num: f.num,
        name: f.name,
        fieldCode: f.fieldCode,
        cadastralCode: f.cadastralCode,
        soilType: f.soilType,
        drainageSystem: f.drainageSystem,
        operatorId: f.operatorId ?? undefined,
        operatorName: f.operator?.name ?? undefined,
        notes: f.notes,
        history: f.fieldSeasons.map((fs) => ({
          fieldSeasonId: fs.id,
          year: fs.year,
          areaHa: fs.areaHa,
          eligibleAreaHa: fs.eligibleAreaHa,
          areaChangeReason: fs.areaChangeReason,
          crop: fs.crop,
          cropVariety: fs.cropVariety,
          cropColor: fs.cropColor,
          operationsCount: fs._count.operations,
          cadastralParcels: fs.cadastralParcels.map((link) => ({
            cadastralCode: link.cadastralParcel.cadastralCode,
            parcelName: link.cadastralParcel.name ?? undefined,
            ownershipType: link.ownershipType,
            ownerName: link.ownerName ?? '',
            fieldAreaHa: link.fieldAreaHa,
            landTaxEurHa: link.landTaxEurHa ?? undefined,
            landTaxEurYear: link.landTaxEurYear ?? undefined,
            rentFeeEurHa: link.rentFeeEurHa ?? undefined,
            rentFeeEurYear: link.rentFeeEurYear ?? undefined,
            notes: link.notes ?? undefined
          })),
          targetYieldTonsHa: fs.targetYieldTonsHa,
          actualYieldTonsHa: fs.actualYieldTonsHa,
          workedAreaHa: fs.workedAreaHa,
          workProgress: fs.workProgress,
          status: fs.status.toLowerCase(),
          seedingDate: fs.seedingDate?.toISOString().split('T')[0] ?? null,
          harvestDate: fs.harvestDate?.toISOString().split('T')[0] ?? null,
          boundaryPointsCount: fs.boundaryPointsCount,
          perimeterM: fs.perimeterM,
          notes: fs.notes,
          geometry: fs.geometry
        }))
      }));

      return json(res, mapped);
    }

    if (pathname === '/api/master-fields' && method === 'POST') {
      const body = await parseBody(req);
      // Massiline salvestus (massiiv) = PRIA import — ainult adminile. Üksiku põllu muutmine on kõigile.
      if (Array.isArray(body) && !isAdmin(req)) return json(res, { error: IMPORT_FORBIDDEN }, 403);
      const items = Array.isArray(body) ? body : [body];
      const results = [];

      for (const item of items) {
        const num = item.num || 'x';
        const fieldCode = String(item.fieldCode);
        const operatorId = item.operatorId || null;

        // Kui klient saadab olemasoleva põllu sisemise ID (redigeerimine
        // FieldManagerModal'is), sobitame ALATI selle järgi — muidu, kui
        // kasutaja muudab nt operaatorit, muutuks loomulik võti
        // (massiiv+number+operaator) ja allolev findFirst ei leiaks vana
        // rida üles, luues selle asemel DUPLIKAADI (nii juhtuski:
        // "Murikatsi Mirka" operaatori muutmine tekitas teise Field'i
        // koos kõigi aastate field_seasons kirjetega).
        // Ainult siis, kui ID puudub/ei leidu (nt PRIA import, kus id on
        // kliendi genereeritud järjenumber), sobitame loomuliku võtmega
        // (massiiv, põllunumber, operaator) — sama massiiv+number võib
        // korduda eri operaatoritel. Prisma compound-unique `where` ei
        // luba `null` väärtust nullable veeru jaoks, seega kasutame
        // findFirst'i, mitte upsert'i.
        const itemId = Number(item.id);
        let existingField = !isNaN(itemId)
          ? await prisma.field.findUnique({ where: { id: itemId } })
          : null;
        if (!existingField) {
          existingField = await prisma.field.findFirst({
            where: { fieldCode, num, operatorId }
          });
        }
        const fieldUpdateData = {
          num,
          fieldCode,
          operatorId,
          name: item.name,
          cadastralCode: item.cadastralCode ?? null,
          soilType: item.soilType ?? null,
          drainageSystem: Boolean(item.drainageSystem),
          notes: item.notes ?? null
        };
        const upsertedField = existingField
          ? await prisma.field.update({ where: { id: existingField.id }, data: fieldUpdateData })
          : await prisma.field.create({ data: fieldUpdateData });

        if (item.history && Array.isArray(item.history)) {
          for (const h of item.history) {
            const statusUpper = (h.status || 'not_started').toUpperCase();
            const season = await prisma.season.findUnique({ where: { year: Number(h.year) } });
            const seasonId = season?.id ?? null;
            // Kultuuri muutus → põllutööde mall (vt fieldWorks.ts applyCropTemplate)
            const previousSeason = await prisma.fieldSeason.findUnique({
              where: { fieldId_year: { fieldId: upsertedField.id, year: Number(h.year) } },
              select: { crop: true }
            });
            const savedSeason = await prisma.fieldSeason.upsert({
              where: {
                fieldId_year: {
                  fieldId: upsertedField.id,
                  year: Number(h.year)
                }
              },
              update: {
                seasonId,
                areaHa: Number(h.areaHa) || 0,
                eligibleAreaHa: h.eligibleAreaHa != null ? Number(h.eligibleAreaHa) : null,
                areaChangeReason: h.areaChangeReason ?? null,
                crop: h.crop || 'Teadmata kultuur',
                cropVariety: h.cropVariety ?? null,
                cropColor: h.cropColor || '#eab308',
                targetYieldTonsHa: h.targetYieldTonsHa != null ? Number(h.targetYieldTonsHa) : null,
                actualYieldTonsHa: h.actualYieldTonsHa != null ? Number(h.actualYieldTonsHa) : null,
                workedAreaHa: Number(h.workedAreaHa) || 0,
                workProgress: Number(h.workProgress) || 0,
                status: statusUpper as any,
                seedingDate: h.seedingDate ? new Date(h.seedingDate) : null,
                harvestDate: h.harvestDate ? new Date(h.harvestDate) : null,
                notes: h.notes ?? null,
                geometry: h.geometry || item.geometry || null
              },
              create: {
                fieldId: upsertedField.id,
                seasonId,
                year: Number(h.year),
                areaHa: Number(h.areaHa) || 0,
                eligibleAreaHa: h.eligibleAreaHa != null ? Number(h.eligibleAreaHa) : null,
                areaChangeReason: h.areaChangeReason ?? null,
                crop: h.crop || 'Teadmata kultuur',
                cropVariety: h.cropVariety ?? null,
                cropColor: h.cropColor || '#eab308',
                targetYieldTonsHa: h.targetYieldTonsHa != null ? Number(h.targetYieldTonsHa) : null,
                actualYieldTonsHa: h.actualYieldTonsHa != null ? Number(h.actualYieldTonsHa) : null,
                workedAreaHa: Number(h.workedAreaHa) || 0,
                workProgress: Number(h.workProgress) || 0,
                status: statusUpper as any,
                seedingDate: h.seedingDate ? new Date(h.seedingDate) : null,
                harvestDate: h.harvestDate ? new Date(h.harvestDate) : null,
                notes: h.notes ?? null,
                geometry: h.geometry || item.geometry || null
              }
            });
            // Hooaja katastriüksused: ainult kui klient need saatis (PRIA import ei saada → jäävad puutumata).
            if (Array.isArray(h.cadastralParcels)) {
              await syncSeasonCadastralParcels(savedSeason.id, h.cadastralParcels);
            }
            if (previousSeason?.crop !== savedSeason.crop) {
              await applyCropTemplate(savedSeason.id);
            }
          }
        }

        results.push(upsertedField);
      }

      return json(res, { success: true, count: results.length });
    }

    if (pathname.startsWith('/api/master-fields/') && method === 'DELETE') {
      const idPart = pathname.replace('/api/master-fields/', '');
      const fieldId = Number(idPart);
      if (isNaN(fieldId)) {
        return json(res, { error: 'master-fields delete requires a numeric field id' }, 400);
      }
      if (denyDelete(req, res, await prisma.field.findUnique({ where: { id: fieldId }, select: { createdBy: true } }))) return;
      await prisma.field.delete({ where: { id: fieldId } });
      return json(res, { success: true, id: idPart });
    }

    // 4. Points of Interest (POI)
    // Rakenduse kategooria ↔ andmebaasi enum (nimed erinevad; puuduv vaste → OTHER / 'other').
    const POI_CATEGORY_TO_DB: Record<string, string> = {
      dryer: 'DRYER',
      water_point: 'WATER_SOURCE',
      workshop: 'WORKSHOP',
      fuel_station: 'FUEL_STATION',
      warehouse: 'STORAGE',
      other: 'OTHER'
    };
    const POI_CATEGORY_FROM_DB: Record<string, string> = Object.fromEntries(
      Object.entries(POI_CATEGORY_TO_DB).map(([app, db]) => [db, app])
    );

    if (pathname === '/api/poi' && method === 'GET') {
      const dbPois = await prisma.pointOfInterest.findMany({
        orderBy: { name: 'asc' }
      });
      const mapped = dbPois.map((p) => ({
        id: p.id,
        name: p.name,
        category: POI_CATEGORY_FROM_DB[p.category] ?? 'other',
        position: [p.latitude, p.longitude],
        description: p.description ?? undefined,
        capacity: p.capacity ?? undefined,
        contactPerson: p.contactPerson ?? undefined,
        phone: p.phone ?? undefined,
        accessNotes: p.accessNotes ?? undefined
      }));
      return json(res, mapped);
    }

    if (pathname === '/api/poi' && method === 'POST') {
      const body = await parseBody(req);
      const categoryUpper = POI_CATEGORY_TO_DB[body.category] ?? 'OTHER';
      const lat = Array.isArray(body.position) ? body.position[0] : body.latitude;
      const lng = Array.isArray(body.position) ? body.position[1] : body.longitude;

      const saved = await prisma.pointOfInterest.upsert({
        where: { id: body.id || `poi-${Date.now()}` },
        update: {
          name: body.name,
          category: categoryUpper as any,
          latitude: Number(lat),
          longitude: Number(lng),
          description: body.description ?? null,
          capacity: body.capacity ?? null,
          contactPerson: body.contactPerson ?? null,
          phone: body.phone ?? null,
          accessNotes: body.accessNotes ?? null
        },
        create: {
          id: body.id || `poi-${Date.now()}`,
          name: body.name,
          category: categoryUpper as any,
          latitude: Number(lat),
          longitude: Number(lng),
          description: body.description ?? null,
          capacity: body.capacity ?? null,
          contactPerson: body.contactPerson ?? null,
          phone: body.phone ?? null,
          accessNotes: body.accessNotes ?? null
        }
      });
      return json(res, saved);
    }

    if (pathname.startsWith('/api/poi/') && method === 'DELETE') {
      const id = pathname.replace('/api/poi/', '');
      if (denyDelete(req, res, await prisma.pointOfInterest.findUnique({ where: { id }, select: { createdBy: true } }))) return;
      await prisma.pointOfInterest.delete({ where: { id } });
      return json(res, { success: true, id });
    }

    // 5. Fleet (Vehicles, Implements, Devices)
    if (pathname === '/api/fleet' && method === 'GET') {
      const [rawVehicles, rawImplements, rawDevices, activeAssignments, hitches, deviceLinks] = await Promise.all([
        prisma.vehicle.findMany({
          include: { assignedDriver: true }
        }),
        prisma.implement.findMany(),
        prisma.telemetryDevice.findMany(),
        prisma.deviceAssignment.findMany({
          where: { endedAt: null }
        }),
        activeHitches(),
        activeDeviceLinks()
      ]);

      const vehicles = rawVehicles.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type.toLowerCase(),
        category: v.category ?? undefined,
        manufacturer: v.manufacturer ?? undefined,
        model: v.model,
        powerKw: v.powerKw ?? undefined,
        ...depreciationOut(v),
        registrationPlate: v.regNumber ?? undefined,
        serialNumber: v.serialNumber ?? undefined,
        color: v.color,
        driverName: v.assignedDriver?.name,
        assignedDeviceId: deviceLinks.byVehicle.get(v.id),
        assignedImplementId: hitches.byVehicle.get(v.id),
        lastKnownPosition: (v.lastLatitude != null && v.lastLongitude != null)
          ? [v.lastLatitude, v.lastLongitude] as [number, number]
          : undefined,
        lastActiveAt: v.lastActiveAt ? v.lastActiveAt.toISOString() : undefined,
        notes: (v as any).notes ?? undefined
      }));

      const implementsList = rawImplements.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type.toLowerCase(),
        category: i.category ?? undefined,
        ...depreciationOut(i),
        model: i.model ?? '',
        manufacturer: i.manufacturer ?? '',
        serialNumber: i.serialNumber ?? undefined,
        workingWidthM: i.workingWidthM,
        year: i.year ?? undefined,
        assignedDeviceId: deviceLinks.byImplement.get(i.id),
        assignedVehicleId: hitches.byImplement.get(i.id),
        notes: i.notes ?? undefined
      }));

      const cellularImeis = rawDevices
        .filter((d) => d.connectivityType === 'CELLULAR' && d.imei)
        .map((d) => d.imei as string);
      const eyeMacs = rawDevices
        .filter((d) => d.connectivityType === 'EYE_SENSOR' && d.macAddress)
        .map((d) => d.macAddress as string);

      const [cellularTelemetry, eyeTelemetry] = await Promise.all([
        fetchCellularTelemetry(cellularImeis),
        fetchEyeTelemetry(eyeMacs)
      ]);

      const now = Date.now();

      const devices = rawDevices.map((d) => {
        const assignment = activeAssignments.find((a) => a.deviceId === d.id);
        const isEye = d.connectivityType === 'EYE_SENSOR';
        const live = isEye
          ? (d.macAddress ? eyeTelemetry.get(d.macAddress.toUpperCase()) : undefined)
          : (d.imei ? cellularTelemetry.get(d.imei) : undefined);

        // Kontrolli, kas viimane mõõtmine tsdb-s toimus enne seadme praegusele masinale paigaldamist.
        // Kui jah, kuulus see eelmisele tehnikale ja praeguse masina jaoks pole uusi andmeid veel tulnud.
        const isBeforeAssignment = Boolean(
          assignment && live?.lastUpdate && (new Date(live.lastUpdate) < assignment.startedAt)
        );

        const effectiveLive = isBeforeAssignment ? null : live;
        const lastUpdate = effectiveLive?.lastUpdate ?? null;
        const isStale = !lastUpdate || (now - new Date(lastUpdate).getTime() > TELEMETRY_STALE_MS);

        let status: string;
        if (!effectiveLive || isStale) {
          status = 'offline';
        } else if (isEye) {
          status = 'idling';
        } else {
          const speed = Number(effectiveLive.speed ?? effectiveLive.speed_avl_kmh ?? 0);
          status = speed > 1 ? 'moving' : (effectiveLive.ignition ? 'idling' : 'stopped');
        }

        const base = {
          id: d.id,
          connectivityType: d.connectivityType.toLowerCase(),
          imei: d.imei ?? undefined,
          macAddress: d.macAddress ?? undefined,
          model: d.model,
          simNumber: d.simNumber ?? '',
          firmwareVersion: d.firmware ?? undefined,
          acquisitionDate: dateOnlyOut(d.acquisitionDate),
          assignedVehicleId: deviceLinks.byDevice.get(d.id)?.vehicleId,
          assignedImplementId: deviceLinks.byDevice.get(d.id)?.implementId,
          status,
          notes: (d as any).notes ?? undefined,
          lastUpdate: lastUpdate ?? ''
        };

        if (isEye) {
          return {
            ...base,
            // eye_sensor: batteryVoltage hoiab siin aku TASET %-des (mitte V) —
            // tsdb annab ainult protsendi, mitte pinget selle seadmetüübi jaoks.
            batteryVoltage: Number(effectiveLive?.eye_battery_percent ?? 0),
            eyeTemperatureC: effectiveLive?.eye_temperature_c != null ? Number(effectiveLive.eye_temperature_c) : undefined,
            eyeHumidityPercent: effectiveLive?.eye_humidity_percent != null ? Number(effectiveLive.eye_humidity_percent) : undefined,
            eyeMagnetClosed: typeof effectiveLive?.eye_magnet_closed === 'boolean' ? effectiveLive.eye_magnet_closed : undefined,
            fuelLevelPct: 0,
            ignition: false,
            hydraulicActive: false,
            satelliteCount: 0,
            hdop: 9.9,
            position: undefined,
            heading: 0,
            speedKmH: 0
          };
        }

        return {
          ...base,
          batteryVoltage: Number(effectiveLive?.external_voltage_v ?? 0),
          fuelLevelPct: 0,
          // hydraulicActive: telemetry_tsdb ei anna selle jaoks (io_194) teadaolevat tähendust
          ignition: Boolean(effectiveLive?.ignition),
          hydraulicActive: false,
          satelliteCount: Number(effectiveLive?.satellites ?? 0),
          hdop: Number(effectiveLive?.gnss_hdop ?? 9.9),
          altitude: effectiveLive?.altitude != null ? Number(effectiveLive.altitude) : undefined,
          position: (effectiveLive?.latitude != null && effectiveLive?.longitude != null)
            ? [Number(effectiveLive.latitude), Number(effectiveLive.longitude)] as [number, number]
            : undefined,
          heading: Number(effectiveLive?.angle ?? 0),
          speedKmH: isStale ? 0 : Number(effectiveLive?.speed ?? effectiveLive?.speed_avl_kmh ?? 0)
        };
      });

      return json(res, { vehicles, implements: implementsList, devices });
    }

    async function recordImplementAssignment(implementId: string, vehicleId?: string | null, notes?: string) {
      const now = new Date();
      const currentActive = await prisma.implementAssignment.findFirst({
        where: { implementId, endedAt: null }
      });

      if (vehicleId && currentActive && currentActive.vehicleId === vehicleId) {
        return;
      }

      if (currentActive) {
        await prisma.implementAssignment.update({
          where: { id: currentActive.id },
          data: { endedAt: now }
        });
      }

      if (vehicleId) {
        await prisma.implementAssignment.updateMany({
          where: { vehicleId, endedAt: null },
          data: { endedAt: now }
        });
        await prisma.implementAssignment.create({
          data: {
            vehicleId,
            implementId,
            startedAt: now,
            notes: notes ?? null
          }
        });
      }
    }

    if (pathname === '/api/fleet/vehicles' && method === 'POST') {
      const v = await parseBody(req);
      const vData: any = {
        name: v.name,
        type: (v.type || 'tractor').toUpperCase() as any,
        category: cleanText(v.category),
        manufacturer: cleanText(v.manufacturer),
        model: typeof v.model === 'string' ? v.model.trim() : '',
        powerKw: toPositiveNumber(v.powerKw),
        ...depreciationIn(v),
        regNumber: v.registrationPlate || v.regNumber || null,
        serialNumber: cleanText(v.serialNumber),
        color: v.color || '#10b981',
        notes: v.notes ?? null
      };

      const saved = await prisma.vehicle.upsert({
        where: { id: v.id || `veh-${Date.now()}` },
        update: vData,
        create: {
          id: v.id || `veh-${Date.now()}`,
          ...vData
        }
      });

      // Haakimine ei käi masina vormi kaudu: see on ainult haakimise registris
      return json(res, saved);
    }

    if (pathname.startsWith('/api/fleet/vehicles/') && method === 'DELETE') {
      const id = pathname.replace('/api/fleet/vehicles/', '');
      if (denyDelete(req, res, await prisma.vehicle.findUnique({ where: { id }, select: { createdBy: true } }))) return;
      await prisma.implementAssignment.updateMany({
        where: { vehicleId: id, endedAt: null },
        data: { endedAt: new Date() }
      });
      await prisma.vehicle.delete({ where: { id } });
      return json(res, { success: true, id });
    }

    if (pathname === '/api/fleet/implements' && method === 'POST') {
      const i = await parseBody(req);
      const iData: any = {
        name: i.name,
        category: cleanText(i.category),
        ...depreciationIn(i),
        workingWidthM: i.workingWidthM,
        manufacturer: i.manufacturer || null,
        model: i.model || null,
        serialNumber: cleanText(i.serialNumber),
        year: i.year ?? null,
        notes: i.notes ?? null
      };

      const saved = await prisma.implement.upsert({
        where: { id: i.id || `imp-${Date.now()}` },
        update: iData,
        create: {
          id: i.id || `imp-${Date.now()}`,
          // Tüüpi vormis enam pole (asendab vabatekstiline liik); veerg on kohustuslik
          type: 'OTHER',
          ...iData
        }
      });

      // Haakimine ei käi haakeriista vormi kaudu: see on ainult haakimise registris
      return json(res, saved);
    }

    if (pathname.startsWith('/api/fleet/implements/') && method === 'DELETE') {
      const id = pathname.replace('/api/fleet/implements/', '');
      if (denyDelete(req, res, await prisma.implement.findUnique({ where: { id }, select: { createdBy: true } }))) return;
      await prisma.implementAssignment.updateMany({
        where: { implementId: id, endedAt: null },
        data: { endedAt: new Date() }
      });
      await prisma.vehicle.updateMany({
        where: { assignedImplementId: id },
        data: { assignedImplementId: null }
      });
      await prisma.implement.delete({ where: { id } });
      return json(res, { success: true, id });
    }

    if (pathname === '/api/fleet/devices' && method === 'POST') {
      const d = await parseBody(req);
      const dData: any = {
        connectivityType: (d.connectivityType || 'cellular').toUpperCase() as any,
        imei: d.imei || null,
        macAddress: d.macAddress || null,
        model: d.model,
        simNumber: d.simNumber || null,
        firmware: d.firmwareVersion || null,
        acquisitionDate: dateOnlyIn(d.acquisitionDate),
        status: (d.status || 'offline').toUpperCase() as any,
        notes: d.notes ?? null
      };

      const saved = await prisma.telemetryDevice.upsert({
        where: { id: d.id || `tel-${Date.now()}` },
        update: dData,
        create: {
          id: d.id || `tel-${Date.now()}`,
          ...dData
        }
      });

      // Paigaldamine ei käi seadme vormi kaudu: see on ainult seadmete seoste registris
      return json(res, saved);
    }

    if (pathname.startsWith('/api/fleet/devices/') && method === 'DELETE') {
      const id = pathname.replace('/api/fleet/devices/', '');
      if (denyDelete(req, res, await prisma.telemetryDevice.findUnique({ where: { id }, select: { createdBy: true } }))) return;
      await prisma.telemetryDevice.delete({ where: { id } });
      return json(res, { success: true, id });
    }

    // Kaardi „Haagi“/„Vaheta“/lahtihaakimine: kirje tehakse haakimise registrisse
    if (pathname === '/api/fleet/implements/assign' && method === 'POST') {
      const { implementId, vehicleId, notes } = await parseBody(req);
      await recordImplementAssignment(implementId, vehicleId, notes);
      return json(res, { success: true });
    }

    if (pathname === '/api/fleet/implement-assignments' && method === 'GET') {
      const vehicleId = url.searchParams.get('vehicleId');
      const implementId = url.searchParams.get('implementId');

      const where: any = {};
      if (vehicleId) where.vehicleId = vehicleId;
      if (implementId) where.implementId = implementId;

      const assignments = await prisma.implementAssignment.findMany({
        where,
        include: {
          vehicle: { select: { id: true, name: true, type: true } },
          implement: { select: { id: true, name: true, category: true } }
        },
        orderBy: { startedAt: 'desc' },
        take: 200
      });

      const formatted = assignments.map((a) => ({
        id: a.id,
        vehicleId: a.vehicleId,
        implementId: a.implementId,
        vehicleName: a.vehicle?.name,
        vehicleType: a.vehicle?.type?.toLowerCase(),
        implementName: a.implement?.name,
        implementCategory: a.implement?.category ?? undefined,
        startedAt: a.startedAt.toISOString(),
        endedAt: a.endedAt ? a.endedAt.toISOString() : undefined,
        notes: a.notes ?? undefined,
        createdAt: a.createdAt.toISOString()
      }));

      return json(res, formatted);
    }

    if (pathname === '/api/fleet/implement-assignments' && method === 'POST') {
      const body = await parseBody(req);
      const { vehicleId, implementId, startedAt, endedAt, notes } = body;
      if (!vehicleId || !implementId) {
        return json(res, { error: 'vehicleId ja implementId on kohustuslikud' }, 400);
      }
      const created = await prisma.implementAssignment.create({
        data: {
          vehicleId,
          implementId,
          startedAt: startedAt ? new Date(startedAt) : new Date(),
          endedAt: endedAt ? new Date(endedAt) : null,
          notes: notes ?? null
        },
        include: {
          vehicle: { select: { id: true, name: true, type: true } },
          implement: { select: { id: true, name: true, category: true } }
        }
      });
      return json(res, {
        id: created.id,
        vehicleId: created.vehicleId,
        implementId: created.implementId,
        vehicleName: created.vehicle?.name,
        vehicleType: created.vehicle?.type?.toLowerCase(),
        implementName: created.implement?.name,
        implementCategory: created.implement?.category ?? undefined,
        startedAt: created.startedAt.toISOString(),
        endedAt: created.endedAt ? created.endedAt.toISOString() : undefined,
        notes: created.notes ?? undefined,
        createdAt: created.createdAt.toISOString()
      });
    }

    if (pathname.startsWith('/api/fleet/implement-assignments/') && (method === 'PUT' || method === 'PATCH')) {
      const id = pathname.replace('/api/fleet/implement-assignments/', '');
      const body = await parseBody(req);
      const { vehicleId, implementId, startedAt, endedAt, notes } = body;

      const updateData: any = {};
      if (vehicleId !== undefined) updateData.vehicleId = vehicleId;
      if (implementId !== undefined) updateData.implementId = implementId;
      if (startedAt !== undefined) updateData.startedAt = startedAt ? new Date(startedAt) : undefined;
      if (endedAt !== undefined) {
        updateData.endedAt = endedAt ? new Date(endedAt) : null;
      }
      if (notes !== undefined) updateData.notes = notes ?? null;

      const updated = await prisma.implementAssignment.update({
        where: { id },
        data: updateData,
        include: {
          vehicle: { select: { id: true, name: true, type: true } },
          implement: { select: { id: true, name: true, category: true } }
        }
      });

      return json(res, {
        id: updated.id,
        vehicleId: updated.vehicleId,
        implementId: updated.implementId,
        vehicleName: updated.vehicle?.name,
        vehicleType: updated.vehicle?.type?.toLowerCase(),
        implementName: updated.implement?.name,
        implementCategory: updated.implement?.category ?? undefined,
        startedAt: updated.startedAt.toISOString(),
        endedAt: updated.endedAt ? updated.endedAt.toISOString() : undefined,
        notes: updated.notes ?? undefined,
        createdAt: updated.createdAt.toISOString()
      });
    }

    if (pathname.startsWith('/api/fleet/implement-assignments/') && method === 'DELETE') {
      const id = pathname.replace('/api/fleet/implement-assignments/', '');
      const existing = await prisma.implementAssignment.findUnique({ where: { id } });
      if (denyDelete(req, res, existing)) return;
      await prisma.implementAssignment.delete({ where: { id } });
      return json(res, { success: true, id });
    }

    // Telemeetriaseadmete seoste register
    if (pathname === '/api/fleet/device-assignments' && method === 'GET') {
      const rows = await prisma.deviceAssignment.findMany({
        include: DEVICE_ASSIGNMENT_INCLUDE,
        orderBy: { startedAt: 'desc' },
        take: 500
      });
      return json(res, rows.map(formatDeviceAssignment));
    }

    if (pathname === '/api/fleet/device-assignments' && method === 'POST') {
      const { data, error } = parseDeviceAssignmentBody(await parseBody(req));
      if (error) return json(res, { error }, 400);
      const created = await prisma.deviceAssignment.create({ data, include: DEVICE_ASSIGNMENT_INCLUDE });
      return json(res, formatDeviceAssignment(created));
    }

    if (pathname.startsWith('/api/fleet/device-assignments/') && (method === 'PUT' || method === 'PATCH')) {
      const id = pathname.replace('/api/fleet/device-assignments/', '');
      const { data, error } = parseDeviceAssignmentBody(await parseBody(req));
      if (error) return json(res, { error }, 400);
      const updated = await prisma.deviceAssignment.update({ where: { id }, data, include: DEVICE_ASSIGNMENT_INCLUDE });
      return json(res, formatDeviceAssignment(updated));
    }

    if (pathname.startsWith('/api/fleet/device-assignments/') && method === 'DELETE') {
      const id = pathname.replace('/api/fleet/device-assignments/', '');
      const existing = await prisma.deviceAssignment.findUnique({ where: { id } });
      if (denyDelete(req, res, existing)) return;
      await prisma.deviceAssignment.delete({ where: { id } });
      return json(res, { success: true, id });
    }

    // Kaardi „Vaheta“ / seadmekaardi paigalduse valik: kirje tehakse seadmete seoste registrisse.
    // Seade on korraga seotud ühe masina VÕI haakeriistaga.
    if (pathname === '/api/fleet/devices/assign' && method === 'POST') {
      const { deviceId, vehicleId, implementId } = await parseBody(req);

      const device = await prisma.telemetryDevice.findUnique({
        where: { id: deviceId }
      });

      // Find current open assignment
      const activeAssignment = await prisma.deviceAssignment.findFirst({
        where: { deviceId, endedAt: null }
      });

      // Sama sidumine on juba aktiivne (nt masina vormi salvestamine seadet muutmata):
      // ajalugu ei poolitata uueks kirjeks.
      const sameTarget = activeAssignment && (
        (vehicleId && activeAssignment.vehicleId === vehicleId && !activeAssignment.implementId) ||
        (!vehicleId && implementId && activeAssignment.implementId === implementId && !activeAssignment.vehicleId)
      );
      if (sameTarget) return json(res, { success: true });

      let lastLat: number | null = null;
      let lastLng: number | null = null;

      if (device?.imei) {
        const liveMap = await fetchCellularTelemetry([device.imei]);
        const live = liveMap.get(device.imei);
        if (typeof live?.latitude === 'number' && typeof live?.longitude === 'number') {
          lastLat = live.latitude;
          lastLng = live.longitude;
        }
      }

      const now = new Date();

      if (activeAssignment) {
        await prisma.deviceAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            endedAt: now,
            lastLatitude: lastLat ?? activeAssignment.lastLatitude,
            lastLongitude: lastLng ?? activeAssignment.lastLongitude
          }
        });
        if (activeAssignment.vehicleId && (lastLat !== null || activeAssignment.lastLatitude !== null)) {
          await prisma.vehicle.update({
            where: { id: activeAssignment.vehicleId },
            data: {
              lastLatitude: lastLat ?? activeAssignment.lastLatitude,
              lastLongitude: lastLng ?? activeAssignment.lastLongitude,
              lastActiveAt: now
            }
          });
        }
      }

      // Sihtmasinal/-haakeriistal saab korraga olla üks seade: lõpeta selle teise seadme seos
      if (vehicleId || implementId) {
        await prisma.deviceAssignment.updateMany({
          where: vehicleId ? { vehicleId, endedAt: null } : { implementId, endedAt: null },
          data: { endedAt: now }
        });
      }

      if (vehicleId) {
        await prisma.deviceAssignment.create({
          data: {
            deviceId,
            vehicleId,
            startedAt: now
          }
        });
      } else if (implementId) {
        await prisma.deviceAssignment.create({
          data: {
            deviceId,
            implementId,
            startedAt: now
          }
        });
      }
      return json(res, { success: true });
    }

    // 5a. Sajuradar (Keskkonnaagentuuri radarite koondpilt KAIA avaandmetest)
    if (pathname === '/api/weather/radar' && method === 'GET') {
      const frames = await getRecentRadarFrames();
      if (!frames.length) return json(res, { error: 'Radari andmed pole hetkel saadaval' }, 503);
      return json(res, {
        bounds: frames[frames.length - 1].bounds,
        frames: frames.map((f) => ({
          time: f.time,
          imageUrl: `/api/weather/radar.png?t=${encodeURIComponent(f.time)}`
        }))
      });
    }

    if (pathname === '/api/weather/radar.png' && method === 'GET') {
      const time = url.searchParams.get('t');
      const frame = time ? getCachedRadarFrame(time) : (await getRecentRadarFrames()).at(-1) ?? null;
      if (!frame) return json(res, { error: 'Radari kaader pole enam saadaval' }, 404);
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': frame.png.length,
        // Ajatempliga kaader ei muutu kunagi
        'Cache-Control': time ? 'private, max-age=3600, immutable' : 'private, max-age=300'
      });
      res.end(frame.png);
      return;
    }

    // 5a2. Satelliidipildid: Satiladu (Maa- ja Ruumiamet) Sentinel-2 päevapiltide kuupäevad
    if (pathname === '/api/satellite/dates' && method === 'GET') {
      const query: SatiladuQuery = { from: url.searchParams.get('from') ?? '', to: url.searchParams.get('to') ?? '' };
      const invalid = validateSatiladuQuery(query);
      if (invalid) return json(res, { error: invalid }, 400);
      try {
        return json(res, { dates: await getSatiladuDates(query) });
      } catch (err) {
        console.error('Satiladu päring ebaõnnestus:', err);
        return json(res, { error: 'Satiladu kuupäevade loend pole hetkel saadaval' }, 502);
      }
    }

    // 5a3. Pilvisus põldude kohal perioodi päevadel (oma pilvekontroll, vt satelliteClouds.ts)
    if (pathname === '/api/satellite/cloud-check' && method === 'POST') {
      const body = await parseBody(req, 4 * 1024 * 1024);
      const query: SatiladuQuery = { from: String(body?.from ?? ''), to: String(body?.to ?? '') };
      const invalid = validateSatiladuQuery(query) ?? validateCloudCheckPolygons(body?.polygons);
      if (invalid) return json(res, { error: invalid }, 400);
      try {
        return json(res, await checkFieldClouds(query.from, query.to, body.polygons));
      } catch (err) {
        console.error('Pilvekontroll ebaõnnestus:', err);
        return json(res, { error: 'Pilvisuse kontroll pole hetkel võimalik' }, 502);
      }
    }

    // 5b. Telemetry history (real GPS track for a single cellular device or vehicle, from telemetry_tsdb)
    if (pathname === '/api/telemetry/history' && method === 'GET') {
      let imei = url.searchParams.get('imei');
      const vehicleId = url.searchParams.get('vehicleId');
      const hours = Number(url.searchParams.get('hours')) || 6;
      const fromParam = url.searchParams.get('from');
      const toParam = url.searchParams.get('to');

      const now = new Date();
      let start: Date;
      let end: Date;

      if (fromParam) {
        start = new Date(fromParam);
        end = toParam ? new Date(toParam) : new Date(start.getTime() + Math.max(1, hours) * 3600 * 1000);
      } else {
        end = toParam ? new Date(toParam) : now;
        start = new Date(end.getTime() - Math.max(1, hours) * 3600 * 1000);
      }

      let targetDevice: any = null;

      if (vehicleId) {
        // Otsi seadme seoseid antud masinale
        const assignments = await prisma.deviceAssignment.findMany({
          where: { vehicleId },
          orderBy: { startedAt: 'desc' },
          include: { device: true }
        });

        // Otsi seos, mis kattub päritud aknaga [start, end]
        const matching = assignments.find((a) => {
          const aStart = a.startedAt.getTime();
          const aEnd = a.endedAt ? a.endedAt.getTime() : Infinity;
          return aStart <= end.getTime() && aEnd >= start.getTime();
        });

        if (matching) {
          imei = matching.device?.imei ?? imei;
          targetDevice = matching.device ?? null;
          // Piira aken selle masinaga seotuse perioodiga, et teise masina sõidud ei lekiks
          if (matching.startedAt > start) start = matching.startedAt;
          if (matching.endedAt && matching.endedAt < end) end = matching.endedAt;
        } else if (assignments.length > 0 && !fromParam) {
          // Kui päriti jooksvat aega ilma from-ita, aga masinal pole selles aknas aktiivset seadet
          // (kõik seosed lõppesid minevikus), siis selle jooksva akna kohta punkte pole.
          return json(res, { points: [], implement: null });
        }
      }

      if (!imei) return json(res, { error: 'imei or vehicleId with assigned device required' }, 400);

      if (start >= end) {
        return json(res, { points: [], implement: null });
      }

      // Tuleta haakeriist:
      // 1) Kas seade ise on paigaldatud otse haakeriistale?
      let resolvedImplement: any = null;
      if (targetDevice?.implementId) {
        resolvedImplement = await prisma.implement.findUnique({ where: { id: targetDevice.implementId } });
      }

      // 2) Kui ei, otsi masina ja haakeriista ajalooliste seoste tabelist (ImplementAssignment),
      // mis kattub päringu ajavahemikuga [start, end]:
      if (!resolvedImplement && vehicleId) {
        const impAsgn = await prisma.implementAssignment.findFirst({
          where: {
            vehicleId,
            startedAt: { lte: end },
            OR: [{ endedAt: null }, { endedAt: { gte: start } }]
          },
          orderBy: { startedAt: 'desc' },
          include: { implement: true }
        });
        if (impAsgn?.implement) {
          resolvedImplement = impAsgn.implement;
        }
      }

      const queryHours = fromParam
        ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (3600 * 1000)))
        : hours;
      const rows = await fetchDeviceHistory(imei, queryHours, start.toISOString(), end.toISOString());
      const points = rows
        .filter((r) => r.fields.latitude != null && r.fields.longitude != null)
        .map((r) => ({
          timestamp: r.time.toISOString(),
          lat: r.fields.latitude,
          lng: r.fields.longitude,
          altitude: r.fields.altitude ?? undefined,
          speedKmH: r.fields.speed ?? r.fields.speed_avl_kmh ?? 0,
          heading: r.fields.angle ?? 0
        }));

      return json(res, {
        points,
        implement: resolvedImplement
          ? {
              id: resolvedImplement.id,
              name: resolvedImplement.name,
              workingWidthM: resolvedImplement.workingWidthM,
              type: resolvedImplement.type
            }
          : null
      });
    }

    // 6. Related Parties
    if (pathname === '/api/parties' && method === 'GET') {
      const dbParties = await prisma.relatedParty.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              vehicles: true,
              cadastralParcels: true,
              poiContacts: true,
              fieldsAsOperator: true,
              performedOperations: true
            }
          }
        }
      });

      // Kustutamise kaitse põhineb päris viidetel (FK kasutusel) —
      // frontend kasutab neid loenduid, et otsustada, kas kustutamine
      // on ohutu, ja kui mitte, näidata seoste ülevaadet.
      const mapped = dbParties.map(({ _count, ...p }) => ({
        ...p,
        assignedVehiclesCount: _count.vehicles,
        ownedParcelsCount: _count.cadastralParcels,
        poiContactsCount: _count.poiContacts,
        operatorFieldsCount: _count.fieldsAsOperator,
        performedOperationsCount: _count.performedOperations,
        usageCount: _count.vehicles + _count.cadastralParcels + _count.poiContacts + _count.fieldsAsOperator + _count.performedOperations
      }));

      return json(res, mapped);
    }

    if (pathname === '/api/parties' && method === 'POST') {
      const p = await parseBody(req);
      const saved = await prisma.relatedParty.upsert({
        where: { id: p.id || `party-${Date.now()}` },
        update: {
          name: p.name,
          type: (p.type || 'PERSON') as any,
          code: p.code ?? null,
          vatNumber: p.vatNumber ?? null,
          roles: p.roles as any,
          phone: p.phone ?? null,
          email: p.email ?? null,
          address: p.address ?? null,
          bankAccount: p.bankAccount ?? null,
          notes: p.notes ?? null
        },
        create: {
          id: p.id || `party-${Date.now()}`,
          name: p.name,
          type: (p.type || 'PERSON') as any,
          code: p.code ?? null,
          vatNumber: p.vatNumber ?? null,
          roles: p.roles as any,
          phone: p.phone ?? null,
          email: p.email ?? null,
          address: p.address ?? null,
          bankAccount: p.bankAccount ?? null,
          notes: p.notes ?? null
        }
      });
      return json(res, saved);
    }

    if (pathname.startsWith('/api/parties/') && method === 'DELETE') {
      const id = pathname.replace('/api/parties/', '');
      if (denyDelete(req, res, await prisma.relatedParty.findUnique({ where: { id }, select: { createdBy: true } }))) return;
      await prisma.relatedParty.delete({ where: { id } });
      return json(res, { success: true, id });
    }

    // 7. Crops
    if (pathname === '/api/crops' && method === 'GET') {
      const dbCrops = await prisma.crop.findMany({
        include: { varieties: true },
        orderBy: { name: 'asc' }
      });
      return json(res, dbCrops);
    }

    if (pathname === '/api/crops' && method === 'POST') {
      const crop = await parseBody(req);
      const previous = crop.id ? await prisma.crop.findUnique({ where: { id: crop.id } }) : null;
      const saved = await prisma.crop.upsert({
        where: { id: crop.id || `crop-${Date.now()}` },
        update: {
          name: crop.name,
          scientificName: crop.scientificName ?? null,
          group: (crop.group || 'CEREAL') as any,
          color: crop.color || '#eab308',
          icon: crop.icon ?? null,
          priaCode: crop.priaCode ?? null,
          defaultSeedRateKgHa: crop.defaultSeedRateKgHa ? Number(crop.defaultSeedRateKgHa) : null,
          defaultYieldTonsHa: crop.defaultYieldTonsHa ? Number(crop.defaultYieldTonsHa) : null,
          description: crop.description ?? null,
          isWinterCrop: crop.isWinterCrop === true
        },
        create: {
          id: crop.id || `crop-${Date.now()}`,
          name: crop.name,
          scientificName: crop.scientificName ?? null,
          group: (crop.group || 'CEREAL') as any,
          color: crop.color || '#eab308',
          icon: crop.icon ?? null,
          priaCode: crop.priaCode ?? null,
          defaultSeedRateKgHa: crop.defaultSeedRateKgHa ? Number(crop.defaultSeedRateKgHa) : null,
          defaultYieldTonsHa: crop.defaultYieldTonsHa ? Number(crop.defaultYieldTonsHa) : null,
          description: crop.description ?? null,
          isWinterCrop: crop.isWinterCrop === true
        }
      });
      // Põllukirjetes on kultuuri värv koopiana: värvi muutmisel uuendame selle kultuuri kirjed.
      if (previous && previous.color !== saved.color) {
        await prisma.fieldSeason.updateMany({
          where: { cropColor: previous.color, crop: { contains: previous.name, mode: 'insensitive' } },
          data: { cropColor: saved.color }
        });
      }
      return json(res, saved);
    }

    if (pathname.startsWith('/api/crops/') && method === 'DELETE') {
      const id = pathname.replace('/api/crops/', '');
      if (denyDelete(req, res, await prisma.crop.findUnique({ where: { id }, select: { createdBy: true } }))) return;
      await prisma.crop.delete({ where: { id } });
      return json(res, { success: true, id });
    }

    // 8. Soil Samples (mullaproovid)
    if (pathname === '/api/soil-samples' && method === 'GET') {
      const dbSamples = await prisma.soilSample.findMany({
        orderBy: { year: 'desc' }
      });
      return json(res, dbSamples);
    }

    if (pathname === '/api/soil-samples/import' && method === 'POST') {
      if (!isAdmin(req)) return json(res, { error: IMPORT_FORBIDDEN }, 403);
      const samples = await parseBody(req);
      const list = Array.isArray(samples) ? samples : [samples];
      let count = 0;
      for (const s of list) {
        await prisma.soilSample.upsert({
          where: { sampleNumber: s.sampleNumber },
          update: {
            fieldCode: s.fieldCode,
            year: Number(s.year),
            lat: Number(s.lat),
            lng: Number(s.lng),
            ph: s.ph ?? null,
            phosphorus: s.phosphorus ?? null,
            potassium: s.potassium ?? null,
            calcium: s.calcium ?? null,
            magnesium: s.magnesium ?? null,
            copper: s.copper ?? null,
            manganese: s.manganese ?? null,
            boron: s.boron ?? null,
            organicCarbon: s.organicCarbon ?? null,
            limeRequirement: s.limeRequirement ?? null
          },
          create: {
            sampleNumber: s.sampleNumber,
            fieldCode: s.fieldCode,
            year: Number(s.year),
            lat: Number(s.lat),
            lng: Number(s.lng),
            ph: s.ph ?? null,
            phosphorus: s.phosphorus ?? null,
            potassium: s.potassium ?? null,
            calcium: s.calcium ?? null,
            magnesium: s.magnesium ?? null,
            copper: s.copper ?? null,
            manganese: s.manganese ?? null,
            boron: s.boron ?? null,
            organicCarbon: s.organicCarbon ?? null,
            limeRequirement: s.limeRequirement ?? null
          }
        });
        count++;
      }
      return json(res, { success: true, count });
    }

    // 9. Põlluraamat (e-PRIA väljavõtte import)
    if (pathname === '/api/field-operations/import' && method === 'POST') {
      if (!isAdmin(req)) return json(res, { error: IMPORT_FORBIDDEN }, 403);
      const body = await parseBody(req);
      const operatorId: string | undefined = body?.operatorId;
      const fieldsIn: any[] = Array.isArray(body?.fields) ? body.fields : [];
      if (!operatorId) return json(res, { error: 'operatorId on kohustuslik' }, 400);

      const toDate = (d: string | null | undefined) => (d ? new Date(d) : null);

      const result = await prisma.$transaction(
        async (tx) => {
          let imported = 0;
          let operations = 0;
          let products = 0;
          const skipped: { fieldCode: string; num: string; season: number }[] = [];

          for (const f of fieldsIn) {
            const field = await tx.field.findFirst({
              where: { fieldCode: String(f.fieldCode), num: String(f.num), operatorId }
            });
            const fieldSeason = field
              ? await tx.fieldSeason.findUnique({
                  where: { fieldId_year: { fieldId: field.id, year: Number(f.season) } }
                })
              : null;
            if (!fieldSeason) {
              skipped.push({ fieldCode: f.fieldCode, num: f.num, season: f.season });
              continue;
            }

            // Põlluraamatut rakenduses käsitsi ei muudeta — import asendab
            // selle hooajakirje tegevused täielikult.
            await tx.fieldOperation.deleteMany({ where: { fieldSeasonId: fieldSeason.id } });

            const ops: any[] = Array.isArray(f.operations) ? f.operations : [];
            for (const [i, op] of ops.entries()) {
              const prods: any[] = Array.isArray(op.products) ? op.products : [];
              await tx.fieldOperation.create({
                data: {
                  fieldSeasonId: fieldSeason.id,
                  type: String(op.type),
                  dateFrom: new Date(op.dateFrom),
                  dateTo: toDate(op.dateTo),
                  areaHa: op.areaHa ?? null,
                  method: op.method ?? null,
                  performerId: op.performerId ?? null,
                  notes: op.notes ?? null,
                  sortOrder: i,
                  products: {
                    create: prods.map((p, j) => ({
                      category: p.category ?? null,
                      name: p.name ?? null,
                      kind: p.kind ?? null,
                      spec: p.spec ?? null,
                      amount: p.amount ?? null,
                      unit: p.unit ?? null,
                      nKgHa: p.nKgHa ?? null,
                      pKgHa: p.pKgHa ?? null,
                      kKgHa: p.kKgHa ?? null,
                      activeIngredient: p.activeIngredient ?? null,
                      sortOrder: j
                    }))
                  }
                }
              });
              operations++;
              products += prods.length;
            }

            // Tühi väärtus failis ei kustuta olemasolevat.
            const seasonUpdate: Record<string, unknown> = {};
            if (f.targetYieldTonsHa != null) seasonUpdate.targetYieldTonsHa = Number(f.targetYieldTonsHa);
            if (f.actualYieldTonsHa != null) seasonUpdate.actualYieldTonsHa = Number(f.actualYieldTonsHa);
            if (f.seedingDate) seasonUpdate.seedingDate = new Date(f.seedingDate);
            if (f.harvestDate) seasonUpdate.harvestDate = new Date(f.harvestDate);
            if (Object.keys(seasonUpdate).length > 0) {
              await tx.fieldSeason.update({ where: { id: fieldSeason.id }, data: seasonUpdate });
            }
            imported++;
          }

          return { imported, operations, products, skipped };
        },
        { timeout: 60000 }
      );

      return json(res, { success: true, ...result });
    }

    if (pathname === '/api/field-operations' && method === 'GET') {
      const fieldId = Number(url.searchParams.get('fieldId'));
      const year = Number(url.searchParams.get('year'));
      if (!fieldId || !year) return json(res, { error: 'fieldId ja year on kohustuslikud' }, 400);

      const fieldSeason = await prisma.fieldSeason.findUnique({
        where: { fieldId_year: { fieldId, year } }
      });
      if (!fieldSeason) {
        return json(res, { targetYieldTonsHa: null, actualYieldTonsHa: null, operations: [] });
      }

      const ops = await prisma.fieldOperation.findMany({
        where: { fieldSeasonId: fieldSeason.id },
        orderBy: [{ dateFrom: 'asc' }, { sortOrder: 'asc' }],
        include: {
          products: { orderBy: { sortOrder: 'asc' } },
          performer: { select: { name: true } }
        }
      });

      const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
      return json(res, {
        targetYieldTonsHa: fieldSeason.targetYieldTonsHa,
        actualYieldTonsHa: fieldSeason.actualYieldTonsHa,
        operations: ops.map(({ performer, fieldSeasonId: _fs, performerId: _p, createdAt: _c, ...o }) => ({
          ...o,
          dateFrom: day(o.dateFrom),
          dateTo: day(o.dateTo),
          performerName: performer?.name ?? null,
          products: o.products.map(({ operationId: _op, ...p }) => p)
        }))
      });
    }

    return json(res, { error: 'Not found' }, 404);
  } catch (err: any) {
    console.error('[API Error]:', err);
    // Sisemine veateade (nt Prisma stack) ei tohi kliendini jõuda — see on nähtav
    // ka autentimata authGate'i teede kaudu. Erand: keha suuruse piirang, mis on
    // kasutajale mõistetav ja kajastab tema enda päringut, mitte serveri siseasju.
    if (err instanceof Error && err.message === 'Päringu keha on liiga suur') {
      return json(res, { error: err.message }, 413);
    }
    return json(res, { error: 'Serveri viga' }, 500);
  }
}
