# Sõitude vahede kontroll (jälgimata töö märgid) — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sõitude import leiab iga kahe järjestikuse sõidu vahelt jälgimata töö märgid (toide kadus, seade vaikis, kütus kadus, asukoht hüppas, CAN mootoritunnid kasvasid), salvestab need; sõitude registris on vahe hoiatusrida kontrolli märkega ja AI näeb kontrollimata vahesid.

**Architecture:** Puhas `tripGaps.ts` arvutab sõitudest ja telemeetria punktidest (pinge, CAN tunnid) vahed. `tripGapStore.ts` arvutab seadme vahed ajaaknas uuesti ja kirjutab `vehicle_trip_gaps` (upsert järgmise sõidu järgi, kontrolli märge jääb, kontrollitud vahet ei kustutata); seda kutsub import pärast iga sõitude kirjutamist ning sõitude API pärast kustutamist/taastamist. API annab sõidule `gapBefore`, filtri `gaps` ja kontrolli märke `PATCH`. UI: hoiatusrida registris, kontrolli dialoog, filter. MCP: `list_trip_gaps`.

**Tech Stack:** TypeScript, Node http, Prisma 6 (PostgreSQL + RLS + tenant FK trigerid), TimescaleDB (`measurements`), React 19, Vitest, MCP SDK + zod.

**Spec:** `docs/superpowers/specs/2026-11-11-soitude-vahed-design.md`

## Global Constraints

- Kood töötab serveris: `ssh debian@uvn-243-120.tll07.zonevs.eu`, kaust `/home/debian/teris`. Kohalik `/Users/andresj/Progemine/teris` on sshfs-mount — faile võib muuta kohalikult (Read/Edit/Write), aga **kõik käsud (npm, npx, git, psql) käivita ssh kaudu** serveri kaustas.
- Testid käivad live-andmebaasi vastu ajutise ettevõttega (`test-tenant-…-${process.pid}`), mis testi lõpus kustutatakse. Testi abifunktsioon on `runAsTenant(T, async () => await fn())` (Prisma päringud on laisad).
- Identifikaatorid (URL-id, id/class, CSS, väljanimed) inglise keeles; kommentaarid ja UI-tekst eesti keeles.
- UI kuupäevad/kellaajad `pp.kk.aaaa HH:MM` Tallinna ajas (`formatDateTime` failist `src/components/fleetDateTime.ts`).
- UI numbrid Eesti formaadis (koma); tabeli numbriveerud paremale (`className="num"`).
- Kõik filtrid `FilterClear` sees.
- Piirid (üks koht: `src/services/tripGapLimits.ts`): toide < 6 V kokku ≥ 5 min; seade vaikis ≥ 180 min; kütus langes ≥ 5 protsendipunkti; asukoht ≥ 500 m; CAN mootoritunnid ≥ 2 h (UI näitab kasvu alates +1 h, kui vahe on muu märgi tõttu salvestatud). CAN tunninäitu otsitakse kuni 1 h väljapoole vahe piire.
- Mootoritundide märk kasutab **ainult** `engine_total_hours_h` (masina CAN koguaeg), mitte `engine_worktime_counted_min` / `io_103`.
- Vahe = kahe järjestikuse **kustutamata** sõidu vahe; kustutatud sõidu aeg kuulub vahe sisse. Vahe võti on `nextTripId` (unikaalne).
- Kütusetaseme näit 0 ei loe sõidu algus- ega lõpunäiduks.
- Skeemimuudatus: `npx prisma db push` (ilma `--accept-data-loss`; kui küsib, **peatu ja küsi kasutajalt**) + `npx prisma generate`; RLS: tabel `scripts/tenancy/02-rls.sql` loendisse + `psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql`; seejärel `npx tsx scripts/tenancy/05-tenant-fk-triggers.mts`.
- Live-tabelite andmeid loe/kirjuta käsurealt ainult `PLATFORM_DATABASE_URL`-iga; veerunimed camelCase jutumärkides. Kuupäevaveerud on `timestamp` (UTC) — Tallinna aeg: `("x" at time zone 'UTC') at time zone 'Europe/Tallinn'`.
- `npm run tenant -- trips:import` käivitab **kompileeritud** `dist-server/tenantCli.js` — andmesamm alles pärast `npm run release`.
- Lõpus commit + `npm run release` serveris.
- Commit-sõnumi lõppu: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Failid

| Fail | Vastutus |
|---|---|
| `prisma/schema.prisma` | `VehicleTripGap`; seosed `VehicleTrip`-il ja `TelemetryDevice`-il |
| `scripts/tenancy/02-rls.sql` | RLS tabelile `vehicle_trip_gaps` |
| `src/server/tenantScope.test.ts` | ettevõtte mudelite arv 39 → 40 |
| `src/server/tripSegments.ts` (+ test) | kütusetaseme näit 0 ei loe |
| `src/services/tripGapLimits.ts` (uus) | piirid (server + UI) |
| `src/server/tripGaps.ts` (uus, + test) | puhas vahede arvutus |
| `src/server/telemetryAccess.ts` | `fetchGapSamples` (pinge, CAN tunnid) |
| `src/server/tripGapStore.ts` (uus) | vahede ümberarvutus ja kirjutamine; seadme lukk |
| `src/server/tripImport.ts` (+ test) | vahede ümberarvutus pärast `writeChunk`-i; `ImportDeps.fetchGapSamples` |
| `src/server/tripsApi.ts` (+ test) | `gapBefore`, filter `gaps`, `PATCH /api/fleet/trips/gaps/:id`, ümberarvutus kustutamisel/taastamisel |
| `src/types/fleet.ts`, `src/services/api.ts` | `TripGap`, `Trip.gapBefore`, `TripFilter.gaps`, `reviewTripGap` |
| `src/components/tripGapText.ts` (uus, + test) | hoiatuse tekst |
| `src/components/TripGapReviewDialog.tsx` (uus) | kontrolli dialoog |
| `src/components/TripRegister.tsx`, `src/index.css` | hoiatusrida, filter, loendur |
| `src/server/mcp/tools/fleet.ts`, `src/server/mcp/instructions.ts`, `src/server/mcp/mcp.test.ts` | `list_trip_gaps` |
| `docs/andmemudel.md` | `VehicleTripGap` |

---

### Task 1: Andmemudel, RLS ja FK-trigerid

**Files:**
- Modify: `prisma/schema.prisma` (mudelid `TelemetryDevice`, `VehicleTrip`; uus `VehicleTripGap` pärast `VehicleTripField`)
- Modify: `scripts/tenancy/02-rls.sql:12-13`
- Modify: `src/server/tenantScope.test.ts:13`

**Interfaces:**
- Produces: Prisma mudel `VehicleTripGap` (`prisma.vehicleTripGap`), väljad: `id, tenantId, deviceId, prevTripId?, nextTripId (unique), startedAt, endedAt, powerLostMinutes?, silentMinutes?, fuelDropPct?, jumpM?, engineHoursGrowth?, reviewedAt?, reviewedBy?, reviewNote?, computedAt, createdAt, updatedAt`; seosed `VehicleTrip.gapBefore` (`VehicleTripGap?`), `VehicleTrip.gapsAfter`, `TelemetryDevice.tripGaps`, `VehicleTripGap.nextTrip`, `VehicleTripGap.prevTrip`.

- [ ] **Step 1: Uuenda mudelite arvu testi (failib)**

`src/server/tenantScope.test.ts` real 13:

```ts
    expect(TENANT_MODELS.size).toBe(40);
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tenantScope.test.ts'`
Expected: FAIL `expected 39 to be 40`.

- [ ] **Step 2: Skeem**

`prisma/schema.prisma` mudelis `TelemetryDevice`, rea `importState TripImportState?` järele:

```prisma
  tripGaps    VehicleTripGap[]
```

Mudelis `VehicleTrip`, rea `workEntries       WorkEntry[]` järele:

```prisma
  gapBefore         VehicleTripGap?    @relation("TripGapNext")
  gapsAfter         VehicleTripGap[]   @relation("TripGapPrev")
```

Uus mudel kohe pärast mudelit `VehicleTripField` (enne `// Seadme sõitude impordi olek` kommentaari):

```prisma
// Sõitude vahe: kahe järjestikuse kustutamata sõidu vaheline aeg, kus on jälgimata töö märke (toide kadus, seade vaikis,
// kütus kadus, asukoht hüppas, CAN mootoritunnid kasvasid). Tuletatud impordis; võti on järgmine sõit.
// Kontrolli märge (reviewed*) jääb ümberarvutusel alles; kontrollitud vahet ümberarvutus ei kustuta.
model VehicleTripGap {
  id                String          @id @default(cuid())
  tenantId          String          @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  deviceId          String
  device            TelemetryDevice @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  prevTripId        String?
  prevTrip          VehicleTrip?    @relation("TripGapPrev", fields: [prevTripId], references: [id], onDelete: SetNull)
  nextTripId        String          @unique
  nextTrip          VehicleTrip     @relation("TripGapNext", fields: [nextTripId], references: [id], onDelete: Cascade)
  startedAt         DateTime // eelmise sõidu lõpp
  endedAt           DateTime // järgmise sõidu algus
  powerLostMinutes  Float? // toitepinge < 6 V kokku; tühi = pingenäite polnud
  silentMinutes     Float? // pikim paus seadme punktide vahel (vahe otsad kaasa)
  fuelDropPct       Float? // eelmise lõpu − järgmise alguse paagitase (positiivne = langus); tühi = näit puudub
  jumpM             Float? // eelmise sõidu lõpu ja järgmise alguse kaugus
  engineHoursGrowth Float? // masina CAN mootori koguaja kasv; tühi = masin ei saada või näit puudub
  reviewedAt        DateTime? // kontrollitud; tühi = kontrollimata
  reviewedBy        String? // kontrollija kasutajatunnus
  reviewNote        String? // selgitus
  computedAt        DateTime
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([deviceId, startedAt])
  @@index([tenantId, reviewedAt])
  @@map("vehicle_trip_gaps")
}
```

- [ ] **Step 3: RLS loend**

`scripts/tenancy/02-rls.sql` read 12–13 (mõlemad loendi kohad failis, kui neid on mitu — otsi `'tenant_weather_credentials'`):

```sql
    'harvest_lots','harvest_lot_weighings','harvest_lot_costs','vehicle_trips','trip_import_state','vehicle_trip_fields',
    'tenant_weather_credentials','vehicle_trip_gaps'
```

