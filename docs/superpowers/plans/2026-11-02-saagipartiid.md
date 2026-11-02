# Saagipartiid — teostusplaan (artiklid, osa 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Koristuskanded seotakse saagipartiiga; partii kaalumised võtavad toodangu lattu; partii sulgemisel arvutatakse punkri kaal ja kannete tonnid tagasi; partii kuivatuskulud jaotatakse põldudele.

**Architecture:** Puhtad reeglid (punkri kaal, kande tonnid, kulu osakaalud, partii nimi) on `src/services/harvestLotRules.ts`-is. Andmebaasiloogika (kande partii, teraartikkel, sulgemine/avamine) on `src/server/harvestLots.ts`-is, HTTP `src/server/harvestLotApi.ts`-is. Kaalumine on FIFO-s hinnata sissetulek, kauba kuivatuskulu väljaminek; kulu jaotus põldudele arvutatakse finantsakna lugemisel.

**Tech Stack:** React 19 + TypeScript + Vite; `node:http` server (`src/server`); Prisma 6 + PostgreSQL (RLS, tenant_fk trigerid); Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-artiklid-design.md`, jaotis „Osa 4 — saagipartiid“ (ning „Otsused“, „Väljaspool ulatust“, „Testimine“).

## Global Constraints

- Kood on serveris: `debian@uvn-243-120.tll07.zonevs.eu:/home/debian/teris`. Kohalik `/Users/andresj/Progemine/teris` on sshfs-mount: faile võib muuta kohalikult, aga **kõik käsud** käivita `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && …'` kaudu.
- Töö käib otse `master`-harus. Iga ülesande lõpus: commit (sõnumi lõpus rida `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`) + `npm run release` (võib kesta mitu minutit — anna piisav timeout või käivita taustal ja kontrolli `systemctl is-active teris` ning taaskäivituse aega).
- Tüübikontroll: `npx tsc -b`. Testid: `npx vitest run <fail>`. Andmebaasitestid loovad ajutise ettevõtte ja kustutavad kõik oma andmed lõpus (muster: `src/server/inventory.test.ts`); kasutajaid (auth) ei jäeta maha.
- Skeemimuudatus: varukoopia `pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump`; `npx prisma db push` + `npx prisma generate` **ilma `--accept-data-loss`-ita** (küsib → peatu, teata BLOCKED); pärast `psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql` ja `MIGRATE_DATABASE_URL="$MIGRATE_DATABASE_URL" npx tsx scripts/tenancy/05-tenant-fk-triggers.mts`.
- Server-side TS impordid `.ts` laiendiga. Identifikaatorid inglise keeles; kommentaarid ja UI-tekst eesti keeles.
- UI: arvud paremale (`className="num"`), kogused `formatQty`, kuupäevad `pp.kk.aaaa` (`DateInput` / `formatDate`; mitte natiivne `type=date`), filtrid `FilterClear`-is.
- Punkri kaal arvutatakse **ainult sulgemisel**: `bunkerTonnes = (Σ kaalumised − Σ lukustatud kannete tonnid) / Σ lukustamata kannete punkrid`. Lukustamata punkreid 0 → viga **„Partiis pole punkritega kandeid, mille tonne arvutada“**; tulemus negatiivne → viga **„Kaalutud kogus on väiksem kui käsitsi sisestatud tonnid“**.
- Lukustamata kande saagirida: kogus = punkrid × `bunkerTonnes` (lahtises partiis 0 — „kaalumata“), `ratePerHa` = kogus / pindala (kande pindala, puudumisel põllu pindala; 3 komakohta). Kinnitatud kanne, mille kogus muutub → `CHANGED`.
- Uuesti avamine: `bunkerTonnes` tühjaks, kannete tonnid jäävad.
- Suletud partii: sinna uut kannet (valitud partiina), partii vahetust sealt/sinna, punkrite/lukustuse/käsitsi tonnide muutust ega kande kustutamist ei lubata, samuti kaalumise lisamist/kustutamist; viga **„Partii „‹nimi›“ on suletud — ava partii uuesti“**. Partiita uus kanne, mille hooaja ja kultuuri ainus partii on suletud, saab uue automaatse partii (spetsifikatsiooni järgi: „kui lahtist pole, luuakse“). Kuivatuskulusid saab lisada ka suletud partiile.
- Kande partii: valitud partii; muutmisel senine; muidu põllu hooaja ja kultuuri viimane lahtine; puudumisel luuakse „‹kultuur› ‹aasta›“ (võetud nime korral „‹kultuur› ‹aasta› 2“ jne), ladu = põhiladu, artikkel = kultuuri teraartikkel (liik `GRAIN`, `cropId`), puudumisel luuakse „‹kultuur› terad“ (ühik `t`, vaikimisi ladu = põhiladu).
- Kultuur leitakse `fieldSeason.cropId` järgi, puudumisel nime järgi (`matchCrop`); hooaeg `fieldSeason.seasonId`, puudumisel `ensureSeasons([year])`. Kultuurita põllul partiid pole: lukustamata kanne annab vea **„Põllu kultuur on määramata — sisesta tonnid käsitsi“**.
- Kaalumine = toodanguartikli **hinnata** sissetulek partii laos kaalumise kuupäeval (tonnid teisendatakse artikli ühikusse).
- Kuivatuskulu: teenus → ühikuhind = artikli hind, puudumisel sama liigi vaikimisi teenuse hind (ressursi samm jääb vahele); kaup → väljaminek artikli vaikimisi laost (puudumisel partii laost) FIFO hinnaga.
- Põllu kulu = partii kulu × põllu kannete võrdpunkrid / partii võrdpunkrid; lukustamata kande võrdpunkrid = punkrid; lukustatud kandel = tonnid / `bunkerTonnes` (lahtises partiis tema punkrid). Arvutatakse lugemisel, ei kopeerita kanderidadele. Finantsaknas veerg **„Kuivatamine“**.
- PRIA import ja kõik olemasolevad koristuskanded: `harvestLotId = null`, `harvestTonnesManual = true`, tonnid jäävad, lattu ei lähe.
- Saagipartiide muutmine (partii, kaalumised, kulud, sulgemine) ja kulude raha nõuavad finantsõigust (`isAdmin || isFinanceManager`); kande vormi lahtiste partiide loend on kõigile.

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `src/services/harvestLotRules.ts` (uus) | `computeBunkerTonnes`, `entryHarvestTonnes`, `lotCostShares`, `defaultLotName`, `lotServicePrice` |
| `src/server/stockFifo.ts` (muuda) | hinnata sissetulek (`amount` puudub) |
| `prisma/schema.prisma` (muuda) | `HarvestLot`, `HarvestLotWeighing`, `HarvestLotCost`, `WorkEntry.harvestLotId`/`harvestTonnesManual`, `WriteOffReason.SOLD` |
| `scripts/harvest-lots-init.mts` (uus) | olemasolevad koristuskanded käsitsi tonnidega |
| `src/server/harvestLots.ts` (uus) | `ensureGrainArticle`, `openLotsFor`, `applyEntryHarvest`, `closeLot`, `reopenLot`, `HarvestLotError` |
| `src/server/fieldWorkRules.ts`, `src/server/fieldWorks.ts`, `src/server/fieldBookImport.ts` (muuda) | kande partii, saagirida, PRIA import, finantsakna kuivatuskulu |
| `src/server/stock.ts`, `stockApi.ts`, `mcp/tools/stock.ts`, `articleUnitChange.ts` (muuda) | kaalumised ja kulud laoarvestuses |
| `src/server/harvestLotApi.ts` (uus), `src/server/apiHandler.ts` (muuda) | partiide HTTP |
| `src/types/harvestLot.ts` (uus), `src/services/api.ts`, `src/components/HarvestLotsPanel.tsx` (uus), `HarvestLotDialog.tsx` (uus), `ArticlesView.tsx`, `FieldWorkEntryDialog.tsx`, `PriaLinesEditor.tsx`, `FinanceModal.tsx`, `src/types/stock.ts`, `src/types/fieldWork.ts` | kasutajaliides |

---

### Task 1: Puhtad reeglid ja hinnata sissetulek FIFO-s

**Files:**
- Create: `src/services/harvestLotRules.ts`, `src/services/harvestLotRules.test.ts`
- Modify: `src/server/stockFifo.ts`, `src/server/stockFifo.test.ts`

**Interfaces:**
- Produces: `interface LotEntryShare { key: string; bunkers: number | null; manual: boolean; tonnes: number }`; `computeBunkerTonnes(weighedTonnes: number, entries: LotEntryShare[]): { ok: true; bunkerTonnes: number } | { ok: false; error: string }`; `entryHarvestTonnes(bunkers: number | null, bunkerTonnes: number | null): number`; `lotCostShares(bunkerTonnes: number | null, entries: LotEntryShare[]): Map<string, number>` (osakaal 0..1, sama `key` liidetakse); `defaultLotName(cropName: string, year: number, taken: string[]): string`; `lotServicePrice(articlePrice: number | null, defaultPrice: number | null): number | null`. FIFO: `Movement` tüüpi `IN` ilma `amount`-ita = hinnata partii; ei muuda `lastReceiptUnitCost`-i.

