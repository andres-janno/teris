# ERA5 ilmaandmed — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terises on ERA5-Landi päevane ilm (2015 →) ilmapunktide kaupa, majandi vaade „Ilm“ aastate võrdlusega ja põllu hooaja ilmakokkuvõte külvist koristuseni.

**Architecture:** Ettevõtteülesed tabelid `weather_points` + `weather_daily` (ilma RLS-ita). Öine taustatöö seob WEATHER-mooduliga ettevõtete põllu hooajad lähima ERA5-Landi ruuduga (`bindWeatherPoints`) ja laeb punktidele puuduvad päevad Copernicuse CDS API-st (`cdsClient` → `hourlyToDaily` → `weather_daily`). Kõik kokkuvõtted arvutab puhas `summarizeWeather` päringu ajal. API `/api/weather/*` (WEATHER moodul), UI vaade `WeatherView`, plokk põllu aknas, kaks veergu põldude tabelis, MCP tööriist, admin-vaade.

**Tech Stack:** TypeScript, Node http, Prisma 6 (PostgreSQL + RLS), React 19 (käsitsi SVG graafikud), Vitest, `@turf/turf`, `jszip`.

**Spec:** `docs/superpowers/specs/2026-11-10-era5-ilmaandmed-design.md`

## Global Constraints

- Kood töötab serveris: `ssh debian@uvn-243-120.tll07.zonevs.eu`, kaust `/home/debian/teris`. Kohalik `/Users/andresj/Progemine/teris` on sshfs-mount — faile võib muuta kohalikult, aga **kõik käsud (npm, npx, git, psql) käivita ssh kaudu** serveri kaustas.
- Testid käivad live-andmebaasi vastu ajutise ettevõttega (`test-tenant-…-${process.pid}`); ilmapunktid testides kasutavad koordinaate, mida päris põllud ei kasuta (lat 10–11, iga testifail oma vahemikus), ja kustutatakse testi lõpus.
- Identifikaatorid (URL-id, id/class, CSS, väljanimed) inglise keeles; kommentaarid ja UI-tekst eesti keeles.
- UI kuupäevad `pp.kk.aaaa` Tallinna ajas (`formatDate` failist `src/services/dateFormat.ts`); numbrid paremale (`className="num"`).
- Kõik filtrid mähitakse `FilterClear` komponenti.
- ERA5-Land ruudustik 0,1°; andmed alates **01.01.2015**; päev = Tallinna kalendripäev.
- GDD baas vaikimisi **5 °C**; vihmapäev/kuiv päev lävi **1 mm**; kuumapäev **tMax > 28 °C**; öökülm **tMin < 0 °C**; kalendriperiood **01.04–31.08**, öökülmad kalendrivaates **aprill–juuni**, põllu hooajal **külvist 60 päeva**; esiletõst **±1 standardhälve**.
- Esialgseks (ERA5T) loetakse viimase **90 päeva** andmed; need laetakse kord nädalas (esmaspäeval) uuesti.
- Allikaviide UI-s: „Allikas: Copernicus Climate Change Service, ERA5-Land“.
- Ilmaandmed ainult `WEATHER` litsentsimooduliga ettevõttele (`/api/weather/` on juba `src/server/license.ts` järgi WEATHER moodulis).
- CDS võti: `CDS_API_KEY` serveri `.env`-is. Kui puudub, laadimine logib hoiatuse ja ei tee midagi.
- Skeemimuudatus: varukoopia (`pg_dump` `PLATFORM_DATABASE_URL`-iga) → `npx prisma db push` (ilma `--accept-data-loss`) → `npx prisma generate` → `psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql` (annab uutele tabelitele `teris_app` õigused).
- Lõpus alati commit + `npm run release` serveris.
- Commit-sõnumi lõppu: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Failid

| Fail | Vastutus |
|---|---|
| `scripts/weather/cds-probe.mts` | ühekordne katse CDS API-ga (Task 1) |
| `prisma/schema.prisma` | `WeatherPoint`, `WeatherDaily`, `FieldSeason.weatherPointId`, `Crop.gddBaseC`, `CatalogCrop.gddBaseC` |
| `src/server/weather/types.ts` | ühised tüübid `HourlyWeather`, `DailyWeather`, `WeatherSummary` |
| `src/server/weather/grid.ts` (+test) | puhas: ruudu leidmine, naabrid, geomeetria keskpunkt |
| `src/server/weather/daily.ts` (+test) | puhas: tunniandmed → Tallinna päevad, deakumuleerimine |
| `src/server/weather/summary.ts` (+test) | puhas: `summarizeWeather`, `averageDays`, perioodid, normid |
| `src/server/weather/cdsClient.ts` (+test) | CDS päring, ootamine, allalaadimine, CSV parsimine |
| `src/server/weather/points.ts` (+test) | põllu hooaegade sidumine punktidega |
| `src/server/weather/loader.ts` (+test) | punktide laadimine, ajasti |
| `src/server/weather/weatherApi.ts` (+test) | `/api/weather/*` (v.a radar) |
| `src/server/apiHandler.ts` | `handleWeather` registreerimine; kultuuri `gddBaseC` salvestus |
| `src/server/catalog.ts` | `gddBaseC` kataloogist kultuuri loomisel |
| `src/server/prod.ts` | ajasti käivitus |
| `src/server/tenantCli.ts` | `weather:load` käsk |
| `src/server/platformApi.ts` | `/api/platform/weather*` |
| `src/server/mcp/tools/weather.ts`, `src/server/mcp/server.ts` | MCP tööriist `weather_summary` |
| `src/types/weather.ts`, `src/types/crop.ts` | kliendi tüübid |
| `src/services/api.ts` | klient: `getWeatherPoints`, `getWeatherYears`, `getWeatherMonths`, `getWeatherCumulative`, `getWeatherSeason`, `getWeatherSeasons` |
| `src/components/WeatherView.tsx`, `src/components/WeatherCharts.tsx` | majandi vaade |
| `src/components/WeatherSeasonSection.tsx` | plokk põllu aknas |
| `src/components/Header.tsx`, `src/App.tsx`, `src/App.css` | menüü, vaade, stiilid |
| `src/components/FieldEditDialog.tsx`, `src/components/FieldsTableView.tsx` | plokk ja veerud |
| `src/components/CropRegisterModal.tsx`, `src/admin/CatalogView.tsx` | GDD baasi väli |
| `src/admin/WeatherAdminView.tsx`, `src/admin/AdminApp.tsx`, `src/admin/platformApi.ts` | admin-vaade |
| `docs/vaated-ja-andmed.md`, `docs/andmemudel.md` | dokumentatsioon |

---

### Task 1: CDS katse (spike)

Eesmärk: kinnitada päris kontoga, millise andmestiku ja vormingu järgi `cdsClient` kirjutada. **Selle taski tulemus võib muuta Task 5 parsimist** — see on ainus koht plaanis, mis sõltub katse tulemusest.

**Files:**
- Create: `scripts/weather/cds-probe.mts`

**Interfaces:**
- Produces: kirja pandud otsus failis `docs/superpowers/specs/2026-11-10-era5-ilmaandmed-design.md` (jaotis „Allikas“ → „Katse tulemus“): andmestiku nimi, muutujad, vastuse vorming (CSV/NetCDF, zip või mitte), veergude nimed, ajatempli tähendus, kas sademed/aurumine on kumulatiivsed alates 00 UTC, uuendamise viide. Näidisvastus salvestatakse `src/server/weather/__fixtures__/cds-sample.csv` (≤ 3 päeva ridu).

- [ ] **Step 1: Kontrolli, et võti on olemas**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && grep -c "^CDS_API_KEY=" .env'
```
Oodatud: `1`. Kui `0` — PEATU ja palu kasutajal võti lisada (ning nõustuda ERA5-Land ja ERA5-Land timeseries litsentsiga CDS lehel).

- [ ] **Step 2: Kirjuta katseskript**

```ts
// scripts/weather/cds-probe.mts — ühekordne katse: kas ERA5-Landi punkti aegrida annab vajalikud muutujad.
// Käivitus: npx tsx scripts/weather/cds-probe.mts [dataset]  (vaikimisi reanalysis-era5-land-timeseries)
import { writeFile } from 'node:fs/promises';
import 'dotenv/config';

const BASE = 'https://cds.climate.copernicus.eu/api/retrieve/v1';
const KEY = process.env.CDS_API_KEY;
if (!KEY) throw new Error('CDS_API_KEY puudub');
const dataset = process.argv[2] ?? 'reanalysis-era5-land-timeseries';
const headers = { 'PRIVATE-TOKEN': KEY, 'Content-Type': 'application/json' };

const inputs = {
  variable: ['2m_temperature', 'total_precipitation', 'potential_evaporation', 'volumetric_soil_water_layer_1', 'volumetric_soil_water_layer_2'],
  location: { latitude: 58.1, longitude: 25.8 },
  date: ['2025-06-01/2025-06-03'],
  data_format: 'csv'
};

const sub = await fetch(`${BASE}/processes/${dataset}/execution`, { method: 'POST', headers, body: JSON.stringify({ inputs }) });
console.log('submit', sub.status, await sub.clone().text());
if (!sub.ok) process.exit(1);
const { jobID } = await sub.json();
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  const st = await (await fetch(`${BASE}/jobs/${jobID}`, { headers })).json();
  console.log('status', st.status);
  if (st.status === 'successful') break;
  if (st.status === 'failed' || st.status === 'dismissed') { console.log(JSON.stringify(st)); process.exit(1); }
}
const results = await (await fetch(`${BASE}/jobs/${jobID}/results`, { headers })).json();
console.log('results', JSON.stringify(results));
const file = await fetch(results.asset.value.href);
const buf = Buffer.from(await file.arrayBuffer());
await writeFile('/tmp/cds-probe.bin', buf);
console.log('saved', buf.length, 'bytes, content-type', file.headers.get('content-type'), 'first bytes', buf.subarray(0, 4).toString('hex'));
```

Kui projektis pole `dotenv` paketti, eemalda import ja käivita `set -a && . ./.env && set +a && npx tsx ...`.

- [ ] **Step 3: Käivita ja uuri vastust**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && npx tsx scripts/weather/cds-probe.mts && cd /tmp && (file cds-probe.bin; unzip -l cds-probe.bin 2>/dev/null; head -c 2000 cds-probe.bin)'
```

Kontrolli ja kirjuta üles:
1. Kas kõik 5 muutujat tulid? Kui `potential_evaporation` või mullaniiskus puudub — proovi andmestikku `reanalysis-era5-land` (tavaline, `area: [58.15, 25.75, 58.05, 25.85]`, `data_format: 'netcdf'`, `year/month/day/time` loendid) ja vaata, kas see annab; NetCDF4 loeb olemasolev `h5wasm` (vt `src/server/weatherRadar.ts`).
2. Vorming: zip? mitu CSV-d? veergude nimed (oodatud `valid_time`, `t2m`, `tp`, `pev`, `swvl1`, `swvl2`, `latitude`, `longitude`)?
3. `tp` väärtused: kas kasvavad päeva jooksul ja langevad 01 UTC juures (kumulatiivne alates 00 UTC) või on tunnipõhised?
4. Ühikud: t2m K, tp ja pev meetrites, pev negatiivne?
5. Mis on viimane saadaval kuupäev (proovi `date: ['<täna-10p>/<täna>']`)?

- [ ] **Step 4: Salvesta näidis ja otsus**

Salvesta 2–3 päeva vastust `src/server/weather/__fixtures__/cds-sample.csv` (kui vastus on zip, pane sinna CSV-d ühendatuna samas kujus, nagu `parseCdsCsv` Task 5-s neid saab; kui mitu faili, salvesta igaüks eraldi `cds-sample-<muutuja>.csv`). Lisa spec-i jaotisesse „Allikas“ alajaotis „Katse tulemus“ punktidega 1–5.

- [ ] **Step 5: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add scripts/weather/cds-probe.mts src/server/weather/__fixtures__ docs/superpowers/specs/2026-11-10-era5-ilmaandmed-design.md && git commit -m "chore(ilm): CDS katse ja näidisvastus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 2: Andmemudel

**Files:**
- Modify: `prisma/schema.prisma` (mudelid `FieldSeason`, `Crop`, `CatalogCrop`; uued mudelid `WeatherPoint`, `WeatherDaily` faili lõppu)
- Modify: `src/types/crop.ts`
- Modify: `src/server/apiHandler.ts:1616-1660` (kultuuri salvestus)
- Modify: `src/server/catalog.ts:17`
- Modify: `src/components/CropRegisterModal.tsx`, `src/admin/CatalogView.tsx`

**Interfaces:**
- Produces: `prisma.weatherPoint`, `prisma.weatherDaily`, `fieldSeason.weatherPointId`, `crop.gddBaseC` (Float, vaikimisi 5), `Crop.gddBaseC?: number` kliendi tüübis.

- [ ] **Step 1: Lisa skeemi**

`FieldSeason` mudelisse (pärast `geometry` rida):
```prisma
  weatherPointId      Int? // lähim ERA5-Landi ruut (öine sidumine, src/server/weather/points.ts)
```
ja seostesse:
```prisma
  weatherPoint     WeatherPoint?          @relation(fields: [weatherPointId], references: [id], onDelete: SetNull)
```
ja indeks `@@index([weatherPointId])`.

`Crop` ja `CatalogCrop` mudelisse (pärast `isWinterCrop`):
```prisma
  gddBaseC                      Float     @default(5) // temperatuurisumma (GDD) baastemperatuur °C
```

Faili lõppu:
```prisma
// ============================================================================
// ILMAANDMED (ERA5-Land) — ettevõtteülesed, ilma tenantId ja RLS-ita
// ============================================================================

model WeatherPoint {
  id            Int       @id @default(autoincrement())
  lat           Float // ERA5-Landi ruudu keskpunkt (0,1° ruudustik)
  lon           Float
  hasData       Boolean? // null = veel teadmata; false = ruut üle vee (andmeid pole)
  loadedFrom    DateTime? @db.Date
  loadedUntil   DateTime? @db.Date
  finalUntil    DateTime? @db.Date // kuni selle kuupäevani on andmed lõplikud (mitte ERA5T)
  lastAttemptAt DateTime?
  lastSuccessAt DateTime?
  lastError     String?
  failCount     Int       @default(0)
  createdAt     DateTime  @default(now())

  days         WeatherDaily[]
  fieldSeasons FieldSeason[]

  @@unique([lat, lon])
  @@map("weather_points")
}

model WeatherDaily {
  pointId       Int
  date          DateTime @db.Date // Tallinna kalendripäev
  tMin          Float
  tMax          Float
  tMean         Float
  precipMm      Float
  potEvapMm     Float? // potentsiaalne aurumine mm (positiivne)
  soilMoisture1 Float? // m³/m³, 0–7 cm
  soilMoisture2 Float? // m³/m³, 7–28 cm
  isFinal       Boolean  @default(false)

  point WeatherPoint @relation(fields: [pointId], references: [id], onDelete: Cascade)

  @@id([pointId, date])
  @@map("weather_daily")
}
```

