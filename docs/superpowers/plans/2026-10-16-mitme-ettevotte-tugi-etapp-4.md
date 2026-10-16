# Mitme ettevõtte tugi, etapp 4: telemeetriaseadmete omand — implementeerimisplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ettevõte näeb TimescaleDB telemeetriat ainult nende IMEI/MAC-ide ja ajavahemike kohta, mil seade oli tema registris; seadme registreerimisel kontrollitakse IMEI Luhni kontrollnumbrit ja MAC-i formaati; hõivatud seadme kohta ei avaldata omanikku; teenusepakkuja näeb kõiki seadmeid ja saab vaidluse korral seadme vabastada.

**Architecture:** Uus ettevõttepõhine tabel `DeviceOwnership` (RLS, nagu teised ettevõtte tabelid; ilma välisvõtmeta seadmele, et ajalugu säiliks) hoiab omandiperioode (`kind` IMEI/MAC, `identifier`, `validFrom`, `validTo`). Praegune globaalne unikaalsus `TelemetryDevice.imei/macAddress` tagab, et seade kuulub korraga ühele ettevõttele. Seadme loomine/muutmine/kustutamine avab ja sulgeb omandiperioode samas tehingus. Kõik TimescaleDB päringud käivad uue mooduli `src/server/telemetryAccess.ts` kaudu, mis piirab need jooksva ettevõtte omandiperioodidega. Teenusepakkuja keskkonnas on vaade „Seadmed“ ja toiming „Vabasta seade“.

**Tech Stack:** Node 22, TypeScript 6, Prisma 6.19, PostgreSQL 17 (RLS) + TimescaleDB (`tsdb`), React 19, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-15-mitme-ettevotte-tugi-design.md` — otsuste tabel („Seadmed“), 4.1, 4.2, 5.2 vaade 5.

## Global Constraints

- Arendus ja toodang kasutavad **sama andmebaasi**; käsud serveris: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`. Kohalikus Macis `npm`/`npx` ei tööta. Git kohalikult.
- **`npm run build` ainult release'i ajal** (Task 7). Kontrolliks `npx tsc --noEmit -p tsconfig.app.json` ja `npm test`; skriptid `npx tsx`-iga.
- Rollid: `teris_app` (RLS), `teris_platform` (`authDb()`, BYPASSRLS), `teris` (omanik; PG*). URL-id lõpevad `?schema=public`. **Saladusi ei trükita.**
- Varukoopia enne andmebaasi muudatust `teris_platform` rolliga: `set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-<silt>.dump && chmod 600 ~/backups/*.dump`.
- Kui Claude Code'i automaatrežiim keelab käsu, ära otsi ümbersõitu — lõpeta muu ja anna käsk kasutajale.
- `DeviceOwnership` on **ettevõttepõhine** tabel (`tenantId` vaikeväärtusega, RLS): lisa `scripts/tenancy/02-rls.sql` tabelite massiivi ja käivita skript; `TENANT_MODELS` kasvab 26-ni (uuenda testid, mis eeldavad 25). Välisvõtmeid ei ole → trigerite skripti (05) muuta ei ole vaja, aga käivita see kontrolliks uuesti.
- Telemeetria nähtavus: ettevõte näeb mõõtmisi ainult `[validFrom, validTo ?? ∞)` vahemikus oma omandiperioodide kaudu. Ilma omandita → tühi tulemus (mitte viga).
- Loisu Agro olemasolevad seadmed: omandiperiood algusega `2000-01-01T00:00:00Z` (kogu senine ajalugu jääb nähtavaks).
- IMEI: täpselt 15 numbrit, kehtiv Luhni kontrollnumber. MAC: 6 baiti kuueteistkümnendsüsteemis, salvestatakse kujul `AA:BB:CC:DD:EE:FF` (suurtähed, kooloniga); sisendina lubatud ka `-` eraldaja või eraldajata 12 märki.
- Veateated (täpselt): `Vigane IMEI (15 numbrit, kontrollnumber ei klapi)`, `Vigane MAC-aadress`, `Seade on juba registreeritud — võtke ühendust kasutajatoega` (HTTP 409; omanikku ei avaldata).
- Kommentaarid ja kasutajale nähtavad tekstid eesti keeles. Commit-sõnumid eesti keeles, lõpus `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Release ja `git push` ainult kasutaja kinnitusel (Task 7).

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `prisma/schema.prisma` | `enum DeviceIdentifierKind`, `model DeviceOwnership` |
| `scripts/tenancy/02-rls.sql`, `scripts/tenancy/07-device-ownership-backfill.mts` (uus) | RLS uuele tabelile; Loisu seadmete omandiperioodid |
| `src/server/deviceIdentifiers.ts` (+ test) | `validateImei`, `normalizeMac` |
| `src/server/deviceOwnership.ts` (+ test) | Omandiperioodide avamine/sulgemine seadme muutmisel |
| `src/server/apiHandler.ts` | Seadme registreerimise valideerimine, omand, 409 |
| `src/server/telemetryAccess.ts` (+ test) | Omandiperioodid ja kõik `tsdb` päringud |
| `src/server/fieldWorks.ts` | Telemeetria soovitused `telemetryAccess` kaudu |
| `src/server/platformApi.ts` (+ test), `src/admin/DevicesView.tsx` | Seadmete vaade ja vabastamine |

---

### Task 1: `DeviceOwnership` tabel, RLS ja Loisu omandiperioodid

**Files:**
- Modify: `prisma/schema.prisma`, `scripts/tenancy/02-rls.sql`, `src/server/tenantScope.test.ts` ja `tenantIsolation.test.ts` (25 → 26, kui loendus on kõvakodeeritud)
- Create: `scripts/tenancy/07-device-ownership-backfill.mts`

**Interfaces:**
- Produces: Prisma `deviceOwnership` (`tenantId`, `kind: 'IMEI' | 'MAC'`, `identifier`, `validFrom`, `validTo?`, `deviceId?`, `createdAt`, `createdBy?`).

- [ ] **Step 1: Skeem**

```prisma
enum DeviceIdentifierKind {
  IMEI
  MAC
}

