# Mitme ettevõtte tugi, etapp 3c: algkataloog — implementeerimisplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teenusepakkuja hoiab admin.teris.ee-s algkataloogi (kultuurid, sordid, tööliigid, töömallid); uue ettevõtte loomisel kopeeritakse see ettevõtte keskkonda samas tehingus. Protsessipõhine `ensureSeed` kaob.

**Architecture:** Viis platvormi tabelit `catalog_*` (ilma `tenant_id`-ta, `teris_app`-ile lukus). Algkataloogi esimene versioon kopeeritakse Loisu Agro OÜ praegustest andmetest skriptiga. `src/server/catalog.ts` `copyCatalogToTenant(tx, tenantId)` loob ettevõtte read uute ID-dega ja seob mallid uute kultuuride/tööliikidega; seda kutsub `platformApi.ts` ettevõtte loomise tehing. Kataloogi muutmine käib platvormi API ja admin-kasutajaliidese kaudu; muudatused mõjutavad ainult edaspidi loodavaid ettevõtteid.

**Tech Stack:** Node 22, TypeScript 6, Prisma 6.19, PostgreSQL 17, React 19, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-15-mitme-ettevotte-tugi-design.md` — otsuste tabel („Kataloogid“), 1.1 (algkataloogi tabelid), 5.2 vaade 4, 6 (algkataloogi esimene versioon).

## Global Constraints

- Arendus ja toodang kasutavad **sama andmebaasi**; käsud serveris: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`. Kohalikus Macis `npm`/`npx` ei tööta. Git kohalikult.
- **`npm run build` ainult release'i ajal** (Task 8). Kontrolliks `npx tsc --noEmit -p tsconfig.app.json` ja `npm test`; CLI/skriptid `npx tsx`-iga.
- Rollid: `teris_app` (RLS), `teris_platform` (`authDb()`, BYPASSRLS), `teris` (omanik; PG*). URL-id lõpevad `?schema=public`. **Saladusi ei trükita.**
- Varukoopia enne andmebaasi muudatust `teris_platform` rolliga: `set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-<silt>.dump && chmod 600 ~/backups/*.dump`.
- Kui Claude Code'i automaatrežiim keelab käsu, ära otsi ümbersõitu — lõpeta muu ja anna käsk kasutajale.
- Kataloogi tabelid on platvormi tabelid: **ilma `tenantId` väljata**, lisatakse `scripts/tenancy/04-privileges.sql` ja `02-rls.sql` lõpu `REVOKE`/`GRANT` lausetesse; test „iga `tenant_id`-ta tabel on `teris_app`-ile lukus“ kontrollib.
- Kopeerimisel genereeritakse **uued ID-d** (`Crop.id`/`CropVariety.id` on globaalsed primaarvõtmed ilma vaikeväärtuseta): kuju `crop-<randomUUID>` ja `variety-<randomUUID>`; tööliigid/mallid/read kasutavad `cuid()` vaikeväärtust. Kõigil kopeeritud ridadel `tenantId` selgesõnaliselt.
- Algkataloogi muudatused **ei mõjuta olemasolevaid ettevõtteid** (sünkroniseerimist pole).
- Materjale ei kopeerita (ettevõtte äriteave).
- Kommentaarid ja kasutajale nähtavad tekstid eesti keeles. Commit-sõnumid eesti keeles, lõpus `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Release, `git push` ainult kasutaja kinnitusel (Task 8).

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `prisma/schema.prisma` | `CatalogCrop`, `CatalogCropVariety`, `CatalogWorkType`, `CatalogWorkTemplate`, `CatalogWorkTemplateItem` |
| `scripts/tenancy/04-privileges.sql`, `02-rls.sql` | REVOKE/GRANT kataloogi tabelitele |
| `scripts/tenancy/06-catalog-init.mts` (uus) | Algkataloogi esimene versioon Loisu andmetest |
| `src/server/catalog.ts` (+ test) | `copyCatalogToTenant(tx, tenantId)` |
| `src/server/platformApi.ts` (+ test) | Kopeerimine ettevõtte loomisel; kataloogi CRUD API |
| `src/server/fieldWorks.ts` | `ensureSeed` ja `SEED_*` eemaldamine |
| `src/server/authGate.ts`, `passwordTokens.ts` | Peatatud ettevõtte kasutaja paroolivood |
| `src/admin/CatalogView.tsx` jt | Kataloogi haldus admin-kasutajaliideses |

---

### Task 1: Kataloogi tabelid

**Files:**
- Modify: `prisma/schema.prisma` (platvormi ploki järele), `scripts/tenancy/04-privileges.sql`, `scripts/tenancy/02-rls.sql`

**Interfaces:**
- Produces: Prisma mudelid `catalogCrop`, `catalogCropVariety`, `catalogWorkType`, `catalogWorkTemplate`, `catalogWorkTemplateItem`.

- [ ] **Step 1: Skeem**

```prisma
// ============================================================================
// ALGKATALOOG — teenusepakkuja hallatav; kopeeritakse uuele ettevõttele loomisel
// (platvormi tabelid: ainult authDb(), teris_app ei näe)
// ============================================================================
model CatalogCrop {
  id                  String    @id @default(cuid())
  name                String    @unique
  scientificName      String?
  group               CropGroup @default(CEREAL)
  color               String    @default("#eab308")
  icon                String?
  priaCode            String?
  defaultSeedRateKgHa Float?
  defaultYieldTonsHa  Float?
  description         String?
  isWinterCrop        Boolean   @default(false)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  varieties CatalogCropVariety[]
  templates CatalogWorkTemplate[]

  @@map("catalog_crops")
}

