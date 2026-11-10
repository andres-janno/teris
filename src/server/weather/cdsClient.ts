// src/server/weather/cdsClient.ts — Copernicus Climate Data Store: ERA5-Landi punkti aegrida (reanalysis-era5-land-timeseries).
// Päring läheb järjekorda: saada → oota (status) → lae tulemus. Vastus on zip mitme CSV-ga (muutujagrupi kaupa),
// mis ühendatakse valid_time järgi; muutuja tuvastatakse veeru nime järgi. tp ja ssrd on tunnipõhised (mitte kumulatiivsed).
// Tundmatud muutujanimed jätab CDS vaikselt välja, seega kontrollitakse kohustuslike veergude olemasolu.
import JSZip from 'jszip';
import type { HourlyWeather } from './types.ts';

const BASE = 'https://cds.climate.copernicus.eu/api/retrieve/v1';
const DATASET = 'reanalysis-era5-land-timeseries';
const VARIABLES = ['2m_temperature', 'total_precipitation', 'surface_solar_radiation_downwards', 'volumetric_soil_water_level_1', 'volumetric_soil_water_level_2'];
const REQUIRED = ['t2m', 'tp', 'ssrd'];

export class CdsError extends Error {
  /** HTTP-olek, kui viga tuli CDS-i vastusest (401/403 = vigane võti või litsents aktsepteerimata). */
  status?: number;
  constructor(message: string, status?: number) { super(message); this.status = status; }
}

/** Eestikeelne selgitus võtmega seotud HTTP-veale (kasutajale ja credential.lastError-ile; ei sisalda CDS vastuse keha). */
export function cdsKeyProblem(status: number): string {
  if (status === 401) return 'Võti ei kehti';
  if (status === 403) return 'Copernicuse kontol pole ERA5-Land litsentsi aktsepteeritud. Ava ERA5-Land timeseries andmestiku leht (cds.climate.copernicus.eu), logi sisse ja aktsepteeri litsents.';
  return `Copernicuse päring ebaõnnestus (HTTP ${status})`;
}

const CHECK_URL = `https://cds.climate.copernicus.eu/api/retrieve/v1/processes/reanalysis-era5-land-timeseries/execution`;

/**
 * Kontrollib võtit: saadab ühe minimaalse päringu ja vaatab ainult saatmise vastust (ei oota tulemust).
 * Tagastab { ok: true } või { ok: false, message, status }. Võtit ei kirjutata kunagi tulemusse.
 */
export async function checkCdsKey(key: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; message: string; status?: number }> {
  const d = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10);
  const inputs = { variable: ['2m_temperature'], location: { latitude: 58.4, longitude: 26.7 }, date: [`${d}/${d}`], data_format: 'csv' };
  let res: Response;
  try {
    res = await fetchImpl(CHECK_URL, { method: 'POST', headers: { 'PRIVATE-TOKEN': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ inputs }) });
  } catch {
    return { ok: false, message: 'Copernicuse teenusega ei saanud ühendust, proovi hiljem uuesti' };
  }
  if (res.ok) return { ok: true };
  return { ok: false, message: cdsKeyProblem(res.status), status: res.status };
}

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Mitu CSV-d (sama ajatelg) → tunniread. */
export function parseCdsCsvFiles(texts: string[]): HourlyWeather[] {
  const byTime = new Map<string, Record<string, number | null>>();
  let csvFiles = 0;
  for (const text of texts) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
    if (!lines.length) continue;
    const head = lines[0].split(',').map((h) => h.trim());
    const iT = head.indexOf('valid_time');
    if (iT < 0) throw new CdsError(`Tundmatu CSV päis: ${lines[0].slice(0, 300)}`);
    csvFiles++;
    for (const line of lines.slice(1)) {
      const c = line.split(',');
      const key = (c[iT] ?? '').trim();
      if (!key) continue;
      const row = byTime.get(key) ?? byTime.set(key, {}).get(key)!;
      head.forEach((h, i) => { if (i !== iT && h !== 'latitude' && h !== 'longitude') row[h] = num(c[i]); });
    }
  }
  if (!csvFiles) throw new CdsError('CDS vastus ei sisaldanud ühtegi CSV-d');
  const seen = new Set([...byTime.values()].flatMap((r) => Object.keys(r)));
  const missing = REQUIRED.filter((v) => !seen.has(v));
  if (byTime.size && missing.length) throw new CdsError(`CDS vastusest puuduvad veerud: ${missing.join(', ')}`);
  return [...byTime.entries()]
    .map(([t, r]) => ({ time: new Date(t.replace(' ', 'T') + 'Z'), r }))
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .map(({ time, r }) => ({
      time,
      tempC: r.t2m == null ? null : r.t2m - 273.15,
      precipMm: r.tp == null ? null : Math.max(0, r.tp * 1000),
      solarJm2: r.ssrd == null ? null : Math.max(0, r.ssrd),
      soil1: r.swvl1 ?? null,
      soil2: r.swvl2 ?? null
    }));
}