- [ ] **Step 2: Varukoopia, db push, õigused**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-weather.dump && chmod 600 ~/backups/*.dump && npx prisma db push && npx prisma generate && psql -v ON_ERROR_STOP=1 "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql'
```
Oodatud: `db push` lisab tabelid ja veerud ilma andmekaotuse hoiatuseta. Kui hoiatab — PEATU ja teata.

Kontroll:
```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && psql "$DATABASE_URL" -c "select count(*) from weather_points" && psql "$PLATFORM_DATABASE_URL" -At -c "select name, \"gddBaseC\" from catalog_crops limit 3"'
```
Oodatud: `0` (rakenduse rollil on lugemisõigus) ja kataloogi read väärtusega `5`.

- [ ] **Step 3: Mais 10 °C kataloogis ja ettevõtetes**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && psql "$PLATFORM_DATABASE_URL" -c "update catalog_crops set \"gddBaseC\" = 10 where name ilike '\''%mais%'\''; update crops set \"gddBaseC\" = 10 where name ilike '\''%mais%'\'';"'
```

- [ ] **Step 4: Kultuuri salvestus ja tüüp**

`src/types/crop.ts` — `isWinterCrop` järele:
```ts
  gddBaseC?: number;                   // Temperatuurisumma (GDD) baastemperatuur °C (vaikimisi 5)
```

`src/server/apiHandler.ts` kultuuri POST-is (nii `update` kui `create` objektis, `isWinterCrop` järele):
```ts
          gddBaseC: Number.isFinite(Number(crop.gddBaseC)) ? Number(crop.gddBaseC) : 5,
```
Kontrolli, et GET `/api/crops` tagastab välja (kui see valib välju `select`-iga, lisa `gddBaseC: true`).

`src/server/catalog.ts:17` objektile lisa `gddBaseC: c.gddBaseC,`.

- [ ] **Step 5: Vormiväli kultuuride registris**

`src/components/CropRegisterModal.tsx`: lisa olek `const [editCropGddBase, setEditCropGddBase] = useState<number | undefined>(5);`, täitmine `setEditCropGddBase(crop.gddBaseC ?? 5);` (rea 221 kõrval), salvestusobjekti `gddBaseC: editCropGddBase ?? 5,` (rea 249 kõrval) ja vormi talivilja valiku järele:
```tsx
<label className="form-field">
  <span>GDD baastemperatuur (°C)</span>
  <NumberInput value={editCropGddBase} onChange={setEditCropGddBase} min={0} max={15} step={0.5} className="num" />
  <small className="hint">Temperatuurisumma arvutatakse päeva keskmisest miinus see väärtus. Teravili ja raps 5, mais 10.</small>
</label>
```
(Kasuta `NumberInput` propsid täpselt nii, nagu need failis `src/components/NumberInput.tsx` on defineeritud.)

`src/admin/CatalogView.tsx`: sama väli kataloogi kultuuri vormis; kontrolli, et platvormi kataloogi salvestus (`src/server/platformApi.ts` `routeCatalog`) võtab `gddBaseC` vastu — lisa samamoodi `Number(...)` teisendusega.

- [ ] **Step 6: Tüübikontroll ja testid**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/catalog.test.ts'
```
Oodatud: vigu pole, testid PASS.

- [ ] **Step 7: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add -A prisma src && git commit -m "feat(ilm): andmemudel ja kultuuri GDD baastemperatuur

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 3: Ruudustik ja ühised tüübid

**Files:**
- Create: `src/server/weather/types.ts`, `src/server/weather/grid.ts`
- Test: `src/server/weather/grid.test.ts`

**Interfaces:**
- Produces:
  - `type HourlyWeather = { time: Date; tempC: number | null; precipMm: number | null; potEvapMm: number | null; soil1: number | null; soil2: number | null }` — `precipMm`/`potEvapMm` on tunni kogus, mis lõpeb ajal `time`.
  - `type DailyWeather = { date: string /* AAAA-KK-PP */; tMin: number; tMax: number; tMean: number; precipMm: number; potEvapMm: number | null; soilMoisture1: number | null; soilMoisture2: number | null }`
  - `snapToCell(lat: number, lon: number): { lat: number; lon: number }`
  - `neighborCells(cell): { lat: number; lon: number }[]` — 8 naabrit, kauguse järgi kasvavalt
  - `geometryCenter(geometry: unknown): { lat: number; lon: number } | null`

- [ ] **Step 1: Tüübid**

```ts
// src/server/weather/types.ts — ilmaandmete ühised tüübid (ERA5-Land).

/** Üks tund ühes punktis. Kogused (sademed, aurumine) on tunni kohta, mis lõpeb ajal `time` (UTC). */
export type HourlyWeather = {
  time: Date;
  tempC: number | null;
  precipMm: number | null;
  potEvapMm: number | null;
  soil1: number | null;
  soil2: number | null;
};

/** Üks Tallinna kalendripäev ühes punktis (või punktide keskmine). */
export type DailyWeather = {
  date: string; // AAAA-KK-PP
  tMin: number;
  tMax: number;
  tMean: number;
  precipMm: number;
  potEvapMm: number | null;
  soilMoisture1: number | null;
  soilMoisture2: number | null;
};

export type WeatherSummary = {
  from: string;
  to: string;
  days: number; // päevi andmetega
  gdd: number;
  precipMm: number;
  rainDays: number;
  waterBalanceMm: number | null;
  longestDrySpell: number;
  hotDays: number;
  frostDays: number;
  soilMoistureAvg: number | null;
  soilMoistureMin: number | null;
  dataUntil: string | null; // viimane päev andmetega
  complete: boolean; // andmed katavad kogu perioodi
};
```

- [ ] **Step 2: Kirjuta failiv test**

```ts
// src/server/weather/grid.test.ts
import { describe, it, expect } from 'vitest';
import { snapToCell, neighborCells, geometryCenter } from './grid';

describe('snapToCell', () => {
  it('ümardab 0,1° ruudustikule', () => {
    expect(snapToCell(58.1234, 25.8761)).toEqual({ lat: 58.1, lon: 25.9 });
    expect(snapToCell(58.15, 25.85)).toEqual({ lat: 58.2, lon: 25.9 });
  });
  it('ei tekita ujukoma sabasid', () => {
    expect(snapToCell(59.30000001, 26.7).lat).toBe(59.3);
  });
});

describe('neighborCells', () => {
  it('8 naabrit, enne külgnaabrid, siis nurgad', () => {
    const n = neighborCells({ lat: 58.1, lon: 25.8 });
    expect(n).toHaveLength(8);
    expect(n.slice(0, 4)).toEqual(expect.arrayContaining([{ lat: 58.2, lon: 25.8 }, { lat: 58, lon: 25.8 }, { lat: 58.1, lon: 25.7 }, { lat: 58.1, lon: 25.9 }]));
    expect(n.slice(4)).toContainEqual({ lat: 58.2, lon: 25.9 });
  });
});

describe('geometryCenter', () => {
  it('polügooni keskpunkt', () => {
    const c = geometryCenter({ type: 'Polygon', coordinates: [[[25.8, 58.1], [25.82, 58.1], [25.82, 58.12], [25.8, 58.12], [25.8, 58.1]]] });
    expect(c!.lat).toBeCloseTo(58.11, 3);
    expect(c!.lon).toBeCloseTo(25.81, 3);
  });
  it('multipolügoon', () => {
    const c = geometryCenter({ type: 'MultiPolygon', coordinates: [[[[25.8, 58.1], [25.82, 58.1], [25.82, 58.12], [25.8, 58.1]]]] });
    expect(c).not.toBeNull();
  });
  it('vigane geomeetria → null', () => {
    expect(geometryCenter(null)).toBeNull();
    expect(geometryCenter({ type: 'Polygon', coordinates: [] })).toBeNull();
  });
});
```

- [ ] **Step 3: Kontrolli, et test kukub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather/grid.test.ts'`
Oodatud: FAIL (moodulit `./grid` pole).

- [ ] **Step 4: Teostus**

```ts
// src/server/weather/grid.ts — ERA5-Landi ruudustik (0,1°): lähim ruut, naabrid, põllu keskpunkt.
import * as turf from '@turf/turf';

export type Cell = { lat: number; lon: number };

const STEP = 0.1;
const round1 = (x: number) => Math.round(x * 10) / 10;

export function snapToCell(lat: number, lon: number): Cell {
  return { lat: round1(lat), lon: round1(lon) };
}

/** 8 naaberruutu; külgnaabrid enne nurki (lähemad ees). */
export function neighborCells(c: Cell): Cell[] {
  const side: [number, number][] = [[1, 0], [-1, 0], [0, -1], [0, 1]];
  const corner: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  return [...side, ...corner].map(([dy, dx]) => ({ lat: round1(c.lat + dy * STEP), lon: round1(c.lon + dx * STEP) }));
}

export function geometryCenter(geometry: unknown): Cell | null {
  try {
    const g = geometry as { type?: string; coordinates?: unknown[] } | null;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon') || !Array.isArray(g.coordinates) || g.coordinates.length === 0) return null;
    const [lon, lat] = turf.centroid(g as never).geometry.coordinates;
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Test läbib**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather/grid.test.ts'`
Oodatud: PASS.

- [ ] **Step 6: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/weather && git commit -m "feat(ilm): ruudustik ja tüübid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 4: Tunniandmed → Tallinna päevad

**Files:**
- Create: `src/server/weather/daily.ts`
- Test: `src/server/weather/daily.test.ts`

**Interfaces:**
- Consumes: `HourlyWeather`, `DailyWeather` (`types.ts`).
- Produces:
  - `deaccumulate(values: { time: Date; value: number | null }[]): { time: Date; value: number | null }[]` — ERA5-Landi 00 UTC-st kumulatiivne → tunnipõhine.
  - `tallinnDate(d: Date): string` — AAAA-KK-PP Tallinna ajas.
  - `hourlyToDaily(hours: HourlyWeather[]): DailyWeather[]` — ainult täielikud päevad (≥ 23 temperatuuritundi ja ≥ 23 kogusetundi).

- [ ] **Step 1: Failiv test**

```ts
// src/server/weather/daily.test.ts
import { describe, it, expect } from 'vitest';
import { deaccumulate, tallinnDate, hourlyToDaily } from './daily';
import type { HourlyWeather } from './types';

const h = (iso: string) => new Date(iso);

describe('deaccumulate', () => {
  it('kumulatiivne alates 00 UTC → tunnikogused; 01 UTC on esimene tund', () => {
    const r = deaccumulate([
      { time: h('2025-06-01T23:00Z'), value: 5 },
      { time: h('2025-06-02T00:00Z'), value: 6 }, // eelmise päeva summa
      { time: h('2025-06-02T01:00Z'), value: 0.5 },
      { time: h('2025-06-02T02:00Z'), value: 0.5 },
      { time: h('2025-06-02T03:00Z'), value: 2 }
    ]);
    expect(r.map((x) => x.value)).toEqual([null, 1, 0.5, 0, 1.5]);
  });
  it('negatiivne müra → 0', () => {
    const r = deaccumulate([{ time: h('2025-06-02T01:00Z'), value: 1 }, { time: h('2025-06-02T02:00Z'), value: 0.9999 }]);
    expect(r[1].value).toBe(0);
  });
});

describe('tallinnDate', () => {
  it('suveaeg UTC+3', () => {
    expect(tallinnDate(h('2025-06-01T20:59Z'))).toBe('2025-06-01');
    expect(tallinnDate(h('2025-06-01T21:00Z'))).toBe('2025-06-02');
  });
  it('talveaeg UTC+2', () => {
    expect(tallinnDate(h('2025-01-01T21:59Z'))).toBe('2025-01-01');
    expect(tallinnDate(h('2025-01-01T22:00Z'))).toBe('2025-01-02');
  });
});

// Täielik Tallinna päev 2025-06-02: UTC 2025-06-01T21:00 … 2025-06-02T20:00 (24 tundi)
function day(tempOf: (i: number) => number, precip = 0.1): HourlyWeather[] {
  return Array.from({ length: 24 }, (_, i) => ({
    time: new Date(Date.UTC(2025, 5, 1, 21 + i)),
    tempC: tempOf(i), precipMm: precip, potEvapMm: 0.2, soil1: 0.3, soil2: 0.35
  }));
}

describe('hourlyToDaily', () => {
  it('min, max, keskmine, summad', () => {
    const [d] = hourlyToDaily(day((i) => i));
    expect(d.date).toBe('2025-06-02');
    expect(d.tMin).toBe(0);
    expect(d.tMax).toBe(23);
    expect(d.tMean).toBeCloseTo(11.5, 5);
    expect(d.precipMm).toBeCloseTo(2.4, 5);
    expect(d.potEvapMm).toBeCloseTo(4.8, 5);
    expect(d.soilMoisture2).toBeCloseTo(0.35, 5);
  });
  it('mittetäielik päev jäetakse välja', () => {
    expect(hourlyToDaily(day((i) => i).slice(0, 20))).toEqual([]);
  });
  it('kogus, mis lõpeb keskööl, kuulub eelmisele päevale', () => {
    const hours = day(() => 10, 0);
    hours.push({ time: new Date(Date.UTC(2025, 5, 2, 21)), tempC: 10, precipMm: 7, potEvapMm: 0, soil1: null, soil2: null });
    const [d] = hourlyToDaily(hours);
    expect(d.precipMm).toBeCloseTo(7, 5);
  });
  it('mullaniiskuse puudumisel null', () => {
    const [d] = hourlyToDaily(day(() => 5).map((x) => ({ ...x, soil1: null, soil2: null, potEvapMm: null })));
    expect(d.soilMoisture1).toBeNull();
    expect(d.potEvapMm).toBeNull();
  });
});
```

- [ ] **Step 2: Kukub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather/daily.test.ts'`
Oodatud: FAIL.

- [ ] **Step 3: Teostus**

```ts
// src/server/weather/daily.ts — ERA5-Landi tunniandmed → Tallinna kalendripäevad.
// Temperatuur ja mullaniiskus on hetkeväärtused (päev = Tallinna päev ajast `time`);
// sademed ja aurumine on tunni kogused, mis lõpevad ajal `time` (päev = Tallinna päev ajast time − 30 min).
import type { DailyWeather, HourlyWeather } from './types';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit' });
export const tallinnDate = (d: Date): string => fmt.format(d);

const MIN_HOURS = 23; // suveaja vahetuse päevas on 23 tundi

/** ERA5-Land: kogused kogunevad alates 00 UTC; 00 UTC väärtus on eelmise päeva summa. */
export function deaccumulate(values: { time: Date; value: number | null }[]): { time: Date; value: number | null }[] {
  return values.map((v, i) => {
    if (v.value === null) return { time: v.time, value: null };
    if (v.time.getUTCHours() === 1) return { time: v.time, value: Math.max(0, v.value) };
    const prev = values[i - 1];
    if (!prev || prev.value === null || v.time.getTime() - prev.time.getTime() !== 3_600_000) return { time: v.time, value: null };
    return { time: v.time, value: Math.max(0, v.value - prev.value) };
  });
}

type Acc = { temps: number[]; precip: number[]; evap: number[]; s1: number[]; s2: number[] };
const empty = (): Acc => ({ temps: [], precip: [], evap: [], s1: [], s2: [] });
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const avg = (a: number[]) => (a.length ? sum(a) / a.length : null);

export function hourlyToDaily(hours: HourlyWeather[]): DailyWeather[] {
  const byDay = new Map<string, Acc>();
  const get = (k: string) => byDay.get(k) ?? byDay.set(k, empty()).get(k)!;
  for (const h of hours) {
    const instant = get(tallinnDate(h.time));
    if (h.tempC !== null) instant.temps.push(h.tempC);
    if (h.soil1 !== null) instant.s1.push(h.soil1);
    if (h.soil2 !== null) instant.s2.push(h.soil2);
    const amount = get(tallinnDate(new Date(h.time.getTime() - 30 * 60_000)));
    if (h.precipMm !== null) amount.precip.push(h.precipMm);
    if (h.potEvapMm !== null) amount.evap.push(h.potEvapMm);
  }
  const out: DailyWeather[] = [];
  for (const [date, a] of [...byDay.entries()].sort(([x], [y]) => x.localeCompare(y))) {
    if (a.temps.length < MIN_HOURS || a.precip.length < MIN_HOURS) continue;
    out.push({
      date,
      tMin: Math.min(...a.temps),
      tMax: Math.max(...a.temps),
      tMean: sum(a.temps) / a.temps.length,
      precipMm: sum(a.precip),
      potEvapMm: a.evap.length >= MIN_HOURS ? sum(a.evap) : null,
      soilMoisture1: avg(a.s1),
      soilMoisture2: avg(a.s2)
    });
  }
  return out;
}
```

- [ ] **Step 4: Läbib**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather/daily.test.ts'`
Oodatud: PASS.

- [ ] **Step 5: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/weather && git commit -m "feat(ilm): tunniandmed Tallinna päevadeks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 5: CDS klient (muudetud pärast Task 1 katset)

**Katse tulemus (Task 1, commit 3930967), mis seda taski muudab:**
- Andmestik `reanalysis-era5-land-timeseries` töötab. Vastus on **zip mitme CSV-ga** muutujagruppide kaupa, igaühel päis `valid_time,<muutujad>,latitude,longitude`; `valid_time` kujul `YYYY-MM-DD HH:MM:SS` UTC. Failid ühendatakse `valid_time` järgi, muutuja tuvastatakse **veeru nime** järgi (mitte faili nime järgi).
- `potential_evaporation` timeseries'is **puudub**. Otsus: potentsiaalne aurumine arvutatakse päeva kaupa **Makkinki valemiga** päikesekiirgusest (`ssrd`) ja keskmisest temperatuurist (vt allpool). ERA5 `pev`-i ei kasutata.
- `tp` (sademed, m) ja `ssrd` (J/m²) on **tunnipõhised** (kogus tunni kohta, mis lõpeb ajal `valid_time`), mitte kumulatiivsed → `deaccumulate` siin ei kasutata. `tp`-s võib olla mikroskoopilisi negatiivseid väärtusi → kärbi 0-ni.
- Muutujate nimed päringus: `2m_temperature`, `total_precipitation`, `surface_solar_radiation_downwards`, `volumetric_soil_water_level_1`, `volumetric_soil_water_level_2` (veerud vastuses `t2m`, `tp`, `ssrd`, `swvl1`, `swvl2`). **Tundmatud muutujanimed jäetakse vastusest vaikselt välja** (HTTP 201) → klient peab kontrollima, et veerud `t2m`, `tp`, `ssrd` on olemas, muidu `CdsError`.
- Andmete viide ~5–6 päeva.
- Fikstuurid: `src/server/weather/__fixtures__/cds-sample-{t2m,tp,ssrd,swvl,wind}.csv` (2025-06-10…12, 72 tundi).