- [ ] **Step 4: Rakenda skeem, RLS ja trigerid**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx prisma db push && npx prisma generate && set -a && . ./.env && set +a && psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql && npx tsx scripts/tenancy/05-tenant-fk-triggers.mts'
```

Expected: `db push` ilma andmekao hoiatuseta (uus tabel); psql `DO`, `GRANT`, `REVOKE`; skript `OK: N trigerit`. Kui `db push` küsib `--accept-data-loss`, **peatu ja küsi kasutajalt**.

- [ ] **Step 5: Kontrolli**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/tenantScope.test.ts src/server/tenantIsolation.test.ts'
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add prisma/schema.prisma scripts/tenancy/02-rls.sql src/server/tenantScope.test.ts && git commit -m "feat(sõidud): andmemudel vehicle_trip_gaps (RLS, FK)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 2: Kütusetaseme näit 0 ei loe

**Files:**
- Modify: `src/server/tripSegments.ts` (`fuelLevelStart`, `build` → `fuelLevelEndPct`)
- Test: `src/server/tripSegments.test.ts`

**Interfaces:**
- Produces: `SegmentedTrip.fuelLevelStartPct/EndPct` ei ole kunagi `0`.

- [ ] **Step 1: Failiv test**

`src/server/tripSegments.test.ts` — lisa `describe('segmentTrips'` sisse testi `'kütusetase ja mootoritunnid: esimene ja viimane näit'` järele:

```ts
  it('kütusetaseme näit 0 (süüte lülitamise hetk) ei loe algus- ega lõpunäiduks', () => {
    const lv = [null, null, 0, 81, 80, 80, 79, 79, 78, 78, 0];
    const pts = run(0, 10).map((p, i) => ({ ...p, fuelLevelPct: lv[i] }));
    const t = segmentTrips(pts, LATER)[0];
    expect(t.fuelLevelStartPct).toBe(81); // i=2 on 0 → järgmine
    expect(t.fuelLevelEndPct).toBe(78);
  });

  it('ainult nullnäidud → kütusetase tühi', () => {
    const pts = run(0, 10).map((p) => ({ ...p, fuelLevelPct: 0 }));
    const t = segmentTrips(pts, LATER)[0];
    expect(t.fuelLevelStartPct).toBeNull();
    expect(t.fuelLevelEndPct).toBeNull();
  });
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tripSegments.test.ts'`
Expected: FAIL (`expected 0 to be 81` / `expected 0 to be 78`).

- [ ] **Step 2: Teostus**

`src/server/tripSegments.ts` — asenda funktsioon `fuelLevelStart` ja lisa selle ette `fuelOf`:

```ts
// Kütusetaseme andur annab süüte lülitamise hetkel 0 — päris paak 0% ei ole, seega 0 ei loe näiduks
const fuelOf = (p: TripSample) => (p.fuelLevelPct == null || p.fuelLevelPct === 0 ? null : p.fuelLevelPct);
const fuelLevelStart = (pts: TripSample[]) => {
  const settled = pts[0].time.getTime() + FUEL_LEVEL_SETTLE_MS;
  for (const p of pts) if (fuelOf(p) != null && p.time.getTime() >= settled) return fuelOf(p);
  return firstOf(pts, fuelOf); // sõit lühem kui 2 min või hiljem näite pole
};
```

Funktsioonis `build` asenda rida `fuelLevelEndPct: lastOf(pts, (p) => p.fuelLevelPct),`:

```ts
    fuelLevelEndPct: lastOf(pts, fuelOf),
```

- [ ] **Step 3: Testid läbi**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tripSegments.test.ts'`
Expected: PASS (ka olemasolev settimise test, mis ootab 85).

- [ ] **Step 4: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/tripSegments.ts src/server/tripSegments.test.ts && git commit -m "fix(sõidud): kütusetaseme näit 0 ei loe sõidu algus- ega lõpunäiduks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 3: Vahede puhas arvutus (`tripGaps.ts`)

**Files:**
- Create: `src/services/tripGapLimits.ts`
- Create: `src/server/tripGaps.ts`
- Test: `src/server/tripGaps.test.ts`

**Interfaces:**
- Produces (`src/services/tripGapLimits.ts`):
  ```ts
  export const GAP_LIMITS: { powerLostMinutes: 5; silentMinutes: 180; fuelDropPct: 5; jumpM: 500; engineHoursGrowth: 2 };
  export const ENGINE_HOURS_SHOWN_FROM = 1;
  ```
- Produces (`src/server/tripGaps.ts`):
  ```ts
  export type GapTrip = { id: string; startedAt: Date; endedAt: Date; startLat: number; startLng: number; endLat: number; endLng: number; fuelLevelStartPct: number | null; fuelLevelEndPct: number | null };
  export type GapSample = { time: Date; voltage: number | null; canHours: number | null };
  export type GapSigns = { powerLostMinutes: number | null; silentMinutes: number; fuelDropPct: number | null; jumpM: number; engineHoursGrowth: number | null };
  export type GapCalc = GapSigns & { prevTripId: string; nextTripId: string; startedAt: Date; endedAt: Date };
  export const LOW_VOLTAGE_V = 6;
  export const HOURS_LOOKAROUND_MS: number; // 1 h
  export function isFlagged(g: GapSigns): boolean;
  export function computeGaps(trips: GapTrip[], samples: GapSample[]): GapCalc[]; // trips ja samples ajas kasvavalt
  ```

- [ ] **Step 1: Failiv test**

`src/server/tripGaps.test.ts`:

```ts
// src/server/tripGaps.test.ts — sõitude vahede märgid ja piirid.
import { describe, it, expect } from 'vitest';
import { computeGaps, isFlagged, type GapSample, type GapTrip } from './tripGaps';

const T0 = Date.parse('2026-11-09T06:00:00Z');
const at = (m: number) => new Date(T0 + m * 60_000);
const trip = (id: string, a: number, b: number, o: Partial<GapTrip> = {}): GapTrip => ({
  id, startedAt: at(a), endedAt: at(b), startLat: 58.1, startLng: 26.1, endLat: 58.1, endLng: 26.1,
  fuelLevelStartPct: 50, fuelLevelEndPct: 50, ...o
});
const smp = (m: number, voltage: number | null = 13, canHours: number | null = null): GapSample => ({ time: at(m), voltage, canHours });
// Punktid iga 5 min järel [a, b], pinge 13 V
const every5 = (a: number, b: number) => Array.from({ length: Math.floor((b - a) / 5) + 1 }, (_, i) => smp(a + i * 5));

describe('computeGaps', () => {
  it('puhas vahe (punktid tihedalt, pinge korras, sama koht ja paak) → hoiatust pole', () => {
    expect(computeGaps([trip('a', 0, 60), trip('b', 120, 180)], every5(60, 120))).toEqual([]);
  });

  it('toide kadus 15 min → vahe koos märkidega', () => {
    const samples = every5(60, 120).map((s) => (s.time >= at(70) && s.time <= at(80) ? { ...s, voltage: 0 } : s));
    const gaps = computeGaps([trip('a', 0, 60), trip('b', 120, 180)], samples);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      prevTripId: 'a', nextTripId: 'b', startedAt: at(60), endedAt: at(120),
      powerLostMinutes: 15, silentMinutes: 5, fuelDropPct: 0, jumpM: 0, engineHoursGrowth: null
    });
  });

  it('toide kadus 4 min → alla piiri, hoiatust pole', () => {
    const samples = [smp(60), smp(70, 0), smp(74), ...every5(75, 120)];
    expect(computeGaps([trip('a', 0, 60), trip('b', 120, 180)], samples)).toEqual([]);
  });

  it('seade vaikis 225 min; vaikimise ajal toitekatkestust ei loeta', () => {
    const samples = [smp(60), smp(65, 0), smp(290), smp(295), smp(300)];
    const g = computeGaps([trip('a', 0, 60), trip('b', 300, 360)], samples)[0];
    expect(g.silentMinutes).toBe(225);
    expect(g.powerLostMinutes).toBe(0);
  });

  it('punkte pole üldse → seade vaikis kogu vahe, pinge tühi', () => {
    const g = computeGaps([trip('a', 0, 60), trip('b', 300, 360)], [])[0];
    expect(g.silentMinutes).toBe(240);
    expect(g.powerLostMinutes).toBeNull();
  });

  it('kütus langes 8 protsendipunkti → hoiatus; tankimine ei anna hoiatust', () => {
    const drop = computeGaps([trip('a', 0, 60, { fuelLevelEndPct: 60 }), trip('b', 120, 180, { fuelLevelStartPct: 52 })], every5(60, 120));
    expect(drop[0].fuelDropPct).toBe(8);
    const refuel = computeGaps([trip('a', 0, 60, { fuelLevelEndPct: 50 }), trip('b', 120, 180, { fuelLevelStartPct: 90 })], every5(60, 120));
    expect(refuel).toEqual([]);
  });

  it('kütuse näit puudub → kütuse märk tühi', () => {
    const g = computeGaps([trip('a', 0, 60, { fuelLevelEndPct: null }), trip('b', 300, 360)], [])[0];
    expect(g.fuelDropPct).toBeNull();
  });

  it('asukoht hüppas ~1,1 km → hoiatus', () => {
    const g = computeGaps([trip('a', 0, 60), trip('b', 120, 180, { startLat: 58.11 })], every5(60, 120))[0];
    expect(g.jumpM).toBeGreaterThan(1100);
    expect(g.jumpM).toBeLessThan(1125);
  });

  it('CAN mootoritunnid +3 h → hoiatus; näit otsitakse kuni 1 h väljapoolt vahet', () => {
    const samples = [smp(10, 13, 2797), ...every5(60, 120), smp(150, 13, 2800)];
    const g = computeGaps([trip('a', 0, 60), trip('b', 120, 180)], samples)[0];
    expect(g.engineHoursGrowth).toBe(3);
  });

  it('CAN mootoritunnid +1 h üksi hoiatust ei anna; koos asukohaga salvestub', () => {
    const samples = [smp(55, 13, 2797), ...every5(60, 120), smp(125, 13, 2798)];
    expect(computeGaps([trip('a', 0, 60), trip('b', 120, 180)], samples)).toEqual([]);
    const g = computeGaps([trip('a', 0, 60), trip('b', 120, 180, { startLat: 58.11 })], samples)[0];
    expect(g.engineHoursGrowth).toBe(1);
  });

  it('CAN näit üle 1 h väljaspool vahet → mootoritundide märk tühi', () => {
    const samples = [smp(-10, 13, 2797), ...every5(60, 120), smp(125, 13, 2805)];
    const g = computeGaps([trip('a', 0, 60), trip('b', 120, 180, { startLat: 58.11 })], samples)[0];
    expect(g.engineHoursGrowth).toBeNull();
  });

  it('kattuvad sõidud jäetakse vahele; mitme sõidu korral õiged paarid', () => {
    const trips = [trip('a', 0, 60), trip('b', 50, 70), trip('c', 400, 460)];
    const gaps = computeGaps(trips, []);
    expect(gaps.map((g) => [g.prevTripId, g.nextTripId])).toEqual([['b', 'c']]);
  });
});

describe('isFlagged', () => {
  const none = { powerLostMinutes: null, silentMinutes: 0, fuelDropPct: null, jumpM: 0, engineHoursGrowth: null };
  it('piirid', () => {
    expect(isFlagged(none)).toBe(false);
    expect(isFlagged({ ...none, powerLostMinutes: 5 })).toBe(true);
    expect(isFlagged({ ...none, silentMinutes: 180 })).toBe(true);
    expect(isFlagged({ ...none, silentMinutes: 179.9 })).toBe(false);
    expect(isFlagged({ ...none, fuelDropPct: 5 })).toBe(true);
    expect(isFlagged({ ...none, jumpM: 500 })).toBe(true);
    expect(isFlagged({ ...none, engineHoursGrowth: 2 })).toBe(true);
    expect(isFlagged({ ...none, engineHoursGrowth: 1 })).toBe(false);
  });
});
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tripGaps.test.ts'`
Expected: FAIL (moodulit `./tripGaps` pole).

- [ ] **Step 2: Piirid**

`src/services/tripGapLimits.ts`:

```ts
// src/services/tripGapLimits.ts — sõitude vahede hoiatuse piirid (server arvutab, UI kuvab sama piiri järgi).
export const GAP_LIMITS = {
  powerLostMinutes: 5, // toitepinge < 6 V kokku vähemalt
  silentMinutes: 180, // seade ei saatnud midagi vähemalt
  fuelDropPct: 5, // paagitase langes protsendipunkte vähemalt
  jumpM: 500, // asukoht eelmise sõidu lõpust järgmise alguseni vähemalt
  engineHoursGrowth: 2 // masina CAN mootoritunnid kasvasid vähemalt (näit täistundides)
} as const;

// Mootoritundide kasvu näidatakse alates sellest (kui vahe on muu märgi tõttu salvestatud)
export const ENGINE_HOURS_SHOWN_FROM = 1;
```

- [ ] **Step 3: Teostus**

`src/server/tripGaps.ts`:

```ts
// src/server/tripGaps.ts — sõitude vahede kontroll: kahe järjestikuse sõidu vahelised jälgimata töö märgid.
// Puhas: andmebaasi ei puutu. Vahe = eelmise sõidu lõpp → järgmise sõidu algus; tagastatakse ainult piiri ületanud vahed.
import { GAP_LIMITS } from '../services/tripGapLimits.ts';

export type GapTrip = {
  id: string;
  startedAt: Date;
  endedAt: Date;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  fuelLevelStartPct: number | null;
  fuelLevelEndPct: number | null;
};

// Seadme punkt: pinge (V) ja masina CAN mootori koguaeg (h); kumbki võib puududa
export type GapSample = { time: Date; voltage: number | null; canHours: number | null };

export type GapSigns = {
  powerLostMinutes: number | null;
  silentMinutes: number;
  fuelDropPct: number | null;
  jumpM: number;
  engineHoursGrowth: number | null;
};

export type GapCalc = GapSigns & { prevTripId: string; nextTripId: string; startedAt: Date; endedAt: Date };

export const LOW_VOLTAGE_V = 6;
export const HOURS_LOOKAROUND_MS = 60 * 60 * 1000;
const SILENT_MS = GAP_LIMITS.silentMinutes * 60_000;
const EARTH_RADIUS_M = 6371000;
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLng = (bLng - aLng) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export const isFlagged = (g: GapSigns): boolean =>
  (g.powerLostMinutes ?? 0) >= GAP_LIMITS.powerLostMinutes ||
  g.silentMinutes >= GAP_LIMITS.silentMinutes ||
  (g.fuelDropPct ?? 0) >= GAP_LIMITS.fuelDropPct ||
  g.jumpM >= GAP_LIMITS.jumpM ||
  (g.engineHoursGrowth ?? 0) >= GAP_LIMITS.engineHoursGrowth;

function signsOf(prev: GapTrip, next: GapTrip, samples: GapSample[]): GapSigns {
  const s = prev.endedAt.getTime();
  const e = next.startedAt.getTime();
  const inside = samples.filter((p) => p.time.getTime() >= s && p.time.getTime() <= e);

  // Seade vaikis: pikim paus punktide vahel, vahe algus ja lõpp kaasa
  let silentMs = 0;
  let last = s;
  for (const p of inside) {
    silentMs = Math.max(silentMs, p.time.getTime() - last);
    last = p.time.getTime();
  }
  silentMs = Math.max(silentMs, e - last);

  // Toide kadus: pingepunktist järgmiseni (viimasest vahe lõpuni), kui pinge < 6 V; vaikimise aega (≥ 3 h) ei loeta
  const volt = inside.filter((p) => p.voltage != null);
  let powerLostMinutes: number | null = null;
  if (volt.length) {
    let ms = 0;
    for (let i = 0; i < volt.length; i++) {
      const t = volt[i].time.getTime();
      const dt = (i + 1 < volt.length ? volt[i + 1].time.getTime() : e) - t;
      if (volt[i].voltage! < LOW_VOLTAGE_V && dt < SILENT_MS) ms += dt;
    }
    powerLostMinutes = round(ms / 60_000, 1);
  }

  // CAN mootoritunnid: viimane näit enne vahet ja esimene pärast (kuni 1 h väljapoole)
  let before: number | null = null;
  let after: number | null = null;
  for (const p of samples) {
    if (p.canHours == null) continue;
    const t = p.time.getTime();
    if (t <= s && t >= s - HOURS_LOOKAROUND_MS) before = p.canHours;
    if (t >= e && t <= e + HOURS_LOOKAROUND_MS && after == null) after = p.canHours;
  }

  const fuelDropPct = prev.fuelLevelEndPct != null && next.fuelLevelStartPct != null
    ? round(prev.fuelLevelEndPct - next.fuelLevelStartPct, 1)
    : null;

  return {
    powerLostMinutes,
    silentMinutes: round(silentMs / 60_000, 1),
    fuelDropPct,
    jumpM: Math.round(distanceM(prev.endLat, prev.endLng, next.startLat, next.startLng)),
    engineHoursGrowth: before != null && after != null ? round(after - before, 2) : null
  };
}

/** Kustutamata sõidud (ajas kasvavalt) ja seadme punktid (ajas kasvavalt) → piiri ületanud vahed. */
export function computeGaps(trips: GapTrip[], samples: GapSample[]): GapCalc[] {
  const out: GapCalc[] = [];
  for (let i = 1; i < trips.length; i++) {
    const prev = trips[i - 1];
    const next = trips[i];
    if (next.startedAt.getTime() <= prev.endedAt.getTime()) continue;
    const signs = signsOf(prev, next, samples);
    if (!isFlagged(signs)) continue;
    out.push({ prevTripId: prev.id, nextTripId: next.id, startedAt: prev.endedAt, endedAt: next.startedAt, ...signs });
  }
  return out;
}
```

- [ ] **Step 4: Testid läbi**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tripGaps.test.ts && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/services/tripGapLimits.ts src/server/tripGaps.ts src/server/tripGaps.test.ts && git commit -m "feat(sõidud): sõitude vahede jälgimata töö märkide arvutus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 4: Vahed impordis (`fetchGapSamples`, `tripGapStore.ts`)

**Files:**
- Modify: `src/server/telemetryAccess.ts` (uus `fetchGapSamples` pärast `fetchTripSamples`)
- Create: `src/server/tripGapStore.ts`
- Modify: `src/server/tripImport.ts` (`ImportDeps`, `defaultDeps`, `lockDevice` → import, `importDeviceTrips`)
- Test: `src/server/tripImport.test.ts`

**Interfaces:**
- Consumes: `computeGaps`, `HOURS_LOOKAROUND_MS`, `GapSample`, `GapTrip` (Task 3); `prisma.vehicleTripGap` (Task 1).
- Produces:
  ```ts
  // telemetryAccess.ts
  export async function fetchGapSamples(imei: string, fromExclusive: Date, toInclusive: Date): Promise<GapSample[]>;
  // tripGapStore.ts
  export type FetchGapSamples = (imei: string, fromExclusive: Date, toInclusive: Date) => Promise<GapSample[]>;
  export const lockDevice: (tx: TxClient, deviceId: string) => Promise<number>;
  export async function recomputeGaps(device: { id: string; imei: string }, from: Date, to: Date, fetch: FetchGapSamples, now?: Date): Promise<void>;
  // tripImport.ts
  export type ImportDeps = { now; fetchSamples; fetchGapSamples: FetchGapSamples; loadPlaces };
  ```

- [ ] **Step 1: Failivad testid**

`src/server/tripImport.test.ts`:

1. Impordid faili alguses — lisa `import type { GapSample } from './tripGaps';` rea `import type { Place } from './tripRoute';` järele.
2. Rea `let failImei: string | null = null;` järele lisa `let gapSamples: GapSample[] = [];`
3. `deps` objekti `fetchSamples` järele lisa:

```ts
  fetchGapSamples: async (_imei, from, to) => gapSamples.filter((s) => s.time > from && s.time <= to),
```

4. `beforeEach` sees rea `failImei = null;` järele lisa `gapSamples = [];`
5. Lisa faili lõppu:

```ts
describe('sõitude vahed', () => {
  const gapRows = () => run(() => prisma.vehicleTripGap.findMany({ orderBy: { startedAt: 'asc' } }));
  // Sõit 0–30 ja 60–90; vahe 30 → 60. Toide < 6 V minutitel 35–50 (15 min), kui powerLost = true
  const setup = (powerLost: boolean) => {
    samples = [...range(0, 30), pt(31, false), ...range(60, 90), pt(91, false)];
    gapSamples = [30, 35, 40, 45, 50, 55, 60].map((m) => ({ time: at(m), voltage: powerLost && m >= 35 && m < 50 ? 0 : 13, canHours: null }));
  };

  it('toitekatkestusega vahe salvestub järgmise sõidu külge', async () => {
    setup(true);
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    const [t, g] = [await trips(), await gapRows()];
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ deviceId, prevTripId: t[0].id, nextTripId: t[1].id, powerLostMinutes: 15, startedAt: at(30), endedAt: at(60) });
    expect(g[0].reviewedAt).toBeNull();
  });

  it('kontrolli märge jääb ümberarvutusel alles; kontrollitud vahe ei kao, kui märk langeb piiri alla', async () => {
    setup(true);
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    const g0 = (await gapRows())[0];
    await run(() => prisma.vehicleTripGap.update({ where: { id: g0.id }, data: { reviewedAt: at(100), reviewedBy: 'mari', reviewNote: 'remont' } }));
    nowMin = 150;
    await run(() => importDeviceTrips(device(), deps));
    let g = await gapRows();
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ id: g0.id, reviewNote: 'remont', reviewedBy: 'mari' });
    setup(false);
    nowMin = 180;
    await run(() => importDeviceTrips(device(), deps));
    g = await gapRows();
    expect(g).toHaveLength(1);
    expect(g[0].id).toBe(g0.id);
  });

  it('kontrollimata vahe kaob, kui märk enam piiri ei ületa', async () => {
    setup(true);
    nowMin = 120;
    await run(() => importDeviceTrips(device(), deps));
    expect(await gapRows()).toHaveLength(1);
    setup(false);
    nowMin = 150;
    await run(() => importDeviceTrips(device(), deps));
    expect(await gapRows()).toHaveLength(0);
  });

  it('kustutatud sõit on vahe sees: vahe tekib kustutamata naabrite vahele', async () => {
    // Sõidud 0–30, 60–90, 120–150; keskmine kustutatakse, toide kadus minutitel 35–50
    samples = [...range(0, 30), pt(31, false), ...range(60, 90), pt(91, false), ...range(120, 150), pt(151, false)];
    gapSamples = [30, 35, 40, 45, 50, 55, 60, 95, 100, 105, 110, 115, 120].map((m) => ({ time: at(m), voltage: m >= 35 && m < 50 ? 0 : 13, canHours: null }));
    nowMin = 200;
    await run(() => importDeviceTrips(device(), deps));
    const t = await trips();
    await run(() => prisma.vehicleTrip.update({ where: { id: t[1].id }, data: { deletedAt: at(190), deletedBy: 'mari' } }));
    nowMin = 230;
    await run(() => importDeviceTrips(device(), deps));
    const g = await gapRows();
    expect(g.map((x) => [x.prevTripId, x.nextTripId])).toEqual([[t[0].id, t[2].id]]);
    expect(g[0].powerLostMinutes).toBe(15);
  });
});
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tripImport.test.ts'`
Expected: FAIL (vahesid ei teki: `expected [] to have length 1`; tüübiviga `fetchGapSamples` ImportDeps-is vitest ei peata).

- [ ] **Step 2: `fetchGapSamples`**

`src/server/telemetryAccess.ts` — impordi rida `import type { TripSample } from './tripSegments.ts';` asenda:

```ts
import type { TripSample } from './tripSegments.ts';
import type { GapSample } from './tripGaps.ts';
```

Lisa pärast funktsiooni `fetchTripSamples`:

```ts
/**
 * Sõitude vahede jaoks: iga seadme punkti aeg, toitepinge ja masina CAN mootori koguaeg (fromExclusive, toInclusive],
 * omandiperioodide piires, ajas kasvavalt. Asukohta ei nõuta — ka asukohata punkt näitab, et seade saatis.
 */
export async function fetchGapSamples(imei: string, fromExclusive: Date, toInclusive: Date): Promise<GapSample[]> {
  if (!tsdb) return [];
  const segments = clampWindow((await ownershipWindows('IMEI', [imei])).get(imei) ?? [], fromExclusive, toInclusive);
  if (segments.length === 0) return [];
  const froms = segments.map((s) => s.from.toISOString());
  const tos = segments.map((s) => s.to.toISOString());
  const incl = segments.map((s) => s.toInclusive);
  const rows = await tsdb.$queryRaw<{ time: Date; voltage: number | null; can_hours: number | null }[]>`
    WITH pts AS (
      SELECT m.time, m.field,
        COALESCE(m.value_double, m.value_int::double precision, m.value_bigint::double precision) AS v
      FROM measurements m
      JOIN unnest(${froms}::timestamptz[], ${tos}::timestamptz[], ${incl}::boolean[]) AS s(seg_from, seg_to, seg_incl)
        ON m.time >= s.seg_from AND (m.time < s.seg_to OR (s.seg_incl AND m.time = s.seg_to))
      WHERE m.device = ${imei}
        AND m.time > ${fromExclusive} AND m.time <= ${toInclusive}
        AND m.measurement = 'data'
    )
    SELECT time,
      max(v) FILTER (WHERE field = 'external_voltage_v') AS voltage,
      max(v) FILTER (WHERE field = 'engine_total_hours_h') AS can_hours
    FROM pts
    GROUP BY time
    ORDER BY time ASC
  `;
  return rows.map((r) => ({
    time: r.time,
    voltage: r.voltage == null ? null : Number(r.voltage),
    canHours: r.can_hours == null ? null : Number(r.can_hours)
  }));
}
```

- [ ] **Step 3: `tripGapStore.ts`**

`src/server/tripGapStore.ts`:

```ts
// src/server/tripGapStore.ts — sõitude vahede salvestus: seadme vahed ajaaknas uuesti → vehicle_trip_gaps.
// Vahe võti on järgmine sõit (nextTripId). Ümberarvutus uuendab märke, kontrolli märge jääb alles;
// vahe, mis enam piiri ei ületa, kustutatakse — v.a. kontrollitud (läbivaadatud otsust ei kustutata).
import { prisma, tenantTransaction, type TxClient } from './db.ts';
import { computeGaps, HOURS_LOOKAROUND_MS, type GapCalc, type GapSample, type GapTrip } from './tripGaps.ts';

export type FetchGapSamples = (imei: string, fromExclusive: Date, toInclusive: Date) => Promise<GapSample[]>;

// Üheaegsed impordid ja API muudatused ei tohi sama seadme sõite ega vahesid korraga kirjutada
export const lockDevice = (tx: TxClient, deviceId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('trip-import:' || current_setting('app.tenant_id') || ':' || ${deviceId}))`;

const TRIP_SELECT = {
  id: true, startedAt: true, endedAt: true, startLat: true, startLng: true, endLat: true, endLng: true,
  fuelLevelStartPct: true, fuelLevelEndPct: true
} as const;

/** Vahed sõitudele, mille algus on (from, to]; vahe eelmine sõit võib olla varasem. */
export async function recomputeGaps(
  device: { id: string; imei: string }, from: Date, to: Date, fetchGapSamples: FetchGapSamples, now = new Date()
): Promise<void> {
  const [prev, inWindow] = await Promise.all([
    prisma.vehicleTrip.findFirst({
      where: { deviceId: device.id, deletedAt: null, startedAt: { lte: from } }, orderBy: { startedAt: 'desc' }, select: TRIP_SELECT
    }),
    prisma.vehicleTrip.findMany({
      where: { deviceId: device.id, deletedAt: null, startedAt: { gt: from, lte: to } }, orderBy: { startedAt: 'asc' }, select: TRIP_SELECT
    })
  ]);
  const trips: GapTrip[] = prev ? [prev, ...inWindow] : inWindow;
  let calcs: GapCalc[] = [];
  if (trips.length >= 2) {
    const samples = await fetchGapSamples(
      device.imei,
      new Date(trips[0].endedAt.getTime() - HOURS_LOOKAROUND_MS),
      new Date(trips[trips.length - 1].startedAt.getTime() + HOURS_LOOKAROUND_MS)
    );
    calcs = computeGaps(trips, samples);
  }
  await tenantTransaction(async (tx) => {
    await lockDevice(tx, device.id);
    const existing = await tx.vehicleTripGap.findMany({
      where: { deviceId: device.id, nextTrip: { startedAt: { gt: from, lte: to } } },
      select: { id: true, nextTripId: true, reviewedAt: true }
    });
    const keep = new Set(calcs.map((c) => c.nextTripId));
    const drop = existing.filter((g) => !keep.has(g.nextTripId) && !g.reviewedAt).map((g) => g.id);
    if (drop.length) await tx.vehicleTripGap.deleteMany({ where: { id: { in: drop } } });
    for (const c of calcs) {
      const data = {
        prevTripId: c.prevTripId, startedAt: c.startedAt, endedAt: c.endedAt,
        powerLostMinutes: c.powerLostMinutes, silentMinutes: c.silentMinutes, fuelDropPct: c.fuelDropPct,
        jumpM: c.jumpM, engineHoursGrowth: c.engineHoursGrowth, computedAt: now
      };
      await tx.vehicleTripGap.upsert({
        where: { nextTripId: c.nextTripId },
        create: { deviceId: device.id, nextTripId: c.nextTripId, ...data },
        update: data
      });
    }
  }, { timeout: 60_000 });
}
```

- [ ] **Step 4: Import kutsub vahede ümberarvutust**

`src/server/tripImport.ts`:

1. Impordid: rea `import { ownershipWindows, fetchTripSamples } from './telemetryAccess.ts';` asenda ja lisa:

```ts
import { ownershipWindows, fetchTripSamples, fetchGapSamples } from './telemetryAccess.ts';
import { lockDevice, recomputeGaps, type FetchGapSamples } from './tripGapStore.ts';
```

ja rea `import { prisma, tenantTransaction, authDb, runAsTenant, tsdb, type TxClient } from './db.ts';` asenda (lukk tuleb nüüd `tripGapStore.ts`-ist):

```ts
import { prisma, tenantTransaction, authDb, runAsTenant, tsdb, type TxClient } from './db.ts';
```

(jääb samaks — `TxClient` on endiselt kasutusel `writeFields`-is).

2. `ImportDeps` ja `defaultDeps`:

```ts
export type ImportDeps = {
  now: () => Date;
  fetchSamples: (imei: string, fromExclusive: Date, toInclusive: Date) => Promise<TripSample[]>;
  fetchGapSamples: FetchGapSamples;
  loadPlaces: (year: number) => Promise<Place[]>;
};

export const defaultDeps: ImportDeps = { now: () => new Date(), fetchSamples: fetchTripSamples, fetchGapSamples, loadPlaces };
```

3. Kustuta failist kohalik `lockDevice` (kommentaar `// Üheaegsed impordid (CLI ja ajastaja) ...` ja 2 rida `const lockDevice = ...`).

4. Faili päisekommentaari 3. rea järele lisa rida:

```ts
// Pärast iga akna kirjutamist arvutatakse sama akna sõitude vahed (jälgimata töö märgid, tripGapStore.ts).
```

5. `importDeviceTrips` sees asenda rida `await writeChunk(device.id, from, to, trips, routes, fields, now, new Date(next));`:

```ts
    await writeChunk(device.id, from, to, trips, routes, fields, now, new Date(next));
    await recomputeGaps(device, from, to, deps.fetchGapSamples, now);
```

- [ ] **Step 5: Testid läbi**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/tripImport.test.ts src/server/tripGaps.test.ts src/server/telemetryAccess.test.ts'`
Expected: PASS (kõik varasemad impordi testid ka).

- [ ] **Step 6: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/telemetryAccess.ts src/server/tripGapStore.ts src/server/tripImport.ts src/server/tripImport.test.ts && git commit -m "feat(sõidud): import arvutab ja salvestab sõitude vahed; kontrolli märge püsib

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 5: Sõitude API — `gapBefore`, filter, kontrolli märge, ümberarvutus kustutamisel

**Files:**
- Modify: `src/server/tripsApi.ts`
- Test: `src/server/tripsApi.test.ts`

**Interfaces:**
- Consumes: `recomputeGaps` (Task 4), `fetchGapSamples` (Task 4), `prisma.vehicleTripGap`.
- Produces:
  ```ts
  export type TripGapDto = {
    id: string; startedAt: string; endedAt: string;
    powerLostMinutes: number | null; silentMinutes: number | null; fuelDropPct: number | null; jumpM: number | null; engineHoursGrowth: number | null;
    reviewedAt: string | null; reviewedBy: string | null; reviewNote: string | null;
  };
  // sõidu DTO lisaväli: gapBefore: TripGapDto | null
  // GET /api/fleet/trips?gaps=all|unreviewed
  // PATCH /api/fleet/trips/gaps/:id  { reviewed: boolean, note?: string } → TripGapDto
  ```

- [ ] **Step 1: Failivad testid**

`src/server/tripsApi.test.ts` — lisa faili lõppu:

```ts
describe('sõitude vahed', () => {
  let gapId = '';
  beforeAll(async () => {
    // Varasemad kustutamise/taastamise testid võisid vahesid ümber arvutada (testi IMEI-l pole telemeetriat → „seade vaikis“)
    await run(() => prisma.vehicleTripGap.deleteMany({}));
    gapId = (await run(() => prisma.vehicleTripGap.create({ data: {
      deviceId, prevTripId: tripId, nextTripId: activeTripId, startedAt: d('2026-11-03T07:00:00Z'), endedAt: d('2026-11-04T06:00:00Z'),
      powerLostMinutes: 15, silentMinutes: 20, fuelDropPct: 1, jumpM: 30, engineHoursGrowth: null, computedAt: new Date()
    } }))).id;
  });
  const list = (q = '') => call('GET', `/api/fleet/trips?from=2026-11-01T00:00:00Z&to=2026-11-05T00:00:00Z${q}`);

  it('sõidul on gapBefore; vaheta sõidul null', async () => {
    const r = await list();
    const active = r.json.find((t: any) => t.id === activeTripId);
    const closed = r.json.find((t: any) => t.id === tripId);
    expect(active.gapBefore).toMatchObject({ id: gapId, powerLostMinutes: 15, startedAt: '2026-11-03T07:00:00.000Z', reviewedAt: null });
    expect(closed.gapBefore).toBeNull();
  });

  it('filter gaps=all ja gaps=unreviewed', async () => {
    const all = (await list('&gaps=all')).json;
    expect(all.map((t: any) => t.id)).toContain(activeTripId);
    expect(all.map((t: any) => t.id)).not.toContain(tripId);
    expect(all.every((t: any) => t.gapBefore)).toBe(true);
    expect((await list('&gaps=unreviewed')).json.map((t: any) => t.id)).toContain(activeTripId);
  });

  it('PATCH: selgituseta kontroll → 400', async () => {
    const r = await call('PATCH', `/api/fleet/trips/gaps/${gapId}`, { reviewed: true, note: '  ' });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe('Lisa selgitus, miks hoiatus on kontrollitud');
  });

  it('PATCH: kontrollituks ja tagasi; kontrollitud vahe kaob filtrist unreviewed', async () => {
    const ok = await call('PATCH', `/api/fleet/trips/gaps/${gapId}`, { reviewed: true, note: 'Treileriga remonti' });
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ id: gapId, reviewNote: 'Treileriga remonti', reviewedBy: `tripsapi-${T}` });
    expect(ok.json.reviewedAt).not.toBeNull();
    expect((await list('&gaps=unreviewed')).json.map((t: any) => t.id)).not.toContain(activeTripId);
    expect((await list('&gaps=all')).json.map((t: any) => t.id)).toContain(activeTripId);
    const back = await call('PATCH', `/api/fleet/trips/gaps/${gapId}`, { reviewed: false });
    expect(back.json).toMatchObject({ reviewedAt: null, reviewedBy: null, reviewNote: null });
  });

  it('PATCH: tundmatu vahe → 404; teise ettevõtte vahe → 404', async () => {
    expect((await call('PATCH', '/api/fleet/trips/gaps/puudub', { reviewed: false })).status).toBe(404);
    expect((await call('PATCH', `/api/fleet/trips/gaps/${gapId}`, { reviewed: false }, T2)).status).toBe(404);
  });
});
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/tripsApi.test.ts'`
Expected: FAIL (`gapBefore` puudub; PATCH tagastab `handled: false`).

- [ ] **Step 2: Teostus**

`src/server/tripsApi.ts`:

1. Impordid — lisa:

```ts
import { prisma, tsdb } from './db.ts';
import { fetchTripSamples, fetchGapSamples } from './telemetryAccess.ts';
import { recomputeGaps } from './tripGapStore.ts';
```

(asendavad olemasolevad read `import { prisma } from './db.ts';` ja `import { fetchTripSamples } from './telemetryAccess.ts';`). Päisekommentaari 1. rea lõppu lisa `, sõitude vahed (jälgimata töö märgid) ja nende kontroll`.

2. Konstantide juurde:

```ts
const GAP_NOTE_REQUIRED = 'Lisa selgitus, miks hoiatus on kontrollitud';
```

3. Pärast tüüpi `TripFieldDto`:

```ts
export type TripGapDto = {
  id: string;
  startedAt: string;
  endedAt: string;
  powerLostMinutes: number | null;
  silentMinutes: number | null;
  fuelDropPct: number | null;
  jumpM: number | null;
  engineHoursGrowth: number | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
};

type GapRow = Awaited<ReturnType<typeof prisma.vehicleTripGap.findMany>>[number];

const gapDto = (g: GapRow): TripGapDto => ({
  id: g.id, startedAt: g.startedAt.toISOString(), endedAt: g.endedAt.toISOString(),
  powerLostMinutes: g.powerLostMinutes, silentMinutes: g.silentMinutes, fuelDropPct: g.fuelDropPct,
  jumpM: g.jumpM, engineHoursGrowth: g.engineHoursGrowth,
  reviewedAt: g.reviewedAt ? g.reviewedAt.toISOString() : null, reviewedBy: g.reviewedBy, reviewNote: g.reviewNote
});

// Vahe, mis lõpeb sõidu algusega (vahe võti on järgmine sõit)
async function loadGaps(trips: TripRow[]): Promise<(tripId: string) => TripGapDto | null> {
  if (trips.length === 0) return () => null;
  const rows = await prisma.vehicleTripGap.findMany({ where: { nextTripId: { in: trips.map((t) => t.id) } } });
  const byTrip = new Map(rows.map((g) => [g.nextTripId, gapDto(g)]));
  return (tripId) => byTrip.get(tripId) ?? null;
}

/** Sõidud → DTO-d koos masina, põldude ja vahega. */
async function toDtos(trips: TripRow[]) {
  const [target, fieldsOf, gapOf] = await Promise.all([resolveTargets(trips), loadTripFields(trips), loadGaps(trips)]);
  return trips.map((t) => toDto(t, target(t), fieldsOf(t.id), gapOf(t.id)));
}

// Sõidu kustutamine/taastamine muudab naabrite vahet: arvuta selle sõidu ja järgmise kustutamata sõidu vahed uuesti
async function recomputeGapsAround(trip: TripRow): Promise<void> {
  if (!tsdb) return; // telemeetriata oleks „seade vaikis“ igal vahel vale
  const device = await prisma.telemetryDevice.findUnique({ where: { id: trip.deviceId }, select: { id: true, imei: true } });
  if (!device?.imei) return;
  const next = await prisma.vehicleTrip.findFirst({
    where: { deviceId: trip.deviceId, deletedAt: null, startedAt: { gt: trip.startedAt } }, orderBy: { startedAt: 'asc' }, select: { startedAt: true }
  });
  await recomputeGaps({ id: device.id, imei: device.imei }, new Date(trip.startedAt.getTime() - 1), next?.startedAt ?? trip.startedAt, fetchGapSamples);
}
```

4. `toDto` signatuur ja väli:

```ts
function toDto(t: TripRow, target: ReturnType<Awaited<ReturnType<typeof resolveTargets>>>, fields: TripFieldDto[], gapBefore: TripGapDto | null) {
```

ja tagastatavas objektis rea `fields` asemel:

```ts
    fields,
    gapBefore
```

5. GET loendis asenda read

```ts
    const [target, fieldsOf] = await Promise.all([resolveTargets(rows), loadTripFields(rows)]);
    let list = rows.map((t) => toDto(t, target(t), fieldsOf(t.id)));
```

järgmisega:

```ts
    let list = await toDtos(rows);
```

ja rea `if (url.searchParams.get('unlinkedOnly') === '1') ...` järele:

```ts
    // Sõitude vahed: ainult sõidud, mille ees on hoiatus (kõik / kontrollimata)
    const gaps = url.searchParams.get('gaps');
    if (gaps === 'all') list = list.filter((t) => t.gapBefore);
    if (gaps === 'unreviewed') list = list.filter((t) => t.gapBefore && !t.gapBefore.reviewedAt);
```

6. Kustutamise/taastamise ja märkuse harudes asenda iga paar

```ts
      const [target, fieldsOf] = await Promise.all([resolveTargets([saved]), loadTripFields([saved])]);
      json(res, toDto(saved, target(saved), fieldsOf(saved.id)));
```

järgmisega (märkuse harus ilma `recomputeGapsAround` reata):

```ts
      await recomputeGapsAround(saved);
      json(res, (await toDtos([saved]))[0]);
```

Märkuse (`PATCH`/`PUT` sõit) harus:

```ts
    json(res, (await toDtos([saved]))[0]);
```

7. Vahe kontrolli märge — lisa enne kommentaari `// Sõidu kustutamine (müra) ja taastamine`:

```ts
  // Vahe kontrolli märge: kontrollituks (kohustuslik selgitus) või tagasi kontrollimata; õigus sama mis märkusel
  const gapMatch = /^\/api\/fleet\/trips\/gaps\/([^/]+)$/.exec(pathname);
  if (gapMatch && method === 'PATCH') {
    const id = gapMatch[1];
    const existing = await prisma.vehicleTripGap.findUnique({ where: { id }, select: { id: true } });
    if (!existing) { json(res, { error: 'Hoiatust ei leitud' }, 404); return true; }
    const body = await parseBody(req);
    const reviewed = body?.reviewed === true;
    const note = String(body?.note ?? '').trim().slice(0, MAX_NOTES);
    if (reviewed && !note) { json(res, { error: GAP_NOTE_REQUIRED }, 400); return true; }
    const saved = await prisma.vehicleTripGap.update({
      where: { id },
      data: reviewed
        ? { reviewedAt: new Date(), reviewedBy: sessionUserOf(req)?.username ?? null, reviewNote: note }
        : { reviewedAt: null, reviewedBy: null, reviewNote: null }
    });
    json(res, gapDto(saved));
    return true;
  }
```

- [ ] **Step 3: Testid läbi**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/tripsApi.test.ts'`
Expected: PASS (ka varasemad kustutamise/taastamise testid).

- [ ] **Step 4: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/tripsApi.ts src/server/tripsApi.test.ts && git commit -m "feat(sõidud): API — sõidu vahe, hoiatuste filter ja kontrolli märge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 6: Sõitude register — hoiatusrida, kontrolli dialoog, filter

**Files:**
- Modify: `src/types/fleet.ts:201-253`
- Modify: `src/services/api.ts:564-610`
- Create: `src/components/tripGapText.ts`
- Test: `src/components/tripGapText.test.ts`
- Create: `src/components/TripGapReviewDialog.tsx`
- Modify: `src/components/TripRegister.tsx`
- Modify: `src/index.css` (pärast reeglit `.register-table tr.trip-row-last-opened > td:first-child`)

**Interfaces:**
- Consumes: API Task 5 (`gapBefore`, `gaps`, `PATCH /api/fleet/trips/gaps/:id`); `GAP_LIMITS`, `ENGINE_HOURS_SHOWN_FROM` (Task 3).
- Produces:
  ```ts
  // types/fleet.ts
  export interface TripGap { id: string; startedAt: string; endedAt: string; powerLostMinutes: number | null; silentMinutes: number | null; fuelDropPct: number | null; jumpM: number | null; engineHoursGrowth: number | null; reviewedAt: string | null; reviewedBy: string | null; reviewNote: string | null }
  // Trip.gapBefore: TripGap | null; TripFilter.gaps?: 'all' | 'unreviewed'
  // api.ts
  reviewTripGap(id: string, reviewed: boolean, note?: string): Promise<TripGap>
  // tripGapText.ts
  export function gapParts(g: TripGap): string[];
  export function minutesText(min: number): string;
  ```

- [ ] **Step 1: Failiv test**

`src/components/tripGapText.test.ts`:

```ts
// src/components/tripGapText.test.ts — sõitude vahe hoiatuse tekst.
import { describe, it, expect } from 'vitest';
import { gapParts, minutesText } from './tripGapText';
import type { TripGap } from '../types/fleet';

const gap = (o: Partial<TripGap> = {}): TripGap => ({
  id: 'g', startedAt: '2026-11-09T06:00:00Z', endedAt: '2026-11-09T20:05:00Z',
  powerLostMinutes: null, silentMinutes: 0, fuelDropPct: null, jumpM: 0, engineHoursGrowth: null,
  reviewedAt: null, reviewedBy: null, reviewNote: null, ...o
});

describe('minutesText', () => {
  it('minutid ja tunnid', () => {
    expect(minutesText(4.6)).toBe('5 min');
    expect(minutesText(130)).toBe('2 h 10 min');
    expect(minutesText(845)).toBe('14 h 05 min');
  });
});

describe('gapParts', () => {
  it('ainult piiri ületanud märgid', () => {
    expect(gapParts(gap({ powerLostMinutes: 4, silentMinutes: 179, fuelDropPct: 4.9, jumpM: 499 }))).toEqual([]);
  });
  it('kõik märgid Eesti formaadis', () => {
    expect(gapParts(gap({ powerLostMinutes: 130, silentMinutes: 225, fuelDropPct: 12, jumpM: 1412, engineHoursGrowth: 3 }))).toEqual([
      'toide kadus 2 h 10 min', 'seade vaikis 3 h 45 min', 'kütus −12%', 'asukoht +1,4 km', 'mootoritunnid +3 h'
    ]);
  });
  it('asukoht alla 1 km meetrites; mootoritunnid +1 h näidatakse', () => {
    expect(gapParts(gap({ jumpM: 800, engineHoursGrowth: 1 }))).toEqual(['asukoht +800 m', 'mootoritunnid +1 h']);
  });
  it('mootoritunnid alla 1 h ei näidata; komakohaga kütus', () => {
    expect(gapParts(gap({ fuelDropPct: 6.5, engineHoursGrowth: 0.5 }))).toEqual(['kütus −6,5%']);
  });
});
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/components/tripGapText.test.ts'`
Expected: FAIL (moodulit pole).

- [ ] **Step 2: Tüübid ja API klient**

`src/types/fleet.ts` — `interface Trip` sees rea `fields: TripField[];` järele:

```ts
  gapBefore: TripGap | null; // jälgimata töö märgid eelmise sõidu ja selle sõidu vahel
```

`interface TripField` järele (enne `TripImportStatus`):

```ts
// Sõitude vahe: jälgimata töö märgid (null = ei saanud arvutada); kontrolli märge
export interface TripGap {
  id: string;
  startedAt: string;
  endedAt: string;
  powerLostMinutes: number | null;
  silentMinutes: number | null;
  fuelDropPct: number | null;
  jumpM: number | null;
  engineHoursGrowth: number | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}
```

`TripFilter` rida:

```ts
export interface TripFilter { from: string; to: string; vehicleId?: string; implementId?: string; status?: 'ACTIVE' | 'CLOSED'; unknownPlace?: boolean; unlinkedOnly?: boolean; deleted?: boolean; gaps?: 'all' | 'unreviewed' }
```

`src/services/api.ts` — `getTrips` sees rea `if (f.deleted) q.set('deleted', '1');` järele:

```ts
    if (f.gaps) q.set('gaps', f.gaps);
```

`restoreTrip` järele:

```ts
  async reviewTripGap(id: string, reviewed: boolean, note?: string): Promise<TripGap> {
    const res = await apiFetch(`/api/fleet/trips/gaps/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed, note })
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Hoiatuse kontrolli salvestamine ebaõnnestus'));
    return res.json();
  },
