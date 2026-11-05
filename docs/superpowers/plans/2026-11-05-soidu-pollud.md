# Sõidu põllud, ha ja kande seos — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sõitude import arvutab iga sõidu põldude kaupa põllul oldud aja, kaetud ha ja kütuse; kande telemeetria soovitused tulevad sellest registrist (koos kütusega) ja kanne seotakse sõiduga, nii et sõitude registrist näeb kirja panemata põllusõite.

**Architecture:** Puhas `tripFields.ts` arvutab sõidu punktidest põllud (aeg, ha `coverageAreaHa`-ga, kütus loendurist/tunnikulust, teekütuse jagamine). `tripImport.ts` kirjutab põllured (`vehicle_trip_fields`) alati koos sõidu kohtadega (uus/mittelõplik sõit, kohtade sõrmejälg, uus seoste sõrmejälg). Seadme masin/haakeriist (koos laiusega) lahendatakse ühes kohas (`tripAssignments.ts`), mida kasutavad import, sõitude API ja kande soovitused. Kande soovitused (`tripSuggestions.ts`) loevad registrit; kande salvestus kontrollib `tripId`. UI: kande aken (kütus, seos, „Eemalda seos“), sõitude register (ha, Kanne, filter) ja sõidu aken (põldude tabel, link põllu tööle).

**Tech Stack:** TypeScript, Node http, Prisma 6 (PostgreSQL + RLS + tenant FK trigerid), TimescaleDB (`measurements`), @turf/turf, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-soidu-pollud-design.md`

## Global Constraints

- Kood töötab serveris: `ssh debian@uvn-243-120.tll07.zonevs.eu`, kaust `/home/debian/teris`. Kohalik `/Users/andresj/Progemine/teris` on sshfs-mount — faile võib muuta kohalikult (Read/Edit/Write), aga **kõik käsud (npm, npx, git, psql, python3) käivita ssh kaudu** serveri kaustas.
- Testid käivad live-andmebaasi vastu ajutise ettevõttega (`test-tenant-…-${process.pid}`), mis testi lõpus kustutatakse. Testi abifunktsioon on alati `runAsTenant(T, async () => await fn())` (Prisma päringud on laisad).
- Identifikaatorid (URL-id, id/class, CSS, väljanimed) inglise keeles; kommentaarid ja UI-tekst eesti keeles.
- UI kuupäevad/kellaajad `pp.kk.aaaa HH:MM` Tallinna ajas (`formatDateTime` failist `src/components/fleetDateTime.ts`; ainult kuupäev `formatDate` failist `src/services/dateFormat.ts`).
- UI numbrid paremale (`className="num"`); kogused `formatQty` (`src/services/units.ts`).
- Kõik filtrid `FilterClear` sees; liitfiltrid (kuupäevavahemik, märkeruut) `className="filter-clear-inline"`.
- ha = haakeriista laiusega kaetud pindala **põllu piires** (`coverageAreaHa`); puuduv haakeriist/laius → ha **tühi (null), mitte 0**.
- Põllu punktide järjestikune vahe ≤ 5 min (pausid süüde väljas välja); põld, kus punkte < 3 või `activeMinutes` < 1, jäetakse välja.
- Kütus kandel = `fuelSharedL` = põllu kütus + teekütuse osa (`teekütus × activeMinutes / Σ activeMinutes`); sõidu kütuse puudumisel tühi.
- Üks sõit kande kohta; üks sõit mitmel kandel ainult eri põldudel (hooaegadel). Vale `tripId` → 400 eestikeelse veaga.
- Vanu kandeid automaatselt ei seota. `telemetryAreaHa` varundatakse (`/home/debian/backups/telemetry-area-ha-2026-11-05.json`) ja tühjendatakse; teisi välju ei muudeta.
- Välja jäetud: MCP tööriist, kokkuvõtted.
- Skeemimuudatus: `npx prisma db push` (ilma `--accept-data-loss`; kui küsib, **peatu ja küsi kasutajalt**) + `npx prisma generate`; RLS: tabel `scripts/tenancy/02-rls.sql` loendisse + `psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql`; seejärel `npx tsx scripts/tenancy/05-tenant-fk-triggers.mts`.
- Live-tabelite andmete lugemine/kirjutamine käsurealt ainult `PLATFORM_DATABASE_URL`-iga (MIGRATE roll näeb FORCE RLS tõttu 0 rida); veerunimed camelCase jutumärkides (`"telemetryAreaHa"`).
- `npm run tenant -- trips:import` käivitab **kompileeritud** `dist-server/tenantCli.js` — andmesamm tehakse alles pärast `npm run release`.
- Lõpus alati commit + `npm run release` serveris.
- Commit-sõnumi lõppu: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Failid

| Fail | Vastutus |
|---|---|
| `prisma/schema.prisma` | `VehicleTripField`; `VehicleTrip.areaHa`; `WorkEntry.tripId`; `TripImportState.assignmentsFingerprint/assignmentsCheckedAt` |
| `scripts/tenancy/02-rls.sql` | RLS tabelile `vehicle_trip_fields` |
| `src/server/tenantScope.test.ts` | ettevõtte mudelite arv 37 → 38 |
| `src/server/tripAssignments.ts` (uus) | seadme masin/haakeriist/laius antud hetkel seoste registrist |
| `src/server/tripFields.ts` (+ test, uus) | puhas: sõidu punktid → põllud (aeg, ha, kütus) |
| `src/server/tripImport.ts` (+ test) | põllured impordis, ümberarvutus (kohad, seosed), id ülevõtu eelistus |
| `src/server/tripSuggestions.ts` (+ test, uus) | kande soovitused registrist; kande `tripId` kontroll |
| `src/server/fieldWorks.ts` | vana GPS-soovituse eemaldus; kande `tripId` salvestus ja kontroll |
| `src/server/telemetryAccess.ts`, `src/server/tripRoute.ts` (+ test), `src/server/telemetryHistory.test.ts` | kasutuseta koodi eemaldus |
| `src/server/tripsApi.ts` (+ test) | `areaHa`, `fields` koos kannetega, `unlinkedOnly` |
| `src/types/fieldWork.ts`, `src/types/fleet.ts`, `src/services/api.ts` | tüübid ja klient |
| `src/components/FieldWorkEntryDialog.tsx` | soovitus täidab kütuse ja `tripId`; „Eemalda seos“ |
| `src/components/TripRegister.tsx`, `src/components/TripDialog.tsx` | ha ja Kanne veerg, filter, põldude tabel |
| `src/components/VehicleTracker.tsx`, `src/components/FieldWorksBoard.tsx`, `src/App.tsx` | sõidu aknast põllu töö avamine |
| `src/index.css` | stiilid |
| `docs/vaated-ja-andmed.md`, `docs/andmemudel.md`, spec | dokumentatsioon |

---

### Task 1: Andmemudel, RLS ja FK-trigerid

**Files:**
- Modify: `prisma/schema.prisma` (mudelid `FieldSeason`, `VehicleTrip`, `TripImportState`, `WorkEntry`; uus `VehicleTripField`)
- Modify: `scripts/tenancy/02-rls.sql:12`
- Test: `src/server/tenantScope.test.ts:13`

**Interfaces:**
- Produces: `prisma.vehicleTripField` (väljad `id, tenantId, tripId, fieldSeasonId, arriveAt, leaveAt, activeMinutes, areaHa?, implementId?, widthM?, fuelFieldL?, fuelSharedL?, computedAt`; unikaalne `tripId_fieldSeasonId`); `VehicleTrip.areaHa: number | null`, relatsioonid `VehicleTrip.fields`, `VehicleTrip.workEntries`; `WorkEntry.tripId: string | null` + `WorkEntry.trip`; `FieldSeason.tripFields`; `TripImportState.assignmentsFingerprint: string | null`, `assignmentsCheckedAt: Date | null`.

- [ ] **Step 1: Uuenda testi ootust (ebaõnnestub)**

`src/server/tenantScope.test.ts`:

```ts
    expect(TENANT_MODELS.size).toBe(37);
```
→
```ts
    expect(TENANT_MODELS.size).toBe(38);
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tenantScope.test.ts'`
Expected: FAIL (`expected 37 to be 38`).

- [ ] **Step 2: Skeem**

`FieldSeason` mudelis rida

```prisma
  fieldWorks       FieldWork[]
```
→
```prisma
  fieldWorks       FieldWork[]
  tripFields       VehicleTripField[]
```

`VehicleTrip` mudelis:

```prisma
  pointCount        Int
  notes             String?
  computedAt        DateTime
```
→
```prisma
  pointCount        Int
  areaHa            Float? // põldude kaetud pindala summa; tühi = ühelgi põllul pole haakeriista laiust
  notes             String?
  computedAt        DateTime
```

ja samas mudelis

```prisma
  updatedBy         String? // viimase muutja kasutajatunnus (täidetakse automaatselt)

  @@index([deviceId, startedAt])
  @@index([tenantId, startedAt])
  @@map("vehicle_trips")
}
```
→
```prisma
  updatedBy         String? // viimase muutja kasutajatunnus (täidetakse automaatselt)
  fields            VehicleTripField[]
  workEntries       WorkEntry[]

  @@index([deviceId, startedAt])
  @@index([tenantId, startedAt])
  @@map("vehicle_trips")
}

// Sõidu põllurida: sõidu osa ühel põllul (hooajal) — põllul oldud aeg, kaetud pindala ja kütus.
// Tuletatud impordis koos sõidu kohtadega; haakeriist on teave (mitte FK), et haakeriista kustutamisel ajalugu jääks.
model VehicleTripField {
  id            String      @id @default(cuid())
  tenantId      String      @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  tripId        String
  trip          VehicleTrip @relation(fields: [tripId], references: [id], onDelete: Cascade)
  fieldSeasonId Int
  fieldSeason   FieldSeason @relation(fields: [fieldSeasonId], references: [id], onDelete: Cascade)
  arriveAt      DateTime // esimene sõidu punkt põllu piires
  leaveAt       DateTime // viimane sõidu punkt põllu piires
  activeMinutes Float // põllul süütega oldud aeg (punktide vahed ≤ 5 min, pausid välja)
  areaHa        Float? // kaetud pindala põllu piires; tühi = haakeriista laius puudub
  implementId   String? // haakeriist, millega ha arvutati (teave, mitte FK)
  widthM        Float? // töölaius, millega ha arvutati
  fuelFieldL    Float? // põllul kulunud kütus
  fuelSharedL   Float? // põllu kütus + osa teekütusest (põllul oldud aja järgi)
  computedAt    DateTime

  @@unique([tripId, fieldSeasonId])
  @@index([fieldSeasonId, arriveAt])
  @@index([tenantId])
  @@map("vehicle_trip_fields")
}
```

`TripImportState` mudelis:

```prisma
  placesFingerprint String?
  placesCheckedAt   DateTime?
```
→
```prisma
  placesFingerprint      String?
  placesCheckedAt        DateTime?
  assignmentsFingerprint String? // seoste (seade, haakimine, haakeriist) arv + viimane muutmisaeg
  assignmentsCheckedAt   DateTime?
```

`WorkEntry` mudelis:

```prisma
  warehouseId          String? // ladu, kust kande materjalid võetakse; tühi = põhiladu
```
→
```prisma
  warehouseId          String? // ladu, kust kande materjalid võetakse; tühi = põhiladu
  tripId               String? // sõitude registri sõit, millest kanne tehti; tühi = seoseta
```

ja

```prisma
  harvestLot         HarvestLot?     @relation(fields: [harvestLotId], references: [id], onDelete: SetNull)
  lines              WorkEntryLine[]

  @@index([fieldWorkId])
  @@index([harvestLotId])
```
→
```prisma
  harvestLot         HarvestLot?     @relation(fields: [harvestLotId], references: [id], onDelete: SetNull)
  trip               VehicleTrip?    @relation(fields: [tripId], references: [id], onDelete: SetNull)
  lines              WorkEntryLine[]

  @@index([fieldWorkId])
  @@index([harvestLotId])
  @@index([tripId])
```

- [ ] **Step 3: RLS loendisse**

`scripts/tenancy/02-rls.sql` real 12:

```sql
    'harvest_lots','harvest_lot_weighings','harvest_lot_costs','vehicle_trips','trip_import_state'
```
→
```sql
    'harvest_lots','harvest_lot_weighings','harvest_lot_costs','vehicle_trips','trip_import_state','vehicle_trip_fields'
```

- [ ] **Step 4: Rakenda skeem, RLS ja FK-trigerid**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx prisma db push && npx prisma generate && set -a && . ./.env && set +a && psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql && npx tsx scripts/tenancy/05-tenant-fk-triggers.mts'
```
Expected: `db push` ilma andmekao hoiatuseta (uus tabel, uued tühjad veerud); psql `DO`, `GRANT`, `REVOKE`; skript `OK: N trigerit`. Kui `db push` küsib `--accept-data-loss`, **peatu ja küsi kasutajalt**.

- [ ] **Step 5: Kontrolli RLS-i**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && psql "${MIGRATE_DATABASE_URL%%\?*}" -At -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = '"'"'vehicle_trip_fields'"'"'"'
```
Expected: `vehicle_trip_fields|t|t`.

- [ ] **Step 6: Testid ja tüübikontroll**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/tenantScope.test.ts src/server/tenantIsolation.test.ts'
```
Expected: PASS (tenantIsolation kontrollib ka uue tabeli RLS-i ja FK-trigereid).

- [ ] **Step 7: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add prisma/schema.prisma scripts/tenancy/02-rls.sql src/server/tenantScope.test.ts && git commit -m "feat(soidu-pollud): andmemudel vehicle_trip_fields, sõidu ha, kande tripId (RLS, FK)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 2: Seadme seoste lahendaja (`tripAssignments.ts`)

Sõitude API `resolveTargets` loogika tõstetakse eraldi moodulisse, et import (haakeriista laius põllule jõudmise ajal) ja kande soovitused kasutaksid sama reeglit. Käitumine ei muutu — kaitsevad olemasolevad `tripsApi.test.ts` testid.

**Files:**
- Create: `src/server/tripAssignments.ts`
- Modify: `src/server/tripsApi.ts:1-64`
- Test: `src/server/tripsApi.test.ts` (olemasolev, muutmata)

**Interfaces:**
- Produces:
  ```ts
  export type ResolvedTarget = { vehicleId: string | null; vehicleName: string | null;
    implementId: string | null; implementName: string | null; widthM: number | null };
  export type AssignmentResolver = (deviceId: string, at: Date) => ResolvedTarget;
  export async function loadAssignmentResolver(deviceIds: string[]): Promise<AssignmentResolver>;
  ```
  Reegel: seadme seos (`DeviceAssignment`), mis katab hetke (`startedAt ≤ at ≤ endedAt` või avatud), hiliseim alguse järgi; haakeriist otse või masina haakimise (`ImplementAssignment`) kaudu; seadme seos haakeriistaga → masin haakimise kaudu. `widthM` = `Implement.workingWidthM`.

- [ ] **Step 1: Loo moodul**

```ts
// src/server/tripAssignments.ts — seadme masin ja haakeriist antud hetkel seoste registrist.
// Seadme seos (DeviceAssignment) annab masina või haakeriista; puuduva poole leiame haakimise registrist (ImplementAssignment).
// Kasutavad sõitude import (haakeriista laius põllule jõudmise ajal), sõitude API ja kande soovitused.
import { prisma } from './db.ts';

export type ResolvedTarget = {
  vehicleId: string | null;
  vehicleName: string | null;
  implementId: string | null;
  implementName: string | null;
  widthM: number | null; // haakeriista töölaius (m)
};

export type AssignmentResolver = (deviceId: string, at: Date) => ResolvedTarget;

const covers = (a: { startedAt: Date; endedAt: Date | null }, t: Date) => a.startedAt <= t && (!a.endedAt || a.endedAt >= t);

