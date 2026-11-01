# Artiklite register (osa 1) — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kulumaterjalide register muutub artiklite registriks: kood ja andmebaas räägivad artiklitest, artiklil on liik (rühm + süsteemne või kasutaja loodud liik), teenusel hind, teradel kultuur, kaubal vaikimisi ladu; menüü „Laoarvestus“, vahekaart „Artiklid“.

**Architecture:** Neli järjestikust ülesannet, igaüks läheb live'i. (1) Mehaaniline ümbernimetamine `material` → `article` koodis ja andmebaasis (SQL `RENAME`, andmed jäävad). (2) Liikide tabel `article_categories`, enum `MaterialCategory` asendub `categoryId`-ga (SQL migratsioon), reeglid puhtas moodulis `src/services/articleRules.ts`, liikide API ja olemasoleva kasutajaliidese kohandamine. (3) Uus kasutajaliides: liikide haldus, liigi filter, teenuse hind, kultuur, vaikimisi ladu, valikud ainult kaupadest / kulumaterjalidest. (4) AI-ühenduse tekstid ja dokumentatsioon.

**Tech Stack:** React 19 + TypeScript + Vite, `node:http` server (`src/server`), Prisma 6 + PostgreSQL (RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-artiklid-design.md` (osa 1)

## Global Constraints

- Kood asub serveris; kohalik `/Users/andresj/Progemine/teris` on sshfs-mount samast kaustast. Faile muuda kohalikult (Edit/Write), **kõik käsud** (npm, npx, git, psql, perl) jooksevad serveris:
  `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`
- Andmebaasi ühendus käsureal: `set -a && . ./.env && set +a` ja siis `psql "${MIGRATE_DATABASE_URL%%\?*}"` (tabelite omanik).
- Varukoopia enne iga andmeid muutvat sammu:
  `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump && ls -t ~/backups | head -1'`
- Skeemimuudatus: `npx prisma db push` ja `npx prisma generate` **ilma `--accept-data-loss`-ita**; kui Prisma seda nõuab, peatu ja küsi kasutajalt. Pärast iga skeemimuudatust: `psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql` ja `MIGRATE_DATABASE_URL="$MIGRATE_DATABASE_URL" npx tsx scripts/tenancy/05-tenant-fk-triggers.mts`.
- Tüübikontroll: `npx tsc --noEmit -p tsconfig.app.json`. Testid: `npx vitest run <fail>`; kõik: `npm test` (osa teste kasutab live-andmebaasi ajutise ettevõttega).
- Iga ülesande lõpus: commit (ainult nimetatud failid, `git add <failid>`; ümbernimetamisel `git add -A src scripts prisma docs`) ja `npm run release`. Commit-sõnum eesti keeles, lõpus rida `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Identifikaatorid (muutujad, failid, CSS klassid, URL-id, enumid) inglise keeles; koodikommentaarid ja UI-tekst eesti keeles.
- Kõik filtrid (rippmenüüd, otsingud) mähitakse `FilterClear` komponenti.
- Numbrid tabelites paremale (`className="num"`), kogused `formatQty`.
- Raha (hinnad, laoväärtus) näevad ja liike muudavad ainult admin ja finantsjuht (`isAdmin || isFinanceManager`).
- Muutmata jäävad: `WorkEntryLineKind.MATERIAL`, `WorkType.usesMaterials` / `CatalogWorkType.usesMaterials`, landing-lehe kaart „Kuluarvestus“, finantsakna pealkiri.
- Süsteemsed liigid (nimi, rühm, `systemKind`, järjekord) — täpselt need:

  | sortOrder | name | group | systemKind |
  |---|---|---|---|
  | 10 | Töötaja tööaeg | SERVICE | LABOR_TIME |
  | 20 | Masina tööaeg | SERVICE | MACHINE_TIME |
  | 30 | Haakeriista tööaeg | SERVICE | IMPLEMENT_TIME |
  | 40 | Kuivatamise tööaeg | SERVICE | DRYING_TIME |
  | 110 | Seeme | CONSUMABLE | SEED |
  | 120 | Väetis | CONSUMABLE | FERTILIZER |
  | 130 | Taimekaitsevahend | CONSUMABLE | PLANT_PROTECTION |
  | 140 | Kütus | CONSUMABLE | FUEL |
  | 150 | Kuivatusõli | CONSUMABLE | DRYING_OIL |
  | 210 | Terad | PRODUCE | GRAIN |

  Lisaks migratsioonis kasutaja liik „Muu kulumaterjal“ (CONSUMABLE, `systemKind` null, sortOrder 190).
- Testides väljamõeldud nimed; päris isikuandmeid ei commit'ita.

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `scripts/articles-rename.sql` (uus, T1) | tabelite, veergude, indeksite ja piirangute ümbernimetamine |
| `scripts/articles-categories.sql` (uus, T2) | enumid, `article_categories`, süsteemsed liigid, `categoryId` täitmine, vana `category` eemaldus |
| `prisma/schema.prisma` | T1 nimed; T2 `ArticleGroup`, `ArticleSystemKind`, `ArticleCategory`, `Article.categoryId/price/cropId/defaultWarehouseId` |
| `scripts/tenancy/02-rls.sql`, `scripts/tenancy/01-backfill.mts` | tabelinimed; `article_categories` |
| `src/services/articleRules.ts` (uus, T2) | puhtad reeglid: rühmad, süsteemsed liigid, välja reeglid, PRIA liigi sobivus, liigi muutmise reeglid |
| `src/services/articleRules.test.ts` (uus, T2) | testid |
| `src/server/articleCategories.ts` (uus, T2) | `ensureArticleCategories`, `systemCategoryId`, `categoryIdForPriaKind`, `/api/article-categories` |
| `src/server/articleCategories.test.ts` (uus, T2) | andmebaasitestid ajutise ettevõttega |
| `src/server/fieldWorks.ts` | `/api/articles` liigiga |
| `src/server/fieldBookImport.ts` | PRIA import liigi kaudu |
| `src/server/stock.ts` | laokandel ainult kaubad |
| `src/server/apiHandler.ts` | `handleArticleCategories` ühendus |
| `src/types/fieldWork.ts` | `Article` tüüp liigiga |
| `src/services/api.ts` | liikide API |
| `src/components/ArticleFormDialog.tsx` | liigi valik, väljad liigi järgi |
| `src/components/ArticleCategoriesDialog.tsx` (uus, T3) | liikide haldus |
| `src/components/ArticlesView.tsx` | rühma vahekaardid, liigi filter, teenusel laoveerge pole |
| `src/components/PriaLinesEditor.tsx`, `StockDocumentDialog.tsx`, `ArticleMergeDialog.tsx`, `WorkRegisterModal.tsx` | liigi järgi valikud |
| `src/server/mcp/*` | tööriistade tekstid ja väljad (T4) |
| `docs/andmemudel.md` | artiklid ja liigid (T4) |

---

### Task 1: Ümbernimetamine `material` → `article` (kood ja andmebaas)

Mehaaniline. Käitumine ei muutu; ainus nähtav muudatus: menüü „Laoarvestus“, vahekaart „Artiklid“.

**Files:**
- Create: `scripts/articles-rename.sql`
- Modify: kõik `src/**`, `scripts/**`, `prisma/schema.prisma` failid, kus esineb `material`/`Material` (u 50 faili)
- Rename (git mv): `src/components/MaterialFormDialog.tsx` → `ArticleFormDialog.tsx`, `MaterialMergeDialog.tsx` → `ArticleMergeDialog.tsx`, `MaterialStockCard.tsx` → `ArticleStockCard.tsx`, `MaterialsView.tsx` → `ArticlesView.tsx`; `src/server/materialUnitChange.ts` → `articleUnitChange.ts` (+ `.test.ts`), `src/server/materialUsage.ts` → `articleUsage.ts` (+ `.test.ts`)

**Interfaces:**
- Produces: Prisma mudelid `Article` (`@@map("articles")`), `ArticleStock` (`@@map("article_stock")`); väljad `articleId` (`WorkEntryLine`, `FieldWorkLine`, `StockDocumentLine`, `ArticleStock`), relatsiooniväli `article`; Prisma enum jääb nimega `MaterialCategory` (asendub T2-s). TS-tüüp `PriaArticleKind = 'SEED' | 'FERTILIZER' | 'PLANT_PROTECTION' | 'OTHER'` (`src/types/fieldWork.ts`), funktsioon `priaArticleKindFor(activity)` (`src/services/pria.ts`), `OperationLine.priaArticleKind`. Komponendid `ArticlesView`, `ArticleFormDialog`, `ArticleMergeDialog`, `ArticleStockCard`. API `/api/articles`, `/api/stock/articles/:id/movements`. `recomputeArticleStock`, `articleStockSummary`, `articleStockFields`, `articleSeasonTotals`, `changeArticleUnit`. `mainView` väärtus `stock`.

- [ ] **Step 1: Failide ümbernimetamine**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && \
git mv src/components/MaterialFormDialog.tsx src/components/ArticleFormDialog.tsx && \
git mv src/components/MaterialMergeDialog.tsx src/components/ArticleMergeDialog.tsx && \
git mv src/components/MaterialStockCard.tsx src/components/ArticleStockCard.tsx && \
git mv src/components/MaterialsView.tsx src/components/ArticlesView.tsx && \
git mv src/server/materialUnitChange.ts src/server/articleUnitChange.ts && \
git mv src/server/materialUnitChange.test.ts src/server/articleUnitChange.test.ts && \
git mv src/server/materialUsage.ts src/server/articleUsage.ts && \
git mv src/server/materialUsage.test.ts src/server/articleUsage.test.ts'
```

- [ ] **Step 2: Identifikaatorite asendus TS/CSS/skriptides**

Järjekord on oluline: kõigepealt erijuhud (`MaterialCategory` ei tohi saada `ArticleCategory`-ks, sest see nimi läheb T2-s Prisma mudelile; `usesMaterials` jääb).

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && \
FILES=$(grep -rlE "material|Material" src scripts --include=*.ts --include=*.tsx --include=*.mts --include=*.css --include=*.sql) && \
perl -pi -e "s/usesMaterials/__USES_MAT__/g; s/MaterialCategory/PriaArticleKind/g; s/materialCategoryFor/priaArticleKindFor/g; s/materialCategory/priaArticleKind/g; s/Materials/Articles/g; s/materials/articles/g; s/Material/Article/g; s/material/article/g; s/__USES_MAT__/usesMaterials/g" $FILES && \
grep -rnE "material|Material" src scripts --include=*.ts --include=*.tsx --include=*.mts --include=*.css --include=*.sql | grep -v usesMaterials | head'
```

Expected: viimane `grep` ei leia midagi.

- [ ] **Step 3: Asendus skeemis**

`prisma/schema.prisma`: enum `MaterialCategory` ja `usesMaterials` jäävad, muu nimetatakse ümber.

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && \
perl -pi -e "s/usesMaterials/__USES_MAT__/g; s/MaterialCategory/__MAT_CAT__/g; s/Materials/Articles/g; s/materials/articles/g; s/Material/Article/g; s/material/article/g; s/__USES_MAT__/usesMaterials/g; s/__MAT_CAT__/MaterialCategory/g" prisma/schema.prisma && \
grep -nE "material|Material|article_stock|@@map\(\"articles\"\)" prisma/schema.prisma'
```

Expected: leiab `enum MaterialCategory`, `category ... MaterialCategory`, `usesMaterials` (kaks mudelit), `@@map("articles")`, `@@map("article_stock")`. Paranda käsitsi kommentaar mudeli `Article` kohal ja `ArticleStock` kohal, et need ütleksid „Artikkel (kulumaterjal, hiljem ka teenus ja toodang)“ ja „Laoseisu koond artikli ja lao kaupa“. `Article.stockIssueCount` kommentaar jääb.

- [ ] **Step 4: Kasutajaliidese tekstid**

`src/components/Header.tsx` — menüünupp:

```tsx
            <button
              type="button"
              className={mainView === 'stock' ? 'active' : ''}
              aria-current={mainView === 'stock' ? 'page' : undefined}
              onClick={() => onChangeMainView('stock')}
            >
              <Package size={15} />
              <span>Laoarvestus</span>
            </button>
```

ja `MAIN_VIEWS` massiivis `'articles'` → `'stock'`. `src/App.tsx`: `changeMainView('articles')` → `changeMainView('stock')`, `mainView === 'articles'` → `mainView === 'stock'` (perl muutis `'materials'` → `'articles'`).

`src/components/ArticlesView.tsx`:
- päise kommentaar: `// src/components/ArticlesView.tsx — laoarvestus täislehena: artiklid, laokanded, laod`
- `<h2>Kulumaterjalid</h2>` → `<h2>Laoarvestus</h2>`
- alapealkiri → `Artiklid (kulumaterjalid, teenused, toodang), laokanded ja laod`
- vahekaardi nupp `>Materjalid<` → `>Artiklid<`

`App.tsx` kommentaar real „Kaardi huvipunkti lao link: avab kulumaterjalide vaate“ → „avab laoarvestuse vaate“.

- [ ] **Step 5: Tabelinimed tenancy skriptides**

Perl muutis juba `scripts/tenancy/02-rls.sql` ja `01-backfill.mts` loendis `'materials'` → `'articles'` ja `'material_stock'` → `'article_stock'`. Kontrolli:

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && grep -n "articles\|article_stock" scripts/tenancy/02-rls.sql scripts/tenancy/01-backfill.mts'
```

Expected: mõlemad nimed 02-rls.sql loendis.

- [ ] **Step 6: Tüübikontroll ilma andmebaasita**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx prisma generate && npx tsc --noEmit -p tsconfig.app.json'
```

Expected: vigadeta. Kui mõni import viitab vanale failinimele (nt `./MaterialsView`), paranda.

- [ ] **Step 7: SQL ümbernimetamise skript** `scripts/articles-rename.sql`

```sql
-- Material → Article: tabelid, veerud, piirangud ja indeksid. Andmed jäävad alles.
-- Käivita tabelite omanikuna ühe korra: psql "${MIGRATE_DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f scripts/articles-rename.sql
BEGIN;
ALTER TABLE materials RENAME TO articles;
ALTER TABLE material_stock RENAME TO article_stock;
ALTER TABLE article_stock RENAME COLUMN "materialId" TO "articleId";
ALTER TABLE work_entry_lines RENAME COLUMN "materialId" TO "articleId";
ALTER TABLE field_work_lines RENAME COLUMN "materialId" TO "articleId";
ALTER TABLE stock_document_lines RENAME COLUMN "materialId" TO "articleId";

-- Prisma vaikenimed (nt materials_pkey, work_entry_lines_materialId_idx) uutele nimedele, et db push neid ei looks uuesti
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.conname, c.conrelid::regclass::text AS tbl FROM pg_constraint c
           JOIN pg_namespace n ON n.oid = c.connamespace
           WHERE n.nspname = 'public' AND c.conname LIKE '%material%' LOOP
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', r.tbl, r.conname,
      replace(replace(r.conname, 'materials', 'articles'), 'material', 'article'));
  END LOOP;
  FOR r IN SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%material%' LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I', r.indexname,
      replace(replace(r.indexname, 'materials', 'articles'), 'material', 'article'));
  END LOOP;
END $$;
COMMIT;
```

Märkus: `usesMaterials` on veerg, mitte piirang/indeks — skript seda ei puuduta. RLS-poliitikad liiguvad tabeliga kaasa. `tenant_fk_materialId` trigerid viitavad vanale veerule ja luuakse 6. sammus uuesti.

- [ ] **Step 8: Varukoopia ja andmebaasi muutmine**

Live-rakendus on sammude 8–10 vahel katki (vana kood, uus andmebaas); kasutajaid pole, see on lubatud.

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && \
pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump && ls -t ~/backups | head -1 && \
psql "${MIGRATE_DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f scripts/articles-rename.sql && \
npx prisma db push && npx prisma generate && \
psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql && \
MIGRATE_DATABASE_URL="$MIGRATE_DATABASE_URL" npx tsx scripts/tenancy/05-tenant-fk-triggers.mts'
```

Expected: `COMMIT`, „Your database is now in sync“ (ilma andmekao hoiatuseta), `DO`, `OK: N trigerit`. Kui `db push` küsib andmekao kinnitust → peatu, ära kinnita, teata kasutajale.

- [ ] **Step 9: Testid**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test'
```

Expected: kõik rohelised.

- [ ] **Step 10: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add -A src scripts prisma && git commit -m "Artiklid: Material → Article ümbernimetamine (kood ja andmebaas), menüü Laoarvestus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

Kontrolli brauseris: menüüs „Laoarvestus“, vahekaart „Artiklid“ näitab endisi materjale koos laoseisuga; põllutöö kande materjalivalik töötab.

---

### Task 2: Artikli liigid (andmemudel, migratsioon, reeglid, API, olemasoleva UI kohandus)

**Files:**
- Create: `src/services/articleRules.ts`, `src/services/articleRules.test.ts`, `src/server/articleCategories.ts`, `src/server/articleCategories.test.ts`, `scripts/articles-categories.sql`
- Modify: `prisma/schema.prisma`, `scripts/tenancy/02-rls.sql`, `scripts/tenancy/01-backfill.mts`, `src/types/fieldWork.ts`, `src/services/pria.ts`, `src/server/fieldWorks.ts`, `src/server/fieldBookImport.ts`, `src/server/stock.ts`, `src/server/stock.test.ts`, `src/server/apiHandler.ts`, `src/server/mcp/testTenant.ts`, `src/services/api.ts`, `src/components/ArticleFormDialog.tsx`, `src/components/ArticlesView.tsx`, `src/components/ArticleMergeDialog.tsx`, `src/components/PriaLinesEditor.tsx`, `src/components/WorkRegisterModal.tsx`, muud testid, mis loovad artikli `category`-ga (leia: `grep -rn "category: '" src/server/*.test.ts src/server/mcp`)

**Interfaces:**
- Consumes (T1): `Article`, `articleId`, `PriaArticleKind`, `priaArticleKindFor`.
- Produces:
  - `src/services/articleRules.ts`: `type ArticleGroup = 'SERVICE' | 'CONSUMABLE' | 'PRODUCE' | 'OTHER_GOODS'`; `type ArticleSystemKind = 'LABOR_TIME' | 'MACHINE_TIME' | 'IMPLEMENT_TIME' | 'DRYING_TIME' | 'SEED' | 'FERTILIZER' | 'PLANT_PROTECTION' | 'FUEL' | 'DRYING_OIL' | 'GRAIN'`; `ARTICLE_GROUPS: ArticleGroup[]`; `ARTICLE_GROUP_LABEL: Record<ArticleGroup, string>`; `SYSTEM_CATEGORIES: { systemKind: ArticleSystemKind; group: ArticleGroup; name: string; sortOrder: number }[]`; `OTHER_CONSUMABLE_NAME = 'Muu kulumaterjal'`; `isGoods(group: ArticleGroup): boolean`; `articleFieldRules(group: ArticleGroup, systemKind: ArticleSystemKind | null): ArticleFieldRules`; `sanitizeArticleFields<T extends ArticleOptionalFields>(f: T, rules: ArticleFieldRules): T`; `matchesPriaKind(a: { group: ArticleGroup; systemKind: ArticleSystemKind | null }, kind: PriaArticleKind): boolean`; `categoryChangeError(old: { group: ArticleGroup; systemKind: ArticleSystemKind | null } | null, nextGroup: ArticleGroup): string | null`.
  - `src/server/articleCategories.ts`: `ensureArticleCategories(tx: TxClient): Promise<void>`; `systemCategoryId(tx: TxClient, kind: ArticleSystemKind): Promise<string>`; `categoryIdForPriaKind(tx: TxClient, kind: PriaArticleKind): Promise<string>`; `handleArticleCategories(req, res, pathname, method): Promise<boolean>`.
  - API `GET /api/article-categories` → `ArticleCategory[]` (`{ id, name, group, systemKind, sortOrder, isActive, articleCount }`); `POST /api/article-categories` (`{ id?, name, group, sortOrder?, isActive? }`); `DELETE /api/article-categories/:id`.
  - `/api/articles` rida: lisaks endistele `categoryId`, `category: { id, name, group, systemKind }`, `price: number | null`, `cropId`, `defaultWarehouseId`; `category` enum-väärtust enam pole.
  - Klient: `api.getArticleCategories()`, `api.saveArticleCategory(c)`, `api.deleteArticleCategory(id)`; tüübid `ArticleCategory`, `ArticleCategoryRef` (`src/types/fieldWork.ts`).

- [ ] **Step 1: Kirjuta reeglite testid** `src/services/articleRules.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  SYSTEM_CATEGORIES, isGoods, articleFieldRules, sanitizeArticleFields, matchesPriaKind, categoryChangeError
} from './articleRules';

describe('SYSTEM_CATEGORIES', () => {
  it('iga süsteemne liik üks kord ja õiges rühmas', () => {
    const kinds = SYSTEM_CATEGORIES.map((c) => c.systemKind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(SYSTEM_CATEGORIES.find((c) => c.systemKind === 'FUEL')).toMatchObject({ group: 'CONSUMABLE', name: 'Kütus' });
    expect(SYSTEM_CATEGORIES.find((c) => c.systemKind === 'GRAIN')).toMatchObject({ group: 'PRODUCE', name: 'Terad' });
    expect(SYSTEM_CATEGORIES.filter((c) => c.group === 'SERVICE')).toHaveLength(4);
  });
});

describe('isGoods', () => {
  it('teenus pole kaup, muud on', () => {
    expect(isGoods('SERVICE')).toBe(false);
    expect(isGoods('CONSUMABLE')).toBe(true);
    expect(isGoods('PRODUCE')).toBe(true);
    expect(isGoods('OTHER_GOODS')).toBe(true);
  });
});

describe('articleFieldRules', () => {
  it('teenusel hind, laoseisu ja ladu pole', () => {
    expect(articleFieldRules('SERVICE', 'MACHINE_TIME')).toMatchObject({ price: true, stock: false, defaultWarehouse: false, pria: false, crop: false });
  });
  it('seemnel PRIA ja sort, hinda pole', () => {
    expect(articleFieldRules('CONSUMABLE', 'SEED')).toMatchObject({ pria: true, seed: true, fertilizer: false, price: false, stock: true, defaultWarehouse: true });
  });
  it('väetisel NPK, taimekaitsel toimeaine', () => {
    expect(articleFieldRules('CONSUMABLE', 'FERTILIZER')).toMatchObject({ pria: true, fertilizer: true });
    expect(articleFieldRules('CONSUMABLE', 'PLANT_PROTECTION')).toMatchObject({ pria: true, plantProtection: true });
  });
  it('teradel kultuur', () => {
    expect(articleFieldRules('PRODUCE', 'GRAIN')).toMatchObject({ crop: true, pria: false, stock: true });
  });
  it('kasutaja liik kulumaterjalis: ainult laoväljad', () => {
    expect(articleFieldRules('CONSUMABLE', null)).toEqual({
      pria: false, seed: false, fertilizer: false, plantProtection: false, price: false, crop: false, defaultWarehouse: true, stock: true
    });
  });
});

describe('sanitizeArticleFields', () => {
  it('nullib liigiga sobimatud väljad', () => {
    const f = {
      price: 40, cropId: 'c1', defaultWarehouseId: 'w1', cropVarietyId: 'v1', priaRegister: 'R', priaKind: 'K', priaSpec: 'C1',
      activeIngredient: 'A', nPct: 10, pPct: 5, kPct: 3
    };
    expect(sanitizeArticleFields(f, articleFieldRules('SERVICE', 'LABOR_TIME'))).toEqual({
      price: 40, cropId: null, defaultWarehouseId: null, cropVarietyId: null, priaRegister: null, priaKind: null, priaSpec: null,
      activeIngredient: null, nPct: null, pPct: null, kPct: null
    });
    expect(sanitizeArticleFields(f, articleFieldRules('CONSUMABLE', 'FERTILIZER'))).toEqual({
      price: null, cropId: null, defaultWarehouseId: 'w1', cropVarietyId: null, priaRegister: 'R', priaKind: 'K', priaSpec: null,
      activeIngredient: null, nPct: 10, pPct: 5, kPct: 3
    });
  });
});

describe('matchesPriaKind', () => {
  it('PRIA liik vastab süsteemsele liigile', () => {
    expect(matchesPriaKind({ group: 'CONSUMABLE', systemKind: 'SEED' }, 'SEED')).toBe(true);
    expect(matchesPriaKind({ group: 'CONSUMABLE', systemKind: 'FERTILIZER' }, 'SEED')).toBe(false);
  });
  it('OTHER = kulumaterjal, mis pole seeme, väetis ega taimekaitse', () => {
    expect(matchesPriaKind({ group: 'CONSUMABLE', systemKind: null }, 'OTHER')).toBe(true);
    expect(matchesPriaKind({ group: 'CONSUMABLE', systemKind: 'FUEL' }, 'OTHER')).toBe(true);
    expect(matchesPriaKind({ group: 'CONSUMABLE', systemKind: 'SEED' }, 'OTHER')).toBe(false);
    expect(matchesPriaKind({ group: 'SERVICE', systemKind: null }, 'OTHER')).toBe(false);
    expect(matchesPriaKind({ group: 'PRODUCE', systemKind: 'GRAIN' }, 'OTHER')).toBe(false);
  });
});

describe('categoryChangeError', () => {
  it('uus liik: lubatud', () => {
    expect(categoryChangeError(null, 'OTHER_GOODS')).toBeNull();
  });
  it('süsteemset liiki ei saa teise rühma viia', () => {
    expect(categoryChangeError({ group: 'CONSUMABLE', systemKind: 'FUEL' }, 'OTHER_GOODS')).toMatch(/Süsteemse liigi rühma/);
    expect(categoryChangeError({ group: 'CONSUMABLE', systemKind: 'FUEL' }, 'CONSUMABLE')).toBeNull();
  });
  it('kasutaja liigi rühma ei saa teenuse ja kauba vahel muuta', () => {
    expect(categoryChangeError({ group: 'CONSUMABLE', systemKind: null }, 'SERVICE')).toMatch(/teenuse ja kauba/);
    expect(categoryChangeError({ group: 'CONSUMABLE', systemKind: null }, 'OTHER_GOODS')).toBeNull();
  });
});
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/services/articleRules.test.ts'`
Expected: FAIL (`Cannot find module './articleRules'`).

- [ ] **Step 3: Kirjuta** `src/services/articleRules.ts`

```ts
// src/services/articleRules.ts — artiklite liigitus ja liigist sõltuvad väljad (server ja klient)
import type { PriaArticleKind } from '../types/fieldWork.ts';

export type ArticleGroup = 'SERVICE' | 'CONSUMABLE' | 'PRODUCE' | 'OTHER_GOODS';
export type ArticleSystemKind =
  | 'LABOR_TIME' | 'MACHINE_TIME' | 'IMPLEMENT_TIME' | 'DRYING_TIME'
  | 'SEED' | 'FERTILIZER' | 'PLANT_PROTECTION' | 'FUEL' | 'DRYING_OIL'
  | 'GRAIN';

export const ARTICLE_GROUPS: ArticleGroup[] = ['SERVICE', 'CONSUMABLE', 'PRODUCE', 'OTHER_GOODS'];

export const ARTICLE_GROUP_LABEL: Record<ArticleGroup, string> = {
  SERVICE: 'Teenus',
  CONSUMABLE: 'Kulumaterjal',
  PRODUCE: 'Toodang',
  OTHER_GOODS: 'Muu kaup'
};

// Süsteemsed liigid: iga ettevõte saab need automaatselt; loogika käitub systemKind'i järgi
export const SYSTEM_CATEGORIES: { systemKind: ArticleSystemKind; group: ArticleGroup; name: string; sortOrder: number }[] = [
  { systemKind: 'LABOR_TIME', group: 'SERVICE', name: 'Töötaja tööaeg', sortOrder: 10 },
  { systemKind: 'MACHINE_TIME', group: 'SERVICE', name: 'Masina tööaeg', sortOrder: 20 },
  { systemKind: 'IMPLEMENT_TIME', group: 'SERVICE', name: 'Haakeriista tööaeg', sortOrder: 30 },
  { systemKind: 'DRYING_TIME', group: 'SERVICE', name: 'Kuivatamise tööaeg', sortOrder: 40 },
  { systemKind: 'SEED', group: 'CONSUMABLE', name: 'Seeme', sortOrder: 110 },
  { systemKind: 'FERTILIZER', group: 'CONSUMABLE', name: 'Väetis', sortOrder: 120 },
  { systemKind: 'PLANT_PROTECTION', group: 'CONSUMABLE', name: 'Taimekaitsevahend', sortOrder: 130 },
  { systemKind: 'FUEL', group: 'CONSUMABLE', name: 'Kütus', sortOrder: 140 },
  { systemKind: 'DRYING_OIL', group: 'CONSUMABLE', name: 'Kuivatusõli', sortOrder: 150 },
  { systemKind: 'GRAIN', group: 'PRODUCE', name: 'Terad', sortOrder: 210 }
];

// PRIA import paneb muud kulumaterjalid sellesse liiki (luuakse vajadusel)
export const OTHER_CONSUMABLE_NAME = 'Muu kulumaterjal';

const PRIA_KINDS: ReadonlySet<ArticleSystemKind> = new Set(['SEED', 'FERTILIZER', 'PLANT_PROTECTION']);

/** Kaup = laoarvestusega artikkel; teenuse üle laoarvestust ei peeta. */
export const isGoods = (group: ArticleGroup): boolean => group !== 'SERVICE';

export interface ArticleFieldRules {
  pria: boolean; // PRIA register ja liik
  seed: boolean; // sort ja seemne kategooria
  fertilizer: boolean; // N, P, K %
  plantProtection: boolean; // toimeaine
  price: boolean; // teenuse ühiku hind
  crop: boolean; // terade kultuur
  defaultWarehouse: boolean; // kauba vaikimisi ladu
  stock: boolean; // laoseis
}

export function articleFieldRules(group: ArticleGroup, systemKind: ArticleSystemKind | null): ArticleFieldRules {
  const goods = isGoods(group);
  return {
    pria: !!systemKind && PRIA_KINDS.has(systemKind),
    seed: systemKind === 'SEED',
    fertilizer: systemKind === 'FERTILIZER',
    plantProtection: systemKind === 'PLANT_PROTECTION',
    price: !goods,
    crop: systemKind === 'GRAIN',
    defaultWarehouse: goods,
    stock: goods
  };
}

export interface ArticleOptionalFields {
  price: number | null;
  cropId: string | null;
  defaultWarehouseId: string | null;
  cropVarietyId: string | null;
  priaRegister: string | null;
  priaKind: string | null;
  priaSpec: string | null;
  activeIngredient: string | null;
  nPct: number | null;
  pPct: number | null;
  kPct: number | null;
}

/** Liigiga sobimatud väljad tühjendatakse (nt liigi muutmisel). */
export function sanitizeArticleFields<T extends ArticleOptionalFields>(f: T, r: ArticleFieldRules): T {
  return {
    ...f,
    price: r.price ? f.price : null,
    cropId: r.crop ? f.cropId : null,
    defaultWarehouseId: r.defaultWarehouse ? f.defaultWarehouseId : null,
    cropVarietyId: r.seed ? f.cropVarietyId : null,
    priaRegister: r.pria ? f.priaRegister : null,
    priaKind: r.pria ? f.priaKind : null,
    priaSpec: r.seed ? f.priaSpec : null,
    activeIngredient: r.plantProtection ? f.activeIngredient : null,
    nPct: r.fertilizer ? f.nPct : null,
    pPct: r.fertilizer ? f.pPct : null,
    kPct: r.fertilizer ? f.kPct : null
  };
}

/** Kas artikkel sobib PRIA tegevuse materjalireale (OTHER = muu kulumaterjal). */
export function matchesPriaKind(a: { group: ArticleGroup; systemKind: ArticleSystemKind | null }, kind: PriaArticleKind): boolean {
  if (kind === 'OTHER') return a.group === 'CONSUMABLE' && !(a.systemKind && PRIA_KINDS.has(a.systemKind));
  return a.systemKind === kind;
}

/** Liigi lisamise/muutmise kontroll; null = lubatud. */
export function categoryChangeError(
  old: { group: ArticleGroup; systemKind: ArticleSystemKind | null } | null,
  nextGroup: ArticleGroup
): string | null {
  if (!old || old.group === nextGroup) return null;
  if (old.systemKind) return 'Süsteemse liigi rühma ei saa muuta';
  if (isGoods(old.group) !== isGoods(nextGroup)) return 'Liiki ei saa teenuse ja kauba vahel ümber tõsta';
  return null;
}
```

- [ ] **Step 4: Käivita — peab läbima**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/services/articleRules.test.ts'`
Expected: PASS.

- [ ] **Step 5: Skeem**

`prisma/schema.prisma`:
1. Eemalda `enum MaterialCategory { ... }`, lisa samasse kohta:

```prisma
enum ArticleGroup {
  SERVICE // teenus — laoarvestust pole
  CONSUMABLE // kulumaterjal
  PRODUCE // toodang
  OTHER_GOODS // muu kaup
}

// Süsteemne liik: loogika käitub selle järgi (src/services/articleRules.ts). Kasutaja loodud liigil null.
enum ArticleSystemKind {
  LABOR_TIME // töötaja tööaeg
  MACHINE_TIME // masina tööaeg
  IMPLEMENT_TIME // haakeriista tööaeg
  DRYING_TIME // kuivatamise tööaeg
  SEED // seeme: sort, PRIA
  FERTILIZER // väetis: NPK, PRIA
  PLANT_PROTECTION // taimekaitsevahend: toimeaine, PRIA
  FUEL // kütus
  DRYING_OIL // kuivatusõli
  GRAIN // terad: kultuur
}

// Artikli liik; süsteemsed liigid luuakse automaatselt (src/server/articleCategories.ts)
model ArticleCategory {
  id         String             @id @default(cuid())
  tenantId   String             @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  name       String
  group      ArticleGroup
  systemKind ArticleSystemKind? // süsteemne liik; ei saa kustutada ega teise rühma viia
  sortOrder  Int                @default(0)
  isActive   Boolean            @default(true)
  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt
  createdBy  String? // looja kasutajatunnus (täidetakse automaatselt)
  updatedBy  String? // viimase muutja kasutajatunnus (täidetakse automaatselt)

  articles Article[]

  @@unique([tenantId, name])
  @@unique([tenantId, systemKind])
  @@index([tenantId])
  @@map("article_categories")
}
```

2. Mudelis `Article`: rida `category MaterialCategory` → `categoryId String // liik`; lisa `cropVarietyId` järele:

```prisma
  price              Decimal?         @db.Decimal(12, 4) // ainult teenusel: ühiku (tunni) hind
  cropId             String? // ainult terade liigil: kultuur
  defaultWarehouseId String? // ainult kaubal: vaikimisi ladu
```

relatsioonid (`cropVariety` järele):

```prisma
  category         ArticleCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  crop             Crop?           @relation(fields: [cropId], references: [id], onDelete: SetNull)
  defaultWarehouse Warehouse?      @relation("ArticleDefaultWarehouse", fields: [defaultWarehouseId], references: [id], onDelete: SetNull)
```

`@@unique([tenantId, category, name])` → `@@unique([tenantId, categoryId, name])`; lisa `@@index([categoryId])`, `@@index([cropId])`, `@@index([defaultWarehouseId])`.

3. Vastasseosed: mudelis `Crop` lisa `articles Article[]`; mudelis `Warehouse` lisa `defaultFor Article[] @relation("ArticleDefaultWarehouse")`.

4. `scripts/tenancy/02-rls.sql` ja `scripts/tenancy/01-backfill.mts` loendisse `'articles'` järele `'article_categories'`.

- [ ] **Step 6: Migratsiooni SQL** `scripts/articles-categories.sql`

Süsteemsete liikide loend peab vastama `SYSTEM_CATEGORIES`-ile (Global Constraints tabel).

```sql
-- Artikli liigid: MaterialCategory enum → article_categories tabel. Andmed jäävad alles.
-- Käivita ühe korra tabelite omanikuna: psql "${MIGRATE_DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f scripts/articles-categories.sql
-- Pärast seda: npx prisma db push (lisab unikaalsused, indeksid, välisvõtmed ja price/cropId/defaultWarehouseId).
BEGIN;
CREATE TYPE "ArticleGroup" AS ENUM ('SERVICE', 'CONSUMABLE', 'PRODUCE', 'OTHER_GOODS');
CREATE TYPE "ArticleSystemKind" AS ENUM ('LABOR_TIME', 'MACHINE_TIME', 'IMPLEMENT_TIME', 'DRYING_TIME', 'SEED', 'FERTILIZER', 'PLANT_PROTECTION', 'FUEL', 'DRYING_OIL', 'GRAIN');

CREATE TABLE article_categories (
  id           text PRIMARY KEY,
  tenant_id    text NOT NULL DEFAULT current_setting('app.tenant_id'),
  name         text NOT NULL,
  "group"      "ArticleGroup" NOT NULL,
  "systemKind" "ArticleSystemKind",
  "sortOrder"  integer NOT NULL DEFAULT 0,
  "isActive"   boolean NOT NULL DEFAULT true,
  "createdAt"  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  timestamp(3) NOT NULL,
  "createdBy"  text,
  "updatedBy"  text
);

-- Iga ettevõte: süsteemsed liigid + „Muu kulumaterjal“
INSERT INTO article_categories (id, tenant_id, name, "group", "systemKind", "sortOrder", "updatedAt")
SELECT gen_random_uuid()::text, t.id, c.name, c.grp::"ArticleGroup", c.kind::"ArticleSystemKind", c.sort, CURRENT_TIMESTAMP
FROM tenants t
CROSS JOIN (VALUES
  ('Töötaja tööaeg', 'SERVICE', 'LABOR_TIME', 10),
  ('Masina tööaeg', 'SERVICE', 'MACHINE_TIME', 20),
  ('Haakeriista tööaeg', 'SERVICE', 'IMPLEMENT_TIME', 30),
  ('Kuivatamise tööaeg', 'SERVICE', 'DRYING_TIME', 40),
  ('Seeme', 'CONSUMABLE', 'SEED', 110),
  ('Väetis', 'CONSUMABLE', 'FERTILIZER', 120),
  ('Taimekaitsevahend', 'CONSUMABLE', 'PLANT_PROTECTION', 130),
  ('Kütus', 'CONSUMABLE', 'FUEL', 140),
  ('Kuivatusõli', 'CONSUMABLE', 'DRYING_OIL', 150),
  ('Terad', 'PRODUCE', 'GRAIN', 210),
  ('Muu kulumaterjal', 'CONSUMABLE', NULL, 190)
) AS c(name, grp, kind, sort);

ALTER TABLE articles ADD COLUMN "categoryId" text;
UPDATE articles a SET "categoryId" = c.id
FROM article_categories c
WHERE c.tenant_id = a.tenant_id
  AND ((a.category = 'SEED' AND c."systemKind" = 'SEED')
    OR (a.category = 'FERTILIZER' AND c."systemKind" = 'FERTILIZER')
    OR (a.category = 'PLANT_PROTECTION' AND c."systemKind" = 'PLANT_PROTECTION')
    OR (a.category = 'OTHER' AND c."systemKind" IS NULL AND c.name = 'Muu kulumaterjal'));
ALTER TABLE articles ALTER COLUMN "categoryId" SET NOT NULL;

-- Vana unikaalsus (tenant, category, name) ja veerg ära; db push loob (tenant, categoryId, name)
DROP INDEX IF EXISTS "articles_tenantId_category_name_key";
ALTER TABLE articles DROP COLUMN category;
DROP TYPE "MaterialCategory";
COMMIT;
```

- [ ] **Step 7: Kirjuta serveri liikide moodul** `src/server/articleCategories.ts`

```ts
// src/server/articleCategories.ts — artikli liigid: süsteemsete liikide tagamine ja liikide API.
// Liike muudavad ainult finantsjuht ja admin; süsteemset liiki ei kustutata ega viida teise rühma.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, tenantTransaction, type TxClient } from './db.ts';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';
import {
  SYSTEM_CATEGORIES, OTHER_CONSUMABLE_NAME, ARTICLE_GROUPS, categoryChangeError,
  type ArticleGroup, type ArticleSystemKind
} from '../services/articleRules.ts';
import type { PriaArticleKind } from '../types/fieldWork.ts';

const FORBIDDEN = 'Artikli liike muudavad ainult finantsjuht ja admin';
const canManage = (req: IncomingMessage) => {
  const u = sessionUserOf(req) as { isAdmin?: boolean; isFinanceManager?: boolean } | null;
  return u?.isAdmin === true || u?.isFinanceManager === true;
};

/** Loob puuduvad süsteemsed liigid (korduvkäivitatav; uus ettevõte saab need esimesel kasutusel). */
export async function ensureArticleCategories(tx: TxClient): Promise<void> {
  await tx.articleCategory.createMany({
    data: SYSTEM_CATEGORIES.map((c) => ({ name: c.name, group: c.group, systemKind: c.systemKind, sortOrder: c.sortOrder })),
    skipDuplicates: true
  });
}

export async function systemCategoryId(tx: TxClient, kind: ArticleSystemKind): Promise<string> {
  const found = await tx.articleCategory.findFirst({ where: { systemKind: kind }, select: { id: true } });
  if (found) return found.id;
  await ensureArticleCategories(tx);
  return (await tx.articleCategory.findFirstOrThrow({ where: { systemKind: kind }, select: { id: true } })).id;
}

/** PRIA impordi materjali liik: seeme/väetis/taimekaitse süsteemsest liigist, muu → „Muu kulumaterjal“. */
export async function categoryIdForPriaKind(tx: TxClient, kind: PriaArticleKind): Promise<string> {
  if (kind !== 'OTHER') return systemCategoryId(tx, kind);
  const found = await tx.articleCategory.findFirst({ where: { name: OTHER_CONSUMABLE_NAME, group: 'CONSUMABLE' }, select: { id: true } });
  if (found) return found.id;
  return (await tx.articleCategory.create({ data: { name: OTHER_CONSUMABLE_NAME, group: 'CONSUMABLE', sortOrder: 190 } })).id;
}

const text = (v: unknown, max = 120): string | null => {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
};

export async function handleArticleCategories(req: IncomingMessage, res: ServerResponse, pathname: string, method: string): Promise<boolean> {
  if (!pathname.startsWith('/api/article-categories')) return false;

  if (pathname === '/api/article-categories' && method === 'GET') {
    const rows = await tenantTransaction(async (tx) => {
      await ensureArticleCategories(tx);
      return tx.articleCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { _count: { select: { articles: true } } } });
    });
    json(res, rows.map(({ _count, createdAt, updatedAt, ...c }) => ({ ...c, articleCount: _count.articles })));
    return true;
  }

  if (!canManage(req)) {
    json(res, { error: FORBIDDEN }, 403);
    return true;
  }

  if (pathname === '/api/article-categories' && method === 'POST') {
    const b = await parseBody(req, 16 * 1024);
    const name = text(b?.name);
    const group = ARTICLE_GROUPS.includes(b?.group) ? (b.group as ArticleGroup) : null;
    if (!name || !group) {
      json(res, { error: 'Liigi nimi ja rühm on kohustuslikud' }, 400);
      return true;
    }
    const id = text(b?.id, 64);
    const old = id ? await prisma.articleCategory.findUnique({ where: { id }, select: { group: true, systemKind: true } }) : null;
    if (id && !old) {
      json(res, { error: 'Liiki ei leitud' }, 404);
      return true;
    }
    const err = categoryChangeError(old, group);
    if (err) {
      json(res, { error: err }, 400);
      return true;
    }
    const data = { name, group, sortOrder: Number.isFinite(Number(b?.sortOrder)) ? Math.trunc(Number(b.sortOrder)) : 0, isActive: b?.isActive !== false };
    try {
      const saved = id ? await prisma.articleCategory.update({ where: { id }, data }) : await prisma.articleCategory.create({ data });
      json(res, saved);
    } catch (e: any) {
      if (e?.code === 'P2002') json(res, { error: 'Selle nimega liik on juba olemas' }, 409);
      else throw e;
    }
    return true;
  }

  if (pathname.startsWith('/api/article-categories/') && method === 'DELETE') {
    const id = decodeURIComponent(pathname.slice('/api/article-categories/'.length));
    const c = await prisma.articleCategory.findUnique({ where: { id }, include: { _count: { select: { articles: true } } } });
    if (!c) {
      json(res, { error: 'Liiki ei leitud' }, 404);
      return true;
    }
    if (c.systemKind) {
      json(res, { error: 'Süsteemset liiki ei saa kustutada' }, 409);
      return true;
    }
    if (c._count.articles) {
      json(res, { error: `Liigis on ${c._count.articles} artiklit. Vii need enne teise liiki.` }, 409);
      return true;
    }
    await prisma.articleCategory.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }
  return false;
}
```

`src/server/apiHandler.ts`: lisa import `import { handleArticleCategories } from './articleCategories.ts';` ja `handleFieldWorks` rea ette:

```ts
    if (await handleArticleCategories(req, res, pathname, method)) return;
```

- [ ] **Step 8: Kirjuta andmebaasi testid** `src/server/articleCategories.test.ts`

```ts
// Artikli liigid ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { ensureArticleCategories, systemCategoryId, categoryIdForPriaKind } from './articleCategories';
import { saveStockDocument, getDefaultWarehouseId, StockValidationError } from './stock';

const T = `test-tenant-artcat-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test liigid' } });
});