```

ja lisa `TripGap` faili `../types/fleet` tüübiimporti `api.ts` alguses (sama rida, kus on `Trip`, `TripFilter`).

- [ ] **Step 3: Tekst**

`src/components/tripGapText.ts`:

```ts
// src/components/tripGapText.ts — sõitude vahe hoiatuse tekst: piiri ületanud märgid (mootoritunnid alates +1 h).
import type { TripGap } from '../types/fleet';
import { ENGINE_HOURS_SHOWN_FROM, GAP_LIMITS } from '../services/tripGapLimits';

const num = (n: number, digits: number) => n.toLocaleString('et-EE', { maximumFractionDigits: digits });

export function minutesText(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h} h ${String(r).padStart(2, '0')} min` : `${r} min`;
}

export function gapParts(g: TripGap): string[] {
  const parts: string[] = [];
  if ((g.powerLostMinutes ?? 0) >= GAP_LIMITS.powerLostMinutes) parts.push(`toide kadus ${minutesText(g.powerLostMinutes!)}`);
  if ((g.silentMinutes ?? 0) >= GAP_LIMITS.silentMinutes) parts.push(`seade vaikis ${minutesText(g.silentMinutes!)}`);
  if ((g.fuelDropPct ?? 0) >= GAP_LIMITS.fuelDropPct) parts.push(`kütus −${num(g.fuelDropPct!, 1)}%`);
  if ((g.jumpM ?? 0) >= GAP_LIMITS.jumpM) {
    parts.push(g.jumpM! >= 1000 ? `asukoht +${num(g.jumpM! / 1000, 1)} km` : `asukoht +${Math.round(g.jumpM!)} m`);
  }
  if ((g.engineHoursGrowth ?? 0) >= ENGINE_HOURS_SHOWN_FROM) parts.push(`mootoritunnid +${num(g.engineHoursGrowth!, 2)} h`);
  return parts;
}
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/components/tripGapText.test.ts'`
Expected: PASS. (Kui `'14 h 05 min'` vms ebaõnnestub tühikute tõttu, kontrolli, et `toLocaleString` ei lisa tuhandeeraldajat — siin väärtused < 1000.)

