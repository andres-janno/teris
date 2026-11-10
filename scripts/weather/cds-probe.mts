// scripts/weather/cds-probe.mts — ühekordne katse: kas ERA5-Landi punkti aegrida annab vajalikud muutujad.
// Käivitus: set -a && . ./.env && set +a && npx tsx scripts/weather/cds-probe.mts [dataset] [alguskuupäev/lõpukuupäev]
import { writeFile } from 'node:fs/promises';

const BASE = 'https://cds.climate.copernicus.eu/api/retrieve/v1';
const KEY = process.env.CDS_API_KEY;
if (!KEY) throw new Error('CDS_API_KEY puudub');
const dataset = process.argv[2] ?? 'reanalysis-era5-land-timeseries';
const dateRange = process.argv[3] ?? '2025-06-01/2025-06-03';
const out = process.argv[4] ?? '/tmp/cds-probe.bin';
const headers = { 'PRIVATE-TOKEN': KEY, 'Content-Type': 'application/json' };

const inputs = {
  variable: (process.env.CDS_VARS ?? '2m_temperature,total_precipitation,potential_evaporation,volumetric_soil_water_layer_1,volumetric_soil_water_layer_2').split(','),
  location: { latitude: 58.1, longitude: 25.8 },
  date: [dateRange],
  data_format: 'csv'
};

const sub = await fetch(`${BASE}/processes/${dataset}/execution`, { method: 'POST', headers, body: JSON.stringify({ inputs }) });
console.log('submit', sub.status, await sub.clone().text());
if (!sub.ok) process.exit(1);
const { jobID } = await sub.json();
const t0 = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  const st = await (await fetch(`${BASE}/jobs/${jobID}`, { headers })).json();
  console.log('status', st.status, Math.round((Date.now() - t0) / 1000) + 's');
  if (st.status === 'successful') break;
  if (st.status === 'failed' || st.status === 'dismissed') { console.log(JSON.stringify(st)); process.exit(1); }
  if (Date.now() - t0 > 20 * 60_000) { console.log('timeout'); process.exit(1); }
}
const results = await (await fetch(`${BASE}/jobs/${jobID}/results`, { headers })).json();
console.log('results', JSON.stringify(results));
const file = await fetch(results.asset.value.href);
const buf = Buffer.from(await file.arrayBuffer());
await writeFile(out, buf);
console.log('saved', buf.length, 'bytes, content-type', file.headers.get('content-type'), 'first bytes', buf.subarray(0, 4).toString('hex'));