afterAll(async () => {
  await run(async () => {
    await prisma.stockDocument.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.warehouse.deleteMany({});
  });
  await authDb().tenant.delete({ where: { id: T } });
});

describe('ensureArticleCategories', () => {
  it('loob süsteemsed liigid üks kord', async () => {
    await run(() => tenantTransaction(async (tx) => { await ensureArticleCategories(tx); await ensureArticleCategories(tx); }));
    const rows = await run(() => prisma.articleCategory.findMany({ where: { systemKind: { not: null } } }));
    expect(rows).toHaveLength(10);
  });
  it('ümbernimetatud süsteemset liiki ei looda uuesti', async () => {
    const id = await run(() => tenantTransaction((tx) => systemCategoryId(tx, 'FUEL')));
    await run(() => prisma.articleCategory.update({ where: { id }, data: { name: 'Diisel ja bensiin' } }));
    await run(() => tenantTransaction((tx) => ensureArticleCategories(tx)));
    expect(await run(() => prisma.articleCategory.count({ where: { systemKind: 'FUEL' } }))).toBe(1);
  });
});

describe('categoryIdForPriaKind', () => {
  it('OTHER loob „Muu kulumaterjal“ liigi ja kasutab seda edaspidi', async () => {
    const a = await run(() => tenantTransaction((tx) => categoryIdForPriaKind(tx, 'OTHER')));
    const b = await run(() => tenantTransaction((tx) => categoryIdForPriaKind(tx, 'OTHER')));
    expect(a).toBe(b);
    expect(await run(() => prisma.articleCategory.findUnique({ where: { id: a } }))).toMatchObject({ name: 'Muu kulumaterjal', group: 'CONSUMABLE', systemKind: null });
  });
  it('SEED annab süsteemse seemne liigi', async () => {
    const id = await run(() => tenantTransaction((tx) => categoryIdForPriaKind(tx, 'SEED')));
    expect(await run(() => prisma.articleCategory.findUnique({ where: { id } }))).toMatchObject({ systemKind: 'SEED' });
  });
});

