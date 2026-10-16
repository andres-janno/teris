# Mitme ettevõtte tugi, etapp 3a: karmistus enne teist ettevõtet — implementeerimisplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sulgeda etappide 1–2 plaanides „enne etappi 3“ märgitud lüngad, et teise ettevõtte lisamine (etapp 3b) oleks turvaline: rakenduse roll ei näe platvormi tabeleid, peatatud ettevõtte sessioonid ei kehti, ettevõtteülesed viited on andmebaasis keelatud ning muutmise/kustutamise eraldus on testitud iga mudeli kohta.

**Architecture:** Platvormi tabelid (`tenants`, `tenant_licenses`, `sessions`, `password_tokens`) muutuvad `teris_app` rollile kättesaamatuks; kõik nende päringud käivad `authDb()` kaudu. Ettevõtteüleste välisvõtmete vastu on üks üldine PL/pgSQL trigerifunktsioon, mille skript genereerib Prisma DMMF-ist iga ettevõttesisese relatsiooni jaoks (Prisma `db push` trigereid ei puuduta). Väiksemad parandused: GET ei kirjuta aegunud litsentsiga, ettevõtte nimi menüüs, riba tumedas teemas.

**Tech Stack:** Node 22, TypeScript 6, Prisma 6.19, PostgreSQL 17 (RLS), React 19, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-15-mitme-ettevotte-tugi-design.md`; lüngad: `docs/superpowers/plans/2026-10-15-mitme-ettevotte-tugi-etapp-1.md` („Enne teise päris ettevõtte lisamist“) ja `...-etapp-2.md` („Enne etappi 3 / hiljem“).

## Global Constraints

- Arendus ja toodang kasutavad **sama andmebaasi**; käsud serveris: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`. Kohalikus Macis `npm`/`npx` ei tööta. Git kohalikult.
- **`npm run build` ainult release'i ajal** — live-kaustas ehitamine muudab kohe seda, mida töötav server serveerib. Kontrolliks `npx tsc --noEmit -p tsconfig.app.json` ja `npm test`.
- Rollid: `teris_app` (rakendus, RLS), `teris_platform` (`authDb()`, BYPASSRLS), `teris` (omanik; PG* muutujad). `.env` URL-id lõpevad `?schema=public` — psql-iga kasuta PG* muutujaid või `${VAR%%\?*}`. Saladusi ei trükita.
- Varukoopia enne andmebaasi muudatust **`teris_platform` rolliga** (omaniku `pg_dump` kukub FORCE RLS-i tõttu): `set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-<silt>.dump && chmod 600 ~/backups/*.dump`.
- Kui Claude Code'i automaatrežiim keelab käsu, ära otsi ümbersõitu — lõpeta muu ja anna käsk kasutajale.
- `authDb()` on lubatud ainult autentimise/platvormi koodis: `authGate.ts`, `passwordTokens.ts`, `adminUsers.ts` (ainult sessioonide/tokenite kustutamine ettevõtte piires leitud kasutajale), `license.ts`, käsureatööriistad, testid.
- Kommentaarid ja kasutajale nähtavad tekstid eesti keeles. Commit-sõnumid eesti keeles, lõpus `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Release (`npm run release`) ja `git push` ainult kasutaja kinnitusel (Task 7).

## Teadlikud otsused (lünkade nimekirjast)

- **Upsert põrge teise ettevõtte reaga** (etapp 1): viga, mitte leke — jääb nii; uut koodi ei lisata.
- **Litsentsipäringu vahemälu** (etapp 2): ei tehta enne, kui ettevõtteid on mitu ja koormus seda nõuab.
- **`tenant_id` välisvõti `tenants`-ile** (etapp 1): ei lisata. `tenant_id` tuleb alati serveri valideeritud sessioonist (`app.tenant_id`) ning RLS `WITH CHECK` lubab ainult seda väärtust; platvormi kood loob ridu ainult etapi 3b ettevõtte loomise tehingus, mis loob ka `tenants` rea.
- **`seedChecked` protsessipõhine** (etapp 1): lahendatakse etapis 3c (algkataloogi kopeerimine).

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `src/server/adminUsers.ts` | Sessioonide/tokenite kustutamine `authDb()` kaudu |
| `scripts/tenancy/04-privileges.sql` (uus) | `REVOKE` platvormi tabelitelt `teris_app`-ilt |
| `src/server/authGate.ts` | `findActiveSession(tokenHash)` — peatatud ettevõtte sessioon ei kehti |
| `scripts/tenancy/05-tenant-fk-triggers.mts` (uus) | Ettevõtteüleste viidete trigerid DMMF-ist |
| `src/server/tenantIsolation.test.ts` | Õiguste, trigerite ja mudelipõhise muutmise/kustutamise testid |
| `src/server/fieldWorks.ts` | GET `/api/field-works` ei kirjuta aegunud litsentsiga |
| `src/components/UserMenu.tsx`, `src/index.css`, `src/server/db.ts` | Ettevõtte nimi, tume teema, JSDoc |

---

### Task 1: Platvormi tabelid rakenduse rollile kättesaamatuks

**Files:**
- Modify: `src/server/adminUsers.ts:194,196,247,251`
- Create: `scripts/tenancy/04-privileges.sql`
- Modify: `src/server/tenantIsolation.test.ts`

**Interfaces:**
- Consumes: `authDb()` (`./db.ts`), `tenantTransaction`, `runAsTenant`

- [ ] **Step 1: Kirjuta failiv test** (`tenantIsolation.test.ts`, uus `describe` faili lõppu; impordid on failis olemas)

```ts
describe('platvormi tabelid rakenduse rollile', () => {
  it.each(['tenants', 'tenant_licenses', 'sessions', 'password_tokens'])('%s pole teris_app-ile loetav', async (table) => {
    await runAsTenant(LOISU, async () => {
      await expect(tenantTransaction(async (tx) => tx.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`)))
        .rejects.toThrow(/permission denied/);
    });
  });
});
```
(`LOISU` konstant on failis olemas; kui pole, `const LOISU = 'tenant-loisu-agro';`.)

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/server/tenantIsolation.test.ts -t "platvormi tabelid"`. Expected: 4 FAIL (päring õnnestub).

- [ ] **Step 3: adminUsers.ts `authDb()`-le**

Read 194, 196, 247, 251: `prisma.session.deleteMany(...)` → `authDb().session.deleteMany(...)`, `prisma.passwordToken.deleteMany(...)` → `authDb().passwordToken.deleteMany(...)`. Import `authDb` `./db.ts`-ist. Kommentaar esimese kasutuse juurde: `// Sessioonid ja tokenid on platvormi tabelid (teris_app ei näe neid); kasutaja on leitud ettevõtte piires.` Kontrolli: `grep -rn "prisma\.\(tenant\|tenantLicense\|session\|passwordToken\)\." src | grep -v test` → tühi (`userCli.ts` kasutab kohalikku `prisma = authDb()` — see on lubatud).

- [ ] **Step 4: Õiguste skript**

`scripts/tenancy/04-privileges.sql`:
```sql
-- Käivita omanikuna: set -a && . ./.env && set +a && psql -v ON_ERROR_STOP=1 -f scripts/tenancy/04-privileges.sql
-- Platvormi tabelid on ainult teris_platform rollile (authDb()). Korduvkäivitatav.
REVOKE ALL ON tenants, tenant_licenses, sessions, password_tokens FROM teris_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, tenant_licenses, sessions, password_tokens TO teris_platform;
```
NB: `ALTER DEFAULT PRIVILEGES` annab ka tulevastele tabelitele `teris_app`-ile õigused — etapi 3b platvormi tabelid tuleb lisada sellesse skripti.

- [ ] **Step 5: Rakenda (varukoopiaga) ja testi**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-3a-t1.dump && chmod 600 ~/backups/*.dump && psql -v ON_ERROR_STOP=1 -f scripts/tenancy/04-privileges.sql && npx tsc --noEmit -p tsconfig.app.json && npm test'
```
Expected: `REVOKE`, `GRANT`; kõik testid PASS (sh 4 uut).

**NB live-mõju:** töötav etapi 2 server kasutab `adminUsers.ts`-is veel `prisma.session.deleteMany` — pärast REVOKE-i kukub kasutaja keelamine/kustutamine/parooli lähtestamine live'is kuni release'ini (Task 7). Aktsepteeritud (aktiivseid kasutajaid pole).

- [ ] **Step 6: Commit**

```bash
git add src/server/adminUsers.ts scripts/tenancy/04-privileges.sql src/server/tenantIsolation.test.ts
git commit -m "Platvormi tabelid (tenants, litsentsid, sessioonid, tokenid) rakenduse rollile kättesaamatuks"
```

---

### Task 2: Peatatud ettevõtte sessioon ei kehti

**Files:**
- Modify: `src/server/authGate.ts` (`currentSession` ~85-110)
- Create: `src/server/authSession.test.ts`

**Interfaces:**
- Produces: `export async function findActiveSession(tokenHash: string): Promise<{ user: DbUser; session: { id: string; expiresAt: Date; lastSeenAt: Date } } | null>` — `null`, kui sessiooni pole, see on aegunud, kasutaja pole aktiivne või kasutaja ettevõte pole `ACTIVE` (või puudub).

- [ ] **Step 1: Kirjuta failiv test** (`src/server/authSession.test.ts`)

```ts
// Sessiooni kehtivus: peatatud või puuduva ettevõtte kasutaja sessioon ei kehti.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authDb } from './db';
import { findActiveSession } from './authGate';
import { hashToken } from './auth';

const T = `test-sess-tenant-${process.pid}`;
const U = `test-sess-user-${process.pid}`;
const TOKEN = hashToken(`test-sess-token-${process.pid}`);

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Sessioonitest', status: 'ACTIVE' } });
  await authDb().user.create({ data: { id: U, username: U, passwordHash: 'x', tenantId: T } });
  await authDb().session.create({ data: { userId: U, tokenHash: TOKEN, expiresAt: new Date(Date.now() + 3600_000) } });
});

afterAll(async () => {
  await authDb().session.deleteMany({ where: { userId: U } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().user.deleteMany({ where: { id: U } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().tenant.deleteMany({ where: { id: T } }).catch((e) => console.error('Testi puhastus', e));
});

describe('findActiveSession', () => {
  it('aktiivse ettevõtte sessioon kehtib', async () => {
    const s = await findActiveSession(TOKEN);
    expect(s?.user.id).toBe(U);
    expect(s?.user.tenantId).toBe(T);
  });
  it('peatatud ettevõtte sessioon ei kehti', async () => {
    await authDb().tenant.update({ where: { id: T }, data: { status: 'SUSPENDED' } });
    expect(await findActiveSession(TOKEN)).toBeNull();
    await authDb().tenant.update({ where: { id: T }, data: { status: 'ACTIVE' } });
  });
  it('tundmatu token ei kehti', async () => {
    expect(await findActiveSession(hashToken('olematu'))).toBeNull();
  });
});
```
Kontrolli `User` kohustuslikke välju skeemist (nt `passwordHash`, `username`) ja lisa testi `create`-i vajadusel.

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/server/authSession.test.ts`. Expected: FAIL — `findActiveSession` pole eksporditud.

- [ ] **Step 3: Implementeeri**

`authGate.ts`: tõsta `currentSession`-i andmebaasi otsing eraldi eksporditud funktsiooni:
```ts
/** Kehtiv sessioon tokeni räsi järgi: sessioon pole aegunud, kasutaja ja tema ettevõte on aktiivsed. */
export async function findActiveSession(tokenHash: string) {
  const session = await authDb().session.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!session || session.expiresAt.getTime() < Date.now() || !session.user.isActive) return null;
  const tenant = await authDb().tenant.findUnique({ where: { id: session.user.tenantId }, select: { status: true } });
  if (tenant?.status !== 'ACTIVE') return null;
  return { user: session.user, session };
}
```
`currentSession` kasutab seda (`const found = await findActiveSession(hashToken(token)); if (!found) return null; const { session } = found; ...`) — libiseva aegumise ja küpsise uuendamise loogika jääb muutmata. Tagastatav `user` peab rahuldama `DbUser` tüüpi (vajadusel `as DbUser` nagu senises koodis).

- [ ] **Step 4: Testid ja commit**

Run: `npx vitest run src/server/authSession.test.ts src/server/auth.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.
```bash
git add src/server/authGate.ts src/server/authSession.test.ts
git commit -m "Peatatud ettevõtte kasutaja sessioon ei kehti (findActiveSession)"
```

---

### Task 3: Ettevõtteülesed viited keelatud (trigerid)

**Files:**
- Create: `scripts/tenancy/05-tenant-fk-triggers.mts`
- Modify: `src/server/tenantIsolation.test.ts`

**Interfaces:**
- Consumes: `TENANT_MODELS` (`src/server/tenantScope.ts`), `Prisma.dmmf`
- Produces: andmebaasi funktsioon `tenant_fk_check()` ja trigerid nimega `tenant_fk_<veerg>` iga ettevõttesisese relatsiooni jaoks.

- [ ] **Step 1: Kirjuta failiv test** (`tenantIsolation.test.ts`, uus `describe`)

```ts
describe('ettevõtteülesed viited', () => {
  it('A ei saa luua rida, mis viitab Loisu reale', async () => {
    const loisuField = await runAsTenant(LOISU, async () => await prisma.field.findFirst({ select: { id: true } }));
    expect(loisuField).not.toBeNull();
    await runAsTenant(A, async () => {
      await expect(prisma.fieldSeason.create({ data: { fieldId: loisuField!.id, year: 2099 } }))
        .rejects.toThrow(/teise ettevõtte/);
    });
  });

  it('igal ettevõttesisesel relatsioonil on triger', async () => {
    const expected = tenantRelations().map((r) => `${r.table}.tenant_fk_${r.column}`).sort();
    const rows = await authDb().$queryRawUnsafe<{ t: string }[]>(
      `SELECT c.relname || '.' || tg.tgname AS t FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid WHERE tg.tgname LIKE 'tenant_fk_%' AND NOT tg.tgisinternal`);
    expect(rows.map((r) => r.t).sort()).toEqual(expected);
  });
});
```
`A` on failis olemasolev ajutise ettevõtte ID. `FieldSeason` kohustuslikud väljad kontrolli skeemist (lisa vajadusel). `tenantRelations` impordi skriptist (Step 3 ekspordib selle):
```ts
import { tenantRelations } from '../../scripts/tenancy/05-tenant-fk-triggers.mts';
```
Kui `.mts` importimine testist ei tööta (Vitest/tsconfig), tõsta `tenantRelations` faili `src/server/tenantRelations.ts` ja impordi seda nii testist kui skriptist.

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/server/tenantIsolation.test.ts -t "ettevõtteülesed"`. Expected: FAIL.

- [ ] **Step 3: Skript**

`scripts/tenancy/05-tenant-fk-triggers.mts` (või `src/server/tenantRelations.ts` + õhuke skript):
```ts
// scripts/tenancy/05-tenant-fk-triggers.mts — keelab ettevõtteülesed viited.
// Välisvõtme kontroll ja kaskaad mööduvad RLS-ist, seega iga ettevõttesisese relatsiooni
// jaoks on triger: viidatud rida peab kuuluma samale ettevõttele.
// Korduvkäivitatav: npx tsx scripts/tenancy/05-tenant-fk-triggers.mts (omanikuna MIGRATE_DATABASE_URL-iga).
// Pärast skeemimuudatust (uus relatsioon) käivita uuesti.
import { Prisma, PrismaClient } from '@prisma/client';
import { TENANT_MODELS } from '../../src/server/tenantScope.ts';

type Rel = { table: string; column: string; parentTable: string; parentColumn: string };

const models = Prisma.dmmf.datamodel.models;
const dbTable = (name: string) => { const m = models.find((x) => x.name === name)!; return m.dbName ?? m.name; };
const dbColumn = (model: string, field: string) => {
  const f = models.find((x) => x.name === model)!.fields.find((x) => x.name === field)!;
  return (f as { dbName?: string | null }).dbName ?? f.name;
};

export function tenantRelations(): Rel[] {
  const out: Rel[] = [];
  for (const m of models) {
    if (!TENANT_MODELS.has(m.name)) continue;
    for (const f of m.fields) {
      if (f.kind !== 'object' || !f.relationFromFields?.length || !TENANT_MODELS.has(f.type)) continue;
      if (f.relationFromFields.length !== 1) throw new Error(`${m.name}.${f.name}: liitvõtit ei toetata`);
      out.push({
        table: dbTable(m.name),
        column: dbColumn(m.name, f.relationFromFields[0]),
        parentTable: dbTable(f.type),
        parentColumn: dbColumn(f.type, f.relationToFields![0])
      });
    }
  }
  return out;
}

const FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION tenant_fk_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  fk_val text;
  parent_tenant text;
BEGIN
  EXECUTE format('SELECT ($1).%I::text', TG_ARGV[1]) INTO fk_val USING NEW;
  IF fk_val IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('SELECT tenant_id FROM %I WHERE %I::text = $1', TG_ARGV[0], TG_ARGV[2]) INTO parent_tenant USING fk_val;
  IF parent_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Viide teise ettevõtte kirjele (%.% → %)', TG_TABLE_NAME, TG_ARGV[1], TG_ARGV[0] USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;`;

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL;
  if (!url) throw new Error('MIGRATE_DATABASE_URL puudub');
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await db.$executeRawUnsafe(FUNCTION_SQL);
    const rels = tenantRelations();
    for (const r of rels) {
      const name = `tenant_fk_${r.column}`;
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON "${r.table}"`);
      await db.$executeRawUnsafe(
        `CREATE TRIGGER "${name}" BEFORE INSERT OR UPDATE OF "${r.column}" ON "${r.table}" ` +
        `FOR EACH ROW EXECUTE FUNCTION tenant_fk_check('${r.parentTable}', '${r.column}', '${r.parentColumn}')`);
    }
    console.log(`OK: ${rels.length} trigerit`);
  } finally {
    await db.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
```
Triger töötab mõlema rolli all: `teris_app` (RLS peidab teise ettevõtte vanema → `NULL` → keeld) ja `teris_platform` (näeb kõike → võrdleb `tenant_id`-sid).

- [ ] **Step 4: Rakenda (varukoopiaga), korda, testi**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-3a-t3.dump && chmod 600 ~/backups/*.dump && npx tsx scripts/tenancy/05-tenant-fk-triggers.mts && npx tsx scripts/tenancy/05-tenant-fk-triggers.mts && npx prisma db push && npx vitest run src/server/tenantIsolation.test.ts && npm test'
```
Expected: kaks korda `OK: N trigerit` (N > 20); `db push` → `already in sync` (trigerid jäävad — test „igal relatsioonil on triger“ kinnitab); kõik testid PASS (olemasolevad andmed kuuluvad ühele ettevõttele, seega trigerid ei sega). Kui `db push` on keelatud, jäta see vahele ja märgi raportisse.

- [ ] **Step 5: Commit**

```bash
git add scripts/tenancy/05-tenant-fk-triggers.mts src/server/tenantIsolation.test.ts
git commit -m "Ettevõtteülesed viited keelatud trigeritega (tenant_fk_check)"
```

---

### Task 4: Muutmise ja kustutamise eraldus iga mudeli kohta

**Files:**
- Modify: `src/server/tenantIsolation.test.ts`

- [ ] **Step 1: Kirjuta test**

```ts
describe('muutmine ja kustutamine iga mudeli kohta', () => {
  // Tehing pööratakse alati tagasi — ka siis, kui RLS peaks katki olema, ei kustu ühtki rida.
  class Rollback extends Error {}
  it('A ei muuda ega kustuta ühtki Loisu rida üheski ettevõttepõhises tabelis', async () => {
    const counts: Record<string, { updated: number; deleted: number }> = {};
    await runAsTenant(A, async () => {
      await tenantTransaction(async (tx) => {
        for (const model of TENANT_MODELS) {
          const t = tableOf(model);
          const updated = await tx.$executeRawUnsafe(`UPDATE "${t}" SET tenant_id = tenant_id WHERE tenant_id = $1`, LOISU);
          const deleted = await tx.$executeRawUnsafe(`DELETE FROM "${t}" WHERE tenant_id = $1`, LOISU);
          counts[model] = { updated, deleted };
        }
        throw new Rollback();
      }).catch((e) => { if (!(e instanceof Rollback)) throw e; });
    });
    for (const [model, c] of Object.entries(counts)) expect(c, model).toEqual({ updated: 0, deleted: 0 });
    expect(Object.keys(counts)).toHaveLength(TENANT_MODELS.size);
  });
});
```
(`tableOf` on failis olemas.) Kui `DELETE` mõnes tabelis kukub välisvõtme tõttu (ei tohiks — RLS peidab read), on see samuti eralduse viga.

- [ ] **Step 2: Käivita**

Run: `npx vitest run src/server/tenantIsolation.test.ts -t "iga mudeli kohta"`. Expected: PASS (RLS juba kehtib — see on regressioonitest). Kontrolli, et Loisu andmed on alles: `npm run tenant -- list` ja `npx vitest run src/server/telemetryHistory.test.ts` PASS.

- [ ] **Step 3: Commit**

```bash
git add src/server/tenantIsolation.test.ts
git commit -m "Eraldustest: muutmine ja kustutamine iga ettevõttepõhise mudeli kohta"
```

---

### Task 5: GET ei kirjuta aegunud litsentsiga; automaatsete muudatuste ülevaade

**Files:**
- Modify: `src/server/fieldWorks.ts:~955-970` (GET `/api/field-works`)

**Interfaces:**
- Consumes: `licenseOf(req)` (`./licenseGate.ts`)

- [ ] **Step 1: Muuda**

Talivilja kultuuri pärimise kirjutus (`prisma.fieldSeason.update`) tehakse ainult siis, kui litsents ei ole ainult lugemiseks; vastuses kasutatakse päritud kultuuri mõlemal juhul:
```ts
        if (prevSeason && isWinterCrop(prevSeason.crop, crops)) {
          // Aegunud litsentsiga ei kirjutata — vastuses näidatakse päritud kultuuri siiski
          if (!licenseOf(req)?.readOnly) {
            await prisma.fieldSeason.update({ /* senine */ });
          }
          fs.crop = prevSeason.crop;
        }
```
Kontrolli, et `fs.cropColor`/`fs.cropVariety` käsitlus jääb samaks mis enne (kui senine kood neid vastuses ei uuenda, ära lisa).

- [ ] **Step 2: Automaatsete muudatuste ülevaade (ainult raport)**

Otsi kliendist päringud, mis kirjutavad ilma kasutaja tegevuseta (laadimisel, `useEffect`-is, taimeriga): `grep -rn "method: 'POST'\|method: 'PUT'\|method: 'PATCH'\|method: 'DELETE'" src/services/api.ts` ja nende `api.*` meetodite kutsed `useEffect`-ides (`src/App.tsx`, `src/components/*`). Kirjuta raportisse iga leitud koht (fail:rida, mis päring, millal). Kui leid on triviaalselt parandatav (nt efekti tingimus `!user.license.readOnly`), paranda; muidu ainult raport.
Samuti otsi serverist teisi GET-käsitlejaid, mis kirjutavad: `grep -n "method === 'GET'" src/server/*.ts` ja nende plokkides `create|update|upsert|delete` — raporti.

- [ ] **Step 3: Testid ja commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.
```bash
git add src/server/fieldWorks.ts
git commit -m "GET /api/field-works ei kirjuta aegunud litsentsiga"
```

---

### Task 6: Ettevõtte nimi menüüs, riba tumedas teemas, `tenantTransaction` JSDoc

**Files:**
- Modify: `src/components/UserMenu.tsx:71-74`, `src/index.css` (`.license-banner` plokk), `src/server/db.ts:84`

- [ ] **Step 1: Muuda**

`UserMenu.tsx` `user-menu-info` plokki pärast kasutajanime rida:
```tsx
            {user.tenantName && <div className="user-menu-info-login">Ettevõte: {user.tenantName}</div>}
```
`index.css` `.license-banner` järele (sama mustri järgi nagu `[data-theme='dark'] .alert-box.error`):
```css
[data-theme='dark'] .license-banner.expired {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}
[data-theme='dark'] .license-banner.warning {
  background: rgba(245, 158, 11, 0.18);
  color: #fcd34d;
}
```
`db.ts` `tenantTransaction` JSDoc:
```ts
/**
 * Interaktiivne tehing ettevõtte kontekstis — kasuta prisma.$transaction(async ...) asemel.
 * Callback'is kasuta AINULT `tx`-i: globaalne `prisma` käiks teise ühendusega tehingust väljas
 * ja RLS-i seade puuduks (tulemus oleks vaikselt tühi).
 */
```
Lisaks (etapi 2 kosmeetika): `App.tsx`-is litsentsikäsitleja `useEffect` on operaatorifiltri kommentaari ja koodi vahel — tõsta see kommentaarist ettepoole.

- [ ] **Step 2: Kontroll ja commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.
```bash
git add src/components/UserMenu.tsx src/index.css src/server/db.ts src/App.tsx
git commit -m "Ettevõtte nimi kasutajamenüüs, litsentsiriba tumedas teemas, tenantTransaction JSDoc"
```

---

### Task 7: Tootmisse viimine (kasutaja kinnitusel)

- [ ] **Step 1:** `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm run release'`
- [ ] **Step 2:** `systemctl is-active teris`, `journalctl -u teris -n 30 --no-pager`, `BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts` → „KÕIK KORRAS“ (smoke-test kontrollib ka kasutaja keelamist/kustutamist — Task 1 `authDb()` muudatus).
- [ ] **Step 3:** Käsitsi https://teris.ee: menüüs „Ettevõte: Loisu Agro OÜ“, kõik nagu enne.
- [ ] **Step 4:** `git push`.

## Väljas (etapp 3b/3c)

- Teenusepakkuja keskkond admin.teris.ee (DNS, Apache vhost, TLS), `PlatformUser` + TOTP, ettevõtete ja litsentside haldus, uue ettevõtte loomine, logi — **etapp 3b**. Uued platvormi tabelid lisada `04-privileges.sql`-i `REVOKE` nimekirja.
- Algkataloog ja kopeerimine, `seedChecked` asendamine — **etapp 3c**.
- Telemeetria IMEI omand — **etapp 4** (enne teise päris ettevõtte telemeetriat).