**Files:**
- Modify: `src/server/weather/types.ts` (`HourlyWeather.potEvapMm` → `solarJm2`)
- Modify: `src/server/weather/daily.ts`, `src/server/weather/daily.test.ts` (Makkink, kiirguse koondamine)
- Create: `src/server/weather/cdsClient.ts`
- Test: `src/server/weather/cdsClient.test.ts`

**Interfaces:**
- Consumes: `hourlyToDaily`, `tallinnDate` (Task 4).
- Produces:
  - `HourlyWeather = { time: Date; tempC: number | null; precipMm: number | null; solarJm2: number | null; soil1: number | null; soil2: number | null }` — `precipMm`/`solarJm2` on tunni kogus, mis lõpeb ajal `time`. (`DailyWeather` jääb muutmata; `potEvapMm` arvutatakse päeva kaupa.)
  - `makkinkEt0(tMeanC: number, solarMJm2: number): number` (daily.ts) — mm/päevas, ≥ 0.
  - `parseCdsCsvFiles(texts: string[]): HourlyWeather[]`
  - `fetchHourly(cell, from, to, opts?)` — signatuur nagu varem.
  - `class CdsError extends Error`

- [ ] **Step 1: Tüübi ja päevakoondamise muutus (TDD)**

`types.ts`: `HourlyWeather`-is asenda `potEvapMm: number | null;` reaga
```ts
  solarJm2: number | null; // päikesekiirgus J/m² tunni kohta, mis lõpeb ajal `time`
```

`daily.test.ts`: fixture `day()`-s asenda `potEvapMm: 0.2` → `solarJm2: 1e6`; esimeses testis asenda `expect(d.potEvapMm).toBeCloseTo(4.8, 5);` →
```ts
    expect(d.potEvapMm).toBeCloseTo(makkinkEt0(11.5, 24), 5); // 24 tundi × 1 MJ
```
(import `makkinkEt0`), midnight-testi `potEvapMm: 0` → `solarJm2: 0` kui see seal esineb; mullaniiskuse testis `potEvapMm: null` → `solarJm2: null`. Lisa:
```ts
describe('makkinkEt0', () => {
  it('suvepäev 15 °C, 20 MJ/m² → ~3 mm', () => {
    expect(makkinkEt0(15, 20)).toBeCloseTo(2.99, 2);
  });
  it('külm ja pime → 0 (ei lähe negatiivseks)', () => {
    expect(makkinkEt0(-5, 1)).toBe(0);
  });
});
```
Run `npx vitest run src/server/weather/daily.test.ts` → FAIL.

`daily.ts`: `Acc.evap` asemel `solar: number[]`; amount-päevale `if (h.solarJm2 !== null) amount.solar.push(h.solarJm2);`; väljundis
```ts
      potEvapMm: a.solar.length >= MIN_HOURS ? makkinkEt0(sum(a.temps) / a.temps.length, sum(a.solar) / 1e6) : null,
```
ja lisa
```ts
/** Makkinki võrdlusaurumine (mm/päevas) päeva keskmisest temperatuurist ja päikesekiirgusest (MJ/m²). */
export function makkinkEt0(tMeanC: number, solarMJm2: number): number {
  const es = 0.6108 * Math.exp((17.27 * tMeanC) / (tMeanC + 237.3));
  const delta = (4098 * es) / (tMeanC + 237.3) ** 2; // küllastusrõhu kõvera tõus, kPa/°C
  const gamma = 0.066; // psühromeetriline konstant, kPa/°C
  return Math.max(0, 0.61 * (delta / (delta + gamma)) * (solarMJm2 / 2.45) - 0.12);
}
```
Run → PASS. Uuenda faili päisekommentaar (aurumine = Makkink kiirgusest).

- [ ] **Step 2: Kliendi failiv test**

```ts
// src/server/weather/cdsClient.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { parseCdsCsvFiles, fetchHourly } from './cdsClient';

const fx = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');
const T2M = 'valid_time,d2m,t2m,latitude,longitude\n2025-06-10 00:00:00,280,283.15,58.1,25.8\n2025-06-10 01:00:00,280,282.15,58.1,25.8\n';
const TP = 'valid_time,tp,latitude,longitude\n2025-06-10 00:00:00,0.0005,58.1,25.8\n2025-06-10 01:00:00,-1e-9,58.1,25.8\n';
const SSRD = 'valid_time,ssrd,latitude,longitude\n2025-06-10 00:00:00,0.0,58.1,25.8\n2025-06-10 01:00:00,360000,58.1,25.8\n';
const SWVL = 'valid_time,swvl1,swvl2,latitude,longitude\n2025-06-10 00:00:00,0.43,0.39,58.1,25.8\n2025-06-10 01:00:00,0.42,0.40,58.1,25.8\n';

describe('parseCdsCsvFiles', () => {
  it('ühendab failid aja järgi ja teisendab ühikud', () => {
    const r = parseCdsCsvFiles([TP, T2M, SWVL, SSRD]);
    expect(r).toHaveLength(2);
    expect(r[0].time.toISOString()).toBe('2025-06-10T00:00:00.000Z');
    expect(r[0].tempC).toBeCloseTo(10, 5);
    expect(r[0].precipMm).toBeCloseTo(0.5, 5);
    expect(r[1].precipMm).toBe(0); // negatiivne müra kärbitud
    expect(r[1].solarJm2).toBe(360000);
    expect(r[1].soil2).toBeCloseTo(0.40, 5);
  });
  it('mullaniiskuse puudumisel null', () => {
    const r = parseCdsCsvFiles([T2M, TP, SSRD]);
    expect(r[0].soil1).toBeNull();
  });
  it('kohustuslik veerg puudu → viga', () => {
    expect(() => parseCdsCsvFiles([T2M, SSRD])).toThrow(/tp/);
  });
  it('päris näidisvastus: 72 tundi, mõistlikud väärtused', () => {
    const r = parseCdsCsvFiles(['t2m', 'tp', 'ssrd', 'swvl', 'wind'].map((n) => fx(`cds-sample-${n}.csv`)));
    expect(r).toHaveLength(72);
    expect(r.every((x) => x.tempC !== null && x.tempC > -40 && x.tempC < 40)).toBe(true);
    expect(r.every((x) => x.precipMm !== null && x.precipMm >= 0 && x.precipMm < 50)).toBe(true);
    expect(r.every((x) => x.soil1 !== null)).toBe(true);
  });
});

describe('fetchHourly', () => {
  const zipOf = async (files: Record<string, string>) => {
    const z = new JSZip();
    for (const [n, t] of Object.entries(files)) z.file(n, t);
    return z.generateAsync({ type: 'arraybuffer' });
  };
  it('saadab päringu, ootab tööd, laeb zip-i', async () => {
    let polls = 0;
    const zip = await zipOf({ 'a.csv': T2M, 'b.csv': TP, 'c.csv': SSRD, 'd.csv': SWVL });
    const fake = (async (url: string, init?: RequestInit) => {
      if (url.endsWith('/execution')) {
        const body = JSON.parse(String(init!.body));
        expect(body.inputs.location).toEqual({ latitude: 58.1, longitude: 25.8 });
        expect(body.inputs.date).toEqual(['2025-06-10/2025-06-10']);
        expect(body.inputs.variable).toContain('surface_solar_radiation_downwards');
        return new Response(JSON.stringify({ jobID: 'j1' }), { status: 201 });
      }
      if (url.endsWith('/jobs/j1')) return new Response(JSON.stringify({ status: ++polls < 2 ? 'running' : 'successful' }));
      if (url.endsWith('/jobs/j1/results')) return new Response(JSON.stringify({ asset: { value: { href: 'https://dl/x.zip' } } }));
      if (url === 'https://dl/x.zip') return new Response(zip);
      throw new Error(url);
    }) as typeof fetch;
    const r = await fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', { fetchImpl: fake, pollMs: 1 });
    expect(r).toHaveLength(2);
    expect(polls).toBe(2);
  });
  it('ebaõnnestunud töö → CdsError', async () => {
    const fake = (async (url: string) => {
      if (url.endsWith('/execution')) return new Response(JSON.stringify({ jobID: 'j2' }), { status: 201 });
      return new Response(JSON.stringify({ status: 'failed', detail: 'boom' }));
    }) as typeof fetch;
    await expect(fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', { fetchImpl: fake, pollMs: 1 })).rejects.toThrow(/boom|failed/);
  });
  it('litsents nõustumata (403) → selge viga', async () => {
    const fake = (async () => new Response('required licences not accepted', { status: 403 })) as typeof fetch;
    await expect(fetchHourly({ lat: 58.1, lon: 25.8 }, '2025-06-10', '2025-06-10', { fetchImpl: fake, pollMs: 1 })).rejects.toThrow(/403/);
  });
});
```
Run `npx vitest run src/server/weather/cdsClient.test.ts` → FAIL (moodul puudub).

- [ ] **Step 3: Teostus**

```ts
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
```

`daily.ts` `deaccumulate` jääb alles (testitud, kuid praegu kasutamata) — **ära eemalda**, ERA5-Landi tavaandmestiku varuvariant vajaks seda.

- [ ] **Step 4: Läbib**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather && npx tsc --noEmit -p tsconfig.app.json'`
Oodatud: PASS, tüübivigu pole.

- [ ] **Step 5: Päris päring (üks päev)**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && npx tsx -e "import { fetchHourly } from \"./src/server/weather/cdsClient.ts\"; import { hourlyToDaily } from \"./src/server/weather/daily.ts\"; const h = await fetchHourly({ lat: 58.1, lon: 25.8 }, \"2025-06-09\", \"2025-06-11\"); console.log(h.length, JSON.stringify(hourlyToDaily(h)));"'
```
Oodatud: ~72 tundi; 2025-06-10 päevarida mõistlike väärtustega (temperatuur 5–25 °C, sademed 0–30 mm, potEvapMm 0,5–6 mm, mullaniiskus 0,1–0,5).

- [ ] **Step 6: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/weather && git commit -m "feat(ilm): CDS klient ja Makkinki aurumine

Co-Authored-By: <mudel> <noreply@anthropic.com>"'
```

---

### Task 6: Kokkuvõtted ja perioodid

**Files:**
- Create: `src/server/weather/summary.ts`
- Test: `src/server/weather/summary.test.ts`

**Interfaces:**
- Consumes: `DailyWeather`, `WeatherSummary`.
- Produces:
  - `summarizeWeather(days: DailyWeather[], o: { from: string; to: string; gddBaseC: number; frostFrom?: string; frostTo?: string }): WeatherSummary` — `days` võib sisaldada perioodiväliseid päevi (filtreeritakse).
  - `averageDays(series: DailyWeather[][]): DailyWeather[]` — mitme punkti päevade keskmine (sama kuupäev).
  - `calendarPeriod(year: number): { from: string; to: string; frostFrom: string; frostTo: string }` — 01.04–31.08, öökülm 01.04–30.06.
  - `seasonPeriod(s: { seedingDate: Date | null; harvestDate: Date | null }, today: string): { from: string; to: string; frostFrom: string; frostTo: string } | null`
  - `meanAndSd(values: number[]): { mean: number; sd: number }`
  - `addDays(date: string, n: number): string`

- [ ] **Step 1: Failiv test**

```ts
// src/server/weather/summary.test.ts
import { describe, it, expect } from 'vitest';
import { summarizeWeather, averageDays, calendarPeriod, seasonPeriod, meanAndSd, addDays } from './summary';
import type { DailyWeather } from './types';

const d = (date: string, p: Partial<DailyWeather> = {}): DailyWeather => ({
  date, tMin: 5, tMax: 15, tMean: 10, precipMm: 0, potEvapMm: 2, soilMoisture1: 0.3, soilMoisture2: 0.3, ...p
});
const range = (from: string, n: number, p: (i: number) => Partial<DailyWeather> = () => ({})) =>
  Array.from({ length: n }, (_, i) => d(addDays(from, i), p(i)));

describe('summarizeWeather', () => {
  it('GDD baasiga, alla baasi annab 0', () => {
    const s = summarizeWeather([d('2025-05-01', { tMean: 12 }), d('2025-05-02', { tMean: 3 })], { from: '2025-05-01', to: '2025-05-02', gddBaseC: 5 });
    expect(s.gdd).toBe(7);
  });
  it('sademed, vihmapäevad, veebilanss', () => {
    const s = summarizeWeather([d('2025-05-01', { precipMm: 3 }), d('2025-05-02', { precipMm: 0.5 })], { from: '2025-05-01', to: '2025-05-02', gddBaseC: 5 });
    expect(s.precipMm).toBe(3.5);
    expect(s.rainDays).toBe(1);
    expect(s.waterBalanceMm).toBe(-0.5);
  });
  it('pikim kuiv periood', () => {
    // i=0 kuiv, 1–2 vihm, 3–6 kuiv (4 päeva), 7–9 vihm
    const days = range('2025-05-01', 10, (i) => ({ precipMm: i === 0 || (i >= 3 && i <= 6) ? 0 : 2 }));
    const s = summarizeWeather(days, { from: '2025-05-01', to: '2025-05-10', gddBaseC: 5 });
    expect(s.longestDrySpell).toBe(4);
  });
  it('kuumapäevad ja öökülmad aknas', () => {
    const days = [d('2025-04-10', { tMin: -2 }), d('2025-07-01', { tMin: -1, tMax: 30 })];
    const s = summarizeWeather(days, { from: '2025-04-01', to: '2025-08-31', gddBaseC: 5, frostFrom: '2025-04-01', frostTo: '2025-06-30' });
    expect(s.frostDays).toBe(1);
    expect(s.hotDays).toBe(1);
  });
  it('puuduvad päevad: dataUntil ja complete', () => {
    const s = summarizeWeather(range('2025-05-01', 5), { from: '2025-05-01', to: '2025-05-10', gddBaseC: 5 });
    expect(s.days).toBe(5);
    expect(s.dataUntil).toBe('2025-05-05');
    expect(s.complete).toBe(false);
  });
  it('perioodivälised päevad ei loe', () => {
    const s = summarizeWeather([d('2025-03-31', { precipMm: 50 }), d('2025-04-01', { precipMm: 1 })], { from: '2025-04-01', to: '2025-04-01', gddBaseC: 5 });
    expect(s.precipMm).toBe(1);
    expect(s.complete).toBe(true);
  });
  it('aurumiseta veebilanss null', () => {
    const s = summarizeWeather([d('2025-05-01', { potEvapMm: null })], { from: '2025-05-01', to: '2025-05-01', gddBaseC: 5 });
    expect(s.waterBalanceMm).toBeNull();
  });
  it('mullaniiskus juurekihist', () => {
    const s = summarizeWeather([d('2025-05-01', { soilMoisture2: 0.2 }), d('2025-05-02', { soilMoisture2: 0.4 })], { from: '2025-05-01', to: '2025-05-02', gddBaseC: 5 });
    expect(s.soilMoistureAvg).toBeCloseTo(0.3, 5);
    expect(s.soilMoistureMin).toBe(0.2);
  });
});

describe('averageDays', () => {
  it('keskmistab sama kuupäeva; puuduv punktis jäetakse keskmisest välja', () => {
    const r = averageDays([[d('2025-05-01', { tMean: 10, precipMm: 2 })], [d('2025-05-01', { tMean: 12, precipMm: 4 }), d('2025-05-02')]]);
    expect(r).toHaveLength(2);
    expect(r[0].tMean).toBe(11);
    expect(r[0].precipMm).toBe(3);
  });
});

describe('perioodid', () => {
  it('kalendriperiood', () => {
    expect(calendarPeriod(2024)).toEqual({ from: '2024-04-01', to: '2024-08-31', frostFrom: '2024-04-01', frostTo: '2024-06-30' });
  });
  it('külvist koristuseni; öökülm 60 päeva', () => {
    const p = seasonPeriod({ seedingDate: new Date('2025-04-20T00:00:00Z'), harvestDate: new Date('2025-08-10T00:00:00Z') }, '2025-11-10');
    expect(p).toEqual({ from: '2025-04-20', to: '2025-08-10', frostFrom: '2025-04-20', frostTo: '2025-06-19' });
  });
  it('koristuseta → tänaseni; talivili üle aastavahetuse', () => {
    expect(seasonPeriod({ seedingDate: new Date('2024-09-05T00:00:00Z'), harvestDate: null }, '2025-05-01')!.to).toBe('2025-05-01');
    expect(seasonPeriod({ seedingDate: new Date('2024-09-05T00:00:00Z'), harvestDate: null }, '2025-05-01')!.from).toBe('2024-09-05');
  });
  it('külvikuupäevata null', () => {
    expect(seasonPeriod({ seedingDate: null, harvestDate: null }, '2025-05-01')).toBeNull();
  });
});

describe('meanAndSd', () => {
  it('populatsiooni standardhälve', () => {
    expect(meanAndSd([2, 4, 4, 4, 5, 5, 7, 9])).toEqual({ mean: 5, sd: 2 });
  });
});
```