describe('laokanne', () => {
  it('teenust ei saa laokandele panna', async () => {
    const catId = await run(() => tenantTransaction((tx) => systemCategoryId(tx, 'MACHINE_TIME')));
    const art = await run(() => prisma.article.create({ data: { name: 'Testmasina tund', categoryId: catId, unit: 'h' } }));
    const wh = await run(() => tenantTransaction((tx) => getDefaultWarehouseId(tx)));
    await expect(run(() => tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'RECEIPT', date: new Date('2026-05-01T00:00:00Z'), warehouseId: wh, toWarehouseId: null, supplierId: null,
      documentNo: null, writeOffReason: null, notes: null, lines: [{ articleId: art.id, quantity: 1, amount: 10 }]
    })))).rejects.toBeInstanceOf(StockValidationError);
  });
});
```

Kontrolli `StockDocumentInput` välju failist `src/server/stockRules.ts` (perl nimetas `materialId` → `articleId`) ja kohanda objektiliteraal täpselt sellele tüübile.

- [ ] **Step 9: Laokandel ainult kaubad** — `src/server/stock.ts` funktsioonis `saveStockDocument` asenda artiklite loendamine:

```ts
  const arts = await tx.article.findMany({ where: { id: { in: doc.lines.map((l) => l.articleId) } }, select: { category: { select: { group: true } } } });
  if (arts.length !== new Set(doc.lines.map((l) => l.articleId)).size) throw new StockValidationError('Artiklit ei leitud');
  if (arts.some((a) => a.category.group === 'SERVICE')) throw new StockValidationError('Teenust ei saa laokandele panna');