- [ ] **Step 4: Kontrolli dialoog**

`src/components/TripGapReviewDialog.tsx`:

```tsx
// src/components/TripGapReviewDialog.tsx — sõitude vahe hoiatuse kontrolli märge koos kohustusliku selgitusega.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import type { TripGap } from '../types/fleet';
import { api } from '../services/api';
import { formatDateTime, formatDuration } from './fleetDateTime';
import { gapParts } from './tripGapText';

interface Props {
  gap: TripGap;
  onClose: () => void;
  onSaved: (gap: TripGap) => void;
}

export const TripGapReviewDialog: React.FC<Props> = ({ gap, onClose, onSaved }) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await api.reviewTripGap(gap.id, true, note.trim()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content fleet-edit-modal animate-scale-up">
        <div className="modal-header">
          <div className="modal-title-group">
            <AlertTriangle size={20} className="trip-gap-icon" />
            <h3>Märgi hoiatus kontrollituks</h3>
          </div>
          <button className="icon-btn-ghost" type="button" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <p style={{ marginTop: 0 }}>
            Sõitude vahel {formatDateTime(gap.startedAt)} – {formatDateTime(gap.endedAt)} ({formatDuration(gap.startedAt, gap.endedAt)}):{' '}
            {gapParts(gap).join(' · ')}
          </p>
          <label className="form-label" htmlFor="trip-gap-note">Selgitus</label>
          <textarea
            id="trip-gap-note" className="form-input" rows={3} value={note} autoFocus
            placeholder="nt tankisime kanistrist; traktor veeti treileriga remonti"
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <div className="auth-error-banner">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Loobu</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !note.trim()}>Märgi kontrollituks</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
```