- [ ] **Step 2: Kukub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather/summary.test.ts'`
Oodatud: FAIL.

- [ ] **Step 3: Teostus**

```ts
// src/server/weather/summary.ts — ilmakokkuvõte päevaandmetest (arvutatakse päringu ajal, ei salvestata).
import { tallinnDate } from './daily';
import type { DailyWeather, WeatherSummary } from './types';

export const RAIN_MM = 1;
export const HOT_C = 28;
export const FROST_C = 0;
export const SEASON_FROST_DAYS = 60;

export function addDays(date: string, n: number): string {
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;
const r1 = (x: number) => Math.round(x * 10) / 10;

export function summarizeWeather(
  all: DailyWeather[], o: { from: string; to: string; gddBaseC: number; frostFrom?: string; frostTo?: string }
): WeatherSummary {
  const days = all.filter((x) => x.date >= o.from && x.date <= o.to).sort((a, b) => a.date.localeCompare(b.date));
  let gdd = 0, precip = 0, rain = 0, dry = 0, longest = 0, hot = 0, frost = 0, balance = 0;
  let evapMissing = false;
  const soil: number[] = [];
  for (const x of days) {
    gdd += Math.max(0, x.tMean - o.gddBaseC);
    precip += x.precipMm;
    if (x.precipMm >= RAIN_MM) { rain++; dry = 0; } else { dry++; longest = Math.max(longest, dry); }
    if (x.tMax > HOT_C) hot++;
    if (x.tMin < FROST_C && x.date >= (o.frostFrom ?? o.from) && x.date <= (o.frostTo ?? o.to)) frost++;
    if (x.potEvapMm === null) evapMissing = true; else balance += x.precipMm - x.potEvapMm;
    if (x.soilMoisture2 !== null) soil.push(x.soilMoisture2);
  }
  const dataUntil = days.length ? days[days.length - 1].date : null;
  return {
    from: o.from, to: o.to, days: days.length,
    gdd: r1(gdd), precipMm: r1(precip), rainDays: rain,
    waterBalanceMm: days.length && !evapMissing ? r1(balance) : null,
    longestDrySpell: longest, hotDays: hot, frostDays: frost,
    soilMoistureAvg: soil.length ? soil.reduce((s, v) => s + v, 0) / soil.length : null,
    soilMoistureMin: soil.length ? Math.min(...soil) : null,
    dataUntil,
    complete: days.length === daysBetween(o.from, o.to)
  };
}

export function averageDays(series: DailyWeather[][]): DailyWeather[] {
  if (series.length === 1) return series[0];
  const byDate = new Map<string, DailyWeather[]>();
  for (const s of series) for (const x of s) (byDate.get(x.date) ?? byDate.set(x.date, []).get(x.date)!).push(x);
  const mean = (a: (number | null)[]) => {
    const v = a.filter((x): x is number => x !== null);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  };
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, xs]) => ({
    date,
    tMin: mean(xs.map((x) => x.tMin))!, tMax: mean(xs.map((x) => x.tMax))!, tMean: mean(xs.map((x) => x.tMean))!,
    precipMm: mean(xs.map((x) => x.precipMm))!,
    potEvapMm: mean(xs.map((x) => x.potEvapMm)), soilMoisture1: mean(xs.map((x) => x.soilMoisture1)), soilMoisture2: mean(xs.map((x) => x.soilMoisture2))
  }));
}

export function calendarPeriod(year: number) {
  return { from: `${year}-04-01`, to: `${year}-08-31`, frostFrom: `${year}-04-01`, frostTo: `${year}-06-30` };
}

export function seasonPeriod(s: { seedingDate: Date | null; harvestDate: Date | null }, today: string) {
  if (!s.seedingDate) return null;
  const from = tallinnDate(s.seedingDate);
  const to = s.harvestDate ? tallinnDate(s.harvestDate) : today;
  if (to < from) return null;
  return { from, to, frostFrom: from, frostTo: addDays(from, SEASON_FROST_DAYS) };
}

export function meanAndSd(values: number[]): { mean: number; sd: number } {
  if (!values.length) return { mean: 0, sd: 0 };
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length);
  return { mean, sd };
}
```

Märkus: `seasonPeriod` testis on kuupäevad UTC keskööl; Tallinna ajas on see sama kuupäev (UTC+2/+3), seega `tallinnDate` annab sama päeva. Kui päris andmetes on `seedingDate` salvestatud Tallinna keskööna (nt `2025-04-19T21:00Z`), annab `tallinnDate` õigesti `2025-04-20`.

- [ ] **Step 4: Läbib**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather/summary.test.ts'`
Oodatud: PASS.

- [ ] **Step 5: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/weather && git commit -m "feat(ilm): kokkuvõtted ja perioodid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 7: Põllu hooaegade sidumine punktidega

**Files:**
- Create: `src/server/weather/points.ts`
- Test: `src/server/weather/points.test.ts`

**Interfaces:**
- Consumes: `snapToCell`, `neighborCells`, `geometryCenter` (Task 3); `prisma`, `runAsTenant` (`src/server/db.ts`).
- Produces: `bindWeatherPoints(): Promise<{ bound: number; changed: number }>` — käivitatakse ettevõtte kontekstis (`runAsTenant`); seob kõik ettevõtte hooajad lähima andmetega ruuduga, loob puuduvad punktid.

- [ ] **Step 1: Failiv test**

```ts
// src/server/weather/points.test.ts — live-andmebaas ajutise ettevõttega; punktid lat 10.0–10.6 kustutatakse lõpus
// (loader.test kasutab 10.7, weatherApi.test 10.9 — failid jooksevad paralleelselt, vahemikud ei tohi kattuda).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant } from '../db';
import { bindWeatherPoints } from './points';

const T = `test-tenant-weather-${process.pid}`;
const run = <R>(fn: () => PromiseLike<R>): Promise<R> => runAsTenant(T, async () => await fn());
const square = (lat: number, lon: number) => ({ type: 'Polygon', coordinates: [[[lon, lat], [lon + 0.01, lat], [lon + 0.01, lat + 0.01], [lon, lat + 0.01], [lon, lat]]] });

let fsA = 0, fsB = 0, fsC = 0;

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Ilma test' } });
  await run(async () => {
    const mk = async (num: string, lat: number, lon: number) => {
      const f = await prisma.field.create({ data: { num, name: num, fieldCode: `W${num}` } });
      return (await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2025, areaHa: 1, crop: 'Oder', geometry: square(lat, lon) } })).id;
    };
    fsA = await mk('1', 10.12, 20.12);
    fsB = await mk('2', 10.13, 20.13); // sama ruut mis A
    fsC = await mk('3', 10.31, 20.12);
  });
});

afterAll(async () => {
  await authDb().tenant.delete({ where: { id: T } }).catch(() => {});
  await authDb().weatherPoint.deleteMany({ where: { lat: { gte: 9.95, lt: 10.65 } } });
});

describe('bindWeatherPoints', () => {
  it('seob lähima ruuduga, sama ruut jagatakse', async () => {
    await run(() => bindWeatherPoints());
    const rows = await run(() => prisma.fieldSeason.findMany({ where: { id: { in: [fsA, fsB, fsC] } }, include: { weatherPoint: true } }));
    const by = new Map(rows.map((r) => [r.id, r.weatherPoint]));
    expect(by.get(fsA)).toMatchObject({ lat: 10.1, lon: 20.1 });
    expect(by.get(fsB)!.id).toBe(by.get(fsA)!.id);
    expect(by.get(fsC)).toMatchObject({ lat: 10.3, lon: 20.1 });
  });

  it('teine käik ei muuda midagi', async () => {
    expect((await run(() => bindWeatherPoints())).changed).toBe(0);
  });

  it('andmeteta ruut (üle vee) asendatakse naabriga', async () => {
    await authDb().weatherPoint.update({ where: { lat_lon: { lat: 10.3, lon: 20.1 } }, data: { hasData: false } });
    await run(() => bindWeatherPoints());
    const c = await run(() => prisma.fieldSeason.findUniqueOrThrow({ where: { id: fsC }, include: { weatherPoint: true } }));
    expect(c.weatherPoint).toMatchObject({ lat: 10.4, lon: 20.1 }); // esimene külgnaaber
  });

  it('geomeetria nihkumisel uus seos', async () => {
    await run(() => prisma.fieldSeason.update({ where: { id: fsA }, data: { geometry: square(10.52, 20.52) } }));
    const r = await run(() => bindWeatherPoints());
    expect(r.changed).toBe(1);
    const a = await run(() => prisma.fieldSeason.findUniqueOrThrow({ where: { id: fsA }, include: { weatherPoint: true } }));
    expect(a.weatherPoint).toMatchObject({ lat: 10.5, lon: 20.5 });
  });
});
```

- [ ] **Step 2: Kukub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather/points.test.ts'`
Oodatud: FAIL.

- [ ] **Step 3: Teostus**

```ts
// src/server/weather/points.ts — põllu hooaeg → lähim ERA5-Landi ruut (ilmapunkt).
// Käivitatakse ettevõtte kontekstis igal ööl enne laadimist ja ilmavaate avamisel, kui leidub sidumata hooaegu.
// Ruut, millel andmeid pole (hasData = false, nt üle vee), asendatakse lähima naaberruuduga.
import { prisma } from '../db';
import { snapToCell, neighborCells, geometryCenter, type Cell } from './grid';

async function pointFor(cell: Cell): Promise<number> {
  const candidates = [cell, ...neighborCells(cell)];
  for (const c of candidates) {
    const p = await prisma.weatherPoint.upsert({ where: { lat_lon: c }, create: c, update: {} });
    if (p.hasData !== false) return p.id;
  }
  // Kõik naabrid andmeteta — jääb esimese ruudu juurde (UI näitab „andmeid pole“)
  return (await prisma.weatherPoint.findUniqueOrThrow({ where: { lat_lon: cell } })).id;
}

export async function bindWeatherPoints(): Promise<{ bound: number; changed: number }> {
  const seasons = await prisma.fieldSeason.findMany({ select: { id: true, geometry: true, weatherPointId: true } });
  const cache = new Map<string, number>();
  let bound = 0, changed = 0;
  for (const s of seasons) {
    const center = geometryCenter(s.geometry);
    if (!center) continue;
    const cell = snapToCell(center.lat, center.lon);
    const key = `${cell.lat}:${cell.lon}`;
    if (!cache.has(key)) cache.set(key, await pointFor(cell));
    const pointId = cache.get(key)!;
    bound++;
    if (s.weatherPointId !== pointId) {
      await prisma.fieldSeason.update({ where: { id: s.id }, data: { weatherPointId: pointId } });
      changed++;
    }
  }
  return { bound, changed };
}
```

NB: `prisma.fieldSeason.update` täidab auditivälja `updatedBy` ainult siis, kui päringul on kasutaja; taustatöös kasutajat pole, seega `updatedBy` ei muutu (soovitud). `updatedAt` muutub — see on vastuvõetav.

- [ ] **Step 4: Läbib**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather/points.test.ts'`
Oodatud: PASS. Kui `authDb().tenant.create` vajab muid kohustuslikke välju, vaata `src/server/mcp/testTenant.ts` ja kasuta sama mustrit.

- [ ] **Step 5: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/weather && git commit -m "feat(ilm): põllu hooaegade sidumine ilmapunktidega

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 8: Laadimine ja ajasti

**Files:**
- Create: `src/server/weather/loader.ts`
- Test: `src/server/weather/loader.test.ts`
- Modify: `src/server/prod.ts`, `src/server/tenantCli.ts`

**Interfaces:**
- Consumes: `fetchHourly` (Task 5), `hourlyToDaily`, `tallinnDate` (Task 4), `addDays` (Task 6), `bindWeatherPoints` (Task 7), `authDb`, `runAsTenant`.
- Produces:
  - `type LoaderDeps = { now: () => Date; fetchHourly: (cell: { lat: number; lon: number }, from: string, to: string) => Promise<HourlyWeather[]> }`
  - `loadPoint(pointId: number, deps?: LoaderDeps, opts?: { refreshRecent?: boolean }): Promise<{ days: number }>`
  - `runWeatherLoad(deps?: LoaderDeps): Promise<void>` — sidumine kõigile WEATHER ettevõtetele, siis kõigi punktide laadimine.
  - `startWeatherScheduler(): void`
  - konstandid `WEATHER_START = '2015-01-01'`, `PROVISIONAL_DAYS = 90`, `FAIL_WARN = 3`.

- [ ] **Step 1: Failiv test**

```ts
// src/server/weather/loader.test.ts — live-andmebaas; CDS on võltsitud; ainult punkt lat 10.7.
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { prisma } from '../db';
import { loadPoint, type LoaderDeps } from './loader';
import type { HourlyWeather } from './types';

const hoursFor = (from: string, to: string): HourlyWeather[] => {
  const out: HourlyWeather[] = [];
  // Tallinna päevad from..to: UTC 21:00 eelmisel päeval (suvi) — testis piisab, et kõik tunnid kaetud oleks
  for (let t = Date.parse(`${from}T00:00:00Z`) - 3 * 3_600_000; t <= Date.parse(`${to}T23:00:00Z`); t += 3_600_000) {
    out.push({ time: new Date(t), tempC: 10, precipMm: 0.1, solarJm2: 100000, soil1: 0.3, soil2: 0.3 });
  }
  return out;
};

let calls: [string, string][] = [];
let fail = false;
let pointId = 0;
const deps: LoaderDeps = {
  now: () => new Date('2015-03-10T12:00:00Z'),
  fetchHourly: async (_c, from, to) => {
    calls.push([from, to]);
    if (fail) throw new Error('CDS maas');
    return hoursFor(from, to);
  }
};

beforeEach(async () => {
  calls = [];
  fail = false;
  await prisma.weatherPoint.deleteMany({ where: { lat: 10.7, lon: 20.7 } });
  pointId = (await prisma.weatherPoint.create({ data: { lat: 10.7, lon: 20.7 } })).id;
});
afterAll(async () => { await prisma.weatherPoint.deleteMany({ where: { lat: 10.7, lon: 20.7 } }); });

describe('loadPoint', () => {
  it('esmalaadimine alates 2015-01-01 aasta kaupa kuni eilseni', async () => {
    await loadPoint(pointId, deps);
    expect(calls).toEqual([['2015-01-01', '2015-03-09']]);
    const p = await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } });
    expect(p.hasData).toBe(true);
    expect(p.loadedUntil!.toISOString().slice(0, 10)).toBe('2015-03-09');
    expect(p.failCount).toBe(0);
    expect(await prisma.weatherDaily.count({ where: { pointId } })).toBe(68);
  });

  it('järgmine käik küsib ainult uusi päevi', async () => {
    await loadPoint(pointId, deps);
    calls = [];
    await loadPoint(pointId, { ...deps, now: () => new Date('2015-03-12T12:00:00Z') });
    expect(calls).toEqual([['2015-03-10', '2015-03-11']]);
  });

  it('refreshRecent laeb viimased 90 päeva üle', async () => {
    await loadPoint(pointId, deps);
    calls = [];
    await loadPoint(pointId, deps, { refreshRecent: true });
    expect(calls[0][0]).toBe('2015-01-01'); // 90 päeva tagasi < algus → algusest
  });

  it('viga: failCount kasvab, andmed jäävad alles', async () => {
    fail = true;
    await expect(loadPoint(pointId, deps)).rejects.toThrow('CDS maas');
    const p = await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } });
    expect(p.failCount).toBe(1);
    expect(p.lastError).toContain('CDS maas');
  });

  it('tühjad temperatuurid → hasData false', async () => {
    await loadPoint(pointId, { ...deps, fetchHourly: async (_c, f, t) => hoursFor(f, t).map((h) => ({ ...h, tempC: null })) });
    expect((await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } })).hasData).toBe(false);
  });
});
```