// Telemeetriaseadme omandiperiood: ettevõte näeb TimescaleDB andmeid ainult nende
// IMEI/MAC-ide ja ajavahemike kohta. Ilma välisvõtmeta seadmele — ajalugu säilib ka
// seadme kustutamisel või ümbernimetamisel.
model DeviceOwnership {
  id         String               @id @default(cuid())
  tenantId   String               @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  kind       DeviceIdentifierKind
  identifier String // IMEI (15 numbrit) või MAC (AA:BB:CC:DD:EE:FF)
  deviceId   String? // TelemetryDevice.id loomise hetkel (teave, mitte välisvõti)
  validFrom  DateTime             @default(now())
  validTo    DateTime? // null = kehtib
  createdAt  DateTime             @default(now())
  createdBy  String? // looja kasutajatunnus (täidetakse automaatselt)

  @@index([tenantId])
  @@index([kind, identifier])
  @@map("device_ownerships")
}
```
(`createdBy` olemasolul täidab auditilaiendus selle automaatselt; `updatedBy` pole vaja.)

- [ ] **Step 2: RLS** — lisa `'device_ownerships'` `02-rls.sql` tabelite massiivi.

- [ ] **Step 3: Täitmisskript** (`scripts/tenancy/07-device-ownership-backfill.mts`, `authDb()`-ga, korduvkäivitatav): iga Loisu (`tenant-loisu-agro`) `telemetryDevice` kohta, millel on `imei` või `macAddress`, loo omandirida (`kind`, `identifier` — MAC normaliseeritult suurtähtedega, `deviceId`, `validFrom = 2000-01-01T00:00:00Z`, `validTo = null`, `tenantId` selgesõnaliselt), **kui** sama ettevõtte jaoks pole sama `kind+identifier` kehtivat rida. Trüki `Loodud N omandirida, olemas M`.

- [ ] **Step 4: Varukoopia, `db push`, RLS, täitmine, trigerid**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-4-t1.dump && chmod 600 ~/backups/*.dump && npx prisma db push && npx prisma generate && psql -v ON_ERROR_STOP=1 -f scripts/tenancy/02-rls.sql && npx tsx scripts/tenancy/07-device-ownership-backfill.mts && npx tsx scripts/tenancy/07-device-ownership-backfill.mts && npx tsx scripts/tenancy/05-tenant-fk-triggers.mts'
```
Expected: `in sync`; RLS skript OK (viimane `REVOKE` sh platvormi tabelid); esimene täitmine `Loodud N` (N = Loisu seadmete arv IMEI/MAC-iga), teine `Loodud 0`; trigereid sama arv mis enne (39).

