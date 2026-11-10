// src/server/weather/cdsClient.ts — Copernicus Climate Data Store: ERA5-Landi punkti aegrida (reanalysis-era5-land-timeseries).
// Päring läheb järjekorda: saada → oota (status) → lae tulemus. Vastus on zip mitme CSV-ga (muutujagrupi kaupa),
// mis ühendatakse valid_time järgi; muutuja tuvastatakse veeru nime järgi. tp ja ssrd on tunnipõhised (mitte kumulatiivsed).
// Tundmatud muutujanimed jätab CDS vaikselt välja, seega kontrollitakse kohustuslike veergude olemasolu.
import JSZip from 'jszip';
import type { HourlyWeather } from './types';

const BASE = 'https://cds.climate.copernicus.eu/api/retrieve/v1';
const DATASET = 'reanalysis-era5-land-timeseries';
const VARIABLES = ['2m_temperature', 'total_precipitation', 'surface_solar_radiation_downwards', 'volumetric_soil_water_level_1', 'volumetric_soil_water_level_2'];
const REQUIRED = ['t2m', 'tp', 'ssrd'];

export class CdsError extends Error {}

const num = (s: string | undefined): number | null => {
  if (s === undefined || s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Mitu CSV-d (sama ajatelg) → tunniread. */
export function parseCdsCsvFiles(texts: string[]): HourlyWeather[] {
  const byTime = new Map<string, Record<string, number | null>>();
  for (const text of texts) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
    if (lines.length < 2) continue;
    const head = lines[0].split(',').map((h) => h.trim());
    const iT = head.indexOf('valid_time');
    if (iT < 0) throw new CdsError(`Tundmatu CSV päis: ${lines[0]}`);
    for (const line of lines.slice(1)) {
      const c = line.split(',');
      const key = c[iT].trim();
      const row = byTime.get(key) ?? byTime.set(key, {}).get(key)!;
      head.forEach((h, i) => { if (i !== iT && h !== 'latitude' && h !== 'longitude') row[h] = num(c[i]); });
    }
  }
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

export async function fetchHourly(
  cell: { lat: number; lon: number }, from: string, to: string,
  opts: { fetchImpl?: typeof fetch; pollMs?: number; timeoutMs?: number } = {}
): Promise<HourlyWeather[]> {
  const f = opts.fetchImpl ?? fetch;
  const key = process.env.CDS_API_KEY;
  if (!key && !opts.fetchImpl) throw new CdsError('CDS_API_KEY puudub');
  const headers = { 'PRIVATE-TOKEN': key ?? 'test', 'Content-Type': 'application/json' };
  const inputs = { variable: VARIABLES, location: { latitude: cell.lat, longitude: cell.lon }, date: [`${from}/${to}`], data_format: 'csv' };
  const sub = await f(`${BASE}/processes/${DATASET}/execution`, { method: 'POST', headers, body: JSON.stringify({ inputs }) });
  if (!sub.ok) throw new CdsError(`CDS päring ${sub.status}: ${(await sub.text()).slice(0, 300)}`);
  const { jobID } = (await sub.json()) as { jobID: string };
  const deadline = Date.now() + (opts.timeoutMs ?? 30 * 60_000);
  for (;;) {
    await sleep(opts.pollMs ?? 10_000);
    const st = (await (await f(`${BASE}/jobs/${jobID}`, { headers })).json()) as { status: string; detail?: unknown };
    if (st.status === 'successful') break;
    if (st.status === 'failed' || st.status === 'dismissed') throw new CdsError(`CDS töö ${st.status}: ${JSON.stringify(st.detail ?? st).slice(0, 300)}`);
    if (Date.now() > deadline) throw new CdsError('CDS töö ei valminud ajaga');
  }
  const res = (await (await f(`${BASE}/jobs/${jobID}/results`, { headers })).json()) as { asset: { value: { href: string } } };
  const file = await f(res.asset.value.href);
  if (!file.ok) throw new CdsError(`CDS allalaadimine ${file.status}`);
  return parseCdsCsvFiles(await unpack(await file.arrayBuffer()));
}