- [ ] **Step 2: Kukub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather/loader.test.ts'`
Oodatud: FAIL.

- [ ] **Step 3: Teostus**

```ts
// src/server/weather/loader.ts — ilmapunktide laadimine CDS-ist (ERA5-Land) ja öine ajasti.
// Esmalaadimine alates 2015 aasta kaupa; edasi ainult puuduvad päevad. ERA5T (esialgne) = viimased 90 päeva:
// need laetakse kord nädalas (esmaspäeval) uuesti ja kirjutatakse üle. Viga ei kustuta midagi; järgmine käik proovib uuesti.
import { prisma, authDb, runAsTenant } from '../db';
import { fetchHourly as cdsFetchHourly } from './cdsClient';
import { hourlyToDaily, tallinnDate } from './daily';
import { addDays } from './summary';
import { bindWeatherPoints } from './points';
import type { HourlyWeather } from './types';

export const WEATHER_START = '2015-01-01';
export const PROVISIONAL_DAYS = 90;
export const FAIL_WARN = 3;
const MIN_HOURS_BETWEEN_RUNS = 20;
const CHECK_INTERVAL_MS = 60 * 60_000;
const MAX_ERROR_LEN = 500;

export type LoaderDeps = {
  now: () => Date;
  fetchHourly: (cell: { lat: number; lon: number }, from: string, to: string) => Promise<HourlyWeather[]>;
};
export const defaultLoaderDeps: LoaderDeps = { now: () => new Date(), fetchHourly: (c, f, t) => cdsFetchHourly(c, f, t) };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);

/** [from, to] tükeldatud kalendriaastate kaupa. */
function yearChunks(from: string, to: string): [string, string][] {
  const out: [string, string][] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    const a = y === Number(from.slice(0, 4)) ? from : `${y}-01-01`;
    const b = y === Number(to.slice(0, 4)) ? to : `${y}-12-31`;
    if (a <= b) out.push([a, b]);
  }
  return out;
}

export async function loadPoint(pointId: number, deps: LoaderDeps = defaultLoaderDeps, opts: { refreshRecent?: boolean } = {}): Promise<{ days: number }> {
  const p = await prisma.weatherPoint.findUniqueOrThrow({ where: { id: pointId } });
  const now = deps.now();
  const yesterday = addDays(tallinnDate(now), -1);
  const provisionalFrom = addDays(tallinnDate(now), -PROVISIONAL_DAYS);
  const loadedUntil = iso(p.loadedUntil);
  let from = loadedUntil ? addDays(loadedUntil, 1) : WEATHER_START;
  if (opts.refreshRecent && loadedUntil) from = provisionalFrom < WEATHER_START ? WEATHER_START : provisionalFrom;
  if (from > yesterday) return { days: 0 };

  await prisma.weatherPoint.update({ where: { id: pointId }, data: { lastAttemptAt: now } });
  let total = 0;
  try {
    for (const [a, b] of yearChunks(from, yesterday)) {
      const days = hourlyToDaily(await deps.fetchHourly({ lat: p.lat, lon: p.lon }, a, b)).filter((d) => d.date >= a && d.date <= b);
      if (days.length === 0) {
        if (!loadedUntil && total === 0) {
          await prisma.weatherPoint.update({ where: { id: pointId }, data: { hasData: false, lastSuccessAt: now, failCount: 0, lastError: null } });
          return { days: 0 };
        }
        continue; // CDS-is pole veel neid päevi (viide)
      }
      const last = days[days.length - 1].date;
      await prisma.$transaction([
        prisma.weatherDaily.deleteMany({ where: { pointId, date: { gte: asDate(days[0].date), lte: asDate(last) } } }),
        prisma.weatherDaily.createMany({
          data: days.map((d) => ({ pointId, ...d, date: asDate(d.date), isFinal: d.date < provisionalFrom }))
        }),
        prisma.weatherPoint.update({
          where: { id: pointId },
          data: {
            hasData: true,
            loadedFrom: p.loadedFrom ?? asDate(days[0].date),
            ...(loadedUntil === null || last > loadedUntil ? { loadedUntil: asDate(last) } : {}),
            finalUntil: asDate(addDays(provisionalFrom, -1) < last ? addDays(provisionalFrom, -1) : last)
          }
        })
      ]);
      total += days.length;
    }
    await prisma.weatherPoint.update({ where: { id: pointId }, data: { lastSuccessAt: now, failCount: 0, lastError: null } });
    return { days: total };
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LEN);
    await prisma.weatherPoint.update({ where: { id: pointId }, data: { lastError: msg, failCount: { increment: 1 } } });
    throw err;
  }
}

let running = false;

/** Kõigi WEATHER mooduliga ettevõtete hooajad seotakse punktidega, siis laetakse kõik punktid. */
export async function runWeatherLoad(deps: LoaderDeps = defaultLoaderDeps, opts: { force?: boolean } = {}): Promise<void> {
  if (running) return;
  if (!process.env.CDS_API_KEY && deps === defaultLoaderDeps) { console.warn('weather: CDS_API_KEY puudub, laadimine vahele'); return; }
  running = true;
  try {
    const licenses = await authDb().tenantLicense.findMany({ select: { tenantId: true, modules: true } });
    for (const l of licenses.filter((x) => x.modules.includes('WEATHER'))) {
      try { await runAsTenant(l.tenantId, () => bindWeatherPoints()); } catch (err) { console.error(`weather: bind ${l.tenantId} failed:`, err); }
    }
    const now = deps.now();
    const monday = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Tallinn' })).getDay() === 1;
    const points = await prisma.weatherPoint.findMany({ where: { hasData: { not: false } } });
    for (const p of points) {
      const recent = p.lastSuccessAt && now.getTime() - p.lastSuccessAt.getTime() < MIN_HOURS_BETWEEN_RUNS * 3_600_000;
      if (recent && !opts.force) continue;
      try { await loadPoint(p.id, deps, { refreshRecent: monday || opts.force }); } catch (err) { console.error(`weather: point ${p.id} failed:`, err); }
    }
  } finally {
    running = false;
  }
}

export function startWeatherScheduler(): void {
  const tick = () => {
    const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'Europe/Tallinn', hour: 'numeric', hour12: false }));
    if (hour < 3 || hour > 6) return; // öösel
    runWeatherLoad().catch((err) => console.error('weather load failed:', err));
  };
  setInterval(tick, CHECK_INTERVAL_MS).unref();
}
```

- [ ] **Step 4: Läbib**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather/loader.test.ts'`
Oodatud: PASS.

- [ ] **Step 5: Ajasti ja CLI**

`src/server/prod.ts`: import `import { startWeatherScheduler } from './weather/loader';` ja `server.listen` callbackis `startTripImportScheduler();` järele `startWeatherScheduler();`.

`src/server/tenantCli.ts`: päisekommentaari rida
```ts
//   npm run tenant -- weather:load [--force]  (ilmapunktide sidumine ja laadimine kohe)
```
ja `trips:import` haru järele:
```ts
  if (command === 'weather:load') {
    await runWeatherLoad(undefined, { force: process.argv.includes('--force') });
    console.log('Ilmaandmete laadimine tehtud');
    return;
  }
```
(import `import { runWeatherLoad } from './weather/loader';`; lisa `weather:load` ka kasutusteate loendisse).

- [ ] **Step 6: Tüübikontroll ja commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && git add src/server && git commit -m "feat(ilm): punktide laadimine ja öine ajasti

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

- [ ] **Step 7: Esmalaadimine päris andmetega**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm run build:server && set -a && . ./.env && set +a && nohup node dist-server/tenantCli.js weather:load > ~/weather-load.log 2>&1 &'
```
Kontrolli hiljem:
```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && tail -20 ~/weather-load.log; set -a && . ./.env && set +a && psql "$PLATFORM_DATABASE_URL" -c "select id, lat, lon, \"hasData\", \"loadedUntil\", \"failCount\", left(\"lastError\",80) from weather_points order by id" -c "select \"pointId\", count(*), min(date), max(date), round(avg(\"tMean\")::numeric,1) t, round(sum(\"precipMm\")::numeric/11) mm_aastas from weather_daily group by 1"'
```
Oodatud: 2–4 punkti Loisu jaoks, igaühel ~3950 päeva 2015-01-01 kuni ~5–7 päeva tagasi, keskmine temperatuur ~6 °C, sademeid ~600–750 mm aastas. Kui sademed on ~10× või ~1/1000 sellest — ühikute/deakumuleerimise viga Task 5-s, PARANDA enne edasi minekut.

---

### Task 9: API

**Files:**
- Create: `src/server/weather/weatherApi.ts`
- Test: `src/server/weather/weatherApi.test.ts`
- Modify: `src/server/apiHandler.ts:450` (registreerimine)

**Interfaces:**
- Consumes: `summarizeWeather`, `averageDays`, `calendarPeriod`, `seasonPeriod`, `meanAndSd`, `addDays` (Task 6), `bindWeatherPoints` (Task 7), `tallinnDate`.
- Produces (kõik GET, WEATHER moodul; `point` = `all` või punkti id; `base` = GDD baas, vaikimisi 5):
  - `/api/weather/points` → `{ points: { id, lat, lon, fieldCount, loadedUntil, hasData }[], loading: boolean }`
  - `/api/weather/years?point&base` → `{ years: { year, summary: WeatherSummary }[], normal: WeatherSummary-numbrid keskmisena, sd: { precipMm, gdd, waterBalanceMm, longestDrySpell }, dataUntil }`
  - `/api/weather/months?year&point&base` → `{ months: { month: 4..8, precipMm, gdd, normalPrecipMm, normalGdd }[] }`
  - `/api/weather/cumulative?years=2024,2025&point&base` → `{ series: { year, points: { day: number /*päev 01.04-st*/, gdd, precipMm }[] }[] }`
  - `/api/weather/season/:fieldSeasonId` → `{ summary: WeatherSummary | null, reason: 'NO_SEEDING' | 'NO_POINT' | 'LOADING' | null, gddBaseC }`
  - `/api/weather/seasons?year` → `{ rows: { fieldSeasonId, gdd, precipMm }[] }`
  - `loadDays(pointIds: number[], from: string, to: string): Promise<DailyWeather[]>` (eksport MCP jaoks)
  - `yearsReport(point: 'all' | number, base: number)`, `seasonReport(fieldSeasonId: number)` (eksport MCP jaoks)

- [ ] **Step 1: Failiv test**

```ts
// src/server/weather/weatherApi.test.ts — live-andmebaas: ajutine ettevõte, punkt lat 10.9 sünteetiliste päevadega.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant } from '../db';
import { yearsReport, seasonReport, loadDays } from './weatherApi';
import { addDays } from './summary';

const T = `test-tenant-weatherapi-${process.pid}`;
const run = <R>(fn: () => PromiseLike<R>): Promise<R> => runAsTenant(T, async () => await fn());
let pointId = 0, seeded = 0, unseeded = 0;

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Ilma API test' } });
  pointId = (await prisma.weatherPoint.create({ data: { lat: 10.9, lon: 20.9, hasData: true, loadedUntil: new Date('2016-12-31') } })).id;
  const rows = [];
  for (let d = '2015-01-01'; d <= '2016-12-31'; d = addDays(d, 1)) {
    const wet = d.startsWith('2016'); // 2016 märg
    rows.push({ pointId, date: new Date(`${d}T00:00:00Z`), tMin: 5, tMax: 15, tMean: 10, precipMm: wet ? 4 : 1, potEvapMm: 2, soilMoisture1: 0.3, soilMoisture2: 0.3, isFinal: true });
  }
  await prisma.weatherDaily.createMany({ data: rows });
  await run(async () => {
    const crop = await prisma.crop.create({ data: { id: `c-${process.pid}`, name: 'Mais', gddBaseC: 8 } });
    const f = await prisma.field.create({ data: { num: '1', name: 'A', fieldCode: 'WA' } });
    const g = { type: 'Polygon', coordinates: [[[20.9, 10.9], [20.91, 10.9], [20.91, 10.91], [20.9, 10.9]]] };
    seeded = (await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2016, areaHa: 1, crop: 'Mais', cropId: crop.id, geometry: g, weatherPointId: pointId, seedingDate: new Date('2016-05-01T00:00:00Z'), harvestDate: new Date('2016-05-10T00:00:00Z') } })).id;
    unseeded = (await prisma.fieldSeason.create({ data: { fieldId: f.id, year: 2015, areaHa: 1, crop: 'Mais', geometry: g, weatherPointId: pointId } })).id;
  });
});

afterAll(async () => {
  await authDb().tenant.delete({ where: { id: T } }).catch(() => {});
  await prisma.weatherPoint.deleteMany({ where: { lat: 10.9, lon: 20.9 } });
});

describe('weather API', () => {
  it('loadDays', async () => {
    expect(await loadDays([pointId], '2016-05-01', '2016-05-03')).toHaveLength(3);
  });
  it('aastate tabel ja norm', async () => {
    const r = await run(() => yearsReport('all', 5));
    const y = Object.fromEntries(r.years.map((x) => [x.year, x.summary]));
    expect(y[2015].precipMm).toBe(153);   // 153 päeva × 1 mm (01.04–31.08)
    expect(y[2016].precipMm).toBe(612);
    expect(y[2015].gdd).toBe(765);        // 153 × (10 − 5)
    expect(r.normal.precipMm).toBeCloseTo(382.5, 1);
    expect(r.sd.precipMm).toBeCloseTo(229.5, 1);
  });
  it('põllu hooaeg kultuuri baasiga', async () => {
    const r = await run(() => seasonReport(seeded));
    expect(r.gddBaseC).toBe(8);
    expect(r.summary!.gdd).toBe(20);      // 10 päeva × (10 − 8)
    expect(r.summary!.precipMm).toBe(40);
  });
  it('külvikuupäevata', async () => {
    expect((await run(() => seasonReport(unseeded))).reason).toBe('NO_SEEDING');
  });
});
```

- [ ] **Step 2: Kukub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather/weatherApi.test.ts'`
Oodatud: FAIL.

- [ ] **Step 3: Teostus**