- [ ] **Step 5: Testid ja commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS (eraldustestid katavad uue tabeli automaatselt `TENANT_MODELS` kaudu; uuenda kõvakodeeritud 25 → 26).
```bash
git add prisma/schema.prisma scripts/tenancy/02-rls.sql scripts/tenancy/07-device-ownership-backfill.mts src/server/*.test.ts
git commit -m "Telemeetriaseadmete omandiperioodid (DeviceOwnership, RLS) ja Loisu seadmete täitmine"
```

---

### Task 2: IMEI ja MAC kontroll

**Files:**
- Create: `src/server/deviceIdentifiers.ts`, `src/server/deviceIdentifiers.test.ts`

**Interfaces:**
- Produces: `validateImei(input: unknown): string | null` (puhastatud 15 numbrit või `null`), `normalizeMac(input: unknown): string | null` (`AA:BB:CC:DD:EE:FF` või `null`), `IMEI_ERROR`, `MAC_ERROR`.

- [ ] **Step 1: Kirjuta failiv test**

```ts
import { describe, it, expect } from 'vitest';
import { validateImei, normalizeMac } from './deviceIdentifiers';

describe('validateImei', () => {
  it.each(['490154203237518', '356938035643809', ' 490154203237518 '])('kehtiv %s', (s) =>
    expect(validateImei(s)).toBe(s.trim()));
  it.each(['490154203237517', '49015420323751', '4901542032375180', '49015420323751a', '', null, 490154203237518])(
    'vigane %s', (s) => expect(validateImei(s)).toBeNull());
});

describe('normalizeMac', () => {
  it.each([
    ['aa:bb:cc:dd:ee:ff', 'AA:BB:CC:DD:EE:FF'],
    ['AA-BB-CC-DD-EE-FF', 'AA:BB:CC:DD:EE:FF'],
    ['aabbccddeeff', 'AA:BB:CC:DD:EE:FF']
  ])('%s → %s', (s, out) => expect(normalizeMac(s)).toBe(out));
  it.each(['aa:bb:cc:dd:ee', 'gg:bb:cc:dd:ee:ff', 'aa:bb-cc:dd:ee:ff', '', null, 123])('vigane %s', (s) =>
    expect(normalizeMac(s)).toBeNull());
});
```
(Kontrolli Luhni vektoreid enne testi kirjutamist: `490154203237518` ja `356938035643809` on avalikud kehtivad näidis-IMEI-d; kui mõni ei klapi, asenda arvutatud kehtiva väärtusega ja märgi raportisse.)

- [ ] **Step 2: Käivita — peab kukkuma.** Run: `npx vitest run src/server/deviceIdentifiers.test.ts`.

- [ ] **Step 3: Implementeeri**

```ts
// src/server/deviceIdentifiers.ts — telemeetriaseadme tunnuste kontroll ja normaliseerimine.
export const IMEI_ERROR = 'Vigane IMEI (15 numbrit, kontrollnumber ei klapi)';
export const MAC_ERROR = 'Vigane MAC-aadress';

export function validateImei(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (!/^\d{15}$/.test(s)) return null;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(s[14 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0 ? s : null;
}

export function normalizeMac(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().toUpperCase();
  const m = /^([0-9A-F]{2})([:-]?)([0-9A-F]{2})\2([0-9A-F]{2})\2([0-9A-F]{2})\2([0-9A-F]{2})\2([0-9A-F]{2})$/.exec(s);
  if (!m) return null;
  return [m[1], m[3], m[4], m[5], m[6], m[7]].join(':');
}
```

- [ ] **Step 4: Testid ja commit**