- [ ] **Step 1: Kirjuta testid** `src/services/harvestLotRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeBunkerTonnes, entryHarvestTonnes, lotCostShares, defaultLotName, lotServicePrice } from './harvestLotRules';

const e = (key: string, bunkers: number | null, manual = false, tonnes = 0) => ({ key, bunkers, manual, tonnes });

describe('computeBunkerTonnes', () => {
  it('(kaalutud − lukustatud tonnid) / lukustamata punkrid', () => {
    expect(computeBunkerTonnes(30, [e('a', 4), e('b', 6), e('c', 2, true, 5)])).toEqual({ ok: true, bunkerTonnes: 2.5 });
  });
  it('lukustamata punkriteta ja negatiivse tulemusega keelatakse', () => {
    expect(computeBunkerTonnes(30, [e('c', 2, true, 5)])).toEqual({ ok: false, error: 'Partiis pole punkritega kandeid, mille tonne arvutada' });
    expect(computeBunkerTonnes(4, [e('a', 4), e('c', null, true, 5)])).toEqual({ ok: false, error: 'Kaalutud kogus on väiksem kui käsitsi sisestatud tonnid' });
  });
});

describe('entryHarvestTonnes', () => {
  it('punkrid × punkri kaal; lahtises partiis või punkriteta 0', () => {
    expect(entryHarvestTonnes(4, 2.5)).toBe(10);
    expect(entryHarvestTonnes(4, null)).toBe(0);
    expect(entryHarvestTonnes(null, 2.5)).toBe(0);
  });
});

describe('lotCostShares', () => {
  it('suletud partii: lukustatud kanne tonnid / punkri kaal, sama võti liidetakse', () => {
    const s = lotCostShares(2.5, [e('f1', 4), e('f2', 6), e('f1', 2, true, 5)]);
    expect(s.get('f1')).toBeCloseTo(0.5, 9); // (4 + 5/2,5) / 12
    expect(s.get('f2')).toBeCloseTo(0.5, 9);
  });
  it('lahtine partii: lukustatud kanne oma punkritega; punkriteta tühi', () => {
    const s = lotCostShares(null, [e('f1', 1), e('f2', 3, true, 9)]);
    expect(s.get('f1')).toBeCloseTo(0.25, 9);
    expect(s.get('f2')).toBeCloseTo(0.75, 9);
    expect(lotCostShares(null, [e('f1', null, true, 5)]).size).toBe(0);
  });
});

describe('defaultLotName ja lotServicePrice', () => {
  it('võetud nime korral number juurde', () => {
    expect(defaultLotName('Talinisu', 2026, [])).toBe('Talinisu 2026');
    expect(defaultLotName('Talinisu', 2026, ['Talinisu 2026', 'Talinisu 2026 2'])).toBe('Talinisu 2026 3');
  });
  it('teenuse hind: artikli hind, puudumisel vaikimisi teenuse hind', () => {
    expect(lotServicePrice(12, 30)).toBe(12);
    expect(lotServicePrice(null, 30)).toBe(30);
    expect(lotServicePrice(null, null)).toBeNull();
  });
});
```
`src/server/stockFifo.test.ts` lõppu (failis on `seq`, `A`, `inM`, `outM`):
```ts
describe('hinnata sissetulek (kaalumine)', () => {
  const inU = (ref: string, date: string, quantity: number, warehouseId = A): Movement => ({ ref, date, seq: seq++, kind: 'IN', warehouseId, quantity });
  it('summata sissetulek on hinnata partii ega muuda viimase arvelevõtu hinda', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 5, 10), inU('w1', '2026-02-01', 10), outM('o1', '2026-03-01', 8)]);
    expect(r.outs.get('o1')).toEqual({ cost: 10, unpricedQty: 3, shortageQty: 0, missingQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: 7, value: 0, unpricedQty: 7, pricedQty: 0 });
    expect(r.lastReceiptUnitCost).toBe(2);
  });
});
```

- [ ] **Step 2: Käivita, veendu et kukuvad**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/services/harvestLotRules.test.ts src/server/stockFifo.test.ts 2>&1 | tail -15'`
Expected: FAIL (moodul puudub; summata IN on praegu 0-hinnaga).

- [ ] **Step 3: Kirjuta `src/services/harvestLotRules.ts`** (impordi stiil nagu `src/services/articleRules.ts`-is):

```ts
// src/services/harvestLotRules.ts — saagipartii reeglid (puhtad funktsioonid): punkri kaal sulgemisel,
// kande saagi tonnid, kuivatuskulu osakaalud põldudele, automaatse partii nimi.
import { pickServicePrice } from './articleRules.ts';

/** Partii kanne jaotuse ja sulgemise jaoks. */
export interface LotEntryShare {
  key: string; // jaotuse võti (nt põlluhooaja id); sama võtmega kanded liidetakse
  bunkers: number | null;
  manual: boolean; // tonnid käsitsi lukustatud
  tonnes: number; // saagirea kogus
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Punkri kaal: (Σ kaalumised − Σ lukustatud kannete tonnid) / Σ lukustamata kannete punkrid. */
export function computeBunkerTonnes(weighedTonnes: number, entries: LotEntryShare[]): { ok: true; bunkerTonnes: number } | { ok: false; error: string } {
  const lockedTonnes = entries.filter((x) => x.manual).reduce((s, x) => s + x.tonnes, 0);
  const bunkers = entries.filter((x) => !x.manual).reduce((s, x) => s + (x.bunkers ?? 0), 0);
  if (!(bunkers > 0)) return { ok: false, error: 'Partiis pole punkritega kandeid, mille tonne arvutada' };
  const rest = weighedTonnes - lockedTonnes;
  if (rest < 0) return { ok: false, error: 'Kaalutud kogus on väiksem kui käsitsi sisestatud tonnid' };
  return { ok: true, bunkerTonnes: round6(rest / bunkers) };
}

/** Lukustamata kande saagi tonnid: punkrid × punkri kaal; lahtises partiis (punkri kaal puudub) 0 — kaalumata. */
export function entryHarvestTonnes(bunkers: number | null, bunkerTonnes: number | null): number {
  if (bunkerTonnes === null || !(bunkers && bunkers > 0)) return 0;
  return round6(bunkers * bunkerTonnes);
}

/**
 * Partii kulu osakaalud võtme kaupa võrdpunkrite järgi: lukustamata kanne = punkrid;
 * lukustatud kanne = tonnid / punkri kaal (lahtises partiis tema punkrid).
 */
export function lotCostShares(bunkerTonnes: number | null, entries: LotEntryShare[]): Map<string, number> {
  const weights = entries.map((x) => ({
    key: x.key,
    w: Math.max(0, x.manual && bunkerTonnes && bunkerTonnes > 0 ? x.tonnes / bunkerTonnes : x.bunkers ?? 0)
  }));
  const total = weights.reduce((s, x) => s + x.w, 0);
  const out = new Map<string, number>();
  if (!(total > 0)) return out;
  for (const x of weights) out.set(x.key, (out.get(x.key) ?? 0) + x.w / total);
  return out;
}

/** Automaatse partii nimi „‹kultuur› ‹aasta›“; võetud nime korral järjenumber. */
export function defaultLotName(cropName: string, year: number, taken: string[]): string {
  const base = `${cropName} ${year}`;
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base} ${i}`)) return `${base} ${i}`;
}

/** Kuivatusteenuse ühikuhind: artikli hind, puudumisel sama liigi vaikimisi teenuse hind (ressursi samm jääb vahele). */
export const lotServicePrice = (articlePrice: number | null, defaultPrice: number | null): number | null =>
  pickServicePrice(null, articlePrice, defaultPrice);
```

- [ ] **Step 4: Muuda `src/server/stockFifo.ts`** — `IN` haru:
```ts
    if (m.kind === 'IN') {
      // Summata sissetulek (saagi kaalumine) on hinnata partii
      const unitCost = m.amount === undefined ? null : m.quantity > 0 ? m.amount / m.quantity : 0;
      receive(m.warehouseId, m.quantity, unitCost);
      if (unitCost !== null && m.quantity > 0) lastReceipt = unitCost;
      continue;
    }
```
ja `Movement.amount` kommentaar: `// IN: rea summa; puudub = hinnata sissetulek (saagi kaalumine)`.

- [ ] **Step 5: Testid ja tüübikontroll**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/services/harvestLotRules.test.ts src/server/stockFifo.test.ts 2>&1 | tail -8 && npx tsc -b 2>&1 | tail -20'`
Expected: PASS. Kui mõni olemasolev `stockFifo.test.ts` test kasutab `IN`-i ilma `amount`-ita ja ootab 0-hinda, raporteeri see (ära muuda testi tähendust vaikides).

- [ ] **Step 6: Kõik testid, commit, release**
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test 2>&1 | tail -5 && \
git add src/services/harvestLotRules.ts src/services/harvestLotRules.test.ts src/server/stockFifo.ts src/server/stockFifo.test.ts && \
git commit -m "Saagipartiid: punkri kaalu ja kulu jaotuse reeglid, hinnata sissetulek

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release 2>&1 | tail -5'
```

---

### Task 2: Andmemudel ja algseis

**Files:**
- Modify: `prisma/schema.prisma`, `src/server/fieldBookImport.ts`
- Create: `scripts/harvest-lots-init.mts`

**Interfaces:**
- Produces: Prisma mudelid `HarvestLot` (`harvestLot`), `HarvestLotWeighing` (`harvestLotWeighing`), `HarvestLotCost` (`harvestLotCost`), enum `HarvestLotStatus { OPEN, CLOSED }`, `WorkEntry.harvestLotId String?`, `WorkEntry.harvestTonnesManual Boolean`, `WriteOffReason.SOLD`.

- [ ] **Step 1: Skeem** — `prisma/schema.prisma`, laoarvestuse sektsiooni lõppu (pärast `ArticleStock`-i):

```prisma
// ============================================================================
// 9c. SAAGIPARTIID
// Koristuskanded → partii; kaalumised võtavad toodangu lattu (hinnata); sulgemisel arvutatakse punkri kaal
// ja kannete tonnid (src/server/harvestLots.ts); kuivatuskulud jaotatakse põldudele lugemisel.
// ============================================================================

enum HarvestLotStatus {
  OPEN // lahtine: kandeid ja kaalumisi saab lisada
  CLOSED // suletud: punkri kaal arvutatud
}