```ts
// src/server/weather/weatherApi.ts — ilmaandmete API (/api/weather/*, v.a radar). Kokkuvõtted arvutatakse päringu ajal.
// Ettevõtte punktid = punktid, millega on seotud ettevõtte hooajad; „all“ = nende päevade keskmine.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma } from '../db';
import { json } from '../http';
import { bindWeatherPoints } from './points';
import { tallinnDate } from './daily';
import { summarizeWeather, averageDays, calendarPeriod, seasonPeriod, meanAndSd } from './summary';
import { WEATHER_START } from './loader';
import type { DailyWeather, WeatherSummary } from './types';

const MONTHS = [4, 5, 6, 7, 8];
const asDate = (s: string) => new Date(`${s}T00:00:00Z`);
const firstYear = Number(WEATHER_START.slice(0, 4));
const r1 = (x: number) => Math.round(x * 10) / 10;

export async function loadDays(pointIds: number[], from: string, to: string): Promise<DailyWeather[]> {
  const rows = await prisma.weatherDaily.findMany({
    where: { pointId: { in: pointIds }, date: { gte: asDate(from), lte: asDate(to) } },
    orderBy: { date: 'asc' }
  });
  const by = new Map<number, DailyWeather[]>();
  for (const r of rows) {
    const d: DailyWeather = { date: r.date.toISOString().slice(0, 10), tMin: r.tMin, tMax: r.tMax, tMean: r.tMean, precipMm: r.precipMm, potEvapMm: r.potEvapMm, soilMoisture1: r.soilMoisture1, soilMoisture2: r.soilMoisture2 };
    (by.get(r.pointId) ?? by.set(r.pointId, []).get(r.pointId)!).push(d);
  }
  return averageDays([...by.values()].length ? [...by.values()] : [[]]);
}

/** Ettevõtte punktid; kui mõni hooaeg on sidumata, seotakse enne. */
async function tenantPointIds(): Promise<number[]> {
  if (await prisma.fieldSeason.count({ where: { weatherPointId: null } })) await bindWeatherPoints();
  const rows = await prisma.fieldSeason.findMany({ where: { weatherPointId: { not: null } }, select: { weatherPointId: true }, distinct: ['weatherPointId'] });
  return rows.map((r) => r.weatherPointId!);
}

async function resolvePoints(point: 'all' | number): Promise<number[]> {
  const ids = await tenantPointIds();
  if (point === 'all') return ids;
  if (!ids.includes(point)) throw Object.assign(new Error('Ilmapunkti ei leitud'), { status: 404 });
  return [point];
}

const NUMERIC: (keyof WeatherSummary)[] = ['gdd', 'precipMm', 'rainDays', 'waterBalanceMm', 'longestDrySpell', 'hotDays', 'frostDays'];

export async function yearsReport(point: 'all' | number, base: number) {
  const ids = await resolvePoints(point);
  const today = tallinnDate(new Date());
  const lastYear = Number(today.slice(0, 4));
  const days = ids.length ? await loadDays(ids, `${firstYear}-01-01`, today) : [];
  const years = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const p = calendarPeriod(y);
    if (p.from > today) break;
    years.push({ year: y, summary: summarizeWeather(days, { ...p, gddBaseC: base }) });
  }
  const full = years.filter((y) => y.summary.complete);
  const normal: Record<string, number | null> = {};
  const sd: Record<string, number | null> = {};
  for (const k of NUMERIC) {
    const vals = full.map((y) => y.summary[k]).filter((v): v is number => typeof v === 'number');
    const m = meanAndSd(vals);
    normal[k] = vals.length ? r1(m.mean) : null;
    sd[k] = vals.length ? r1(m.sd) : null;
  }
  return { years, normal, sd, normalYears: full.map((y) => y.year), dataUntil: days.length ? days[days.length - 1].date : null };
}

export async function monthsReport(year: number, point: 'all' | number, base: number) {
  const ids = await resolvePoints(point);
  const days = ids.length ? await loadDays(ids, `${firstYear}-01-01`, tallinnDate(new Date())) : [];
  const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const monthOf = (y: number, m: number) => summarizeWeather(days, { from: `${y}-${String(m).padStart(2, '0')}-01`, to: lastDay(y, m), gddBaseC: base });
  return {
    months: MONTHS.map((m) => {
      const cur = monthOf(year, m);
      const past = [];
      for (let y = firstYear; y < Number(tallinnDate(new Date()).slice(0, 4)); y++) { const s = monthOf(y, m); if (s.complete) past.push(s); }
      return {
        month: m, precipMm: cur.days ? cur.precipMm : null, gdd: cur.days ? cur.gdd : null,
        normalPrecipMm: past.length ? r1(meanAndSd(past.map((s) => s.precipMm)).mean) : null,
        normalGdd: past.length ? r1(meanAndSd(past.map((s) => s.gdd)).mean) : null
      };
    })
  };
}

export async function cumulativeReport(years: number[], point: 'all' | number, base: number) {
  const ids = await resolvePoints(point);
  const series = [];
  for (const y of years) {
    const p = calendarPeriod(y);
    const days = ids.length ? await loadDays(ids, p.from, p.to) : [];
    let gdd = 0, precip = 0;
    series.push({
      year: y,
      points: days.map((d) => {
        gdd += Math.max(0, d.tMean - base); precip += d.precipMm;
        return { day: Math.round((Date.parse(d.date) - Date.parse(p.from)) / 86_400_000), gdd: r1(gdd), precipMm: r1(precip) };
      })
    });
  }
  return { series };
}

export async function seasonReport(fieldSeasonId: number) {
  const s = await prisma.fieldSeason.findUniqueOrThrow({
    where: { id: fieldSeasonId },
    select: { seedingDate: true, harvestDate: true, weatherPointId: true, weatherPoint: { select: { loadedUntil: true } }, cropEntity: { select: { gddBaseC: true } } }
  });
  const gddBaseC = s.cropEntity?.gddBaseC ?? 5;
  const period = seasonPeriod(s, tallinnDate(new Date()));
  if (!period) return { summary: null, reason: 'NO_SEEDING' as const, gddBaseC };
  if (!s.weatherPointId) return { summary: null, reason: 'NO_POINT' as const, gddBaseC };
  if (!s.weatherPoint?.loadedUntil) return { summary: null, reason: 'LOADING' as const, gddBaseC };
  const days = await loadDays([s.weatherPointId], period.from, period.to);
  return { summary: summarizeWeather(days, { ...period, gddBaseC }), reason: null, gddBaseC };
}

export async function seasonsReport(year: number) {
  const rows = await prisma.fieldSeason.findMany({ where: { year, seedingDate: { not: null } }, select: { id: true } });
  const out = [];
  for (const r of rows) {
    const rep = await seasonReport(r.id);
    if (rep.summary) out.push({ fieldSeasonId: r.id, gdd: rep.summary.gdd, precipMm: rep.summary.precipMm });
  }
  return { rows: out };
}

async function pointsReport() {
  const ids = await tenantPointIds();
  const points = await prisma.weatherPoint.findMany({ where: { id: { in: ids } }, orderBy: [{ lat: 'desc' }, { lon: 'asc' }] });
  const counts = await prisma.fieldSeason.groupBy({ by: ['weatherPointId'], where: { weatherPointId: { in: ids } }, _count: { _all: true } });
  const cnt = new Map(counts.map((c) => [c.weatherPointId, c._count._all]));
  return {
    points: points.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, hasData: p.hasData, loadedUntil: p.loadedUntil?.toISOString().slice(0, 10) ?? null, fieldCount: cnt.get(p.id) ?? 0 })),
    loading: points.some((p) => p.hasData !== false && !p.loadedUntil)
  };
}

const parsePoint = (v: string | null): 'all' | number => (v && v !== 'all' && Number.isInteger(Number(v)) ? Number(v) : 'all');
const parseBase = (v: string | null): number => { const n = Number(v); return v !== null && Number.isFinite(n) && n >= 0 && n <= 15 ? n : 5; };
const parseYear = (v: string | null): number | null => (v && /^\d{4}$/.test(v) ? Number(v) : null);
const SEASON_ROUTE = /^\/api\/weather\/season\/(\d+)$/;

export async function handleWeather(_req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL): Promise<boolean> {
  if (!pathname.startsWith('/api/weather/') || pathname.startsWith('/api/weather/radar') || method !== 'GET') return false;
  const q = url.searchParams;
  try {
    if (pathname === '/api/weather/points') return json(res, await pointsReport()), true;
    if (pathname === '/api/weather/years') return json(res, await yearsReport(parsePoint(q.get('point')), parseBase(q.get('base')))), true;
    if (pathname === '/api/weather/months') {
      const y = parseYear(q.get('year'));
      if (!y) return json(res, { error: 'Aasta puudub' }, 400), true;
      return json(res, await monthsReport(y, parsePoint(q.get('point')), parseBase(q.get('base')))), true;
    }
    if (pathname === '/api/weather/cumulative') {
      const years = (q.get('years') ?? '').split(',').map(parseYear).filter((y): y is number => y !== null).slice(0, 12);
      return json(res, await cumulativeReport(years, parsePoint(q.get('point')), parseBase(q.get('base')))), true;
    }
    if (pathname === '/api/weather/seasons') {
      const y = parseYear(q.get('year'));
      if (!y) return json(res, { error: 'Aasta puudub' }, 400), true;
      return json(res, await seasonsReport(y)), true;
    }
    const m = SEASON_ROUTE.exec(pathname);
    if (m) {
      const exists = await prisma.fieldSeason.count({ where: { id: Number(m[1]) } });
      if (!exists) return json(res, { error: 'Hooaega ei leitud' }, 404), true;
      return json(res, await seasonReport(Number(m[1]))), true;
    }
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return json(res, { error: (err as Error).message }, 404), true;
    throw err;
  }
  return false;
}
```

`src/server/apiHandler.ts`: import `import { handleWeather } from './weather/weatherApi.ts';` ja rea `if (await handleTrips(...)) return;` järele:
```ts
    if (await handleWeather(req, res, pathname, method, url)) return;
```
(Radar jääb olemasolevate `/api/weather/radar*` harude kätte, sest `handleWeather` neid ei puuduta.)

- [ ] **Step 4: Läbib**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/weather && npx tsc --noEmit -p tsconfig.app.json'`
Oodatud: PASS, tüübivigu pole.

- [ ] **Step 5: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server && git commit -m "feat(ilm): API aastate, kuude, kumulatiivse ja põllu hooaja kokkuvõttega

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 10: Kliendi tüübid ja API klient

**Files:**
- Create: `src/types/weather.ts`
- Modify: `src/services/api.ts` (pärast `getWeatherRadar`)

**Interfaces:**
- Produces: tüübid `WeatherSummary`, `WeatherPointInfo`, `WeatherYears`, `WeatherMonth`, `WeatherCumulativeSeries`, `WeatherSeasonReport`; `api.getWeatherPoints()`, `api.getWeatherYears(point, base)`, `api.getWeatherMonths(year, point, base)`, `api.getWeatherCumulative(years, point, base)`, `api.getWeatherSeason(fieldSeasonId)`, `api.getWeatherSeasons(year)`.

- [ ] **Step 1: Tüübid**

```ts
// src/types/weather.ts — ilmaandmete (ERA5-Land) kliendi tüübid; vastavad src/server/weather/weatherApi.ts vastustele.
export interface WeatherSummary {
  from: string; to: string; days: number;
  gdd: number; precipMm: number; rainDays: number; waterBalanceMm: number | null;
  longestDrySpell: number; hotDays: number; frostDays: number;
  soilMoistureAvg: number | null; soilMoistureMin: number | null;
  dataUntil: string | null; complete: boolean;
}
export type WeatherPointRef = 'all' | number;
export interface WeatherPointInfo { id: number; lat: number; lon: number; hasData: boolean | null; loadedUntil: string | null; fieldCount: number }
export type WeatherNumericKey = 'gdd' | 'precipMm' | 'rainDays' | 'waterBalanceMm' | 'longestDrySpell' | 'hotDays' | 'frostDays';
export interface WeatherYears {
  years: { year: number; summary: WeatherSummary }[];
  normal: Partial<Record<WeatherNumericKey, number | null>>;
  sd: Partial<Record<WeatherNumericKey, number | null>>;
  normalYears: number[];
  dataUntil: string | null;
}
export interface WeatherMonth { month: number; precipMm: number | null; gdd: number | null; normalPrecipMm: number | null; normalGdd: number | null }
export interface WeatherCumulativeSeries { year: number; points: { day: number; gdd: number; precipMm: number }[] }
export interface WeatherSeasonReport { summary: WeatherSummary | null; reason: 'NO_SEEDING' | 'NO_POINT' | 'LOADING' | null; gddBaseC: number }
```

- [ ] **Step 2: Klient**

`src/services/api.ts` — import tüübid faili algusesse ja `api` objekti `getWeatherRadar` järele:
```ts
  async getWeatherPoints(): Promise<{ points: WeatherPointInfo[]; loading: boolean }> {
    const res = await apiFetch('/api/weather/points');
    if (!res.ok) throw new Error(await errorMessage(res, 'Ilmapunktid pole saadaval'));
    return res.json();
  },

  async getWeatherYears(point: WeatherPointRef, base: number): Promise<WeatherYears> {
    const res = await apiFetch(`/api/weather/years?${new URLSearchParams({ point: String(point), base: String(base) })}`);
    if (!res.ok) throw new Error(await errorMessage(res, 'Ilmaandmed pole saadaval'));
    return res.json();
  },

  async getWeatherMonths(year: number, point: WeatherPointRef, base: number): Promise<WeatherMonth[]> {
    const res = await apiFetch(`/api/weather/months?${new URLSearchParams({ year: String(year), point: String(point), base: String(base) })}`);
    if (!res.ok) throw new Error(await errorMessage(res, 'Ilmaandmed pole saadaval'));
    return (await res.json()).months;
  },

  async getWeatherCumulative(years: number[], point: WeatherPointRef, base: number): Promise<WeatherCumulativeSeries[]> {
    const res = await apiFetch(`/api/weather/cumulative?${new URLSearchParams({ years: years.join(','), point: String(point), base: String(base) })}`);
    if (!res.ok) throw new Error(await errorMessage(res, 'Ilmaandmed pole saadaval'));
    return (await res.json()).series;
  },

  async getWeatherSeason(fieldSeasonId: number): Promise<WeatherSeasonReport> {
    const res = await apiFetch(`/api/weather/season/${fieldSeasonId}`);
    if (!res.ok) throw new Error(await errorMessage(res, 'Ilmakokkuvõte pole saadaval'));
    return res.json();
  },

  async getWeatherSeasons(year: number): Promise<{ fieldSeasonId: number; gdd: number; precipMm: number }[]> {
    const res = await apiFetch(`/api/weather/seasons?year=${year}`);
    if (!res.ok) throw new Error(await errorMessage(res, 'Ilmakokkuvõte pole saadaval'));
    return (await res.json()).rows;
  },
```

- [ ] **Step 3: Tüübikontroll ja commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && git add src/types/weather.ts src/services/api.ts && git commit -m "feat(ilm): kliendi tüübid ja API klient

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 11: Vaade „Ilm“

**Files:**
- Create: `src/components/WeatherView.tsx`, `src/components/WeatherCharts.tsx`, `src/services/weatherFormat.ts`
- Test: `src/services/weatherFormat.test.ts`
- Modify: `src/components/Header.tsx` (`MAIN_VIEWS`, menüünupp), `src/App.tsx` (vaate renderdus), `src/App.css`

**Interfaces:**
- Consumes: Task 10 klient ja tüübid; `FilterClear`, `FilterSelect` (vaata nende propse failides `src/components/FilterClear.tsx`, `src/components/FilterSelect.tsx`); `formatDate`.
- Produces: `MainView` väärtus `'weather'`; `deviation(value, mean, sd, kind): 'wet' | 'dry' | 'warm' | 'cool' | null`; `fmt1(n): string`.

- [ ] **Step 1: Failiv test (esiletõst ja vorming)**

```ts
// src/services/weatherFormat.test.ts
import { describe, it, expect } from 'vitest';
import { deviation, fmt1 } from './weatherFormat';

describe('deviation', () => {
  it('sademed üle +1 sd → märg, alla −1 sd → kuiv', () => {
    expect(deviation(500, 400, 50, 'precip')).toBe('wet');
    expect(deviation(340, 400, 50, 'precip')).toBe('dry');
    expect(deviation(420, 400, 50, 'precip')).toBeNull();
  });
  it('GDD → soe/jahe', () => {
    expect(deviation(1300, 1100, 100, 'gdd')).toBe('warm');
    expect(deviation(950, 1100, 100, 'gdd')).toBe('cool');
  });
  it('sd 0 või puuduv → null', () => {
    expect(deviation(5, 5, 0, 'gdd')).toBeNull();
    expect(deviation(null, 5, 1, 'gdd')).toBeNull();
  });
});

describe('fmt1', () => {
  it('eesti vormingus üks komakoht', () => {
    expect(fmt1(1234.56)).toBe('1 234,6');
    expect(fmt1(null)).toBe('—');
  });
});
```

- [ ] **Step 2: Kukub, siis teostus**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/services/weatherFormat.test.ts'` → FAIL.

```ts
// src/services/weatherFormat.ts — ilmanäitajate vorming ja keskmisest erinevuse tuvastus (±1 standardhälve).
export type DeviationKind = 'precip' | 'gdd';
export type Deviation = 'wet' | 'dry' | 'warm' | 'cool' | null;

export function deviation(value: number | null | undefined, mean: number | null | undefined, sd: number | null | undefined, kind: DeviationKind): Deviation {
  if (value == null || mean == null || !sd) return null;
  if (value > mean + sd) return kind === 'precip' ? 'wet' : 'warm';
  if (value < mean - sd) return kind === 'precip' ? 'dry' : 'cool';
  return null;
}

export const fmt1 = (n: number | null | undefined): string =>
  n == null ? '—' : n.toLocaleString('et-EE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const fmt0 = (n: number | null | undefined): string => (n == null ? '—' : Math.round(n).toLocaleString('et-EE'));

export const WEATHER_SOURCE = 'Allikas: Copernicus Climate Change Service, ERA5-Land';
export const MONTH_NAMES: Record<number, string> = { 4: 'aprill', 5: 'mai', 6: 'juuni', 7: 'juuli', 8: 'august' };
```

Run uuesti → PASS. (Kui `toLocaleString` annab tavalise tühiku asemel kitsa tühiku ` `, kohanda testi ootust selle järgi, mida Node `et-EE` tegelikult annab — kontrolli `node -e "console.log(JSON.stringify((1234.5).toLocaleString('et-EE')))"`.)

- [ ] **Step 3: Graafikud**

