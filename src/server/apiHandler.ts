// src/server/apiHandler.ts
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, tsdb } from './db.ts';
import { json, parseBody } from './http.ts';
import { authGate, sessionUserOf } from './authGate.ts';
import { handleAdminUsers } from './adminUsers.ts';
import { handleFieldWorks, applyCropTemplate } from './fieldWorks.ts';
import { resolveHistoryWindow, HISTORY_MAX_POINTS } from './historyWindow.ts';
import { getLatestRadarFrame } from './weatherRadar.ts';

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

// Mobiilsed (cellular) Teltonika seadmed raporteerivad otse oma IMEI all,
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
// Teltonika seadme (gateway) alt kuni 3 "pesa" kaudu (eye1/eye2/eye3),
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
// üheks JSON-objektiks per pakett, kuna Teltonika saadab kõik väljad
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

export interface ApiOptions {
  allowedOrigins: string[];
  requireAuth: boolean;
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse, options: ApiOptions): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase() || 'GET';

  try {
    if (await authGate(req, res, pathname, method, options)) return;
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
      await prisma.pointOfInterest.delete({ where: { id } });
      return json(res, { success: true, id });
    }

    // 5. Fleet (Vehicles, Implements, Devices)
    if (pathname === '/api/fleet' && method === 'GET') {
      const [rawVehicles, rawImplements, rawDevices, activeAssignments] = await Promise.all([
        prisma.vehicle.findMany({
          include: { assignedDriver: true }
        }),
        prisma.implement.findMany(),
        prisma.teltonikaDevice.findMany(),
        prisma.deviceAssignment.findMany({
          where: { endedAt: null }
        })
      ]);

      const vehicles = rawVehicles.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type.toLowerCase(),
        model: v.model,
        registrationPlate: v.regNumber ?? undefined,
        color: v.color,
        driverName: v.assignedDriver?.name,
        assignedDeviceId: v.assignedDeviceId ?? undefined,
        assignedImplementId: v.assignedImplementId ?? undefined,
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
        model: i.model ?? '',
        manufacturer: i.manufacturer ?? '',
        workingWidthM: i.workingWidthM,
        year: i.year ?? undefined,
        assignedDeviceId: i.assignedDeviceId ?? undefined,
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

    if (pathname === '/api/fleet/vehicles' && method === 'POST') {
      const v = await parseBody(req);
      const vData: any = {
        name: v.name,
        type: (v.type || 'tractor').toUpperCase() as any,
        model: v.model,
        regNumber: v.registrationPlate || v.regNumber || null,
        color: v.color || '#10b981',
        notes: v.notes ?? null
      };
      if (v.assignedDeviceId) {
        vData.assignedDevice = { connect: { id: v.assignedDeviceId } };
      }
      if (v.assignedImplementId) {
        vData.assignedImplement = { connect: { id: v.assignedImplementId } };
      }

      const saved = await prisma.vehicle.upsert({
        where: { id: v.id || `veh-${Date.now()}` },
        update: vData,
        create: {
          id: v.id || `veh-${Date.now()}`,
          ...vData
        }
      });
      return json(res, saved);
    }

    if (pathname.startsWith('/api/fleet/vehicles/') && method === 'DELETE') {
      const id = pathname.replace('/api/fleet/vehicles/', '');
      await prisma.vehicle.delete({ where: { id } });
      return json(res, { success: true, id });
    }

    if (pathname === '/api/fleet/implements' && method === 'POST') {
      const i = await parseBody(req);
      const iData: any = {
        name: i.name,
        type: (i.type || 'other').toUpperCase() as any,
        workingWidthM: i.workingWidthM,
        manufacturer: i.manufacturer || null,
        model: i.model || null,
        year: i.year ?? null,
        assignedDeviceId: i.assignedDeviceId || null,
        notes: i.notes ?? null
      };

      const saved = await prisma.implement.upsert({
        where: { id: i.id || `imp-${Date.now()}` },
        update: iData,
        create: {
          id: i.id || `imp-${Date.now()}`,
          ...iData
        }
      });

      // assignedVehicleId is a virtual field derived from Vehicle.assignedImplementId
      if (i.assignedVehicleId) {
        await prisma.vehicle.update({
          where: { id: i.assignedVehicleId },
          data: { assignedImplementId: saved.id }
        });
      }
      return json(res, saved);
    }

    if (pathname.startsWith('/api/fleet/implements/') && method === 'DELETE') {
      const id = pathname.replace('/api/fleet/implements/', '');
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
        status: (d.status || 'offline').toUpperCase() as any,
        notes: d.notes ?? null
      };

      const saved = await prisma.teltonikaDevice.upsert({
        where: { id: d.id || `tel-${Date.now()}` },
        update: dData,
        create: {
          id: d.id || `tel-${Date.now()}`,
          ...dData
        }
      });

      // assignedVehicleId/assignedImplementId are virtual fields derived
      // from Vehicle.assignedDeviceId / Implement.assignedDeviceId
      if (d.assignedVehicleId) {
        await prisma.vehicle.update({
          where: { id: d.assignedVehicleId },
          data: { assignedDeviceId: saved.id }
        });
      }
      if (d.assignedImplementId) {
        await prisma.implement.update({
          where: { id: d.assignedImplementId },
          data: { assignedDeviceId: saved.id }
        });
      }
      return json(res, saved);
    }

    if (pathname.startsWith('/api/fleet/devices/') && method === 'DELETE') {
      const id = pathname.replace('/api/fleet/devices/', '');
      await prisma.vehicle.updateMany({
        where: { assignedDeviceId: id },
        data: { assignedDeviceId: null }
      });
      await prisma.implement.updateMany({
        where: { assignedDeviceId: id },
        data: { assignedDeviceId: null }
      });
      await prisma.teltonikaDevice.delete({ where: { id } });
      return json(res, { success: true, id });
    }

    // assignedImplementId/assignedDeviceId are @unique on Vehicle, so any
    // vehicle currently holding this implement/device must be cleared
    // before it can be attached to a different (or no) vehicle.
    if (pathname === '/api/fleet/implements/assign' && method === 'POST') {
      const { implementId, vehicleId } = await parseBody(req);
      await prisma.vehicle.updateMany({
        where: { assignedImplementId: implementId },
        data: { assignedImplementId: null }
      });
      if (vehicleId) {
        await prisma.vehicle.update({
          where: { id: vehicleId },
          data: { assignedImplementId: implementId }
        });
      }
      return json(res, { success: true });
    }

    if (pathname === '/api/fleet/devices/assign' && method === 'POST') {
      // A device attaches to at most one target (a vehicle OR an implement) at a time.
      const { deviceId, vehicleId, implementId } = await parseBody(req);

      const device = await prisma.teltonikaDevice.findUnique({
        where: { id: deviceId }
      });

      // Find current open assignment
      const activeAssignment = await prisma.deviceAssignment.findFirst({
        where: { deviceId, endedAt: null }
      });

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

      await prisma.vehicle.updateMany({
        where: { assignedDeviceId: deviceId },
        data: { assignedDeviceId: null }
      });
      await prisma.implement.updateMany({
        where: { assignedDeviceId: deviceId },
        data: { assignedDeviceId: null }
      });

      if (vehicleId) {
        await prisma.vehicle.update({
          where: { id: vehicleId },
          data: { assignedDeviceId: deviceId }
        });
        await prisma.deviceAssignment.create({
          data: {
            deviceId,
            vehicleId,
            startedAt: now
          }
        });
      } else if (implementId) {
        await prisma.implement.update({
          where: { id: implementId },
          data: { assignedDeviceId: deviceId }
        });
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
      const frame = await getLatestRadarFrame();
      if (!frame) return json(res, { error: 'Radari andmed pole hetkel saadaval' }, 503);
      return json(res, {
        time: frame.time,
        bounds: frame.bounds,
        imageUrl: `/api/weather/radar.png?t=${encodeURIComponent(frame.time)}`
      });
    }

    if (pathname === '/api/weather/radar.png' && method === 'GET') {
      const frame = await getLatestRadarFrame();
      if (!frame) return json(res, { error: 'Radari andmed pole hetkel saadaval' }, 503);
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': frame.png.length,
        'Cache-Control': 'private, max-age=300'
      });
      res.end(frame.png);
      return;
    }

    // 5b. Telemetry history (real GPS track for a single cellular device or vehicle, from telemetry_tsdb)
    if (pathname === '/api/telemetry/history' && method === 'GET') {
      let imei = url.searchParams.get('imei');
      const vehicleId = url.searchParams.get('vehicleId');
      const hours = Number(url.searchParams.get('hours')) || 6;
      let from = url.searchParams.get('from');
      let to = url.searchParams.get('to');

      if (vehicleId) {
        // Find most recent assignment for this vehicle, or an active one
        const assignment = await prisma.deviceAssignment.findFirst({
          where: { vehicleId },
          orderBy: { startedAt: 'desc' },
          include: { device: true }
        });

        if (assignment) {
          if (!imei && assignment.device?.imei) {
            imei = assignment.device.imei;
          }
          if (!from && assignment.startedAt) {
            from = assignment.startedAt.toISOString();
          }
          if (!to && assignment.endedAt) {
            to = assignment.endedAt.toISOString();
          }
        } else {
          const vehicle = await prisma.vehicle.findUnique({
            where: { id: vehicleId },
            include: { assignedDevice: true }
          });
          if (!imei && vehicle?.assignedDevice?.imei) {
            imei = vehicle.assignedDevice.imei;
          }
        }
      }

      if (!imei) return json(res, { error: 'imei or vehicleId with assigned device required' }, 400);

      const rows = await fetchDeviceHistory(imei, hours, from, to);
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

      return json(res, { points });
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
