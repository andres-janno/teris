# Teenused ja kütus kandel — teostusplaan (artiklid, osa 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kande tööaja read (töötaja, masin, haakeriist) seotakse teenusartikliga ja saavad hinna automaatselt; kütuserida on kaup, mis kantakse laost maha FIFO hinnaga.

**Architecture:** Puhtad reeglid (hinna valik, kütuseartikli valik, kütuse ladu, kinnitamise takistus) on `src/services/articleRules.ts`-is ja `src/server/fieldWorkRules.ts`-is. Andmebaasist sõltuv osa (vaikimisi teenused, kande artiklite leidmine, ressursi teenuse/hinna sisend) on uues moodulis `src/server/entryArticles.ts`. FIFO ümberarvutus (`src/server/stock.ts`) loeb `FUEL` read samamoodi nagu `MATERIAL` read, aga kütuse ladu on kütuseartikli vaikimisi ladu. Kasutajaliideses lisandub ühine komponent `ResourceCostFields` masina, haakeriista ja töötaja vormile.

**Tech Stack:** React 19 + TypeScript + Vite; `node:http` server (`src/server`); Prisma 6 + PostgreSQL (RLS, tenant_fk trigerid); Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-artiklid-design.md`, jaotis „Osa 2 — teenused ja kütus kandel“ (ning „Otsused“ ja „Testimine“).

## Global Constraints

- Kood on serveris: `debian@uvn-243-120.tll07.zonevs.eu:/home/debian/teris`. Kohalik `/Users/andresj/Progemine/teris` on sshfs-mount: faile võib muuta kohalikult, aga **kõik käsud** (npm, npx, git, psql) käivita `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && …'` kaudu.
- Töö käib otse `master`-harus. Iga ülesande lõpus: commit + `npm run release` (tsc + testid + build + restart) serveris.
- Testid: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run <fail>'`. Andmebaasitestid loovad ajutise ettevõtte ja kustutavad selle lõpus (muster: `src/server/articleApi.test.ts`).
- Skeemimuudatus: `npx prisma db push` ja `npx prisma generate` **ilma `--accept-data-loss`-ita**; kui Prisma seda nõuab, peatu ja küsi kasutajalt. Pärast iga skeemimuudatust: `psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql` ja `MIGRATE_DATABASE_URL="$MIGRATE_DATABASE_URL" npx tsx scripts/tenancy/05-tenant-fk-triggers.mts`. Enne skeemimuudatust varukoopia: `pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump`.
- Identifikaatorid (muutujad, väljad, CSS klassid, URL-id) inglise keeles; koodikommentaarid ja kasutajaliidese tekstid eesti keeles.
- Kasutajaliidese arvud on paremale joondatud (`className="num"`); kogused `formatQty`-ga, 2 komakohta.
- Server-side TS impordid kasutavad `.ts` laiendit (`import … from './x.ts'`), muidu `tsc -b` build kukub läbi.
- Hind on `Decimal(12,4)`; sisend peab olema lõplik, ≥ 0 ja < 1e8, muidu viga **„Hind peab olema 0 või suurem“**.
- Tunnihinda (`hourlyRate`) ja teenuse hinda näeb ja muudab ainult finantsõigusega kasutaja (`isAdmin || isFinanceManager`). Ilma õiguseta salvestamine jätab vana tunnihinna alles.
- Vaikimisi teenusartiklid: üks igale tööaja süsteemsele liigile (`LABOR_TIME`, `MACHINE_TIME`, `IMPLEMENT_TIME`, `DRYING_TIME`); nimi = liigi süsteemne nimi (`Töötaja tööaeg`, `Masina tööaeg`, `Haakeriista tööaeg`, `Kuivatamise tööaeg`), ühik `h`, hind tühi. Ainulisus tagatakse rakenduses.
- Teenuse rea hinna järjekord: ressursi `hourlyRate` → ressursi teenusartikli `price` → vaikimisi teenusartikli `price` → tühi. Hind pannakse reale **ainult siis, kui rea `unitPrice` on tühi**; täidetud hinda ei kirjutata üle.
- Kütuseartikkel kandel: masina `fuelArticleId`; puudumisel ettevõtte ainus aktiivne `FUEL` liigi artikkel; mitme või null korral tühi.
- Kütuserida kantakse maha kütuseartikli vaikimisi laost; kui see on määramata, siis kande laost.
- Artiklita kütuserida: kannet ei saa kinnitada, põhjus **„Kütuse artikkel määramata“**.
- Migratsiooni kütuseartikkel: nimi **„Diislikütus“**, ühik `l`, vaikimisi ladu = põhiladu.
- Töötaja kande vorm ei muutu.

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `src/services/articleRules.ts` (muuda) | `SERVICE_TIME_KINDS`, `pickServicePrice`, `pickFuelArticleId`, `entryLineWarehouseId` |
| `src/server/fieldWorkRules.ts` (muuda) | `LineDraft.unitPrice`, `ServiceChoice`, `buildEntryLines` teenuste ja kütusega, `mergeLines` hinna säilitus, `confirmBlockReason` |
| `prisma/schema.prisma` (muuda) | `Article.isDefaultService`; `Vehicle`/`Implement`/`RelatedParty` teenus, tunnihind, masina kütus |
| `src/server/entryArticles.ts` (uus) | `ensureDefaultServices`, `loadEntryArticles`, `articleLineError` (tõstetud `fieldWorks.ts`-ist), `resourceCostIn`, `resourceCostOut` |
| `src/server/stock.ts` (muuda) | `FUEL` read FIFO-s, kütuse ladu |
| `src/server/fieldWorks.ts` (muuda) | kande salvestus artiklitega, finantsi PATCH, artikli API vaikimisi teenus |
| `src/server/apiHandler.ts` (muuda) | masina, haakeriista ja seotud isiku API väljad |
| `scripts/services-fuel-init.mts` (uus) | live-andmete algseis |
| `src/components/ResourceCostFields.tsx` (uus) | teenuse, tunnihinna ja kütuse väljad ressursi vormidel |
| `src/components/VehicleTracker.tsx`, `RelatedPartiesModal.tsx`, `ArticleFormDialog.tsx`, `FinanceModal.tsx`, `App.tsx` (muuda) | kasutajaliides |

---

### Task 1: Puhtad reeglid — teenuse hind, kütus, kanderead, kinnitamine

**Files:**
- Modify: `src/services/articleRules.ts` (lõppu)
- Modify: `src/services/articleRules.test.ts`
- Modify: `src/server/fieldWorkRules.ts` (`LineDraft`, `StoredLine`, `EntryQuantities`, `buildEntryLines`, `lineKey`, `mergeLines`, uus `confirmBlockReason`)
- Modify: `src/server/fieldWorkRules.test.ts`

**Interfaces:**
- Consumes: `ArticleSystemKind` (`src/services/articleRules.ts`), `LineKind`, `canConfirm` (`src/server/fieldWorkRules.ts`).
- Produces:
  - `SERVICE_TIME_KINDS: ArticleSystemKind[]`
  - `pickServicePrice(resourceRate: number | null, resourceArticlePrice: number | null, defaultArticlePrice: number | null): number | null`
  - `pickFuelArticleId(vehicleFuelId: string | null, activeFuelIds: string[]): string | null`
  - `entryLineWarehouseId(kind: 'MATERIAL' | 'FUEL', articleDefaultWarehouseId: string | null, entryWarehouseId: string): string`
  - `interface ServiceChoice { articleId: string; price: number | null }` (`fieldWorkRules.ts`)
  - `EntryQuantities` uued väljad `laborService`, `machineService`, `implementService` (`ServiceChoice | null`), `fuelArticle` (`{ id: string; name: string } | null`)
  - `LineDraft.unitPrice: number | null`
  - `FUEL_ARTICLE_MISSING = 'Kütuse artikkel määramata'`
  - `confirmBlockReason(lines: { kind: LineKind; unitPrice: number | null; articleId: string | null }[]): string | null`

- [ ] **Step 1: Kirjuta artiklireeglite testid**

Lisa `src/services/articleRules.test.ts` lõppu (impordi uued nimed olemasolevasse import-lausesse):

```ts
describe('pickServicePrice', () => {
  it('eelistab ressursi tunnihinda', () => {
    expect(pickServicePrice(55, 40, 30)).toBe(55);
  });
  it('siis ressursi teenusartikli hinda, siis vaikimisi teenuse hinda', () => {
    expect(pickServicePrice(null, 40, 30)).toBe(40);
    expect(pickServicePrice(null, null, 30)).toBe(30);
  });
  it('0 on kehtiv hind', () => {
    expect(pickServicePrice(0, 40, 30)).toBe(0);
  });
  it('hinnata → null', () => {
    expect(pickServicePrice(null, null, null)).toBeNull();
  });
});

describe('pickFuelArticleId', () => {
  it('masina kütus enne kõike', () => {
    expect(pickFuelArticleId('f1', ['f2', 'f3'])).toBe('f1');
  });
  it('ainus aktiivne kütus', () => {
    expect(pickFuelArticleId(null, ['f2'])).toBe('f2');
  });
  it('mitu või null kütust → null', () => {
    expect(pickFuelArticleId(null, ['f2', 'f3'])).toBeNull();
    expect(pickFuelArticleId(null, [])).toBeNull();
  });
});

describe('entryLineWarehouseId', () => {
  it('kütus artikli vaikimisi laost', () => {
    expect(entryLineWarehouseId('FUEL', 'tank', 'main')).toBe('tank');
  });
  it('vaikimisi laota kütus kande laost', () => {
    expect(entryLineWarehouseId('FUEL', null, 'main')).toBe('main');
  });
  it('kulumaterjal alati kande laost', () => {
    expect(entryLineWarehouseId('MATERIAL', 'tank', 'main')).toBe('main');
  });
});

describe('SERVICE_TIME_KINDS', () => {
  it('neli tööaja liiki, kõik rühmas SERVICE', () => {
    expect(SERVICE_TIME_KINDS).toEqual(['LABOR_TIME', 'MACHINE_TIME', 'IMPLEMENT_TIME', 'DRYING_TIME']);
    for (const k of SERVICE_TIME_KINDS) expect(SYSTEM_CATEGORIES.find((c) => c.systemKind === k)?.group).toBe('SERVICE');
  });
});
```

- [ ] **Step 2: Kirjuta kanderidade testid**

Lisa `src/server/fieldWorkRules.test.ts`-i (impordi `confirmBlockReason`, `FUEL_ARTICLE_MISSING`):