```

- [ ] **Step 10: `/api/articles` liigiga** — `src/server/fieldWorks.ts`

1. Eemalda `const MATERIAL_CATEGORIES = ...` rida.
2. Impordid: `import { articleFieldRules, sanitizeArticleFields } from '../services/articleRules.ts';` ja `import { ensureArticleCategories } from './articleCategories.ts';`
3. GET `/api/articles`: `orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }]`, `include: { _count: { select: { entryLines: true } }, category: { select: { id: true, name: true, group: true, systemKind: true } } }`. Vastuses `price: m.price === null ? null : (finance ? Number(m.price) : null)` (hinda näeb ainult finantsõigusega).
4. POST `/api/articles`: asenda `category` valideerimine:

```ts
    const categoryId = text(b?.categoryId, 64);
    const unit = text(b?.unit, 16);
    const category = categoryId ? await prisma.articleCategory.findUnique({ where: { id: categoryId }, select: { group: true, systemKind: true } }) : null;
    if (!name || !category || !unit) {
      json(res, { error: 'Artikli nimi, liik ja ühik on kohustuslikud' }, 400);
      return true;
    }
    const rules = articleFieldRules(category.group, category.systemKind);
    const optional = sanitizeArticleFields({
      price: canSeeFinance(req) ? num(b?.price) : null, cropId: text(b?.cropId, 64), defaultWarehouseId: text(b?.defaultWarehouseId, 64),
      cropVarietyId: text(b?.cropVarietyId, 64), priaRegister: text(b?.priaRegister, 120), priaKind: text(b?.priaKind, 120),
      priaSpec: text(b?.priaSpec, 20), activeIngredient: text(b?.activeIngredient, 500), nPct: num(b?.nPct), pPct: num(b?.pPct), kPct: num(b?.kPct)
    }, rules);
    const data = { name, categoryId: categoryId!, unit, manufacturer: text(b?.manufacturer, 160), isActive: b?.isActive !== false,
      composition: text(b?.composition, 4000), notes: text(b?.notes, 4000), ...optional };