model HarvestLot {
  id           String           @id @default(cuid())
  tenantId     String           @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  name         String // "Talinisu 2026"
  seasonId     Int
  cropId       String
  articleId    String // toodanguartikkel (liik GRAIN)
  warehouseId  String // hoidla
  status       HarvestLotStatus @default(OPEN)
  bunkerTonnes Float? // arvutatud punkri kaal; täitub sulgemisel
  closedAt     DateTime?
  notes        String?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt
  createdBy    String? // looja kasutajatunnus (täidetakse automaatselt)
  updatedBy    String? // viimase muutja kasutajatunnus (täidetakse automaatselt)

  season    Season               @relation(fields: [seasonId], references: [id], onDelete: Restrict)
  crop      Crop                 @relation(fields: [cropId], references: [id], onDelete: Restrict)
  article   Article              @relation("HarvestLotArticle", fields: [articleId], references: [id], onDelete: Restrict)
  warehouse Warehouse            @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  entries   WorkEntry[]
  weighings HarvestLotWeighing[]
  costs     HarvestLotCost[]

  @@unique([tenantId, name])
  @@index([seasonId])
  @@index([cropId])
  @@index([articleId])
  @@index([warehouseId])
  @@index([tenantId])
  @@map("harvest_lots")
}

// Kaalumine = toodangu arvelevõtt partii hoidlasse (hinnata)
model HarvestLotWeighing {
  id        String   @id @default(cuid())
  tenantId  String   @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  lotId     String
  date      DateTime
  tonnes    Float
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String? // looja kasutajatunnus (täidetakse automaatselt)
  updatedBy String? // viimase muutja kasutajatunnus (täidetakse automaatselt)

  lot HarvestLot @relation(fields: [lotId], references: [id], onDelete: Cascade)

  @@index([lotId])
  @@index([tenantId])
  @@map("harvest_lot_weighings")
}

// Kuivatuskulu: teenus (tunnid, hind artiklist) või kaup (laost maha FIFO-ga)
model HarvestLotCost {
  id        String   @id @default(cuid())
  tenantId  String   @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  lotId     String
  date      DateTime
  articleId String
  quantity  Float // artikli ühikus
  unitPrice Decimal? @db.Decimal(12, 4) // teenusel artiklist, kaubal FIFO (kirjutab ümberarvutus)
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String? // looja kasutajatunnus (täidetakse automaatselt)
  updatedBy String? // viimase muutja kasutajatunnus (täidetakse automaatselt)

  lot     HarvestLot @relation(fields: [lotId], references: [id], onDelete: Cascade)
  article Article    @relation("HarvestLotCostArticle", fields: [articleId], references: [id], onDelete: Restrict)

  @@index([lotId])
  @@index([articleId])
  @@index([tenantId])
  @@map("harvest_lot_costs")
}
```
Tagasiseosed: `Season`-ile `harvestLots HarvestLot[]`; `Crop`-ile `harvestLots HarvestLot[]`; `Article`-ile `harvestLots HarvestLot[] @relation("HarvestLotArticle")` ja `harvestLotCosts HarvestLotCost[] @relation("HarvestLotCostArticle")`; `Warehouse`-ile `harvestLots HarvestLot[]`.
`WorkEntry`-le (pärast `harvestBunkers`):
```prisma
  harvestLotId         String? // saagipartii (koristuskanne); PRIA impordil tühi
  harvestTonnesManual  Boolean       @default(false) // saagi tonnid käsitsi lukustatud, punkri kaalu jaotusest väljas
```
seos `harvestLot HarvestLot? @relation(fields: [harvestLotId], references: [id], onDelete: SetNull)` ja `@@index([harvestLotId])`.
`WriteOffReason`-ile `SOLD // müük`.

- [ ] **Step 2: Varukoopia ja db push**
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && \
pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump && ls -t ~/backups | head -1 && \
npx prisma db push && npx prisma generate && \
psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql && \
MIGRATE_DATABASE_URL="$MIGRATE_DATABASE_URL" npx tsx scripts/tenancy/05-tenant-fk-triggers.mts'
```
Expected: „Your database is now in sync“ ilma andmekao hoiatuseta, `OK: N trigerit` (N suurem kui enne — uued tabelid). Kontrolli: `psql … -c "select tablename from pg_tables where tablename like 'harvest_lot%'"` annab 3 tabelit ja `select relname, relrowsecurity, relforcerowsecurity from pg_class where relname like 'harvest_lot%'` näitab RLS-i sees (kui mitte, uuri, kas `02-rls.sql` vajab uute tabelite nimesid, ja lisa need sinna sama mustri järgi).

- [ ] **Step 3: PRIA import** — `src/server/fieldBookImport.ts` `entryData` tagastusse lisa `harvestTonnesManual: true` (imporditud koristuskande tonnid on käsitsi, partiita; teistele kannetele mõju pole, sest väli loeb ainult saagireal).

- [ ] **Step 4: Algseisu skript** `scripts/harvest-lots-init.mts`:
```ts
// scripts/harvest-lots-init.mts — saagipartiide algseis: olemasolevad koristuskanded (sh PRIA import) jäävad
// käsitsi tonnidega ja partiita (lattu ei lähe). Korduvkäivitatav. Käivita: npx tsx scripts/harvest-lots-init.mts
import { authDb, runAsTenant, tenantTransaction } from '../src/server/db.ts';

const tenants = await authDb().tenant.findMany({ select: { id: true, name: true } });
for (const t of tenants) {
  await runAsTenant(t.id, async () => {
    const { count } = await tenantTransaction((tx) => tx.workEntry.updateMany({
      where: { harvestLotId: null, harvestTonnesManual: false, lines: { some: { kind: 'HARVEST' } } },
      data: { harvestTonnesManual: true }
    }));
    console.log(`${t.name}: käsitsi tonnidega koristuskandeid ${count}`);
  });
}
process.exit(0);
```
(Kontrolli `scripts/services-fuel-init.mts` lõppu — kasuta sama lõpetamise viisi.)

- [ ] **Step 5: Tüübikontroll, testid, skript, commit, release**
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc -b 2>&1 | tail -10 && npm test 2>&1 | tail -5 && \
npx tsx scripts/harvest-lots-init.mts && npx tsx scripts/harvest-lots-init.mts && \
git add prisma/schema.prisma src/server/fieldBookImport.ts scripts/harvest-lots-init.mts && \
git commit -m "Saagipartiid: andmemudel, PRIA import käsitsi tonnidega, algseis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release 2>&1 | tail -5'
```
Expected: esimene käivitus näitab iga ettevõtte koristuskannete arvu (live'is u 31 / 62 / 27), teine 0.

---

### Task 3: Kande partii, sulgemine ja uuesti avamine

**Files:**
- Create: `src/server/harvestLots.ts`, `src/server/harvestLots.test.ts`
- Modify: `src/server/fieldWorkRules.ts` (+ test), `src/server/fieldWorks.ts` (kande sisend, POST, PUT, DELETE, DTO)

**Interfaces:**
- Consumes: Task 1 reeglid; Task 2 skeem; `ensureSeasons` (`src/server/seasons.ts`), `systemCategoryId` (`src/server/articleCategories.ts`), `getDefaultWarehouseId` (`src/server/stock.ts`), `matchCrop` (`src/server/fieldWorkRules.ts`).
- Produces: `class HarvestLotError extends Error`; `closedLotError(name: string): string`; `ensureGrainArticle(tx, crop: { id: string; name: string }): Promise<string>`; `openLotsFor(tx, fieldSeasonId: number): Promise<{ id: string; name: string }[]>`; `applyEntryHarvest(tx, drafts: LineDraft[], input: EntryHarvestInput): Promise<string | null>`; `closeLot(tx, id: string): Promise<void>`; `reopenLot(tx, id: string): Promise<void>`. `EntryQuantities.harvest.withBunkers?: boolean` (saagirida ka koguse ja tüübita). Kande DTO-s `harvestLotId`, `harvestLotName`, `harvestLotStatus`, `harvestTonnesManual`. Kande sisendis `harvestLotId`, `harvestTonnesManual`.

- [ ] **Step 1: `fieldWorkRules.ts`** — `EntryQuantities.harvest` tüüpi lisa `withBunkers?: boolean` ja `buildEntryLines`-is tingimus:
```ts
  // Saagi ja kultuuri tüüp salvestatakse ka siis, kui kogus pole veel teada (kogus 0); partii kandel ka punkritega
  if (q.harvest && (positive(q.harvest.tonnes) || q.harvest.priaKind || q.harvest.priaSpec || q.harvest.withBunkers)) {
```
Test `src/server/fieldWorkRules.test.ts`-i:
```ts
  it('punkritega koristuskanne saab saagirea ka koguse ja tüübita', () => {
    const lines = buildEntryLines({ harvest: { tonnes: null, ratePerHa: null, priaKind: null, priaSpec: null, withBunkers: true } });
    expect(lines).toEqual([expect.objectContaining({ kind: 'HARVEST', quantity: 0, unit: 't' })]);
  });
```

- [ ] **Step 2: Kirjuta `src/server/harvestLots.ts`**:
```ts
// src/server/harvestLots.ts — saagipartiid: koristuskande partii ja saagirea kogus, kultuuri teraartikkel,
// partii sulgemine (punkri kaal, kannete tonnid) ja uuesti avamine. Reeglid: src/services/harvestLotRules.ts.
import type { TxClient } from './db.ts';
import { ensureSeasons } from './seasons.ts';
import { getDefaultWarehouseId } from './stock.ts';
import { systemCategoryId } from './articleCategories.ts';
import { matchCrop, type LineDraft } from './fieldWorkRules.ts';
import { computeBunkerTonnes, defaultLotName, entryHarvestTonnes } from '../services/harvestLotRules.ts';

export class HarvestLotError extends Error {}
export const closedLotError = (name: string) => `Partii „${name}“ on suletud — ava partii uuesti`;
export const NO_CROP_ERROR = 'Põllu kultuur on määramata — sisesta tonnid käsitsi';

const rate3 = (qty: number, area: number) => (qty > 0 && area > 0 ? Math.round((qty / area) * 1000) / 1000 : null);

// Automaatse partii loomine serialiseeritakse ettevõtte piires (sama hooaja ja kultuuri topeltpartii vältimiseks)
async function lockLots(tx: TxClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('harvest-lot:' || current_setting('app.tenant_id')))`;
}