- [ ] **Step 5: Register**

`src/components/TripRegister.tsx`:

1. Impordid:

```tsx
import type { Implement, Trip, TripGap, TripImportStatus, Vehicle } from '../types/fleet';
import { TripGapReviewDialog } from './TripGapReviewDialog';
import { gapParts } from './tripGapText';
```

2. Olekud — rea `const [showDeleted, setShowDeleted] = useState(false);` järele:

```tsx
  const [gapsFilter, setGapsFilter] = useState<'' | 'all' | 'unreviewed'>('');
  const [reviewing, setReviewing] = useState<TripGap | null>(null);
```

3. `load` sees `api.getTrips({...})` objekti lõppu lisa `, gaps: gapsFilter || undefined` ja `useCallback` sõltuvustesse `gapsFilter`.

4. `hasFilters` rida:

```tsx
  const hasFilters = periodActive || !!vehicleId || !!implementId || !!status || unknownPlace || unlinkedOnly || showDeleted || !!gapsFilter;
  const unreviewedGaps = trips.filter((t) => t.gapBefore && !t.gapBefore.reviewedAt).length;
  // Vahe kontrolli märke muutus: uuenda sõidu gapBefore nimekirjas
  const gapSaved = (g: TripGap) => {
    setTrips((list) => list.map((t) => (t.gapBefore?.id === g.id ? { ...t, gapBefore: g } : t)));
    setReviewing(null);
  };
  const reopenGap = async (g: TripGap) => {
    try {
      gapSaved(await api.reviewTripGap(g.id, false));
    } catch (e) {
      setError((e as Error).message);
    }
  };
```

