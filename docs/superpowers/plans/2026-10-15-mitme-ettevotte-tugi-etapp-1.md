# Mitme ettevõtte tugi, etapp 1: andmemudel ja eraldus — implementeerimisplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kõik ettevõtte andmed saavad `tenantId`, olemasolevad andmed kuuluvad ettevõttele Loisu Agro OÜ ning teise ettevõtte ridu ei näe ega muuda ükski päring — ei rakenduse filtri ega andmebaasi (RLS) tasemel.

**Architecture:** Päringu kontekst (`AsyncLocalStorage` failis `db.ts`) kannab lisaks kasutajanimele ettevõtte ID-d. Kaks Prisma laiendust: `tenant-scope` lisab ettevõttepõhiste mudelite päringutele `where.tenantId` ja viskab vea, kui konteksti pole; `tenant-rls` täidab iga päringu tehingus, mille esimene lause seab `app.tenant_id`. Postgres RLS (`FORCE`) lubab rakenduse rollile `teris_app` ainult selle ettevõtte ridu; `tenant_id` veeru vaikeväärtus `current_setting('app.tenant_id')` täidab ettevõtte ka pesastatud loomistel. Autentimine (enne konteksti tekkimist) kasutab eraldi `teris_platform` rolli (`BYPASSRLS`) klienti `authPrisma`.

**Tech Stack:** Node 22, TypeScript 6, Prisma 6.19 (`prisma db push`, mitte migratsioonifailid), PostgreSQL 17, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-15-mitme-ettevotte-tugi-design.md` (selle plaani ulatus: spec'i osad 1.2, 2, 3.1–3.2, 6, 7 eraldustestid; etapp 1 spec'i osas 8).

## Global Constraints

- Arendus ja toodang kasutavad **sama andmebaasi** (serveri kaust on sshfs-mountiga kohalikus masinas; `npm run dev` ja `npm test` jooksevad serveris sama `.env`-iga). Iga `prisma db push` mõjutab kohe live'i. Enne iga skeemimuudatust: `pg_dump` varukoopia (vt Task 1).
- Käsud käivitatakse serveris: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`. Kohalikus Macis `npm`/`npx` ei tööta (Linuxi `node_modules`).
- Tabelite omanik on roll `teris` (mitte superkasutaja, ei saa rolle luua). Rollide loomine: `sudo -u postgres psql -d <andmebaas>`.
- Olemasoleva ettevõtte ID on fikseeritud: `tenant-loisu-agro`. Esimene operaator: olemasolev `RelatedParty`, mille `name = 'Loisu Agro OÜ'` ja roll `OPERATOR`.
- Ettevõttepõhised mudelid (25): `Season, CadastralParcel, Field, FieldSeason, RelatedParty, FieldCadastralParcel, PointOfInterest, Vehicle, Implement, TelemetryDevice, DeviceAssignment, ImplementAssignment, Crop, CropVariety, SoilSample, FieldOperation, FieldOperationProduct, WorkType, Material, WorkTemplate, WorkTemplateItem, FieldWork, WorkEntry, WorkEntryLine, User`. **Ilma** ettevõtteta: `Session, PasswordToken, Tenant`.
- `tenantId` veerg: `tenantId String @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id")`, **ilma** Prisma relatsioonita `Tenant`-ile (relatsioon muudaks olemasolevad `connect`-iga loomised kohustuslikuks `tenant: { connect }` sisendiks). Terviklust tagab RLS `WITH CHECK`.
- Kommentaarid ja kasutajale nähtavad tekstid eesti keeles, nagu ülejäänud koodis. Commit-sõnumid eesti keeles, lõpus `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tootmisse viimine (`npm run release`) ainult Task 10 runbook'i järgi ja kasutaja kinnitusel.

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `prisma/schema.prisma` | `Tenant` mudel, `tenantId` 25 mudelil, ettevõttepõhised unikaalsused, `directUrl` |
| `src/server/requestContext.ts` (uus) | `AsyncLocalStorage` kontekst: kasutajanimi, ettevõte, tehingu lipp; `runAsTenant` |
| `src/server/tenantScope.ts` (uus) | Puhas funktsioon `scopeTenantArgs` + `TENANT_MODELS`; `MissingTenantError` |
| `src/server/db.ts` | Prisma klient laienduste ahelaga (audit → tenant-scope → tenant-rls), `tenantTransaction`, `authPrisma` |
| `src/server/authGate.ts`, `passwordTokens.ts` | Autentimise päringud `authPrisma` kaudu; kontekst saab `tenantId` |
| `src/server/apiHandler.ts`, `fieldWorks.ts` | Unikaalsete võtmete üleviimine; `$transaction` → `tenantTransaction` |
| `src/server/userCli.ts`, `scripts/auth-smoke.mts` | Ettevõtte määramine kasutaja loomisel |
| `scripts/tenancy/01-backfill.mts` (uus) | Loisu Agro OÜ ettevõtte loomine ja `tenantId` täitmine |
| `scripts/tenancy/02-rls.sql` (uus) | RLS poliitikad ja õigused |
| `scripts/tenancy/00-roles.sql` (uus) | Rollid `teris_app`, `teris_platform` (superkasutajana) |
| `src/server/tenantScope.test.ts`, `requestContext.test.ts`, `tenantIsolation.test.ts` (uued) | Testid |

---

### Task 1: Varukoopia, andmebaasi rollid ja ühendused

**Files:**
- Create: `scripts/tenancy/00-roles.sql`
- Modify: `prisma/schema.prisma:4-7` (datasource)
- Modify: serveri `.env` (ei ole git'is)

**Interfaces:**
- Produces: keskkonnamuutujad `DATABASE_URL` (roll `teris_app`), `MIGRATE_DATABASE_URL` (roll `teris`, omanik), `PLATFORM_DATABASE_URL` (roll `teris_platform`, `BYPASSRLS`).

- [ ] **Step 1: Varukoopia**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && mkdir -p ~/backups && pg_dump -Fc -f ~/backups/teris-$(date +%F-%H%M)-enne-tenant.dump && ls -la ~/backups | tail -3'
```
Expected: uus `.dump` fail suurusega > 0.

- [ ] **Step 2: Kirjuta rollide skript**