model CatalogCropVariety {
  id                      String      @id @default(cuid())
  catalogCropId           String
  name                    String
  breeder                 String?
  maturityDays            String?
  winterHardiness         String?
  recommendedSeedRateKgHa Float?
  potentialYieldTonsHa    Float?
  qualityClass            String?
  notes                   String?
  isActive                Boolean     @default(true)

  crop CatalogCrop @relation(fields: [catalogCropId], references: [id], onDelete: Cascade)

  @@unique([catalogCropId, name])
  @@map("catalog_crop_varieties")
}

model CatalogWorkType {
  id            String         @id @default(cuid())
  name          String         @unique
  phase         WorkPhase
  repeatMode    WorkRepeatMode @default(ONCE)
  maxRepeats    Int?
  intervalDays  Int?
  usesMaterials Boolean        @default(false)
  sortOrder     Int            @default(0)
  isActive      Boolean        @default(true)

  templateItems CatalogWorkTemplateItem[]

  @@map("catalog_work_types")
}

model CatalogWorkTemplate {
  id            String       @id @default(cuid())
  catalogCropId String? // null = üldmall (suvi/tali)
  isWinter      Boolean      @default(false)

  crop  CatalogCrop?              @relation(fields: [catalogCropId], references: [id], onDelete: Cascade)
  items CatalogWorkTemplateItem[]

  @@unique([catalogCropId, isWinter])
  @@map("catalog_work_templates")
}

model CatalogWorkTemplateItem {
  id                String              @id @default(cuid())
  templateId        String
  catalogWorkTypeId String
  sortOrder         Int                 @default(0)
  typicalTiming     String?
  plannedCount      Int?

  template CatalogWorkTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  workType CatalogWorkType     @relation(fields: [catalogWorkTypeId], references: [id], onDelete: Restrict)

  @@unique([templateId, catalogWorkTypeId])
  @@map("catalog_work_template_items")
}
```
NB: `@@unique([catalogCropId, isWinter])` lubab Postgresis mitu `NULL`-kultuuriga malli sama `isWinter`-iga (NULL-id on erinevad) — üldmallide unikaalsust kontrollib API (Task 5).

- [ ] **Step 2: REVOKE/GRANT** — lisa `catalog_crops, catalog_crop_varieties, catalog_work_types, catalog_work_templates, catalog_work_template_items` mõlema skripti REVOKE ja `04` GRANT lausesse.

- [ ] **Step 3: Varukoopia, `db push`, õigused**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-3c-t1.dump && chmod 600 ~/backups/*.dump && npx prisma db push && npx prisma generate && psql -v ON_ERROR_STOP=1 -f scripts/tenancy/04-privileges.sql'
```
Kui `db push` küsib andmekao kohta, peatu. Kui see on keelatud, anna käsk kasutajale.

- [ ] **Step 4: Testid ja commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS (privileegitest katab uued tabelid; `TENANT_MODELS` jääb 25).
```bash
git add prisma/schema.prisma scripts/tenancy/04-privileges.sql scripts/tenancy/02-rls.sql
git commit -m "Algkataloogi tabelid (catalog_*), teris_app-ile lukus"
```

---

### Task 2: Algkataloogi esimene versioon Loisu andmetest

**Files:**
- Create: `scripts/tenancy/06-catalog-init.mts`