5. Filtririba — olekufiltri `<div style={{ minWidth: '150px' }}>…</div>` järele:

```tsx
        <div style={{ minWidth: '200px' }}>
          <FilterClear active={!!gapsFilter} onClear={() => setGapsFilter('')}>
            <FilterSelect style={{ fontSize: '13px', height: '34px' }} value={gapsFilter} onChange={(v) => setGapsFilter(v as '' | 'all' | 'unreviewed')}
              options={[{ value: '', label: 'Kõik sõidud' }, { value: 'all', label: 'Hoiatustega' }, { value: 'unreviewed', label: 'Kontrollimata hoiatused' }]} />
          </FilterClear>
        </div>
```

ja värskendusnupu ette (sama `div` sees, enne `<button className="btn btn-secondary btn-sm" … title="Värskenda"`):

```tsx
        {unreviewedGaps > 0 && (
          <span className="trip-gap-count" title="Kontrollimata hoiatusi valitud perioodis">
            <AlertTriangle size={14} /> {unreviewedGaps} kontrollimata
          </span>
        )}
```

6. Tabeli keha — `trips.map` tagastab nüüd fragmendi: sõidu rida ja selle all (aja järgi varasem) vahe rida. Asenda `return ( <tr key={t.id} … </tr> );` järgmisega (sõidu `<tr>` sisu jääb samaks, ainult `key` liigub fragmendile):