Run: `npx vitest run src/server/deviceIdentifiers.test.ts && npx tsc --noEmit -p tsconfig.app.json`. Expected: PASS.
```bash
git add src/server/deviceIdentifiers.ts src/server/deviceIdentifiers.test.ts
git commit -m "IMEI (Luhn) ja MAC-aadressi kontroll"
```

---

### Task 3: Seadme registreerimine ja omandiperioodid

**Files:**
- Create: `src/server/deviceOwnership.ts`, `src/server/deviceOwnership.test.ts`
- Modify: `src/server/apiHandler.ts` (`POST /api/fleet/devices` ~1005-1032, `DELETE /api/fleet/devices/:id` ~1033-1040)

**Interfaces:**
- Consumes: `validateImei`, `normalizeMac` (Task 2); `tenantTransaction`, `requireTenantId` (`db.ts`)
- Produces: `syncOwnership(tx: TxClient, before: { imei: string | null; macAddress: string | null } | null, after: { id: string; imei: string | null; macAddress: string | null } | null, now?: Date): Promise<void>` — sulgeb (`validTo = now`) jooksva ettevõtte kehtivad perioodid tunnustele, mis kadusid, ja avab uued perioodid lisandunud tunnustele.

- [ ] **Step 1: Kirjuta failiv test** (`deviceOwnership.test.ts`, ajutine ettevõte `authDb()` kaudu + `runAsTenant(T, async () => tenantTransaction(...))`; kõik read koristatakse)
1. `syncOwnership(tx, null, { id, imei: I1, macAddress: null })` → üks kehtiv IMEI rida `I1`.
2. `before {imei: I1}`, `after {imei: I2}` → `I1` rida suletud (`validTo` = `now`), `I2` rida avatud.
3. `before {imei: I2}`, `after null` (kustutamine) → `I2` suletud.
4. Sama tunnus enne ja pärast → muutust pole (ridade arv sama).

- [ ] **Step 2: Käivita — peab kukkuma.**

- [ ] **Step 3: Implementeeri** `deviceOwnership.ts` (kasutab ainult `tx`-i; `tenantId` tuleb vaikeväärtusest; sulgemine `updateMany({ where: { kind, identifier, validTo: null }, data: { validTo: now } })` — RLS piirab jooksva ettevõttega).

`apiHandler.ts` `POST /api/fleet/devices`:
- `connectivityType` järgi: `CELLULAR` → `imei = validateImei(d.imei)`, puudub/vigane → 400 `IMEI_ERROR`; `EYE_SENSOR` → `macAddress = normalizeMac(d.macAddress)`, vigane → 400 `MAC_ERROR`. Teise tüübi tunnus `null`.
- Tehingus (`tenantTransaction`): loe olemasolev seade (`before`), upsert, `syncOwnership(tx, before, saved)`.
- Prisma `P2002` `imei`/`macAddress` peal → 409 `Seade on juba registreeritud — võtke ühendust kasutajatoega` (sama tekst ka siis, kui seade on sama ettevõtte teise kirje all — omanikku ei avaldata).
`DELETE /api/fleet/devices/:id`: tehingus loe seade, kustuta, `syncOwnership(tx, before, null)`.

- [ ] **Step 4: Integratsioonitest** (`deviceOwnership.test.ts` lisa): kahe ajutise ettevõttega A ja B — A registreerib kehtiva IMEI API kaudu (võlts-req/res nagu `adminUsers.test.ts`, `setSessionUserForTest` A admin-kasutajaga) → 200; B registreerib sama IMEI → 409 täpse tekstiga; vigane IMEI → 400. Koristus: seadmed, omandiread, kasutajad, ettevõtted.

- [ ] **Step 5: Testid ja commit**