**Interfaces:**
- Consumes: Task 1 mudelid; `authDb()`

- [ ] **Step 1: Skript**

`scripts/tenancy/06-catalog-init.mts` — käivitamine `npx tsx scripts/tenancy/06-catalog-init.mts`. Tehingus (`authDb().$transaction`):
1. Kui `catalogCrop` või `catalogWorkType` pole tühi → trüki `Algkataloog on juba olemas — midagi ei muudetud` ja lõpeta (korduvkäivitatav, ei kirjuta üle).
2. Loisu (`tenantId: 'tenant-loisu-agro'`) kultuurid → `catalogCrop` (kõik väljad peale `id`, `tenantId`, audit); kaardista `crop.id → catalogCrop.id`.
3. Loisu sordid → `catalogCropVariety` (`catalogCropId` kaardistusest).
4. Loisu tööliigid → `catalogWorkType` (kõik väljad); kaardista.
5. Loisu mallid → `catalogWorkTemplate` (`catalogCropId` kaardistusest või `null`) ja nende read → `catalogWorkTemplateItem` (`catalogWorkTypeId` kaardistusest).
6. Trüki koondarvud: `Kultuure X, sorte Y, tööliike Z, malle M (ridu R)`.

- [ ] **Step 2: Varukoopia, käivitamine kaks korda, kontroll**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump -Fc -d "${PLATFORM_DATABASE_URL%%\?*}" -f ~/backups/teris-$(date +%F-%H%M)-3c-t2.dump && chmod 600 ~/backups/*.dump && npx tsx scripts/tenancy/06-catalog-init.mts && npx tsx scripts/tenancy/06-catalog-init.mts'
```
Expected: esimene `Kultuure 11, sorte 0, tööliike 14, malle 2 (ridu 17)` (arvud vastavad Loisu praegustele andmetele — kui erinevad, võrdle Loisu loendusega ja raporteeri); teine `Algkataloog on juba olemas`.

- [ ] **Step 3: Commit**

```bash
git add scripts/tenancy/06-catalog-init.mts
git commit -m "Algkataloogi esimene versioon Loisu Agro andmetest (06-catalog-init)"
```

---

### Task 3: Kataloogi kopeerimine uuele ettevõttele

**Files:**
- Create: `src/server/catalog.ts`, `src/server/catalog.test.ts`
- Modify: `src/server/platformApi.ts` (ettevõtte loomise tehing), `src/server/platformApi.test.ts`

**Interfaces:**
- Produces: `copyCatalogToTenant(tx: Prisma.TransactionClient, tenantId: string): Promise<{ crops: number; varieties: number; workTypes: number; templates: number; items: number }>`

- [ ] **Step 1: Kirjuta failiv test** (`catalog.test.ts`)

`authDb().$transaction`-is: loo ajutine ettevõte (`tenants` rida), kutsu `copyCatalogToTenant(tx, T)`, ja **viska lõpus sentinel-viga, et tehing tagasi pöörataks** (ei jäta ridu maha). Enne viskamist kontrolli `tx`-iga:
- loendused vastavad kataloogi loendustele (`tx.catalogCrop.count()` jne);
- kõigil uutel `crops`, `crop_varieties`, `work_types`, `work_templates`, `work_template_items` ridadel `tenantId === T`;
- kultuuride ID-d algavad `crop-` ja ei kattu ühegi teise ettevõtte ID-ga;
- iga uue malli `cropId` on `null` või viitab **sama ettevõtte** kultuurile; iga rea `workTypeId` viitab sama ettevõtte tööliigile;
- kultuuride nimed ja `isWinterCrop` võrduvad kataloogiga.
Teine test: tühja kataloogiga (simuleeri, kustutades tehingus `tx.catalogWorkTemplateItem/…deleteMany()` enne kopeerimist, siis rollback) tagastab nullid ilma veata.

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `npx vitest run src/server/catalog.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implementeeri** (`src/server/catalog.ts`)

```ts
// src/server/catalog.ts — algkataloogi kopeerimine uue ettevõtte keskkonda.
// Kutsutakse platvormi rollis (authDb) ettevõtte loomise tehingus: tenantId antakse
// igal real selgesõnaliselt; uued ID-d, mallid seotakse uute kultuuride/tööliikidega.
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export async function copyCatalogToTenant(tx: Prisma.TransactionClient, tenantId: string) {
  const [crops, workTypes, templates] = await Promise.all([
    tx.catalogCrop.findMany({ include: { varieties: true }, orderBy: { name: 'asc' } }),
    tx.catalogWorkType.findMany({ orderBy: { sortOrder: 'asc' } }),
    tx.catalogWorkTemplate.findMany({ include: { items: true } })
  ]);
  const cropIds = new Map<string, string>();
  let varieties = 0;
  for (const c of crops) {
    const id = `crop-${randomUUID()}`;
    cropIds.set(c.id, id);
    await tx.crop.create({
      data: {
        id, tenantId, name: c.name, scientificName: c.scientificName, group: c.group, color: c.color,
        icon: c.icon, priaCode: c.priaCode, defaultSeedRateKgHa: c.defaultSeedRateKgHa,
        defaultYieldTonsHa: c.defaultYieldTonsHa, description: c.description, isWinterCrop: c.isWinterCrop
      }
    });
    for (const v of c.varieties) {
      await tx.cropVariety.create({
        data: {
          id: `variety-${randomUUID()}`, tenantId, cropId: id, name: v.name, breeder: v.breeder,
          maturityDays: v.maturityDays, winterHardiness: v.winterHardiness,
          recommendedSeedRateKgHa: v.recommendedSeedRateKgHa, potentialYieldTonsHa: v.potentialYieldTonsHa,
          qualityClass: v.qualityClass, notes: v.notes, isActive: v.isActive
        }
      });
      varieties++;
    }
  }
  const typeIds = new Map<string, string>();
  for (const w of workTypes) {
    const created = await tx.workType.create({
      data: {
        tenantId, name: w.name, phase: w.phase, repeatMode: w.repeatMode, maxRepeats: w.maxRepeats,
        intervalDays: w.intervalDays, usesMaterials: w.usesMaterials, sortOrder: w.sortOrder, isActive: w.isActive
      }
    });
    typeIds.set(w.id, created.id);
  }
  let items = 0;
  for (const t of templates) {
    const created = await tx.workTemplate.create({
      data: { tenantId, cropId: t.catalogCropId ? cropIds.get(t.catalogCropId)! : null, isWinter: t.isWinter }
    });
    for (const it of t.items) {
      await tx.workTemplateItem.create({
        data: {
          tenantId, templateId: created.id, workTypeId: typeIds.get(it.catalogWorkTypeId)!,
          sortOrder: it.sortOrder, typicalTiming: it.typicalTiming, plannedCount: it.plannedCount
        }
      });
      items++;
    }
  }
  return { crops: crops.length, varieties, workTypes: workTypes.length, templates: templates.length, items };
}
```
Kontrolli `Crop`/`CropVariety` audit-välju (`createdBy`/`updatedBy`) — platvormi kliendil auditilaiendust pole, need jäävad `null`-iks (sobib).

`platformApi.ts` ettevõtte loomise tehingus pärast litsentsi ja enne admin-kasutajat: `const catalog = await copyCatalogToTenant(tx, tenant.id);` ja lisa `catalog` logi `details`-isse. Interaktiivse tehingu vaikeaeg (5 s) võib ~50 reaga jääda napiks — anna `$transaction(..., { timeout: 30000 })`.

`platformApi.test.ts` loomise testi: uue ettevõtte kontekstis (`runAsTenant(newId, async () => …)`) `prisma.crop.count()` = kataloogi kultuuride arv, `prisma.workType.count()` = kataloogi tööliikide arv, `prisma.workTemplate.count()` = mallide arv. Koristusse lisa uue ettevõtte `work_template_items`, `work_templates`, `work_types`, `crop_varieties`, `crops` (õiges järjekorras, `tenantId` järgi).

- [ ] **Step 4: Testid ja commit**

Run: `npx vitest run src/server/catalog.test.ts src/server/platformApi.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS; pärast `npx tsx src/server/tenantCli.ts list` → ainult Loisu Agro.
```bash
git add src/server/catalog.ts src/server/catalog.test.ts src/server/platformApi.ts src/server/platformApi.test.ts
git commit -m "Uus ettevõte saab algkataloogi koopia (kultuurid, sordid, tööliigid, mallid)"
```

---

### Task 4: `ensureSeed` eemaldamine

**Files:**
- Modify: `src/server/fieldWorks.ts` (read ~80-172 `SEED_*` ja `ensureSeed`; kutsed ~183, ~257, ~772, ~871, ~894)

- [ ] **Step 1: Eemalda**

Kustuta `SEED_WORK_TYPES`, `SEED_SPRING_TEMPLATE`, `SEED_AUTUMN_TEMPLATE`, `seedChecked`, `ensureSeed` ja kõik `await ensureSeed();` kutsed. Kui `applyCropTemplate` ei leia malli (ettevõttel pole üldmalli), käitub see nagu praegu puuduva malli korral (ei lisa töid) — kontrolli, et koodis on see haru olemas ega viska.
Kontroll: `grep -n "ensureSeed\|SEED_\|seedChecked" src/server/*.ts` → tühi.

- [ ] **Step 2: Testid**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS (Loisu andmed on olemas, käitumine sama).

- [ ] **Step 3: Commit**

```bash
git add src/server/fieldWorks.ts
git commit -m "ensureSeed eemaldatud — tööliigid ja mallid tulevad algkataloogist"
```

---

### Task 5: Kataloogi API

**Files:**
- Modify: `src/server/platformApi.ts`, `src/server/platformApi.test.ts`

**Interfaces:**
- Produces (kõik `authDb()` kaudu, autenditud platvormi kasutajale, CSRF, logi `CATALOG_UPDATE` koos `{ entity, op, id, name }`):

| Meetod ja tee | Kirjeldus |
|---|---|
| GET `/api/platform/catalog` | `{ crops: [... + varieties], workTypes: [...], templates: [{ id, catalogCropId, cropName, isWinter, items: [{ id, catalogWorkTypeId, workTypeName, sortOrder, typicalTiming, plannedCount }] }] }` |
| POST / PATCH / DELETE `/api/platform/catalog/crops[/:id]` | Kultuur (väljad nagu `CatalogCrop`); nimi unikaalne (409 `Sellise nimega kultuur on juba olemas`); kustutamine kustutab ka selle sordid ja erimallid (cascade) |
| POST / PATCH / DELETE `/api/platform/catalog/crops/:id/varieties[/:vid]` | Sort |
| POST / PATCH / DELETE `/api/platform/catalog/work-types[/:id]` | Tööliik; `phase` ∈ `WorkPhase`, `repeatMode` ∈ `WorkRepeatMode`; kustutamine, kui seda kasutab mõni mallirida → 409 `Tööliiki kasutatakse mallis` |
| PUT `/api/platform/catalog/templates` | `{ catalogCropId: string \| null, isWinter: boolean, items: [{ catalogWorkTypeId, typicalTiming?, plannedCount? }] }` — asendab malli read (järjekord = massiivi järjekord); üldmall (`catalogCropId = null`) on unikaalne `isWinter` kohta (API kontrollib); tühi `items` kustutab malli |

Valideerimine: tekstid kärbitakse, nimi 1–100 märki, `color` `#rrggbb`, numbrid ≥ 0 või `null`; tundmatu ID → 404. Vead eesti keeles.

- [ ] **Step 1: Testid** (`platformApi.test.ts`, sama abi mis olemas): GET catalog → 11 kultuuri, 14 tööliiki, 2 malli; loo/muuda/kustuta testkultuur `ZZ test <pid>` ja testsort; topeltnimi → 409; loo testtööliik, lisa see testkultuuri malli PUT-iga, tööliigi kustutamine → 409, malli tühjendamine PUT `items: []` → mall kaob, siis tööliigi kustutamine → 200; vigane `phase` → 400; logi `CATALOG_UPDATE` read tekivad. **Koristus:** kõik `ZZ test`-nimelised kataloogi read ja logiread; kontrolli lõpus, et kataloogi loendused on samad mis testi alguses.

- [ ] **Step 2: Käivita — peab kukkuma.** Run: `npx vitest run src/server/platformApi.test.ts -t catalog`. Expected: FAIL.

- [ ] **Step 3: Implementeeri** olemasoleva `platformApi.ts` mustri järgi (`HttpError`, ruuter, `parseBody` limiidiga).

- [ ] **Step 4: Testid ja commit**

Run: `npx vitest run src/server/platformApi.test.ts && npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.
```bash
git add src/server/platformApi.ts src/server/platformApi.test.ts
git commit -m "Platvormi API: algkataloogi haldus (kultuurid, sordid, tööliigid, mallid)"
```

---

### Task 6: Kataloogi haldus admin-kasutajaliideses

**Files:**
- Create: `src/admin/CatalogView.tsx` (vajadusel `CatalogCropForm.tsx`, `CatalogTemplateEditor.tsx`)
- Modify: `src/admin/AdminApp.tsx` (päisesse vaade „Algkataloog“), `src/admin/platformApi.ts` (kataloogi päringud), `src/admin/NewTenantForm.tsx`

- [ ] **Step 1: Kasutajaliides**

- Vaade „Algkataloog“ kolme sakiga: **Kultuurid** (tabel: nimi, ladinakeelne nimi, rühm, värv, PRIA kood, talivili, sorte; lisamine/muutmine vormis, kustutamine kinnitusega; kultuuri all sortide nimekiri ja lisamine/muutmine/kustutamine), **Tööliigid** (nimi, faas — Ettevalmistus/Külv/Hooldus/Koristus, kordus — Üks kord/Kuni N korda/Intervalliga, kulumaterjalid, järjekord, aktiivne), **Mallid** (suvivilja ja talivilja üldmall + kultuuripõhised erimallid; malli redaktor: tööliikide valik, järjekord üles/alla, tüüpiline aeg, plaanitud kordi; „Salvesta mall“).
- Sakkide kohal teade: „Algkataloogi muudatused kehtivad ainult edaspidi loodavatele ettevõtetele.“
- `NewTenantForm`: salvestamise järel teade lisaks „… Ettevõttele kopeeriti algkataloog: X kultuuri, Y tööliiki, Z malli.“ (API vastusesse lisa `catalog` loendused Task 3-s; kui seda pole tehtud, lisa siin).
- Kasuta olemasolevaid admin-kasutajaliidese mustreid ja `index.css` klasse; vead serveri tekstiga; enum-väärtused eestikeelsete siltidega.

- [ ] **Step 2: Kontroll ja commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.
```bash
git add src/admin
git commit -m "Admin: algkataloogi haldus (kultuurid, sordid, tööliigid, mallid)"
```

---

### Task 7: Peatatud ettevõtte kasutaja paroolivood

**Files:**
- Modify: `src/server/authGate.ts` (`handleForgot`, `handleSetPassword`), `src/server/platformApi.ts` (`resend-invite`)
- Modify: `src/server/authSession.test.ts` (või uus test)

- [ ] **Step 1: Testid**: peatatud ettevõtte kasutajale `forgot` ei saada kirja (vastus sama `{ success: true }`, `password_tokens` uut rida ei teki); olemasoleva kehtiva tokeniga `set-password` → 400 `Link on aegunud või juba kasutatud` ja parool ei muutu; platvormi `resend-invite` peatatud ettevõttele või mitteaktiivsele kasutajale → 400 `Ettevõte on peatatud` / `Kasutaja on keelatud`.
- [ ] **Step 2: Käivita — peab kukkuma.**
- [ ] **Step 3: Implementeeri**: `handleForgot` jätab peatatud (või puuduva) ettevõtte kasutaja vahele samamoodi nagu mitteaktiivse kasutaja (vastus ja ajastus ei muutu); `handleSetPassword` kontrollib pärast tokeni leidmist ettevõtte staatust; `resend-invite` kontrollib `tenant.status === 'ACTIVE'` ja `user.isActive`.
- [ ] **Step 4: Testid ja commit**

Run: focused tests, `npx tsc --noEmit -p tsconfig.app.json && npm test`. Expected: PASS.
```bash
git add src/server/authGate.ts src/server/platformApi.ts src/server/authSession.test.ts src/server/platformApi.test.ts
git commit -m "Peatatud ettevõtte kasutajale ei saadeta paroolilinke ega kutseid"
```

---

### Task 8: Tootmisse viimine (kasutaja kinnitusel)

- [ ] **Step 1:** `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm run release'`; `systemctl is-active teris`; `journalctl -u teris -n 30 --no-pager`; `BASE=http://127.0.0.1:8820 npx tsx scripts/auth-smoke.mts` → „KÕIK KORRAS“.
- [ ] **Step 2:** `curl -s -o /dev/null -w "%{http_code}" https://admin.teris.ee/` → 200; https://teris.ee tööde tahvel avaneb (Loisu tööliigid ja mallid alles).
- [ ] **Step 3:** Kasutaja kontrollib admin.teris.ee-s vaadet „Algkataloog“ ja (soovi korral) loob testettevõtte — selle tööde tahvlis on algkataloogi kultuurid, tööliigid ja mallid.
- [ ] **Step 4:** `git push`.

## Väljas

- Algkataloogi uute kirjete lisamine olemasolevatele ettevõtetele („sünkroniseerimine“) — hiljem, kui vaja.
- Telemeetria IMEI omand — **etapp 4** (enne teise päris ettevõtte telemeetriat).