async function unpack(buf: ArrayBuffer): Promise<string[]> {
  const bytes = new Uint8Array(buf);
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return [new TextDecoder().decode(bytes)]; // pole zip
  const zip = await JSZip.loadAsync(buf);
  const csv = Object.values(zip.files).filter((f) => !f.dir && f.name.endsWith('.csv'));
  if (!csv.length) throw new CdsError(`Zip-is pole CSV-faile: ${Object.keys(zip.files).join(', ')}`);
  return Promise.all(csv.map((f) => f.async('string')));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** CDS vastus JSON-ina; HTTP-viga või mitte-JSON keha → CdsError. */
async function cdsJson<T>(res: Response, what: string): Promise<T> {
  const text = await res.text();
  if (!res.ok) throw new CdsError(`CDS ${what} ${res.status}: ${text.slice(0, 300)}`, res.status);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new CdsError(`CDS ${what} ${res.status}: vastus ei ole JSON: ${text.slice(0, 300)}`);
  }
}

/** Võti antakse kutsujalt (ettevõtte oma); vea sõnumist eemaldatakse võti igaks juhuks. */
export async function fetchHourly(
  cell: { lat: number; lon: number }, from: string, to: string,
  opts: { key: string; fetchImpl?: typeof fetch; pollMs?: number; timeoutMs?: number }
): Promise<HourlyWeather[]> {
  try {
    return await fetchHourlyWith(cell, from, to, opts);
  } catch (err) {
    if (err instanceof CdsError && opts.key && err.message.includes(opts.key)) {
      throw new CdsError(err.message.split(opts.key).join('***'), err.status);
    }
    throw err;
  }
}

async function fetchHourlyWith(
  cell: { lat: number; lon: number }, from: string, to: string,
  opts: { key: string; fetchImpl?: typeof fetch; pollMs?: number; timeoutMs?: number }
): Promise<HourlyWeather[]> {
  const f = opts.fetchImpl ?? fetch;
  const headers = { 'PRIVATE-TOKEN': opts.key, 'Content-Type': 'application/json' };
  const inputs = { variable: VARIABLES, location: { latitude: cell.lat, longitude: cell.lon }, date: [`${from}/${to}`], data_format: 'csv' };
  const sub = await f(`${BASE}/processes/${DATASET}/execution`, { method: 'POST', headers, body: JSON.stringify({ inputs }) });
  const { jobID } = await cdsJson<{ jobID?: unknown }>(sub, 'päring');
  if (typeof jobID !== 'string' || !jobID) throw new CdsError('CDS päring: vastuses puudub jobID');
  const deadline = Date.now() + (opts.timeoutMs ?? 30 * 60_000);
  for (;;) {
    await sleep(opts.pollMs ?? 10_000);
    const st = await cdsJson<{ status?: unknown; detail?: unknown }>(await f(`${BASE}/jobs/${jobID}`, { headers }), 'töö staatus');
    if (st.status === 'successful') break;
    if (st.status === 'failed' || st.status === 'dismissed') throw new CdsError(`CDS töö ${st.status}: ${JSON.stringify(st.detail ?? st).slice(0, 300)}`);
    if (st.status !== 'accepted' && st.status !== 'running') throw new CdsError(`CDS töö staatus tundmatu: ${JSON.stringify(st).slice(0, 300)}`);
    if (Date.now() > deadline) throw new CdsError('CDS töö ei valminud ajaga');
  }
  const res = await cdsJson<{ asset?: { value?: { href?: unknown } } }>(await f(`${BASE}/jobs/${jobID}/results`, { headers }), 'tulemus');
  const href = res.asset?.value?.href;
  if (typeof href !== 'string' || !href) throw new CdsError('CDS tulemus: vastuses puudub allalaadimise link');
  const file = await f(href);
  if (!file.ok) throw new CdsError(`CDS allalaadimine ${file.status}`, file.status);
  return parseCdsCsvFiles(await unpack(await file.arrayBuffer()));
}