export async function loadAssignmentResolver(deviceIds: string[]): Promise<AssignmentResolver> {
  const ids = [...new Set(deviceIds)];
  const assignments = ids.length
    ? await prisma.deviceAssignment.findMany({
        where: { deviceId: { in: ids } },
        include: {
          vehicle: { select: { id: true, name: true } },
          implement: { select: { id: true, name: true, workingWidthM: true } }
        },
        orderBy: { startedAt: 'desc' }
      })
    : [];
  const vehicleIds = [...new Set(assignments.map((a) => a.vehicleId).filter((x): x is string => !!x))];
  const implementIds = [...new Set(assignments.filter((a) => !a.vehicleId).map((a) => a.implementId).filter((x): x is string => !!x))];
  // Seadme seos võib olla haakeriistaga (ilma masinata); siis leiame masina haakimise registrist.
  const implAssignments = vehicleIds.length || implementIds.length
    ? await prisma.implementAssignment.findMany({
        where: { OR: [
          ...(vehicleIds.length ? [{ vehicleId: { in: vehicleIds } }] : []),
          ...(implementIds.length ? [{ implementId: { in: implementIds } }] : [])
        ] },
        include: {
          implement: { select: { id: true, name: true, workingWidthM: true } },
          vehicle: { select: { id: true, name: true } }
        },
        orderBy: { startedAt: 'desc' }
      })
    : [];
  return (deviceId, at) => {
    const a = assignments.find((x) => x.deviceId === deviceId && covers(x, at));
    let implement = a?.implement ?? null;
    let vehicle = a?.vehicle ?? null;
    if (!implement && a?.vehicleId) {
      implement = implAssignments.find((x) => x.vehicleId === a.vehicleId && covers(x, at))?.implement ?? null;
    }
    if (!vehicle && a?.implementId) {
      vehicle = implAssignments.find((x) => x.implementId === a.implementId && covers(x, at))?.vehicle ?? null;
    }
    return {
      vehicleId: vehicle?.id ?? null,
      vehicleName: vehicle?.name ?? null,
      implementId: implement?.id ?? null,
      implementName: implement?.name ?? null,
      widthM: implement?.workingWidthM ?? null
    };
  };
}
```

- [ ] **Step 2: `tripsApi.ts` kasutab lahendajat**

Import-plokk:

```ts
import { fetchTripSamples } from './telemetryAccess.ts';
```
→
```ts
import { fetchTripSamples } from './telemetryAccess.ts';
import { loadAssignmentResolver } from './tripAssignments.ts';
```

Asenda kogu funktsioon alates `async function resolveTargets(trips: TripRow[]) {` kuni selle sulgeva `}`-ni (rida enne `function toDto(`):

```ts
async function resolveTargets(trips: TripRow[]) {
  const deviceIds = [...new Set(trips.map((t) => t.deviceId))];
  const [devices, resolve] = await Promise.all([
    prisma.telemetryDevice.findMany({ where: { id: { in: deviceIds } }, select: { id: true, model: true, imei: true } }),
    loadAssignmentResolver(deviceIds)
  ]);
  return (t: TripRow) => {
    const dev = devices.find((d) => d.id === t.deviceId);
    const r = resolve(t.deviceId, t.startedAt);
    return {
      deviceLabel: dev ? deviceLabelOf(dev) : t.deviceId,
      vehicleId: r.vehicleId,
      vehicleName: r.vehicleName,
      implementId: r.implementId,
      implementName: r.implementName
    };
  };
}
```

- [ ] **Step 3: Testid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/tripsApi.test.ts'`
Expected: PASS (sh „seade haakeriistal: masin leitakse haakimise registrist sõidu alguse ajal“).

- [ ] **Step 4: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/tripAssignments.ts src/server/tripsApi.ts && git commit -m "refactor(soidud): seadme masina/haakeriista lahendaja eraldi moodulis (laiusega)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 3: Sõidu põllud — puhas arvutus (`tripFields.ts`)

**Files:**
- Create: `src/server/tripFields.ts`
- Test: `src/server/tripFields.test.ts`

**Interfaces:**
- Consumes: `TripSample` (`src/server/tripSegments.ts`), `Place` (`src/server/tripRoute.ts`; põllu `id` = `String(fieldSeasonId)`), `coverageAreaHa(points: CoveragePoint[], field, widthM): number` (`src/server/coverageArea.ts`).
- Produces:
  ```ts
  export type ImplementAt = (at: Date) => { implementId: string | null; widthM: number | null };
  export type TripFieldCalc = { fieldSeasonId: number; arriveAt: Date; leaveAt: Date; activeMinutes: number;
    areaHa: number | null; implementId: string | null; widthM: number | null;
    fuelFieldL: number | null; fuelSharedL: number | null };
  export const FIELD_STEP_MAX_MS: number; // 5 min
  /** samples = kõik sõidu ajavahemiku punktid ajas kasvavalt, ka süüde väljas (pausid). */
  export function computeTripFields(samples: TripSample[], places: Place[], tripFuelL: number | null, implementAt: ImplementAt): TripFieldCalc[]; // arriveAt järgi
  export function tripAreaHa(fields: TripFieldCalc[]): number | null;
  ```
  `TripFieldCalc` võtmed vastavad täpselt `vehicle_trip_fields` veergudele (v.a `tripId`, `computedAt`). `widthM` on null, kui laius puudub või ≤ 0.

- [ ] **Step 1: Kirjuta testid**

```ts
// src/server/tripFields.test.ts — sõidu põllud (puhas arvutus).
import { describe, it, expect } from 'vitest';
import type { Polygon } from 'geojson';
import { computeTripFields, tripAreaHa, type ImplementAt, type TripFieldCalc } from './tripFields';
import { coverageAreaHa } from './coverageArea';
import type { TripSample } from './tripSegments';
import type { Place } from './tripRoute';

const LAT0 = 58.12;
const LNG0 = 25.9;
const M_LAT = 1 / 110_574;
const M_LNG = 1 / (111_320 * Math.cos((LAT0 * Math.PI) / 180));
const at = (xM: number, yM: number) => ({ lat: LAT0 + yM * M_LAT, lng: LNG0 + xM * M_LNG });
// Ruut x ∈ [x0, x0+size], y ∈ [0, size] meetrites
const square = (x0: number, size: number): Polygon => {
  const c = [at(x0, 0), at(x0 + size, 0), at(x0 + size, size), at(x0, size), at(x0, 0)];
  return { type: 'Polygon', coordinates: [c.map((p) => [p.lng, p.lat])] };
};

const T0 = new Date('2026-10-21T05:00:00Z').getTime();
const min = (m: number) => new Date(T0 + m * 60_000);
const s = (m: number, xM: number, yM: number, o: Partial<TripSample> = {}): TripSample => ({
  time: min(m), ...at(xM, yM), ignition: true, speedKmh: 8,
  fuelUsedL: null, fuelRateLph: null, fuelLevelPct: null, engineHours: null, ...o
});
const range = (a: number, b: number, f: (m: number) => TripSample) => Array.from({ length: b - a + 1 }, (_, i) => f(a + i));

const A: Place = { id: '101', kind: 'FIELD', label: 'A', geometry: square(0, 200) };
const B: Place = { id: '102', kind: 'FIELD', label: 'B', geometry: square(400, 200) };
const POI: Place = { id: 'poi-1', kind: 'POI', label: 'Töökoda', lat: at(300, 100).lat, lng: at(300, 100).lng, radiusM: 30 };
const NO_IMPL: ImplementAt = () => ({ implementId: null, widthM: null });
const IMPL6: ImplementAt = () => ({ implementId: 'imp-6', widthM: 6 });
// A-l liikumine mööda y = 100 (x = 10 + 10 m minutis; m ≤ 18 jääb põllule)
const onA = (m: number, o: Partial<TripSample> = {}) => s(m, 10 + 10 * m, 100, o);
const calc = (samples: TripSample[], fuel: number | null = null, impl: ImplementAt = NO_IMPL): TripFieldCalc[] =>
  computeTripFields(samples, [A, B, POI], fuel, impl);

describe('computeTripFields', () => {
  it('põllu punktid: saabumine, lahkumine; väljas käimine katkestab aja', () => {
    const pts = [
      ...range(0, 10, (m) => onA(m)),
      ...range(11, 14, (m) => s(m, 300, 100)), // A ja B vahel
      ...range(15, 20, (m) => s(m, 150, 20 + 10 * (m - 15)))
    ];
    const f = calc(pts);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ fieldSeasonId: 101, arriveAt: min(0), leaveAt: min(20), activeMinutes: 15 });
  });

  it('paus (süüde väljas) ja üle 5 min vahe ei lähe põllul oldud aja sisse', () => {
    const pts = [
      ...range(0, 5, (m) => onA(m)),
      onA(6, { ignition: false }),
      ...range(8, 10, (m) => onA(m)),
      onA(17), onA(18)
    ];
    expect(calc(pts)[0].activeMinutes).toBe(8);
  });

  it('ha haakeriista laiusega põllu piires; laiuseta tühi', () => {
    const pts = range(0, 18, (m) => onA(m));
    const [withWidth] = calc(pts, null, IMPL6);
    const expected = coverageAreaHa(pts.map((p, i) => ({ lat: p.lat, lng: p.lng, brk: i === 0 })), A.geometry!, 6);
    expect(withWidth).toMatchObject({ implementId: 'imp-6', widthM: 6 });
    expect(withWidth.areaHa).toBeCloseTo(expected, 2);
    expect(withWidth.areaHa!).toBeGreaterThan(0.1);
    expect(calc(pts)[0]).toMatchObject({ areaHa: null, implementId: null, widthM: null });
    expect(calc(pts, null, () => ({ implementId: 'imp-x', widthM: null }))[0]).toMatchObject({ areaHa: null, implementId: 'imp-x', widthM: null });
  });

  it('kütus loendurist põldude kaupa; teekütus jagatakse põllul oldud aja järgi (summa = sõidu kütus)', () => {
    const c = (m: number) => ({ fuelUsedL: 100 + 0.5 * m });
    const pts = [
      ...range(0, 10, (m) => onA(m, c(m))),
      ...range(11, 15, (m) => s(m, 300, 100, c(m))),
      ...range(16, 20, (m) => s(m, 410 + 10 * (m - 16), 100, c(m)))
    ];
    const [a, b] = calc(pts, 10);
    expect(a).toMatchObject({ fieldSeasonId: 101, fuelFieldL: 5, activeMinutes: 10 });
    expect(b).toMatchObject({ fieldSeasonId: 102, fuelFieldL: 2, activeMinutes: 4 });
    expect(a.fuelSharedL).toBeCloseTo(7.14, 2);
    expect(b.fuelSharedL).toBeCloseTo(2.86, 2);
    expect(a.fuelSharedL! + b.fuelSharedL!).toBeCloseTo(10, 1);
  });

  it('kütus tunnikulust, kui loendurit pole', () => {
    const [a] = calc(range(0, 10, (m) => onA(m, { fuelRateLph: 12 })), 3);
    expect(a.fuelFieldL).toBeCloseTo(2, 2);
    expect(a.fuelSharedL).toBeCloseTo(3, 2);
  });

  it('kütuseandmeteta: põllu kütus ja jagatud kütus tühjad', () => {
    const [a] = calc(range(0, 10, (m) => onA(m)), null);
    expect(a).toMatchObject({ fuelFieldL: null, fuelSharedL: null });
  });

  it('läbisõit serva pealt (< 3 punkti või < 1 min) jääb välja', () => {
    const pts = [s(0, 410, 100), s(1, 420, 100), s(2, 300, 100), s(3, 300, 100), s(5, 50, 50), s(5.3, 55, 50), s(5.6, 60, 50)];
    expect(calc(pts)).toEqual([]);
  });

  it('haakeriist leitakse põllule jõudmise ajal', () => {
    const seen: Date[] = [];
    calc([...range(0, 3, (m) => s(m, 300, 100)), ...range(4, 10, (m) => onA(m))], null, (t) => {
      seen.push(t);
      return { implementId: null, widthM: null };
    });
    expect(seen).toEqual([min(4)]);
  });
});

describe('tripAreaHa', () => {
  const row = (areaHa: number | null): TripFieldCalc => ({
    fieldSeasonId: 1, arriveAt: min(0), leaveAt: min(1), activeMinutes: 1, areaHa,
    implementId: null, widthM: null, fuelFieldL: null, fuelSharedL: null
  });
  it('põldude summa; tühi, kui ühelgi põllul pole ha-d', () => {
    expect(tripAreaHa([row(1.2), row(null), row(0.3)])).toBe(1.5);
    expect(tripAreaHa([row(null)])).toBeNull();
    expect(tripAreaHa([])).toBeNull();
  });
});
```

- [ ] **Step 2: Kontrolli, et test ebaõnnestub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tripFields.test.ts'`
Expected: FAIL (`Failed to resolve import "./tripFields"`).

- [ ] **Step 3: Implementatsioon**

```ts
// src/server/tripFields.ts — sõidu põllud: põllul oldud aeg, kaetud pindala ja kütus põldude kaupa.
// Puhas: andmebaasi ei puutu. Sisend on sõidu ajavahemiku kõik punktid (ka süüde väljas — need tähistavad pause).
// Põllu punktide jada katkeb (brk), kui vahepeal käidi põllult väljas, süüde oli väljas või vahe > 5 min;
// katkestust ei loeta põllul oldud ajaks, kütuseks ega kaetud jooneks.
import * as turf from '@turf/turf';
import type { MultiPolygon, Polygon } from 'geojson';
import type { TripSample } from './tripSegments.ts';
import type { Place } from './tripRoute.ts';
import { coverageAreaHa, type CoveragePoint } from './coverageArea.ts';

export type ImplementAt = (at: Date) => { implementId: string | null; widthM: number | null };

export type TripFieldCalc = {
  fieldSeasonId: number;
  arriveAt: Date;
  leaveAt: Date;
  activeMinutes: number;
  areaHa: number | null; // tühi = haakeriista laius puudub
  implementId: string | null;
  widthM: number | null;
  fuelFieldL: number | null;
  fuelSharedL: number | null; // põllu kütus + osa teekütusest
};

export const FIELD_STEP_MAX_MS = 5 * 60 * 1000;
const MIN_FIELD_POINTS = 3;
const MIN_FIELD_ACTIVE_MS = 60 * 1000;

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

type PreparedField = { id: number; geometry: Polygon | MultiPolygon; bbox: [number, number, number, number] };

function prepareFields(places: Place[]): PreparedField[] {
  const out: PreparedField[] = [];
  for (const p of places) {
    if (p.kind !== 'FIELD' || !p.geometry) continue;
    const id = Number(p.id);
    if (!Number.isInteger(id)) continue;
    try {
      out.push({ id, geometry: p.geometry, bbox: turf.bbox(p.geometry) as [number, number, number, number] });
    } catch {
      // vigane geomeetria — põld jääb välja
    }
  }
  return out;
}

function fieldOf(fields: PreparedField[], lng: number, lat: number): PreparedField | null {
  for (const f of fields) {
    const [a, b, c, d] = f.bbox;
    if (lng < a || lng > c || lat < b || lat > d) continue;
    try {
      if (turf.booleanPointInPolygon([lng, lat], f.geometry)) return f;
    } catch {
      // vigane geomeetria
    }
  }
  return null;
}

type Acc = {
  field: PreparedField;
  points: CoveragePoint[];
  arriveAt: Date;
  leaveAt: Date;
  activeMs: number;
  fuel: number;
  runCounter: number | null; // kütuseloenduri viimane näit selles katkematus jadas
};

export function computeTripFields(samples: TripSample[], places: Place[], tripFuelL: number | null, implementAt: ImplementAt): TripFieldCalc[] {
  const fields = prepareFields(places);
  if (fields.length === 0) return [];
  const on = samples.filter((s) => s.ignition !== false);
  // Sama allikas, mis sõidu kütusel (tripSegments): loendur, kui vähemalt 2 näitu, muidu tunnikulu
  const useCounter = on.filter((s) => s.fuelUsedL != null).length >= 2;
  const useRate = !useCounter && on.some((s) => s.fuelRateLph != null);
  const acc = new Map<number, Acc>();
  let prev: { sample: TripSample; fieldId: number | null } | null = null;
  let offSeen = false;
  for (const s of samples) {
    if (s.ignition === false) {
      if (prev) offSeen = true;
      continue;
    }
    const f = fieldOf(fields, s.lng, s.lat);
    const dt = prev ? s.time.getTime() - prev.sample.time.getTime() : Infinity;
    const contiguous = !!prev && !offSeen && f != null && prev.fieldId === f.id && dt <= FIELD_STEP_MAX_MS;
    if (f) {
      let a = acc.get(f.id);
      if (!a) {
        a = { field: f, points: [], arriveAt: s.time, leaveAt: s.time, activeMs: 0, fuel: 0, runCounter: null };
        acc.set(f.id, a);
      }
      a.points.push({ lat: s.lat, lng: s.lng, brk: !contiguous });
      a.leaveAt = s.time;
      if (contiguous) a.activeMs += dt;
      if (useCounter) {
        const c = s.fuelUsedL;
        if (!contiguous) a.runCounter = c;
        else if (c != null) {
          if (a.runCounter != null && c > a.runCounter) a.fuel += c - a.runCounter; // loenduri nullimine (langus) ei loe
          a.runCounter = c;
        }
      } else if (useRate && contiguous && prev!.sample.fuelRateLph != null) {
        a.fuel += prev!.sample.fuelRateLph * (dt / 3_600_000);
      }
    }
    prev = { sample: s, fieldId: f?.id ?? null };
    offSeen = false;
  }

  // Läbisõit serva pealt ei ole põllutöö
  const kept = [...acc.values()].filter((a) => a.points.length >= MIN_FIELD_POINTS && a.activeMs >= MIN_FIELD_ACTIVE_MS);
  const fuelOf = (a: Acc) => (useCounter || useRate ? round(a.fuel, 2) : null);
  const totalActive = kept.reduce((sum, a) => sum + a.activeMs, 0);
  const fieldFuel = kept.reduce((sum, a) => sum + (fuelOf(a) ?? 0), 0);
  const roadFuel = tripFuelL == null ? null : Math.max(0, tripFuelL - fieldFuel);
  return kept
    .sort((x, y) => x.arriveAt.getTime() - y.arriveAt.getTime())
    .map((a) => {
      const impl = implementAt(a.arriveAt);
      const widthM = impl.widthM != null && impl.widthM > 0 ? impl.widthM : null;
      const fuelFieldL = fuelOf(a);
      return {
        fieldSeasonId: a.field.id,
        arriveAt: a.arriveAt,
        leaveAt: a.leaveAt,
        activeMinutes: round(a.activeMs / 60_000, 1),
        areaHa: widthM ? coverageAreaHa(a.points, a.field.geometry, widthM) : null,
        implementId: impl.implementId,
        widthM,
        fuelFieldL,
        fuelSharedL: roadFuel == null
          ? null
          : round((fuelFieldL ?? 0) + (totalActive > 0 ? (roadFuel * a.activeMs) / totalActive : 0), 2)
      };
    });
}

/** Sõidu ha = põldude summa; tühi, kui ühelgi põllul pole ha-d. */
export function tripAreaHa(fields: TripFieldCalc[]): number | null {
  const vals = fields.map((f) => f.areaHa).filter((v): v is number => v != null);
  return vals.length ? round(vals.reduce((sum, v) => sum + v, 0), 2) : null;
}
```

- [ ] **Step 4: Testid läbivad**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tripFields.test.ts src/server/coverageArea.test.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/tripFields.ts src/server/tripFields.test.ts && git commit -m "feat(soidu-pollud): sõidu põllud — aeg, ha ja kütus põldude kaupa (puhas)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 4: Põllud impordis, ümberarvutus ja id ülevõtu eelistus

**Files:**
- Modify: `src/server/tripImport.ts` (kogu fail asendatakse)
- Test: `src/server/tripImport.test.ts`

**Interfaces:**
- Consumes: `computeTripFields`, `tripAreaHa`, `ImplementAt`, `TripFieldCalc` (Task 3); `loadAssignmentResolver`, `AssignmentResolver` (Task 2); `TxClient` (`src/server/db.ts`); `prisma.vehicleTripField`, `VehicleTrip.workEntries`, `TripImportState.assignments*` (Task 1).
- Produces (lisaks olemasolevatele `importDeviceTrips`, `refreshTripPlaces`, `importTenantTrips`, `runTripImport`, `startTripImportScheduler`, `ImportDeps`, `defaultDeps`, `FINAL_AFTER_MS`):
  ```ts
  export async function refreshTripAssignments(device: { id: string; imei: string }, deps?: ImportDeps): Promise<number>; // ümberarvutatud lõplike sõitude arv
  ```
  Iga sõidu kirjutamisel (import, kohtade või seoste ümberarvutus) asendatakse selle sõidu `vehicle_trip_fields` read ja `VehicleTrip.areaHa`. `importTenantTrips` kutsub seadme kohta `importDeviceTrips` → `refreshTripPlaces` → `refreshTripAssignments`.

- [ ] **Step 1: Testi seadistus ja uued testid**

`src/server/tripImport.test.ts` päis — asenda read alates `import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';` kuni `const device = () => ({ ...dev, id: deviceId });` (k.a) järgmisega:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma, authDb, runAsTenant } from './db';
import { importDeviceTrips, refreshTripPlaces, refreshTripAssignments, importTenantTrips, type ImportDeps } from './tripImport';
import type { TripSample } from './tripSegments';
import type { Place } from './tripRoute';

const T = `test-tenant-trips-${process.pid}`;
const T2 = `test-tenant-trips2-${process.pid}`;
const IMEI = `35${String(process.pid).padStart(13, '0')}`.slice(0, 15);
const IMEI_BAD = `36${String(process.pid).padStart(13, '0')}`.slice(0, 15);
// async + await: Prisma päringud on laisad ja käivituksid muidu väljaspool ettevõtte konteksti
const run = <R>(fn: () => PromiseLike<R>, t = T): Promise<R> => runAsTenant(t, async () => await fn());