```

   Muutmisel ilma finantsõiguseta jääb vana hind alles: kui `id` ja `!canSeeFinance(req)`, eemalda `data`-st `price` (`delete (data as any).price`). Teenuse liigiga artikli puhul ei tohi olla laokanderidu: kui `old` oli kaup ja uus liik on teenus ning `stockDocumentLine.count({ where: { articleId: id } }) > 0` → 409 „Artiklil on laokandeid, seda ei saa teenuseks muuta“.
5. Unikaalsuse viga P2002 → `'Selles liigis on sellise nimega artikkel juba olemas'`.
6. Merge (`/api/articles/:id/merge`): `source.category !== target.category` → `source.categoryId !== target.categoryId`; tekst `'Asendada saab ainult sama liigi artikliga'`.
7. Kõik ülejäänud vead ja tekstid, kus kasutajale öeldakse „Materjal …“, jäävad (kulumaterjali kontekst) — v.a. üldised API veateated, mis muutuvad „Artikkel …“.

- [ ] **Step 11: PRIA import liigi kaudu** — `src/server/fieldBookImport.ts` funktsioon (perl nimetas selle `articleFor`):

```ts
async function articleFor(tx: Tx, line: OperationLine, cache: Map<string, { id: string; name: string }>): Promise<string | null> {
  if (line.kind !== 'MATERIAL' || !line.priaArticleKind) return null;
  const key = `${line.priaArticleKind}:${nameKey(line.label)}`;
  let hit = cache.get(key);
  if (!hit) {
    const categoryId = await categoryIdForPriaKind(tx, line.priaArticleKind);
    const existing = await tx.article.findFirst({ where: { categoryId, name: { equals: line.label, mode: 'insensitive' } } })
      ?? await tx.article.findFirst({ where: { categoryId, aliases: { has: nameKey(line.label) } } });
    hit = existing ?? await tx.article.create({ data: { name: line.label, categoryId, unit: line.unit || 'kg' } });
    cache.set(key, { id: hit.id, name: hit.name });
  }
  // Varunime järgi leitud artikkel: real kasutatakse artikli õiget nime (asendatud kirjaviga ei tule tagasi)
  if (nameKey(hit.name) !== nameKey(line.label)) line.label = hit.name;
  return hit.id;
}
```

lisa import `import { categoryIdForPriaKind } from './articleCategories.ts';`. Kontrolli, et `Tx` tüüp on ühilduv `TxClient`-iga (kui `Tx` on teine alias, kasuta `tx as TxClient`).

- [ ] **Step 12: Testid, mis loovad artikleid** — asenda iga `prisma.article.create({ data: { ..., category: 'X', ... } })` (stock.test.ts, articleUnitChange.test.ts, articleUsage.test.ts, mcp/testTenant.ts jt; leia `grep -rn "category: '" src/server`):

```ts
const catId = await tenantTransaction((tx) => systemCategoryId(tx, 'FERTILIZER'));
... prisma.article.create({ data: { name: 'Testväetis', categoryId: catId, unit: 'kg' } })
```

(`'OTHER'` → `categoryIdForPriaKind(tx, 'OTHER')`). Ajutise ettevõtte `afterAll` koristuses lisa `prisma.articleCategory.deleteMany({})` pärast artiklite kustutamist.

- [ ] **Step 13: Kliendi tüübid ja API** — `src/types/fieldWork.ts`

1. Eemalda `MATERIAL_CATEGORY_LABEL` (perl jättis nime samaks).
2. Lisa:

```ts
import type { ArticleGroup, ArticleSystemKind } from '../services/articleRules';