```ts
describe('buildEntryLines teenuste ja kütusega', () => {
  it('tööaja read saavad teenusartikli ja pakutud hinna', () => {
    const lines = buildEntryLines({
      laborHours: 8,
      workerName: 'Tööaeg · Mart',
      vehicle: { id: 'v1', name: 'Traktor' },
      implement: { id: 'i1', name: 'Ader' },
      equipmentHours: 6,
      laborService: { articleId: 'sL', price: 20 },
      machineService: { articleId: 'sM', price: 55 },
      implementService: { articleId: 'sI', price: null }
    });
    expect(lines.map((l) => [l.kind, l.articleId, l.unitPrice])).toEqual([
      ['LABOR', 'sL', 20],
      ['MACHINE', 'sM', 55],
      ['IMPLEMENT', 'sI', null]
    ]);
  });
  it('kütuserida saab kütuseartikli ja selle nime', () => {
    const [l] = buildEntryLines({ fuelLiters: 40, fuelArticle: { id: 'f1', name: 'Diislikütus' } });
    expect(l).toMatchObject({ kind: 'FUEL', articleId: 'f1', label: 'Diislikütus', quantity: 40, unit: 'l', unitPrice: null });
  });
  it('kütuseartiklita kütuserida jääb artiklita', () => {
    const [l] = buildEntryLines({ fuelLiters: 40 });
    expect(l).toMatchObject({ kind: 'FUEL', articleId: null, label: 'Kütus' });
  });
  it('materjalireal pakutud hinda pole', () => {
    const [l] = buildEntryLines({ articles: [{ id: 'm1', name: 'Väetis', unit: 'kg', quantity: 10 }] });
    expect(l.unitPrice).toBeNull();
  });
});

describe('mergeLines hinnaga', () => {
  const draft = (over: Partial<LineDraft>): LineDraft => ({
    kind: 'LABOR', vehicleId: null, implementId: null, articleId: 'sL', label: 'Tööaeg', quantity: 8, unit: 'h',
    sortOrder: 0, ratePerHa: null, unitPrice: 20, priaRegister: null, priaKind: null, priaSpec: null,
    activeIngredient: null, nKgHa: null, pKgHa: null, kKgHa: null, ...over
  });
  it('olemasolev hind jääb, pakutud hind ei kirjuta üle', () => {
    const old: StoredLine = { ...draft({ unitPrice: 18 }), confirmedQuantity: null };
    expect(mergeLines([old], [draft({ unitPrice: 25 })], 'PENDING').lines[0].unitPrice).toBe(18);
  });
  it('tühja hinna asemele tuleb pakutud hind', () => {
    const old: StoredLine = { ...draft({ unitPrice: null }), confirmedQuantity: null };
    expect(mergeLines([old], [draft({ unitPrice: 25 })], 'PENDING').lines[0].unitPrice).toBe(25);
  });
  it('tööaja rea teenusartikli vahetus ei kaota hinda ega muuda kinnitust', () => {
    const old: StoredLine = { ...draft({ articleId: 'sOld', unitPrice: 18 }), confirmedQuantity: 8 };
    const r = mergeLines([old], [draft({ articleId: 'sNew', unitPrice: 25 })], 'CONFIRMED');
    expect(r.lines[0]).toMatchObject({ articleId: 'sNew', unitPrice: 18 });
    expect(r.financeStatus).toBe('CONFIRMED');
  });
});

describe('confirmBlockReason', () => {
  it('artiklita kütuserida takistab kinnitamist', () => {
    expect(confirmBlockReason([{ kind: 'FUEL', articleId: null, unitPrice: 1.5 }])).toBe(FUEL_ARTICLE_MISSING);
  });
  it('hinnata rida takistab kinnitamist', () => {
    expect(confirmBlockReason([{ kind: 'LABOR', articleId: 'sL', unitPrice: null }])).toMatch(/ühiku kulu/);
  });
  it('kõik korras → null', () => {
    expect(confirmBlockReason([
      { kind: 'LABOR', articleId: 'sL', unitPrice: 20 },
      { kind: 'FUEL', articleId: 'f1', unitPrice: 1.5 },
      { kind: 'OBSERVATION', articleId: null, unitPrice: null }
    ])).toBeNull();
  });
});
```

Impordi testis ka `type LineDraft`.

- [ ] **Step 3: Käivita testid, veendu et need kukuvad**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/services/articleRules.test.ts src/server/fieldWorkRules.test.ts'`
Expected: FAIL — `pickServicePrice is not a function` / `confirmBlockReason is not exported` jms.

- [ ] **Step 4: Lisa artiklireeglid**

`src/services/articleRules.ts` lõppu:

```ts
/** Tööaja süsteemsed liigid; igal on täpselt üks vaikimisi teenusartikkel (src/server/entryArticles.ts). */
export const SERVICE_TIME_KINDS: ArticleSystemKind[] = ['LABOR_TIME', 'MACHINE_TIME', 'IMPLEMENT_TIME', 'DRYING_TIME'];

/** Tööaja rea hind: ressursi tunnihind → ressursi teenusartikli hind → vaikimisi teenuse hind → tühi. */
export function pickServicePrice(resourceRate: number | null, resourceArticlePrice: number | null, defaultArticlePrice: number | null): number | null {
  return resourceRate ?? resourceArticlePrice ?? defaultArticlePrice ?? null;
}

/** Kande kütuseartikkel: masina vaikimisi kütus, muidu ettevõtte ainus aktiivne kütus; mitme või puudumisel null. */
export function pickFuelArticleId(vehicleFuelId: string | null, activeFuelIds: string[]): string | null {
  if (vehicleFuelId) return vehicleFuelId;
  return activeFuelIds.length === 1 ? activeFuelIds[0] : null;
}

/** Ladu, kust kanderida maha kantakse: kütus artikli vaikimisi laost (nt mahuti), kulumaterjal kande laost. */
export function entryLineWarehouseId(kind: 'MATERIAL' | 'FUEL', articleDefaultWarehouseId: string | null, entryWarehouseId: string): string {
  return kind === 'FUEL' && articleDefaultWarehouseId ? articleDefaultWarehouseId : entryWarehouseId;
}
```

- [ ] **Step 5: Muuda kanderidade reegleid**

`src/server/fieldWorkRules.ts`:

1. `LineDraft`-i lisa väli (pärast `ratePerHa`):
```ts
  unitPrice: number | null; // tööaja real pakutud teenuse hind; kütusel ja materjalil tuleb hind laost (FIFO)
```
2. `StoredLine` muutub (unitPrice tuleb nüüd `LineDraft`-ist):
```ts
export interface StoredLine extends LineDraft {
  confirmedQuantity: number | null;
}
```
3. Enne `EntryQuantities`-t:
```ts
/** Tööaja rea teenusartikkel ja pakutud hind (src/server/entryArticles.ts loadEntryArticles). */
export interface ServiceChoice {
  articleId: string;
  price: number | null;
}
```
4. `EntryQuantities`-i lisa:
```ts
  laborService?: ServiceChoice | null;
  machineService?: ServiceChoice | null;
  implementService?: ServiceChoice | null;
  fuelArticle?: { id: string; name: string } | null; // kande kütuseartikkel
```
5. `buildEntryLines` — `push` saab vaikeväärtuse `unitPrice: null` ning tööaja ja kütuse read artikli:
```ts
  const push = (l: Omit<LineDraft, 'sortOrder' | 'vehicleId' | 'implementId' | 'articleId' | 'ratePerHa' | 'unitPrice' | keyof PriaAttrs> & Partial<LineDraft>) =>
    lines.push({ vehicleId: null, implementId: null, articleId: null, ratePerHa: null, unitPrice: null, ...EMPTY_PRIA_ATTRS, ...l, sortOrder: lines.length });
  const service = (s: ServiceChoice | null | undefined) => ({ articleId: s?.articleId ?? null, unitPrice: s?.price ?? null });

  if (positive(q.laborHours)) push({ kind: 'LABOR', label: q.workerName || 'Tööaeg', quantity: q.laborHours, unit: 'h', ...service(q.laborService) });
  if (positive(q.equipmentHours)) {
    if (q.vehicle) push({ kind: 'MACHINE', vehicleId: q.vehicle.id, label: q.vehicle.name, quantity: q.equipmentHours, unit: 'h', ...service(q.machineService) });
    if (q.implement) push({ kind: 'IMPLEMENT', implementId: q.implement.id, label: q.implement.name, quantity: q.equipmentHours, unit: 'h', ...service(q.implementService) });
  }
  if (positive(q.fuelLiters)) push({ kind: 'FUEL', articleId: q.fuelArticle?.id ?? null, label: q.fuelArticle?.name ?? 'Kütus', quantity: q.fuelLiters, unit: 'l' });
```
(ülejäänud `buildEntryLines` jääb samaks).

6. `lineKey` — artikkel on võtmes ainult materjalireal (tööaja teenuse või kütuseartikli vahetus ei tee rida uueks):
```ts
// Materjalita read (vaatlused) eristatakse nime järgi; artikkel eristab ainult materjaliridu
// (tööaja teenuse või kütuseartikli vahetus ei kaota rea hinda ega kinnitust)
const lineKey = (l: Pick<LineDraft, 'kind' | 'vehicleId' | 'implementId' | 'articleId' | 'label'>) =>
  `${l.kind}:${l.vehicleId ?? ''}:${l.implementId ?? ''}:${l.kind === 'MATERIAL' ? l.articleId ?? '' : ''}:${l.kind === 'OBSERVATION' ? l.label : ''}`;
```
7. `mergeLines` — olemasolev hind jääb, tühja hinna asemele tuleb pakutud hind:
```ts
    return { ...d, unitPrice: old?.unitPrice ?? d.unitPrice, confirmedQuantity: old?.confirmedQuantity ?? null };
```
8. Pärast `canConfirm`-i:
```ts
export const FUEL_ARTICLE_MISSING = 'Kütuse artikkel määramata';

/** Miks kannet ei saa kinnitada; null = saab kinnitada. */
export function confirmBlockReason(lines: { kind: LineKind; unitPrice: number | null; articleId: string | null }[]): string | null {
  if (lines.some((l) => l.kind === 'FUEL' && !l.articleId)) return FUEL_ARTICLE_MISSING;
  if (!canConfirm(lines)) return 'Igal real peab olema ühiku kulu. Materjali ja kütuse hind tuleb laost — hindamata kaup ootab arvele võtmist.';
  return null;
}
```

Olemasolevates testides, mis ehitavad `StoredLine`/`LineDraft` objekte käsitsi, lisa `unitPrice` kuhu vaja (tüübikontroll näitab kohad). `fieldWorks.ts`-is `toStored` ja `lines: { create: drafts }` töötavad edasi, sest `unitPrice` on Prisma väli.

- [ ] **Step 6: Käivita testid ja tüübikontroll**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/services/articleRules.test.ts src/server/fieldWorkRules.test.ts && npx tsc -b --noEmit 2>&1 | tail -20'`
Expected: PASS; tsc vigadeta. Kui tsc näitab `unitPrice` puudumist mõnes `LineDraft`-i loovas kohas, lisa sinna `unitPrice: null`.