const BASE = new Date('2026-10-22T05:00:00Z').getTime();
const at = (m: number) => new Date(BASE + m * 60_000);
const pt = (m: number, on = true, lat = 58.1 + m * 0.0001): TripSample => ({
  time: at(m), lat, lng: 26.1, ignition: on, speedKmh: 15, fuelUsedL: null, fuelRateLph: null, fuelLevelPct: null, engineHours: null
});
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => pt(a + i));
// Põld katab punktid lat 58.1 … 58.105, lng 26.1
const FIELD_GEOMETRY = {
  type: 'Polygon' as const,
  coordinates: [[[26.0995, 58.0995], [26.1005, 58.0995], [26.1005, 58.106], [26.0995, 58.106], [26.0995, 58.0995]]]
};

let samples: TripSample[] = [];
let places: Place[] = [];
let nowMin = 0;
let failImei: string | null = null;
const deps: ImportDeps = {
  now: () => at(nowMin),
  fetchSamples: async (imei, from, to) => {
    if (imei === failImei) throw new Error('tsdb maas');
    return samples.filter((s) => s.time > from && s.time <= to);
  },
  loadPlaces: async () => places
};

let deviceId = '';
let badDeviceId = '';
let vehicleId = '';
let impl6 = '';
let impl12 = '';
let implAsgId = '';
let fsId = 0;
let fieldWorkId = '';
const fieldPlace = (): Place => ({ id: String(fsId), kind: 'FIELD', label: 'Nr 1 Testpõld', geometry: FIELD_GEOMETRY });

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test sõidud' } });
  await authDb().tenant.create({ data: { id: T2, name: 'Test sõidud 2' } });
  await run(async () => {
    deviceId = (await prisma.telemetryDevice.create({ data: { imei: IMEI, model: 'FMC650' } })).id;
    badDeviceId = (await prisma.telemetryDevice.create({ data: { imei: IMEI_BAD, model: 'FMC650' } })).id;
    await prisma.deviceOwnership.create({ data: { kind: 'IMEI', identifier: IMEI, deviceId, validFrom: at(-60) } });
    await prisma.deviceOwnership.create({ data: { kind: 'IMEI', identifier: IMEI_BAD, deviceId: badDeviceId, validFrom: at(-60) } });
    vehicleId = (await prisma.vehicle.create({ data: { name: 'Importtraktor', type: 'TRACTOR', model: 'X' } })).id;
    impl6 = (await prisma.implement.create({ data: { name: 'Kultivaator 6 m', type: 'CULTIVATOR', workingWidthM: 6 } })).id;
    impl12 = (await prisma.implement.create({ data: { name: 'Kultivaator 12 m', type: 'CULTIVATOR', workingWidthM: 12 } })).id;
    await prisma.deviceAssignment.create({ data: { deviceId, vehicleId, startedAt: at(-60) } });
    implAsgId = (await prisma.implementAssignment.create({ data: { vehicleId, implementId: impl6, startedAt: at(-60) } })).id;
    const field = await prisma.field.create({ data: { num: '1', name: 'Testpõld', fieldCode: `TI-${process.pid}` } });
    fsId = (await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 5, crop: 'test', geometry: FIELD_GEOMETRY } })).id;
    const wt = await prisma.workType.create({ data: { name: 'Testkultiveerimine', phase: 'PREPARATION' } });
    fieldWorkId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fsId, workTypeId: wt.id, phase: 'PREPARATION' } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.vehicleTrip.deleteMany({});
    await prisma.tripImportState.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.implementAssignment.deleteMany({});
    await prisma.deviceAssignment.deleteMany({});
    await prisma.implement.deleteMany({});
    await prisma.vehicle.deleteMany({});
    await prisma.deviceOwnership.deleteMany({});
    await prisma.telemetryDevice.deleteMany({});
    await prisma.pointOfInterest.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: { in: [T, T2] } } });
});

beforeEach(async () => {
  samples = [];
  places = [];
  failImei = null;
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.vehicleTrip.deleteMany({});
    await prisma.tripImportState.deleteMany({});
  });
});

const trips = () => run(() => prisma.vehicleTrip.findMany({ where: { deviceId }, orderBy: { startedAt: 'asc' } }));
const fieldRows = () => run(() => prisma.vehicleTripField.findMany({ orderBy: { arriveAt: 'asc' } }));
const dev = { id: '', imei: IMEI };
const device = () => ({ ...dev, id: deviceId });
```

`describe('importDeviceTrips', ...)` ploki lõppu (pärast testi `'mõõdikud ja kohad salvestuvad'`, enne ploki sulgevat `});`) lisa:

```ts
  it('sõidule tekivad põllured ja ha haakeriista laiusega', async () => {
    places = [fieldPlace()];
    samples = range(0, 30);
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    const [t] = await trips();
    const f = await fieldRows();
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ tripId: t.id, fieldSeasonId: fsId, activeMinutes: 30, implementId: impl6, widthM: 6 });
    expect(f[0].arriveAt).toEqual(at(0)); // esimene aken algab omandiperioodi algusest at(-60), punkt 0 on põllul
    expect(f[0].leaveAt).toEqual(at(30));
    expect(f[0].areaHa!).toBeGreaterThan(0.15);
    expect(t.areaHa).toBe(f[0].areaHa);
  });

  it('kandega seotud sõidu id säilib liitumisel', async () => {
    samples = [...range(0, 10), ...range(40, 50)];
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    const t = await trips();
    expect(t).toHaveLength(2);
    const entry = await run(() => prisma.workEntry.create({ data: { fieldWorkId, date: new Date('2026-10-22T00:00:00Z'), tripId: t[1].id } }));
    samples = range(0, 50); // auk täitus
    await run(() => importDeviceTrips(device(), deps));
    const merged = await trips();
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe(t[1].id);
    const e = await run(() => prisma.workEntry.findUnique({ where: { id: entry.id } }));
    expect(e!.tripId).toBe(t[1].id);
  });