Run: focused tests, `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.
```bash
git add src/server/deviceOwnership.ts src/server/deviceOwnership.test.ts src/server/apiHandler.ts
git commit -m "Seadme registreerimine: IMEI/MAC kontroll, omandiperioodid, hõivatud seade 409"
```

---

### Task 4: Telemeetria päringud omandiperioodide piires

**Files:**
- Create: `src/server/telemetryAccess.ts`, `src/server/telemetryAccess.test.ts`
- Modify: `src/server/apiHandler.ts` (`fetchCellularTelemetry`, `fetchEyeTelemetry`, `fetchDeviceHistory` ja nende kasutajad: `GET /api/fleet` ~779-786, `POST /api/fleet/devices/assign` ~1206, `GET /api/telemetry/history` ~1320), `src/server/fieldWorks.ts` (`getTelemetrySuggestionsForField` ~517)

**Interfaces:**
- Produces:
  - `type OwnershipWindow = { from: Date; to: Date | null }`
  - `ownershipWindows(kind: 'IMEI' | 'MAC', identifiers: string[]): Promise<Map<string, OwnershipWindow[]>>` — jooksva ettevõtte perioodid (RLS + `prisma`)
  - `clampWindow(windows: OwnershipWindow[], from: Date, to: Date): { from: Date; to: Date }[]` — puhas funktsioon, vahemike lõikumine
  - Funktsioonid `fetchCellularTelemetry`, `fetchEyeTelemetry`, `fetchDeviceHistory` liiguvad `telemetryAccess.ts`-i ja rakendavad perioode: viimased väärtused ainult `time >= kehtiva perioodi algus`; ajalugu ainult lõigatud vahemikes; ilma perioodita → tühi.

- [ ] **Step 1: Kirjuta failiv test**
- `clampWindow` ühiktestid: periood täielikult sees / osaliselt / väljas / avatud lõpuga / mitu perioodi.
- Integratsioon (live `tsdb`, kui olemas — `if (!tsdb) return;`): Loisu kontekstis olemasoleva seadme ajalugu (`fetchDeviceHistory`) annab sama tulemuse mis enne muudatust (võrdle punktide arvu teadaoleva testiaknaga `telemetryHistory.test.ts`-ist); ajutise ettevõtte kontekstis sama IMEI-ga → `[]`; viimased väärtused (`fetchCellularTelemetry([imei])`) ajutise ettevõtte kontekstis → tühi `Map`.

- [ ] **Step 2: Käivita — peab kukkuma.**

- [ ] **Step 3: Implementeeri**
- `fetchCellularTelemetry(imeis)`: filtreeri `imeis` nendeks, millel on kehtiv periood; SQL-is lisa iga seadme kohta `time >= validFrom` (nt `JOIN (VALUES ...) AS w(device, valid_from)` või eraldi päring seadme kaupa — vali selge ja turvaline variant, ainult parameetritega).
- `fetchEyeTelemetry(macs)`: sama MAC-ide ja nende `validFrom` järgi (rida arvestatakse ainult, kui `time >= validFrom` sellele MAC-ile).
- `fetchDeviceHistory(imei, hours, from, to)`: arvuta soovitud aken nagu praegu (`resolveHistoryWindow`), lõika `clampWindow`-iga; iga lõigu kohta päring; ühenda ajajärjestuses; `HISTORY_MAX_POINTS` hõrendus kogu tulemusele.
- `getTelemetrySuggestionsForField`: seadme sidumise aken lõigatakse omandiperioodidega enne `tsdb` päringut.
- `apiHandler.ts`/`fieldWorks.ts` impordivad uusi funktsioone; `tsdb.$queryRaw` otse kasutust neis failides enam pole (`grep -n "tsdb\.\$queryRaw" src/server/apiHandler.ts src/server/fieldWorks.ts` → tühi).

- [ ] **Step 4: Testid ja commit**

Run: `npx vitest run src/server/telemetryAccess.test.ts src/server/telemetryHistory.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS (`telemetryHistory.test.ts` Loisu tulemused muutumatud).
```bash
git add src/server/telemetryAccess.ts src/server/telemetryAccess.test.ts src/server/apiHandler.ts src/server/fieldWorks.ts
git commit -m "Telemeetria päringud ainult ettevõtte omandiperioodide piires (telemetryAccess.ts)"
```

---

### Task 5: Seadmed teenusepakkuja keskkonnas

**Files:**
- Modify: `src/server/platformApi.ts`, `src/server/platformApi.test.ts`
- Create: `src/admin/DevicesView.tsx`; Modify: `src/admin/AdminApp.tsx`, `src/admin/platformApi.ts`, `src/admin/AuditView.tsx`