```tsx
// src/components/WeatherCharts.tsx — ilmavaate SVG graafikud: kuude tulbad (aasta vs keskmine) ja kumulatiivsed jooned.
import React from 'react';
import type { WeatherMonth, WeatherCumulativeSeries } from '../types/weather';
import { MONTH_NAMES, fmt0 } from '../services/weatherFormat';

const W = 560, H = 220, M = { top: 12, right: 12, bottom: 28, left: 44 };
const niceTop = (max: number) => {
  if (max <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / pow) * pow;
};

export const MonthBars: React.FC<{ months: WeatherMonth[]; metric: 'precipMm' | 'gdd'; unit: string; year: number }> = ({ months, metric, unit, year }) => {
  const normalKey = metric === 'precipMm' ? 'normalPrecipMm' : 'normalGdd';
  const top = niceTop(Math.max(...months.flatMap((m) => [m[metric] ?? 0, m[normalKey] ?? 0])));
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const slot = iw / months.length, bw = slot * 0.32;
  const y = (v: number) => M.top + ih - (v / top) * ih;
  return (
    <svg className="weather-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metric === 'precipMm' ? 'Sademed' : 'Temperatuurisumma'} kuude kaupa`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={M.left} x2={W - M.right} y1={y(top * f)} y2={y(top * f)} className="weather-grid" />
          <text x={M.left - 6} y={y(top * f) + 4} textAnchor="end" className="weather-axis">{fmt0(top * f)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const x = M.left + i * slot + slot / 2;
        const v = m[metric], n = m[normalKey];
        return (
          <g key={m.month}>
            {v != null && <rect x={x - bw - 1} y={y(v)} width={bw} height={y(0) - y(v)} className="weather-bar-year"><title>{`${MONTH_NAMES[m.month]} ${year}: ${fmt0(v)} ${unit}`}</title></rect>}
            {n != null && <rect x={x + 1} y={y(n)} width={bw} height={y(0) - y(n)} className="weather-bar-normal"><title>{`${MONTH_NAMES[m.month]} keskmine: ${fmt0(n)} ${unit}`}</title></rect>}
            <text x={x} y={H - 8} textAnchor="middle" className="weather-axis">{MONTH_NAMES[m.month]}</text>
          </g>
        );
      })}
    </svg>
  );
};

export const CumulativeLines: React.FC<{ series: WeatherCumulativeSeries[]; metric: 'gdd' | 'precipMm'; unit: string }> = ({ series, metric, unit }) => {
  const maxDay = 152; // 01.04–31.08
  const top = niceTop(Math.max(0, ...series.flatMap((s) => s.points.map((p) => p[metric]))));
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const x = (d: number) => M.left + (d / maxDay) * iw;
  const y = (v: number) => M.top + ih - (v / top) * ih;
  const ticks = [{ d: 0, l: '1. apr' }, { d: 30, l: '1. mai' }, { d: 61, l: '1. juuni' }, { d: 91, l: '1. juuli' }, { d: 122, l: '1. aug' }];
  return (
    <svg className="weather-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={metric === 'gdd' ? 'Temperatuurisumma kasv' : 'Sademete kasv'}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={M.left} x2={W - M.right} y1={y(top * f)} y2={y(top * f)} className="weather-grid" />
          <text x={M.left - 6} y={y(top * f) + 4} textAnchor="end" className="weather-axis">{fmt0(top * f)}</text>
        </g>
      ))}
      {ticks.map((t) => <text key={t.d} x={x(t.d)} y={H - 8} textAnchor="middle" className="weather-axis">{t.l}</text>)}
      {series.map((s, i) => (
        <polyline key={s.year} fill="none" className={`weather-line weather-line-${i % 6}`}
          points={s.points.map((p) => `${x(p.day)},${y(p[metric])}`).join(' ')}>
          <title>{`${s.year}: ${fmt0(s.points[s.points.length - 1]?.[metric] ?? 0)} ${unit}`}</title>
        </polyline>
      ))}
    </svg>
  );
};
```

- [ ] **Step 4: Vaade**

```tsx
// src/components/WeatherView.tsx — majandi ilmavaade: aastate võrdlus (01.04–31.08), kuude jaotus ja kumulatiivne graafik.
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { WeatherPointInfo, WeatherYears, WeatherMonth, WeatherCumulativeSeries, WeatherPointRef } from '../types/weather';
import { deviation, fmt0, fmt1, WEATHER_SOURCE } from '../services/weatherFormat';
import { formatDate } from '../services/dateFormat';
import { FilterClear } from './FilterClear';
import { MonthBars, CumulativeLines } from './WeatherCharts';

const BASES = [0, 5, 6, 8, 10];