```

Faili lõppu lisa:

```ts
describe('refreshTripAssignments', () => {
  it('haakeriista vahetus haakimise registris arvutab lõpliku sõidu ha ümber', async () => {
    places = [fieldPlace()];
    samples = range(0, 30);
    nowMin = 30 * 60;
    await run(() => importDeviceTrips(device(), deps));
    expect(await run(() => refreshTripAssignments(device(), deps))).toBe(0); // esimene kord: ainult sõrmejälg
    const [before] = await fieldRows();
    expect(before.widthM).toBe(6);
    await run(() => prisma.tripImportState.update({ where: { deviceId }, data: { assignmentsCheckedAt: new Date() } }));
    await run(() => prisma.implementAssignment.update({ where: { id: implAsgId }, data: { implementId: impl12 } }));
    try {
      expect(await run(() => refreshTripAssignments(device(), deps))).toBe(1);
      const [after] = await fieldRows();
      expect(after).toMatchObject({ implementId: impl12, widthM: 12 });
      expect(after.areaHa!).toBeGreaterThan(before.areaHa! * 1.8);
      expect((await trips())[0].areaHa).toBe(after.areaHa);
      expect(await run(() => refreshTripAssignments(device(), deps))).toBe(0); // muutuseta
    } finally {
      await run(() => prisma.implementAssignment.update({ where: { id: implAsgId }, data: { implementId: impl6 } }));
    }
  });

  it('kustutatud haakimine: põllurea haakeriist ei vasta enam registrile → ha tühjaks', async () => {
    places = [fieldPlace()];
    samples = range(0, 30);
    nowMin = 30 * 60;
    await run(() => importDeviceTrips(device(), deps));
    await run(() => refreshTripAssignments(device(), deps));
    // Kontrollaeg päris kellaga: ainult põllurea võrdlus (mitte muudetud periood) leiab sõidu
    await run(() => prisma.tripImportState.update({ where: { deviceId }, data: { assignmentsCheckedAt: new Date() } }));
    await run(() => prisma.implementAssignment.delete({ where: { id: implAsgId } }));
    try {
      expect(await run(() => refreshTripAssignments(device(), deps))).toBe(1);
      const [f] = await fieldRows();
      expect(f).toMatchObject({ implementId: null, widthM: null, areaHa: null });
      expect((await trips())[0].areaHa).toBeNull();
    } finally {
      implAsgId = (await run(() => prisma.implementAssignment.create({ data: { vehicleId, implementId: impl6, startedAt: at(-60) } }))).id;
    }
  });

  it('kohtade ümberarvutus kirjutab ka põllud', async () => {
    samples = range(0, 30);
    nowMin = 30 * 60;
    await run(() => importDeviceTrips(device(), deps));
    await run(() => refreshTripPlaces(device(), deps)); // esimene kord: ainult sõrmejälg
    expect(await fieldRows()).toHaveLength(0);
    // Uus hooaja geomeetria muudab kohtade sõrmejälge; põld on nüüd kohtade hulgas
    await run(() => prisma.fieldSeason.update({ where: { id: fsId }, data: { notes: `muudetud ${Date.now()}` } }));
    places = [fieldPlace()];
    expect(await run(() => refreshTripPlaces(device(), deps))).toBe(1);
    expect(await fieldRows()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Kontrolli, et testid ebaõnnestuvad**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tripImport.test.ts'`
Expected: FAIL (`refreshTripAssignments` pole eksporditud / põllured puuduvad).

- [ ] **Step 3: Asenda `src/server/tripImport.ts`**

```ts
// src/server/tripImport.ts — sõitude taustaimport telemeetriast (iga 15 min).
// Seadme kaupa: punktid (finalizedUntil, now] omandiperioodi piires → segmentTrips → kohad (buildRoute) ja põllud (computeTripFields)
// → vehicle_trips + vehicle_trip_fields. Viimased 24 h arvutatakse igal käigul uuesti (seade puhverdab levita punkte ja saadab hiljem).
// Kattuv vana sõit annab uuele oma id (märkus ja kande seos püsivad); kandega seotud vana sõit on eelistatud.
// Lõplikud sõidud arvutatakse uuesti, kui kohad (põllud, huvipunktid) või seosed (seade, haakimine, haakeriist) muutuvad;
// põllud kirjutatakse alati koos sõidu kohtadega.
import { prisma, tenantTransaction, authDb, runAsTenant, tsdb, type TxClient } from './db.ts';
import { ownershipWindows, fetchTripSamples } from './telemetryAccess.ts';
import { segmentTrips, type SegmentedTrip, type TripSample } from './tripSegments.ts';
import { buildRoute, DEFAULT_ROUTE_OPTIONS, type Place, type TripRoute } from './tripRoute.ts';
import { loadPlaces } from './tripPlaces.ts';
import { computeTripFields, tripAreaHa, type ImplementAt, type TripFieldCalc } from './tripFields.ts';
import { loadAssignmentResolver, type AssignmentResolver } from './tripAssignments.ts';

export type ImportDeps = {
  now: () => Date;
  fetchSamples: (imei: string, fromExclusive: Date, toInclusive: Date) => Promise<TripSample[]>;
  loadPlaces: (year: number) => Promise<Place[]>;
};

export const defaultDeps: ImportDeps = { now: () => new Date(), fetchSamples: fetchTripSamples, loadPlaces };

export const FINAL_AFTER_MS = 24 * 60 * 60 * 1000;
const CHUNK_MS = 2 * 24 * 60 * 60 * 1000;
const INTERVAL_MS = 15 * 60 * 1000;
const PLACE_MARGIN_DEG = 0.003; // ~200–300 m: lähima koha otsingu raadius
const MAX_ERROR_LEN = 500;

type Device = { id: string; imei: string };
type StoredTrip = { id: string; startedAt: Date; endedAt: Date; fuelLiters: number | null };

function placesCache(deps: ImportDeps) {
  const cache = new Map<number, Promise<Place[]>>();
  return (year: number) => {
    if (!cache.has(year)) cache.set(year, deps.loadPlaces(year));
    return cache.get(year)!;
  };
}

function routeOf(t: { points: TripSample[] }, places: Place[]): TripRoute | null {
  try {
    return buildRoute(t.points, places, DEFAULT_ROUTE_OPTIONS);
  } catch (err) {
    console.warn('trip import: route failed', err);
    return null;
  }
}

const implementAtOf = (resolve: AssignmentResolver, deviceId: string): ImplementAt => (at) => {
  const r = resolve(deviceId, at);
  return { implementId: r.implementId, widthM: r.widthM };
};

function fieldsOf(samples: TripSample[], places: Place[], tripFuelL: number | null, implementAt: ImplementAt): TripFieldCalc[] {
  try {
    return computeTripFields(samples, places, tripFuelL, implementAt);
  } catch (err) {
    console.warn('trip import: fields failed', err);
    return [];
  }
}

// Sõidu ajavahemiku punktid koos süüte väljas punktidega (pausid)
const samplesOf = (samples: TripSample[], t: SegmentedTrip) => samples.filter((s) => s.time >= t.startedAt && s.time <= t.endedAt);

const placeJson = (stop: TripRoute['start'] | undefined) =>
  stop ? { place: stop.place, ...(stop.near ? { near: stop.near } : {}) } : { place: null };

function tripData(t: SegmentedTrip, route: TripRoute | null, fields: TripFieldCalc[], now: Date) {
  const first = t.points[0];
  const last = t.points[t.points.length - 1];
  return {
    startedAt: t.startedAt, endedAt: t.endedAt, status: t.status,
    startLat: first.lat, startLng: first.lng, startPlace: placeJson(route?.start),
    endLat: last.lat, endLng: last.lng, endPlace: placeJson(route?.end),
    visits: (route?.visits ?? []) as object[],
    distanceKm: t.distanceKm, movingMinutes: t.movingMinutes, idleMinutes: t.idleMinutes,
    pauseCount: t.pauseCount, pauseMinutes: t.pauseMinutes,
    maxSpeedKmh: t.maxSpeedKmh, avgSpeedKmh: t.avgSpeedKmh,
    fuelLiters: t.fuelLiters, fuelLevelStartPct: t.fuelLevelStartPct, fuelLevelEndPct: t.fuelLevelEndPct,
    engineHoursStart: t.engineHoursStart, engineHoursEnd: t.engineHoursEnd,
    minLat: t.minLat, minLng: t.minLng, maxLat: t.maxLat, maxLng: t.maxLng,
    pointCount: t.pointCount, areaHa: tripAreaHa(fields), computedAt: now
  };
}

// Üheaegsed impordid (CLI ja ajastaja) ei tohi sama seadme sõite korraga kirjutada
const lockDevice = (tx: TxClient, deviceId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('trip-import:' || current_setting('app.tenant_id') || ':' || ${deviceId}))`;

async function writeFields(tx: TxClient, tripId: string, fields: TripFieldCalc[], now: Date) {
  await tx.vehicleTripField.deleteMany({ where: { tripId } });
  if (fields.length) await tx.vehicleTripField.createMany({ data: fields.map((f) => ({ ...f, tripId, computedAt: now })) });
}

async function writeChunk(
  deviceId: string, from: Date, to: Date, trips: SegmentedTrip[], routes: (TripRoute | null)[],
  fields: TripFieldCalc[][], now: Date, finalizedUntil: Date
) {
  await tenantTransaction(async (tx) => {
    await lockDevice(tx, deviceId);
    const existing = await tx.vehicleTrip.findMany({
      where: { deviceId, startedAt: { gt: from, lte: to } },
      orderBy: { startedAt: 'asc' },
      select: { id: true, startedAt: true, endedAt: true, _count: { select: { workEntries: true } } }
    });
    const used = new Set<string>();
    const matchIds = trips.map((t) => {
      const overlapping = existing.filter((e) => !used.has(e.id) && e.startedAt <= t.endedAt && e.endedAt >= t.startedAt);
      // Kandega seotud vana sõit on eelistatud: liitumisel kande seos ei kao
      const m = overlapping.find((e) => e._count.workEntries > 0) ?? overlapping[0];
      if (m) used.add(m.id);
      return m?.id ?? null;
    });
    const stale = existing.filter((e) => !used.has(e.id)).map((e) => e.id);
    if (stale.length) await tx.vehicleTrip.deleteMany({ where: { id: { in: stale } } });
    for (let i = 0; i < trips.length; i++) {
      const data = tripData(trips[i], routes[i], fields[i], now);
      const id = matchIds[i];
      const saved = id
        ? await tx.vehicleTrip.update({ where: { id }, data, select: { id: true } })
        : await tx.vehicleTrip.create({ data: { deviceId, ...data }, select: { id: true } });
      await writeFields(tx, saved.id, fields[i], now);
    }
    await tx.tripImportState.upsert({
      where: { deviceId },
      create: { deviceId, finalizedUntil, lastRunAt: now, lastError: null, lastErrorAt: null },
      update: { finalizedUntil, lastRunAt: now, lastError: null, lastErrorAt: null }
    });
  }, { timeout: 60_000 });
}

export async function importDeviceTrips(device: Device, deps: ImportDeps = defaultDeps): Promise<void> {
  const windows = (await ownershipWindows('IMEI', [device.imei])).get(device.imei) ?? [];
  if (windows.length === 0) return;
  const state = await prisma.tripImportState.findUnique({ where: { deviceId: device.id } });
  const placesFor = placesCache(deps);
  const implementAt = implementAtOf(await loadAssignmentResolver([device.id]), device.id);
  const now = deps.now();
  let from = state?.finalizedUntil ?? new Date(Math.min(...windows.map((w) => w.from.getTime())));
  // Kui üle 24 h kestev sõit on aknas lõpetamata, ei liiguks lõplik piir edasi ja tsükkel jääks igavesti samale kohale.
  // Siis laiendame akent (span kahekordistub), kuni sõit lõpeb või aken jõuab tänaseni; lõpptulemus on sama, mis kogu vahemiku korraga töötlemisel.
  let span = CHUNK_MS;
  for (;;) {
    const to = new Date(Math.min(from.getTime() + span, now.getTime()));
    const samples = await deps.fetchSamples(device.imei, from, to);
    const trips = segmentTrips(samples, to);
    const finalCut = to.getTime() - FINAL_AFTER_MS;
    const firstOpen = trips.find((t) => t.status === 'ACTIVE' || t.endedAt.getTime() > finalCut);
    let next = firstOpen ? Math.min(finalCut, firstOpen.startedAt.getTime() - 1) : finalCut;
    if (next < from.getTime()) next = from.getTime();
    const last = to.getTime() >= now.getTime();
    if (!last && next <= from.getTime()) {
      span *= 2;
      continue;
    }
    const routes: (TripRoute | null)[] = [];
    const fields: TripFieldCalc[][] = [];
    for (const t of trips) {
      const places = await placesFor(t.startedAt.getUTCFullYear());
      routes.push(routeOf(t, places));
      fields.push(fieldsOf(samplesOf(samples, t), places, t.fuelLiters, implementAt));
    }
    await writeChunk(device.id, from, to, trips, routes, fields, now, new Date(next));
    if (last) return;
    from = new Date(next);
    span = CHUNK_MS;
  }
}

/** Lõpliku sõidu kohad ja põllud uuesti (kohtade või seoste muutus). false = punkte pole, teekond ebaõnnestus või sõit kadus. */
async function recomputeTrip(device: Device, t: StoredTrip, places: Place[], implementAt: ImplementAt, deps: ImportDeps, now: Date): Promise<boolean> {
  const samples = await deps.fetchSamples(device.imei, new Date(t.startedAt.getTime() - 1), t.endedAt);
  const points = samples.filter((s) => s.ignition !== false);
  if (points.length === 0) return false;
  const route = routeOf({ points }, places);
  if (!route) return false;
  const fields = fieldsOf(samples, places, t.fuelLiters, implementAt);
  return tenantTransaction(async (tx) => {
    await lockDevice(tx, device.id);
    // Sõit võis vahepeal liitumisel kaduda
    const updated = await tx.vehicleTrip.updateMany({
      where: { id: t.id },
      data: {
        startPlace: placeJson(route.start), endPlace: placeJson(route.end), visits: route.visits as object[],
        areaHa: tripAreaHa(fields), computedAt: now
      }
    });
    if (updated.count === 0) return false;
    await writeFields(tx, t.id, fields, now);
    return true;
  }, { timeout: 60_000 });
}

// --- Kohtade ümberarvutus --------------------------------------------------

async function placesFingerprint(): Promise<string> {
  const [poi, fs] = await Promise.all([
    prisma.pointOfInterest.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.fieldSeason.aggregate({ _count: { _all: true }, _max: { updatedAt: true } })
  ]);
  return `${poi._count._all}:${poi._max.updatedAt?.toISOString() ?? ''}:${fs._count._all}:${fs._max.updatedAt?.toISOString() ?? ''}`;
}

type Box = { minLat: number; minLng: number; maxLat: number; maxLng: number };

async function changedPlaceBoxes(since: Date): Promise<Box[]> {
  const [pois, seasons] = await Promise.all([
    prisma.pointOfInterest.findMany({ where: { updatedAt: { gt: since } }, select: { latitude: true, longitude: true } }),
    prisma.fieldSeason.findMany({ where: { updatedAt: { gt: since } }, select: { geometry: true } })
  ]);
  const boxes: Box[] = pois.map((p) => ({ minLat: p.latitude, maxLat: p.latitude, minLng: p.longitude, maxLng: p.longitude }));
  for (const s of seasons) {
    const g = s.geometry as any;
    const coords: number[][] = g?.type === 'Polygon' ? g.coordinates.flat() : g?.type === 'MultiPolygon' ? g.coordinates.flat(2) : [];
    if (coords.length === 0) continue;
    const lats = coords.map((c) => c[1]);
    const lngs = coords.map((c) => c[0]);
    boxes.push({ minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) });
  }
  return boxes;
}

const overlaps = (a: Box, b: Box) =>
  a.minLat - PLACE_MARGIN_DEG <= b.maxLat && a.maxLat + PLACE_MARGIN_DEG >= b.minLat &&
  a.minLng - PLACE_MARGIN_DEG <= b.maxLng && a.maxLng + PLACE_MARGIN_DEG >= b.minLng;

function referencedIds(t: { startPlace: unknown; endPlace: unknown; visits: unknown }): string[] {
  const ids: string[] = [];
  for (const p of [t.startPlace, t.endPlace] as any[]) {
    if (p?.place?.id) ids.push(p.place.id);
    if (p?.near?.id) ids.push(p.near.id);
  }
  for (const v of ((t.visits as any[]) ?? [])) if (v?.place?.id) ids.push(v.place.id);
  return ids;
}

export async function refreshTripPlaces(device: Device, deps: ImportDeps = defaultDeps): Promise<number> {
  const state = await prisma.tripImportState.findUnique({ where: { deviceId: device.id } });
  if (!state) return 0;
  const fp = await placesFingerprint();
  if (fp === state.placesFingerprint) return 0;
  const now = deps.now();
  let count = 0;
  if (state.placesCheckedAt && state.finalizedUntil) {
    const boxes = await changedPlaceBoxes(state.placesCheckedAt);
    const placesFor = placesCache(deps);
    const implementAt = implementAtOf(await loadAssignmentResolver([device.id]), device.id);
    const trips = await prisma.vehicleTrip.findMany({ where: { deviceId: device.id, startedAt: { lte: state.finalizedUntil } } });
    for (const t of trips) {
      const places = await placesFor(t.startedAt.getUTCFullYear());
      const known = new Set(places.map((p) => p.id));
      const hit = boxes.some((b) => overlaps(t, b)) || referencedIds(t).some((id) => !known.has(id));
      if (!hit) continue;
      if (await recomputeTrip(device, t, places, implementAt, deps, now)) count++;
    }
  }
  await prisma.tripImportState.update({ where: { deviceId: device.id }, data: { placesFingerprint: fp, placesCheckedAt: now } });
  return count;
}

// --- Seoste ümberarvutus (seade ↔ masin/haakeriist, haakimine, haakeriista laius) ---------

async function assignmentsFingerprint(): Promise<string> {
  const [da, ia, im] = await Promise.all([
    prisma.deviceAssignment.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.implementAssignment.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    prisma.implement.aggregate({ _count: { _all: true }, _max: { updatedAt: true } })
  ]);
  return [da, ia, im].map((a) => `${a._count._all}:${a._max.updatedAt?.toISOString() ?? ''}`).join('|');
}

type Period = { startedAt: Date; endedAt: Date | null };
const periodOverlaps = (p: Period, t: { startedAt: Date; endedAt: Date }) =>
  p.startedAt <= t.endedAt && (!p.endedAt || p.endedAt >= t.startedAt);
const normWidth = (w: number | null) => (w != null && w > 0 ? w : null);

export async function refreshTripAssignments(device: Device, deps: ImportDeps = defaultDeps): Promise<number> {
  const state = await prisma.tripImportState.findUnique({ where: { deviceId: device.id } });
  if (!state) return 0;
  const fp = await assignmentsFingerprint();
  if (fp === state.assignmentsFingerprint) return 0;
  const now = deps.now();
  let count = 0;
  if (state.assignmentsCheckedAt && state.finalizedUntil) {
    const since = state.assignmentsCheckedAt;
    const implementAt = implementAtOf(await loadAssignmentResolver([device.id]), device.id);
    const deviceRows = await prisma.deviceAssignment.findMany({
      where: { deviceId: device.id },
      select: { vehicleId: true, implementId: true, startedAt: true, endedAt: true, updatedAt: true }
    });
    const vehicleIds = deviceRows.map((a) => a.vehicleId).filter((x): x is string => !!x);
    const implementIds = deviceRows.map((a) => a.implementId).filter((x): x is string => !!x);
    const [implRows, changedImplements] = await Promise.all([
      prisma.implementAssignment.findMany({
        where: { updatedAt: { gt: since }, OR: [{ vehicleId: { in: vehicleIds } }, { implementId: { in: implementIds } }] },
        select: { startedAt: true, endedAt: true }
      }),
      prisma.implement.findMany({ where: { updatedAt: { gt: since } }, select: { id: true } })
    ]);
    const changedPeriods: Period[] = [...deviceRows.filter((a) => a.updatedAt > since), ...implRows];
    const changedImpl = new Set(changedImplements.map((i) => i.id));
    const trips = await prisma.vehicleTrip.findMany({
      where: { deviceId: device.id, startedAt: { lte: state.finalizedUntil } },
      include: { fields: { select: { arriveAt: true, implementId: true, widthM: true } } }
    });
    const placesFor = placesCache(deps);
    for (const t of trips) {
      const hit = changedPeriods.some((p) => periodOverlaps(p, t))
        || t.fields.some((f) => f.implementId != null && changedImpl.has(f.implementId))
        // Kustutatud seos: põllurea haakeriist või laius ei vasta enam seoste registrile
        || t.fields.some((f) => {
          const cur = implementAt(f.arriveAt);
          return cur.implementId !== f.implementId || normWidth(cur.widthM) !== f.widthM;
        });
      if (!hit) continue;
      if (await recomputeTrip(device, t, await placesFor(t.startedAt.getUTCFullYear()), implementAt, deps, now)) count++;
    }
  }
  await prisma.tripImportState.update({ where: { deviceId: device.id }, data: { assignmentsFingerprint: fp, assignmentsCheckedAt: now } });
  return count;
}

// --- Ettevõte ja kõik ettevõtted ------------------------------------------------

export async function importTenantTrips(deps: ImportDeps = defaultDeps): Promise<{ devices: number; failed: number }> {
  const devices = await prisma.telemetryDevice.findMany({
    where: { connectivityType: 'CELLULAR', imei: { not: null } },
    select: { id: true, imei: true }
  });
  let failed = 0;
  for (const d of devices) {
    const device = { id: d.id, imei: d.imei! };
    try {
      await importDeviceTrips(device, deps);
      await refreshTripPlaces(device, deps);
      await refreshTripAssignments(device, deps);
    } catch (err) {
      failed++;
      const msg = (err instanceof Error ? err.message : String(err)).slice(0, MAX_ERROR_LEN);
      console.error(`trip import: device ${device.imei} failed:`, err);
      const now = deps.now();
      await prisma.tripImportState.upsert({
        where: { deviceId: device.id },
        create: { deviceId: device.id, lastRunAt: now, lastError: msg, lastErrorAt: now },
        update: { lastRunAt: now, lastError: msg, lastErrorAt: now }
      }).catch((e) => console.error('trip import: state write failed', e));
    }
  }
  return { devices: devices.length, failed };
}

let running = false;

/** Kõik ettevõtted, kelle litsentsis on TELEMETRY. Kui eelmine käik veel käib, ei tee midagi. */
export async function runTripImport(deps: ImportDeps = defaultDeps): Promise<void> {
  if (running) return;
  running = true;
  try {
    if (!tsdb) return;
    const licenses = await authDb().tenantLicense.findMany({ select: { tenantId: true, modules: true } });
    for (const l of licenses.filter((x) => x.modules.includes('TELEMETRY'))) {
      try {
        const r = await runAsTenant(l.tenantId, () => importTenantTrips(deps));
        if (r.failed) console.warn(`trip import: ${l.tenantId} ${r.failed}/${r.devices} seadet ebaõnnestus`);
      } catch (err) {
        console.error(`trip import: tenant ${l.tenantId} failed:`, err);
      }
    }
  } finally {
    running = false;
  }
}

export function startTripImportScheduler(): void {
  const tick = () => { runTripImport().catch((err) => console.error('trip import failed:', err)); };
  tick();
  setInterval(tick, INTERVAL_MS).unref();
}
```

- [ ] **Step 4: Testid läbivad**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/tripImport.test.ts src/server/tripSegments.test.ts'`
Expected: PASS (sh vanad testid: liitumine ilma kandeta võtab endiselt esimese kattuva sõidu id).

- [ ] **Step 5: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/tripImport.ts src/server/tripImport.test.ts && git commit -m "feat(soidu-pollud): põllured impordis; ümberarvutus kohtade ja seoste muutusel; kandega sõidu id ülevõtt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 5: Kande soovitused registrist ja kande `tripId` (server)

**Files:**
- Create: `src/server/tripSuggestions.ts`
- Test: `src/server/tripSuggestions.test.ts`
- Modify: `src/server/fieldWorks.ts` (importid; `resolveEntryInput`; `entryDto`; vana soovitusfunktsiooni eemaldus; POST/PUT `/api/work-entries`)
- Modify (eemaldus): `src/server/telemetryAccess.ts` (`allOwnershipWindows`, `FieldGpsRow`, `fetchFieldGpsPackets`), `src/server/tripRoute.ts` (`segmentTrip`), `src/server/tripRoute.test.ts` (`segmentTrip` testid), `src/server/telemetryHistory.test.ts` (live-andmetel GPS-soovituse testid)

**Interfaces:**
- Consumes: `loadAssignmentResolver` (Task 2); `tallinnMidnightUtc(isoDay: string): Date` (`src/server/mcp/ignitionHours.ts`); `prisma.vehicleTripField`, `WorkEntry.tripId` (Task 1).
- Produces:
  ```ts
  export interface TelemetrySuggestion { id: string; tripId: string; vehicleId: string | null; vehicleName: string | null;
    implementId: string | null; implementName: string | null; workerId: string | null; workerName: string | null;
    startTime: string; endTime: string; fieldStartTime: string; fieldEndTime: string; durationHours: number;
    workedAreaHa: number | null; fuelLiters: number | null; pointCount: number; linked: boolean; route?: TripRoute }
  export const TRIP_NOT_ON_FIELD = 'Valitud sõit ei käinud sellel põllul';
  export const TRIP_TAKEN = 'Valitud sõit on juba selle põllu teise kandega seotud';
  export async function getTelemetrySuggestionsForField(fieldSeasonId: number, dateStr: string, excludeEntryId?: string | null): Promise<TelemetrySuggestion[]>;
  export async function entryTripError(tripId: string, fieldSeasonId: number, entryId: string | null): Promise<string | null>;
  ```
  HTTP: `GET /api/field-works/telemetry-suggestions` (sama tee ja parameetrid). Kande DTO-l `tripId: string | null`. `POST /api/work-entries` võtab `tripId`; `PUT` võtab `tripId` (võti puudub → seos jääb; `null` → eemaldab). Vale `tripId` → 400 `{ error: TRIP_NOT_ON_FIELD | TRIP_TAKEN }`.

- [ ] **Step 1: Kirjuta testid**

```ts
// src/server/tripSuggestions.test.ts — kande soovitused sõitude registrist ja kande sõidu seos (live-andmebaas, ajutine ettevõte).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, runAsTenant } from './db';
import { setSessionUserForTest } from './authGate';
import { handleFieldWorks } from './fieldWorks';
import { TRIP_NOT_ON_FIELD, TRIP_TAKEN } from './tripSuggestions';

const T = `test-tenant-tripsug-${process.pid}`;
const IMEI = `38${String(process.pid).padStart(13, '0')}`.slice(0, 15);
const run = <R>(fn: () => PromiseLike<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(s);

const ADMIN = {
  id: `tripsug-u-${process.pid}`, username: `tripsug-${process.pid}`, displayName: null, passwordHash: '', isActive: true,
  isAdmin: true, isFinanceManager: true, mustChangePassword: false, tenantId: T
};

async function call(method: string, path: string, body?: unknown) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Object.assign(Readable.from(raw ? [Buffer.from(raw)] : []), {
    method, url: path, headers: { host: 'localhost', 'content-type': 'application/json' }, socket: {}
  }) as unknown as IncomingMessage;
  setSessionUserForTest(req, ADMIN);
  const out = { status: 200, body: '' };
  const res = {
    statusCode: 200,
    setHeader() {}, writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  const url = new URL(path, 'http://localhost');
  await run(() => handleFieldWorks(req, res, url.pathname, method, url));
  return { status: out.status, json: out.body ? JSON.parse(out.body) : null };
}

const s = { fsA: 0, fsB: 0, fwA: '', fwA2: '', fwB: '', trip: '', trip2: '', vehicle: '', implement: '' };

const tripRow = (deviceId: string, startedAt: Date, endedAt: Date) => ({
  deviceId, startedAt, endedAt, status: 'CLOSED' as const,
  startLat: 58, startLng: 26, startPlace: { place: null }, endLat: 58.01, endLng: 26, endPlace: { place: null },
  visits: [], distanceKm: 5, movingMinutes: 100, idleMinutes: 10, pauseCount: 0, pauseMinutes: 0,
  maxSpeedKmh: 20, avgSpeedKmh: 9, fuelLiters: 30, fuelLevelStartPct: null, fuelLevelEndPct: null,
  engineHoursStart: null, engineHoursEnd: null, minLat: 58, minLng: 26, maxLat: 58.01, maxLng: 26,
  pointCount: 120, computedAt: new Date()
});

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test sõidu soovitused' } });
  await authDb().user.create({ data: { id: ADMIN.id, username: ADMIN.username, passwordHash: '', isAdmin: true, isFinanceManager: true, tenantId: T } });
  await run(async () => {
    const device = (await prisma.telemetryDevice.create({ data: { imei: IMEI, model: 'FMC650' } })).id;
    s.vehicle = (await prisma.vehicle.create({ data: { name: 'Soovitustraktor', type: 'TRACTOR', model: 'X' } })).id;
    s.implement = (await prisma.implement.create({ data: { name: 'Külvik 6 m', type: 'SEEDER', workingWidthM: 6 } })).id;
    await prisma.deviceAssignment.create({ data: { deviceId: device, vehicleId: s.vehicle, startedAt: d('2026-10-01T00:00:00Z') } });
    await prisma.implementAssignment.create({ data: { vehicleId: s.vehicle, implementId: s.implement, startedAt: d('2026-10-01T00:00:00Z') } });
    const fieldA = await prisma.field.create({ data: { num: '1', name: 'Kodu', fieldCode: 'S-1' } });
    const fieldB = await prisma.field.create({ data: { num: '2', name: 'Taga', fieldCode: 'S-2' } });
    s.fsA = (await prisma.fieldSeason.create({ data: { fieldId: fieldA.id, year: 2026, areaHa: 10, crop: 'test', geometry: {} } })).id;
    s.fsB = (await prisma.fieldSeason.create({ data: { fieldId: fieldB.id, year: 2026, areaHa: 10, crop: 'test', geometry: {} } })).id;
    const sowing = await prisma.workType.create({ data: { name: 'Testkülv', phase: 'SOWING' } });
    const harrow = await prisma.workType.create({ data: { name: 'Testäestus', phase: 'PREPARATION' } });
    s.fwA = (await prisma.fieldWork.create({ data: { fieldSeasonId: s.fsA, workTypeId: sowing.id, phase: 'SOWING' } })).id;
    s.fwA2 = (await prisma.fieldWork.create({ data: { fieldSeasonId: s.fsA, workTypeId: harrow.id, phase: 'PREPARATION' } })).id;
    s.fwB = (await prisma.fieldWork.create({ data: { fieldSeasonId: s.fsB, workTypeId: sowing.id, phase: 'SOWING' } })).id;
    // 10.10.2026 (EEST, UTC+3): sõit 09:00–12:00, põld A 09:30–10:30, põld B 10:45–11:45
    s.trip = (await prisma.vehicleTrip.create({ data: tripRow(device, d('2026-10-10T06:00:00Z'), d('2026-10-10T09:00:00Z')) })).id;
    s.trip2 = (await prisma.vehicleTrip.create({ data: tripRow(device, d('2026-10-10T10:00:00Z'), d('2026-10-10T11:00:00Z')) })).id;
    const now = new Date();
    await prisma.vehicleTripField.create({ data: {
      tripId: s.trip, fieldSeasonId: s.fsA, arriveAt: d('2026-10-10T06:30:00Z'), leaveAt: d('2026-10-10T07:30:00Z'),
      activeMinutes: 55, areaHa: 3.5, implementId: s.implement, widthM: 6, fuelFieldL: 15, fuelSharedL: 20, computedAt: now
    } });
    await prisma.vehicleTripField.create({ data: {
      tripId: s.trip, fieldSeasonId: s.fsB, arriveAt: d('2026-10-10T07:45:00Z'), leaveAt: d('2026-10-10T08:45:00Z'),
      activeMinutes: 50, areaHa: 2, implementId: s.implement, widthM: 6, fuelFieldL: 8, fuelSharedL: 10, computedAt: now
    } });
    await prisma.vehicleTripField.create({ data: {
      tripId: s.trip2, fieldSeasonId: s.fsB, arriveAt: d('2026-10-10T10:10:00Z'), leaveAt: d('2026-10-10T10:50:00Z'),
      activeMinutes: 40, computedAt: now
    } });
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.vehicleTrip.deleteMany({});
    await prisma.implementAssignment.deleteMany({});
    await prisma.deviceAssignment.deleteMany({});
    await prisma.implement.deleteMany({});
    await prisma.vehicle.deleteMany({});
    await prisma.telemetryDevice.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.stockDocument.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().user.deleteMany({ where: { id: ADMIN.id } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().tenant.delete({ where: { id: T } });
});

const SUG = (fs: number, extra = '') => `/api/field-works/telemetry-suggestions?fieldSeasonId=${fs}&date=2026-10-10${extra}`;

describe('kande soovitused sõitude registrist', () => {
  it('põld A: sõidu algus; lõpp põllult lahkumisel (järgmine põld); aeg, ha ja kütus registrist', async () => {
    const r = await call('GET', SUG(s.fsA));
    expect(r.status).toBe(200);
    expect(r.json).toHaveLength(1);
    expect(r.json[0]).toMatchObject({
      id: s.trip, tripId: s.trip, vehicleId: s.vehicle, vehicleName: 'Soovitustraktor',
      implementId: s.implement, implementName: 'Külvik 6 m',
      startTime: '09:00', endTime: '10:30', fieldStartTime: '09:30', fieldEndTime: '10:30',
      durationHours: 0.92, workedAreaHa: 3.5, fuelLiters: 20, pointCount: 120, linked: false
    });
    expect(r.json[0].route.start.time).toBe('2026-10-10T06:00:00.000Z');
    expect(r.json[0].route.end.time).toBe('2026-10-10T09:00:00.000Z');
  });

  it('põld B: algus põllule jõudmisel (enne käis teisel põllul), lõpp sõidu lõpus; laiuseta ha tühi', async () => {
    const r = await call('GET', SUG(s.fsB));
    expect(r.json.find((x: any) => x.tripId === s.trip)).toMatchObject({ startTime: '10:45', endTime: '12:00' });
    expect(r.json.find((x: any) => x.tripId === s.trip2)).toMatchObject({ workedAreaHa: null, fuelLiters: null });
  });

  it('teisel päeval soovitusi pole', async () => {
    const r = await call('GET', `/api/field-works/telemetry-suggestions?fieldSeasonId=${s.fsA}&date=2026-10-11`);
    expect(r.json).toEqual([]);
  });
});

describe('kande sõidu seos', () => {
  let entryA = '';

  it('kanne seotakse sõiduga; sama hooaja teisele kandele sõitu ei pakuta, muudetavale on see seotud', async () => {
    const r = await call('POST', '/api/work-entries', { fieldWorkId: s.fwA, date: '2026-10-10', tripId: s.trip });
    expect(r.status).toBe(200);
    expect(r.json.tripId).toBe(s.trip);
    entryA = r.json.id;
    expect((await call('GET', SUG(s.fsA))).json).toHaveLength(0);
    const own = await call('GET', SUG(s.fsA, `&excludeEntryId=${entryA}`));
    expect(own.json).toHaveLength(1);
    expect(own.json[0].linked).toBe(true);
  });

  it('sama hooaja teine kanne samale sõidule → 400', async () => {
    const r = await call('POST', '/api/work-entries', { fieldWorkId: s.fwA2, date: '2026-10-10', tripId: s.trip });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe(TRIP_TAKEN);
  });

  it('teise põllu kanne samale sõidule on lubatud', async () => {
    const r = await call('POST', '/api/work-entries', { fieldWorkId: s.fwB, date: '2026-10-10', tripId: s.trip });
    expect(r.status).toBe(200);
    expect(r.json.tripId).toBe(s.trip);
  });

  it('sõit, mis põllul ei käinud → 400', async () => {
    const r = await call('POST', '/api/work-entries', { fieldWorkId: s.fwA2, date: '2026-10-10', tripId: s.trip2 });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe(TRIP_NOT_ON_FIELD);
  });

  it('muutmine ilma tripId võtmeta jätab seose; tripId null eemaldab', async () => {
    const keep = await call('PUT', `/api/work-entries/${entryA}`, { date: '2026-10-10', notes: 'muudetud' });
    expect(keep.status).toBe(200);
    expect(keep.json.tripId).toBe(s.trip);
    const r = await call('PUT', `/api/work-entries/${entryA}`, { date: '2026-10-10', tripId: null });
    expect(r.status).toBe(200);
    expect(r.json.tripId).toBeNull();
    expect((await call('GET', SUG(s.fsA))).json).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Kontrolli, et test ebaõnnestub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tripSuggestions.test.ts'`
Expected: FAIL (`Failed to resolve import "./tripSuggestions"`).

- [ ] **Step 3: Loo `src/server/tripSuggestions.ts`**

```ts
// src/server/tripSuggestions.ts — kande telemeetria soovitused sõitude registrist ja kande ↔ sõidu seose kontroll.
// Soovitus = sõidu põllurida valitud põllul (hooajal), mis kattub valitud Tallinna kalendripäevaga.
// Aeg, ha ja kütus tulevad registrist (sama, mida näitab Tehnika → Sõidud), mitte uuest GPS-arvutusest.
import { prisma } from './db.ts';
import { loadAssignmentResolver } from './tripAssignments.ts';
import { tallinnMidnightUtc } from './mcp/ignitionHours.ts';
import type { TripRoute, TripStop } from './tripRoute.ts';

export interface TelemetrySuggestion {
  id: string; // = tripId
  tripId: string;
  vehicleId: string | null;
  vehicleName: string | null;
  implementId: string | null;
  implementName: string | null;
  workerId: string | null;
  workerName: string | null;
  startTime: string; // sõidu algus; kui sõit käis enne teisel põllul, siis siia põllule jõudmine
  endTime: string; // sõidu lõpp; kui sõit läks pärast teisele põllule, siis siit lahkumine
  fieldStartTime: string; // põllu piiridesse jõudmine
  fieldEndTime: string; // põllu piiridest lahkumine
  durationHours: number; // põllul süütega oldud aeg
  workedAreaHa: number | null; // tühi = haakeriista laius puudub
  fuelLiters: number | null; // põllu kütus + osa teekütusest
  pointCount: number;
  linked: boolean; // muudetav kanne on juba selle sõiduga seotud
  route?: TripRoute; // sõidu teekond (algus, läbitud kohad, lõpp)
}

export const TRIP_NOT_ON_FIELD = 'Valitud sõit ei käinud sellel põllul';
export const TRIP_TAKEN = 'Valitud sõit on juba selle põllu teise kandega seotud';

const timeFmt = new Intl.DateTimeFormat('et-EE', { timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit', hour12: false });
const hhmm = (d: Date) => timeFmt.format(d);

const nextDay = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

function stopOf(time: Date, lat: number, lng: number, json: unknown): TripStop {
  const p = (json ?? { place: null }) as { place?: TripStop['place']; near?: TripStop['near'] };
  return { time: time.toISOString(), lat, lng, place: p.place ?? null, ...(p.near ? { near: p.near } : {}) };
}

export async function getTelemetrySuggestionsForField(
  fieldSeasonId: number,
  dateStr: string,
  excludeEntryId?: string | null
): Promise<TelemetrySuggestion[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];
  const dayStart = tallinnMidnightUtc(dateStr);
  const dayEnd = tallinnMidnightUtc(nextDay(dateStr));
  const rows = await prisma.vehicleTripField.findMany({
    where: { fieldSeasonId, arriveAt: { lt: dayEnd }, leaveAt: { gte: dayStart } },
    include: {
      trip: {
        include: {
          fields: { select: { fieldSeasonId: true, arriveAt: true, leaveAt: true } },
          workEntries: { select: { id: true, fieldWork: { select: { fieldSeasonId: true } } } }
        }
      }
    },
    orderBy: { arriveAt: 'asc' }
  });
  if (rows.length === 0) return [];
  const resolve = await loadAssignmentResolver(rows.map((r) => r.trip.deviceId));
  const out: TelemetrySuggestion[] = [];
  for (const r of rows) {
    const t = r.trip;
    const own = t.workEntries.filter((e) => e.fieldWork.fieldSeasonId === fieldSeasonId);
    // Sama hooaja teise kandega seotud sõitu ei pakuta (teise põllu kanne ei sega)
    if (own.some((e) => e.id !== excludeEntryId)) continue;
    const target = resolve(t.deviceId, r.arriveAt);
    // Kui sõit käis enne/pärast teistel põldudel, jagatakse aeg põllu piiril (töötaja aega ei loeta kahele kandele)
    const others = t.fields.filter((f) => f.fieldSeasonId !== fieldSeasonId);
    const fieldBefore = others.some((f) => f.arriveAt < r.arriveAt);
    const fieldAfter = others.some((f) => f.leaveAt > r.leaveAt);
    out.push({
      id: t.id,
      tripId: t.id,
      vehicleId: target.vehicleId,
      vehicleName: target.vehicleName,
      implementId: target.implementId,
      implementName: target.implementName,
      workerId: null, // töötaja valitakse kandel
      workerName: null,
      startTime: hhmm(fieldBefore ? r.arriveAt : t.startedAt),
      endTime: hhmm(fieldAfter ? r.leaveAt : t.endedAt),
      fieldStartTime: hhmm(r.arriveAt),
      fieldEndTime: hhmm(r.leaveAt),
      durationHours: Math.round((r.activeMinutes / 60) * 100) / 100,
      workedAreaHa: r.areaHa,
      fuelLiters: r.fuelSharedL,
      pointCount: t.pointCount,
      linked: !!excludeEntryId && own.some((e) => e.id === excludeEntryId),
      route: {
        start: stopOf(t.startedAt, t.startLat, t.startLng, t.startPlace),
        end: stopOf(t.endedAt, t.endLat, t.endLng, t.endPlace),
        visits: (t.visits as unknown as TripRoute['visits'] | null) ?? []
      }
    });
  }
  return out.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Kande sõidu seose kontroll: sõidul peab olema selle hooaja põllurida ja sõit ei tohi olla sama hooaja teise kandega seotud. */
export async function entryTripError(tripId: string, fieldSeasonId: number, entryId: string | null): Promise<string | null> {
  const row = await prisma.vehicleTripField.findFirst({ where: { tripId, fieldSeasonId }, select: { id: true } });
  if (!row) return TRIP_NOT_ON_FIELD;
  const other = await prisma.workEntry.findFirst({
    where: { tripId, fieldWork: { fieldSeasonId }, ...(entryId ? { id: { not: entryId } } : {}) },
    select: { id: true }
  });
  return other ? TRIP_TAKEN : null;
}
```

- [ ] **Step 4: `fieldWorks.ts` — importid**

```ts
import { prisma, tenantTransaction, tsdb, canDelete, DELETE_FORBIDDEN_MESSAGE } from './db.ts';
import { fetchFieldGpsPackets, fetchDevicePackets, type FieldGpsRow, type DevicePacket } from './telemetryAccess.ts';
import { coverageAreaHa, type CoveragePoint } from './coverageArea.ts';
import { segmentTrip, buildRoute, DEFAULT_ROUTE_OPTIONS, type Place, type TripRoute } from './tripRoute.ts';
import { loadPlaces } from './tripPlaces.ts';
import type { Prisma } from '@prisma/client';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';
import * as turf from '@turf/turf';
```
→
```ts
import { prisma, tenantTransaction, canDelete, DELETE_FORBIDDEN_MESSAGE } from './db.ts';
import { getTelemetrySuggestionsForField, entryTripError } from './tripSuggestions.ts';
import type { Prisma } from '@prisma/client';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';
```

- [ ] **Step 5: `fieldWorks.ts` — vana soovitusfunktsiooni eemaldus**

Eemalda kõik alates `export interface TelemetrySuggestion {` kuni (mitte k.a) plokini `// ---------------------------------------------------------------------------\n// Päringute käsitleja`:

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && python3 -' <<'EOF'
p = 'src/server/fieldWorks.ts'
s = open(p, encoding='utf-8').read()
a = s.index('export interface TelemetrySuggestion {')
b = s.index('// ---------------------------------------------------------------------------\n// Päringute käsitleja')
open(p, 'w', encoding='utf-8').write(s[:a] + s[b:])
print('eemaldatud', s[a:b].count('\n'), 'rida')
EOF
```
Expected: `eemaldatud 301 rida` (± paar rida).

- [ ] **Step 6: `fieldWorks.ts` — `tripId` sisend ja DTO**

`resolveEntryInput` tagastuses:

```ts
    // Ladu lahendatakse tehingus (resolveEntryWarehouseId): valimata → põhiladu, mitteaktiivne ainult senisena
    warehouseId: text(body?.warehouseId, 64)
  };
}
```
→
```ts
    // Ladu lahendatakse tehingus (resolveEntryWarehouseId): valimata → põhiladu, mitteaktiivne ainult senisena
    warehouseId: text(body?.warehouseId, 64),
    // Sõitude registri sõit: võti puudub → muutmisel jääb senine; null → seos eemaldatakse
    tripId: body?.tripId === undefined ? undefined : text(body.tripId, 64)
  };
}
```

`entryDto`-s:

```ts
    warehouseId: e.warehouseId ?? null,
    equipmentHours: e.equipmentHours,