**Interfaces:**
- Produces:

| Meetod ja tee | Kirjeldus |
|---|---|
| GET `/api/platform/devices` | `[{ id, tenantId, tenantName, connectivityType, imei, macAddress, model, createdAt, ownership: { validFrom } }]` — kõik `TelemetryDevice` read IMEI/MAC-iga |
| GET `/api/platform/devices/registrations?limit=` | Viimased omandiperioodid (uuemad ees, ≤ 200): `{ tenantName, kind, identifier, validFrom, validTo }` |
| POST `/api/platform/devices/:id/release` | Seadme `imei`/`macAddress` → `null`, märkus `notes` lisandub „Vabastatud teenusepakkuja poolt <DD.MM.YYYY>“, kehtiv omandiperiood suletakse; tehingus `authDb()` kaudu; logi `DEVICE_RELEASE` `{ kind, identifier }` `targetTenantId`-ga |

- [ ] **Step 1: Testid**: ajutine ettevõte + seade (kehtiv IMEI) + omandirida `authDb()` kaudu; GET devices sisaldab seadet õige `tenantName`-iga; release → seadmel `imei = null`, omandirida suletud, logirida olemas; seejärel teine ajutine ettevõte saab sama IMEI registreerida (Task 3 API kaudu → 200). Koristus kõigele.
- [ ] **Step 2: Käivita — peab kukkuma.**
- [ ] **Step 3: Implementeeri** API ja kasutajaliides: vaade „Seadmed“ (tabel: ettevõte, tüüp, IMEI/MAC, mudel, registreeritud alates; nupp „Vabasta“ kinnitusega: „Seade eemaldatakse ettevõtte <nimi> registrist ja selle andmed muutuvad uuele omanikule nähtavaks alates uuest registreerimisest. Jätkata?“) ja alamjaotis „Viimased registreerimised“. `AuditView`: `DEVICE_RELEASE` → „Seade vabastatud“.
- [ ] **Step 4: Testid ja commit**

Run: focused tests, `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.
```bash
git add src/server/platformApi.ts src/server/platformApi.test.ts src/admin
git commit -m "Teenusepakkuja: seadmete vaade, registreerimised ja seadme vabastamine"
```

---

### Task 6: Tehnika vaate veateated

**Files:**
- Modify: `src/components/VehicleTracker.tsx` (seadme lisamise/muutmise vorm), vajadusel `src/App.tsx` (`handleAddDevice`/`handleUpdateDevice` ~1076/1090), `src/services/api.ts` (seadme salvestamise vea tekst)

- [ ] **Step 1:** Seadme salvestamisel kuvatakse serveri veateade (`errorMessage(res, …)` — praegu võib see olla üldine tekst või `console.error`): 400 IMEI/MAC viga ja 409 „Seade on juba registreeritud — võtke ühendust kasutajatoega“ jõuavad kasutajani (`alertDialog` või vormi veariba, vastavalt olemasolevale mustrile). Vormi IMEI väljale `inputMode="numeric"`, `maxLength={15}`, vihje „15 numbrit“.
- [ ] **Step 2:** Run: `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.
- [ ] **Step 3: Commit**
```bash
git add src/components/VehicleTracker.tsx src/App.tsx src/services/api.ts
git commit -m "Tehnika: seadme registreerimise veateated (IMEI/MAC, hõivatud seade)"
```

---

### Task 7: Tootmisse viimine (kasutaja kinnitusel)

- [ ] **Step 1:** `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm run release'`; `systemctl is-active teris`; `journalctl -u teris -n 30 --no-pager`; `BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts` → „KÕIK KORRAS“.
- [ ] **Step 2:** https://teris.ee Tehnika vaade: Loisu seadmed, nende asukohad ja sõitude taasesitus nagu enne. https://admin.teris.ee „Seadmed“: Loisu seadmed nähtavad.
- [ ] **Step 3:** `git push`.

## Väljas

- Tugiligipääs (spec 5.3) — **etapp 5**.
- `Vehicle.lastLatitude/lastLongitude` (masina viimane asukoht andmebaasis) jäävad ettevõtte enda andmeteks; need ei tule teise ettevõtte seadmest.