`scripts/tenancy/00-roles.sql`:
```sql
-- Käivitatakse superkasutajana: sudo -u postgres psql -d <PGDATABASE> -v app_pw="'...'" -v platform_pw="'...'" -f 00-roles.sql
-- teris_app: rakendus; ei ole tabelite omanik, RLS kehtib.
-- teris_platform: autentimine ja (etapp 3) teenusepakkuja keskkond; BYPASSRLS.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'teris_app') THEN CREATE ROLE teris_app LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'teris_platform') THEN CREATE ROLE teris_platform LOGIN BYPASSRLS; END IF;
END $$;
ALTER ROLE teris_app PASSWORD :app_pw;
ALTER ROLE teris_platform PASSWORD :platform_pw;
SELECT format('GRANT CONNECT ON DATABASE %I TO teris_app, teris_platform', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO teris_app, teris_platform;
-- Tabelite õigused antakse Task 7 skriptis (02-rls.sql), kui tabelid on lõplikud.
```

- [ ] **Step 3: Käivita superkasutajana (kasutaja kinnitusel — vajab sudo't)**

```bash
ssh -t debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && APP_PW=$(openssl rand -hex 24) && PLATFORM_PW=$(openssl rand -hex 24) && sudo -u postgres psql -d "$PGDATABASE" -v app_pw="'"'"'$APP_PW'"'"'" -v platform_pw="'"'"'$PLATFORM_PW'"'"'" -f scripts/tenancy/00-roles.sql && echo "APP_PW=$APP_PW" && echo "PLATFORM_PW=$PLATFORM_PW"'
```
Expected: `DO`, `ALTER ROLE` ×2, `GRANT` ×2; prinditud paroolid (salvesta Step 4 jaoks, ära pane git'i).

- [ ] **Step 4: Uuenda `.env` serveris**

Lisa (praegune `DATABASE_URL` väärtus liigub `MIGRATE_DATABASE_URL`-iks, host/port/andmebaas samad):
```
MIGRATE_DATABASE_URL=<praegune DATABASE_URL väärtus, roll teris>
PLATFORM_DATABASE_URL=postgresql://teris_platform:<PLATFORM_PW>@<host>:<port>/<andmebaas>
```
`DATABASE_URL` jääb **esialgu rolliks `teris`** — `teris_app`-ile lülitutakse Task 7-s, kui RLS on paigas.

- [ ] **Step 5: `directUrl` Prisma skeemi**

`prisma/schema.prisma` datasource:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("MIGRATE_DATABASE_URL") // db push ja skeemimuudatused tabelite omaniku rolliga
}
```

- [ ] **Step 6: Kontrolli**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx prisma validate && set -a && . ./.env && set +a && psql "$PLATFORM_DATABASE_URL" -Atc "select current_user, rolbypassrls from pg_roles where rolname=current_user"'
```
Expected: `The schema at prisma/schema.prisma is valid`, `teris_platform|t`.

- [ ] **Step 7: Commit**

```bash
git add scripts/tenancy/00-roles.sql prisma/schema.prisma
git commit -m "Ettevõtete eraldus: andmebaasi rollid teris_app/teris_platform ja directUrl"
```

---

### Task 2: Päringu kontekst ettevõttega

**Files:**
- Create: `src/server/requestContext.ts`
- Create: `src/server/requestContext.test.ts`
- Modify: `src/server/db.ts:1-25` (kontekst liigub uude faili; `db.ts` ekspordib edasi)

**Interfaces:**
- Produces:
  - `runInRequestContext<T>(fn: () => Promise<T>): Promise<T>` — tühi kontekst (asendab `runInAuditContext`)
  - `setRequestUser(user: { username: string; tenantId: string } | null): void` (asendab `setAuditUser`)
  - `runAsTenant<T>(tenantId: string, fn: () => Promise<T>, username?: string | null): Promise<T>` — skriptid ja testid
  - `currentUsername(): string | null`, `currentTenantId(): string | null`
  - `requireTenantId(): string` — viskab `MissingTenantError`, kui ettevõtet pole
  - `isInTenantTransaction(): boolean`, `runInTenantTransactionFlag<T>(fn: () => Promise<T>): Promise<T>`
  - `class MissingTenantError extends Error`

- [ ] **Step 1: Kirjuta failiv test**

`src/server/requestContext.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  runInRequestContext, setRequestUser, runAsTenant, currentUsername, currentTenantId,
  requireTenantId, MissingTenantError, isInTenantTransaction, runInTenantTransactionFlag
} from './requestContext';

describe('requestContext', () => {
  it('on väljaspool konteksti tühi', () => {
    expect(currentUsername()).toBeNull();
    expect(currentTenantId()).toBeNull();
    expect(() => requireTenantId()).toThrow(MissingTenantError);
  });

  it('setRequestUser määrab kasutaja ja ettevõtte päringu kontekstis', async () => {
    await runInRequestContext(async () => {
      expect(currentTenantId()).toBeNull();
      setRequestUser({ username: 'mari', tenantId: 't1' });
      expect(currentUsername()).toBe('mari');
      expect(requireTenantId()).toBe('t1');
    });
    expect(currentTenantId()).toBeNull();
  });

  it('runAsTenant ei leki paralleelsetesse kontekstidesse', async () => {
    const seen = await Promise.all([
      runAsTenant('a', async () => { await new Promise((r) => setTimeout(r, 5)); return currentTenantId(); }),
      runAsTenant('b', async () => currentTenantId())
    ]);
    expect(seen).toEqual(['a', 'b']);
  });

  it('tehingu lipp kehtib ainult oma haru sees', async () => {
    await runAsTenant('a', async () => {
      expect(isInTenantTransaction()).toBe(false);
      await runInTenantTransactionFlag(async () => {
        expect(isInTenantTransaction()).toBe(true);
        expect(currentTenantId()).toBe('a');
      });
      expect(isInTenantTransaction()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/server/requestContext.test.ts`
Expected: FAIL — `Cannot find module './requestContext'`.

- [ ] **Step 3: Implementeeri**

`src/server/requestContext.ts`:
```ts
// src/server/requestContext.ts
// Päringu kontekst: kelle nimel (kasutajanimi → createdBy/updatedBy) ja millise ettevõtte
// andmetega päring töötab. API päring töödeldakse runInRequestContext() sees ja kasutaja
// määratakse pärast autentimist setRequestUser()-iga; skriptid ja testid kasutavad runAsTenant().
import { AsyncLocalStorage } from 'async_hooks';

type Store = { username: string | null; tenantId: string | null; inTenantTx: boolean };
const storage = new AsyncLocalStorage<Store>();

export class MissingTenantError extends Error {
  constructor() {
    super('Ettevõtte kontekst puudub — ettevõtte andmeid ei saa ilma selleta pärida');
    this.name = 'MissingTenantError';
  }
}

export function runInRequestContext<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ username: null, tenantId: null, inTenantTx: false }, fn);
}

export function setRequestUser(user: { username: string; tenantId: string } | null): void {
  const store = storage.getStore();
  if (!store) return;
  store.username = user?.username ?? null;
  store.tenantId = user?.tenantId ?? null;
}

export function runAsTenant<T>(tenantId: string, fn: () => Promise<T>, username: string | null = null): Promise<T> {
  return storage.run({ username, tenantId, inTenantTx: false }, fn);
}

export const currentUsername = (): string | null => storage.getStore()?.username ?? null;
export const currentTenantId = (): string | null => storage.getStore()?.tenantId ?? null;

export function requireTenantId(): string {
  const id = currentTenantId();
  if (!id) throw new MissingTenantError();
  return id;
}

export const isInTenantTransaction = (): boolean => storage.getStore()?.inTenantTx ?? false;

// Interaktiivse tehingu sees on app.tenant_id juba seatud — üksikpäringuid ei mähita uuesti.
export function runInTenantTransactionFlag<T>(fn: () => Promise<T>): Promise<T> {
  const store = storage.getStore();
  return storage.run({ username: store?.username ?? null, tenantId: store?.tenantId ?? null, inTenantTx: true }, fn);
}
```

`src/server/db.ts`: eemalda read 4–25 (`AsyncLocalStorage`, `auditContext`, `runInAuditContext`, `setAuditUser`, `currentUsername`) ja lisa faili algusse:
```ts
import { currentUsername } from './requestContext.ts';
export { runInRequestContext, setRequestUser, runAsTenant, currentUsername, currentTenantId, requireTenantId } from './requestContext.ts';
```

`src/server/apiHandler.ts:3`, `:343`, `:353`:
```ts
import { prisma, tsdb, runInRequestContext, setRequestUser, canDelete, DELETE_FORBIDDEN_MESSAGE } from './db.ts';

// Task 5 asendab sessiooni kasutaja ettevõttega ja eemaldab selle konstandi
const TEMP_SINGLE_TENANT_ID = 'tenant-loisu-agro';
// ...
  return runInRequestContext(() => routeApiRequest(req, res, options));
// ...
    const sessionUser = sessionUserOf(req);
    setRequestUser(sessionUser ? { username: sessionUser.username, tenantId: TEMP_SINGLE_TENANT_ID } : null);
```
(`SessionUser.tenantId` lisandub alles Task 5-s, seepärast ajutine konstant.)

- [ ] **Step 4: Testid**

Run: `npx vitest run src/server/requestContext.test.ts && npx tsc --noEmit -p tsconfig.app.json`
Expected: 4 testi PASS; tüübikontroll ilma vigadeta.

- [ ] **Step 5: Commit**

```bash
git add src/server/requestContext.ts src/server/requestContext.test.ts src/server/db.ts src/server/apiHandler.ts
git commit -m "Päringu kontekst kannab ettevõtte ID-d (requestContext.ts)"
```

---

### Task 3: `Tenant` mudel, lubav `tenantId` ja andmete täitmine

**Files:**
- Modify: `prisma/schema.prisma` (uus `Tenant`; 25 mudelile `tenantId String? @map("tenant_id")`)
- Create: `scripts/tenancy/01-backfill.mts`

**Interfaces:**
- Produces: tabel `tenants` reaga `id = 'tenant-loisu-agro'`; kõigil 25 tabelil `tenant_id` täidetud.

- [ ] **Step 1: Lisa `Tenant` mudel** (faili lõppu, kasutajate järele)

```prisma
// ============================================================================
// ETTEVÕTTED (TENANTS)
// ============================================================================
enum TenantStatus {
  ACTIVE
  SUSPENDED
}

model Tenant {
  id             String       @id @default(cuid())
  name           String
  registryCode   String?
  status         TenantStatus @default(ACTIVE)
  primaryPartyId String? // Ettevõte ise seotud isikute registris (roll OPERATOR) — tema keskkonnas
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@map("tenants")
}
```

- [ ] **Step 2: Lisa 25 mudelile lubav veerg**

Igasse Global Constraints'is loetletud mudelisse vahetult `id` välja järele:
```prisma
  tenantId String? @map("tenant_id") // Ettevõte (Task 6 muudab kohustuslikuks)
```

- [ ] **Step 3: Varukoopia ja `db push`**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -f ~/backups/teris-$(date +%F-%H%M)-task3.dump && npx prisma db push && npx prisma generate'
```
Expected: `Your database is now in sync with your Prisma schema.` Lisatakse ainult veerud ja tabel — `db push` ei tohi küsida andmekao kinnitust; kui küsib, katkesta.

- [ ] **Step 4: Kirjuta täitmisskript**

`scripts/tenancy/01-backfill.mts`:
```ts
// scripts/tenancy/01-backfill.mts — loob olemasolevate andmete ettevõtte ja täidab tenant_id.
// Korduvkäivitatav. Käivita serveris: npx tsx scripts/tenancy/01-backfill.mts
import { PrismaClient } from '@prisma/client';

const TENANT_ID = 'tenant-loisu-agro';
const TENANT_NAME = 'Loisu Agro OÜ';
const TABLES = [
  'seasons', 'cadastral_parcels', 'fields', 'field_seasons', 'related_parties', 'field_cadastral_parcels',
  'points_of_interest', 'vehicles', 'implements', 'telemetry_devices', 'device_assignments',
  'implement_assignments', 'crops', 'crop_varieties', 'soil_samples', 'field_operations',
  'field_operation_products', 'work_types', 'materials', 'work_templates', 'work_template_items',
  'field_works', 'work_entries', 'work_entry_lines', 'users'
];

const db = new PrismaClient({ datasources: { db: { url: process.env.MIGRATE_DATABASE_URL } } });

const party = await db.relatedParty.findFirst({
  where: { name: TENANT_NAME, roles: { has: 'OPERATOR' } },
  select: { id: true, code: true }
});
if (!party) throw new Error(`Operaatorit "${TENANT_NAME}" ei leitud`);

await db.tenant.upsert({
  where: { id: TENANT_ID },
  create: { id: TENANT_ID, name: TENANT_NAME, registryCode: party.code, primaryPartyId: party.id },
  update: { primaryPartyId: party.id }
});

await db.$transaction(
  TABLES.map((t) => db.$executeRawUnsafe(`UPDATE "${t}" SET tenant_id = $1 WHERE tenant_id IS NULL`, TENANT_ID))
);

for (const t of TABLES) {
  const [{ n }] = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${t}" WHERE tenant_id IS NULL`);
  if (n !== 0n) throw new Error(`${t}: ${n} rida ilma ettevõtteta`);
}
console.log(`OK: ettevõte ${TENANT_ID}, ${TABLES.length} tabelit täidetud`);
await db.$disconnect();
```

- [ ] **Step 5: Käivita ja kontrolli**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsx scripts/tenancy/01-backfill.mts && npx tsx scripts/tenancy/01-backfill.mts'
```
Expected: kaks korda `OK: ettevõte tenant-loisu-agro, 25 tabelit täidetud` (teine käivitus ei muuda midagi).

- [ ] **Step 6: Kogu testikomplekt ja commit**

Run: `npm test` (serveris). Expected: 143+ testi PASS (käitumine pole muutunud).
```bash
git add prisma/schema.prisma scripts/tenancy/01-backfill.mts
git commit -m "Tenant mudel, tenant_id veerud ja olemasolevate andmete määramine Loisu Agro OÜ-le"
```

---

### Task 4: Rakenduse kihi filter (`tenant-scope` laiendus)

**Files:**
- Create: `src/server/tenantScope.ts`
- Create: `src/server/tenantScope.test.ts`
- Modify: `src/server/db.ts` (laiendus ahelasse)

**Interfaces:**
- Consumes: `currentTenantId()`, `MissingTenantError` (Task 2)
- Produces:
  - `TENANT_MODELS: ReadonlySet<string>` — Prisma mudelid, millel on skalaarväli `tenantId`
  - `scopeTenantArgs(model: string, operation: string, args: Record<string, unknown>, tenantId: string | null): Record<string, unknown>`

- [ ] **Step 1: Kirjuta failiv test**

`src/server/tenantScope.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scopeTenantArgs, TENANT_MODELS } from './tenantScope';
import { MissingTenantError } from './requestContext';

describe('scopeTenantArgs', () => {
  it('tunneb ettevõttepõhised mudelid skeemist', () => {
    expect(TENANT_MODELS.has('Season')).toBe(true);
    expect(TENANT_MODELS.has('User')).toBe(true);
    expect(TENANT_MODELS.has('Session')).toBe(false);
    expect(TENANT_MODELS.has('Tenant')).toBe(false);
    expect(TENANT_MODELS.size).toBe(25);
  });

  it('lisab lugemistele, muutmistele ja kustutamistele where.tenantId', () => {
    for (const op of ['findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count',
      'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']) {
      const out = scopeTenantArgs('Season', op, { where: { year: 2026 } }, 't1');
      expect(out.where).toEqual({ year: 2026, tenantId: 't1' });
    }
  });

  it('lisab where ka siis, kui seda polnud', () => {
    expect(scopeTenantArgs('Crop', 'findMany', {}, 't1').where).toEqual({ tenantId: 't1' });
  });

  it('ei luba kliendil ettevõtet üle kirjutada', () => {
    expect(scopeTenantArgs('Crop', 'findMany', { where: { tenantId: 'muu' } }, 't1').where).toEqual({ tenantId: 't1' });
  });

  it('loomistel jätab andmed muutmata (tenant_id tuleb andmebaasi vaikeväärtusest)', () => {
    const args = { data: { name: 'Kaer' } };
    expect(scopeTenantArgs('Crop', 'create', args, 't1')).toEqual({ data: { name: 'Kaer' } });
  });

  it('ei puuduta ettevõtteta mudeleid ega nõua neil konteksti', () => {
    const args = { where: { tokenHash: 'x' } };
    expect(scopeTenantArgs('Session', 'findUnique', args, null)).toEqual(args);
  });

  it('viskab, kui ettevõttepõhisel mudelil pole konteksti', () => {
    expect(() => scopeTenantArgs('Field', 'findMany', {}, null)).toThrow(MissingTenantError);
    expect(() => scopeTenantArgs('Field', 'create', { data: {} }, null)).toThrow(MissingTenantError);
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/server/tenantScope.test.ts`
Expected: FAIL — `Cannot find module './tenantScope'`.

- [ ] **Step 3: Implementeeri**

`src/server/tenantScope.ts`:
```ts
// src/server/tenantScope.ts
// Rakenduse kihi ettevõtte filter: lisab ettevõttepõhiste mudelite päringutele where.tenantId.
// Loomistel täidab tenant_id andmebaasi vaikeväärtus current_setting('app.tenant_id') — see katab
// ka pesastatud loomised. Teine kaitsekiht on Postgres RLS (scripts/tenancy/02-rls.sql).
import { Prisma } from '@prisma/client';
import { MissingTenantError } from './requestContext.ts';

export const TENANT_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === 'tenantId' && f.kind === 'scalar'))
    .map((m) => m.name)
);

const WHERE_OPERATIONS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'count', 'aggregate',
  'groupBy', 'update', 'updateMany', 'updateManyAndReturn', 'delete', 'deleteMany', 'upsert'
]);

type Args = Record<string, unknown>;

export function scopeTenantArgs(model: string, operation: string, args: Args, tenantId: string | null): Args {
  if (!TENANT_MODELS.has(model)) return args;
  if (!tenantId) throw new MissingTenantError();
  if (!WHERE_OPERATIONS.has(operation)) return args;
  // findUnique/update/delete/upsert lubavad unikaalse võtme kõrval lisatingimusi (Prisma 5+ extendedWhereUnique)
  return { ...args, where: { ...((args.where as Args) ?? {}), tenantId } };
}
```

`src/server/db.ts` — praeguse `audit-user` laienduse järele lisa ahelasse (`new PrismaClient().$extends({...audit...}).$extends({...})`):
```ts
  .$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return query(scopeTenantArgs(model, operation, args as Args, currentTenantId()) as typeof args);
        }
      }
    }
  })
```
koos impordiga `import { scopeTenantArgs } from './tenantScope.ts';` ja `currentTenantId` impordiga `./requestContext.ts`-ist; tüüp `type Args = Record<string, unknown>;` (olemasolev `Data` tüüp sobib samuti — kasuta seda).

- [ ] **Step 4: Testid**

Run: `npx vitest run src/server/tenantScope.test.ts && npx tsc --noEmit -p tsconfig.app.json`
Expected: 7 testi PASS.

Run: `npm test`
Expected: `telemetryHistory.test.ts` kukub `MissingTenantError`-iga (ootuspärane — parandatakse Task 8-s). Kõik muud PASS. **Ära tee sellest taskist release'i.**

- [ ] **Step 5: Commit**

```bash
git add src/server/tenantScope.ts src/server/tenantScope.test.ts src/server/db.ts
git commit -m "Ettevõtte filter Prisma laiendusena (tenant-scope)"
```

---

### Task 5: Autentimine `teris_platform` rolliga ja kasutaja ettevõte kontekstis

**Files:**
- Modify: `src/server/db.ts` (lisa `authPrisma`)
- Modify: `src/server/authGate.ts` (kõik `prisma.` → `authPrisma.`; `DbUser` saab `tenantId`)
- Modify: `src/server/passwordTokens.ts` (kõik `prisma.` → `authPrisma.`)
- Modify: `src/server/apiHandler.ts` (eemalda `TEMP_SINGLE_TENANT_ID`)
- Modify: `src/server/adminUsers.ts:194,196,247,251` (sessioonide/tokenite kustutamine `authPrisma` kaudu — need tabelid pole ettevõttepõhised, aga ühtsuse mõttes jääb `prisma` ka sobivaks; muuda ainult siis, kui `tsc` nõuab)

**Interfaces:**
- Consumes: `PLATFORM_DATABASE_URL` (Task 1)
- Produces: `authPrisma: PrismaClient` (`db.ts`), `SessionUser.tenantId: string`

- [ ] **Step 1: `authPrisma` failis `db.ts`**

```ts
// Autentimine (sisselogimine, sessioon, paroolilingid) toimub enne, kui päringul on ettevõtte
// kontekst. teris_platform roll möödub RLS-ist — kasuta AINULT authGate.ts ja passwordTokens.ts sees.
let authClient: PrismaClient | null = null;
export function authDb(): PrismaClient {
  if (!authClient) {
    const url = process.env.PLATFORM_DATABASE_URL;
    if (!url) throw new Error('PLATFORM_DATABASE_URL puudub');
    authClient = new PrismaClient({ datasources: { db: { url } } });
  }
  return authClient;
}
```
(Funktsioon, mitte konstant: testid, mis impordivad `db.ts`-i ilma andmebaasita, ei tohi kukkuda puuduva muutuja pärast.)

- [ ] **Step 2: authGate.ts ja passwordTokens.ts**

Asenda importides `import { prisma } from './db.ts';` → `import { authDb } from './db.ts';` ja iga `prisma.` → `authDb().` (authGate.ts: `session.findUnique`, `session.updateMany`, `user.updateMany`, `user.findUnique`, `session.deleteMany`, `session.create`, `user.update`, `user.findFirst`, `passwordToken.deleteMany`; passwordTokens.ts: kõik, sh `$transaction`).

`authGate.ts` `DbUser` tüüpi lisa `tenantId: string;`. `toAuthUser` jääb samaks (ettevõtte info `/api/auth/me` vastusesse lisandub etapis 2).

`handleLogin`: pärast parooli kontrolli ja enne sessiooni loomist kontrolli ettevõtte staatust:
```ts
  const tenant = await authDb().tenant.findUnique({ where: { id: user.tenantId }, select: { status: true } });
  if (tenant?.status !== 'ACTIVE') {
    keys.forEach((k) => limiter.registerFailure(k));
    json(res, { error: 'Vale kasutajanimi või parool' }, 401);
    return;
  }
```
`currentSession` jääb muutmata (`include: { user: true }`). Ettevõtte peatamisel kustutab etapp 3 selle ettevõtte sessioonid, nii et iga päringu juures staatust kontrollida pole vaja. Selles etapis peatamist veel ei ole.

NB: `User.tenantId` on selles etapis veel `String?` (Task 6 muudab kohustuslikuks) — kuni selleni kasuta `user.tenantId!` ainult `handleLogin`-is; Task 6 eemaldab `!`.

- [ ] **Step 3: apiHandler.ts kontekst**

Eemalda `TEMP_SINGLE_TENANT_ID` ja kasuta:
```ts
    const sessionUser = sessionUserOf(req);
    setRequestUser(sessionUser ? { username: sessionUser.username, tenantId: sessionUser.tenantId } : null);
```

- [ ] **Step 4: Kontrolli**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/auth.test.ts src/server/passwordTokens.test.ts src/server/requestContext.test.ts src/server/tenantScope.test.ts`
Expected: PASS.

Käivita arendusserver ja logi sisse (kasutaja kinnitusel, sama andmebaas): `npm run dev` serveris + SSH tunnel (`ssh -L 5173:127.0.0.1:5173 uvn-243-120.tll07.zonevs.eu`), ava `http://localhost:5173`, logi sisse, ava põldude kaart ja tööde tahvel. Expected: andmed paistavad nagu enne.

- [ ] **Step 5: Commit**

```bash
git add src/server/db.ts src/server/authGate.ts src/server/passwordTokens.ts src/server/apiHandler.ts src/server/adminUsers.ts
git commit -m "Autentimine teris_platform rolliga, sessiooni kasutaja ettevõte päringu konteksti"
```

---

### Task 6: Kohustuslik `tenantId` ja ettevõttepõhised unikaalsused

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/server/apiHandler.ts:169,413,568,1571` ja `src/server/fieldWorks.ts:944,988,1334,1430`
- Modify: `src/server/authGate.ts` (eemalda `user.tenantId!` hüüumärk)

**Interfaces:**
- Consumes: `requireTenantId()` (Task 2)
- Produces: Prisma unikaalvõtmed `tenantId_year`, `tenantId_cadastralCode`, `tenantId_name` (Crop, WorkType), `tenantId_sampleNumber`, `tenantId_category_name`, `tenantId_cropId_isWinter`, `tenantId_fieldCode_num_operatorId`

- [ ] **Step 1: Skeem**

25 mudelil asenda Task 3 rida:
```prisma
  tenantId String @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
```
ja lisa igale neist `@@index([tenantId])`.

Unikaalsused (eemalda välja `@unique` ja lisa mudeli lõppu):

| Mudel | Eemalda | Lisa |
|---|---|---|
| `Season` | `year Int @unique` → `year Int` | `@@unique([tenantId, year])` |
| `CadastralParcel` | `cadastralCode String @unique` → `String` | `@@unique([tenantId, cadastralCode])` |
| `Field` | `@@unique([fieldCode, num, operatorId])` | `@@unique([tenantId, fieldCode, num, operatorId])` |
| `Crop` | `name String @unique` → `String` | `@@unique([tenantId, name])` |
| `SoilSample` | `sampleNumber String @unique` → `String` | `@@unique([tenantId, sampleNumber])` |
| `WorkType` | `name String @unique` → `String` | `@@unique([tenantId, name])` |
| `Material` | `@@unique([category, name])` | `@@unique([tenantId, category, name])` |
| `WorkTemplate` | `@@unique([cropId, isWinter])` | `@@unique([tenantId, cropId, isWinter])` |

`User.username`, `User.email`, `TelemetryDevice.imei`, `TelemetryDevice.macAddress`, `Vehicle.assignedImplementId`, `Vehicle.assignedDeviceId`, `Implement.assignedDeviceId` jäävad globaalselt unikaalseks.

- [ ] **Step 2: Kutsekohad**

`npx prisma generate` ja seejärel `npx tsc --noEmit -p tsconfig.app.json` — kompilaator näitab iga koha, kus vana unikaalvõti enam ei kehti. Teadaolevad kohad ja uus kuju:

```ts
// apiHandler.ts:169
where: { tenantId_cadastralCode: { tenantId: requireTenantId(), cadastralCode } },
// apiHandler.ts:413 (seasons upsert)
where: { tenantId_year: { tenantId: requireTenantId(), year: Number(body.year) } },
// apiHandler.ts:568
const season = await prisma.season.findUnique({ where: { tenantId_year: { tenantId: requireTenantId(), year: Number(h.year) } } });
// apiHandler.ts:1571 (soil samples)
where: { tenantId_sampleNumber: { tenantId: requireTenantId(), sampleNumber: s.sampleNumber } },
// fieldWorks.ts:944, 988, 1334, 1430 (season.findUnique / update year järgi)
where: { tenantId_year: { tenantId: requireTenantId(), year } },          // 944, 1430
where: { tenantId_year: { tenantId: requireTenantId(), year: year + 1 } }, // 988, 1334
```
`requireTenantId` impordi `./db.ts`-ist. Kui `tsc` näitab lisaks muid kohti (nt `crop.findUnique({ where: { name } })`, `workType...{ name }`, `material...category_name`, `workTemplate...cropId_isWinter`, `field...fieldCode_num_operatorId`), muuda need sama mustri järgi.

- [ ] **Step 3: Varukoopia ja `db push`**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -f ~/backups/teris-$(date +%F-%H%M)-task6.dump && npx prisma db push && npx prisma generate'
```
Expected: sünkroonis. Kui `db push` hoiatab andmekaost (ei tohiks — ainult NOT NULL + indeksid), katkesta ja uuri.

**NB live-mõju:** pärast seda sammu kukub **käimasoleva** toodanguserveri (vana build) iga loomine (`current_setting('app.tenant_id')` puudub). Tee Task 6 → Task 7 → Task 8 järjest ja release kohe pärast (Task 10). Kui vaja paus teha, taasta vaikeväärtus ajutiselt: `ALTER TABLE ... ALTER COLUMN tenant_id SET DEFAULT 'tenant-loisu-agro'` (ära commit'i).

- [ ] **Step 4: Kontrolli**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/tenantScope.test.ts src/server/requestContext.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/server/apiHandler.ts src/server/fieldWorks.ts src/server/authGate.ts
git commit -m "tenant_id kohustuslik (vaikeväärtus päringu kontekstist), unikaalsused ettevõttepõhiseks"
```

---

### Task 7: Postgres RLS ja tehingupõhine `app.tenant_id`

**Files:**
- Create: `scripts/tenancy/02-rls.sql`
- Modify: `src/server/db.ts` (laiendus `tenant-rls`, `tenantTransaction`)
- Modify: `src/server/apiHandler.ts:1621`, `src/server/fieldWorks.ts:122,899,1285,1404` (`prisma.$transaction(async` → `tenantTransaction(async`)
- Modify: serveri `.env` (`DATABASE_URL` → `teris_app`)

**Interfaces:**
- Consumes: `isInTenantTransaction`, `runInTenantTransactionFlag`, `requireTenantId` (Task 2); `TENANT_MODELS` (Task 4)
- Produces: `tenantTransaction<T>(fn: (tx: TxClient) => Promise<T>, options?: { timeout?: number; maxWait?: number }): Promise<T>`

- [ ] **Step 1: RLS skript**

`scripts/tenancy/02-rls.sql`:
```sql
-- Käivita tabelite omanikuna: psql "$MIGRATE_DATABASE_URL" -f scripts/tenancy/02-rls.sql
-- Korduvkäivitatav. Prisma db push ei halda poliitikaid ega muuda neid.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'seasons','cadastral_parcels','fields','field_seasons','related_parties','field_cadastral_parcels',
    'points_of_interest','vehicles','implements','telemetry_devices','device_assignments',
    'implement_assignments','crops','crop_varieties','soil_samples','field_operations',
    'field_operation_products','work_types','materials','work_templates','work_template_items',
    'field_works','work_entries','work_entry_lines','users'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) '
      'WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO teris_app, teris_platform;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO teris_app, teris_platform;
ALTER DEFAULT PRIVILEGES FOR ROLE teris IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO teris_app, teris_platform;
ALTER DEFAULT PRIVILEGES FOR ROLE teris IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO teris_app, teris_platform;
```

- [ ] **Step 2: Laiendus ja `tenantTransaction` failis `db.ts`**

Ahela viimaseks (pärast `tenant-scope`) — `base` on laiendamata `new PrismaClient()`, mida ahel ümbritseb (salvesta see eraldi konstandiks):
```ts
const base = new PrismaClient();
const setTenant = (tenantId: string) => base.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

export const prisma = base
  .$extends({ name: 'audit-user', /* olemasolev */ })
  .$extends({ name: 'tenant-scope', /* Task 4 */ })
  .$extends({
    name: 'tenant-rls',
    query: {
      $allModels: {
        // Iga ettevõttepõhine päring käib tehingus, mille esimene lause seab app.tenant_id (RLS).
        // Interaktiivse tehingu (tenantTransaction) sees on see juba seatud.
        async $allOperations({ model, args, query }) {
          if (!TENANT_MODELS.has(model) || isInTenantTransaction()) return query(args);
          const [, result] = await base.$transaction([setTenant(requireTenantId()), query(args)]);
          return result;
        }
      }
    }
  });

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Interaktiivne tehing ettevõtte kontekstis — kasuta prisma.$transaction(async ...) asemel. */
export function tenantTransaction<T>(fn: (tx: TxClient) => Promise<T>, options?: { timeout?: number; maxWait?: number }): Promise<T> {
  const tenantId = requireTenantId();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return runInTenantTransactionFlag(() => fn(tx));
  }, options);
}
```

- [ ] **Step 3: Asenda interaktiivsed tehingud**

`apiHandler.ts:1621`, `fieldWorks.ts:122`, `:899`, `:1285`, `:1404`: `prisma.$transaction(async (tx) => {...}, opts?)` → `tenantTransaction(async (tx) => {...}, opts?)`; impordi `tenantTransaction` `./db.ts`-ist. `passwordTokens.ts:40` jääb `authDb().$transaction` (Task 5).

Kontroll: `grep -nF 'prisma.$transaction' src/server/*.ts | grep -v test` → tühi.

- [ ] **Step 4: Rakenda RLS ja lülita rakendus `teris_app` rollile**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -f ~/backups/teris-$(date +%F-%H%M)-task7.dump && psql "$MIGRATE_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tenancy/02-rls.sql && psql "$MIGRATE_DATABASE_URL" -Atc "select count(*) from pg_policies where policyname = '"'"'tenant_isolation'"'"'"'
```
Expected: `25`.

Serveri `.env`: `DATABASE_URL=postgresql://teris_app:<APP_PW>@<host>:<port>/<andmebaas>`.

- [ ] **Step 5: Kontrolli, et `db push` ei puutu poliitikaid**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx prisma db push && set -a && . ./.env && set +a && psql "$MIGRATE_DATABASE_URL" -Atc "select count(*) from pg_policies where policyname = '"'"'tenant_isolation'"'"'"'
```
Expected: `already in sync`, `25`.

- [ ] **Step 6: Commit**

```bash
git add scripts/tenancy/02-rls.sql src/server/db.ts src/server/apiHandler.ts src/server/fieldWorks.ts
git commit -m "Postgres RLS ettevõtte eralduseks, päringud tehingus app.tenant_id-ga, tenantTransaction"
```

---

### Task 8: Eraldustestid ja olemasolevate testide kontekst

**Files:**
- Create: `src/server/tenantIsolation.test.ts`
- Modify: `src/server/telemetryHistory.test.ts`

**Interfaces:**
- Consumes: `prisma`, `authDb`, `runAsTenant`, `tenantTransaction` (`db.ts`), `TENANT_MODELS` (`tenantScope.ts`)

- [ ] **Step 1: Olemasolev live-andmete test ettevõtte konteksti**

`telemetryHistory.test.ts`: iga `it(..., async () => { ... })` keha mähi `runAsTenant(LOISU, async () => { ... })` sisse:
```ts
import { prisma, tsdb, runAsTenant } from './db';
const LOISU = 'tenant-loisu-agro';
// ...
  it('loads vehicle lastKnownPosition from db', () => runAsTenant(LOISU, async () => {
    // senine keha muutmata
  }));
```
(Funktsioon `findRealClaasEntryId` kutsutakse testide sees, seega pärib konteksti.)

Run: `npx vitest run src/server/telemetryHistory.test.ts` → Expected: 9 PASS.

- [ ] **Step 2: Kirjuta eraldustestid**

`src/server/tenantIsolation.test.ts`:
```ts
// Ettevõtete eraldus: kaks ajutist ettevõtet (A, B) live-andmebaasis; kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { TENANT_MODELS } from './tenantScope';
import { MissingTenantError } from './requestContext';

const A = `test-tenant-a-${process.pid}`;
const B = `test-tenant-b-${process.pid}`;
const LOISU = 'tenant-loisu-agro';
const tableOf = (model: string) => Prisma.dmmf.datamodel.models.find((m) => m.name === model)!.dbName!;
let bCropId = '';

beforeAll(async () => {
  await authDb().tenant.createMany({ data: [{ id: A, name: 'Test A' }, { id: B, name: 'Test B' }] });
  bCropId = await runAsTenant(B, async () => (await prisma.crop.create({ data: { id: `crop-${B}`, name: 'B kaer' } })).id);
  await runAsTenant(A, () => prisma.crop.create({ data: { id: `crop-${A}`, name: 'A kaer' } }));
});

afterAll(async () => {
  for (const t of [A, B]) await runAsTenant(t, () => prisma.crop.deleteMany({}));
  await authDb().tenant.deleteMany({ where: { id: { in: [A, B] } } });
});

describe('ettevõtete eraldus', () => {
  it('uus ettevõte näeb kõiki ettevõttepõhiseid tabeleid tühjana (RLS, toorpäring)', async () => {
    await runAsTenant(A, () => tenantTransaction(async (tx) => {
      for (const model of TENANT_MODELS) {
        const [{ n }] = await tx.$queryRawUnsafe<{ n: bigint }[]>(
          `SELECT count(*) AS n FROM "${tableOf(model)}" WHERE tenant_id <> $1`, A);
        expect(n, model).toBe(0n);
      }
    }));
  });

  it('Loisu Agro näeb oma andmeid', async () => {
    await runAsTenant(LOISU, async () => {
      expect(await prisma.field.count()).toBeGreaterThan(0);
      expect(await prisma.crop.count({ where: { id: bCropId } })).toBe(0);
    });
  });

  it('A ei leia B kirjet ka ID järgi', async () => {
    await runAsTenant(A, async () => {
      expect(await prisma.crop.findUnique({ where: { id: bCropId } })).toBeNull();
      expect(await prisma.crop.findMany()).toHaveLength(1);
    });
  });

  it('A ei saa B kirjet muuta ega kustutada', async () => {
    await runAsTenant(A, async () => {
      expect((await prisma.crop.updateMany({ where: { id: bCropId }, data: { name: 'häkitud' } })).count).toBe(0);
      expect((await prisma.crop.deleteMany({ where: { id: bCropId } })).count).toBe(0);
      await expect(prisma.crop.update({ where: { id: bCropId }, data: { name: 'häkitud' } })).rejects.toThrow();
    });
    const b = await runAsTenant(B, () => prisma.crop.findUnique({ where: { id: bCropId } }));
    expect(b?.name).toBe('B kaer');
  });

  it('RLS keelab kirjutada teise ettevõtte ID-ga ka toorpäringuga', async () => {
    await runAsTenant(A, () => expect(tenantTransaction((tx) =>
      tx.$executeRawUnsafe(`INSERT INTO crops (id, name, tenant_id, updated_at) VALUES ('x-${A}', 'x', $1, now())`, B)
    )).rejects.toThrow(/row-level security/));
  });

  it('pesastatud loomine saab ettevõtte andmebaasi vaikeväärtusest', async () => {
    await runAsTenant(A, async () => {
      const crop = await prisma.crop.create({
        data: { id: `nested-${A}`, name: 'Pesastatud', varieties: { create: [{ name: 'Sort 1' }] } },
        include: { varieties: true }
      });
      const raw = await tenantTransaction((tx) => tx.$queryRawUnsafe<{ tenant_id: string }[]>(
        'SELECT tenant_id FROM crop_varieties WHERE crop_id = $1', crop.id));
      expect(raw.map((r) => r.tenant_id)).toEqual([A]);
      await prisma.cropVariety.deleteMany({ where: { cropId: crop.id } });
    });
  });

  it('ilma ettevõtteta päring viskab', async () => {
    await expect(prisma.field.findMany()).rejects.toThrow(MissingTenantError);
  });
});
```
NB: `crops` tabeli veerunimed (`updated_at`, `crop_id`) kontrolli `prisma/schema.prisma` `@map`-ide järgi; kui veerg on kaardistamata, kasuta Prisma välja nime jutumärkides (nt `"updatedAt"`, `"cropId"`).

- [ ] **Step 3: Käivita**

Run: `npx vitest run src/server/tenantIsolation.test.ts`
Expected: 7 PASS. Kui „uus ettevõte näeb tühjana“ kukub mõne mudeli peal, on sellel tabelil RLS puudu — kontrolli `02-rls.sql` nimekirja.

- [ ] **Step 4: Kogu komplekt**

Run: `npm test`
Expected: kõik PASS (sh `telemetryHistory`, `tenantIsolation`).

- [ ] **Step 5: Commit**

```bash
git add src/server/tenantIsolation.test.ts src/server/telemetryHistory.test.ts
git commit -m "Ettevõtete eralduse testid (RLS + rakenduse filter), live-andmete testid Loisu Agro kontekstis"
```

---

### Task 9: Käsurea kasutajahaldus ja smoke-test ettevõttega

**Files:**
- Modify: `src/server/userCli.ts`
- Modify: `scripts/auth-smoke.mts`

**Interfaces:**
- Consumes: `authDb()` (Task 5)

- [ ] **Step 1: userCli `--tenant` valik**

`userCli.ts`: `import { prisma } from './db'` → `import { authDb } from './db'`; `const prisma = authDb();` faili ülaosas (ülejäänud kood jääb). `add` käsu jaoks:
```ts
async function resolveTenantId(rest: string[]): Promise<string> {
  const idx = rest.indexOf('--tenant');
  if (idx >= 0 && rest[idx + 1]) return rest[idx + 1];
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  if (tenants.length === 1) return tenants[0].id;
  throw new Error('Mitu ettevõtet — anna --tenant <id>');
}
```
ja `user.create` `data`-sse `tenantId: await resolveTenantId(rest)`. Kasutusrida faili alguses: `[--tenant <id>]`. `list` käsk prindib lisaks ettevõtte ID.

- [ ] **Step 2: auth-smoke**

`scripts/auth-smoke.mts`: `const prisma = new PrismaClient();` → `new PrismaClient({ datasources: { db: { url: process.env.PLATFORM_DATABASE_URL } } })`; testkasutajate loomisel lisa `tenantId: 'tenant-loisu-agro'`.

- [ ] **Step 3: Kontrolli**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npm run build:server && npm run user -- list | head -5'
```
Expected: kasutajate nimekiri koos `tenant-loisu-agro`-ga.

- [ ] **Step 4: Commit**

```bash
git add src/server/userCli.ts scripts/auth-smoke.mts
git commit -m "Käsurea kasutajahaldus ja smoke-test ettevõtte kontekstiga"
```

---

### Task 10: Tootmisse viimine (kasutaja kinnitusel)

Task 6–9 skeemi- ja `.env` muudatused on live-andmebaasis juba tehtud; käimasolev vana build ei oska ettevõtte konteksti seada. See task taastab live'i uue koodiga.

- [ ] **Step 1: Lõplik kontroll**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx prisma generate && npm run release'
```
Expected: tüübikontroll OK, kõik testid PASS, build OK, `systemctl restart teris`.

- [ ] **Step 2: Live'i kontroll**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'systemctl is-active teris && journalctl -u teris -n 30 --no-pager | grep -iE "error|tenant|row-level" ; cd /home/debian/teris && BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts | tail -5'
```
Expected: `active`, logis vigu pole, smoke-test „OK“ ridadega.

Käsitsi: logi sisse aadressil https://teris.ee, kontrolli kaarti, tööde tahvlit, tööde kande lisamist ja kustutamist, hooaegade halduse avamist.

- [ ] **Step 3: Tagasipööramine (ainult vea korral)**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && sudo systemctl stop teris && pg_restore --clean --if-exists -d "$MIGRATE_DATABASE_URL" ~/backups/<teris-...-enne-tenant.dump> && git checkout <commit enne Task 1> -- . && <taasta .env DATABASE_URL rollile teris> && npm run build && sudo systemctl start teris'
```

- [ ] **Step 4: Commit ja push**

```bash
git push
```

---

## Väljas sellest etapist (tulevad hilisemates plaanides)

- Litsentsid, moodulid, ainult lugemise režiim (etapp 2).
- Teenusepakkuja keskkond, uue ettevõtte loomine, algkataloog, `Crop.id` genereerimine kopeerimisel (etapp 3).
- `DeviceOwnership`, IMEI registreerimine, TimescaleDB päringute piiramine (etapp 4). **Kuni selleni näeb iga ettevõte telemeetriat IMEI järgi** — etapp 1 ei tohi minna päris teise ettevõtte kasutusse enne etappi 4.
- Tugiligipääs (etapp 5).
- Teadaolev piirang: välisvõtmed ei sisalda `tenant_id`-d, seega saab teoreetiliselt viidata teise ettevõtte rea ID-le (RLS peidab viidatud rea; andmeid ei leki). Komposiit-välisvõtmed (`tenant_id, id`) on eraldi otsus.