/** Kultuuri teraartikkel (liik GRAIN); puudumisel luuakse „‹kultuur› terad“ (ühik t, vaikimisi ladu = põhiladu). */
export async function ensureGrainArticle(tx: TxClient, crop: { id: string; name: string }): Promise<string> {
  const found = await tx.article.findFirst({
    where: { cropId: crop.id, category: { systemKind: 'GRAIN' } },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    select: { id: true }
  });
  if (found) return found.id;
  const categoryId = await systemCategoryId(tx, 'GRAIN');
  const name = `${crop.name} terad`;
  const byName = await tx.article.findFirst({ where: { categoryId, name }, select: { id: true } });
  if (byName) return byName.id;
  return (await tx.article.create({ data: { name, categoryId, unit: 't', cropId: crop.id, defaultWarehouseId: await getDefaultWarehouseId(tx) } })).id;
}

/** Põlluhooaja hooaeg ja kultuur; kultuurita või tundmatu kultuuriga põllul partiid pole (null). */
async function lotKeyOf(tx: TxClient, fieldSeasonId: number) {
  const fs = await tx.fieldSeason.findUnique({ where: { id: fieldSeasonId }, select: { year: true, seasonId: true, crop: true, cropId: true } });
  if (!fs) return null;
  const crops = await tx.crop.findMany({ select: { id: true, name: true } });
  const crop = (fs.cropId ? crops.find((c) => c.id === fs.cropId) : undefined) ?? matchCrop(fs.crop, crops);
  if (!crop) return null;
  const seasonId = fs.seasonId ?? (await ensureSeasons([fs.year], tx)).get(fs.year) ?? null;
  return seasonId === null ? null : { seasonId, year: fs.year, crop };
}

/** Põllu hooaja ja kultuuri lahtised partiid, uuemad eespool (kande vormi valik). */
export async function openLotsFor(tx: TxClient, fieldSeasonId: number): Promise<{ id: string; name: string }[]> {
  const key = await lotKeyOf(tx, fieldSeasonId);
  if (!key) return [];
  return tx.harvestLot.findMany({ where: { seasonId: key.seasonId, cropId: key.crop.id, status: 'OPEN' }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true } });
}

async function findOrCreateOpenLot(tx: TxClient, key: NonNullable<Awaited<ReturnType<typeof lotKeyOf>>>): Promise<string> {
  await lockLots(tx);
  const open = await tx.harvestLot.findFirst({ where: { seasonId: key.seasonId, cropId: key.crop.id, status: 'OPEN' }, orderBy: { createdAt: 'desc' }, select: { id: true } });
  if (open) return open.id;
  const taken = (await tx.harvestLot.findMany({ select: { name: true } })).map((l) => l.name);
  return (await tx.harvestLot.create({
    data: {
      name: defaultLotName(key.crop.name, key.year, taken), seasonId: key.seasonId, cropId: key.crop.id,
      articleId: await ensureGrainArticle(tx, key.crop), warehouseId: await getDefaultWarehouseId(tx)
    }
  })).id;
}

export interface EntryHarvestInput {
  fieldSeasonId: number;
  areaHa: number | null; // kande pindala; puudumisel põllu pindala
  fieldAreaHa: number;
  bunkers: number | null;
  manual: boolean; // tonnid käsitsi lukustatud
  requestedLotId: string | null; // vormil valitud partii
  old: { harvestLotId: string | null; harvestBunkers: number | null; harvestTonnesManual: boolean; harvestTonnes: number } | null; // muudetav kanne
}

/**
 * Koristuskande partii ja saagirea kogus (muudab drafts-i saagirida). Lukustamata kande kogus = punkrid × punkri kaal
 * suletud partiis, lahtises 0 (kaalumata). Suletud partii kanne ei muutu. Tagastab partii id (saagireata kandel null).
 */
export async function applyEntryHarvest(tx: TxClient, drafts: LineDraft[], input: EntryHarvestInput): Promise<string | null> {
  const line = drafts.find((l) => l.kind === 'HARVEST');
  let lotId: string | null = null;
  if (line) {
    if (input.requestedLotId) {
      const req = await tx.harvestLot.findUnique({ where: { id: input.requestedLotId }, select: { id: true } });
      if (!req) throw new HarvestLotError('Saagipartiid ei leitud');
      lotId = req.id;
    } else if (input.old?.harvestLotId) lotId = input.old.harvestLotId;
    else {
      const key = await lotKeyOf(tx, input.fieldSeasonId);
      if (key) lotId = await findOrCreateOpenLot(tx, key);
    }
    if (!lotId && !input.manual) throw new HarvestLotError(NO_CROP_ERROR);
  }
  const lots = await tx.harvestLot.findMany({
    where: { id: { in: [lotId, input.old?.harvestLotId].filter((x): x is string => !!x) } },
    select: { id: true, name: true, status: true, bunkerTonnes: true }
  });
  // Suletud partii: uus kanne, partii vahetus või saagi muutus nõuab partii uuesti avamist
  const old = input.old;
  const changed = !old || old.harvestLotId !== lotId || old.harvestBunkers !== input.bunkers || old.harvestTonnesManual !== input.manual
    || (input.manual && old.harvestTonnes !== (line?.quantity ?? 0));
  const closed = lots.find((l) => l.status === 'CLOSED');
  if (closed && changed) throw new HarvestLotError(closedLotError(closed.name));
  if (line && !input.manual) {
    const lot = lots.find((l) => l.id === lotId);
    const qty = lot?.status === 'CLOSED' ? entryHarvestTonnes(input.bunkers, lot.bunkerTonnes) : 0;
    line.quantity = qty;
    line.ratePerHa = rate3(qty, input.areaHa ?? input.fieldAreaHa);
  }
  return lotId;
}

/** Sulgemine: punkri kaal ja lukustamata kannete saagi tonnid; kinnitatud kanne, mille kogus muutub → CHANGED. */
export async function closeLot(tx: TxClient, id: string): Promise<void> {
  await lockLots(tx);
  const lot = await tx.harvestLot.findUnique({
    where: { id },
    select: {
      status: true,
      weighings: { select: { tonnes: true } },
      entries: {
        select: {
          id: true, harvestBunkers: true, harvestTonnesManual: true, financeStatus: true, areaHa: true,
          fieldWork: { select: { fieldSeason: { select: { areaHa: true } } } },
          lines: { where: { kind: 'HARVEST' }, select: { id: true, quantity: true, confirmedQuantity: true } }
        }
      }
    }
  });
  if (!lot) throw new HarvestLotError('Saagipartiid ei leitud');
  if (lot.status === 'CLOSED') throw new HarvestLotError('Partii on juba suletud');
  const r = computeBunkerTonnes(
    lot.weighings.reduce((s, w) => s + w.tonnes, 0),
    lot.entries.map((e) => ({ key: e.id, bunkers: e.harvestBunkers, manual: e.harvestTonnesManual, tonnes: e.lines[0]?.quantity ?? 0 }))
  );
  if (!r.ok) throw new HarvestLotError(r.error);
  for (const e of lot.entries) {
    const line = e.lines[0];
    if (e.harvestTonnesManual || !line) continue;
    const qty = entryHarvestTonnes(e.harvestBunkers, r.bunkerTonnes);
    await tx.workEntryLine.update({ where: { id: line.id }, data: { quantity: qty, ratePerHa: rate3(qty, e.areaHa ?? e.fieldWork.fieldSeason.areaHa) } });
    if (e.financeStatus === 'CONFIRMED' && line.confirmedQuantity !== qty) await tx.workEntry.update({ where: { id: e.id }, data: { financeStatus: 'CHANGED' } });
  }
  await tx.harvestLot.update({ where: { id }, data: { status: 'CLOSED', bunkerTonnes: r.bunkerTonnes, closedAt: new Date() } });
}

/** Uuesti avamine: punkri kaal tühjaks; kannete tonnid jäävad kuni järgmise sulgemiseni. */
export async function reopenLot(tx: TxClient, id: string): Promise<void> {
  const lot = await tx.harvestLot.findUnique({ where: { id }, select: { status: true } });
  if (!lot) throw new HarvestLotError('Saagipartiid ei leitud');
  if (lot.status === 'OPEN') throw new HarvestLotError('Partii on juba lahtine');
  await tx.harvestLot.update({ where: { id }, data: { status: 'OPEN', bunkerTonnes: null, closedAt: null } });
}
```
(`LineDraft` on `fieldWorkRules.ts`-is eksporditud; kui `matchCrop` tüüp nõuab, kohanda.)

- [ ] **Step 3: Kirjuta andmebaasitest** `src/server/harvestLots.test.ts`:
```ts
// Saagipartiid ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { applyEntryHarvest, closeLot, reopenLot, HarvestLotError, NO_CROP_ERROR } from './harvestLots';
import { buildEntryLines } from './fieldWorkRules';