```tsx
                const g = t.gapBefore;
                return (
                  <React.Fragment key={t.id}>
                    <tr data-trip-id={t.id} className={`clickable-row${t.id === lastOpenedId ? ' trip-row-last-opened' : ''}`} style={t.deletedAt ? { opacity: 0.55 } : undefined} onClick={() => openTrip(t)}>
                      {/* … olemasolevad 13 lahtrit muutmata … */}
                    </tr>
                    {g && (
                      <tr className={`trip-gap-row${g.reviewedAt ? ' reviewed' : ''}`}>
                        <td colSpan={13}>
                          <span className="trip-gap-text">
                            <AlertTriangle size={14} className="trip-gap-icon" />
                            Sõitude vahel {formatDuration(g.startedAt, g.endedAt)}: {gapParts(g).join(' · ') || 'märke pole'}
                          </span>
                          {g.reviewedAt ? (
                            <>
                              <span className="trip-gap-review">Kontrollitud {formatDateTime(g.reviewedAt)}{g.reviewedBy ? `, ${g.reviewedBy}` : ''}: {g.reviewNote}</span>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => reopenGap(g)}>Ava uuesti</button>
                            </>
                          ) : (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReviewing(g)}>Märgi kontrollituks</button>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
```

7. Dialoog — `{open && (<TripDialog … />)}` järele:

```tsx
      {reviewing && <TripGapReviewDialog gap={reviewing} onClose={() => setReviewing(null)} onSaved={gapSaved} />}
```

- [ ] **Step 6: Stiilid**

`src/index.css` — pärast reeglit `.register-table tr.trip-row-last-opened > td:first-child { … }`:

```css
/* Sõitude vahe hoiatus: rida kahe sõidu vahel; kontrollitud = hall */
.register-table tr.trip-gap-row > td {
  background: color-mix(in srgb, var(--amber-500, #f59e0b) 10%, transparent);
  font-size: 13px;
  padding-top: 6px;
  padding-bottom: 6px;
}

.register-table tr.trip-gap-row > td > * + * {
  margin-left: 12px;
}

.register-table tr.trip-gap-row.reviewed > td {
  background: transparent;
  color: var(--text-muted);
}

.trip-gap-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.trip-gap-icon {
  color: var(--amber-500, #f59e0b);
}

.trip-gap-row.reviewed .trip-gap-icon {
  color: var(--text-muted);
}

.trip-gap-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--amber-600, #d97706);
}
```

- [ ] **Step 7: Kontrolli**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/components/tripGapText.test.ts && npx vite build >/dev/null && echo OK'`
Expected: PASS ja `OK`.

- [ ] **Step 8: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/types/fleet.ts src/services/api.ts src/components/tripGapText.ts src/components/tripGapText.test.ts src/components/TripGapReviewDialog.tsx src/components/TripRegister.tsx src/index.css && git commit -m "feat(sõidud): registris sõitude vahe hoiatusrida, kontrolli märge ja filter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 7: MCP tööriist `list_trip_gaps`

**Files:**
- Modify: `src/server/mcp/tools/fleet.ts`
- Modify: `src/server/mcp/instructions.ts` (`DEFAULT_MCP_INSTRUCTIONS`)
- Test: `src/server/mcp/mcp.test.ts`

**Interfaces:**
- Consumes: `prisma.vehicleTripGap`, `loadAssignmentResolver` (`src/server/tripAssignments.ts`), `resolveVehicleId`, `parseDateInput`, `dayAfter`, `fmtDateTime`, `round2`, `ToolInputError`, `hasTelemetry`.
- Produces: tööriist `list_trip_gaps` (sisend `{ vehicle?: string; from: string; to: string; unreviewedOnly?: boolean }`, väljund `{ from, to, unreviewedOnly, total, shown, note, gaps: [...] }`), nähtav ainult `TELEMETRY` mooduliga.

- [ ] **Step 1: Failiv test**

`src/server/mcp/mcp.test.ts` — lisa faili lõppu (A-l on `TELEMETRY`, B-l mitte; A-l on masin „Valtra T1“, `ids.vehicleId`):

```ts
describe('sõitude vahed (MCP)', () => {
  let deviceId = '';
  beforeAll(async () => {
    await runAsTenant(A.tenantId, async () => {
      deviceId = (await prisma.telemetryDevice.create({ data: { imei: `39${String(process.pid).padStart(13, '0')}`.slice(0, 15), model: 'FMC650' } })).id;
      await prisma.deviceAssignment.create({ data: { deviceId, vehicleId: A.ids.vehicleId, startedAt: new Date('2026-10-01T00:00:00Z') } });
      const row = (s: string, e: string) => ({
        deviceId, startedAt: new Date(s), endedAt: new Date(e), status: 'CLOSED' as const,
        startLat: 58, startLng: 26, endLat: 58, endLng: 26, distanceKm: 1, movingMinutes: 10, idleMinutes: 0, pauseCount: 0, pauseMinutes: 0,
        minLat: 58, minLng: 26, maxLat: 58, maxLng: 26, pointCount: 10, computedAt: new Date()
      });
      const t1 = await prisma.vehicleTrip.create({ data: row('2026-10-23T10:00:00Z', '2026-10-23T13:16:00Z') });
      const t2 = await prisma.vehicleTrip.create({ data: row('2026-10-25T11:50:00Z', '2026-10-25T14:00:00Z') });
      const t3 = await prisma.vehicleTrip.create({ data: row('2026-10-26T08:00:00Z', '2026-10-26T09:00:00Z') });
      await prisma.vehicleTripGap.create({ data: {
        deviceId, prevTripId: t1.id, nextTripId: t2.id, startedAt: t1.endedAt, endedAt: t2.startedAt,
        powerLostMinutes: null, silentMinutes: 30, fuelDropPct: null, jumpM: 800, engineHoursGrowth: 1, computedAt: new Date()
      } });
      await prisma.vehicleTripGap.create({ data: {
        deviceId, prevTripId: t2.id, nextTripId: t3.id, startedAt: t2.endedAt, endedAt: t3.startedAt,
        powerLostMinutes: 40, silentMinutes: 10, fuelDropPct: 2, jumpM: 0, engineHoursGrowth: null,
        reviewedAt: new Date('2026-10-27T08:00:00Z'), reviewedBy: 'mari', reviewNote: 'aku vahetus', computedAt: new Date()
      } });
    });
  });
  afterAll(async () => {
    await runAsTenant(A.tenantId, async () => {
      await prisma.vehicleTrip.deleteMany({ where: { deviceId } });
      await prisma.deviceAssignment.deleteMany({ where: { deviceId } });
      await prisma.telemetryDevice.deleteMany({ where: { id: deviceId } });
    });
  });

  it('ainult TELEMETRY mooduliga', async () => {
    const client = await connect(B.plainKey);
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.map((t) => t.name)).not.toContain('list_trip_gaps');
  });

  it('vaikimisi ainult kontrollimata; masin ja märgid', async () => {
    const r = (await call(A.plainKey, 'list_trip_gaps', { from: '01.10.2026', to: '31.10.2026' })).data;
    expect(r.total).toBe(1);
    expect(r.gaps[0]).toMatchObject({
      vehicle: 'Valtra T1', from: '23.10.2026 16:16', to: '25.10.2026 13:50',
      signs: { jumpM: 800, engineHoursGrowth: 1, silentMinutes: 30, powerLostMinutes: null, fuelDropPct: null }, reviewed: false
    });
  });

  it('unreviewedOnly=false annab ka kontrollitud koos selgitusega; masina filter', async () => {
    const r = (await call(A.plainKey, 'list_trip_gaps', { vehicle: 'Valtra', from: '01.10.2026', to: '31.10.2026', unreviewedOnly: false })).data;
    expect(r.total).toBe(2);
    expect(r.gaps[1]).toMatchObject({ reviewed: true, reviewNote: 'aku vahetus', reviewedBy: 'mari' });
  });
});
```