// Artikli liik
export interface ArticleCategory {
  id: string;
  name: string;
  group: ArticleGroup;
  systemKind: ArticleSystemKind | null;
  sortOrder: number;
  isActive: boolean;
  articleCount?: number;
}
export type ArticleCategoryRef = Pick<ArticleCategory, 'id' | 'name' | 'group' | 'systemKind'>;
```

3. `Article`: `category: PriaArticleKind;` → `categoryId: string; category: ArticleCategoryRef;` ja lisa `price?: number | null; // teenuse ühiku hind (ainult finantsõigusega)`, `cropId?: string | null; // terade kultuur`, `defaultWarehouseId?: string | null; // kauba vaikimisi ladu`.
4. `NEW_MATERIAL` → `NEW_ARTICLE` (kõik kasutuskohad).

`src/services/api.ts` artiklite plokki:

```ts
  async getArticleCategories(): Promise<ArticleCategory[]> {
    return jsonOrThrow(await apiFetch('/api/article-categories'), 'Artikli liikide laadimine ebaõnnestus');
  },
  async saveArticleCategory(c: Partial<ArticleCategory>): Promise<ArticleCategory> {
    return jsonOrThrow(await apiFetch('/api/article-categories', jsonInit('POST', c)), 'Liigi salvestamine ebaõnnestus');
  },
  async deleteArticleCategory(id: string): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/article-categories/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Liigi kustutamine ebaõnnestus');
  },
```

(lisa `ArticleCategory` tüübi import).

- [ ] **Step 14: Olemasoleva kasutajaliidese kohandus** (et kõik kompileeruks ja töötaks nagu enne)

`src/services/pria.ts`: `priaArticleKindFor` jääb samaks (tagastab `PriaArticleKind`, sh `'OTHER'`).

`src/components/PriaLinesEditor.tsx`:

```ts
  const kind = priaArticleKindFor(activity);
  const options = articles.filter((m) => (matchesPriaKind(m.category, kind) && m.isActive) || rows.some((r) => r.articleId === m.id));
```

(import `matchesPriaKind` failist `../services/articleRules`).

`src/components/ArticleMergeDialog.tsx`: filter `m.category === source.category` → `m.categoryId === source.categoryId`; valiku tekst `– vali {source.category.name.toLowerCase()} –`.

`src/components/WorkRegisterModal.tsx`: `MATERIAL_CATEGORY_LABEL[m.category]` → `m.category.name`.

`src/components/ArticleFormDialog.tsx`:
- laadi liigid: `const [categories, setCategories] = useState<ArticleCategory[]>([]);` ja `useEffect` sees `api.getArticleCategories().then(setCategories).catch(() => setCategories([]));`
- `const cat = categories.find((c) => c.id === form.categoryId);` `const rules = cat ? articleFieldRules(cat.group, cat.systemKind) : null;`
- `REGISTERS` võti `ArticleSystemKind`-iks: `const REGISTERS: Partial<Record<ArticleSystemKind, readonly string[]>> = { SEED: ..., FERTILIZER: ..., PLANT_PROTECTION: ... };`
- liigi valik:

```tsx
              <select id="mt-cat" className="form-input" required value={form.categoryId ?? ''} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="" disabled>– vali –</option>
                {ARTICLE_GROUPS.map((g) => {
                  const list = categories.filter((c) => c.group === g && (c.isActive || c.id === form.categoryId));
                  return list.length ? (
                    <optgroup key={g} label={ARTICLE_GROUP_LABEL[g]}>
                      {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  ) : null;
                })}
              </select>
```

- PRIA plokk: `form.category && REGISTERS[form.category]` → `rules?.pria && cat?.systemKind && REGISTERS[cat.systemKind]`; `form.category === 'SEED'` → `rules?.seed`; `'PLANT_PROTECTION'` → `rules?.plantProtection`; `'FERTILIZER'` → `rules?.fertilizer`; datalist `all.filter((m) => m.categoryId === form.categoryId)`.
- `save`: payload kokku `sanitizeArticleFields`-iga:

```ts
    if (!rules) return alertDialog('Vali liik');
    const payload: Partial<Article> & { unitFactor?: number | null } = {
      ...form,
      ...sanitizeArticleFields({
        price: form.price ?? null, cropId: form.cropId ?? null, defaultWarehouseId: form.defaultWarehouseId ?? null,
        cropVarietyId: form.cropVarietyId ?? null, priaRegister: form.priaRegister || null, priaKind: form.priaKind || null,
        priaSpec: form.priaSpec || null, activeIngredient: form.activeIngredient || null,
        nPct: parsePct(pct.nPct), pPct: parsePct(pct.pPct), kPct: parsePct(pct.kPct)
      }, rules),
      unitFactor: unitChanged ? parsePct(unitFactor) ?? autoFactor : null
    };
```

- pealkiri `Muuda materjali:` → `Muuda artiklit:`, `Lisa materjal` → `Lisa artikkel`.

`src/components/ArticlesView.tsx`:
- `category` olek → `const [group, setGroup] = useState<ArticleGroup | 'all'>('all');`, filter `group === 'all' || m.category.group === group`.
- vahekaardid `ARTICLE_GROUPS.map((g) => …)` sildiga `ARTICLE_GROUP_LABEL[g]`, loendur `articles.filter((m) => m.category.group === g).length`.
- tabeli veerg „Liik“: `{m.category.name}`; CSV: `` `"${m.category.name}"` ``.
- tühja nimekirja tekst: `'Artikleid pole. Lisa seemned, väetised, taimekaitsevahendid ja teenused.'`, `'Otsingule vastavaid artikleid ei leitud.'`; nupp „Lisa materjal“ → „Lisa artikkel“; kustutamise küsimus `materjali` → `artikli`.

- [ ] **Step 15: Tüübikontroll** (vana andmebaasiga, `prisma generate` loeb ainult skeemi)

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx prisma generate && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/services'
```

Expected: vigadeta, PASS.

- [ ] **Step 16: Varukoopia, migratsioon, skeem**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && \
pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump && ls -t ~/backups | head -1 && \
psql "${MIGRATE_DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f scripts/articles-categories.sql && \
npx prisma db push && npx prisma generate && \
psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql && \
MIGRATE_DATABASE_URL="$MIGRATE_DATABASE_URL" npx tsx scripts/tenancy/05-tenant-fk-triggers.mts && \
psql "${PLATFORM_DATABASE_URL%%\?*}" -At -c "select c.name, count(a.id) from article_categories c left join articles a on a.\"categoryId\" = c.id group by 1 order by 1"'
```

Expected: `COMMIT`; db push ilma andmekao hoiatuseta (kui küsib → peatu); viimane päring näitab artiklite arvu liikide kaupa (seeme, väetis, taimekaitse, muu kulumaterjal vastavalt endistele kategooriatele).

- [ ] **Step 17: Kõik testid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test'`
Expected: PASS.

- [ ] **Step 18: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add -A src scripts prisma && git commit -m "Artiklid: liigid (rühm + süsteemne/kasutaja liik), teenuse hind, kultuur, vaikimisi ladu andmemudelis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

Kontrolli brauseris: artiklite vahekaart näitab rühmi; artikli vormis liik on rühmade kaupa; seemne/väetise/taimekaitse PRIA väljad nagu enne; põllutöö kande ja plaani materjalivalik näitab õigeid artikleid.

---

### Task 3: Liikide haldus ja liigist sõltuvad väljad kasutajaliideses

**Files:**
- Create: `src/components/ArticleCategoriesDialog.tsx`
- Modify: `src/components/ArticlesView.tsx`, `src/components/ArticleFormDialog.tsx`, `src/components/StockDocumentDialog.tsx`, `src/components/PriaLinesEditor.tsx` (ainult kontroll), `src/index.css`

**Interfaces:**
- Consumes (T2): `api.getArticleCategories/saveArticleCategory/deleteArticleCategory`, `ArticleCategory`, `ARTICLE_GROUPS`, `ARTICLE_GROUP_LABEL`, `articleFieldRules`, `isGoods`, `Article.price/cropId/defaultWarehouseId/category`.
- Produces: `ArticleCategoriesDialog` (`{ onClose: () => void; onChanged: () => void }`).

- [ ] **Step 1: Liikide haldus** `src/components/ArticleCategoriesDialog.tsx`

```tsx
// src/components/ArticleCategoriesDialog.tsx — artikli liikide haldus (finantsjuht / admin).
// Süsteemset liiki saab ümber nimetada ja peita, mitte kustutada ega teise rühma viia.
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tags, X, Plus, Trash2, Lock } from 'lucide-react';
import { api } from '../services/api';
import { alertDialog, confirmDialog } from './ConfirmDialog';
import type { ArticleCategory } from '../types/fieldWork';
import { ARTICLE_GROUPS, ARTICLE_GROUP_LABEL, type ArticleGroup } from '../services/articleRules';

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

export const ArticleCategoriesDialog: React.FC<Props> = ({ onClose, onChanged }) => {
  const [rows, setRows] = useState<ArticleCategory[]>([]);
  const [draft, setDraft] = useState<{ name: string; group: ArticleGroup }>({ name: '', group: 'CONSUMABLE' });

  const reload = useCallback(() => {
    api.getArticleCategories().then(setRows).catch((err) => alertDialog(errorText(err)));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const save = async (c: Partial<ArticleCategory>) => {
    try {
      await api.saveArticleCategory(c);
      reload();
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
      reload();
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const maxSort = Math.max(0, ...rows.filter((r) => r.group === draft.group).map((r) => r.sortOrder));
    await save({ name: draft.name.trim(), group: draft.group, sortOrder: maxSort + 1 });
    setDraft({ ...draft, name: '' });
  };

  const remove = async (c: ArticleCategory) => {
    if (!(await confirmDialog(`Kas kustutan liigi "${c.name}"?`))) return;
    try {
      await api.deleteArticleCategory(c.id);
      reload();
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content animate-scale-up article-categories-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <Tags size={20} className="text-emerald" />
            <h3>Artikli liigid</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          {ARTICLE_GROUPS.map((g) => (
            <section key={g} className="article-categories-group">
              <h4>{ARTICLE_GROUP_LABEL[g]}</h4>
              <table className="register-table">
                <tbody>
                  {rows.filter((r) => r.group === g).map((c) => (
                    <tr key={c.id} className={c.isActive ? '' : 'inactive'}>
                      <td>
                        <input
                          className="form-input"
                          aria-label="Liigi nimi"
                          defaultValue={c.name}
                          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && void save({ ...c, name: e.target.value.trim() })}
                        />
                      </td>
                      <td className="num">{c.articleCount ?? 0}</td>
                      <td>
                        <label className="users-admin-checkbox">
                          <input type="checkbox" checked={c.isActive} onChange={(e) => void save({ ...c, isActive: e.target.checked })} />
                          <span>Aktiivne</span>
                        </label>
                      </td>
                      <td className="actions-col">
                        {c.systemKind
                          ? <span title="Süsteemne liik: süsteem kasutab seda (PRIA, laoarvestus, kanded)"><Lock size={14} /></span>
                          : <button type="button" className="icon-btn-ghost" title="Kustuta liik" onClick={() => void remove(c)} disabled={(c.articleCount ?? 0) > 0}><Trash2 size={14} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
          <form className="article-categories-add" onSubmit={add}>
            <select className="form-input" aria-label="Rühm" value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value as ArticleGroup })}>
              {ARTICLE_GROUPS.map((g) => <option key={g} value={g}>{ARTICLE_GROUP_LABEL[g]}</option>)}
            </select>
            <input className="form-input" placeholder="Uue liigi nimi, nt Varuosad" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!draft.name.trim()}><Plus size={14} /><span>Lisa liik</span></button>
          </form>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Sulge</button>
        </div>
      </div>
    </div>,
    document.body
  );
};
```

Kontrolli, et `Tags` ikoon on lucide-react versioonis olemas (`grep -o '"Tags"' node_modules/lucide-react/dist/lucide-react.d.ts | head -1`); kui pole, kasuta `Tag`.

`src/index.css` „Laoarvestus“ ploki lõppu:

```css
.article-categories-modal { max-width: 640px; }
.article-categories-group h4 { margin: 12px 0 6px; }
.article-categories-group .register-table td:first-child { width: 60%; }
.article-categories-add { display: flex; gap: 8px; margin-top: 16px; }
.article-categories-add .form-input:first-child { max-width: 180px; }
```

- [ ] **Step 2: Artiklite vaade** — `src/components/ArticlesView.tsx`

1. Liigid ja filter:

```tsx
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [showCategories, setShowCategories] = useState(false);
  const reloadCategories = useCallback(() => {
    api.getArticleCategories().then(setCategories).catch((err) => alertDialog(errorText(err)));
  }, []);
  useEffect(() => { reloadCategories(); }, [reloadCategories]);
```

   `filtered` lisatingimus `.filter((m) => !categoryId || m.categoryId === categoryId)`; rühma vahetusel `setCategoryId('')`.
2. Lao filtri kõrvale liigi filter:

```tsx
              <FilterClear active={!!categoryId} onClear={() => setCategoryId('')}>
                <select className="form-input" aria-label="Liik" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Kõik liigid</option>
                  {categories.filter((c) => group === 'all' || c.group === group).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FilterClear>
```

3. Nupp „Liigid“ (ainult `canManageFinance`) CSV-nupu ette:

```tsx
                  {canManageFinance && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowCategories(true)} title="Artikli liikide haldus">
                      <Tags size={14} />
                      <span>Liigid</span>
                    </button>
                  )}
```

   ja komponendi lõppu `{showCategories && <ArticleCategoriesDialog onClose={() => setShowCategories(false)} onChanged={() => { reloadCategories(); void reload(); }} />}`.
4. Teenuse read: laoseisu, laoväärtuse ja keskmise hinna lahtrid näitavad `–` (`!isGoods(m.category.group)`), rida ei ava laokaarti (`onClick={() => isGoods(m.category.group) ? setStockCard(m) : setForm(m)}`). Finantsõigusega lisa veerg „Hind“ (`className="num"`, teenusel `fmtEur(m.price)` + ` / ${m.unit}`, kaubal tühi) ja suurenda tühja rea `colSpan`-i ühe võrra.

- [ ] **Step 3: Artikli vorm** — `src/components/ArticleFormDialog.tsx`

Lisa props `canManageFinance: boolean` (edasta `ArticlesView`-st ja `WorkRegisterModal`-ist; viimases `isAdmin || isFinanceManager` sama moodi nagu seal juba arvutatakse — kui seal pole, anna `false`). Laadi lisaks kultuurid ja laod:

```tsx
  const [crops, setCrops] = useState<{ id: string; name: string }[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  useEffect(() => {
    api.getCrops().then((cs) => setCrops(cs.map((c) => ({ id: c.id, name: c.name })))).catch(() => setCrops([]));
    api.getWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
  }, []);
```

(kontrolli kultuuride API meetodi nime failist `src/services/api.ts`: `grep -n "async getCrops" src/services/api.ts`; kasuta olemasolevat).

Ühiku välja järele:

```tsx
            {rules?.price && canManageFinance && (
              <div className="form-group">
                <label htmlFor="mt-price">Hind (€ / {form.unit || 'ühik'})</label>
                <input id="mt-price" className="form-input num" inputMode="decimal" value={priceText} onChange={(e) => setPriceText(e.target.value)} />
              </div>
            )}
            {rules?.crop && (
              <div className="form-group">
                <label htmlFor="mt-crop">Kultuur</label>
                <select id="mt-crop" className="form-input" value={form.cropId ?? ''} onChange={(e) => setForm({ ...form, cropId: e.target.value || null })}>
                  <option value="">–</option>
                  {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {rules?.defaultWarehouse && (
              <div className="form-group">
                <label htmlFor="mt-wh" title="Kust kaup vaikimisi maha kantakse (nt kütus mahutist)">Vaikimisi ladu</label>
                <select id="mt-wh" className="form-input" value={form.defaultWarehouseId ?? ''} onChange={(e) => setForm({ ...form, defaultWarehouseId: e.target.value || null })}>
                  <option value="">Kande ladu</option>
                  {warehouses.filter((w) => w.isActive || w.id === form.defaultWarehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
```

olekuga `const [priceText, setPriceText] = useState(fmtPct(initial.price));` ja `save`-is `price: parsePct(priceText)`. Uue teenuse liigi valimisel, kui ühik on tühi, pane `unit: 'h'` (`onChange` liigi valikus: `const c = categories.find((x) => x.id === e.target.value); setForm({ ...form, categoryId: e.target.value, unit: form.unit || (c?.group === 'SERVICE' ? 'h' : form.unit) })`). Teenusel peida teisendusteguri plokk ainult siis, kui ühik ei muutu (jääb nagu on).

- [ ] **Step 4: Laokande vormis ainult kaubad** — `src/components/StockDocumentDialog.tsx` valikute `useMemo`:

```ts
    () => articles.filter((m) => (isGoods(m.category.group) && m.isActive) || rows.some((r) => r.articleId === m.id)).sort((a, b) => a.name.localeCompare(b.name, 'et')),
```

(import `isGoods`). `PriaLinesEditor` filtreerib juba `matchesPriaKind` kaudu ainult kulumaterjale — kontrolli, et teenuseid ega toodangut seal ei pakuta.

- [ ] **Step 5: Tüübikontroll ja testid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npm test'`
Expected: vigadeta, PASS.

- [ ] **Step 6: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/components/ArticleCategoriesDialog.tsx src/components/ArticlesView.tsx src/components/ArticleFormDialog.tsx src/components/StockDocumentDialog.tsx src/components/WorkRegisterModal.tsx src/index.css && git commit -m "Artiklid: liikide haldus, liigi filter, teenuse hind, terade kultuur, kauba vaikimisi ladu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

Kontrolli brauseris: lisa liik „Varuosad“ (muu kaup), lisa teenus „Masina tööaeg“ hinnaga 40 €/h (ei ilmu laokande valikusse ega laoseisu), lisa artikkel liiki „Terad“ kultuuriga; süsteemset liiki ei saa kustutada.

---

### Task 4: AI-ühendus ja dokumentatsioon

**Files:**
- Modify: `src/server/mcp/instructions.ts`, `src/server/mcp/tools/stock.ts`, `src/server/mcp/tools/works.ts`, `src/server/mcp/tools/fields.ts`, `src/server/mcp/mcp.test.ts`, `docs/andmemudel.md`

**Interfaces:**
- Consumes (T1–T2): `article`, `article.category`.
- Produces: `list_stock_levels` rida `{ warehouse, article, group, category, quantity, unit, negative, ... }` (enne `material`, `category` enum); sisendparameeter `article` (perl nimetas `material` → `article` T1-s).

- [ ] **Step 1: Kirjuta test** `src/server/mcp/mcp.test.ts` laoseisu testi juurde (leia olemasolev `list_stock_levels` test ja lisa ootus):

```ts
    expect(rows[0]).toMatchObject({ article: expect.any(String), group: 'CONSUMABLE', category: expect.any(String) });
```

- [ ] **Step 2: Käivita — peab kukkuma**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp/mcp.test.ts'`
Expected: FAIL (`group` puudub).

- [ ] **Step 3: Tööriistad** — `src/server/mcp/tools/stock.ts`:

```ts
        include: { article: { select: { name: true, unit: true, category: { select: { name: true, group: true } } } }, warehouse: { select: { name: true } } }
...
          warehouse: r.warehouse.name, article: r.article.name, group: r.article.category.group, category: r.article.category.name, quantity: round2(r.qty), unit: r.article.unit, negative: r.qty < 0,
```

Kirjelduste tekstid (`description`):
- `list_stock_levels`: `'Kaupade laoseis lao ja artikli kaupa (laoühikus). group = rühm (CONSUMABLE kulumaterjal, PRODUCE toodang, OTHER_GOODS muu kaup), category = liik. negative = laoseis on miinuses (kanded on kulutanud rohkem kui arvele võetud). Finantsõigusega ka väärtus (FIFO) ja keskmine hind.'`
- parameetri `article` kirjeldus: `'Artikli nimi (tõstutundetu)'`.
- `works.ts` kulu kokkuvõtte tööriista kirjeldus: „Kulumaterjalide kogus kokku artikli ja põllu või kultuuri kaupa (kanded)…“ (ülejäänu sama).

`src/server/mcp/instructions.ts`: rida „Materjalide kulu kokku: summarize_material_usage.“ on T1-s muutunud `summarize_article_usage`-iks — sõnasta: `- Kulumaterjalide kulu kokku: summarize_article_usage. Artiklid on teenused (tööaeg) ja kaubad (kulumaterjal, toodang, muu kaup); laoseis on ainult kaupadel.` Kontrolli `grep -n "artikl\|article" src/server/mcp/instructions.ts`, et tekst oleks loogiline.

- [ ] **Step 4: Testid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/mcp && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS.

- [ ] **Step 5: Dokumentatsioon** `docs/andmemudel.md`

Asenda materjalide/laoarvestuse jaotises tabelinimed (`materials` → `articles`, `material_stock` → `article_stock`, `materialId` → `articleId`) ja lisa lõik:

```markdown
### Artikli liigid (`article_categories`)

Artikkel kuulub liiki; liik kuulub rühma (`ArticleGroup`): `SERVICE` (teenus — laoarvestust pole),
`CONSUMABLE` (kulumaterjal), `PRODUCE` (toodang), `OTHER_GOODS` (muu kaup). Süsteemsetel liikidel on
`systemKind` (töötaja/masina/haakeriista/kuivatamise tööaeg, seeme, väetis, taimekaitsevahend, kütus,
kuivatusõli, terad); need luuakse automaatselt ja neid ei kustutata. Kasutaja loob liike juurde
(nt varuosad, mürgid). Teenusel `price` (ühiku hind), teradel `cropId`, kaubal `defaultWarehouseId`.
Reeglid: `src/services/articleRules.ts`.
```

Kui `scripts/generate-erd.mts` genereerib ERD faili, käivita see (`npx tsx scripts/generate-erd.mts`) ja lisa väljundfail commit'i.

- [ ] **Step 6: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/mcp docs/andmemudel.md && git status --short && git commit -m "Artiklid: AI-ühenduse tööriistad ja andmemudeli dokumentatsioon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

(kui ERD fail muutus, lisa see `git add`-i.)