const T = `test-tenant-harvestlot-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const tx = <R>(fn: (t: any) => Promise<R>) => run(() => tenantTransaction(fn));
const d = (s: string) => new Date(`${s}T00:00:00Z`);
let fsId = 0;
let fsNoCrop = 0;
let fwId = '';
const draft = () => buildEntryLines({ harvest: { tonnes: null, ratePerHa: null, priaKind: null, priaSpec: null, withBunkers: true } });
const input = (p: Partial<Parameters<typeof applyEntryHarvest>[2]> = {}) => ({ fieldSeasonId: fsId, areaHa: null, fieldAreaHa: 10, bunkers: 4, manual: false, requestedLotId: null, old: null, ...p });
// Kanne partiis: punkrid või käsitsi tonnid
const entry = (lotId: string, bunkers: number | null, manual = false, tonnes = 0, financeStatus: 'PENDING' | 'CONFIRMED' = 'PENDING') => run(() => prisma.workEntry.create({
  data: { fieldWorkId: fwId, date: d('2026-08-01'), harvestLotId: lotId, harvestBunkers: bunkers, harvestTonnesManual: manual, financeStatus,
    lines: { create: [{ kind: 'HARVEST', label: 'Saak', quantity: tonnes, unit: 't', confirmedQuantity: financeStatus === 'CONFIRMED' ? tonnes : null }] } },
  include: { lines: true }
}));

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test saagipartii' } });
  await run(async () => {
    await prisma.crop.create({ data: { id: `crop-${T}`, name: 'Talinisu' } });
    const field = await prisma.field.create({ data: { num: '1', name: 'Testpõld', fieldCode: 'H-1' } });
    fsId = (await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 10, crop: 'Talinisu allakülvita', geometry: {} } })).id;
    const field2 = await prisma.field.create({ data: { num: '2', name: 'Kultuurita', fieldCode: 'H-2' } });
    fsNoCrop = (await prisma.fieldSeason.create({ data: { fieldId: field2.id, year: 2026, areaHa: 5, crop: 'Määramata', geometry: {} } })).id;
    const wt = await prisma.workType.create({ data: { name: 'Testkoristus', phase: 'HARVEST' } });
    fwId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fsId, workTypeId: wt.id, phase: 'HARVEST' } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.harvestLot.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.crop.deleteMany({});
    await prisma.season.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

describe('saagipartii', () => {
  let lotId = '';
  it('esimene koristuskanne loob partii ja teraartikli; saagirida kaalumata', async () => {
    const drafts = draft();
    lotId = (await tx((t) => applyEntryHarvest(t, drafts, input())))!;
    const lot = await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: lotId }, include: { article: { include: { category: true } } } }));
    expect(lot.name).toBe('Talinisu 2026');
    expect(lot.article.name).toBe('Talinisu terad');
    expect(lot.article.unit).toBe('t');
    expect(lot.article.category.systemKind).toBe('GRAIN');
    expect(drafts[0].quantity).toBe(0);
    expect(await tx((t) => applyEntryHarvest(t, draft(), input()))).toBe(lotId);
  });

  it('kultuurita põllul ilma käsitsi tonnideta viga; käsitsi lubatud partiita', async () => {
    await expect(tx((t) => applyEntryHarvest(t, draft(), input({ fieldSeasonId: fsNoCrop })))).rejects.toThrow(NO_CROP_ERROR);
    expect(await tx((t) => applyEntryHarvest(t, draft(), input({ fieldSeasonId: fsNoCrop, manual: true })))).toBeNull();
  });

  it('sulgemine arvutab punkri kaalu ja kannete tonnid; kinnitatud kanne → CHANGED', async () => {
    const a = await entry(lotId, 4, false, 0, 'CONFIRMED');
    const b = await entry(lotId, 6);
    const c = await entry(lotId, 2, true, 5);
    await run(() => prisma.harvestLotWeighing.createMany({ data: [{ lotId, date: d('2026-08-02'), tonnes: 20 }, { lotId, date: d('2026-08-03'), tonnes: 10 }] }));
    await tx((t) => closeLot(t, lotId));
    const lot = await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: lotId } }));
    expect(lot.status).toBe('CLOSED');
    expect(lot.bunkerTonnes).toBe(2.5);
    const line = (id: string) => run(() => prisma.workEntryLine.findFirstOrThrow({ where: { entryId: id, kind: 'HARVEST' } }));
    expect((await line(a.id)).quantity).toBe(10);
    expect((await line(a.id)).ratePerHa).toBe(1);
    expect((await line(b.id)).quantity).toBe(15);
    expect((await line(c.id)).quantity).toBe(5);
    expect((await run(() => prisma.workEntry.findUniqueOrThrow({ where: { id: a.id } }))).financeStatus).toBe('CHANGED');
  });

  it('suletud partiisse uut kannet ei lisata; muutmata kanne salvestub suletud partii tonnidega', async () => {
    await expect(tx((t) => applyEntryHarvest(t, draft(), input({ requestedLotId: lotId })))).rejects.toThrow('Partii „Talinisu 2026“ on suletud — ava partii uuesti');
    const drafts = draft();
    const old = { harvestLotId: lotId, harvestBunkers: 6, harvestTonnesManual: false, harvestTonnes: 15 };
    expect(await tx((t) => applyEntryHarvest(t, drafts, input({ bunkers: 6, old })))).toBe(lotId);
    expect(drafts[0].quantity).toBe(15);
    await expect(tx((t) => applyEntryHarvest(t, draft(), input({ bunkers: 7, old })))).rejects.toBeInstanceOf(HarvestLotError);
  });

  it('uuesti avamine tühjendab punkri kaalu, tonnid jäävad', async () => {
    await tx((t) => reopenLot(t, lotId));
    const lot = await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: lotId } }));
    expect(lot.status).toBe('OPEN');
    expect(lot.bunkerTonnes).toBeNull();
    const lines = await run(() => prisma.workEntryLine.findMany({ where: { kind: 'HARVEST', entry: { harvestLotId: lotId } }, select: { quantity: true } }));
    expect(lines.map((l) => l.quantity).sort((x, y) => x - y)).toEqual([5, 10, 15]);
  });

  it('punkriteta partii sulgemine keelatakse', async () => {
    const base = await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: lotId } }));
    const empty = await run(() => prisma.harvestLot.create({ data: { name: 'Tühi', seasonId: base.seasonId, cropId: base.cropId, articleId: base.articleId, warehouseId: base.warehouseId } }));
    await expect(tx((t) => closeLot(t, empty.id))).rejects.toThrow('Partiis pole punkritega kandeid, mille tonne arvutada');
    await run(() => prisma.harvestLot.delete({ where: { id: empty.id } })); // muidu oleks see järgmises testis viimane lahtine partii
  });

  it('suletud ainsa partii korral saab uus partiita kanne uue partii', async () => {
    await tx((t) => closeLot(t, lotId)); // kanded a, b, c ja kaalumised on alles
    const next = await tx((t) => applyEntryHarvest(t, draft(), input()));
    expect(next).not.toBe(lotId);
    expect((await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: next! } }))).name).toBe('Talinisu 2026 2');
  });
});
```

- [ ] **Step 4: Käivita, veendu et kukub**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/harvestLots.test.ts src/server/fieldWorkRules.test.ts 2>&1 | tail -15'`
Expected: FAIL enne Step 2 koodi; pärast Step 2 PASS. (TDD järjekorras kirjuta test enne `harvestLots.ts`-i.)

- [ ] **Step 5: Kande salvestus** — `src/server/fieldWorks.ts`:
  - `resolveEntryInput`: `harvest` objekt luuakse ka siis, kui `harvestBunkers` on antud, ja sellele lisatakse `withBunkers`:
    ```ts
    const harvestBunkers = num(body?.harvestBunkers);
    const harvest = h || harvestBunkers !== null
      ? { tonnes: num(h?.tonnes), ratePerHa: num(h?.ratePerHa), priaKind: text(h?.priaKind, 80), priaSpec: text(h?.priaSpec, 80), withBunkers: harvestBunkers !== null }
      : null;
    ```
    `data`-sse `harvestBunkers` (olemas) ja `harvestTonnesManual: body?.harvestTonnesManual === true`; tagastusse `harvestLotId: text(body?.harvestLotId, 64)`.
  - POST tehingus enne `workEntry.create`:
    ```ts
        const fs = await tx.fieldWork.findUniqueOrThrow({ where: { id: work.id }, select: { fieldSeason: { select: { id: true, areaHa: true } } } });
        const harvestLotId = await applyEntryHarvest(tx, drafts, {
          fieldSeasonId: fs.fieldSeason.id, areaHa: data.areaHa, fieldAreaHa: fs.fieldSeason.areaHa,
          bunkers: data.harvestBunkers, manual: data.harvestTonnesManual, requestedLotId: harvestLotIdIn, old: null
        });
    ```
    ja `create` `data`-sse `harvestLotId`. (`harvestLotIdIn` = `resolveEntryInput` tagastatud `harvestLotId`.)
  - PUT: `mergeLines` arvutus tõsta tehingu sisse **pärast** `applyEntryHarvest`-i (drafts muutuvad); `old` päringule lisa `harvestLotId`, `harvestBunkers`, `harvestTonnesManual` (kui `include` neid juba ei too) ja:
    ```ts
        const harvestLotId = await applyEntryHarvest(tx, drafts, {
          fieldSeasonId: fs.fieldSeason.id, areaHa: data.areaHa, fieldAreaHa: fs.fieldSeason.areaHa,
          bunkers: data.harvestBunkers, manual: data.harvestTonnesManual, requestedLotId: harvestLotIdIn,
          old: { harvestLotId: old.harvestLotId, harvestBunkers: old.harvestBunkers, harvestTonnesManual: old.harvestTonnesManual, harvestTonnes: old.lines.find((l) => l.kind === 'HARVEST')?.quantity ?? 0 }
        });
        const merged = mergeLines(old.lines.map(toStored), drafts, old.financeStatus as FinanceStatus);
    ```
    `update` `data`-sse `harvestLotId`.
  - POST ja PUT `catch`: `if (err instanceof HarvestLotError) { json(res, { error: err.message }, 400); return true; }`.
  - DELETE: enne kustutamist, kui kande `harvestLotId`-ga partii on `CLOSED` → `json(res, { error: closedLotError(lot.name) }, 409)`.
  - `ENTRY_INCLUDE`-i lisa `harvestLot: { select: { name: true, status: true } }`; `entryDto`-sse `harvestLotId: e.harvestLotId ?? null, harvestLotName: e.harvestLot?.name ?? null, harvestLotStatus: e.harvestLot?.status ?? null, harvestTonnesManual: e.harvestTonnesManual ?? false`.