```
→
```ts
    warehouseId: e.warehouseId ?? null,
    tripId: e.tripId ?? null,
    equipmentHours: e.equipmentHours,
```

- [ ] **Step 7: `fieldWorks.ts` — POST `/api/work-entries`**

```ts
    const work = fieldWorkId ? await prisma.fieldWork.findUnique({ where: { id: fieldWorkId } }) : null;
    const { data, drafts, warehouseId, articleError, harvestLotId: harvestLotIdIn, harvestTonnesManualIn } = await resolveEntryInput(b);
```
→
```ts
    const work = fieldWorkId ? await prisma.fieldWork.findUnique({ where: { id: fieldWorkId } }) : null;
    const { data, drafts, warehouseId, articleError, harvestLotId: harvestLotIdIn, harvestTonnesManualIn, tripId } = await resolveEntryInput(b);
```

```ts
    if (work.status === 'DONE') {
      json(res, { error: DONE_WORK_ERROR }, 409);
      return true;
    }
    let saved;
    try {
      saved = await tenantTransaction(async (tx) => {
        // Lukustus: antud väärtus, muidu käsitsi sisestatud tonnid
```
→
```ts
    if (work.status === 'DONE') {
      json(res, { error: DONE_WORK_ERROR }, 409);
      return true;
    }
    const tripError = tripId ? await entryTripError(tripId, work.fieldSeasonId, null) : null;
    if (tripError) {
      json(res, { error: tripError }, 400);
      return true;
    }
    let saved;
    try {
      saved = await tenantTransaction(async (tx) => {
        // Lukustus: antud väärtus, muidu käsitsi sisestatud tonnid
```

```ts
            ...data, harvestLotId, harvestTonnesManual, date: data.date!, warehouseId: await resolveEntryWarehouseId(tx, warehouseId, null),
```
→
```ts
            ...data, tripId: tripId ?? null, harvestLotId, harvestTonnesManual, date: data.date!, warehouseId: await resolveEntryWarehouseId(tx, warehouseId, null),
```

- [ ] **Step 8: `fieldWorks.ts` — PUT `/api/work-entries/:id`**

```ts
    const old = await prisma.workEntry.findUnique({ where: { id }, include: { lines: true, fieldWork: { select: { status: true } } } });
    const { data, drafts, warehouseId, articleError, harvestLotId: harvestLotIdIn, harvestTonnesManualIn } = await resolveEntryInput(b);
```
→
```ts
    const old = await prisma.workEntry.findUnique({ where: { id }, include: { lines: true, fieldWork: { select: { status: true, fieldSeasonId: true } } } });
    const { data, drafts, warehouseId, articleError, harvestLotId: harvestLotIdIn, harvestTonnesManualIn, tripId } = await resolveEntryInput(b);
```

```ts
    if (old.fieldWork.status === 'DONE') {
      json(res, { error: DONE_WORK_ERROR }, 409);
      return true;
    }
```
→
```ts
    if (old.fieldWork.status === 'DONE') {
      json(res, { error: DONE_WORK_ERROR }, 409);
      return true;
    }
    // Seost kontrollitakse ainult muutmisel (senine jääb ka siis, kui sõit vahepeal ümber arvutati)
    const newTripId = tripId === undefined ? old.tripId : tripId;
    const tripError = newTripId && newTripId !== old.tripId ? await entryTripError(newTripId, old.fieldWork.fieldSeasonId, id) : null;
    if (tripError) {
      json(res, { error: tripError }, 400);
      return true;
    }
```

```ts
          data: {
            ...data,
            harvestLotId,
            harvestTonnesManual,
```
→
```ts
          data: {
            ...data,
            tripId: newTripId,
            harvestLotId,
            harvestTonnesManual,
```

- [ ] **Step 9: Kasutuseta koodi eemaldus**

`src/server/telemetryAccess.ts` — eemalda:

```ts
/** Kõik jooksva ettevõtte seadmetunnuste omandiperioodid (nt põllutööde soovituste jaoks). */
export async function allOwnershipWindows(kind: 'IMEI' | 'MAC'): Promise<Map<string, OwnershipWindow[]>> {
  const rows = await prisma.deviceOwnership.findMany({ where: { kind }, orderBy: { validFrom: 'asc' } });
  return toWindowMap(kind, rows);
}

```

ja plokk `FieldGpsRow` + `fetchFieldGpsPackets`; `segmentTrip` failist `tripRoute.ts` ja selle testid; GPS-soovituse testid failist `telemetryHistory.test.ts`:

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && python3 -' <<'EOF'
def cut(path, start, end, replacement=''):
    s = open(path, encoding='utf-8').read()
    a = s.index(start)
    b = s.index(end, a)
    open(path, 'w', encoding='utf-8').write(s[:a] + replacement + s[b:])
    print(path, 'eemaldatud', s[a:b].count('\n'), 'rida')

cut('src/server/telemetryAccess.ts', 'export type FieldGpsRow =', 'export type DevicePacket =')
cut('src/server/tripRoute.ts', 'const isOn = (p: TripPoint)', 'type PreparedPlace = {')
cut('src/server/tripRoute.test.ts', "describe('segmentTrip', () => {", "describe('buildRoute', () => {")
cut('src/server/telemetryHistory.test.ts', '    // Päris kasutaja võib olla selle sõidu kohta juba kande teinud', '  }\n});')
EOF
```

Seejärel käsitsi (Edit):
- `src/server/tripRoute.ts` rida 2: `// Puhtad funktsioonid (segmentTrip, buildRoute) ei puutu andmebaasi; loadPlaces laeb kohad ettevõtte piires.` → `// Puhas funktsioon buildRoute ei puutu andmebaasi; kohad laeb tripPlaces.ts.`
- `src/server/tripRoute.test.ts`: `import { segmentTrip, buildRoute, type Place, type TripPoint } from './tripRoute';` → `import { buildRoute, type Place, type TripPoint } from './tripRoute';`
- `src/server/telemetryHistory.test.ts`: eemalda rida `import { getTelemetrySuggestionsForField } from './fieldWorks';` (live-andmetel GPS-soovituse testid asendab `tripSuggestions.test.ts`).
- `src/server/telemetryAccess.ts`: `toWindowMap` jääb alles (kasutab `ownershipWindows`); `fetchDevicePackets` jääb (kasutab MCP `src/server/mcp/tools/fleet.ts`).

Kontrolli, et midagi ei viita eemaldatule:

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && grep -rn "fetchFieldGpsPackets\|allOwnershipWindows\|FieldGpsRow\|segmentTrip\b\|getTelemetrySuggestionsForField" src | grep -v "src/server/tripSuggestions.ts\|src/server/fieldWorks.ts"'`
Expected: väljund tühi.

- [ ] **Step 10: Testid läbivad**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/tripSuggestions.test.ts src/server/entryFuel.test.ts src/server/tripRoute.test.ts src/server/telemetryHistory.test.ts src/server/telemetryAccess.test.ts'`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/tripSuggestions.ts src/server/tripSuggestions.test.ts src/server/fieldWorks.ts src/server/telemetryAccess.ts src/server/tripRoute.ts src/server/tripRoute.test.ts src/server/telemetryHistory.test.ts && git commit -m "feat(soidu-pollud): kande soovitused sõitude registrist (kütus, seos); kande tripId kontroll; vana GPS-soovitus eemaldatud

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 6: Kande aken — kütus, seos sõiduga, „Eemalda seos“

**Files:**
- Modify: `src/types/fieldWork.ts` (`WorkEntry`, `WorkEntryInput`, `TelemetrySuggestion`)
- Modify: `src/components/FieldWorkEntryDialog.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: HTTP vastus Task 5 (`TelemetrySuggestion` koos `tripId`, `fuelLiters`, `linked`; kande `tripId`).
- Produces: kliendi tüübid `WorkEntry.tripId?: string | null`, `WorkEntryInput.tripId?: string | null`, `TelemetrySuggestion.tripId/fuelLiters/linked`.

- [ ] **Step 1: Tüübid**

`src/types/fieldWork.ts` (`WorkEntry`):

```ts
  areaHa: number | null;
  telemetryAreaHa?: number | null;
  occurrenceNo: number | null;
```
→
```ts
  areaHa: number | null;
  telemetryAreaHa?: number | null;
  tripId?: string | null; // sõitude registri sõit, millest kanne tehti
  occurrenceNo: number | null;
```

(`WorkEntryInput`):

```ts
  areaHa: number | null;
  telemetryAreaHa?: number | null;
  occurrenceNo?: number | null;
```
→
```ts
  areaHa: number | null;
  telemetryAreaHa?: number | null;
  tripId?: string | null; // null = seos eemaldatakse
  occurrenceNo?: number | null;
```

(`TelemetrySuggestion`):

```ts
export interface TelemetrySuggestion {
  id: string;
  vehicleId: string | null;
```
→
```ts
export interface TelemetrySuggestion {
  id: string; // = tripId
  tripId: string; // sõitude registri sõit
  vehicleId: string | null;
```

ja

```ts
  workedAreaHa: number | null;
  pointCount: number;
  route?: TripRoute; // sõidu teekond (algus, läbitud kohad, lõpp)
}
```
→
```ts
  workedAreaHa: number | null; // tühi = haakeriista laius puudub
  fuelLiters: number | null; // põllu kütus + osa teekütusest
  pointCount: number;
  linked: boolean; // muudetav kanne on juba selle sõiduga seotud
  route?: TripRoute; // sõidu teekond (algus, läbitud kohad, lõpp)
}
```

- [ ] **Step 2: Kande akna olek**

`src/components/FieldWorkEntryDialog.tsx`:

```ts
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
```
→
```ts
  // Kande seos sõitude registri sõiduga (tühi = seoseta)
  const [tripId, setTripId] = useState<string | null>(entry?.tripId ?? null);
```

- [ ] **Step 3: Soovituse rakendamine ja olek**

```ts
  const applySuggestion = (s: TelemetrySuggestion) => {
    setSelectedSuggestionId(s.id);
    if (s.vehicleId) setVehicleId(s.vehicleId);
    setImplementId(s.implementId || '');
    if (s.workerId) setWorkerId(s.workerId);
    // Kande aeg, tööaeg ning masina ja haakeriista töötunnid süüte järgi (sisse → välja)
    setStartTime(s.startTime);
    setEndTime(s.endTime);
    const tripMins = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
    const hStr = tripMins > 0 ? fmt(Math.round((tripMins / 60) * 100) / 100) : '';
    setLaborHours(hStr);
    setEquipmentHours(hStr);
    if (s.workedAreaHa != null) {
      setTelemetryAreaHa(fmt(s.workedAreaHa));
      // Tehtud pindala eeltäidetakse telemeetriast (kasutaja saab muuta); 0 ha (haakeriist puudub) ei kirjuta üle
      if (s.workedAreaHa > 0) changeArea(fmt(Math.round(s.workedAreaHa * 100) / 100));
    }
  };

  // Sõidu seos kandega: täpselt sama masin ja aeg = valitud; sama masin ja kattuv aeg = kanne on sellest sõidust,
  // aga väärtused erinevad (nt varem salvestatud põllul oldud aja järgi)
  const suggestionState = (s: TelemetrySuggestion): 'selected' | 'linked' | null => {
    if (selectedSuggestionId === s.id) return 'selected';
    if (!vehicleId || s.vehicleId !== vehicleId || !startTime || !endTime) return null;
    if (startTime === s.startTime && endTime === s.endTime) return 'selected';
    const from = Math.min(timeToMinutes(s.startTime), timeToMinutes(s.fieldStartTime));
    const to = Math.max(timeToMinutes(s.endTime), timeToMinutes(s.fieldEndTime));
    return Math.max(from, timeToMinutes(startTime)) < Math.min(to, timeToMinutes(endTime)) ? 'linked' : null;
  };
  const hasSelectedSuggestion = telemetrySuggestions.some((s) => suggestionState(s) === 'selected');
```
→
```ts
  const applySuggestion = (s: TelemetrySuggestion) => {
    setTripId(s.tripId);
    if (s.vehicleId) setVehicleId(s.vehicleId);
    setImplementId(s.implementId || '');
    if (s.workerId) setWorkerId(s.workerId);
    // Kande aeg, tööaeg ning masina ja haakeriista töötunnid sõidu järgi (pausid sees)
    setStartTime(s.startTime);
    setEndTime(s.endTime);
    const tripMins = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
    const hStr = tripMins > 0 ? fmt(Math.round((tripMins / 60) * 100) / 100) : '';
    setLaborHours(hStr);
    setEquipmentHours(hStr);
    // Kütus: põllu kütus + osa teekütusest (sõitude registrist)
    if (s.fuelLiters != null) setFuelLiters(fmt(s.fuelLiters, 1));
    setTelemetryAreaHa(fmt(s.workedAreaHa));
    // Tehtud pindala eeltäidetakse telemeetriast (kasutaja saab muuta); tühi/0 ha (laius puudub) ei kirjuta üle
    if (s.workedAreaHa != null && s.workedAreaHa > 0) changeArea(fmt(Math.round(s.workedAreaHa * 100) / 100));
  };

  // Kande seos sõiduga: 'linked' = salvestatud seos, 'selected' = valitud (salvestamata)
  const suggestionState = (s: TelemetrySuggestion): 'selected' | 'linked' | null =>
    s.tripId !== tripId ? null : tripId === (entry?.tripId ?? null) ? 'linked' : 'selected';
  const hasSelectedSuggestion = telemetrySuggestions.some((s) => suggestionState(s) !== null);
  // Seose eemaldamine: nupp on soovituse sees — klõps ei tohi soovitust uuesti valida
  const unlinkTrip = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setTripId(null);
  };
```

- [ ] **Step 4: Soovituse nupp**

```tsx
                {telemetrySuggestions.map((s) => {
                  const state = suggestionState(s);
                  const isSelected = state === 'selected';
```
→
```tsx
                {telemetrySuggestions.map((s) => {
                  const state = suggestionState(s);
                  const isSelected = state !== null;
```

```tsx
                        <span className="telemetry-pill-time">
                          <Clock size={12} /> {s.startTime} – {s.endTime}
                          {s.workedAreaHa != null && (
                            (s.workedAreaHa > 0 && s.implementName) ? (
                              <span> · {fmtHa(s.workedAreaHa)} ha</span>
                            ) : (
                              <span style={{ color: '#ef4444', fontWeight: 600 }}> · 0 ha</span>
                            )
                          )}
                        </span>
```
→
```tsx
                        <span className="telemetry-pill-time">
                          <Clock size={12} /> {s.startTime} – {s.endTime}
                          {s.workedAreaHa != null && s.workedAreaHa > 0 ? (
                            <span> · {fmtHa(s.workedAreaHa)} ha</span>
                          ) : (
                            <span style={{ color: '#ef4444', fontWeight: 600 }} title="Haakeriista või selle töölaiust pole seoste registris">
                              {' · '}{s.workedAreaHa == null ? 'ha puudub' : '0 ha'}
                            </span>
                          )}
                          {s.fuelLiters != null && <span> · {formatQty(s.fuelLiters)} l</span>}
                        </span>
```

```tsx
                        <span className="telemetry-pill-action">
                          {isSelected ? '✓ Valitud' : state === 'linked' ? 'Uuenda selle sõidu järgi' : 'Vali see sõit'}
                        </span>
```
→
```tsx
                        <span className="telemetry-pill-action">
                          {state === 'linked' ? '✓ Seotud' : state === 'selected' ? '✓ Valitud' : 'Vali see sõit'}
                        </span>
                        {isSelected && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="telemetry-pill-unlink"
                            onClick={unlinkTrip}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') unlinkTrip(e); }}
                          >
                            Eemalda seos
                          </span>
                        )}
```

- [ ] **Step 5: Salvestus saadab `tripId`**

```ts
          telemetryAreaHa: parseNum(telemetryAreaHa),
          warehouseId: warehouseId || null,
```
→
```ts
          telemetryAreaHa: parseNum(telemetryAreaHa),
          tripId,
          warehouseId: warehouseId || null,
```

- [ ] **Step 6: Stiil**

`src/index.css`, pärast plokki

```css
.telemetry-suggestion-pill.selected .telemetry-pill-action {
  background: #059669;
  color: #ffffff;
}
```
lisa:
```css

.telemetry-pill-unlink {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--btn-sec-bg);
  border: 1px solid var(--btn-sec-border);
  border-radius: var(--radius-sm);
  padding: 1px 8px;
  cursor: pointer;
  white-space: nowrap;
}

.telemetry-pill-unlink:hover {
  background: var(--btn-sec-hover);
}
```

- [ ] **Step 7: Tüübikontroll ja build**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && grep -n "selectedSuggestionId" src/components/FieldWorkEntryDialog.tsx; npx tsc --noEmit -p tsconfig.app.json && npx vite build >/dev/null && echo OK'`
Expected: grep ei leia midagi; `OK`.

- [ ] **Step 8: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/types/fieldWork.ts src/components/FieldWorkEntryDialog.tsx src/index.css && git commit -m "feat(soidu-pollud): kande aken — soovitus täidab kütuse ja seob sõiduga; Eemalda seos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 7: Sõitude API — `areaHa`, põllud koos kannetega, `unlinkedOnly`

**Files:**
- Modify: `src/server/tripsApi.ts` (kogu fail asendatakse)
- Test: `src/server/tripsApi.test.ts`
- Modify: `src/types/fleet.ts`, `src/services/api.ts`

**Interfaces:**
- Consumes: `loadAssignmentResolver` (Task 2); `prisma.vehicleTripField`, `WorkEntry.tripId` (Task 1); `workTypeDisplayName(w: { name: string; shortName?: string | null }): string` (`src/services/workTypeName.ts`).
- Produces: `TripDto` lisad `areaHa: number | null`, `fields: TripFieldDto[]`:
  ```ts
  type TripFieldDto = { fieldSeasonId: number; year: number; label: string; arriveAt: string; leaveAt: string;
    activeMinutes: number; areaHa: number | null; implementName: string | null; widthM: number | null;
    fuelFieldL: number | null; fuelSharedL: number | null;
    entries: { id: string; fieldWorkId: string; workTypeName: string; date: string }[] };
  ```
  `GET /api/fleet/trips?unlinkedOnly=1` — ainult sõidud, millel on põllurida ilma kandeta. Kliendis `Trip.areaHa`, `Trip.fields: TripField[]`, `TripFilter.unlinkedOnly?: boolean`.

- [ ] **Step 1: Testid**

`src/server/tripsApi.test.ts`:

```ts
const d = (s: string) => new Date(s);
let tripId = '';
let vehicleId = '';
let deviceId = '';
```
→
```ts
const d = (s: string) => new Date(s);
let tripId = '';
let activeTripId = '';
let vehicleId = '';
let deviceId = '';
let fsId = 0;
let entryId = '';
let fieldWorkId = '';
```

```ts
    tripId = (await prisma.vehicleTrip.create({ data: tripRow(d('2026-11-03T06:00:00Z'), d('2026-11-03T07:00:00Z')) })).id;
    await prisma.vehicleTrip.create({ data: tripRow(d('2026-11-04T06:00:00Z'), d('2026-11-04T06:30:00Z'), { status: 'ACTIVE' }) });
```
→
```ts
    tripId = (await prisma.vehicleTrip.create({ data: tripRow(d('2026-11-03T06:00:00Z'), d('2026-11-03T07:00:00Z'), { areaHa: 1.2 }) })).id;
    activeTripId = (await prisma.vehicleTrip.create({ data: tripRow(d('2026-11-04T06:00:00Z'), d('2026-11-04T06:30:00Z'), { status: 'ACTIVE' }) })).id;
    const field = await prisma.field.create({ data: { num: '7', name: 'Testpõld', fieldCode: 'TA-7' } });
    fsId = (await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 5, crop: 'test', geometry: {} } })).id;
    const wt = await prisma.workType.create({ data: { name: 'Testkünd', shortName: 'Künd', phase: 'PREPARATION' } });
    fieldWorkId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fsId, workTypeId: wt.id, phase: 'PREPARATION' } })).id;
    const plow = (await prisma.implement.create({ data: { name: 'Adra', type: 'PLOW', workingWidthM: 2.5 } })).id;
    await prisma.vehicleTripField.create({ data: {
      tripId, fieldSeasonId: fsId, arriveAt: d('2026-11-03T06:10:00Z'), leaveAt: d('2026-11-03T06:50:00Z'),
      activeMinutes: 38, areaHa: 1.2, implementId: plow, widthM: 2.5, fuelFieldL: 6, fuelSharedL: 7.5, computedAt: new Date()
    } });
    await prisma.vehicleTripField.create({ data: {
      tripId: activeTripId, fieldSeasonId: fsId, arriveAt: d('2026-11-04T06:05:00Z'), leaveAt: d('2026-11-04T06:25:00Z'),
      activeMinutes: 20, computedAt: new Date()
    } });
    entryId = (await prisma.workEntry.create({ data: { fieldWorkId, date: d('2026-11-03T00:00:00Z'), tripId } })).id;
```

`afterAll`:

```ts
  await run(async () => {
    await prisma.vehicleTrip.deleteMany({});
```
→
```ts
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.vehicleTrip.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
```

`describe('tripsApi', ...)` lõppu (enne `it('muud teed ei kuulu siia'`) lisa:

```ts
  it('põllud: ha, haakeriist, kütus ja seotud kanne', async () => {
    const r = await call('GET', `/api/fleet/trips${Q}`);
    const closed = r.json.find((t: any) => t.id === tripId);
    expect(closed.areaHa).toBe(1.2);
    expect(closed.fields).toHaveLength(1);
    expect(closed.fields[0]).toMatchObject({
      fieldSeasonId: fsId, year: 2026, label: 'Nr 7 Testpõld', arriveAt: '2026-11-03T06:10:00.000Z', leaveAt: '2026-11-03T06:50:00.000Z',
      activeMinutes: 38, areaHa: 1.2, implementName: 'Adra', widthM: 2.5, fuelFieldL: 6, fuelSharedL: 7.5
    });
    expect(closed.fields[0].entries).toEqual([{ id: entryId, fieldWorkId, workTypeName: 'Künd', date: '2026-11-03' }]);
    const active = r.json.find((t: any) => t.id === activeTripId);
    expect(active.areaHa).toBeNull();
    expect(active.fields[0]).toMatchObject({ areaHa: null, implementName: null, entries: [] });
  });

  it('unlinkedOnly: ainult kandeta põllureaga sõidud', async () => {
    const r = await call('GET', `/api/fleet/trips${Q}&unlinkedOnly=1`);
    expect(r.json.map((t: any) => t.id)).toEqual([activeTripId]);
  });
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tripsApi.test.ts'`
Expected: FAIL (`closed.fields` on undefined).

- [ ] **Step 2: Asenda `src/server/tripsApi.ts`**

```ts
// src/server/tripsApi.ts — sõitude register (HTTP): loend, impordi olek, sõidu rada, märkuse muutmine.
// Sõidud tulevad taustaimpordist (tripImport.ts); masin/haakeriist liidetakse lugemisel seoste registrist sõidu alguse ajal.
// Sõidu põllud (ha, kütus) ja nendega seotud kanded: vehicle_trip_fields + work_entries.tripId.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma } from './db.ts';
import { json, parseBody } from './http.ts';
import { fetchTripSamples } from './telemetryAccess.ts';
import { loadAssignmentResolver } from './tripAssignments.ts';
import { workTypeDisplayName } from '../services/workTypeName.ts';

const DEFAULT_DAYS = 7;
const MAX_NOTES = 1000;

type TripRow = Awaited<ReturnType<typeof prisma.vehicleTrip.findMany>>[number];

export type TripFieldEntryDto = { id: string; fieldWorkId: string; workTypeName: string; date: string };
export type TripFieldDto = {
  fieldSeasonId: number;
  year: number;
  label: string;
  arriveAt: string;
  leaveAt: string;
  activeMinutes: number;
  areaHa: number | null;
  implementName: string | null;
  widthM: number | null;
  fuelFieldL: number | null;
  fuelSharedL: number | null;
  entries: TripFieldEntryDto[];
};

const parseIso = (v: string | null): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const deviceLabelOf = (d: { model: string; imei: string | null }) => (d.imei ? `${d.model} (${d.imei.slice(-4)})` : d.model);

async function resolveTargets(trips: TripRow[]) {
  const deviceIds = [...new Set(trips.map((t) => t.deviceId))];
  const [devices, resolve] = await Promise.all([
    prisma.telemetryDevice.findMany({ where: { id: { in: deviceIds } }, select: { id: true, model: true, imei: true } }),
    loadAssignmentResolver(deviceIds)
  ]);
  return (t: TripRow) => {
    const dev = devices.find((d) => d.id === t.deviceId);
    const r = resolve(t.deviceId, t.startedAt);
    return {
      deviceLabel: dev ? deviceLabelOf(dev) : t.deviceId,
      vehicleId: r.vehicleId,
      vehicleName: r.vehicleName,
      implementId: r.implementId,
      implementName: r.implementName
    };
  };
}

// Sõitude põllured koos põllu nime, haakeriista nime ja selle põllu kannetega (kanne = sama sõit + sama hooaeg)
async function loadTripFields(trips: TripRow[]): Promise<(tripId: string) => TripFieldDto[]> {
  const tripIds = trips.map((t) => t.id);
  if (tripIds.length === 0) return () => [];
  const [rows, entries] = await Promise.all([
    prisma.vehicleTripField.findMany({
      where: { tripId: { in: tripIds } },
      include: { fieldSeason: { select: { year: true, field: { select: { num: true, name: true } } } } },
      orderBy: { arriveAt: 'asc' }
    }),
    prisma.workEntry.findMany({
      where: { tripId: { in: tripIds } },
      select: {
        id: true, tripId: true, date: true, fieldWorkId: true,
        fieldWork: { select: { fieldSeasonId: true, workType: { select: { name: true, shortName: true } } } }
      },
      orderBy: { date: 'asc' }
    })
  ]);
  const implIds = [...new Set(rows.map((r) => r.implementId).filter((x): x is string => !!x))];
  const impls = implIds.length ? await prisma.implement.findMany({ where: { id: { in: implIds } }, select: { id: true, name: true } }) : [];
  const byTrip = new Map<string, TripFieldDto[]>();
  for (const r of rows) {
    const list = byTrip.get(r.tripId) ?? [];
    list.push({
      fieldSeasonId: r.fieldSeasonId,
      year: r.fieldSeason.year,
      label: `Nr ${r.fieldSeason.field.num} ${r.fieldSeason.field.name}`.trim(),
      arriveAt: r.arriveAt.toISOString(),
      leaveAt: r.leaveAt.toISOString(),
      activeMinutes: r.activeMinutes,
      areaHa: r.areaHa,
      // Kustutatud haakeriista nime pole; laius jääb ajalukku
      implementName: impls.find((i) => i.id === r.implementId)?.name ?? null,
      widthM: r.widthM,
      fuelFieldL: r.fuelFieldL,
      fuelSharedL: r.fuelSharedL,
      entries: entries
        .filter((e) => e.tripId === r.tripId && e.fieldWork.fieldSeasonId === r.fieldSeasonId)
        .map((e) => ({ id: e.id, fieldWorkId: e.fieldWorkId, workTypeName: workTypeDisplayName(e.fieldWork.workType), date: e.date.toISOString().slice(0, 10) }))
    });
    byTrip.set(r.tripId, list);
  }
  return (tripId) => byTrip.get(tripId) ?? [];
}

function toDto(t: TripRow, target: ReturnType<Awaited<ReturnType<typeof resolveTargets>>>, fields: TripFieldDto[]) {
  const sp = (t.startPlace ?? { place: null }) as any;
  const ep = (t.endPlace ?? { place: null }) as any;
  return {
    id: t.id, deviceId: t.deviceId, ...target,
    startedAt: t.startedAt.toISOString(), endedAt: t.endedAt.toISOString(), status: t.status,
    start: { lat: t.startLat, lng: t.startLng, place: sp.place ?? null, ...(sp.near ? { near: sp.near } : {}) },
    end: { lat: t.endLat, lng: t.endLng, place: ep.place ?? null, ...(ep.near ? { near: ep.near } : {}) },
    visits: (t.visits as any[]) ?? [],
    distanceKm: t.distanceKm, movingMinutes: t.movingMinutes, idleMinutes: t.idleMinutes,
    pauseCount: t.pauseCount, pauseMinutes: t.pauseMinutes,
    maxSpeedKmh: t.maxSpeedKmh, avgSpeedKmh: t.avgSpeedKmh, fuelLiters: t.fuelLiters,
    fuelLevelStartPct: t.fuelLevelStartPct, fuelLevelEndPct: t.fuelLevelEndPct,
    engineHoursStart: t.engineHoursStart, engineHoursEnd: t.engineHoursEnd,
    pointCount: t.pointCount, areaHa: t.areaHa, notes: t.notes,
    fields
  };
}

export async function handleTrips(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL): Promise<boolean> {
  if (pathname !== '/api/fleet/trips' && !pathname.startsWith('/api/fleet/trips/')) return false;

  if (pathname === '/api/fleet/trips' && method === 'GET') {
    const to = parseIso(url.searchParams.get('to')) ?? new Date();
    const from = parseIso(url.searchParams.get('from')) ?? new Date(to.getTime() - DEFAULT_DAYS * 86_400_000);
    const status = url.searchParams.get('status');
    const rows = await prisma.vehicleTrip.findMany({
      where: {
        startedAt: { gte: from, lt: to },
        ...(status === 'ACTIVE' || status === 'CLOSED' ? { status } : {})
      },
      orderBy: { startedAt: 'desc' }
    });
    const [target, fieldsOf] = await Promise.all([resolveTargets(rows), loadTripFields(rows)]);
    let list = rows.map((t) => toDto(t, target(t), fieldsOf(t.id)));
    const vehicleId = url.searchParams.get('vehicleId');
    if (vehicleId) list = list.filter((t) => t.vehicleId === vehicleId);
    if (url.searchParams.get('unknownPlace') === '1') list = list.filter((t) => !t.start.place || !t.end.place);
    // Kirja panemata põllusõit: vähemalt ühel põllureal pole kannet
    if (url.searchParams.get('unlinkedOnly') === '1') list = list.filter((t) => t.fields.some((f) => f.entries.length === 0));
    json(res, list);
    return true;
  }

  if (pathname === '/api/fleet/trips/import-status' && method === 'GET') {
    const states = await prisma.tripImportState.findMany({ include: { device: { select: { model: true, imei: true } } } });
    const last = states.map((s) => s.lastRunAt).filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0];
    json(res, {
      lastRunAt: last ? last.toISOString() : null,
      devices: states.map((s) => ({
        deviceId: s.deviceId, deviceLabel: deviceLabelOf(s.device),
        lastError: s.lastError, lastErrorAt: s.lastErrorAt ? s.lastErrorAt.toISOString() : null
      }))
    });
    return true;
  }

  const trackMatch = /^\/api\/fleet\/trips\/([^/]+)\/track$/.exec(pathname);
  if (trackMatch && method === 'GET') {
    const trip = await prisma.vehicleTrip.findUnique({ where: { id: trackMatch[1] }, include: { device: { select: { imei: true } } } });
    if (!trip || !trip.device.imei) { json(res, { error: 'Sõitu ei leitud' }, 404); return true; }
    const samples = await fetchTripSamples(trip.device.imei, new Date(trip.startedAt.getTime() - 1), trip.endedAt);
    json(res, { points: samples.filter((s) => s.ignition !== false).map((s) => [s.lat, s.lng]) });
    return true;
  }

  const idMatch = /^\/api\/fleet\/trips\/([^/]+)$/.exec(pathname);
  if (idMatch && (method === 'PATCH' || method === 'PUT')) {
    const id = idMatch[1];
    const existing = await prisma.vehicleTrip.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { json(res, { error: 'Sõitu ei leitud' }, 404); return true; }
    const body = await parseBody(req);
    const notes = String(body?.notes ?? '').trim().slice(0, MAX_NOTES) || null;
    const saved = await prisma.vehicleTrip.update({ where: { id }, data: { notes } });
    const [target, fieldsOf] = await Promise.all([resolveTargets([saved]), loadTripFields([saved])]);
    json(res, toDto(saved, target(saved), fieldsOf(saved.id)));
    return true;
  }

  return false;
}
```

- [ ] **Step 3: Kliendi tüübid ja API**

`src/types/fleet.ts`:

```ts
  pointCount: number;
  notes: string | null;
}
export interface TripImportStatus {
```
→
```ts
  pointCount: number;
  areaHa: number | null; // põldude ha summa; tühi = haakeriista laius puudub
  notes: string | null;
  fields: TripField[];
}
export interface TripFieldEntry { id: string; fieldWorkId: string; workTypeName: string; date: string }
// Sõidu osa ühel põllul (hooajal)
export interface TripField {
  fieldSeasonId: number;
  year: number;
  label: string;
  arriveAt: string;
  leaveAt: string;
  activeMinutes: number;
  areaHa: number | null;
  implementName: string | null;
  widthM: number | null;
  fuelFieldL: number | null;
  fuelSharedL: number | null;
  entries: TripFieldEntry[];
}
export interface TripImportStatus {
```

```ts
export interface TripFilter { from: string; to: string; vehicleId?: string; status?: 'ACTIVE' | 'CLOSED'; unknownPlace?: boolean }
```
→
```ts
export interface TripFilter { from: string; to: string; vehicleId?: string; status?: 'ACTIVE' | 'CLOSED'; unknownPlace?: boolean; unlinkedOnly?: boolean }
```

`src/services/api.ts`:

```ts
    if (f.unknownPlace) q.set('unknownPlace', '1');
```
→
```ts
    if (f.unknownPlace) q.set('unknownPlace', '1');
    if (f.unlinkedOnly) q.set('unlinkedOnly', '1');
```

- [ ] **Step 4: Testid läbivad**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/tripsApi.test.ts'`
Expected: PASS (kõik, sh vanad filtrite testid — Q vahemikus on endiselt 2 sõitu).

- [ ] **Step 5: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/tripsApi.ts src/server/tripsApi.test.ts src/types/fleet.ts src/services/api.ts && git commit -m "feat(soidu-pollud): sõitude API — ha, põllud koos kannetega, kandeta põllusõitude filter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 8: Sõitude register ja sõidu aken — ha, Kanne, filter, põldude tabel

**Files:**
- Modify: `src/components/TripRegister.tsx`, `src/components/TripDialog.tsx`, `src/components/VehicleTracker.tsx`, `src/components/FieldWorksBoard.tsx`, `src/App.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `Trip.areaHa`, `Trip.fields`, `TripFilter.unlinkedOnly` (Task 7).
- Produces: prop `onOpenFieldWork?: (fieldWorkId: string, year: number) => void` (`TripDialog`, `TripRegister`, `VehicleTracker`); `FieldWorksBoard` props `initialWorkId?: string | null`, `onInitialWorkConsumed?: () => void`.

- [ ] **Step 1: `TripDialog.tsx`**

```ts
import { formatQty } from '../services/units';
```
→
```ts
import { formatQty } from '../services/units';
import { formatDate } from '../services/dateFormat';
```

```ts
  onSaved: (trip: Trip) => void;
}
```
→
```ts
  onSaved: (trip: Trip) => void;
  onOpenFieldWork?: (fieldWorkId: string, year: number) => void; // kande link: avab põllu töö
}
```

```ts
export const TripDialog: React.FC<TripDialogProps> = ({ trip, onClose, onSaved }) => {
```
→
```ts
export const TripDialog: React.FC<TripDialogProps> = ({ trip, onClose, onSaved, onOpenFieldWork }) => {
```

```ts
    ['Kütus', opt(trip.fuelLiters, 'l')],
```
→
```ts
    ['Kütus', opt(trip.fuelLiters, 'l')],
    ['Tehtud pindala', opt(trip.areaHa, 'ha')],
```

Enne rida `          {trip.visits.length > 0 && (` lisa:

```tsx
          {trip.fields.length > 0 && (
            <>
              <h4>Põllud</h4>
              <table className="register-table trip-dialog-fields">
                <thead>
                  <tr>
                    <th>Põld</th>
                    <th>Põllul</th>
                    <th className="num">ha</th>
                    <th className="num">Kütus põllul l</th>
                    <th className="num">Koos teega l</th>
                    <th>Kanne</th>
                  </tr>
                </thead>
                <tbody>
                  {trip.fields.map((f) => (
                    <tr key={f.fieldSeasonId}>
                      <td>{f.label}</td>
                      <td>{timeOnly(f.arriveAt)}–{timeOnly(f.leaveAt)} · {minutesText(f.activeMinutes)}</td>
                      <td className="num">
                        {f.areaHa == null ? '—' : formatQty(f.areaHa)}
                        <div className="text-muted">
                          {f.implementName ? `${f.implementName}${f.widthM != null ? `, ${formatQty(f.widthM)} m` : ''}` : 'haakeriist puudub'}
                        </div>
                      </td>
                      <td className="num">{f.fuelFieldL == null ? '—' : formatQty(f.fuelFieldL)}</td>
                      <td className="num">{f.fuelSharedL == null ? '—' : formatQty(f.fuelSharedL)}</td>
                      <td>
                        {f.entries.length === 0 ? (
                          <span className="text-muted">kanne puudub</span>
                        ) : (
                          f.entries.map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title="Ava põllu töö"
                              disabled={!onOpenFieldWork}
                              onClick={() => onOpenFieldWork?.(e.fieldWorkId, f.year)}
                            >
                              {e.workTypeName} {formatDate(e.date)}
                            </button>
                          ))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
```

- [ ] **Step 2: `TripRegister.tsx`**

```ts
interface TripRegisterProps {
  vehicles: Vehicle[];
}
```
→
```ts
interface TripRegisterProps {
  vehicles: Vehicle[];
  onOpenFieldWork?: (fieldWorkId: string, year: number) => void;
}
```

```ts
export const TripRegister: React.FC<TripRegisterProps> = ({ vehicles }) => {
```
→
```ts
export const TripRegister: React.FC<TripRegisterProps> = ({ vehicles, onOpenFieldWork }) => {
```

```ts
  const [unknownPlace, setUnknownPlace] = useState(false);
```
→
```ts
  const [unknownPlace, setUnknownPlace] = useState(false);
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);
```

```ts
          vehicleId: vehicleId || undefined, status: status || undefined, unknownPlace
```
→
```ts
          vehicleId: vehicleId || undefined, status: status || undefined, unknownPlace, unlinkedOnly
```

```ts
  }, [fromDay, toDay, vehicleId, status, unknownPlace]);
```
→
```ts
  }, [fromDay, toDay, vehicleId, status, unknownPlace, unlinkedOnly]);
```

```ts
  const hasFilters = periodActive || !!vehicleId || !!status || unknownPlace;
```
→
```ts
  const hasFilters = periodActive || !!vehicleId || !!status || unknownPlace || unlinkedOnly;
```

Pärast `unknownPlace` filtri `</FilterClear>`-i (enne värskendusnuppu) lisa:

```tsx
        <FilterClear className="filter-clear-inline" active={unlinkedOnly} onClear={() => setUnlinkedOnly(false)}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <input type="checkbox" checked={unlinkedOnly} onChange={(e) => setUnlinkedOnly(e.target.checked)} />
            Ainult kandeta põllusõidud
          </label>
        </FilterClear>
```

Tabeli päis:

```tsx
                <th className="num">km</th>
                <th className="num">Kütus l</th>
                <th className="num">Mootoritunnid</th>
                <th>Olek</th>
```
→
```tsx
                <th className="num">km</th>
                <th className="num">ha</th>
                <th className="num">Kütus l</th>
                <th className="num">Mootoritunnid</th>
                <th title="✓ = vähemalt ühel põllul on kanne; — = põllusõit on kirja panemata">Kanne</th>
                <th>Olek</th>
```

Tabeli rida:

```tsx
                    <td className="num">{formatQty(t.distanceKm)}</td>
                    <td className="num">{t.fuelLiters == null ? '—' : formatQty(t.fuelLiters)}</td>
                    <td className="num">{engine == null ? '—' : formatQty(engine)}</td>
```
→
```tsx
                    <td className="num">{formatQty(t.distanceKm)}</td>
                    <td className="num">{t.areaHa == null ? '—' : formatQty(t.areaHa)}</td>
                    <td className="num">{t.fuelLiters == null ? '—' : formatQty(t.fuelLiters)}</td>
                    <td className="num">{engine == null ? '—' : formatQty(engine)}</td>
                    <td>{t.fields.length === 0 ? '' : t.fields.some((f) => f.entries.length > 0) ? '✓' : '—'}</td>
```

Sõidu aken:

```tsx
        <TripDialog
          trip={open}
          onClose={() => setOpen(null)}
```
→
```tsx
        <TripDialog
          trip={open}
          onOpenFieldWork={onOpenFieldWork}
          onClose={() => setOpen(null)}
```

- [ ] **Step 3: `VehicleTracker.tsx`**

```ts
  telemetryEnabled?: boolean;      // false: telemeetria moodul pole litsentsis → seadmete tabid peidetud
}
```
→
```ts
  telemetryEnabled?: boolean;      // false: telemeetria moodul pole litsentsis → seadmete tabid peidetud
  onOpenFieldWork?: (fieldWorkId: string, year: number) => void; // sõidu põllurea kanne → põllutööde vaade
}
```

```ts
  canManageFinance = false,
  telemetryEnabled = true,
}) => {
```
→
```ts
  canManageFinance = false,
  telemetryEnabled = true,
  onOpenFieldWork,
}) => {
```

```tsx
      {telemetryEnabled && activeTab === 'trips' && <TripRegister vehicles={vehicles} />}
```
→
```tsx
      {telemetryEnabled && activeTab === 'trips' && <TripRegister vehicles={vehicles} onOpenFieldWork={onOpenFieldWork} />}
```

- [ ] **Step 4: `FieldWorksBoard.tsx`**

```ts
  canManageFinance?: boolean;
  telemetryEnabled?: boolean;
}

interface Row {
```
→
```ts
  canManageFinance?: boolean;
  telemetryEnabled?: boolean;
  initialWorkId?: string | null; // mujalt (sõidu aknast) avatud töö
  onInitialWorkConsumed?: () => void;
}

interface Row {
```

```ts
  canManageFinance = false,
  telemetryEnabled = true
}) => {
```
→
```ts
  canManageFinance = false,
  telemetryEnabled = true,
  initialWorkId = null,
  onInitialWorkConsumed
}) => {
```

```ts
    void reload();
    setSelectedId(null);
  }, [reload]);
```
→
```ts
    void reload();
    setSelectedId(null);
  }, [reload]);

  // Mujalt avatud töö valitakse, kui tööd on laetud (enne laadimist id-d loendis pole)
  useEffect(() => {
    if (!initialWorkId || !fieldWorks.some((w) => w.id === initialWorkId)) return;
    setSelectedId(initialWorkId);
    onInitialWorkConsumed?.();
  }, [initialWorkId, fieldWorks, onInitialWorkConsumed]);
```

- [ ] **Step 5: `App.tsx`**

```ts
  // Kaardi huvipunkti lao link: avab laoarvestuse vaate lao filtriga
  const openWarehouse = (warehouseId: string) => {
    setArticlesWarehouseId(warehouseId);
    changeMainView('stock');
  };
```
→
```ts
  // Kaardi huvipunkti lao link: avab laoarvestuse vaate lao filtriga
  const openWarehouse = (warehouseId: string) => {
    setArticlesWarehouseId(warehouseId);
    changeMainView('stock');
  };

  // Sõidu põllurea kande link (Tehnika → Sõidud): avab põllutööde vaate selle töö valikuga
  const [worksFocusId, setWorksFocusId] = useState<string | null>(null);
  const clearWorksFocus = React.useCallback(() => setWorksFocusId(null), []);
  const openFieldWork = (fieldWorkId: string, year: number) => {
    setSelectedYear(year);
    setWorksFocusId(fieldWorkId);
    changeMainView('works');
  };
```

```tsx
            onOpenWorkRegister={() => setIsWorkRegisterOpen(true)}
            canManageFinance={user.isAdmin || user.isFinanceManager}
            telemetryEnabled={modules.telemetry}
          />
```
→
```tsx
            onOpenWorkRegister={() => setIsWorkRegisterOpen(true)}
            canManageFinance={user.isAdmin || user.isFinanceManager}
            telemetryEnabled={modules.telemetry}
            initialWorkId={worksFocusId}
            onInitialWorkConsumed={clearWorksFocus}
          />
```

```tsx
          onDeleteDevice={handleDeleteDevice}
          telemetryEnabled={modules.telemetry}
        />
```
→
```tsx
          onDeleteDevice={handleDeleteDevice}
          telemetryEnabled={modules.telemetry}
          onOpenFieldWork={openFieldWork}
        />
```

- [ ] **Step 6: Stiil**

`src/index.css`, pärast rida `.trip-dialog-visits { font-size: 13px; margin: 4px 0 12px 16px; }` lisa:

```css
.trip-dialog-fields { width: 100%; font-size: 13px; margin-bottom: 12px; }
.trip-dialog-fields .text-muted { font-size: 12px; }
.trip-dialog-fields .btn-sm { padding: 0 6px; }
```

- [ ] **Step 7: Tüübikontroll ja build**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vite build >/dev/null && echo OK'`
Expected: `OK`.

- [ ] **Step 8: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/components/TripRegister.tsx src/components/TripDialog.tsx src/components/VehicleTracker.tsx src/components/FieldWorksBoard.tsx src/App.tsx src/index.css && git commit -m "feat(soidu-pollud): sõitude register — ha ja Kanne veerg, kandeta põllusõitude filter; sõidu akna põllud ja link põllu tööle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 9: Dokumentatsioon, release, vanade andmete samm ja live-kontroll

**Files:**
- Modify: `docs/vaated-ja-andmed.md`, `docs/andmemudel.md`, `docs/superpowers/specs/2026-11-05-soidu-pollud-design.md`
- Server: `/home/debian/backups/telemetry-area-ha-2026-11-05.json` (uus fail, mitte repos)

**Interfaces:**
- Consumes: kõik eelnevad ülesanded deploy'tud kujul (`npm run tenant -- trips:import` kasutab kompileeritud koodi).

- [ ] **Step 1: `docs/vaated-ja-andmed.md`**

Põllu akna tabelis:

```md
| `FieldWorkEntryDialog` | pakub telemeetriast sõite kande täitmiseks | `GET /api/field-works/telemetry-suggestions` | `FieldSeason` R, `WorkEntry` R, `DeviceAssignment` R, `TelemetryDevice` R, `Vehicle` R, `RelatedParty` R, `Implement` R, `ImplementAssignment` R, `DeviceOwnership` R, `Field` R, `PointOfInterest` R, tsdb R |
```
→
```md
| `FieldWorkEntryDialog` | pakub sõitude registrist selle põllu sõite kande täitmiseks (aeg pausidega, ha, kütus koos teekütuse osaga); klõps seob kande sõiduga, „Eemalda seos“ eemaldab | `GET /api/field-works/telemetry-suggestions` | `VehicleTripField` R, `VehicleTrip` R, `WorkEntry` R, `FieldWork` R, `DeviceAssignment` R, `ImplementAssignment` R, `Vehicle` R, `Implement` R |
```

ja samas tabelis kande salvestuse real `` `WorkEntry` RCU, `WorkEntryLine` CUD (ühikuhind ümberarvutusest)`` → `` `WorkEntry` RCU (sh sõidu seos `tripId`), `VehicleTripField` R (seose kontroll), `WorkEntryLine` CUD (ühikuhind ümberarvutusest)``.

Tehnika tabelis:

```md
| `TripRegister` | sõitude register: filtrid, impordi olek | `GET /api/fleet/trips`, `GET /api/fleet/trips/import-status` | `VehicleTrip` R, `TripImportState` R, `TelemetryDevice` R, `DeviceAssignment` R, `ImplementAssignment` R, `Vehicle` R, `Implement` R |
| `TripDialog` | sõidu rada, kohad, mõõdikud; märkuse muutmine | `GET /api/fleet/trips/:id/track`, `PATCH /api/fleet/trips/:id` | `VehicleTrip` RU, tsdb R |
```
→
```md
| `TripRegister` | sõitude register: ha ja Kanne (✓/—) veerg, filtrid (sh „ainult kandeta põllusõidud“), impordi olek | `GET /api/fleet/trips`, `GET /api/fleet/trips/import-status` | `VehicleTrip` R, `VehicleTripField` R, `WorkEntry` R, `FieldWork` R, `WorkType` R, `FieldSeason` R, `Field` R, `TripImportState` R, `TelemetryDevice` R, `DeviceAssignment` R, `ImplementAssignment` R, `Vehicle` R, `Implement` R |
| `TripDialog` | sõidu rada, kohad, mõõdikud, põldude tabel (põllul oldud aeg, ha koos haakeriista ja laiusega, kütus põllul / koos teega, kanne → avab põllu töö); märkuse muutmine | `GET /api/fleet/trips/:id/track`, `PATCH /api/fleet/trips/:id` | `VehicleTrip` RU, `VehicleTripField` R, `WorkEntry` R, tsdb R |
```

```md
**Taustaimport** (`tripImport.ts`, käivitab `prod.ts` iga 15 min; käsitsi `npm run tenant -- trips:import`): TELEMETRY mooduliga ettevõtete mobiilseadmete punktid (`measurements`, omandiperioodi piires) → sõidud (`VehicleTrip` CUD) ja impordi olek (`TripImportState` CU). Kohad: `FieldSeason` R, `PointOfInterest` R.
```
→
```md
**Taustaimport** (`tripImport.ts`, käivitab `prod.ts` iga 15 min; käsitsi `npm run tenant -- trips:import`): TELEMETRY mooduliga ettevõtete mobiilseadmete punktid (`measurements`, omandiperioodi piires) → sõidud (`VehicleTrip` CUD) koos põllu ridadega (`VehicleTripField` CD: põllul oldud aeg, ha haakeriista laiusega põllu piires, kütus põllul ja koos teekütuse osaga) ja impordi olek (`TripImportState` CU). Kohad: `FieldSeason` R, `PointOfInterest` R; haakeriist ja laius: `DeviceAssignment` R, `ImplementAssignment` R, `Implement` R. Lõplikud sõidud arvutatakse uuesti kohtade või seoste (sõrmejälg) muutusel; kandega seotud sõidu id säilib liitumisel (`WorkEntry` seos ei kao).
```

API tabelis:

```md
| `GET /api/fleet/trips` | `VehicleTrip`, `TelemetryDevice`, `DeviceAssignment`, `ImplementAssignment`, `Vehicle`, `Implement` | — | moodul TELEMETRY |
```
→
```md
| `GET /api/fleet/trips` | `VehicleTrip`, `VehicleTripField`, `WorkEntry`, `FieldWork`, `WorkType`, `FieldSeason`, `Field`, `TelemetryDevice`, `DeviceAssignment`, `ImplementAssignment`, `Vehicle`, `Implement` | — | moodul TELEMETRY; `unlinkedOnly=1` = ainult kandeta põllureaga sõidud |
```

```md
| `PATCH /api/fleet/trips/:id` | `VehicleTrip` | U: `VehicleTrip` (ainult `notes`) | moodul TELEMETRY |
```
→
```md
| `PATCH /api/fleet/trips/:id` | `VehicleTrip`, `VehicleTripField`, `WorkEntry` | U: `VehicleTrip` (ainult `notes`) | moodul TELEMETRY |
```

```md
| `GET /api/field-works/telemetry-suggestions` | `FieldWork`, `FieldSeason`, `WorkEntry`, `DeviceAssignment`, `TelemetryDevice`, `Vehicle`, `RelatedParty`, `Implement`, `ImplementAssignment`, `DeviceOwnership`, `Field`, `PointOfInterest`, tsdb `measurements` | — | moodul TELEMETRY |
```
→
```md
| `GET /api/field-works/telemetry-suggestions` | `FieldWork`, `VehicleTripField`, `VehicleTrip`, `WorkEntry`, `DeviceAssignment`, `ImplementAssignment`, `Vehicle`, `Implement` | — | moodul TELEMETRY; sõitude registrist (põllurida kattub Tallinna päevaga); sama hooaja teise kandega seotud sõit jäetakse välja |
```

```md
| `POST /api/work-entries` | `FieldWork`, `RelatedParty`, `Vehicle`, `Implement`, `Material`, `WorkEntry`, `Warehouse` | C: `WorkEntry`, `WorkEntryLine`; U: `FieldWork` (olek); laoseisu ümberarvutus | ladu salvestatakse alati (valimata → põhiladu); mitteaktiivne ladu → 400 |
| `PUT /api/work-entries/:id` | `WorkEntry`, `WorkEntryLine`, `RelatedParty`, `Vehicle`, `Implement`, `Material`, `Warehouse` | U: `WorkEntry`, `FieldWork`; C/D: `WorkEntryLine`; laoseisu ümberarvutus | kinnitatud hinnad säilitatakse, finantsolek võib muutuda; senine mitteaktiivne ladu jääb, uueks laoks ainult aktiivne |
```
→
```md
| `POST /api/work-entries` | `FieldWork`, `RelatedParty`, `Vehicle`, `Implement`, `Material`, `WorkEntry`, `Warehouse`, `VehicleTripField` | C: `WorkEntry`, `WorkEntryLine`; U: `FieldWork` (olek); laoseisu ümberarvutus | ladu salvestatakse alati (valimata → põhiladu); mitteaktiivne ladu → 400; `tripId`: sõidul peab olema selle hooaja põllurida ja sõit ei tohi olla sama hooaja teise kandega seotud (muidu 400) |
| `PUT /api/work-entries/:id` | `WorkEntry`, `WorkEntryLine`, `RelatedParty`, `Vehicle`, `Implement`, `Material`, `Warehouse`, `VehicleTripField` | U: `WorkEntry`, `FieldWork`; C/D: `WorkEntryLine`; laoseisu ümberarvutus | kinnitatud hinnad säilitatakse, finantsolek võib muutuda; senine mitteaktiivne ladu jääb, uueks laoks ainult aktiivne; `tripId` puudub → seos jääb, `null` → eemaldub, uus väärtus kontrollitakse nagu POST-is |
```

CRUD-maatriksis:

```md
| `VehicleTrip` | | | | | | | | | RU | | | | |
| `TripImportState` | | | | | | | | | R | | | | |
```
→
```md
| `VehicleTrip` | | R | | | | | R | | RU | | | | |
| `VehicleTripField` | | R | | D | | | R | | R | | | | |
| `TripImportState` | | | | | | | | | R | | | | |
```

```md
| `WorkEntry` | | RCU | | CD | | | RCUD | | U | | U | U | |
```
→
```md
| `WorkEntry` | | RCU | | CD | | | RCUD | | RU | | U | U | |
```

- [ ] **Step 2: `docs/andmemudel.md`**

Masinapargi tabelis:

```md
| `VehicleTrip` | `vehicle_trips` | jah | Seadme sõit (süüde sisse → välja), tuletatud telemeetriast; muudetav ainult märkus |
| `TripImportState` | `trip_import_state` | jah | Seadme sõitude impordi olek (lõplik kuni, viimane viga, kohtade sõrmejälg) |
```
→
```md
| `VehicleTrip` | `vehicle_trips` | jah | Seadme sõit (süüde sisse → välja), tuletatud telemeetriast; põldude ha summa (`areaHa`); muudetav ainult märkus |
| `VehicleTripField` | `vehicle_trip_fields` | jah | Sõidu osa ühel põllul (hooajal): põllul oldud aeg, ha haakeriista laiusega põllu piires, kütus põllul ja koos teekütuse osaga; haakeriist teabena (mitte FK) |
| `TripImportState` | `trip_import_state` | jah | Seadme sõitude impordi olek (lõplik kuni, viimane viga, kohtade ja seoste sõrmejälg) |
```

Mõlemas mermaid-skeemis (masinapargi plokk ja „Kõik seosed“) rea `  TelemetryDevice ||--o| TripImportState : "device"` järele:

```
  VehicleTrip ||--o{ VehicleTripField : "trip"
  FieldSeason ||--o{ VehicleTripField : "fieldSeason"
  VehicleTrip |o--o{ WorkEntry : "trip"
```

`WorkEntry` olemi plokis:

```
    Float telemetryAreaHa "valikuline"
```
→
```
    Float telemetryAreaHa "valikuline"
    String tripId FK "valikuline"
```

(`scripts/generate-erd.mts` sõite ei sisalda — eelmise etapi järgi muudetakse `andmemudel.md` käsitsi.)

- [ ] **Step 3: Spec staatus**

`docs/superpowers/specs/2026-11-05-soidu-pollud-design.md`: `Staatus: disain kinnitatud, plaan koostamata` → `Staatus: live 2026-11-05 (plaan: docs/superpowers/plans/2026-11-05-soidu-pollud.md)`.

- [ ] **Step 4: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add docs/vaated-ja-andmed.md docs/andmemudel.md docs/superpowers/specs/2026-11-05-soidu-pollud-design.md docs/superpowers/plans/2026-11-05-soidu-pollud.md && git commit -m "docs(soidu-pollud): vaated, API, maatriks, andmemudel, spec staatus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

- [ ] **Step 5: Release**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm run release'`
Expected: tsc OK, kõik testid PASS, build OK, teenus taaskäivitatud. Kui mõni test ebaõnnestub, **peatu** (andmesammu ei tehta).

- [ ] **Step 6: Varukoopia `telemetryAreaHa`-st (enne tühjendamist)**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'bash -s' <<'EOF'
set -euo pipefail
cd /home/debian/teris
set -a; . ./.env; set +a
DB="${PLATFORM_DATABASE_URL%%\?*}"
OUT=/home/debian/backups/telemetry-area-ha-2026-11-05.json
mkdir -p /home/debian/backups
test ! -e "$OUT" || { echo "Fail on juba olemas: $OUT — ei kirjuta üle"; exit 1; }
psql "$DB" -At -c "SELECT coalesce(json_agg(json_build_object('id', id, 'tenantId', tenant_id, 'telemetryAreaHa', \"telemetryAreaHa\") ORDER BY id), '[]'::json) FROM work_entries WHERE \"telemetryAreaHa\" IS NOT NULL" > "$OUT"
DB_COUNT=$(psql "$DB" -At -c "SELECT count(*) FROM work_entries WHERE \"telemetryAreaHa\" IS NOT NULL")
FILE_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).length)" "$OUT")
echo "andmebaasis=$DB_COUNT failis=$FILE_COUNT"
cat "$OUT"
EOF
```
Expected: `andmebaasis=N failis=N` (plaani koostamisel N = 2) ja JSON-massiiv N kirjega. Kui arvud erinevad või fail on tühi/vigane, **peatu**.

- [ ] **Step 7: Tühjenda `telemetryAreaHa` (ainult kui varukoopia vastab)**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'bash -s' <<'EOF'
set -euo pipefail
cd /home/debian/teris
set -a; . ./.env; set +a
DB="${PLATFORM_DATABASE_URL%%\?*}"
OUT=/home/debian/backups/telemetry-area-ha-2026-11-05.json
DB_COUNT=$(psql "$DB" -At -c "SELECT count(*) FROM work_entries WHERE \"telemetryAreaHa\" IS NOT NULL")
FILE_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).length)" "$OUT")
[ "$DB_COUNT" = "$FILE_COUNT" ] || { echo "Varukoopia ei vasta ($DB_COUNT vs $FILE_COUNT) — peatun"; exit 1; }
psql "$DB" -v ON_ERROR_STOP=1 -c "UPDATE work_entries SET \"telemetryAreaHa\" = NULL WHERE \"telemetryAreaHa\" IS NOT NULL"
psql "$DB" -At -c "SELECT count(*) FROM work_entries WHERE \"telemetryAreaHa\" IS NOT NULL"
EOF
```
Expected: `UPDATE N` ja seejärel `0`.

Taastamine vajadusel (ainult kasutaja palvel): iga JSON-kirje kohta `UPDATE work_entries SET "telemetryAreaHa" = <väärtus> WHERE id = '<id>'` PLATFORM-rolliga.

- [ ] **Step 8: Kõigi sõitude ümberarvutus**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'bash -s' <<'EOF'
set -euo pipefail
cd /home/debian/teris
set -a; . ./.env; set +a
DB="${PLATFORM_DATABASE_URL%%\?*}"
psql "$DB" -v ON_ERROR_STOP=1 -c "UPDATE trip_import_state SET \"finalizedUntil\" = NULL"
npm run tenant -- trips:import
psql "$DB" -c "SELECT count(*) AS trips, count(\"areaHa\") AS trips_with_ha FROM vehicle_trips" \
  -c "SELECT count(*) AS fields, count(\"areaHa\") AS with_ha, count(\"fuelSharedL\") AS with_fuel FROM vehicle_trip_fields" \
  -c "SELECT \"deviceId\", \"lastError\" FROM trip_import_state WHERE \"lastError\" IS NOT NULL"
EOF
```
Expected: `Sõitude import tehtud`; `vehicle_trip_fields` ridu > 0 (põllusõitudel); vigu (`lastError`) ei ole. Sõitude arv on umbes sama mis enne (plaani koostamisel 66) — id-d säilivad kattuvuse järgi.

- [ ] **Step 9: Live-kontroll**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'bash -s' <<'EOF'
set -euo pipefail
cd /home/debian/teris
set -a; . ./.env; set +a
DB="${PLATFORM_DATABASE_URL%%\?*}"
psql "$DB" -c "SELECT t.\"startedAt\", f.\"fieldSeasonId\", f.\"arriveAt\", f.\"leaveAt\", f.\"activeMinutes\", f.\"areaHa\", f.\"widthM\", f.\"fuelFieldL\", f.\"fuelSharedL\", t.\"fuelLiters\" FROM vehicle_trip_fields f JOIN vehicle_trips t ON t.id = f.\"tripId\" ORDER BY t.\"startedAt\" DESC LIMIT 10"
psql "$DB" -At -c "SELECT count(*) FROM (SELECT t.id FROM vehicle_trips t JOIN vehicle_trip_fields f ON f.\"tripId\" = t.id WHERE t.\"fuelLiters\" IS NOT NULL GROUP BY t.id, t.\"fuelLiters\" HAVING abs(sum(f.\"fuelSharedL\") - t.\"fuelLiters\") > 0.05) x"
systemctl is-active teris
EOF
```
Expected: põllured mõistlike aegade ja ha-ga (laiuseta haakeriistal `areaHa` tühi); teine päring `0` (jagatud kütuse summa = sõidu kütus); `active`.

Seejärel palu kasutajal brauseris kontrollida:
1. Tehnika → Sõidud: veerud **ha** ja **Kanne**; filter „Ainult kandeta põllusõidud“; sõidu aknas tabel „Põllud“.
2. Põllutööd → kande lisamine põllul, kus oli põllusõit: soovitus näitab sõidu aega (pausid sees), ha ja kütust; klõps täidab kütuse; salvestamise järel on soovitusel „✓ Seotud“ ja „Eemalda seos“.
3. Sama sõit registris: Kanne = ✓; sõidu aknas kande link avab põllu töö.