export const WeatherView: React.FC = () => {
  const [points, setPoints] = useState<WeatherPointInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [point, setPoint] = useState<WeatherPointRef>('all');
  const [base, setBase] = useState(5);
  const [data, setData] = useState<WeatherYears | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [months, setMonths] = useState<WeatherMonth[]>([]);
  const [compare, setCompare] = useState<number[]>([]);
  const [series, setSeries] = useState<WeatherCumulativeSeries[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.getWeatherPoints().then((r) => { setPoints(r.points); setLoading(r.loading); }).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    api.getWeatherYears(point, base).then((r) => {
      setData(r);
      const last = r.years[r.years.length - 1]?.year ?? null;
      setYear((y) => y ?? last);
      setCompare((c) => (c.length ? c : r.years.slice(-3).map((x) => x.year)));
    }).catch((e) => setError(e.message));
  }, [point, base]);
  useEffect(() => { if (year) api.getWeatherMonths(year, point, base).then(setMonths).catch((e) => setError(e.message)); }, [year, point, base]);
  useEffect(() => { if (compare.length) api.getWeatherCumulative(compare, point, base).then(setSeries).catch((e) => setError(e.message)); else setSeries([]); }, [compare, point, base]);

  const rows = useMemo(() => [...(data?.years ?? [])].reverse(), [data]);
  const toggleCompare = (y: number) => setCompare((c) => (c.includes(y) ? c.filter((x) => x !== y) : [...c, y].sort()));

  return (
    <div className="weather-view page-view">
      <div className="weather-toolbar">
        <h2>Ilm</h2>
        <FilterClear active={point !== 'all'} onClear={() => setPoint('all')}>
          <select value={String(point)} onChange={(e) => setPoint(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="Ilmapunkt">
            <option value="all">Majandi keskmine</option>
            {points.map((p) => <option key={p.id} value={p.id}>{`${p.lat.toFixed(1)}° N, ${p.lon.toFixed(1)}° E (${p.fieldCount} põldu)`}</option>)}
          </select>
        </FilterClear>
        <FilterClear active={base !== 5} onClear={() => setBase(5)}>
          <select value={base} onChange={(e) => setBase(Number(e.target.value))} aria-label="GDD baastemperatuur">
            {BASES.map((b) => <option key={b} value={b}>{`GDD baas ${b} °C`}</option>)}
          </select>
        </FilterClear>
      </div>

      {error && <div className="alert-box error">{error}</div>}
      {loading && <div className="alert-box info">Ilmaandmeid laetakse — esmalaadimine võtab kuni mõne tunni.</div>}

      <section className="weather-section">
        <h3>Aastad (01.04–31.08)</h3>
        <div className="table-scroll">
          <table className="data-table weather-years">
            <thead>
              <tr>
                <th>Aasta</th>
                <th className="num-col">Sademed, mm</th>
                <th className="num-col">GDD, °C</th>
                <th className="num-col">Veebilanss, mm</th>
                <th className="num-col">Pikim kuiv periood, p</th>
                <th className="num-col">Kuumapäevi</th>
                <th className="num-col">Öökülmi (apr–juuni)</th>
                <th>Võrdle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ year: y, summary: s }) => (
                <tr key={y} className={y === year ? 'selected' : ''} onClick={() => setYear(y)}>
                  <td>{y}{!s.complete && <span className="hint"> (kuni {formatDate(s.dataUntil)})</span>}</td>
                  <td className={`num weather-${deviation(s.precipMm, data?.normal.precipMm, data?.sd.precipMm, 'precip') ?? 'normal'}`}>{fmt0(s.precipMm)}</td>
                  <td className={`num weather-${deviation(s.gdd, data?.normal.gdd, data?.sd.gdd, 'gdd') ?? 'normal'}`}>{fmt0(s.gdd)}</td>
                  <td className={`num weather-${deviation(s.waterBalanceMm, data?.normal.waterBalanceMm, data?.sd.waterBalanceMm, 'precip') ?? 'normal'}`}>{fmt0(s.waterBalanceMm)}</td>
                  <td className="num">{s.longestDrySpell}</td>
                  <td className="num">{s.hotDays}</td>
                  <td className="num">{s.frostDays}</td>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={compare.includes(y)} onChange={() => toggleCompare(y)} aria-label={`Võrdle ${y}`} /></td>
                </tr>
              ))}
              {data && data.normalYears.length > 0 && (
                <tr className="weather-normal-row">
                  <td>Keskmine {data.normalYears[0]}–{data.normalYears[data.normalYears.length - 1]}</td>
                  <td className="num">{fmt0(data.normal.precipMm)}</td>
                  <td className="num">{fmt0(data.normal.gdd)}</td>
                  <td className="num">{fmt0(data.normal.waterBalanceMm)}</td>
                  <td className="num">{fmt1(data.normal.longestDrySpell)}</td>
                  <td className="num">{fmt1(data.normal.hotDays)}</td>
                  <td className="num">{fmt1(data.normal.frostDays)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="hint">Värviga on märgitud aastad, mis erinevad keskmisest rohkem kui ühe standardhälbe võrra: sinine = märg, oranž = kuiv, punane = soe, helesinine = jahe.</p>
      </section>

      {year && months.length > 0 && (
        <section className="weather-section weather-charts">
          <h3>{year} kuude kaupa</h3>
          <div className="weather-chart-grid">
            <div><h4>Sademed, mm</h4><MonthBars months={months} metric="precipMm" unit="mm" year={year} /></div>
            <div><h4>Temperatuurisumma, °C</h4><MonthBars months={months} metric="gdd" unit="°C" year={year} /></div>
          </div>
          <p className="hint"><span className="legend weather-bar-year" /> {year} <span className="legend weather-bar-normal" /> keskmine</p>
        </section>
      )}

      {series.length > 0 && (
        <section className="weather-section weather-charts">
          <h3>Kasv hooaja jooksul</h3>
          <div className="weather-chart-grid">
            <div><h4>Temperatuurisumma, °C</h4><CumulativeLines series={series} metric="gdd" unit="°C" /></div>
            <div><h4>Sademed, mm</h4><CumulativeLines series={series} metric="precipMm" unit="mm" /></div>
          </div>
          <p className="hint">{series.map((s, i) => <span key={s.year}><span className={`legend weather-line-${i % 6}`} /> {s.year} </span>)}</p>
        </section>
      )}

      <footer className="weather-source">{WEATHER_SOURCE}.{data?.dataUntil && ` Andmed kuni ${formatDate(data.dataUntil)}.`}</footer>
    </div>
  );
};
```

Kohanda `FilterClear` kasutus täpselt selle komponendi propside järgi (vaata faili `src/components/FilterClear.tsx` ja mõnd olemasolevat kasutust, nt `src/components/TripRegister.tsx`) — ülal olev `active`/`onClear` on eeldus.

- [ ] **Step 5: Menüü ja App**

`src/components/Header.tsx`:
- `MAIN_VIEWS` lõppu `'weather'`.
- Propsidesse `showWeather?: boolean`.
- „Hooajad“ nupu **ette** (Hooajad jääb viimaseks, vt commit 0bbf115):
```tsx
            {showWeather && (
              <button
                type="button"
                className={mainView === 'weather' ? 'active' : ''}
                aria-current={mainView === 'weather' ? 'page' : undefined}
                onClick={() => onChangeMainView('weather')}
              >
                <CloudSun size={15} />
                <span>Ilm</span>
              </button>
            )}
```
(`CloudSun` import `lucide-react`-ist.)

`src/App.tsx`:
- `const WeatherView = lazy(() => import('./components/WeatherView').then((m) => ({ default: m.WeatherView })));` (sama muster nagu teistel lazy vaadetel failis).
- `<Header ... showWeather={hasModule(user, 'WEATHER')} />`
- `mainView === 'stock'` ploki järele:
```tsx
      {mainView === 'weather' && hasModule(user, 'WEATHER') && (
        <Suspense fallback={null}>
          <WeatherView />
        </Suspense>
      )}
```

`src/App.css` lõppu:
```css
/* Ilm */
.weather-view { padding: 16px; display: flex; flex-direction: column; gap: 16px; overflow: auto; }
.weather-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.weather-toolbar h2 { margin: 0 auto 0 0; }
.weather-years tbody tr { cursor: pointer; }
.weather-years tbody tr.selected { background: var(--surface-selected, rgba(59, 130, 246, 0.08)); }
.weather-normal-row td { font-weight: 600; border-top: 2px solid var(--border, #e5e7eb); }
.weather-wet { background: rgba(59, 130, 246, 0.16); }
.weather-dry { background: rgba(249, 115, 22, 0.18); }
.weather-warm { background: rgba(239, 68, 68, 0.16); }
.weather-cool { background: rgba(14, 165, 233, 0.12); }
.weather-chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
.weather-chart { width: 100%; height: auto; }
.weather-grid { stroke: var(--border, #e5e7eb); stroke-width: 1; }
.weather-axis { font-size: 11px; fill: var(--text-muted, #6b7280); }
.weather-bar-year { fill: #2563eb; background: #2563eb; }
.weather-bar-normal { fill: #cbd5e1; background: #cbd5e1; }
.weather-line { stroke-width: 2; }
.weather-line-0 { stroke: #2563eb; background: #2563eb; }
.weather-line-1 { stroke: #16a34a; background: #16a34a; }
.weather-line-2 { stroke: #ea580c; background: #ea580c; }
.weather-line-3 { stroke: #9333ea; background: #9333ea; }
.weather-line-4 { stroke: #0891b2; background: #0891b2; }
.weather-line-5 { stroke: #64748b; background: #64748b; }
.legend { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: middle; }
.weather-source { font-size: 12px; color: var(--text-muted, #6b7280); }
.weather-season { margin-top: 12px; }
.weather-season dl { display: grid; grid-template-columns: auto auto; gap: 4px 16px; margin: 0; }
.weather-season dd { margin: 0; text-align: right; }
```
(Kasuta failis juba defineeritud CSS-muutujate nimesid, kui need erinevad.)

- [ ] **Step 6: Kontroll brauseris**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/services/weatherFormat.test.ts'
```
Seejärel `npm run release` ja ava teris.ee → „Ilm“: tabelis 2015–2026, keskmise rida, värvid; aasta klõps muudab kuude graafikuid; linnukesed muudavad kumulatiivset graafikut; punkti/baasi filtril on X.

- [ ] **Step 7: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src && git commit -m "feat(ilm): vaade Ilm aastate võrdluse ja graafikutega

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 12: Põllu hooaja plokk ja tabeli veerud

**Files:**
- Create: `src/components/WeatherSeasonSection.tsx`
- Modify: `src/components/FieldEditDialog.tsx:630` (ploki lisamine `SoilSamplesSection` järele), `src/components/FieldsTableView.tsx` (veerud), `src/App.tsx` (prop `weatherEnabled`)

**Interfaces:**
- Consumes: `api.getWeatherSeason`, `api.getWeatherSeasons`, `fmt0`, `WEATHER_SOURCE`, `formatDate`.
- Produces: `WeatherSeasonSection` props `{ fieldSeasonId: number | undefined; actualYieldTonsHa?: number | null; onEditSeeding?: () => void }`.

- [ ] **Step 1: Plokk**

```tsx
// src/components/WeatherSeasonSection.tsx — põllu hooaja ilmakokkuvõte külvist koristuseni (või tänaseni) saagikuse kõrval.
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { WeatherSeasonReport } from '../types/weather';
import { fmt0, fmt1, WEATHER_SOURCE } from '../services/weatherFormat';
import { formatDate } from '../services/dateFormat';

export const WeatherSeasonSection: React.FC<{ fieldSeasonId: number | undefined; actualYieldTonsHa?: number | null; onEditSeeding?: () => void }> = ({ fieldSeasonId, actualYieldTonsHa, onEditSeeding }) => {
  const [rep, setRep] = useState<WeatherSeasonReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRep(null);
    if (fieldSeasonId) api.getWeatherSeason(fieldSeasonId).then(setRep).catch((e) => setError(e.message));
  }, [fieldSeasonId]);
  if (!fieldSeasonId) return null;
  return (
    <section className="weather-season">
      <h4>Ilm külvist {rep?.summary?.to && rep.summary.complete && rep.summary.dataUntil === rep.summary.to ? 'koristuseni' : 'tänaseni'}</h4>
      {error && <p className="hint">{error}</p>}
      {rep?.reason === 'NO_SEEDING' && (
        <p className="hint">Ilmakokkuvõte vajab külvikuupäeva.{onEditSeeding && <> <button type="button" className="link-button" onClick={onEditSeeding}>Sisesta külvikuupäev</button></>}</p>
      )}
      {rep?.reason === 'LOADING' && <p className="hint">Ilmaandmeid laetakse.</p>}
      {rep?.reason === 'NO_POINT' && <p className="hint">Põllul pole kuju, ilma ei saa siduda.</p>}
      {rep?.summary && (
        <>
          <dl>
            <dt>Periood</dt><dd>{formatDate(rep.summary.from)} – {formatDate(rep.summary.to)}</dd>
            <dt>Temperatuurisumma (baas {rep.gddBaseC} °C)</dt><dd className="num">{fmt0(rep.summary.gdd)} °C</dd>
            <dt>Sademed</dt><dd className="num">{fmt0(rep.summary.precipMm)} mm</dd>
            <dt>Veebilanss</dt><dd className="num">{fmt0(rep.summary.waterBalanceMm)} mm</dd>
            <dt>Pikim kuiv periood</dt><dd className="num">{rep.summary.longestDrySpell} p</dd>
            <dt>Öökülmi 60 päeva jooksul pärast külvi</dt><dd className="num">{rep.summary.frostDays}</dd>
            {actualYieldTonsHa != null && <><dt>Saak</dt><dd className="num">{fmt1(actualYieldTonsHa)} t/ha</dd></>}
          </dl>
          <p className="hint">{!rep.summary.complete && rep.summary.dataUntil && `Andmed kuni ${formatDate(rep.summary.dataUntil)}. `}{WEATHER_SOURCE}.</p>
        </>
      )}
    </section>
  );
};
```

- [ ] **Step 2: FieldEditDialog**

`src/components/FieldEditDialog.tsx`: props `weatherEnabled?: boolean`; rea 630 (`<SoilSamplesSection .../>`) järele:
```tsx
          {weatherEnabled && <WeatherSeasonSection fieldSeasonId={currentRec?.fieldSeasonId} actualYieldTonsHa={currentRec?.actualYieldTonsHa} />}
```
(`currentRec` on failis valitud hooaja kirje — kasuta sama muutujat, mida rida 166 kasutab.) `onEditSeeding` jäetakse siin andmata, sest külvikuupäev on samas aknas; kui aknas on külvikuupäeva väljal `id`, anna `onEditSeeding={() => document.getElementById('<id>')?.focus()}`.

`FieldEditDialog`-i kõik kasutuskohad (`grep -rn "<FieldEditDialog" src`) saavad `weatherEnabled={hasModule(user, 'WEATHER')}` — kui komponent asub `App.tsx`-ist sügavamal, anna prop läbi vahekomponentide samamoodi nagu `soilSamples`.

- [ ] **Step 3: Tabeli veerud**

`src/components/FieldsTableView.tsx`: props `weatherEnabled?: boolean`; olek ja laadimine:
```tsx
  const [weatherBySeason, setWeatherBySeason] = useState<Map<number, { gdd: number; precipMm: number }>>(new Map());
  useEffect(() => {
    if (!weatherEnabled) return;
    api.getWeatherSeasons(selectedYear).then((rows) => setWeatherBySeason(new Map(rows.map((r) => [r.fieldSeasonId, r])))).catch(() => setWeatherBySeason(new Map()));
  }, [weatherEnabled, selectedYear]);
```
Päisesse „Kultuur {selectedYear}“ järele:
```tsx
                    {weatherEnabled && <th className="num-col" title="Temperatuurisumma külvist koristuseni (kultuuri baastemperatuuriga)">GDD</th>}
                    {weatherEnabled && <th className="num-col" title="Sademed külvist koristuseni">Sademed, mm</th>}
```
Ridadesse samale kohale (rea hooaja kirje `fieldSeasonId` järgi):
```tsx
                    {weatherEnabled && <td className="num">{fmt0(weatherBySeason.get(rec?.fieldSeasonId ?? -1)?.gdd)}</td>}
                    {weatherEnabled && <td className="num">{fmt0(weatherBySeason.get(rec?.fieldSeasonId ?? -1)?.precipMm)}</td>}
```
Kui tabelil on sortimine (vaata, kas veerupäised on klikitavad), lisa mõlemale veerule sama sortimismehhanism; kui sortimist pole, jäta lisamata (YAGNI). Uuenda tühja rea `colSpan`.

`src/App.tsx`: `<FieldsTableView ... weatherEnabled={hasModule(user, 'WEATHER')} />`.

- [ ] **Step 4: Kontroll ja commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npm test && git add src && git commit -m "feat(ilm): põllu hooaja ilmakokkuvõte ja tabeli veerud

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```
Brauseris: Põllud → 2025 → GDD ja sademed külvikuupäevaga põldudel; põllu aknas plokk; 2024 põllul „vajab külvikuupäeva“.

---

### Task 13: MCP tööriist

**Files:**
- Create: `src/server/mcp/tools/weather.ts`
- Modify: `src/server/mcp/server.ts` (ALL_TOOLS), `src/server/mcp/mcp.test.ts`

**Interfaces:**
- Consumes: `yearsReport`, `seasonReport` (Task 9), `resolveFieldSeason` (`tools/fields.ts`), `defineTool`, `tallinnYear`.
- Produces: tööriist `weather_summary`.

- [ ] **Step 1: Test**

`src/server/mcp/mcp.test.ts`-i lisa (kasuta faili olemasolevat `call` abifunktsiooni ja testettevõtteid): WEATHER moodulita ettevõttel (`A`, ainult TELEMETRY) tööriista pole nimekirjas:
```ts
  it('weather_summary ainult WEATHER mooduliga', async () => {
    const tools = await listTools(A.plainKey); // kasuta failis olemasolevat tööriistade loendi abifunktsiooni
    expect(tools.map((t: { name: string }) => t.name)).not.toContain('weather_summary');
  });
```
Kui failis loendi abifunktsiooni pole, kontrolli `call(A.plainKey, 'weather_summary', {})` tulemust (oodatud viga „tundmatu tööriist“), täpselt nii, nagu fail kontrollib `hasTelemetry` tööriistu.

- [ ] **Step 2: Tööriist**

```ts
// src/server/mcp/tools/weather.ts — ilmakokkuvõte (ERA5-Land): aastate võrdlus 01.04–31.08 või põllu hooaeg külvist koristuseni.
import { z } from 'zod';
import { defineTool, type McpContext } from '../context.ts';
import { tallinnYear } from '../format.ts';
import { resolveFieldSeason } from './fields.ts';
import { yearsReport, seasonReport } from '../../weather/weatherApi.ts';

const hasWeather = (ctx: McpContext) => ctx.license.modules.includes('WEATHER');

export const weatherTools = [
  defineTool({
    name: 'weather_summary',
    title: 'Ilmakokkuvõte',
    description: 'Ilm ERA5-Landi järgi (Copernicus, ruut ~9 km, andmed 2015-st, ~1 nädala viitega). Ilma põlluta: kõik aastad 01.04–31.08 majandi keskmisena — sademed mm, temperatuurisumma GDD (baas °C), veebilanss (sademed − potentsiaalne aurumine), pikim kuiv periood, kuumapäevad (>28 °C), öökülmad apr–juuni — koos pikaajalise keskmise ja standardhälbega. Põlluga: selle põllu hooaja kokkuvõte külvist koristuseni (või tänaseni) kultuuri GDD baasiga.',
    input: {
      field: z.string().optional().describe('Põllu nimi või number — siis põllu hooaja kokkuvõte'),
      year: z.number().int().min(2015).max(2100).optional().describe('Põllu hooaja aasta (vaikimisi jooksev); ilma põlluta piirab väljundi selle aastaga'),
      base: z.number().min(0).max(15).optional().describe('GDD baastemperatuur majandi vaates (vaikimisi 5)')
    },
    when: hasWeather,
    run: async (a) => {
      if (a.field) {
        const fs = await resolveFieldSeason(a.field, a.year ?? tallinnYear());
        return { field: fs.label, ...(await seasonReport(fs.id)) };
      }
      const r = await yearsReport('all', a.base ?? 5);
      return { ...r, years: a.year ? r.years.filter((y) => y.year === a.year) : r.years, source: 'Copernicus Climate Change Service, ERA5-Land' };
    }
  })
];
```

`src/server/mcp/server.ts`: import `weatherTools` ja lisa `ALL_TOOLS` massiivi.

- [ ] **Step 3: Test, commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp && git add src/server/mcp && git commit -m "feat(ilm): MCP tööriist weather_summary

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 14: Admin-vaade

**Files:**
- Modify: `src/server/platformApi.ts` (`route`), `src/admin/platformApi.ts`, `src/admin/AdminApp.tsx`
- Create: `src/admin/WeatherAdminView.tsx`
- Test: `src/server/platformApi.test.ts` (lisa juhtum)

**Interfaces:**
- Consumes: `loadPoint`, `FAIL_WARN` (Task 8).
- Produces: `GET /api/platform/weather` → `{ points: { id, lat, lon, hasData, loadedFrom, loadedUntil, lastSuccessAt, lastError, failCount, fieldSeasonCount }[], failWarn: number, keyConfigured: boolean }`; `POST /api/platform/weather/:id/reload` → `{ started: true }` (käivitab `loadPoint(id, undefined, { refreshRecent: true })` taustal).

- [ ] **Step 1: Server**

`src/server/platformApi.ts` `route` funktsioonis (`devices` harude järele):
```ts
  if (pathname === '/api/platform/weather' && method === 'GET') {
    const db = authDb();
    const points = await db.weatherPoint.findMany({ orderBy: { id: 'asc' }, include: { _count: { select: { fieldSeasons: true } } } });
    return json(res, {
      keyConfigured: !!process.env.CDS_API_KEY,
      failWarn: FAIL_WARN,
      points: points.map((p) => ({
        id: p.id, lat: p.lat, lon: p.lon, hasData: p.hasData,
        loadedFrom: p.loadedFrom?.toISOString().slice(0, 10) ?? null, loadedUntil: p.loadedUntil?.toISOString().slice(0, 10) ?? null,
        lastSuccessAt: p.lastSuccessAt?.toISOString() ?? null, lastError: p.lastError, failCount: p.failCount,
        fieldSeasonCount: p._count.fieldSeasons
      }))
    });
  }
  const wr = /^\/api\/platform\/weather\/(\d+)\/reload$/.exec(pathname);
  if (wr && method === 'POST') {
    loadPoint(Number(wr[1]), undefined, { refreshRecent: true }).catch((err) => console.error('weather reload failed:', err));
    return json(res, { started: true });
  }
```
(`authDb` on BYPASSRLS, seega `_count.fieldSeasons` loeb kõigi ettevõtete hooajad. Importi `loadPoint`, `FAIL_WARN` failist `./weather/loader.ts`. Kui `loadPoint` kasutab `prisma` (teris_app), siis `weather_*` tabelitel RLS-i pole ja see töötab ka ilma ettevõtte kontekstita.)

Test `src/server/platformApi.test.ts`-is (faili olemasoleva päringu abifunktsiooniga): `GET /api/platform/weather` platvormi kasutajaga → 200 ja `points` massiiv; ilma sisselogimiseta → 401.

- [ ] **Step 2: Admin klient ja vaade**

`src/admin/platformApi.ts`:
```ts
export interface WeatherPointRow { id: number; lat: number; lon: number; hasData: boolean | null; loadedFrom: string | null; loadedUntil: string | null; lastSuccessAt: string | null; lastError: string | null; failCount: number; fieldSeasonCount: number }
```
ja objektis (`listDevices` kõrval):
```ts
  weatherStatus: () => request<{ points: WeatherPointRow[]; failWarn: number; keyConfigured: boolean }>('GET', '/weather'),
  reloadWeatherPoint: (id: number) => request<{ started: boolean }>('POST', `/weather/${id}/reload`, {}),
```

```tsx
// src/admin/WeatherAdminView.tsx — ilmapunktide laadimise olek (ERA5-Land) ja käsitsi uuesti laadimine.
import { useEffect, useState } from 'react';
import { platformApi, type WeatherPointRow } from './platformApi.ts';
import { formatDate, formatDateTime } from './format.ts';

export function WeatherAdminView() {
  const [data, setData] = useState<{ points: WeatherPointRow[]; failWarn: number; keyConfigured: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => platformApi.weatherStatus().then(setData).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const reload = async (id: number) => { await platformApi.reloadWeatherPoint(id); setTimeout(load, 2000); };
  return (
    <div className="admin-section">
      <h2>Ilmaandmed (ERA5-Land)</h2>
      {error && <div className="alert-box error">{error}</div>}
      {data && !data.keyConfigured && <div className="alert-box error">CDS_API_KEY puudub serveri seadistuses — laadimine ei tööta.</div>}
      {data?.points.some((p) => p.failCount >= data.failWarn) && <div className="alert-box warning">Mõne punkti laadimine on ebaõnnestunud {data.failWarn}+ korda järjest.</div>}
      <table className="data-table">
        <thead><tr><th>Punkt</th><th className="num">Hooaegu</th><th>Andmed</th><th>Viimati õnnestus</th><th className="num">Vigu järjest</th><th>Viga</th><th /></tr></thead>
        <tbody>
          {data?.points.map((p) => (
            <tr key={p.id} className={p.failCount >= data.failWarn ? 'row-warning' : ''}>
              <td>{p.lat.toFixed(1)}° N, {p.lon.toFixed(1)}° E{p.hasData === false && ' (üle vee, andmeid pole)'}</td>
              <td className="num">{p.fieldSeasonCount}</td>
              <td>{p.loadedFrom ? `${formatDate(p.loadedFrom)} – ${formatDate(p.loadedUntil)}` : 'laadimata'}</td>
              <td>{p.lastSuccessAt ? formatDateTime(p.lastSuccessAt) : '—'}</td>
              <td className="num">{p.failCount}</td>
              <td title={p.lastError ?? ''}>{p.lastError ? p.lastError.slice(0, 60) : ''}</td>
              <td><button type="button" className="btn btn-secondary" onClick={() => reload(p.id)}>Lae uuesti</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Laadimine käib igal ööl kell 3–6. Esialgsed (viimase 90 päeva) andmed laetakse esmaspäeviti uuesti.</p>
    </div>
  );
}
```
(Kontrolli `src/admin/format.ts` ekspordinimesid ja `platformApi` objekti nime failis; kasuta neid.)

`src/admin/AdminApp.tsx`: `View` tüüpi `| { kind: 'weather' }`, nupp „Ilm“ (`devices` nupu järele, lisa `'weather'` ka tenants-nupu `includes` loendisse) ja `{view.kind === 'weather' && <WeatherAdminView />}`.

- [ ] **Step 3: Kontroll ja commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/platformApi.test.ts && git add src && git commit -m "feat(ilm): admin-vaade ilmapunktide laadimisest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 15: Dokumentatsioon, AI juhis ja release

**Files:**
- Modify: `docs/vaated-ja-andmed.md`, `docs/andmemudel.md`
- Modify: spec (sidumise kirjeldus) — vt Step 2

- [ ] **Step 1: Dokumentatsioon**

`docs/vaated-ja-andmed.md`: uus jaotis „Ilm“ (vaate sisu, andmeallikas, perioodid, esiletõst, põllu plokk, tabeli veerud, WEATHER moodul). `docs/andmemudel.md`: `weather_points`, `weather_daily` (ettevõtteülesed, RLS-ita), `field_seasons.weatherPointId`, `crops.gddBaseC`, `catalog_crops.gddBaseC`.

- [ ] **Step 2: AI juhis**

admin.teris.ee → AI juhis: lisa lõik
> **Ilm:** `weather_summary` annab ERA5-Landi ilmakokkuvõtte. Ilma põlluta — aastate võrdlus 01.04–31.08 koos pikaajalise keskmisega; põlluga — selle hooaja ilm külvist koristuseni. Andmed tulevad umbes nädalase viitega ja on ~9 km ruudu keskmine, mitte põllu mõõtmine.

- [ ] **Step 3: Kogu testikomplekt ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add docs && git commit -m "docs: ilmaandmed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```
Oodatud: tsc, testid ja build läbivad, teenus taaskäivitub.

- [ ] **Step 4: Lõppkontroll**

1. teris.ee → Ilm: andmed 2015–2026, keskmine, värvid, graafikud, allikaviide.
2. Põllud → 2025: GDD/sademed veerud; põllu aknas ilmaplokk.
3. Kultuurid: GDD baastemperatuuri väli; mais 10.
4. admin.teris.ee → Ilm: punktid, laetud vahemik, „Lae uuesti“.
5. Järgmisel hommikul: `journalctl -u teris --since "today 03:00" | grep -i weather` — vigu pole, `loadedUntil` on nihkunud.