- [ ] **Step 6: Testid ja tüübikontroll**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/harvestLots.test.ts src/server/fieldWorkRules.test.ts 2>&1 | tail -8 && npx tsc -b 2>&1 | tail -20 && npm test 2>&1 | tail -5'`
Expected: PASS; tsc vigadeta; kogu komplekt läbi (olemasolevad kande testid ei saa saagireata kannetel muutusi).

- [ ] **Step 7: Commit, release**
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && \
git add src/server/harvestLots.ts src/server/harvestLots.test.ts src/server/fieldWorkRules.ts src/server/fieldWorkRules.test.ts src/server/fieldWorks.ts && \
git commit -m "Saagipartiid: koristuskande partii, sulgemine ja uuesti avamine

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release 2>&1 | tail -5'
```

---

### Task 4: Kaalumised ja kuivatuskulud laoarvestuses

**Files:**
- Modify: `src/server/stock.ts`, `src/server/stockApi.ts` (laokaart, lao kustutamine), `src/server/mcp/tools/stock.ts`, `src/server/articleUnitChange.ts`, `src/server/fieldWorks.ts` (artikli ühendamine ja kustutamine)
- Test: `src/server/harvestLotStock.test.ts` (uus)

**Interfaces:**
- Consumes: Task 1 hinnata `IN`; Task 2 skeem.
- Produces: `loadMovements` sisaldab kaalumisi (`ref` `weigh:<id>`, `IN`, hinnata, partii laos, tonnid → artikli ühik) ja kauba kuivatuskulusid (`ref` `lotcost:<id>`, `OUT`, artikli vaikimisi laost, puudumisel partii laost); `ArticleMovements.lotCostLines: { id: string; ref: string; quantity: number }[]`; `recomputeArticleStock` kirjutab kauba kuivatuskulu `unitPrice`-i (`round4(cost / quantity)`, hindamata → null).

- [ ] **Step 1: Kirjuta andmebaasitest** `src/server/harvestLotStock.test.ts`:
```ts
// Saagipartii kaalumised ja kuivatuskulud laoarvestuses (ajutine ettevõte, live-andmebaas).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { getDefaultWarehouseId, recomputeArticleStock, saveStockDocument } from './stock';
import { systemCategoryId } from './articleCategories';

const T = `test-tenant-lotstock-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(`${s}T00:00:00Z`);
let grainId = '';
let oilId = '';
let lotId = '';
let wh = '';
const stockOf = (articleId: string) => run(() => prisma.articleStock.findUnique({ where: { articleId_warehouseId: { articleId, warehouseId: wh } } }));

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test partii ladu' } });
  await run(async () => {
    wh = await tenantTransaction((tx) => getDefaultWarehouseId(tx));
    const grainCat = await tenantTransaction((tx) => systemCategoryId(tx, 'GRAIN'));
    const oilCat = await tenantTransaction((tx) => systemCategoryId(tx, 'DRYING_OIL'));
    await prisma.crop.create({ data: { id: `crop-${T}`, name: 'Oder' } });
    grainId = (await prisma.article.create({ data: { name: 'Oder terad', categoryId: grainCat, unit: 'kg', cropId: `crop-${T}` } })).id;
    oilId = (await prisma.article.create({ data: { name: 'Kuivatusõli', categoryId: oilCat, unit: 'l' } })).id;
    const season = await prisma.season.create({ data: { year: 2026, name: 'Hooaeg 2026' } });
    lotId = (await prisma.harvestLot.create({ data: { name: 'Oder 2026', seasonId: season.id, cropId: `crop-${T}`, articleId: grainId, warehouseId: wh } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.harvestLot.deleteMany({});
    await prisma.stockDocument.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.crop.deleteMany({});
    await prisma.season.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

describe('partii laoarvestuses', () => {
  it('kaalumine on hinnata sissetulek artikli ühikus partii laos', async () => {
    await run(async () => {
      await prisma.harvestLotWeighing.create({ data: { lotId, date: d('2026-08-02'), tonnes: 2.5 } });
      await tenantTransaction((tx) => recomputeArticleStock(tx, [grainId]));
    });
    const s = await stockOf(grainId);
    expect(s?.qty).toBe(2500);
    expect(s?.unpricedQty).toBe(2500);
    expect(Number(s?.value)).toBe(0);
  });

  it('kauba kuivatuskulu kantakse laost maha FIFO hinnaga', async () => {
    await run(() => tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'RECEIPT', date: d('2026-07-01'), warehouseId: wh, toWarehouseId: null, supplierId: null, documentNo: null,
      writeOffReason: null, notes: null, lines: [{ articleId: oilId, quantity: 100, amount: 150 }]
    })));
    const cost = await run(() => prisma.harvestLotCost.create({ data: { lotId, date: d('2026-08-05'), articleId: oilId, quantity: 30 } }));
    await run(() => tenantTransaction((tx) => recomputeArticleStock(tx, [oilId])));
    const c = await run(() => prisma.harvestLotCost.findUniqueOrThrow({ where: { id: cost.id } }));
    expect(Number(c.unitPrice)).toBe(1.5);
    expect((await stockOf(oilId))?.qty).toBe(70);
  });
});
```

- [ ] **Step 2: Käivita, veendu et kukub**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/harvestLotStock.test.ts 2>&1 | tail -15'`
Expected: FAIL (kaalumist ja kulu ei loeta).

- [ ] **Step 3: `src/server/stock.ts`** — `ArticleMovements`-ile `lotCostLines: { id: string; ref: string; quantity: number }[];` (initsialiseeri `[]`). `loadMovements`-i `Promise.all`-i lisa:
```ts
    tx.harvestLotWeighing.findMany({
      where: { lot: { articleId: { in: articleIds } } },
      select: { id: true, date: true, tonnes: true, createdAt: true, lot: { select: { articleId: true, warehouseId: true } } }
    }),
    tx.harvestLotCost.findMany({
      where: { articleId: { in: articleIds }, article: { category: { group: { not: 'SERVICE' } } } },
      select: { id: true, articleId: true, date: true, quantity: true, createdAt: true, lot: { select: { warehouseId: true } } }
    })
```
ja artikli kaardistuses (pärast kanderidu):
```ts
    // Saagi kaalumine: hinnata sissetulek partii laos (tonnid artikli ühikus)
    for (const w of weighings.filter((x) => x.lot.articleId === m.id)) {
      const qty = convertQty(w.tonnes, 't', m.unit);
      if (qty === null || qty <= 0) continue;
      out.movements.push({ ref: `weigh:${w.id}`, date: isoDay(w.date), seq: w.createdAt.getTime() * 1000, kind: 'IN', warehouseId: w.lot.warehouseId, quantity: qty });
    }
    // Partii kuivatuskulu (kaup): väljaminek artikli vaikimisi laost, puudumisel partii laost
    for (const c of lotCosts.filter((x) => x.articleId === m.id)) {
      if (!(c.quantity > 0)) continue;
      const ref = `lotcost:${c.id}`;
      out.lotCostLines.push({ id: c.id, ref, quantity: c.quantity });
      out.movements.push({ ref, date: isoDay(c.date), seq: c.createdAt.getTime() * 1000, kind: 'OUT', warehouseId: m.defaultWarehouseId ?? c.lot.warehouseId, quantity: c.quantity });
    }
```
`recomputeArticleStock`-is pärast kanderidade hinnastamist:
```ts
    // Partii kuivatuskulu (kaup): FIFO ühikuhind; hindamata → null
    for (const l of mm.lotCostLines) {
      const o = outs.get(l.ref);
      await tx.harvestLotCost.update({ where: { id: l.id }, data: { unitPrice: o && o.unpricedQty === 0 ? round4(o.cost / l.quantity) : null } });
    }
```
Päise kommentaari lisa „saagipartii kaalumised ja kauba kuivatuskulud“.

- [ ] **Step 4: Laokaart** — `src/server/stockApi.ts` liikumiste plokis: `ref` tüübid `weigh` ja `lotcost` on uued; lae need read (`harvestLotWeighing` / `harvestLotCost` `id in …` koos `lot: { select: { id: true, name: true } }`) ja lisa:
```ts
        } else if (type === 'weigh' || type === 'lotcost') {
          const l = type === 'weigh' ? weighById.get(lineId)! : lotCostById.get(lineId)!;
          rows.push({ ...base, ...stockCardFinanceFields(finance, { cost }), source: 'HARVEST_LOT', lotId: l.lot.id, lotName: l.lot.name, lotMovement: type === 'weigh' ? 'WEIGHING' : 'COST' });
        } else {
```
(kaalumise `cost` = `m.amount ?? 0` asemel `null`: `const cost = m.kind === 'IN' ? (m.amount ?? null) : …` — hinnata sissetulek näitab „hindamata“.)
Lao kustutamise kontroll: lisa `prisma.harvestLot.count({ where: { warehouseId: id } })`; kui > 0, sama 409 teade „Laol on … saagipartiid. Märgi see mitteaktiivseks.“ (laienda olemasolevat teksti: `Laol on ${docs} laokannet, ${entries} põllutöö kannet ja ${lots} saagipartiid. Märgi see mitteaktiivseks.`).

- [ ] **Step 5: MCP** — `src/server/mcp/tools/stock.ts` laoliikumiste tööriista: lisa kaalumised (`type: 'HARVEST_WEIGHING'`, quantity tonnid artikli ühikus, `lot`: nimi, cost null) ja kauba kuivatuskulud (`type: 'HARVEST_LOT_COST'`, cost = quantity × unitPrice või null) sama ridade kujuga; kirjeldusse lisa need tüübid.

