# Mitme ettevõtte tugi, etapp 5: tugiligipääs — implementeerimisplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ettevõtte admin saab anda kasutajatoele ajutise loa (1 h / 24 h / 7 päeva) ja selle igal ajal tühistada; kehtiva loa ajal saab teenusepakkuja admin.teris.ee-st avada ettevõtte rakenduse **ainult lugemiseks** admini õigustes; iga sisenemine logitakse ja on ettevõtte adminile nähtav.

**Architecture:** Kaks ettevõttepõhist tabelit (RLS): `SupportGrant` (load) ja `SupportAccessLog` (sisenemised). Platvormi tabel `SupportSession` hoiab ühekordset üleandmistokenit ja tugisessiooni tokenit. Teenusepakkuja vajutab „Ava ettevõtte vaade“ → platvormi API loob 60 s kehtiva ühekordse üleandmistokeni → uus vaheleht `https://teris.ee/tugi#<token>` → rakendus vahetab selle `/api/auth/support-login` kaudu tugisessiooni küpsise (`teris_support_session`) vastu. `authGate` tunneb tugisessiooni ära, kontrollib igal päringul loa kehtivust ja loob sünteetilise kasutaja (`supportView: true`, admin, `readOnly`); litsentsivärav keelab tugivaates kõik muudatused.

**Tech Stack:** Node 22, TypeScript 6, Prisma 6.19, PostgreSQL 17 (RLS), React 19, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-15-mitme-ettevotte-tugi-design.md` — 1.1 (`SupportGrant`), 5.3, 3.3 (`supportView`).

## Global Constraints

- Arendus ja toodang kasutavad **sama andmebaasi**; käsud serveris: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`. Kohalikus Macis `npm`/`npx` ei tööta. Git kohalikult.
- **`npm run build` ainult release'i ajal** (Task 7). Kontrolliks `npx tsc --noEmit -p tsconfig.app.json` ja `npm test`.
- Rollid: `teris_app` (RLS), `teris_platform` (`authDb()`, BYPASSRLS), `teris` (omanik). URL-id lõpevad `?schema=public`. **Saladusi ei trükita** (ka mitte tugitokeneid).
- Varukoopia enne andmebaasi muudatust `teris_platform` rolliga: `set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-<silt>.dump && chmod 600 ~/backups/*.dump`.
- Kui Claude Code'i automaatrežiim keelab käsu, ära otsi ümbersõitu — lõpeta muu ja anna käsk kasutajale.
- `SupportGrant`, `SupportAccessLog`: ettevõttepõhised (RLS; lisa `02-rls.sql` massiivi; `TENANT_MODELS` 26 → 28; käivita trigerite skript 05 uuesti). `SupportSession`: platvormi tabel, väli **`targetTenantId`** (mitte `tenantId`), lisa `04-privileges.sql`/`02-rls.sql` REVOKE/GRANT lausetesse.
- Loa kestused täpselt: 1 h, 24 h, 7 päeva. Loa annab ja tühistab ainult ettevõtte admin (`isAdmin`). Korraga võib kehtida mitu luba; kehtivaks loetakse `revokedAt IS NULL AND validUntil > now()`.
- Üleandmistoken: 32 juhuslikku baiti, base64url, salvestatakse ainult räsina (`hashToken`), kehtib 60 s, ühekordne. Tugisessiooni kehtivus: `min(loa validUntil, now + 8 h)`, ilma libiseva pikenduseta.
- Tugisessioon on alati **ainult lugemiseks** ja **admini õigustes** (kasutaja otsus); muudatuste keeld serveris: kõik mitte-GET päringud peale `/api/auth/logout` ja `isAllowedWhenReadOnly` erandite → 403 `Tugivaade on ainult lugemiseks` (`code: 'SUPPORT_READ_ONLY'`). Tugisessiooniga ei saa vahetada parooli ega kutsuda paroolivoogusid.
- Loa tühistamisel või aegumisel lõpeb tugisessioon järgmisel päringul (401).
- Tugikasutaja kuvanimi: `Kasutajatugi`; kasutajanimi `kasutajatugi` (sünteetiline, andmebaasis sellist kasutajat pole; auditis `createdBy`/`updatedBy` ei teki, sest kirjutamine on keelatud).
- Kommentaarid ja kasutajale nähtavad tekstid eesti keeles. Commit-sõnumid eesti keeles, lõpus `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Release ja `git push` ainult kasutaja kinnitusel (Task 7).

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `prisma/schema.prisma` | `SupportGrant`, `SupportAccessLog`, `SupportSession` |
| `scripts/tenancy/02-rls.sql`, `04-privileges.sql` | RLS ja õigused |
| `src/server/supportGrants.ts` (+ test) | Ettevõtte API: lubade andmine/tühistamine/loend, sisenemiste logi |
| `src/server/platformApi.ts` (+ test) | Ettevõtte kaardil kehtivad load; üleandmistokeni loomine |
| `src/server/supportSession.ts` (+ test), `src/server/authGate.ts`, `src/server/licenseGate.ts` | Tugisessiooni sisselogimine, tuvastamine, ainult lugemine |
| `src/components/UsersAdminModal.tsx` (või uus `SupportAccessPanel.tsx`) | Lubade haldus ettevõtte adminile |
| `src/AuthGate.tsx`, `src/components/LicenseBanner.tsx` jt | `/tugi` üleandmine, tugivaate riba |
| `src/admin/TenantDetail.tsx`, `src/admin/AuditView.tsx` | „Ava ettevõtte vaade“, logi sildid |

---

### Task 1: Tabelid

**Files:** `prisma/schema.prisma`, `scripts/tenancy/02-rls.sql`, `scripts/tenancy/04-privileges.sql`, testid, kus `TENANT_MODELS.size` on kõvakodeeritud.

- [ ] **Step 1: Skeem**

```prisma
// Ettevõtte admini antud ajutine luba kasutajatoele (ainult lugemiseks)
model SupportGrant {
  id              String    @id @default(cuid())
  tenantId        String    @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  grantedByUserId String
  validUntil      DateTime
  revokedAt       DateTime?
  createdAt       DateTime  @default(now())
  createdBy       String? // looja kasutajatunnus (täidetakse automaatselt)
  updatedBy       String? // viimase muutja kasutajatunnus (täidetakse automaatselt)

  grantedBy User               @relation("SupportGrantGrantedBy", fields: [grantedByUserId], references: [id], onDelete: Cascade)
  accesses  SupportAccessLog[]

  @@index([tenantId])
  @@map("support_grants")
}

