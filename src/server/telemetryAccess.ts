// src/server/telemetryAccess.ts — kõik TimescaleDB (tsdb) telemeetriapäringud.
// Ettevõte näeb mõõtmisi ainult oma seadmete omandiperioodide (DeviceOwnership) piires;
// ilma omandita on tulemus tühi. Päringud on parameetriseeritud (unnest massiividest).
import { prisma, tsdb } from './db.ts';
import { resolveHistoryWindow, HISTORY_MAX_POINTS } from './historyWindow.ts';

export type OwnershipWindow = { from: Date; to: Date | null };

export type RawMeasurementRow = {
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

export type LiveFields = Record<string, boolean | number | string> & { lastUpdate: string };

export type HistoryRow = {
  time: Date;
  fields: Record<string, number>;
};

// Avatud perioodi lõpp SQL-i massiivides (null-elemente massiivi parameetrites ei kasutata).
const FAR_FUTURE = new Date('9999-12-31T00:00:00.000Z');

function coalesceValue(row: RawMeasurementRow): boolean | number | string | null {
  if (row.value_bool !== null) return row.value_bool;
  if (row.value_int !== null) return row.value_int;
  if (row.value_bigint !== null) return Number(row.value_bigint);
  if (row.value_double !== null) return row.value_double;
  if (row.value_text !== null) return row.value_text;
  return null;
}

const normalize = (kind: 'IMEI' | 'MAC', id: string) => (kind === 'MAC' ? id.toUpperCase() : id);

function toWindowMap(kind: 'IMEI' | 'MAC', rows: { identifier: string; validFrom: Date; validTo: Date | null }[]): Map<string, OwnershipWindow[]> {
  const map = new Map<string, OwnershipWindow[]>();
  for (const r of rows) {
    const key = normalize(kind, r.identifier);
    const list = map.get(key) ?? [];
    list.push({ from: r.validFrom, to: r.validTo });
    map.set(key, list);
  }
  return map;
}

/** Jooksva ettevõtte omandiperioodid antud tunnustele (RLS piirab ettevõtte). MAC-i võtmed on suurtähtedega. */
export async function ownershipWindows(kind: 'IMEI' | 'MAC', identifiers: string[]): Promise<Map<string, OwnershipWindow[]>> {
  if (identifiers.length === 0) return new Map();
  const rows = await prisma.deviceOwnership.findMany({
    where: { kind, identifier: { in: [...new Set(identifiers.flatMap((i) => (kind === 'MAC' ? [i, i.toUpperCase()] : [i])))] } },
    orderBy: { validFrom: 'asc' }
  });
  return toWindowMap(kind, rows);
}

/** Kõik jooksva ettevõtte seadmetunnuste omandiperioodid (nt põllutööde soovituste jaoks). */
export async function allOwnershipWindows(kind: 'IMEI' | 'MAC'): Promise<Map<string, OwnershipWindow[]>> {
  const rows = await prisma.deviceOwnership.findMany({ where: { kind }, orderBy: { validFrom: 'asc' } });
  return toWindowMap(kind, rows);
}

/** Omandiperioodide lõige vahemikuga [from, to]: järjestatud, kattuvad/külgnevad liidetud, tühjad välja jäetud. */
export function clampWindow(windows: OwnershipWindow[], from: Date, to: Date): { from: Date; to: Date }[] {
  const clipped = windows
    .map((w) => ({
      from: w.from > from ? w.from : from,
      to: w.to && w.to < to ? w.to : to
    }))
    .filter((w) => w.from <= w.to)
    .sort((a, b) => a.from.getTime() - b.from.getTime());
  const merged: { from: Date; to: Date }[] = [];
  for (const w of clipped) {
    const last = merged[merged.length - 1];
    if (last && w.from <= last.to) {
      if (w.to > last.to) last.to = w.to;
    } else {
      merged.push({ from: w.from, to: w.to });
    }
  }
  return merged;
}

// Tasandab {tunnus -> perioodid} paralleelmassiivideks unnest-i jaoks.
function flatten(windows: Map<string, OwnershipWindow[]>) {
  const ids: string[] = [];
  const froms: string[] = [];
  const tos: string[] = [];
  for (const [id, list] of windows) {
    for (const w of list) {
      ids.push(id);
      froms.push(w.from.toISOString());
      tos.push((w.to ?? FAR_FUTURE).toISOString());
    }
  }
  return { ids, froms, tos };
}

function pickWindows(all: Map<string, OwnershipWindow[]>, kind: 'IMEI' | 'MAC', wanted: string[]) {
  const picked = new Map<string, OwnershipWindow[]>();
  for (const id of wanted) {
    const w = all.get(normalize(kind, id));
    if (w?.length) picked.set(normalize(kind, id), w);
  }
  return picked;
}

// Mobiilsed (cellular) telemeetriaseadmed raporteerivad otse oma IMEI all,
// measurement='data' ridadena (üks rida välja kohta). Arvestatakse ainult omandiperioodi sees olevaid ridu.
export async function fetchCellularTelemetry(imeis: string[]): Promise<Map<string, LiveFields>> {
  const result = new Map<string, LiveFields>();
  if (!tsdb || imeis.length === 0) return result;

  try {
    const windows = pickWindows(await ownershipWindows('IMEI', imeis), 'IMEI', imeis);
    const { ids, froms, tos } = flatten(windows);
    if (ids.length === 0) return result;

    const rows = await tsdb.$queryRaw<RawMeasurementRow[]>`
      SELECT DISTINCT ON (m.device, m.field)
        m.device, m.measurement, m.field, m.value_bool, m.value_int, m.value_bigint, m.value_double, m.value_text, m.time
      FROM measurements m
      JOIN unnest(${ids}::text[], ${froms}::timestamptz[], ${tos}::timestamptz[]) AS w(device, valid_from, valid_to)
        ON m.device = w.device AND m.time >= w.valid_from AND m.time <= w.valid_to
      WHERE m.measurement = 'data'
      ORDER BY m.device, m.field, m.time DESC
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
// Pesa loetakse meie omaks ainult siis, kui selle viimane 'mac' väärtus on meie MAC ja
// kirje jääb MAC-i omandiperioodi sisse. Tagastatakse ainult selle pesa väljad, mis on kirjutatud
// pärast pesa eelmist (teise) MAC-i — gateway enda andmeid ega võõra sensori ridu ei lisandu.
export async function fetchEyeTelemetry(macAddresses: string[]): Promise<Map<string, LiveFields>> {
  const result = new Map<string, LiveFields>();
  if (!tsdb || macAddresses.length === 0) return result;

  try {
    const windows = pickWindows(await ownershipWindows('MAC', macAddresses), 'MAC', macAddresses);
    const { ids, froms, tos } = flatten(windows);
    if (ids.length === 0) return result;

    const rows = await tsdb.$queryRaw<(RawMeasurementRow & { slot_mac: string })[]>`
      WITH w AS (
        SELECT upper(mac) AS mac, valid_from, valid_to
        FROM unnest(${ids}::text[], ${froms}::timestamptz[], ${tos}::timestamptz[]) AS x(mac, valid_from, valid_to)
      ),
      latest_mac AS (
        SELECT DISTINCT ON (device, measurement) device, measurement, upper(value_text) AS mac, time
        FROM measurements
        WHERE measurement IN ('eye1', 'eye2', 'eye3') AND field = 'mac'
        ORDER BY device, measurement, time DESC
      ),
      slots AS (
        SELECT lm.device, lm.measurement, lm.mac, w.valid_from, w.valid_to,
          COALESCE((
            SELECT max(o.time) FROM measurements o
            WHERE o.device = lm.device AND o.measurement = lm.measurement
              AND o.field = 'mac' AND upper(o.value_text) IS DISTINCT FROM lm.mac
          ), '-infinity'::timestamptz) AS other_time
        FROM latest_mac lm
        JOIN w ON w.mac = lm.mac AND lm.time >= w.valid_from AND lm.time <= w.valid_to
      )
      SELECT DISTINCT ON (m.device, m.measurement, m.field)
        s.mac AS slot_mac,
        m.device, m.measurement, m.field, m.value_bool, m.value_int, m.value_bigint, m.value_double, m.value_text, m.time
      FROM measurements m
      JOIN slots s ON m.device = s.device AND m.measurement = s.measurement
        AND m.time >= s.valid_from AND m.time <= s.valid_to AND m.time > s.other_time
      WHERE m.measurement IN ('eye1', 'eye2', 'eye3')
      ORDER BY m.device, m.measurement, m.field, m.time DESC
    `;

    const slots = new Map<string, { mac: string; entry: LiveFields }>();
    for (const row of rows) {
      const slotKey = `${row.device}:${row.measurement}`;
      const slot = slots.get(slotKey) ?? { mac: row.slot_mac, entry: { lastUpdate: '' } as LiveFields };
      const value = coalesceValue(row);
      if (value !== null) slot.entry[row.field] = value;
      const t = row.time.toISOString();
      if (!slot.entry.lastUpdate || t > slot.entry.lastUpdate) slot.entry.lastUpdate = t;
      slots.set(slotKey, slot);
    }

    for (const { mac, entry } of slots.values()) result.set(mac, entry);
  } catch (err) {
    console.error('telemetry_tsdb: eye sensor telemetry query failed:', err);
  }

  return result;
}

// Toore GPS-jälje ajalugu ühe mobiilse seadme kohta (kasutusel harimise
// taasesituse paneelis) — pivotib measurement='data' read ajatempli järgi
// üheks JSON-objektiks per pakett, kuna seade saadab kõik väljad
// (lat/lng/kiirus/suund) sama ajatempliga korraga.
export async function fetchDeviceHistory(imei: string, hours: number, from?: string | null, to?: string | null): Promise<HistoryRow[]> {
  if (!tsdb) return [];
  try {
    // Seotud seadme puhul piirab akent nii seotuse vahemik kui ka valitud tundide arv; lisaks
    // lõigatakse aken ettevõtte omandiperioodidega. Kui pakette on rohkem kui HISTORY_MAX_POINTS,
    // hõrendatakse neid ühtlaselt üle kogu akna (mitte ei võeta viimaseid N).
    const { start, end } = resolveHistoryWindow(hours, from, to);
    const segments = clampWindow((await ownershipWindows('IMEI', [imei])).get(imei) ?? [], start, end);
    if (segments.length === 0) return [];
    const froms = segments.map((s) => s.from.toISOString());
    const tos = segments.map((s) => s.to.toISOString());
    return await tsdb.$queryRaw<HistoryRow[]>`
      WITH packets AS (
        SELECT m.time,
          jsonb_object_agg(
            m.field,
            COALESCE(m.value_double, m.value_int::double precision, m.value_bigint::double precision)
          ) AS fields
        FROM measurements m
        JOIN unnest(${froms}::timestamptz[], ${tos}::timestamptz[]) AS s(seg_from, seg_to)
          ON m.time >= s.seg_from AND m.time <= s.seg_to
        WHERE m.device = ${imei}
          AND m.measurement = 'data'
          AND m.field IN ('latitude', 'longitude', 'angle', 'speed', 'speed_avl_kmh', 'altitude')
        GROUP BY m.time
        HAVING bool_or(m.field = 'latitude') AND bool_or(m.field = 'longitude')
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

export type FieldGpsRow = { device: string; time: Date; fields: { latitude?: number; longitude?: number } };

/** GPS-paketid [startUtc, endUtc] jooksul ainult ettevõtte seadmete omandiperioodide piires (põllutööde soovitused). */
export async function fetchFieldGpsPackets(startUtc: Date, endUtc: Date): Promise<FieldGpsRow[]> {
  if (!tsdb) return [];
  const all = await allOwnershipWindows('IMEI');
  const { ids, froms, tos } = flatten(all);
  if (ids.length === 0) return [];
  return tsdb.$queryRaw<FieldGpsRow[]>`
    SELECT m.device, m.time,
      jsonb_object_agg(m.field, COALESCE(m.value_double, m.value_int::double precision, m.value_bigint::double precision)) AS fields
    FROM measurements m
    JOIN unnest(${ids}::text[], ${froms}::timestamptz[], ${tos}::timestamptz[]) AS w(device, valid_from, valid_to)
      ON m.device = w.device AND m.time >= w.valid_from AND m.time <= w.valid_to
    WHERE m.measurement = 'data'
      AND m.field IN ('latitude', 'longitude')
      AND m.time >= ${startUtc}
      AND m.time <= ${endUtc}
    GROUP BY m.device, m.time
    HAVING bool_or(m.field = 'latitude') AND bool_or(m.field = 'longitude')
    ORDER BY m.device, m.time ASC
  `;
}