- [ ] **Step 6: Ühiku teisendus ja artiklid** —
  - `src/server/articleUnitChange.ts`: `harvestLotCost` read (`articleId`) — `quantity: scale(quantity, factor)`, `unitPrice: unitPrice.div(factor).toDecimalPlaces(4)` (nagu kanderidadel).
  - `src/server/fieldWorks.ts` artiklite ühendamine: `tx.harvestLot.updateMany({ where: { articleId: source.id }, data: { articleId: target.id } })`; `harvestLotCost` read: `articleId: target.id`, `quantity: convertQty(quantity, source.unit, target.unit)` (teisendamatu ühiku korral sama 409 kontroll mis laokande ridadel — lisa need read loendisse); pärast `recomputeArticleStock(tx, [target.id])` jääb.
  - Artikli kustutamine (`DELETE /api/articles/…`): olemasolevasse kasutuse kontrolli lisa `harvestLot.count({ where: { articleId } })` ja `harvestLotCost.count({ where: { articleId } })`; kasutuses → sama 409 tekst, mis teistel kasutustel (vaata olemasolevat).

- [ ] **Step 7: Testid ja tüübikontroll**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/harvestLotStock.test.ts src/server/stock.test.ts src/server/inventory.test.ts 2>&1 | tail -8 && npx tsc -b 2>&1 | tail -20 && npm test 2>&1 | tail -5'`
Expected: PASS.

- [ ] **Step 8: Commit, release**
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && \
git add src/server/stock.ts src/server/stockApi.ts src/server/mcp/tools/stock.ts src/server/articleUnitChange.ts src/server/fieldWorks.ts src/server/harvestLotStock.test.ts && \
git commit -m "Saagipartiid: kaalumised ja kuivatuskulud laoarvestuses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release 2>&1 | tail -5'
```

---

### Task 5: Saagipartiide API ja kuivatuskulu finantsaknas

**Files:**
- Create: `src/server/harvestLotApi.ts`
- Modify: `src/server/apiHandler.ts` (registreerimine `handleStock` kõrval), `src/server/fieldWorks.ts` (`/api/finance/field-results`), `src/server/stockRules.ts` (põhjus `SOLD`)

**Interfaces:**
- Consumes: Task 3 `openLotsFor`, `closeLot`, `reopenLot`, `HarvestLotError`, `closedLotError`, `ensureGrainArticle`; Task 4 ümberarvutus; `lotServicePrice`, `lotCostShares`; `ensureDefaultServices` (`src/server/entryArticles.ts`).
- Produces (JSON):
  - `GET /api/harvest-lots?year=` → `HarvestLotSummary[]`: `{ id, name, seasonYear, cropId, cropName, articleId, articleName, warehouseId, warehouseName, status, bunkerTonnes, bunkers, weighedTonnes, entryCount, closedAt }` (`bunkers` = lukustamata kannete punkrid kokku).
  - `GET /api/harvest-lots/:id` → summary + `notes`, `entries: { id, date, fieldName, bunkers, manual, tonnes, financeStatus }[]`, `weighings: { id, date, tonnes, notes }[]`, `costs: { id, date, articleId, articleName, unit, isService, quantity, notes, unitPrice?, total? }[]` (raha ainult finantsõigusega).
  - `GET /api/harvest-lots/open?fieldSeasonId=` → `{ id, name }[]` (kõigile).
  - `POST /api/harvest-lots` (`{ id?, name, year, cropId, warehouseId, notes }`) → summary; `DELETE /api/harvest-lots/:id` (ainult kandeteta).
  - `POST /api/harvest-lots/:id/close`, `/reopen`.
  - `POST /api/harvest-lots/:id/weighings` (`{ date, tonnes, notes }`), `DELETE /api/harvest-lots/:id/weighings/:wid`.
  - `POST /api/harvest-lots/:id/costs` (`{ date, articleId, quantity, notes }`), `DELETE /api/harvest-lots/:id/costs/:cid`.
  - Field results: igal põllul lisaks `drying: number` ja `dryingLots: { name: string; amount: number }[]`; `costTotal` ja `profit` sisaldavad kuivatust.

- [ ] **Step 1: Kirjuta `src/server/harvestLotApi.ts`**. Mustrid võta `src/server/stockApi.ts`-ist (`canSeeFinance`, `text`, `json`, `parseBody`, `tenantTransaction`, `dateOnly`, `isoDate`, `money`). Reeglid:
  - Kõik peale `GET /api/harvest-lots/open` nõuavad finantsõigust (403 tekstiga „Saagipartiid on nähtavad ainult finantsjuhile ja adminile“).
  - Loend: `tx.harvestLot.findMany({ where: year ? { season: { year } } : {}, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], include: { season: { select: { year: true } }, crop: { select: { name: true } }, article: { select: { name: true } }, warehouse: { select: { name: true } }, weighings: { select: { tonnes: true } }, entries: { select: { harvestBunkers: true, harvestTonnesManual: true } } } })`; `bunkers` = Σ `harvestBunkers` lukustamata kannetel; `weighedTonnes` = Σ kaalumised (6 komakohta ümardatud).
  - Loomine: nimi kohustuslik („Partii nimi on kohustuslik“), `year` → `ensureSeasons([year], tx)`, kultuur peab olemas olema („Kultuuri ei leitud“), ladu peab olemas ja aktiivne olema; `articleId = await ensureGrainArticle(tx, crop)`; P2002 → 409 „Sama nimega partii on juba olemas“. Muutmisel saab muuta nime, ladu ja märkust; lao muutus → `recomputeArticleStock(tx, [lot.articleId])`.
  - Kustutamine: kandeid > 0 → 409 „Partiil on kandeid — kustuta või tõsta kanded enne“; muidu kustuta (kaalumised ja kulud kustuvad kaskaadiga) ja arvuta ümber partii artikkel ning kulude kauba-artiklid.
  - Sulge/ava: `tenantTransaction((tx) => closeLot(tx, id))`; `HarvestLotError` → 400.
  - Kaalumine: suletud partii → 409 `closedLotError(name)`; `tonnes` > 0 („Kaal peab olema suurem kui 0“), kuupäev kohustuslik; salvestus + `recomputeArticleStock(tx, [lot.articleId])`; kustutamine sama suletud partii kontrolliga.
  - Kulu: artikkel peab olemas olema; `quantity` > 0. Teenus (`category.group === 'SERVICE'`) → `unitPrice = lotServicePrice(article.price, defaults.get(article.category.systemKind)?.price ?? null)` (`defaults = await ensureDefaultServices(tx)`; kui liik pole tööaja liik, vaikimisi hind null). Kaup → `unitPrice: null` ja pärast salvestust `recomputeArticleStock(tx, [articleId])`. Kustutamine arvutab kauba artikli ümber. Kulu lisamine on lubatud ka suletud partiile.
  - Detaili kulurida: `total = unitPrice === null ? null : round2(quantity × unitPrice)`.

- [ ] **Step 2: Registreeri** `src/server/apiHandler.ts`-is `handleStock` kõrval: `if (await handleHarvestLots(req, res, pathname, method, url)) return;` (import `./harvestLotApi.ts`). Kontrolli, et `/api/harvest-lots` läbib sama autentimise kui `/api/stock/…` (vaata, kuidas `handleStock` eelnev kood sessiooni nõuab).

- [ ] **Step 3: Finantsaken** — `src/server/fieldWorks.ts` `/api/finance/field-results`: pärast tulemuste arvutamist:
```ts
      // Partii kuivatuskulu põldudele: partii kulu × põllu võrdpunkrid / partii võrdpunkrid (arvutatakse lugemisel)
      const lots = await prisma.harvestLot.findMany({
        where: { season: { year } },
        select: {
          name: true, bunkerTonnes: true,
          costs: { select: { quantity: true, unitPrice: true } },
          entries: { select: { harvestBunkers: true, harvestTonnesManual: true, fieldWork: { select: { fieldSeasonId: true } }, lines: { where: { kind: 'HARVEST' }, select: { quantity: true } } } }
        }
      });
      const drying = new Map<number, { total: number; lots: { name: string; amount: number }[] }>();
      for (const lot of lots) {
        const total = lot.costs.reduce((s, c) => s + c.quantity * (decimalToNumber(c.unitPrice) ?? 0), 0);
        if (!(total > 0)) continue;
        const shares = lotCostShares(lot.bunkerTonnes, lot.entries.map((e) => ({
          key: String(e.fieldWork.fieldSeasonId), bunkers: e.harvestBunkers, manual: e.harvestTonnesManual, tonnes: e.lines[0]?.quantity ?? 0
        })));
        for (const [key, share] of shares) {
          const amount = Math.round(total * share * 100) / 100;
          const cur = drying.get(Number(key)) ?? { total: 0, lots: [] };
          cur.total = Math.round((cur.total + amount) * 100) / 100;
          cur.lots.push({ name: lot.name, amount });
          drying.set(Number(key), cur);
        }
      }
```
ja iga tulemuse objekti koostamisel (`results.push`): `const dry = drying.get(s.id); … drying: dry?.total ?? 0, dryingLots: dry?.lots ?? [], costTotal: resObj.costTotal + (dry?.total ?? 0), profit: resObj.profit - (dry?.total ?? 0)` (arvuta `drying` kaart enne tsüklit). `lotCostShares` import `../services/harvestLotRules.ts`.

- [ ] **Step 4: `SOLD`** — `src/server/stockRules.ts`: `WriteOffReason` tüüp ja `REASONS` saavad `'SOLD'`.

- [ ] **Step 5: Testid** — lisa `src/server/stockRules.test.ts`-i mahakandmise testi: `writeOffReason: 'SOLD'` on lubatud. Kontrolli `src/server/harvestLots.test.ts` ja kogu komplekti.

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc -b 2>&1 | tail -20 && npm test 2>&1 | tail -5'`
Expected: PASS.