- [ ] **Step 7: Kõik testid, commit, release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test 2>&1 | tail -5 && \
git add src/services/articleRules.ts src/services/articleRules.test.ts src/server/fieldWorkRules.ts src/server/fieldWorkRules.test.ts && \
git commit -m "Teenused ja kütus: hinna ja kütuse valiku reeglid, kanderea pakutud hind" && npm run release 2>&1 | tail -5'
```
Expected: kõik testid PASS, release lõpeb vigadeta. (Commit-sõnumi lõppu lisa kokkulepitud `Co-Authored-By` rida.)

---

### Task 2: Andmemudel ja kande artiklite moodul

**Files:**
- Modify: `prisma/schema.prisma` (`Article`, `Vehicle`, `Implement`, `RelatedParty`)
- Create: `src/server/entryArticles.ts`
- Create: `src/server/entryArticles.test.ts`
- Modify: `src/server/fieldWorks.ts` (`articleLineError` tõstetakse `entryArticles.ts`-i ja imporditakse sealt)

**Interfaces:**
- Consumes: `SERVICE_TIME_KINDS`, `SYSTEM_CATEGORIES`, `pickServicePrice`, `pickFuelArticleId`, `articleAllowedOnLine`, `ArticleLineKind`, `ArticleSystemKind` (`src/services/articleRules.ts`); `ServiceChoice` (`src/server/fieldWorkRules.ts`); `systemCategoryId` (`src/server/articleCategories.ts`); `prisma`, `TxClient` (`src/server/db.ts`).
- Produces:
  - `ensureDefaultServices(tx: TxClient): Promise<Map<ArticleSystemKind, { id: string; price: number | null }>>`
  - `interface EntryArticles { laborService: ServiceChoice | null; machineService: ServiceChoice | null; implementService: ServiceChoice | null; fuelArticle: { id: string; name: string } | null }`
  - `loadEntryArticles(tx: TxClient, ids: { workerId: string | null; vehicleId: string | null; implementId: string | null }): Promise<EntryArticles>`
  - `articleLineError(lines: { kind: ArticleLineKind; articleId: string | null }[]): Promise<string | null>` (sama mis praegu `fieldWorks.ts`-is)
  - `resourceCostIn(b: any, kind: 'LABOR' | 'MACHINE' | 'IMPLEMENT', withFuel: boolean, finance: boolean): Promise<{ data: Record<string, unknown> } | { error: string }>`
  - `resourceCostOut(row: { serviceArticleId: string | null; hourlyRate: unknown; fuelArticleId?: string | null }, finance: boolean): { serviceArticleId: string | null; hourlyRate?: number | null; fuelArticleId?: string | null }`
  - Prisma: `Article.isDefaultService`, `Vehicle.serviceArticleId/hourlyRate/fuelArticleId`, `Implement.serviceArticleId/hourlyRate`, `RelatedParty.serviceArticleId/hourlyRate`

- [ ] **Step 1: Muuda skeemi**

`prisma/schema.prisma`:

`Article` mudelisse (pärast `defaultWarehouseId` rida):
```prisma
  isDefaultService   Boolean  @default(false) // tööaja liigi vaikimisi teenus; liigi kohta üks, tagab rakendus (src/server/entryArticles.ts)
```
ja seoste plokki (pärast `stock ArticleStock[]`):
```prisma
  vehicleServices   Vehicle[]      @relation("VehicleService")
  vehicleFuels      Vehicle[]      @relation("VehicleFuel")
  implementServices Implement[]    @relation("ImplementService")
  partyServices     RelatedParty[] @relation("PartyService")
```

`Vehicle` mudelisse (pärast `assignedDriverId`):
```prisma
  serviceArticleId   String? // masina tööaja teenus, kui erineb vaikimisi omast
  hourlyRate         Decimal?    @db.Decimal(12, 4) // oma tunnihind (näeb finantsõigusega)
  fuelArticleId      String? // vaikimisi kütus (liik FUEL)
```
seosed:
```prisma
  serviceArticle       Article?              @relation("VehicleService", fields: [serviceArticleId], references: [id], onDelete: SetNull)
  fuelArticle          Article?              @relation("VehicleFuel", fields: [fuelArticleId], references: [id], onDelete: SetNull)
```
indeksid:
```prisma
  @@index([serviceArticleId])
  @@index([fuelArticleId])
```

`Implement` mudelisse (pärast `year`):
```prisma
  serviceArticleId   String? // haakeriista tööaja teenus, kui erineb vaikimisi omast
  hourlyRate         Decimal?      @db.Decimal(12, 4) // oma tunnihind (näeb finantsõigusega)
```
seos ja indeks:
```prisma
  serviceArticle       Article?              @relation("ImplementService", fields: [serviceArticleId], references: [id], onDelete: SetNull)
  @@index([serviceArticleId])
```

`RelatedParty` mudelisse (pärast `bankAccount`):
```prisma
  serviceArticleId String? // töötaja tööaja teenus, kui erineb vaikimisi omast
  hourlyRate       Decimal?    @db.Decimal(12, 4) // oma tunnihind (näeb finantsõigusega)
```
seos ja indeks:
```prisma
  serviceArticle    Article?               @relation("PartyService", fields: [serviceArticleId], references: [id], onDelete: SetNull)
  @@index([serviceArticleId])
```

Vorminda: `ssh … 'cd /home/debian/teris && npx prisma format && npx prisma validate'` — Expected: „The schema … is valid“.

- [ ] **Step 2: Varukoopia ja andmebaasi muutmine**

Kõik lisandused on tühjaks lubatud veerud; andmekadu pole oodata.

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && \
pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump && ls -t ~/backups | head -1 && \
npx prisma db push && npx prisma generate && \
psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql && \
MIGRATE_DATABASE_URL="$MIGRATE_DATABASE_URL" npx tsx scripts/tenancy/05-tenant-fk-triggers.mts'
```
Expected: „Your database is now in sync“ ilma andmekao hoiatuseta, `OK: N trigerit`. Kui `db push` küsib andmekao kinnitust → peatu, ära kinnita, teata.

- [ ] **Step 3: Kirjuta mooduli testid**

`src/server/entryArticles.test.ts`:

```ts
// Kande artiklid: vaikimisi teenused, ressursi teenus ja hind, kütuseartikkel, ressursi sisend
// ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { systemCategoryId } from './articleCategories';
import { ensureDefaultServices, loadEntryArticles, resourceCostIn, resourceCostOut } from './entryArticles';

const T = `test-tenant-entryart-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const ids = { machineCat: '', fuelCat: '', vehicle: '', worker: '', ownService: '', fuel1: '', fuel2: '' };

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test kande artiklid' } });
  await run(async () => {
    ids.machineCat = await tenantTransaction((tx) => systemCategoryId(tx, 'MACHINE_TIME'));
    ids.fuelCat = await tenantTransaction((tx) => systemCategoryId(tx, 'FUEL'));
    ids.ownService = (await prisma.article.create({ data: { name: 'Kombain', categoryId: ids.machineCat, unit: 'h', price: 120 } })).id;
    ids.fuel1 = (await prisma.article.create({ data: { name: 'Diisel', categoryId: ids.fuelCat, unit: 'l' } })).id;
    ids.vehicle = (await prisma.vehicle.create({ data: { name: 'Traktor', type: 'TRACTOR', model: 'X' } })).id;
    ids.worker = (await prisma.relatedParty.create({ data: { name: 'Mart', roles: ['DRIVER'] } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.vehicle.deleteMany({});
    await prisma.relatedParty.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
  });
  await authDb().tenant.delete({ where: { id: T } });
});

describe('ensureDefaultServices', () => {
  it('loob neli vaikimisi teenust üks kord', async () => {
    await run(() => tenantTransaction(async (tx) => { await ensureDefaultServices(tx); await ensureDefaultServices(tx); }));
    const rows = await run(() => prisma.article.findMany({ where: { isDefaultService: true }, include: { category: true } }));
    expect(rows.map((r) => r.name).sort()).toEqual(['Haakeriista tööaeg', 'Kuivatamise tööaeg', 'Masina tööaeg', 'Töötaja tööaeg']);
    expect(rows.every((r) => r.unit === 'h' && r.price === null && r.category.group === 'SERVICE')).toBe(true);
  });
});

describe('loadEntryArticles', () => {
  it('ressursita: vaikimisi teenus ja selle hind; ainus kütus', async () => {
    await run(() => prisma.article.updateMany({ where: { isDefaultService: true, name: 'Töötaja tööaeg' }, data: { price: 20 } }));
    const r = await run(() => tenantTransaction((tx) => loadEntryArticles(tx, { workerId: null, vehicleId: null, implementId: null })));
    expect(r.laborService?.price).toBe(20);
    expect(r.machineService?.price).toBeNull();
    expect(r.fuelArticle).toEqual({ id: ids.fuel1, name: 'Diisel' });
  });
  it('ressursi tunnihind ja teenusartikkel', async () => {
    await run(async () => {
      await prisma.vehicle.update({ where: { id: ids.vehicle }, data: { serviceArticleId: ids.ownService } });
      await prisma.relatedParty.update({ where: { id: ids.worker }, data: { hourlyRate: 17.5 } });
    });
    const r = await run(() => tenantTransaction((tx) => loadEntryArticles(tx, { workerId: ids.worker, vehicleId: ids.vehicle, implementId: null })));
    expect(r.machineService).toEqual({ articleId: ids.ownService, price: 120 });
    expect(r.laborService?.price).toBe(17.5);
  });
  it('mitu kütust ilma masina kütuseta → kütus tühi; masina kütusega → masina kütus', async () => {
    ids.fuel2 = await run(async () => (await prisma.article.create({ data: { name: 'Bensiin', categoryId: ids.fuelCat, unit: 'l' } })).id);
    const none = await run(() => tenantTransaction((tx) => loadEntryArticles(tx, { workerId: null, vehicleId: ids.vehicle, implementId: null })));
    expect(none.fuelArticle).toBeNull();
    await run(() => prisma.vehicle.update({ where: { id: ids.vehicle }, data: { fuelArticleId: ids.fuel2 } }));
    const own = await run(() => tenantTransaction((tx) => loadEntryArticles(tx, { workerId: null, vehicleId: ids.vehicle, implementId: null })));
    expect(own.fuelArticle).toEqual({ id: ids.fuel2, name: 'Bensiin' });
  });
});

describe('resourceCostIn / resourceCostOut', () => {
  it('vale liigi teenus → viga', async () => {
    const r = await run(() => resourceCostIn({ serviceArticleId: ids.ownService }, 'LABOR', false, true));
    expect(r).toHaveProperty('error');
  });
  it('kütuseväli ainult kütuseartikliga', async () => {
    const r = await run(() => resourceCostIn({ fuelArticleId: ids.ownService }, 'MACHINE', true, true));
    expect(r).toHaveProperty('error');
  });
  it('tunnihind ainult finantsõigusega; negatiivne hind → viga', async () => {
    expect(await run(() => resourceCostIn({ hourlyRate: '12,5' }, 'MACHINE', true, true))).toEqual({ data: { hourlyRate: 12.5 } });
    expect(await run(() => resourceCostIn({ hourlyRate: '12,5' }, 'MACHINE', true, false))).toEqual({ data: {} });
    expect(await run(() => resourceCostIn({ hourlyRate: -1 }, 'MACHINE', true, true))).toEqual({ error: 'Hind peab olema 0 või suurem' });
  });
  it('puuduv võti ei muuda välja', async () => {
    expect(await run(() => resourceCostIn({}, 'MACHINE', true, true))).toEqual({ data: {} });
    expect(await run(() => resourceCostIn({ serviceArticleId: '' }, 'MACHINE', true, true))).toEqual({ data: { serviceArticleId: null } });
  });
  it('väljund peidab tunnihinna ilma finantsõiguseta', () => {
    expect(resourceCostOut({ serviceArticleId: 's', hourlyRate: { toString: () => '12.5' }, fuelArticleId: 'f' }, true))
      .toEqual({ serviceArticleId: 's', hourlyRate: 12.5, fuelArticleId: 'f' });
    expect(resourceCostOut({ serviceArticleId: 's', hourlyRate: 12.5 }, false)).toEqual({ serviceArticleId: 's' });
  });
});
```

- [ ] **Step 4: Käivita, veendu et kukub**

Run: `ssh … 'cd /home/debian/teris && npx vitest run src/server/entryArticles.test.ts'`
Expected: FAIL — moodulit `./entryArticles` ei leita.

- [ ] **Step 5: Kirjuta moodul**

`src/server/entryArticles.ts`:

```ts
// src/server/entryArticles.ts — kanderidade artiklid: tööaja vaikimisi teenused, ressursi (töötaja, masin,
// haakeriist) teenus ja tunnihind, kande kütuseartikkel ning ressursi vormi teenuse/hinna sisend.
import { prisma, type TxClient } from './db.ts';
import { systemCategoryId } from './articleCategories.ts';
import type { ServiceChoice } from './fieldWorkRules.ts';
import {
  SERVICE_TIME_KINDS, SYSTEM_CATEGORIES, articleAllowedOnLine, pickServicePrice, pickFuelArticleId,
  type ArticleLineKind, type ArticleSystemKind
} from '../services/articleRules.ts';

const num = (d: unknown): number | null => (d === null || d === undefined ? null : Number(d));

/** Tööaja liikide vaikimisi teenusartiklid (luuakse puudumisel: liigi süsteemne nimi, ühik h, hind tühi). */
export async function ensureDefaultServices(tx: TxClient): Promise<Map<ArticleSystemKind, { id: string; price: number | null }>> {
  const load = () => tx.article.findMany({
    where: { isDefaultService: true, category: { systemKind: { in: SERVICE_TIME_KINDS } } },
    select: { id: true, price: true, category: { select: { systemKind: true } } }
  });
  let rows = await load();
  if (rows.length < SERVICE_TIME_KINDS.length) {
    // Loomine serialiseeritakse ettevõtte piires (nagu põhiladu); lukk vabaneb tehingu lõpus
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('default-service:' || current_setting('app.tenant_id')))`;
    rows = await load();
    for (const kind of SERVICE_TIME_KINDS) {
      if (rows.some((r) => r.category.systemKind === kind)) continue;
      const categoryId = await systemCategoryId(tx, kind);
      const name = SYSTEM_CATEGORIES.find((c) => c.systemKind === kind)!.name;
      // Sama nimega teenus liigis (nt kasutaja loodud) saab vaikimisi teenuseks
      const same = await tx.article.findFirst({ where: { categoryId, name }, select: { id: true } });
      if (same) await tx.article.update({ where: { id: same.id }, data: { isDefaultService: true } });
      else await tx.article.create({ data: { name, categoryId, unit: 'h', isDefaultService: true } });
    }
    rows = await load();
  }
  return new Map(rows.map((r) => [r.category.systemKind!, { id: r.id, price: num(r.price) }]));
}

export interface EntryArticles {
  laborService: ServiceChoice | null;
  machineService: ServiceChoice | null;
  implementService: ServiceChoice | null;
  fuelArticle: { id: string; name: string } | null;
}

type CostResource = { hourlyRate: unknown; serviceArticle: { id: string; price: unknown } | null } | null;

function chooseService(resource: CostResource, fallback: { id: string; price: number | null } | undefined): ServiceChoice | null {
  const own = resource?.serviceArticle ?? null;
  const articleId = own?.id ?? fallback?.id;
  if (!articleId) return null;
  return { articleId, price: pickServicePrice(num(resource?.hourlyRate), num(own?.price), fallback?.price ?? null) };
}

/** Kande tööaja ridade teenused (koos pakutud hinnaga) ja kütuseartikkel. */
export async function loadEntryArticles(
  tx: TxClient,
  ids: { workerId: string | null; vehicleId: string | null; implementId: string | null }
): Promise<EntryArticles> {
  const defaults = await ensureDefaultServices(tx);
  const cost = { hourlyRate: true, serviceArticle: { select: { id: true, price: true } } } as const;
  const worker = ids.workerId ? await tx.relatedParty.findUnique({ where: { id: ids.workerId }, select: cost }) : null;
  const vehicle = ids.vehicleId ? await tx.vehicle.findUnique({ where: { id: ids.vehicleId }, select: { ...cost, fuelArticleId: true } }) : null;
  const implement = ids.implementId ? await tx.implement.findUnique({ where: { id: ids.implementId }, select: cost }) : null;
  const fuels = await tx.article.findMany({ where: { isActive: true, category: { systemKind: 'FUEL' } }, select: { id: true, name: true } });
  const fuelId = pickFuelArticleId(vehicle?.fuelArticleId ?? null, fuels.map((f) => f.id));
  const fuelArticle = fuelId
    ? fuels.find((f) => f.id === fuelId) ?? (await tx.article.findUnique({ where: { id: fuelId }, select: { id: true, name: true } }))
    : null;
  return {
    laborService: chooseService(worker, defaults.get('LABOR_TIME')),
    machineService: chooseService(vehicle, defaults.get('MACHINE_TIME')),
    implementService: chooseService(implement, defaults.get('IMPLEMENT_TIME')),
    fuelArticle
  };
}

/** Kontrollib, et iga rea artikkel sobib rea liigiga; tagastab veateate või null. */
export async function articleLineError(lines: { kind: ArticleLineKind; articleId: string | null }[]): Promise<string | null> {
  const ids = [...new Set(lines.map((l) => l.articleId).filter((id): id is string => !!id))];
  if (!ids.length) return null;
  const rows = await prisma.article.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, category: { select: { group: true, systemKind: true } } } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const l of lines) {
    if (l.articleId && !byId.has(l.articleId)) return 'Artiklit ei leitud';
    const a = l.articleId ? byId.get(l.articleId) : null;
    if (a && !articleAllowedOnLine(l.kind, a.category)) return `Artikkel „${a.name}“ ei sobi sellele reale`;
  }
  return null;
}

const idIn = (v: unknown): string | null => {
  const s = String(v ?? '').trim().slice(0, 64);
  return s || null;
};

/**
 * Ressursi vormi teenus, tunnihind ja (masinal) kütus. Väli muutub ainult siis, kui võti on kehas;
 * tunnihinda muudab ainult finantsõigusega kasutaja (muidu jääb vana hind alles).
 */
export async function resourceCostIn(
  b: any,
  kind: 'LABOR' | 'MACHINE' | 'IMPLEMENT',
  withFuel: boolean,
  finance: boolean
): Promise<{ data: Record<string, unknown> } | { error: string }> {
  const data: Record<string, unknown> = {};
  const checks: { kind: ArticleLineKind; articleId: string | null }[] = [];
  if (b && 'serviceArticleId' in b) {
    data.serviceArticleId = idIn(b.serviceArticleId);
    checks.push({ kind, articleId: data.serviceArticleId as string | null });
  }
  if (withFuel && b && 'fuelArticleId' in b) {
    data.fuelArticleId = idIn(b.fuelArticleId);
    checks.push({ kind: 'FUEL', articleId: data.fuelArticleId as string | null });
  }
  const err = await articleLineError(checks);
  if (err) return { error: err };
  if (finance && b && 'hourlyRate' in b) {
    const raw = b.hourlyRate;
    const rate = raw === null || raw === undefined || raw === '' ? null : Number(String(raw).replace(',', '.'));
    if (rate !== null && !(Number.isFinite(rate) && rate >= 0 && rate < 100000000)) return { error: 'Hind peab olema 0 või suurem' };
    data.hourlyRate = rate;
  }
  return { data };
}

/** Ressursi teenuse väljad API vastuses; tunnihind ainult finantsõigusega. */
export function resourceCostOut(
  row: { serviceArticleId: string | null; hourlyRate: unknown; fuelArticleId?: string | null },
  finance: boolean
): { serviceArticleId: string | null; hourlyRate?: number | null; fuelArticleId?: string | null } {
  return {
    serviceArticleId: row.serviceArticleId,
    ...(finance ? { hourlyRate: num(row.hourlyRate) } : {}),
    ...('fuelArticleId' in row ? { fuelArticleId: row.fuelArticleId ?? null } : {})
  };
}
```

Märkus `articleLineError`-i kohta: lisatud rida `if (l.articleId && !byId.has(l.articleId)) return 'Artiklit ei leitud';` on uus (olematu id ressursil annaks muidu välisvõtme vea). Kontrolli, et `fieldWorks.ts`-i senised kutsujad (`resolveEntryInput`, `planInput`) sellega sobivad: `resolveEntryInput` annab ainult leitud artiklid, `planInput` võib anda olematu id — siis tagastatakse nüüd 400 „Artiklit ei leitud“ välisvõtme vea asemel, mis on parem.

- [ ] **Step 6: Tõsta `articleLineError` `fieldWorks.ts`-ist välja**

`src/server/fieldWorks.ts`-is kustuta kohalik `articleLineError` funktsioon (koos kommentaariga) ja lisa import:
```ts
import { articleLineError } from './entryArticles.ts';
```
Eemalda `articleAllowedOnLine` ja `ArticleLineKind` importlausest, kui neid failis enam ei kasutata (tsc/eslint näitab).

- [ ] **Step 7: Testid ja tüübikontroll**

Run: `ssh … 'cd /home/debian/teris && npx vitest run src/server/entryArticles.test.ts src/server/articleApi.test.ts && npx tsc -b --noEmit 2>&1 | tail -20'`
Expected: PASS; tsc vigadeta.

- [ ] **Step 8: Kõik testid, commit, release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test 2>&1 | tail -5 && \
git add prisma/schema.prisma src/server/entryArticles.ts src/server/entryArticles.test.ts src/server/fieldWorks.ts && \
git commit -m "Teenused ja kütus: andmemudel, vaikimisi teenused, kande artiklite leidmine" && npm run release 2>&1 | tail -5'
```
Expected: PASS, release vigadeta.

---

### Task 3: Kanne, FIFO kütusele, finantsi kinnitamine, live-andmete algseis

**Files:**
- Modify: `src/server/fieldWorks.ts` (`resolveEntryInput`, `articleIdsOf`, `entryDto`, `/api/finance/entries/:id` PATCH, artikli POST ühikumuutuse kontroll ja vaikimisi lao muutus)
- Modify: `src/server/stock.ts` (`loadMovements`, `recomputeArticleStock`)
- Modify: `src/server/stockApi.ts` (laokaardi kanderea ladu)
- Modify: `src/server/articleUnitChange.ts`
- Modify: `src/server/mcp/tools/stock.ts`
- Create: `scripts/services-fuel-init.mts`
- Create: `src/server/entryFuel.test.ts`

**Interfaces:**
- Consumes: `loadEntryArticles`, `EntryArticles` (`src/server/entryArticles.ts`); `entryLineWarehouseId` (`src/services/articleRules.ts`); `confirmBlockReason` (`src/server/fieldWorkRules.ts`); `ensureDefaultServices`.
- Produces: kande finantsread (`entryDto(..., true).lines[]`) sisaldavad välja `articleId: string | null`; `FUEL` read on FIFO-ga hinnatud ja vähendavad laoseisu.

- [ ] **Step 1: Kirjuta andmebaasitest**

`src/server/entryFuel.test.ts` (päringu abifunktsioon nagu `src/server/articleApi.test.ts`-is):

```ts
// Kande tööaja teenused ja kütuse FIFO ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { systemCategoryId } from './articleCategories';
import { setSessionUserForTest } from './authGate';
import { handleFieldWorks } from './fieldWorks';
import { saveStockDocument, getDefaultWarehouseId } from './stock';
import { ensureDefaultServices } from './entryArticles';

const T = `test-tenant-entryfuel-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(`${s}T00:00:00Z`);

const ADMIN = {
  id: `entryfuel-u-${process.pid}`, username: `entryfuel-${process.pid}`, displayName: null, passwordHash: '', isActive: true,
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

const s = { main: '', tank: '', fuel: '', vehicle: '', fieldWorkId: '' };

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test kütus kandel' } });
  await run(async () => {
    s.main = await tenantTransaction((tx) => getDefaultWarehouseId(tx));
    s.tank = (await prisma.warehouse.create({ data: { name: 'Kütusemahuti' } })).id;
    const fuelCat = await tenantTransaction((tx) => systemCategoryId(tx, 'FUEL'));
    s.fuel = (await prisma.article.create({ data: { name: 'Diislikütus', categoryId: fuelCat, unit: 'l', defaultWarehouseId: s.tank } })).id;
    await tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'RECEIPT', date: d('2026-04-01'), warehouseId: s.tank, toWarehouseId: null, supplierId: null,
      documentNo: null, writeOffReason: null, notes: null, lines: [{ articleId: s.fuel, quantity: 100, amount: 150 }]
    }));
    await tenantTransaction((tx) => ensureDefaultServices(tx));
    await prisma.article.updateMany({ where: { isDefaultService: true, name: 'Töötaja tööaeg' }, data: { price: 20 } });
    s.vehicle = (await prisma.vehicle.create({ data: { name: 'Traktor', type: 'TRACTOR', model: 'X', hourlyRate: 55, fuelArticleId: s.fuel } })).id;
    const field = await prisma.field.create({ data: { num: '1', name: 'Testpõld', fieldCode: 'T-1' } });
    const fs = await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 2, crop: 'test', geometry: {} } });
    const wt = await prisma.workType.create({ data: { name: 'Testkülv', phase: 'SOWING' } });
    s.fieldWorkId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fs.id, workTypeId: wt.id, phase: 'SOWING' } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.vehicle.deleteMany({});
    await prisma.stockDocument.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.warehouse.deleteMany({});
  });
  await authDb().tenant.delete({ where: { id: T } });
});

const lineOf = (e: any, kind: string) => e.lines.find((l: any) => l.kind === kind);

describe('kanne teenuste ja kütusega', () => {
  let entryId = '';
  it('tööaja read saavad hinna, kütus FIFO hinna ja väheneb kütuse laost', async () => {
    const r = await call('POST', '/api/work-entries', {
      fieldWorkId: s.fieldWorkId, date: '2026-05-10', laborHours: 8, vehicleId: s.vehicle, equipmentHours: 6, fuelLiters: 40
    });
    expect(r.status).toBe(200);
    entryId = r.json.id;
    expect(lineOf(r.json, 'LABOR').unitPrice).toBe(20);
    expect(lineOf(r.json, 'MACHINE').unitPrice).toBe(55);
    expect(lineOf(r.json, 'FUEL')).toMatchObject({ articleId: s.fuel, label: 'Diislikütus', unitPrice: 1.5 });
    const stock = await run(() => prisma.articleStock.findMany({ where: { articleId: s.fuel } }));
    expect(stock).toHaveLength(1);
    expect(stock[0]).toMatchObject({ warehouseId: s.tank, qty: 60 });
  });
  it('vaikimisi teenuse hinna muutus ei muuda olemasolevat rida', async () => {
    await run(() => prisma.article.updateMany({ where: { isDefaultService: true, name: 'Töötaja tööaeg' }, data: { price: 30 } }));
    const r = await call('PUT', `/api/work-entries/${entryId}`, {
      date: '2026-05-10', laborHours: 9, vehicleId: s.vehicle, equipmentHours: 6, fuelLiters: 40
    });
    expect(r.status).toBe(200);
    expect(lineOf(r.json, 'LABOR')).toMatchObject({ quantity: 9, unitPrice: 20 });
  });
  it('finantsjuhi käsitsi hind kütusereal ei muutu', async () => {
    const e = await run(() => prisma.workEntryLine.findFirstOrThrow({ where: { entryId, kind: 'FUEL' } }));
    const r = await call('PATCH', `/api/finance/entries/${entryId}`, { prices: { [e.id]: 9 } });
    expect(r.status).toBe(200);
    const after = await run(() => prisma.workEntryLine.findUniqueOrThrow({ where: { id: e.id } }));
    expect(Number(after.unitPrice)).toBe(1.5);
  });
  it('artiklita kütuserida: kinnitamine keelatud põhjusega', async () => {
    await run(() => prisma.vehicle.update({ where: { id: s.vehicle }, data: { fuelArticleId: null } }));
    const fuelCat = await run(() => tenantTransaction((tx) => systemCategoryId(tx, 'FUEL')));
    await run(() => prisma.article.create({ data: { name: 'Bensiin', categoryId: fuelCat, unit: 'l' } }));
    const r = await call('POST', '/api/work-entries', { fieldWorkId: s.fieldWorkId, date: '2026-05-11', fuelLiters: 10, laborHours: 1 });
    expect(lineOf(r.json, 'FUEL').articleId).toBeNull();
    const c = await call('PATCH', `/api/finance/entries/${r.json.id}`, { prices: {}, confirm: true });
    expect(c.status).toBe(400);
    expect(c.json.error).toBe('Kütuse artikkel määramata');
  });
  it('kütuseartikli vaikimisi lao muutus kannab kütuse ümber', async () => {
    const r = await call('POST', '/api/articles', { id: s.fuel, name: 'Diislikütus', categoryId: (await run(() => prisma.article.findUniqueOrThrow({ where: { id: s.fuel } }))).categoryId, unit: 'l', defaultWarehouseId: s.main });
    expect(r.status).toBe(200);
    const stock = await run(() => prisma.articleStock.findMany({ where: { articleId: s.fuel }, orderBy: { qty: 'asc' } }));
    expect(stock.map((x) => [x.warehouseId, x.qty])).toEqual([[s.main, -40], [s.tank, 100]]);
  });
});
```

Kui `prisma.field.create` vms vajab teisi kohustuslikke välju, võta need `src/server/articleApi.test.ts`-i `beforeAll`-ist (seal on sama töö ja hooaja loomine).

- [ ] **Step 2: Käivita, veendu et kukub**

Run: `ssh … 'cd /home/debian/teris && npx vitest run src/server/entryFuel.test.ts'`
Expected: FAIL — LABOR `unitPrice` on `null`, FUEL `articleId` `null`.

- [ ] **Step 3: Kande salvestus artiklitega**

`src/server/fieldWorks.ts`:

1. Import: `import { articleLineError, loadEntryArticles } from './entryArticles.ts';` ja `confirmBlockReason` `./fieldWorkRules.ts`-i importlausesse; `canConfirm` eemalda importist, kui seda enam ei kasutata.
2. `resolveEntryInput`-is enne `buildEntryLines`-i:
```ts
  // Tööaja ridade teenused ja pakutud hinnad, kande kütuseartikkel
  const entryArticles = await tenantTransaction((tx) => loadEntryArticles(tx, { workerId: worker?.id ?? null, vehicleId: vehicle?.id ?? null, implementId: implement?.id ?? null }));
```
ja `buildEntryLines({ … })` kutsesse lisa `...entryArticles,` (väljade nimed `laborService`, `machineService`, `implementService`, `fuelArticle` vastavad `EntryQuantities`-ile).
3. `articleIdsOf` arvestab ka kütuseridu:
```ts
// Laoarvestusega kanderead: kulumaterjal ja kütus
const articleIdsOf = (lines: { kind?: string; articleId: string | null }[]) =>
  lines.filter((l) => ['MATERIAL', 'FUEL'].includes(l.kind ?? 'MATERIAL') && l.articleId).map((l) => l.articleId as string);
```
4. `entryDto` finantsridadele lisa `articleId: l.articleId,` (pärast `kind: l.kind,`).
5. Finantsi PATCH — käsitsi hind ainult tööaja ja saagi ridadele, kinnitamise põhjus `confirmBlockReason`-ist:
```ts
      // Kulumaterjali ja kütuse hind tuleb laost (FIFO), käsitsi seda ei muudeta
      const fromStock = (kind: string) => kind === 'MATERIAL' || kind === 'FUEL';
      const lines = entry.lines.map((l) => ({
        ...l,
        unitPrice: !fromStock(l.kind) && l.id in prices ? num(prices[l.id]) : decimalToNumber(l.unitPrice)
      }));
      const blocked = b?.confirm === true ? confirmBlockReason(lines) : null;
      if (blocked) {
        json(res, { error: blocked }, 400);
        return true;
      }
```
(asendab senise `lines` arvutuse ja `canConfirm` kontrolli.)
6. Artikli POST: ühiku muutuse kontrollis (`prisma.workEntryLine.findMany({ where: { articleId: id!, kind: 'MATERIAL' } …`) muuda `kind: { in: ['MATERIAL', 'FUEL'] }`. `old` päringu `select`-i lisa `defaultWarehouseId: true`. Tehingus pärast ühikuplokki (`if (unitFactor) … else if (unitChanged) …`) lisa:
```ts
        // Kütus kantakse maha artikli vaikimisi laost: lao vahetus liigutab kütuse kanderead teise lattu
        else if (old && old.defaultWarehouseId !== s.defaultWarehouseId) await recomputeArticleStock(tx, [s.id]);
```

- [ ] **Step 4: FIFO loeb kütuseridu**

`src/server/stock.ts`:

1. Import: `import { entryLineWarehouseId } from '../services/articleRules.ts';`
2. `loadMovements`: artiklite päring `select: { id: true, unit: true, defaultWarehouseId: true }`; kanderidade päring `where: { kind: { in: ['MATERIAL', 'FUEL'] }, articleId: { in: articleIds } }` ja `select`-i lisa `kind: true`; liikumise ladu:
```ts
        // Tühi ladu (vana kanne enne ühekordset täitmist) — varuvariandina põhiladu; kütus artikli vaikimisi laost
        kind: 'OUT', warehouseId: entryLineWarehouseId(l.kind as 'MATERIAL' | 'FUEL', m.defaultWarehouseId, l.entry.warehouseId ?? defaultWh), quantity: qty
```
3. `recomputeArticleStock`: `current` päringus `where: { kind: { in: ['MATERIAL', 'FUEL'] }, articleId: mm.articleId }`.
4. Faili päise kommentaaris „materjaliread“ → „kulumaterjali- ja kütuseread“.

`src/server/stockApi.ts` laokaart: kui kanderea ladu võetakse `entry.warehouseId`-st, võta see liikumisest (`m.warehouseId`, mis on juba õige kütuse puhul). Otsi rida, kus kanderea `warehouse`/`warehouseName` pannakse, ja kasuta liikumise `warehouseId`-d. Kui kood juba kasutab liikumise ladu, ära muuda.

`src/server/articleUnitChange.ts`: `where: { articleId, kind: 'MATERIAL' }` → `where: { articleId, kind: { in: ['MATERIAL', 'FUEL'] } }`; päise kommentaaris „kande- ja plaaniread“ jääb.

`src/server/mcp/tools/stock.ts` (~rida 72): `kind: 'MATERIAL'` → `kind: { in: ['MATERIAL', 'FUEL'] }`. Kui sama tööriist arvutab kanderea lao `entry.warehouseId`-st ja filtreerib selle järgi, jäta see nii (kütuse vaikimisi lao arvestus AI tööriistas on väljaspool seda ülesannet) ja kirjuta see raportisse.

- [ ] **Step 5: Testid**

Run: `ssh … 'cd /home/debian/teris && npx vitest run src/server/entryFuel.test.ts src/server/stock.test.ts src/server/articleApi.test.ts && npx tsc -b --noEmit 2>&1 | tail -20'`
Expected: PASS; tsc vigadeta.

- [ ] **Step 6: Live-andmete algseisu skript**

`scripts/services-fuel-init.mts`:

```ts
// scripts/services-fuel-init.mts — teenuste ja kütuse algseis: tööaja vaikimisi teenused, olemasolevad tööaja read
// vaikimisi teenusega (hinnad jäävad), kütuseartikkel „Diislikütus“ (vaikimisi ladu = põhiladu) masinatele ja
// artiklita kütuseridadele, kütuse FIFO ümberarvutus. Korduvkäivitatav. Käivita: npx tsx scripts/services-fuel-init.mts
import { authDb, runAsTenant, tenantTransaction } from '../src/server/db.ts';
import { getDefaultWarehouseId, recomputeArticleStock } from '../src/server/stock.ts';
import { systemCategoryId } from '../src/server/articleCategories.ts';
import { ensureDefaultServices } from '../src/server/entryArticles.ts';

const FUEL_NAME = 'Diislikütus';
const LINE_SERVICE = [['LABOR', 'LABOR_TIME'], ['MACHINE', 'MACHINE_TIME'], ['IMPLEMENT', 'IMPLEMENT_TIME']] as const;

const tenants = await authDb().tenant.findMany({ select: { id: true, name: true } });
for (const t of tenants) {
  await runAsTenant(t.id, async () => {
    const r = await tenantTransaction(async (tx) => {
      const defaults = await ensureDefaultServices(tx);
      let hourLines = 0;
      for (const [kind, systemKind] of LINE_SERVICE) {
        const { count } = await tx.workEntryLine.updateMany({ where: { kind, articleId: null }, data: { articleId: defaults.get(systemKind)!.id } });
        hourLines += count;
      }
      const fuelCategoryId = await systemCategoryId(tx, 'FUEL');
      const fuel = (await tx.article.findFirst({ where: { categoryId: fuelCategoryId, name: FUEL_NAME }, select: { id: true } }))
        ?? (await tx.article.create({ data: { name: FUEL_NAME, categoryId: fuelCategoryId, unit: 'l', defaultWarehouseId: await getDefaultWarehouseId(tx) }, select: { id: true } }));
      const vehicles = await tx.vehicle.updateMany({ where: { fuelArticleId: null }, data: { fuelArticleId: fuel.id } });
      const fuelLines = await tx.workEntryLine.updateMany({ where: { kind: 'FUEL', articleId: null }, data: { articleId: fuel.id, label: FUEL_NAME } });
      await recomputeArticleStock(tx, [fuel.id]);
      return { hourLines, vehicles: vehicles.count, fuelLines: fuelLines.count };
    }, { timeout: 300000 });
    console.log(`${t.name}: tööaja ridu teenusega ${r.hourLines}, masinaid kütusega ${r.vehicles}, kütuseridu ${r.fuelLines}`);
  });
}
await authDb().$disconnect();
process.exit(0);
```

- [ ] **Step 7: Kõik testid, commit, release, algseis live'is**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test 2>&1 | tail -5 && \
git add src/server/fieldWorks.ts src/server/stock.ts src/server/stockApi.ts src/server/articleUnitChange.ts src/server/mcp/tools/stock.ts scripts/services-fuel-init.mts src/server/entryFuel.test.ts && \
git commit -m "Teenused ja kütus: kande teenused ja hinnad, kütus FIFO-ga laost, kinnitamise põhjus, algseisu skript" && \
npm run release 2>&1 | tail -5 && set -a && . ./.env && set +a && \
pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump && \
npx tsx scripts/services-fuel-init.mts'
```
Expected: release vigadeta; skript prindib iga ettevõtte kohta rea. Seisuga 2026-11-02 on oodata: „Loisu Agro OÜ: tööaja ridu teenusega 29, masinaid kütusega 7, kütuseridu 0“; teistel ettevõtetel nullid. Teine käivitus prindib kõigile nullid (korduvkäivitatav).

---

### Task 4: Vaikimisi teenus artiklite API-s ja ressursside teenus/tunnihind

**Files:**
- Modify: `src/server/fieldWorks.ts` (`/api/articles` GET, POST, merge, DELETE)
- Modify: `src/server/apiHandler.ts` (`/api/fleet` GET, `/api/fleet/vehicles` POST, `/api/fleet/implements` POST, `/api/parties` GET ja POST)
- Modify: `src/server/articleApi.test.ts`

**Interfaces:**
- Consumes: `ensureDefaultServices`, `resourceCostIn`, `resourceCostOut` (`src/server/entryArticles.ts`); `SERVICE_TIME_KINDS` (`src/services/articleRules.ts`).
- Produces:
  - `/api/articles` GET tagastab igal artiklil `isDefaultService: boolean`; vaikimisi teenused on alati olemas.
  - `/api/articles` POST võtab `isDefaultService: boolean`.
  - `/api/fleet` GET: masinal `serviceArticleId`, `fuelArticleId`, `hourlyRate` (ainult finantsõigusega); haakeriistal `serviceArticleId`, `hourlyRate` (ainult finantsõigusega).
  - `/api/parties` GET ja POST vastus: `serviceArticleId`, `hourlyRate` (ainult finantsõigusega, number).
  - Veateated: „Vaikimisi teenust ei saa kustutada“, „Vaikimisi teenust ei saa teise liiki viia ega mitteaktiivseks muuta“.

- [ ] **Step 1: Kirjuta testid**

Lisa `src/server/articleApi.test.ts`-i (impordi `ensureDefaultServices` `./entryArticles`-ist):

```ts
describe('vaikimisi teenus', () => {
  const defaultId = async () => (await run(() => prisma.article.findFirstOrThrow({ where: { isDefaultService: true, category: { systemKind: 'MACHINE_TIME' } } }))).id;

  it('artiklite loend loob vaikimisi teenused ja näitab märget', async () => {
    const r = await call('GET', '/api/articles');
    expect(r.json.filter((a: any) => a.isDefaultService).map((a: any) => a.name).sort())
      .toEqual(['Haakeriista tööaeg', 'Kuivatamise tööaeg', 'Masina tööaeg', 'Töötaja tööaeg']);
  });
  it('vaikimisi teenust ei saa kustutada', async () => {
    const r = await call('DELETE', `/api/articles/${await defaultId()}`);
    expect(r.status).toBe(409);
    expect(r.json.error).toBe('Vaikimisi teenust ei saa kustutada');
  });
  it('vaikimisi teenust ei saa mitteaktiivseks muuta ega märget eemaldada', async () => {
    const id = await defaultId();
    const off = await call('POST', '/api/articles', { id, name: 'Masina tööaeg', categoryId: cat.machine, unit: 'h', isActive: false, isDefaultService: true });
    expect(off.status).toBe(400);
    expect(off.json.error).toBe('Vaikimisi teenust ei saa teise liiki viia ega mitteaktiivseks muuta');
    const unflag = await call('POST', '/api/articles', { id, name: 'Masina tööaeg', categoryId: cat.machine, unit: 'h', isDefaultService: false });
    expect(unflag.status).toBe(200);
    expect(unflag.json.isDefaultService).toBe(true);
  });
  it('teise teenuse märkimine vaikimisi teenuseks võtab märke vanalt', async () => {
    const old = await defaultId();
    const r = await call('POST', '/api/articles', { name: 'Masinatund 2026', categoryId: cat.machine, unit: 'h', isDefaultService: true });
    expect(r.status).toBe(200);
    expect(r.json.isDefaultService).toBe(true);
    const prev = await run(() => prisma.article.findUniqueOrThrow({ where: { id: old } }));
    expect(prev.isDefaultService).toBe(false);
  });
  it('mitte-tööaja liigi artikkel ei saa vaikimisi teenuseks', async () => {
    const r = await call('POST', '/api/articles', { name: 'Konsultatsioon', categoryId: cat.otherService, unit: 'h', isDefaultService: true });
    expect(r.status).toBe(200);
    expect(r.json.isDefaultService).toBe(false);
  });
  it('asendamine viib masina teenuse ja vaikimisi märke sihtartiklile', async () => {
    const source = await defaultId();
    const target = (await run(() => prisma.article.create({ data: { name: 'Masinatund uus', categoryId: cat.machine, unit: 'h' } }))).id;
    const v = await run(() => prisma.vehicle.create({ data: { name: 'T', type: 'TRACTOR', model: 'X', serviceArticleId: source } }));
    const r = await call('POST', `/api/articles/${source}/merge`, { targetId: target });
    expect(r.status).toBe(200);
    expect((await run(() => prisma.vehicle.findUniqueOrThrow({ where: { id: v.id } }))).serviceArticleId).toBe(target);
    expect((await run(() => prisma.article.findUniqueOrThrow({ where: { id: target } }))).isDefaultService).toBe(true);
    await run(() => prisma.vehicle.delete({ where: { id: v.id } }));
  });
});
```

Kui `afterAll` ei kustuta sõidukeid enne artikleid, lisa sinna `await prisma.vehicle.deleteMany({});` enne artiklite kustutamist.

Märkus: testi järjekord loeb — „teise teenuse märkimine“ muudab vaikimisi teenuse, järgmine test loeb selle `defaultId()`-ga uuesti.

- [ ] **Step 2: Käivita, veendu et kukub**

Run: `ssh … 'cd /home/debian/teris && npx vitest run src/server/articleApi.test.ts'`
Expected: FAIL — `isDefaultService` puudub vastusest / kustutamine õnnestub.

- [ ] **Step 3: Artiklite API**

`src/server/fieldWorks.ts`:

1. Import: `ensureDefaultServices` `./entryArticles.ts`-ist; `SERVICE_TIME_KINDS` `../services/articleRules.ts`-ist.
2. GET `/api/articles`: laoseisu tehingus loo ka vaikimisi teenused:
```ts
    const stock = await tenantTransaction(async (tx) => {
      await ensureDefaultServices(tx);
      return articleStockSummary(tx, warehouseId);
    });
```
3. POST `/api/articles`:
   - `old` päringu `select`-i lisa `isDefaultService: true, categoryId: true, isActive: true` (lisaks Task 3-s lisatud `defaultWarehouseId`-le).
   - Pärast `if (id && !old)` kontrolli:
```ts
    // Tööaja liigi vaikimisi teenus: liigi kohta üks; märge liigub ainult teise teenuse märkimisega
    const timeService = category.group === 'SERVICE' && !!category.systemKind && SERVICE_TIME_KINDS.includes(category.systemKind);
    if (old?.isDefaultService && (old.categoryId !== categoryId || data.isActive === false)) {
      json(res, { error: 'Vaikimisi teenust ei saa teise liiki viia ega mitteaktiivseks muuta' }, 400);
      return true;
    }
    const isDefaultService = timeService && (old?.isDefaultService === true || b?.isDefaultService === true);
```
   - `data` objektile lisa `isDefaultService` (pärast `isActive`-i defineerimist: `const data = { …, isDefaultService }` — lisa see `data` literaali).
   - Tehingus enne `tx.article.update`/`create`-i:
```ts
        if (isDefaultService && !old?.isDefaultService) {
          await tx.article.updateMany({ where: { categoryId: categoryId!, isDefaultService: true, ...(id ? { NOT: { id } } : {}) }, data: { isDefaultService: false } });
        }
```
4. Merge (`/api/articles/:id/merge`): tehingus enne `tx.article.delete({ where: { id: source.id } })`:
```ts
      // Ressursside teenus ja kütus ning vaikimisi teenuse märge liiguvad sihtartiklile
      await tx.vehicle.updateMany({ where: { serviceArticleId: source.id }, data: { serviceArticleId: target.id } });
      await tx.vehicle.updateMany({ where: { fuelArticleId: source.id }, data: { fuelArticleId: target.id } });
      await tx.implement.updateMany({ where: { serviceArticleId: source.id }, data: { serviceArticleId: target.id } });
      await tx.relatedParty.updateMany({ where: { serviceArticleId: source.id }, data: { serviceArticleId: target.id } });
```
   ja sihtartikli `tx.article.update` `data`-sse lisa `isDefaultService: target.isDefaultService || source.isDefaultService,`.
5. DELETE `/api/articles/:id`: kustutamise eel (pärast artikli leidmist ja enne kustutamist) lisa:
```ts
    if (article.isDefaultService) {
      json(res, { error: 'Vaikimisi teenust ei saa kustutada' }, 409);
      return true;
    }
```
   (Kasuta handleri olemasolevat muutujat; kui handler artiklit enne kustutamist ei loe, lisa `const article = await prisma.article.findUnique({ where: { id }, select: { isDefaultService: true, createdBy: true } })` ja kontrolli seda.)

- [ ] **Step 4: Ressursside API**

`src/server/apiHandler.ts`:

1. Import: `import { resourceCostIn, resourceCostOut } from './entryArticles.ts';`
2. `isAdmin` kõrvale (rida ~69):
```ts
// Finantsandmeid (tunnihind) näevad finantsjuht ja admin
const canSeeFinance = (req: IncomingMessage) => {
  const u = sessionUserOf(req) as { isAdmin?: boolean; isFinanceManager?: boolean } | null;
  return u?.isAdmin === true || u?.isFinanceManager === true;
};
```
3. `/api/fleet` GET: `const finance = canSeeFinance(req);` päringu alguses; masina objekti lisa `...resourceCostOut(v, finance),` ja haakeriista objekti `...resourceCostOut({ serviceArticleId: i.serviceArticleId, hourlyRate: i.hourlyRate }, finance),`.
4. `/api/fleet/vehicles` POST: pärast `parseBody`-t
```ts
      const cost = await resourceCostIn(v, 'MACHINE', true, canSeeFinance(req));
      if ('error' in cost) return json(res, { error: cost.error }, 400);
```
   `vData`-sse lisa `...cost.data,`; vastus `return json(res, { ...saved, ...resourceCostOut(saved, canSeeFinance(req)) });`.
5. `/api/fleet/implements` POST: sama `resourceCostIn(i, 'IMPLEMENT', false, …)`, `iData`-sse `...cost.data,`, vastuses `...resourceCostOut({ serviceArticleId: saved.serviceArticleId, hourlyRate: saved.hourlyRate }, …)`.
6. `/api/parties` GET: `mapped` objektis `...p` järel `...resourceCostOut({ serviceArticleId: p.serviceArticleId, hourlyRate: p.hourlyRate }, canSeeFinance(req)),` — `hourlyRate` Decimal ei tohi `...p` kaudu välja minna: kirjuta map ümber kujule `({ _count, hourlyRate, ...p }) => ({ ...p, ...resourceCostOut({ serviceArticleId: p.serviceArticleId, hourlyRate }, finance), … })`.
7. `/api/parties` POST: pärast `parseBody`-t `resourceCostIn(p, 'LABOR', false, canSeeFinance(req))`, vea korral 400; `update` ja `create` objektidesse `...cost.data,`; vastus `const { hourlyRate, ...rest } = saved; return json(res, { ...rest, ...resourceCostOut({ serviceArticleId: saved.serviceArticleId, hourlyRate }, canSeeFinance(req)) });`.

Kontrolli `grep -n "relatedParty.findMany\|prisma.vehicle.findMany\|prisma.implement.findMany" src/server/*.ts src/server/mcp/tools/*.ts`: kui mõni teine API või AI tööriist tagastab terve rea (`...v`, `...p`), eemalda sealt `hourlyRate` samamoodi. Kirjuta leitud kohad raportisse.

- [ ] **Step 5: Testid**

Run: `ssh … 'cd /home/debian/teris && npx vitest run src/server/articleApi.test.ts src/server/entryArticles.test.ts src/server/entryFuel.test.ts && npx tsc -b --noEmit 2>&1 | tail -20'`
Expected: PASS; tsc vigadeta.

- [ ] **Step 6: Kõik testid, commit, release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test 2>&1 | tail -5 && \
git add src/server/fieldWorks.ts src/server/apiHandler.ts src/server/articleApi.test.ts && \
git commit -m "Teenused ja kütus: vaikimisi teenus artiklite API-s, ressursi teenus, tunnihind ja kütus" && npm run release 2>&1 | tail -5'
```
Expected: PASS, release vigadeta.

---

### Task 5: Kasutajaliides — ressursi vormid, vaikimisi teenus, kütus finantsaknas

**Files:**
- Create: `src/components/ResourceCostFields.tsx`
- Modify: `src/types/fleet.ts` (`Vehicle`, `Implement`), `src/types/party.ts` (`RelatedParty`), `src/types/fieldWork.ts` (`Article.isDefaultService`, `WorkEntryLine.articleId`)
- Modify: `src/components/VehicleTracker.tsx` (masina ja haakeriista vorm)
- Modify: `src/components/RelatedPartiesModal.tsx` (töötaja vorm)
- Modify: `src/App.tsx` (`canManageFinance` VehicleTrackerile ja mõlemale RelatedPartiesModalile)
- Modify: `src/components/ArticleFormDialog.tsx` (vaikimisi teenuse märge)
- Modify: `src/components/ArticlesView.tsx` (märge nime juures)
- Modify: `src/components/FinanceModal.tsx` (kütuserida FIFO hinnaga, artiklita kütuse põhjus)
- Modify: CSS fail, kus on `.finance-fifo-price` (vajadusel)

**Interfaces:**
- Consumes: API väljad Task 4-st; `api.getArticles()` (`src/services/api.ts`); `Article`, `ArticleSystemKind` tüübid.
- Produces: `ResourceCostFields` komponent:
```ts
interface ResourceCostFieldsProps {
  serviceKind: 'LABOR_TIME' | 'MACHINE_TIME' | 'IMPLEMENT_TIME';
  articles: Article[];
  serviceArticleId: string;
  onServiceChange: (id: string) => void;
  hourlyRate: string;
  onRateChange: (v: string) => void;
  canManageFinance: boolean;
  fuelArticleId?: string; // ainult masinal
  onFuelChange?: (id: string) => void;
}
```

- [ ] **Step 1: Tüübid**

`src/types/fleet.ts` — `Vehicle`-isse:
```ts
  serviceArticleId?: string | null; // masina tööaja teenus (tühi = vaikimisi teenus)
  hourlyRate?: number | null;       // oma tunnihind € (ainult finantsõigusega)
  fuelArticleId?: string | null;    // vaikimisi kütus
```
`Implement`-isse:
```ts
  serviceArticleId?: string | null; // haakeriista tööaja teenus (tühi = vaikimisi teenus)
  hourlyRate?: number | null;       // oma tunnihind € (ainult finantsõigusega)
```
`src/types/party.ts` — `RelatedParty`-sse (pärast `bankAccount`):
```ts
  serviceArticleId?: string | null; // töötaja tööaja teenus (tühi = vaikimisi teenus)
  hourlyRate?: number | null;       // oma tunnihind € (ainult finantsõigusega)
```
`src/types/fieldWork.ts` — `Article`-isse (pärast `defaultWarehouseId`): `isDefaultService?: boolean; // tööaja liigi vaikimisi teenus`; `WorkEntryLine`-i (pärast `kind`): `articleId?: string | null;`.

- [ ] **Step 2: Ühine väljade komponent**

`src/components/ResourceCostFields.tsx`:

```tsx
// Ressursi (töötaja, masin, haakeriist) teenus, oma tunnihind ja masina vaikimisi kütus.
// Tunnihinda näeb ja muudab ainult finantsõigusega kasutaja.
import React from 'react';
import type { Article } from '../types/fieldWork';

interface ResourceCostFieldsProps {
  serviceKind: 'LABOR_TIME' | 'MACHINE_TIME' | 'IMPLEMENT_TIME';
  articles: Article[];
  serviceArticleId: string;
  onServiceChange: (id: string) => void;
  hourlyRate: string;
  onRateChange: (v: string) => void;
  canManageFinance: boolean;
  fuelArticleId?: string; // ainult masinal
  onFuelChange?: (id: string) => void;
}

export const ResourceCostFields: React.FC<ResourceCostFieldsProps> = ({
  serviceKind, articles, serviceArticleId, onServiceChange, hourlyRate, onRateChange, canManageFinance, fuelArticleId, onFuelChange
}) => {
  const services = articles.filter((a) => a.category.systemKind === serviceKind && (a.isActive || a.id === serviceArticleId));
  const defaultService = services.find((a) => a.isDefaultService);
  const fuels = articles.filter((a) => a.category.systemKind === 'FUEL' && (a.isActive || a.id === fuelArticleId));
  const activeFuels = fuels.filter((a) => a.isActive);
  const fuelFallback = activeFuels.length === 1 ? `Ainus kütus (${activeFuels[0].name})` : 'Määramata';
  return (
    <>
      <div className="form-group">
        <label htmlFor={`rc-service-${serviceKind}`}>Teenus</label>
        <select id={`rc-service-${serviceKind}`} className="form-input" value={serviceArticleId} onChange={(e) => onServiceChange(e.target.value)}>
          <option value="">{defaultService ? `Vaikimisi (${defaultService.name})` : 'Vaikimisi'}</option>
          {services.filter((a) => !a.isDefaultService).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      {canManageFinance && (
        <div className="form-group">
          <label htmlFor={`rc-rate-${serviceKind}`} title="Tühi = teenuse hind">Oma tunnihind (€/h)</label>
          <input id={`rc-rate-${serviceKind}`} className="form-input num" inputMode="decimal" placeholder="teenuse hind" value={hourlyRate} onChange={(e) => onRateChange(e.target.value)} />
        </div>
      )}
      {onFuelChange && (
        <div className="form-group">
          <label htmlFor="rc-fuel">Vaikimisi kütus</label>
          <select id="rc-fuel" className="form-input" value={fuelArticleId ?? ''} onChange={(e) => onFuelChange(e.target.value)}>
            <option value="">{fuelFallback}</option>
            {fuels.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}
    </>
  );
};

/** Tunnihinna tekst → number (tühi → null); koma lubatud. */
export const parseRate = (v: string): number | null => {
  const t = v.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export const rateText = (v: number | null | undefined): string => (v == null ? '' : String(v).replace('.', ','));
```

- [ ] **Step 3: Masina ja haakeriista vorm**

`src/components/VehicleTracker.tsx`:

1. `VehicleTrackerProps`-i lisa `canManageFinance?: boolean;` ja destruktureeri `canManageFinance = false`.
2. Olek (`vCost` kõrvale):
```ts
  const [costArticles, setCostArticles] = useState<Article[]>([]);
  const [vServiceId, setVServiceId] = useState('');
  const [vRate, setVRate] = useState('');
  const [vFuelId, setVFuelId] = useState('');
  const [impServiceId, setImpServiceId] = useState('');
  const [impRate, setImpRate] = useState('');
```
3. Artiklid laetakse üks kord, kui komponent avatakse:
```ts
  // Teenuste ja kütuste valik ressursi vormidel
  useEffect(() => {
    api.getArticles().then(setCostArticles).catch(() => setCostArticles([]));
  }, []);
```
(`api` ja `Article` importi, kui pole; `api` import on kujul nagu teistes komponentides, nt `import { api } from '../services/api';`.)
4. Masina vormi täitmisel (kus `setVCost(...)`, rida ~726):
```ts
    setVServiceId(v.serviceArticleId ?? '');
    setVRate(rateText(v.hourlyRate));
    setVFuelId(v.fuelArticleId ?? '');
```
   ja uue masina vormi tühjendamisel `setVServiceId(''); setVRate(''); setVFuelId('');`. Haakeriistal samamoodi (`setImpCost` juures, rida ~744): `setImpServiceId(imp.serviceArticleId ?? ''); setImpRate(rateText(imp.hourlyRate));` ja tühjendamisel `setImpServiceId(''); setImpRate('');`.
5. Masina salvestuse objekti (kus `acquisitionCost: parsePositive(vCost)`, rida ~626) lisa:
```ts
      serviceArticleId: vServiceId || null,
      fuelArticleId: vFuelId || null,
      ...(canManageFinance ? { hourlyRate: parseRate(vRate) } : {}),
```
   haakeriista objekti (rida ~660):
```ts
      serviceArticleId: impServiceId || null,
      ...(canManageFinance ? { hourlyRate: parseRate(impRate) } : {}),
```
   Kui salvestus käib `onSave…`/`api` funktsiooni kaudu, mis valib välju ükshaaval, lisa need väljad ka sinna (otsi, kuidas `acquisitionCost` serverisse jõuab, ja tee sama).
6. Masina vormis `<DepreciationFields … cost={vCost} …/>` järele:
```tsx
                <ResourceCostFields
                  serviceKind="MACHINE_TIME" articles={costArticles}
                  serviceArticleId={vServiceId} onServiceChange={setVServiceId}
                  hourlyRate={vRate} onRateChange={setVRate} canManageFinance={canManageFinance}
                  fuelArticleId={vFuelId} onFuelChange={setVFuelId}
                />
```
   haakeriista vormis `<DepreciationFields … cost={impCost} …/>` järele:
```tsx
                <ResourceCostFields
                  serviceKind="IMPLEMENT_TIME" articles={costArticles}
                  serviceArticleId={impServiceId} onServiceChange={setImpServiceId}
                  hourlyRate={impRate} onRateChange={setImpRate} canManageFinance={canManageFinance}
                />
```
7. `src/App.tsx`: `<VehicleTracker`-ile lisa `canManageFinance={user.isAdmin || user.isFinanceManager}`.

- [ ] **Step 4: Töötaja vorm**

`src/components/RelatedPartiesModal.tsx`:

1. Props: `canManageFinance?: boolean;` (destruktureeri vaikimisi `false`).
2. Olek ja artiklite laadimine nagu Step 3-s (`costArticles`, `editServiceId`, `editRate`).
3. Vormi täitmisel (`setEditBankAccount(...)` juures): `setEditServiceId(party.serviceArticleId ?? ''); setEditRate(rateText(party.hourlyRate));`; uue isiku puhul tühjad.
4. Salvestuse objektis (kus `bankAccount: …`, rida ~130):
```ts
      serviceArticleId: editRoles.includes('DRIVER') ? (editServiceId || null) : null,
      ...(canManageFinance ? { hourlyRate: editRoles.includes('DRIVER') ? parseRate(editRate) : null } : {}),
```
   Kontrolli `App.tsx`-i `handleSaveParty`-t ja `api.saveParty`-t: kui need saadavad välju valikuliselt, lisa uued väljad.
5. IBAN välja (`<label>IBAN Pangakonto …`) ploki järele, ainult töötaja rolliga:
```tsx
        {editRoles.includes('DRIVER') && (
          <ResourceCostFields
            serviceKind="LABOR_TIME" articles={costArticles}
            serviceArticleId={editServiceId} onServiceChange={setEditServiceId}
            hourlyRate={editRate} onRateChange={setEditRate} canManageFinance={canManageFinance}
          />
        )}
```
6. `src/App.tsx`: mõlemale `<RelatedPartiesModal`-ile lisa `canManageFinance={user.isAdmin || user.isFinanceManager}`.

- [ ] **Step 5: Vaikimisi teenuse märge artikli vormis ja loendis**

`src/components/ArticleFormDialog.tsx`: hinna välja ploki (`{rules?.price && canManageFinance && (…)}`) järele:
```tsx
            {selectedCategory?.group === 'SERVICE' && ['LABOR_TIME', 'MACHINE_TIME', 'IMPLEMENT_TIME', 'DRYING_TIME'].includes(selectedCategory.systemKind ?? '') && (
              <label className="checkbox-label" title="Kanne kasutab seda teenust, kui töötajal, masinal või haakeriistal pole oma teenust">
                <input type="checkbox" checked={!!form.isDefaultService} disabled={!!initial?.isDefaultService}
                  onChange={(e) => setForm({ ...form, isDefaultService: e.target.checked })} />
                Vaikimisi teenus
              </label>
            )}
```
`selectedCategory` asemel kasuta muutujat, millega vorm praegu valitud liigi `group`/`systemKind` leiab (sama, millest arvutatakse `rules`). Salvestusobjekti lisa `isDefaultService: !!form.isDefaultService`. Kui `initial.isDefaultService`, keela ka liigi valik ja „Aktiivne“ märkeruut (`disabled`), sest server lükkab need muudatused tagasi.

`src/components/ArticlesView.tsx`: artikli nime lahtris nime järele `{m.isDefaultService && <span className="article-default-badge" title="Tööaja liigi vaikimisi teenus">vaikimisi</span>}`; CSS (samasse faili, kus on artiklite tabeli stiilid):
```css
.article-default-badge { margin-left: 6px; padding: 1px 6px; border-radius: 8px; font-size: 11px; background: var(--color-surface-muted, #eef2f7); color: var(--color-text-muted, #475569); }
```
(kasuta faili olemasolevaid värvimuutujaid, kui need on teistsuguse nimega).

- [ ] **Step 6: Kütus finantsaknas**

`src/components/FinanceModal.tsx`:
1. Salvestusel (`handleSave`) jäta kütus samuti välja: `if (line.kind === 'MATERIAL' || line.kind === 'FUEL') continue; // kulumaterjali ja kütuse hind tuleb laost (FIFO)`.
2. Hinnalahtris (`line.kind === 'MATERIAL' ? (…FIFO…) : (…input…)`) muuda tingimus `line.kind === 'MATERIAL' || line.kind === 'FUEL'` ja tekst:
```tsx
                                        <span className={`finance-fifo-price ${isMissing || (line.kind === 'FUEL' && !line.articleId) ? 'missing' : ''}`} title="Hind tuleb laost (FIFO)">
                                          {line.kind === 'FUEL' && !line.articleId
                                            ? 'Kütuse artikkel määramata'
                                            : isMissing ? 'ootab arvele võtmist' : `${line.parsedPrice!.toLocaleString('et-EE', { maximumFractionDigits: 4 })} €/${line.unit} · FIFO laost`}
                                        </span>
```
   (`lineCalculations` peab kandma `articleId`-d edasi; kui see kopeerib välju valikuliselt, lisa `articleId: line.articleId ?? null`.)
3. Kinnitamise eelkontrolli (`if (confirm && !allLinesPriced)`) ette:
```ts
    if (confirm && (selectedEntry.lines || []).some((l) => l.kind === 'FUEL' && !l.articleId)) {
      setSaveError('Kütuse artikkel määramata. Määra masinale vaikimisi kütus või jäta aktiivseks ainult üks kütus ja salvesta kanne uuesti.');
      setSaving(false);
      return;
    }
```

- [ ] **Step 7: Tüübikontroll, testid, build**

Run: `ssh … 'cd /home/debian/teris && npx tsc -b --noEmit 2>&1 | tail -20 && npm test 2>&1 | tail -5'`
Expected: tsc vigadeta, testid PASS.

- [ ] **Step 8: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && \
git add src/components/ResourceCostFields.tsx src/types/fleet.ts src/types/party.ts src/types/fieldWork.ts src/components/VehicleTracker.tsx src/components/RelatedPartiesModal.tsx src/App.tsx src/components/ArticleFormDialog.tsx src/components/ArticlesView.tsx src/components/FinanceModal.tsx $(git diff --name-only -- "*.css") && \
git commit -m "Teenused ja kütus: ressursi teenus, tunnihind ja kütus vormidel, vaikimisi teenus, kütus finantsaknas" && npm run release 2>&1 | tail -5'
```
Expected: release vigadeta.

- [ ] **Step 9: Andmemudeli dokument**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsx scripts/generate-erd.mts && git add docs/andmemudel.md && git commit -m "Andmemudel: teenused ja kütus" && git log --oneline -1'
```
Expected: commit tehtud (kui `docs/andmemudel.md` ei muutunud, jäta commit vahele ja märgi see raportisse).

---

## Käsitsi kontroll pärast viimast release'i (kasutajale)

1. Laoarvestus → Artiklid: neli „vaikimisi“ märkega teenust; „Masina tööaeg“ teenusele hind.
2. Masinate register: masinal „Teenus“, „Oma tunnihind“, „Vaikimisi kütus“ (Diislikütus).
3. Uus põllutöö kanne masinaga ja kütusega → finantsaknas masina rea hind täidetud, kütuse rida „FIFO laost“ või „ootab arvele võtmist“.
4. Diislikütuse arvelevõtt laokandega → kande kütuserida saab hinna.