Kontrolli faili alguses, et `prisma` ja `runAsTenant` on imporditud (`import { prisma, authDb, runAsTenant } from '../db';` — lisa puuduvad nimed olemasolevale `../db` impordile) ja et `A.ids.vehicleId` on testTenant-i tagastuses (on: `ids.vehicleId`).

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/mcp.test.ts'`
Expected: FAIL (tööriista `list_trip_gaps` pole).

- [ ] **Step 2: Tööriist**

`src/server/mcp/tools/fleet.ts`:

1. Impordid — lisa:

```ts
import { loadAssignmentResolver } from '../../tripAssignments.ts';
```

2. Konstandid — `const MAX_DAYS = 31;` järele:

```ts
const GAP_MAX_DAYS = 92;
const GAP_LIMIT = 200;
```

3. `fleetTools` massiivi lõppu (pärast `get_vehicle_activity` tööriista):

```ts
  defineTool({
    name: 'list_trip_gaps',
    title: 'Sõitude vahed (jälgimata töö märgid)',
    description: `Kahe järjestikuse sõidu vahelised hoiatused (kuni ${GAP_MAX_DAYS} päeva): toide kadus (seade lahti ühendatud), seade vaikis, paagitase langes, asukoht hüppas, masina CAN mootoritunnid kasvasid. Need on kaudsed märgid, et masin võis töötada ilma telemeetriata — mitte tõend. Vaikimisi ainult kontrollimata; kontrollitul on kasutaja selgitus.`,
    input: {
      vehicle: z.string().optional().describe('Masina nimi või reg nr (tühi = kõik)'),
      from: z.string().describe('Alates (pp.kk.aaaa)'),
      to: z.string().describe('Kuni, kaasa arvatud (pp.kk.aaaa)'),
      unreviewedOnly: z.boolean().optional().describe('Ainult kontrollimata (vaikimisi true)')
    },
    when: hasTelemetry,
    run: async (a) => {
      const from = parseDateInput(a.from, 'from')!;
      const to = parseDateInput(a.to, 'to')!;
      if (from > to) throw new ToolInputError('Algus on hilisem kui lõpp');
      const end = dayAfter(to);
      if ((end.getTime() - from.getTime()) / 86_400_000 > GAP_MAX_DAYS) throw new ToolInputError(`Vahemik võib olla kuni ${GAP_MAX_DAYS} päeva`);
      const unreviewedOnly = a.unreviewedOnly ?? true;
      const vehicleId = a.vehicle ? await resolveVehicleId(a.vehicle) : null;
      const rows = await prisma.vehicleTripGap.findMany({
        where: { endedAt: { gte: from, lt: end }, ...(unreviewedOnly ? { reviewedAt: null } : {}), nextTrip: { deletedAt: null } },
        orderBy: { startedAt: 'asc' }
      });
      const resolve = await loadAssignmentResolver(rows.map((g) => g.deviceId));
      const all = rows
        .map((g) => ({ g, target: resolve(g.deviceId, g.endedAt) }))
        .filter((x) => !vehicleId || x.target.vehicleId === vehicleId);
      return {
        from: fmtDate(from), to: fmtDate(to), unreviewedOnly, total: all.length, shown: Math.min(all.length, GAP_LIMIT),
        note: 'Kaudsed märgid, mitte tõend. silentMinutes = pikim paus, mil seade midagi ei saatnud; engineHoursGrowth on täistundides (+1 h võib olla ümardus).',
        gaps: all.slice(0, GAP_LIMIT).map(({ g, target }) => ({
          vehicle: target.vehicleName, from: fmtDateTime(g.startedAt), to: fmtDateTime(g.endedAt),
          hours: round2((g.endedAt.getTime() - g.startedAt.getTime()) / 3_600_000),
          signs: {
            powerLostMinutes: g.powerLostMinutes, silentMinutes: g.silentMinutes, fuelDropPct: g.fuelDropPct,
            jumpM: g.jumpM, engineHoursGrowth: g.engineHoursGrowth
          },
          reviewed: !!g.reviewedAt, reviewedAt: fmtDateTime(g.reviewedAt), reviewedBy: g.reviewedBy, reviewNote: g.reviewNote
        }))
      };
    }
  })
```

Kontrolli, et `defineTool` toetab `when` (vt `src/server/mcp/tools/weather.ts:29`) ja `fmtDateTime` annab Tallinna aja kujul `pp.kk.aaaa HH:MM` (test ootab `23.10.2026 16:16` UTC 13:16 jaoks).

4. `src/server/mcp/instructions.ts` — `DEFAULT_MCP_INSTRUCTIONS`-is rea `- Ilm: weather_summary …` järele lisa:

```
- Jälgimata töö: list_trip_gaps annab sõitude vahed, kus on märke, et masin võis töötada ilma telemeetriata (toide kadus, seade vaikis, paak langes, asukoht hüppas, CAN mootoritunnid kasvasid). Need on vihjed, mitte tõend — ütle seda kasutajale.
```

- [ ] **Step 3: Testid läbi**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/mcp/mcp.test.ts'`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/mcp/tools/fleet.ts src/server/mcp/instructions.ts src/server/mcp/mcp.test.ts && git commit -m "feat(mcp): list_trip_gaps — sõitude vahed ja jälgimata töö märgid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 8: Dokumentatsioon, release, vanade andmete ümberarvutus ja live-kontroll

**Files:**
- Modify: `docs/andmemudel.md` (jaotis „Masinapark, telemeetria ja objektid“ ja ülevaate ER-diagramm)

- [ ] **Step 1: Andmemudeli dokument**

`docs/andmemudel.md` — tabelis rea `| \`VehicleTripField\` | …` järele:

```markdown
| `VehicleTripGap` | `vehicle_trip_gaps` | jah | Kahe järjestikuse kustutamata sõidu vahe, kus on jälgimata töö märke (toide < 6 V, seade vaikis, paagitase langes, asukoht hüppas, CAN mootoritunnid kasvasid); võti järgmine sõit (`nextTripId`); tuletatud impordis; kontrolli märge (`reviewedAt`, `reviewedBy`, `reviewNote`) jääb ümberarvutusel alles, kontrollitud vahet ei kustutata |
```

Mõlemas mermaid-diagrammis (jaotise oma ja „Kõik seosed“) rea `VehicleTrip ||--o{ VehicleTripField : "trip"` järele:

```
  VehicleTrip ||--o| VehicleTripGap : "nextTrip"
  VehicleTrip |o--o{ VehicleTripGap : "prevTrip"
  TelemetryDevice ||--o{ VehicleTripGap : "device"
```

- [ ] **Step 2: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add docs/andmemudel.md docs/superpowers/specs/2026-11-11-soitude-vahed-design.md docs/superpowers/plans/2026-11-11-soitude-vahed.md && git commit -m "docs(sõidud): sõitude vahed andmemudelis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

Expected: tsc, kõik testid ja build läbi; `systemctl restart teris` ilma veata.

- [ ] **Step 3: Vanad sõidud ja vahed uuesti (kütuse nullnäit, vahed kogu ajaloole)**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && psql "$PLATFORM_DATABASE_URL" -c "UPDATE trip_import_state SET \"finalizedUntil\" = NULL;" && npm run tenant -- trips:import'
```

Expected: `UPDATE N` (seadmete arv) ja import lõpeb veata.

- [ ] **Step 4: Live-kontroll**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && psql "$PLATFORM_DATABASE_URL" -c "SELECT d.model, to_char((g.\"startedAt\" at time zone '"'"'UTC'"'"') at time zone '"'"'Europe/Tallinn'"'"', '"'"'DD.MM HH24:MI'"'"') alates, to_char((g.\"endedAt\" at time zone '"'"'UTC'"'"') at time zone '"'"'Europe/Tallinn'"'"', '"'"'DD.MM HH24:MI'"'"') kuni, g.\"powerLostMinutes\", g.\"silentMinutes\", g.\"fuelDropPct\", g.\"jumpM\", g.\"engineHoursGrowth\" FROM vehicle_trip_gaps g JOIN telemetry_devices d ON d.id = g.\"deviceId\" ORDER BY g.\"startedAt\";" -c "SELECT count(*) FILTER (WHERE \"fuelLevelEndPct\" = 0) end0, count(*) FILTER (WHERE \"fuelLevelStartPct\" = 0) start0 FROM vehicle_trips;"'
```

Expected:
- vahede seas on Suure Claasi (FMC150) toitekatkestus 03.11 ümber (pinge 1,8 V kell 14:58 Tallinna aja järgi) **kui** see jäi kahe sõidu vahele, ja kombaini (FMC650) vahe 23.10 16:16 → 25.10 13:50 (asukoht ~800 m, mootoritunnid +1);
- `end0 = 0`, `start0 = 0`;
- valehäirete hulk mõistlik (mitte iga öö „seade vaikis“). Kui mõni seade annab igal ööl `silentMinutes ≥ 180`, **peatu ja teata kasutajale** (seadme unerežiimi intervall on piirist pikem — piiri või reegli muutmine on kasutaja otsus).

- [ ] **Step 5: AI juhis platvormil**

Kui admin.teris.ee-s on salvestatud oma juhis (mitte vaikejuhis), ei jõua `DEFAULT_MCP_INSTRUCTIONS` muudatus AI-ni:

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && psql "$PLATFORM_DATABASE_URL" -tAc "SELECT count(*) FROM platform_settings WHERE key = '"'"'mcp_instructions'"'"';"'
```

Kui tulemus on `1`, **teata kasutajale**, et ta lisaks admin.teris.ee juhisesse rea `list_trip_gaps` kohta (tekst Task 7 Step 2 punktis 4); ise platvormi seadet ei muuda.

- [ ] **Step 6: UI ja MCP kontroll**

Ava rakenduses Tehnika → Sõidud, filter „Hoiatustega“: hoiatusread kuvatakse sõidu all, „Märgi kontrollituks“ avab dialoogi, salvestamine muudab rea halliks, „Ava uuesti“ taastab. MCP: `list_trip_gaps` perioodiga 01.10.2026–11.11.2026 tagastab samad vahed.