// Kasutajatoe sisenemine ettevõtte keskkonda (ettevõtte adminile nähtav)
model SupportAccessLog {
  id               String       @id @default(cuid())
  tenantId         String       @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  supportGrantId   String
  platformUsername String // teenusepakkuja kasutajanimi sisenemise hetkel
  startedAt        DateTime     @default(now())

  grant SupportGrant @relation(fields: [supportGrantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("support_access_log")
}

// Platvormi tabel (authDb): ühekordne üleandmistoken ja tugisessioon
model SupportSession {
  id               String    @id @default(cuid())
  targetTenantId   String // mitte "tenantId" — muidu satuks mudel TENANT_MODELS-i
  supportGrantId   String
  platformUserId   String
  handoffTokenHash String?   @unique // kustutatakse (null) pärast vahetamist
  handoffExpiresAt DateTime
  sessionTokenHash String?   @unique // tekib vahetamisel
  expiresAt        DateTime? // tugisessiooni lõpp
  createdAt        DateTime  @default(now())

  @@index([supportGrantId])
  @@map("support_sessions")
}
```
`User` mudelisse lisa vastassuhe `supportGrants SupportGrant[] @relation("SupportGrantGrantedBy")`.

- [ ] **Step 2: RLS ja õigused** — `02-rls.sql` massiivi `'support_grants', 'support_access_log'`; `support_sessions` `02` lõpu REVOKE ja `04` REVOKE/GRANT lausetesse.

- [ ] **Step 3: Varukoopia, `db push`, RLS, õigused, trigerid**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-5-t1.dump && chmod 600 ~/backups/*.dump && npx prisma db push && npx prisma generate && psql -v ON_ERROR_STOP=1 -f scripts/tenancy/02-rls.sql && psql -v ON_ERROR_STOP=1 -f scripts/tenancy/04-privileges.sql && npx tsx scripts/tenancy/05-tenant-fk-triggers.mts'
```
Expected: `in sync`; trigereid 39 + 2 (`support_grants.grantedByUserId`, `support_access_log.supportGrantId`) = 41.

- [ ] **Step 4: Testid ja commit** — `TENANT_MODELS.size` 26 → 28; `npx tsc --noEmit -p tsconfig.app.json && npm test` PASS.
```bash
git add prisma/schema.prisma scripts/tenancy/02-rls.sql scripts/tenancy/04-privileges.sql src/server/*.test.ts
git commit -m "Tugiligipääsu tabelid: SupportGrant, SupportAccessLog (RLS), SupportSession (platvorm)"
```

---

### Task 2: Lubade haldus ettevõtte poolel

**Files:** Create `src/server/supportGrants.ts`, `src/server/supportGrants.test.ts`; Modify `src/server/apiHandler.ts` (ruuteris `handleAdminUsers` kõrvale `handleSupportGrants`), `src/components/UsersAdminModal.tsx` (või uus `src/components/SupportAccessPanel.tsx`, mis kuvatakse kasutajate aknas), `src/services/api.ts`.

**Interfaces (ainult `isAdmin`; muidu 403 `Ainult admin saab kasutajatoe ligipääsu hallata`):**

| Meetod ja tee | Kirjeldus |
|---|---|
| GET `/api/support-grants` | `[{ id, validUntil, revokedAt, createdAt, grantedBy: { username, displayName }, active }]` (viimased 20, uuemad ees) |
| POST `/api/support-grants` | `{ duration: '1h' \| '24h' \| '7d' }` → 201 loodud luba; muu väärtus → 400 `Vigane kestus` |
| POST `/api/support-grants/:id/revoke` | `revokedAt = now` (kui juba tühistatud/aegunud → 200 muutuseta); kustutab selle loa tugisessioonid (`authDb().supportSession.deleteMany({ where: { supportGrantId } })`) |
| GET `/api/support-access-log` | `[{ startedAt, platformUsername, grantId }]` (viimased 50) |

- [ ] **Step 1: Testid** (ajutine ettevõte + admin + tavakasutaja, päris sessioon nagu `deviceOwnership.test.ts`): tavakasutaja → 403; admin loob `24h` loa → `validUntil` ≈ now + 24 h (±1 min); vigane kestus → 400; loend sisaldab `active: true`; tühistamine → `active: false`; teise ettevõtte loa ID tühistamine → 404 (RLS); logi loend tühi. Koristus.
- [ ] **Step 2: Käivita — peab kukkuma.**
- [ ] **Step 3: Implementeeri** server (`tenantTransaction` kirjutamistel) ja kasutajaliides: kasutajate aknas jaotis **„Kasutajatoe ligipääs“** — kehtiva loa korral „Ligipääs kehtib kuni DD.MM.YYYY HH:MM“ + „Tühista“; muidu kolm nuppu „1 tund“, „24 tundi“, „7 päeva“ selgitusega „Kasutajatugi saab teie keskkonda vaadata ainult lugemiseks. Iga sisenemine logitakse siia.“; all sisenemiste logi („DD.MM.YYYY HH:MM — kasutajatugi (<platformUsername>)“).
- [ ] **Step 4: Testid ja commit**
```bash
git add src/server/supportGrants.ts src/server/supportGrants.test.ts src/server/apiHandler.ts src/components src/services/api.ts
git commit -m "Ettevõtte admin annab ja tühistab kasutajatoe ligipääsu; sisenemiste logi"
```

---

### Task 3: Üleandmistoken teenusepakkuja keskkonnas

**Files:** `src/server/platformApi.ts`, `src/server/platformApi.test.ts`

**Interfaces:**
- GET `/api/platform/tenants/:id` vastusesse `supportGrant: { validUntil } | null` (pikima kehtivusega kehtiv luba).
- POST `/api/platform/tenants/:id/support-session` → kehtiva loa puudumisel 400 `Ettevõte pole kasutajatoele ligipääsu andnud`; peatatud ettevõte → 400 `Ettevõte on peatatud`; muidu loob `SupportSession` rea (`handoffTokenHash`, `handoffExpiresAt = now + 60 s`, `supportGrantId`, `platformUserId`, `targetTenantId`) ja vastab `{ url: 'https://teris.ee/tugi#' + token }` (host `APP_BASE_URL`-ist); logi `SUPPORT_SESSION_START` `{ supportGrantId }` `targetTenantId`-ga. Tokenit logisse ega auditisse ei kirjutata.

- [ ] **Step 1: Testid**: ilma loata → 400; kehtiva loaga → 200, URL algab `APP_BASE_URL + '/tugi#'`, `support_sessions` rida räsiga (mitte tokeniga), logirida; ettevõtte detailis `supportGrant` olemas. Koristus.
- [ ] **Step 2–4:** RED → implementeeri → GREEN; commit
```bash
git add src/server/platformApi.ts src/server/platformApi.test.ts
git commit -m "Teenusepakkuja: tugivaate avamine kehtiva loa korral (ühekordne üleandmistoken)"
```

---

### Task 4: Tugisessioon ettevõtte rakenduses

**Files:** Create `src/server/supportSession.ts`, `src/server/supportSession.test.ts`; Modify `src/server/authGate.ts`, `src/server/licenseGate.ts`, `src/server/auth.ts` (küpsise abifunktsioonid)

**Interfaces:**
- `SUPPORT_COOKIE = 'teris_support_session'` (HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age = sessiooni kestus sekundites).
- POST `/api/auth/support-login` `{ token }` (avalik teekond `authGate`-is): leia `SupportSession` `handoffTokenHash`-i järgi, `handoffExpiresAt > now`, luba kehtib ja ettevõte `ACTIVE` — muidu 400 `Tugivaate link on aegunud või juba kasutatud`. **Atomaarselt** (`updateMany where handoffTokenHash = h AND handoffExpiresAt > now`): `handoffTokenHash = null`, `sessionTokenHash = hash(uus token)`, `expiresAt = min(grant.validUntil, now + 8 h)`. Kirjuta `SupportAccessLog` (`authDb()`, `tenantId` selgesõnaliselt, `platformUsername`). Sea küpsis; vastus `{ user }` (sama kuju mis `/api/auth/me`).
- `findSupportSession(tokenHash)`: kehtiv kui `expiresAt > now`, luba kehtib (`revokedAt IS NULL AND validUntil > now`), ettevõte `ACTIVE`.
- `authGate`: kui tavalist sessiooni pole, aga `SUPPORT_COOKIE` on ja `findSupportSession` kehtib → sünteetiline `SessionUser` `{ id: 'support:' + supportSession.id, username: 'kasutajatugi', displayName: 'Kasutajatugi', isAdmin: true, isFinanceManager: true, mustChangePassword: false, isActive: true, tenantId, supportView: true, supportValidUntil }`. Tavaline sessioon on eelistatud. `/api/auth/me` vastusesse `supportView` ja `supportValidUntil`. `/api/auth/logout` kustutab ka tugisessiooni ja küpsise. `/api/auth/password`, `forgot`, `set-password`, `token` tugisessiooniga → 403 `Tugivaade on ainult lugemiseks`.
- `licenseGate`: kui `sessionUser.supportView` → iga päring, mis pole `isAllowedWhenReadOnly(pathname, method)` → 403 `{ error: 'Tugivaade on ainult lugemiseks', code: 'SUPPORT_READ_ONLY' }` (moodulikeeld kehtib enne seda nagu praegu).
- Kõik kohad, mis kasutavad `sessionUser.id` andmebaasi viitena (nt `adminUsers.ts` „iseenda muutmine“, kannete `createdBy`/`confirmedBy` seosed), ei tohi tugivaates kirjutada — kirjutamine on niikuinii keelatud; lugemistel kontrolli, et sünteetiline ID ei põhjusta viga (nt `findUnique({ where: { id: 'support:…' } })` → `null`, mitte erind).

- [ ] **Step 1: Testid** (`supportSession.test.ts`, ajutine ettevõte + luba + platvormi kasutaja + `SupportSession` üleandmistokeniga `authDb()` kaudu; päris `handleApiRequest`):
  1. `support-login` kehtiva tokeniga → 200, küpsis, `support_access_log` rida, `support_sessions.handoffTokenHash` null;
  2. sama tokeniga uuesti → 400;
  3. aegunud üleandmistoken → 400;
  4. tugiküpsisega GET `/api/seasons` → 200 (ettevõtte andmed), GET `/api/auth/me` → `supportView: true`, `isAdmin: true`;
  5. tugiküpsisega POST `/api/seasons` → 403 `SUPPORT_READ_ONLY`; POST `/api/auth/password` → 403;
  6. loa tühistamine (`authDb()` `revokedAt = now`) → järgmine GET → 401;
  7. teise ettevõtte andmeid tugisessioon ei näe (RLS — `prisma.field.count()` tugisessioonis = ajutise ettevõtte põldude arv 0, mitte Loisu oma);
  8. logout → küpsis kustutatud, sessioon kadunud.
  Koristus kõigele.
- [ ] **Step 2–4:** RED → implementeeri → GREEN (`npx vitest run src/server/supportSession.test.ts src/server/auth.test.ts src/server/authSession.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm test`); commit
```bash
git add src/server/supportSession.ts src/server/supportSession.test.ts src/server/authGate.ts src/server/licenseGate.ts src/server/auth.ts
git commit -m "Tugisessioon: ühekordse lingi vahetus, ainult lugemine admini õigustes, sisenemise logi"
```

---

### Task 5: Kasutajaliides — `/tugi`, tugivaate riba, admin-nupp

**Files:** `src/AuthGate.tsx` (või `src/main.tsx` marsruut), `src/types/auth.ts` (`supportView?`, `supportValidUntil?`), `src/components/LicenseBanner.tsx` (või uus `SupportBanner.tsx`), `src/services/api.ts` (`supportLogin`, 403 `SUPPORT_READ_ONLY` käsitlus), `src/admin/TenantDetail.tsx`, `src/admin/platformApi.ts`, `src/admin/AuditView.tsx`

- [ ] **Step 1:**
  - **Rakendus:** kui `location.pathname === '/tugi'` ja fragmendis on token → `api.supportLogin(token)`, eemalda fragment (`history.replaceState(null, '', '/')`) **enne** päringut, seejärel ava rakendus. Vigase/aegunud lingi korral sisselogimisleht teatega „Tugivaate link on aegunud või juba kasutatud“.
  - **Tugivaate riba** (alati nähtav tugivaates, kõigi teiste ribade kohal): „Tugivaade: <ettevõte> — ainult lugemiseks, kehtib kuni DD.MM.YYYY HH:MM“ + nupp „Lõpeta tugivaade“ (logout).
  - **403 `SUPPORT_READ_ONLY`** → sama teade nagu litsentsivea puhul (`setLicenseErrorHandler` mehhanism või analoog), üks kord korraga.
  - Tugivaates peida „Muuda parooli“ menüüs.
  - **admin.teris.ee ettevõtte kaart:** kehtiva loa korral „Kasutajatugi: ligipääs kehtib kuni …“ ja nupp **„Ava ettevõtte vaade“** → POST support-session → `window.open(url, '_blank', 'noopener')`; ilma loata selgitus „Ettevõte pole kasutajatoele ligipääsu andnud.“ `AuditView`: `SUPPORT_SESSION_START` → „Tugivaade avatud“.
- [ ] **Step 2:** `npx tsc --noEmit -p tsconfig.app.json && npm test` PASS.
- [ ] **Step 3: Commit**
```bash
git add src
git commit -m "Tugivaate kasutajaliides: /tugi link, tugivaate riba, admin-keskkonnast avamine"
```

---

### Task 6: Kontroll — tugivaade ei saa kirjutada

**Files:** `src/server/supportSession.test.ts`

- [ ] **Step 1:** Lisa test, mis käib läbi **kõik** ettevõtte API muutvad teekonnad: kogu `apiHandler.ts`, `fieldWorks.ts`, `adminUsers.ts`, `supportGrants.ts` mitte-GET marsruudid (koosta loend `grep -n "method === '\(POST\|PUT\|PATCH\|DELETE\)'"` põhjal testifailis konstandina) ja kinnita, et tugiküpsisega annab iga üks 403 (v.a `/api/auth/logout` ja `isAllowedWhenReadOnly` erand `POST /api/satellite/cloud-check`). Kinnita lõpuks, et ajutise ettevõtte andmetes muutust ei toimunud.
- [ ] **Step 2:** Run focused test + `npm test`. Commit
```bash
git add src/server/supportSession.test.ts
git commit -m "Test: tugivaade ei pääse ühelegi muutvale teekonnale"
```

---

### Task 7: Tootmisse viimine (kasutaja kinnitusel)

- [ ] **Step 1:** `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm run release'`; `systemctl is-active teris`; `journalctl -u teris -n 30 --no-pager`; `BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts` → „KÕIK KORRAS“.
- [ ] **Step 2:** Kasutaja: teris.ee → Kasutajad → „Kasutajatoe ligipääs“ → „1 tund“; admin.teris.ee → Loisu Agro → „Ava ettevõtte vaade“ → avaneb teris.ee tugivaate ribaga, salvestamine keelatud; teris.ee kasutajate aknas logikirje; „Tühista“ → tugivaade lõpeb.
- [ ] **Step 3:** `git push`.