- [ ] **Step 6: Commit, release**
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && \
git add src/server/harvestLotApi.ts src/server/apiHandler.ts src/server/fieldWorks.ts src/server/stockRules.ts src/server/stockRules.test.ts && \
git commit -m "Saagipartiid: API, kuivatuskulu jaotus finantsaknas, müügi põhjus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release 2>&1 | tail -5'
```

---

### Task 6: Kasutajaliides

**Files:**
- Create: `src/types/harvestLot.ts`, `src/components/HarvestLotsPanel.tsx`, `src/components/HarvestLotDialog.tsx`
- Modify: `src/services/api.ts`, `src/components/ArticlesView.tsx`, `src/components/FieldWorkEntryDialog.tsx`, `src/components/PriaLinesEditor.tsx`, `src/components/FinanceModal.tsx`, `src/components/ArticleStockCard.tsx`, `src/types/stock.ts`, `src/types/fieldWork.ts`

**Interfaces:**
- Consumes: Task 5 JSON-kujud, kande DTO väljad (Task 3).

- [ ] **Step 1: Tüübid ja klient**
  - `src/types/harvestLot.ts`: `HarvestLotStatus = 'OPEN' | 'CLOSED'`, `HarvestLotSummary`, `HarvestLotDetail` (summary + `notes`, `entries`, `weighings`, `costs`), `HarvestLotInput` — väljad täpselt Task 5 Interfaces järgi; `HARVEST_LOT_STATUS_LABEL = { OPEN: 'Lahtine', CLOSED: 'Suletud' }`.
  - `src/types/stock.ts`: `WriteOffReason` + `'SOLD'`, `WRITE_OFF_REASON_LABEL.SOLD = 'Müük'`; `StockMovement.source` + `'HARVEST_LOT'`, lisa `lotId?`, `lotName?`, `lotMovement?: 'WEIGHING' | 'COST'`.
  - `src/types/fieldWork.ts`: `WorkEntry`-le `harvestLotId: string | null; harvestLotName: string | null; harvestLotStatus: 'OPEN' | 'CLOSED' | null; harvestTonnesManual: boolean;`, `WorkEntryInput`-ile `harvestLotId?: string | null; harvestTonnesManual?: boolean;`, `FieldResult`-ile `drying: number; dryingLots: { name: string; amount: number }[];`.
  - `src/services/api.ts`: `getHarvestLots(year?)`, `getHarvestLot(id)`, `getOpenHarvestLots(fieldSeasonId)`, `saveHarvestLot(input)`, `deleteHarvestLot(id)`, `closeHarvestLot(id)`, `reopenHarvestLot(id)`, `addHarvestLotWeighing(id, { date, tonnes, notes })`, `deleteHarvestLotWeighing(id, wid)`, `addHarvestLotCost(id, { date, articleId, quantity, notes })`, `deleteHarvestLotCost(id, cid)` — olemasoleva `jsonOrThrow`/`apiFetch`/`jsonInit` mustriga, eestikeelsed vaiketeated („Saagipartiide laadimine ebaõnnestus“ jne).

- [ ] **Step 2: Partiide nimekiri** `src/components/HarvestLotsPanel.tsx` (muster: `StockDocumentsPanel.tsx`):
  - Filtrid `FilterClear`-is: hooaeg (aasta select viimase 6 aasta + olemasolevate partiide aastatest), staatus.
  - Nupp „Uus partii“ (avab `HarvestLotDialog` loomise režiimis: nimi, hooaeg, kultuur (`api.getCrops()` või olemasolev kultuuride laadija — kasuta seda, mida `ArticleFormDialog` terade kultuuri valikuks kasutab), ladu, märkus).
  - Tabel: Nimi | Kultuur | Hooaeg | Punkreid (`num`) | Kaalutud, t (`num`, `formatQty`) | Punkri kaal, t (`num`, `formatQty`; tühi → „–“) | Staatus | Kandeid (`num`). Rea klõps avab `HarvestLotDialog`-i.
  - `canManageFinance` ei ole vaja eraldi — vahekaart on ainult finantsõigusega (Step 4).

- [ ] **Step 3: Partii vaade** `src/components/HarvestLotDialog.tsx` (portaal + `modal-backdrop sub-modal` nagu `InventoryDialog`; Esc sulgeb, kui pole salvestamas):
  - Päis: nimi, kultuur, hooaeg, ladu, staatus; muudetavad nimi, ladu, märkus („Salvesta“).
  - Kokkuvõte: punkrid, kaalutud t, punkri kaal (suletud partiil), kuivatuskulu kokku.
  - Kanded (ainult vaatamiseks): Kuupäev | Põld | Punkreid | Tonnid (`käsitsi` märk, kui `manual`; lahtises partiis lukustamata kandel „kaalumata“) | Finants.
  - Kaalumised: tabel + lisamise rida (`DateInput`, tonnid `num`, märkus, „Lisa“); kustutamisnupp; suletud partiil lisamine ja kustutamine peidetud.
  - Kuivatuskulud: tabel (Kuupäev | Artikkel | Kogus + ühik | Ühikuhind | Summa; hindamata → „hindamata“) + lisamise rida (kuupäev, artikkel: aktiivsed `DRYING_TIME` teenused ja kaubad, kogus, märkus); kustutamine.
  - Nupud: „Sulge partii“ (`confirmDialog('Sulgen partii ja arvutan kannete tonnid punkri kaalu järgi?')`) / „Ava uuesti“; „Kustuta partii“ ainult kandeteta partiil. Vead `alertDialog`-iga.
  - Kõik arvud `className="num"`, kogused `formatQty`, kuupäevad `formatDate`.

- [ ] **Step 4: Vahekaart** — `src/components/ArticlesView.tsx`: `tab` tüübile `'lots'`; nupp `<button type="button" className={`filter-tab ${tab === 'lots' ? 'active' : ''}`} onClick={() => setTab('lots')}>Saagipartiid</button>` „Laokanded“ järele (sama `canManageFinance` tingimusega nagu Laokanded); `{tab === 'lots' && canManageFinance && <HarvestLotsPanel warehouses={warehouses} articles={articles} onChanged={() => void reload()} />}`.

- [ ] **Step 5: Koristuskande vorm** —
  - `src/components/PriaLinesEditor.tsx` `HarvestEditor`: uus valikuline prop `tonnesText?: string | null` — kui antud (lukustamata partii kanne), näidatakse „Saak t/ha“ ja „Kokku, t“ asemel ühes lahtris teksti (`<span className="num muted">{tonnesText}</span>` kahe veeru laiuselt), sisestusväljad peidetakse.
  - `src/components/FieldWorkEntryDialog.tsx` (ainult koristuskandel, `isHarvest`):
    - olek `manual` (`entry?.harvestTonnesManual ?? false`), `lotId` (`entry?.harvestLotId ?? ''`), `openLots` (`api.getOpenHarvestLots(work.fieldSeasonId)` — kontrolli `work` tüübis välja nime; vea korral tühi loend).
    - Partii valik `select` ainult siis, kui lahtisi partiisid on rohkem kui üks (valikud + „– viimane lahtine –“ väärtusega ''); muutmisel näita senist partiid nimega ka siis, kui see pole loendis.
    - Märkeruut „Sisesta tonnid käsitsi“ (`users-admin-checkbox` + span nagu mujal).
    - `tonnesText`: `manual` → `undefined` (sisestusväljad); muidu `entry?.harvestLotStatus === 'CLOSED' ? `${formatQty(tonnes)} t` : 'kaalumata'`.
    - Salvestusse: `harvestLotId: lotId || null`, `harvestTonnesManual: manual`; `harvest` saadetakse lukustamata kandel ilma `tonnes`/`ratePerHa`-ta (null), käsitsi korral nagu praegu.
    - Imporditud kanne (`imported`): märkeruut on märgitud ja muutmatu.
  - Muud vormi käitumist ära muuda.

- [ ] **Step 6: Finantsaken** — `src/components/FinanceModal.tsx` põllu tulemuste tabel: veerg „Kuivatamine“ (`num text-muted`, `r.drying > 0 ? fmtCur(r.drying) : '–'`, `title` = `r.dryingLots.map((l) => `Kuivatamine (${l.name}): ${fmtCur(l.amount)}`).join('\n')`) „Materjalid“ järele; päises sama veerg; `colSpan` +1; kokkuvõtte kaardid arvestavad `costTotal`-i (juba sees).

- [ ] **Step 7: Laokaart ja põhjus** — `src/components/ArticleStockCard.tsx` `describe`: `if (m.source === 'HARVEST_LOT') return `${m.lotMovement === 'WEIGHING' ? 'Kaalumine' : 'Kuivatuskulu'} · ${m.lotName}`;`. `StockDocumentDialog` põhjuste valik näitab „Müük“ automaatselt (`WRITE_OFF_REASON_LABEL`).

- [ ] **Step 8: Tüübikontroll, testid, commit, release, andmemudel**
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc -b 2>&1 | tail -20 && npm test 2>&1 | tail -5 && \
git add src/types/harvestLot.ts src/types/stock.ts src/types/fieldWork.ts src/services/api.ts src/components/HarvestLotsPanel.tsx src/components/HarvestLotDialog.tsx src/components/ArticlesView.tsx src/components/FieldWorkEntryDialog.tsx src/components/PriaLinesEditor.tsx src/components/FinanceModal.tsx src/components/ArticleStockCard.tsx src/index.css && \
git commit -m "Saagipartiid: partiide vahekaart, partii vaade, koristuskande partii ja käsitsi tonnid, kuivatus finantsaknas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release 2>&1 | tail -5 && \
npx tsx scripts/generate-erd.mts && git add docs/andmemudel.md && git commit -m "Andmemudel: saagipartiid

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -3'
```
Expected: tsc vigadeta, testid PASS, release õnnestub.
