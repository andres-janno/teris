# Inventuur — teostusplaan (artiklid, osa 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Laokannete alla tuleb uus liik „Inventuur“: kasutaja sisestab lao kaupade tegeliku seisu kuupäeval, süsteem arvutab vahe ja kannab puudujäägi FIFO järgi maha või võtab ülejäägi lao keskmise hinnaga juurde.

**Architecture:** Inventuur on `StockDocument` liigiga `INVENTORY`; rida hoiab tegelikku seisu (`countedQty`), vahe (`diffQty`) arvutab FIFO ümberarvutus. FIFO mootor (`src/server/stockFifo.ts`) saab uue liikumise `COUNT`, mis on päeva viimane: arvestuslik seis → vahe → väljaminek FIFO-ga või sissetulek keskmise hinnaga. Vorm küsib arvestusliku seisu uuest otspunktist `/api/stock/inventory-preview`. Tagantjärele liikumine enne inventuuri annab salvestamisel hoiatuse.

**Tech Stack:** React 19 + TypeScript + Vite; `node:http` server (`src/server`); Prisma 6 + PostgreSQL (RLS, tenant_fk trigerid); Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-artiklid-design.md`, jaotis „Osa 3 — inventuur“ (ning „Otsused“ ja „Testimine“).

## Global Constraints

- Kood on serveris: `debian@uvn-243-120.tll07.zonevs.eu:/home/debian/teris`. Kohalik `/Users/andresj/Progemine/teris` on sshfs-mount: faile võib muuta kohalikult, aga **kõik käsud** (npm, npx, git, psql) käivita `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && …'` kaudu.
- Töö käib otse `master`-harus. Iga ülesande lõpus: commit (sõnumi lõpus rida `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`) + `npm run release` (tsc + testid + build + restart) serveris.
- Tüübikontroll: `npx tsc -b` (mitte `--noEmit`).
- Testid: `npx vitest run <fail>`. Andmebaasitestid loovad ajutise ettevõtte ja kustutavad kõik oma andmed lõpus (muster: `src/server/stock.test.ts`).
- Skeemimuudatus: `npx prisma db push` ja `npx prisma generate` **ilma `--accept-data-loss`-ita**; kui Prisma seda nõuab, peatu ja teata. Enne: varukoopia `pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump`. Pärast: `psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql` ja `MIGRATE_DATABASE_URL="$MIGRATE_DATABASE_URL" npx tsx scripts/tenancy/05-tenant-fk-triggers.mts`.
- Server-side TS impordid kasutavad `.ts` laiendit.
- Identifikaatorid inglise keeles; kommentaarid ja kasutajaliidese tekstid eesti keeles.
- Kasutajaliidese arvud paremale joondatud (`className="num"`), kogused `formatQty`-ga; kuupäevad `pp.kk.aaaa` (`formatDate` / `DateInput`).
- Inventuur on osaline: **tühi tegelik seis = rida ei salvestata; 0 = salvestatakse (kogu seis maha)**.
- Inventuur on päeva viimane liikumine: arvestuslik seis sisaldab kõiki sama päeva liikumisi.
- Ülejäägi hind: lao hinnatud partiide väärtus / hinnatud kogus inventuuri hetkel; kui hinnatud kogust pole, artikli viimase arvelevõtu ühikuhind (ükskõik mis laos, kuni selle hetkeni); kui sedagi pole, hindamata.
- Salvestatakse tegelik seis; vahe arvutab ümberarvutus. Tagantjärele liikumine enne inventuuri muudab vahet, mitte tegelikku seisu.
- Hoiatuse tekst täpselt: **„See kanne muudab inventuuri pp.kk.aaaa vahet“** (mitu kuupäeva komaga eraldatult, kasvavalt, kordumatult). Hoiatust näeb ainult finantsõigusega kasutaja.
- Mahakandmise põhjust „Inventuuri vahe“ (`INVENTORY`) uutele kannetele ei pakuta; vanadel jääb alles.
- Inventuur ja eelvaade nõuavad finantsõigust (nagu kõik laokanded).

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `src/server/stockFifo.ts` (muuda) | `COUNT` liikumine, `CountResult`, `lastReceiptUnitCost`, `stockAtDate` |
| `src/server/stockRules.ts` (muuda) | `INVENTORY` sisendi parsimine, `inventoryNoticeText`, eelvaate finantsõigus |
| `prisma/schema.prisma` (muuda) | `StockDocumentKind.INVENTORY`, `StockDocumentLine.countedQty`, `diffQty` |
| `src/server/stock.ts` (muuda) | `COUNT` laadimine ja tulemuse kirjutamine, `inventoryNotice`, `entryStockTouches` |
| `src/server/articleUnitChange.ts`, `src/server/fieldWorks.ts` (muuda) | ühiku teisendus ja artiklite ühendamine inventuuri ridadega |
| `src/server/stockApi.ts` (muuda) | eelvaade, DTO, laokaart, hoiatus laokande vastuses |
| `src/server/fieldWorks.ts`, `src/server/mcp/tools/stock.ts` (muuda) | hoiatus kande vastuses; MCP laoliikumised |
| `src/types/stock.ts`, `src/types/fieldWork.ts`, `src/services/api.ts` (muuda) | tüübid ja klient |
| `src/components/InventoryDialog.tsx` (uus) | inventuuri vorm |
| `src/components/StockDocumentsPanel.tsx`, `StockDocumentDialog.tsx`, `ArticleStockCard.tsx`, `FieldWorkEntryDialog.tsx` (muuda) | nupp, hoiatus, laokaardi rida |

---

### Task 1: FIFO mootor — inventuuri liikumine

**Files:**
- Modify: `src/server/stockFifo.ts`
- Test: `src/server/stockFifo.test.ts`

**Interfaces:**
- Produces: `MovementKind = 'IN' | 'TRANSFER' | 'OUT' | 'COUNT'`; `Movement.quantity` on `COUNT` puhul tegelik seis (≥ 0); `interface CountResult { diffQty: number; amount: number | null }`; `ReplayResult.counts: Map<string, CountResult>`; `ReplayResult.lastReceiptUnitCost: number | null`; puudujäägi maksumus on `outs.get(ref)` nagu `OUT`-il (kasuta `movementCost('OUT', o)`); `stockAtDate(movements: Movement[], warehouseId: string, date: string, excludeRefs?: Set<string>): { touched: boolean; qty: number; surplusUnitCost: number | null }`.

- [ ] **Step 1: Kirjuta testid** — lisa `src/server/stockFifo.test.ts` lõppu (failis on juba abifunktsioonid `inM`, `outM`, `trM`, konstandid `A`, `B`):

```ts
const cntM = (ref: string, date: string, counted: number, warehouseId = A): Movement =>
  ({ ref, date, seq: seq++, kind: 'COUNT', warehouseId, quantity: counted });

describe('inventuur (COUNT)', () => {
  it('inventuur on päeva viimane liikumine', () => {
    const m = [cntM('c', '2026-05-01', 1), outM('o', '2026-05-01', 1), inM('i', '2026-05-01', 1, 1)];
    expect(sortMovements(m).map((x) => x.ref)).toEqual(['i', 'o', 'c']);
  });

  it('puudujääk kantakse maha FIFO järgi', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 100, 100), cntM('c', '2026-02-01', 70)]);
    expect(r.counts.get('c')).toEqual({ diffQty: -30, amount: null });
    expect(movementCost('OUT', r.outs.get('c'))).toBe(30);
    expect(r.stock.get(A)).toEqual({ qty: 70, value: 70, unpricedQty: 0, pricedQty: 70 });
  });

  it('0 kannab kogu seisu maha', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 20), cntM('c', '2026-02-01', 0)]);
    expect(r.counts.get('c')!.diffQty).toBe(-10);
    expect(movementCost('OUT', r.outs.get('c'))).toBe(20);
    expect(r.stock.get(A)!.qty).toBe(0);
  });

  it('ülejääk võetakse juurde lao keskmise hinnaga', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 10), inM('i2', '2026-01-02', 10, 30), cntM('c', '2026-02-01', 25)]);
    expect(r.counts.get('c')).toEqual({ diffQty: 5, amount: 10 }); // keskmine 2 €/kg
    expect(r.stock.get(A)).toEqual({ qty: 25, value: 50, unpricedQty: 0, pricedQty: 25 });
  });

  it('hinnatud partiita laos võtab ülejääk artikli viimase arvelevõtu hinna', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 40, B), cntM('c', '2026-02-01', 5)]);
    expect(r.counts.get('c')).toEqual({ diffQty: 5, amount: 20 });
    expect(r.lastReceiptUnitCost).toBe(4);
  });

  it('hinnata ülejääk, kui arvelevõttu pole olnud', () => {
    const r = fifoReplay([cntM('c', '2026-02-01', 5)]);
    expect(r.counts.get('c')).toEqual({ diffQty: 5, amount: null });
    expect(r.stock.get(A)).toEqual({ qty: 5, value: 0, unpricedQty: 5, pricedQty: 0 });
  });

  it('ülejääk katab miinusseisu võla ja annab sellele hinna', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 10, B), outM('o', '2026-01-05', 4), cntM('c', '2026-02-01', 2)]);
    expect(r.counts.get('c')).toEqual({ diffQty: 6, amount: 6 });
    expect(r.outs.get('o')).toEqual({ cost: 4, unpricedQty: 0, shortageQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: 2, value: 2, unpricedQty: 0, pricedQty: 2 });
  });

  it('tagantjärele liikumine enne inventuuri muudab vahet, mitte tegelikku seisu', () => {
    const base = [inM('i1', '2026-01-01', 10, 10), cntM('c', '2026-03-01', 10)];
    expect(fifoReplay(base).counts.get('c')!.diffQty).toBe(0);
    const r = fifoReplay([...base, outM('o', '2026-02-01', 3)]);
    expect(r.counts.get('c')!.diffQty).toBe(3);
    expect(r.stock.get(A)!.qty).toBe(10);
  });

  it('vahe 0 ei tekita liikumist', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 10), cntM('c', '2026-02-01', 10)]);
    expect(r.counts.get('c')).toEqual({ diffQty: 0, amount: null });
    expect(r.outs.has('c')).toBe(false);
  });
});

describe('stockAtDate', () => {
  const ms = [inM('i1', '2026-01-01', 10, 20), outM('o1', '2026-02-01', 4), inM('i2', '2026-03-01', 5, 50, B)];
  it('seis kuupäeval (kaasa arvatud) ja ülejäägi hind', () => {
    expect(stockAtDate(ms, A, '2026-02-01')).toEqual({ touched: true, qty: 6, surplusUnitCost: 2 });
    expect(stockAtDate(ms, A, '2026-01-31')).toEqual({ touched: true, qty: 10, surplusUnitCost: 2 });
  });
  it('välistatud liikumised ei loe; puutumata ladu', () => {
    expect(stockAtDate(ms, A, '2026-12-31', new Set(['o1'])).qty).toBe(10);
    expect(stockAtDate(ms, 'wh-c', '2026-12-31')).toEqual({ touched: false, qty: 0, surplusUnitCost: 10 });
  });
});
```

Lisa faili alguse importi `stockAtDate`: `import { fifoReplay, movementCost, sortMovements, stockAtDate, type Movement } from './stockFifo';`

- [ ] **Step 2: Käivita testid, veendu et kukuvad**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stockFifo.test.ts 2>&1 | tail -15'`
Expected: FAIL (`stockAtDate` puudub, `counts` undefined).

- [ ] **Step 3: Muuda `src/server/stockFifo.ts`**

Faili päise kommentaari teine rida:
```ts
// Liikumised käiakse kuupäeva järjekorras läbi; sama päeva sees enne sissetulek, siis ülekanne, siis väljaminek, viimasena inventuur.
```
Tüübid:
```ts
export type MovementKind = 'IN' | 'TRANSFER' | 'OUT' | 'COUNT';

export interface Movement {
  ref: string; // nt 'doc:<reaId>' või 'entry:<reaId>'
  date: string; // YYYY-MM-DD
  seq: number; // sama päeva ja liigi sees stabiilne järjekord
  kind: MovementKind;
  warehouseId: string; // IN: sihtladu; TRANSFER ja OUT: lähteladu; COUNT: inventeeritav ladu
  toWarehouseId?: string; // TRANSFER: sihtladu
  quantity: number; // laoühikus, > 0; COUNT: tegelik seis (≥ 0)
  amount?: number; // IN: rea summa
}

/** Inventuuri tulemus: vahe ja ülejäägi väärtus. Puudujäägi maksumus on outs-is nagu väljaminekul. */
export interface CountResult {
  diffQty: number; // tegelik − arvestuslik (+ juurde, − maha)
  amount: number | null; // ülejäägi väärtus; null = puudujääk, vahe 0 või hindamata
}

export interface ReplayResult {
  outs: Map<string, OutResult>;
  counts: Map<string, CountResult>;
  stock: Map<string, WarehouseStock>;
  lastReceiptUnitCost: number | null; // artikli viimase arvelevõtu ühikuhind
}
```
`KIND_ORDER`:
```ts
const KIND_ORDER: Record<MovementKind, number> = { IN: 0, TRANSFER: 1, OUT: 2, COUNT: 3 };
const round4 = (n: number) => Math.round(n * 10000) / 10000;
```
`fifoReplay`-s: lisa `counts` ja `lastReceipt` ning asenda põhitsükkel:
```ts
  const counts = new Map<string, CountResult>();
  let lastReceipt: number | null = null;
```
```ts
  // Väljaminek (ka ülekanne ja inventuuri puudujääk): võetud partiid maksumuseks, puudujääk võlaks
  const issue = (m: Movement, qty: number) => {
    const o = outOf(m.ref);
    const { pieces, missing } = take(m.warehouseId, qty, m.ref);
    for (const p of pieces) {
      if (p.unitCost === null) o.unpricedQty += p.qty;
      else o.cost += p.qty * p.unitCost;
    }
    o.unpricedQty += missing;
    if (m.kind === 'TRANSFER') {
      const to = m.toWarehouseId!;
      o.shortageQty += missing + pieces.filter((p) => p.unitCost === null).reduce((s, p) => s + p.qty, 0);
      for (const p of pieces) receive(to, p.qty, p.unitCost);
      if (missing > 0) receive(to, missing, null);
    }
  };

  for (const m of sortMovements(movements)) {
    if (m.kind === 'IN') {
      const unitCost = m.quantity > 0 ? (m.amount ?? 0) / m.quantity : 0;
      receive(m.warehouseId, m.quantity, unitCost);
      if (m.quantity > 0) lastReceipt = unitCost;
      continue;
    }
    if (m.kind === 'COUNT') {
      // Inventuur: vahe arvestuslikust seisust; puudujääk FIFO järgi maha, ülejääk lao keskmise hinnaga juurde
      const ls = lotsOf(m.warehouseId);
      const book = ls.reduce((s, l) => s + l.qty, 0) - debtsOf(m.warehouseId).reduce((s, d) => s + d.qty, 0);
      const diff = roundQ(m.quantity - book) + 0;
      let amount: number | null = null;
      if (diff < 0) issue(m, -diff);
      else if (diff > 0) {
        const pricedQty = ls.reduce((s, l) => s + (l.unitCost === null ? 0 : l.qty), 0);
        const pricedValue = ls.reduce((s, l) => s + (l.unitCost === null ? 0 : l.qty * l.unitCost), 0);
        const unitCost = pricedQty > EPS ? pricedValue / pricedQty : lastReceipt;
        receive(m.warehouseId, diff, unitCost);
        amount = unitCost === null ? null : round2(diff * unitCost) + 0;
      }
      counts.set(m.ref, { diffQty: diff, amount });
      continue;
    }
    issue(m, m.quantity);
  }
```
Tagastus: `return { outs, counts, stock, lastReceiptUnitCost: lastReceipt };`

Faili lõppu:
```ts
/** Artikli seis laos kuupäeva lõpus (kaasa arvatud) ja inventuuri ülejäägi eeldatav ühikuhind. */
export function stockAtDate(movements: Movement[], warehouseId: string, date: string, excludeRefs: Set<string> = new Set()) {
  const ms = movements.filter((m) => m.date <= date && !excludeRefs.has(m.ref));
  const r = fifoReplay(ms);
  const s = r.stock.get(warehouseId);
  return {
    touched: ms.some((m) => m.warehouseId === warehouseId || m.toWarehouseId === warehouseId),
    qty: s?.qty ?? 0,
    surplusUnitCost: s && s.pricedQty > EPS ? round4(s.value / s.pricedQty) : r.lastReceiptUnitCost === null ? null : round4(r.lastReceiptUnitCost)
  };
}
```

- [ ] **Step 4: Testid ja tüübikontroll**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stockFifo.test.ts 2>&1 | tail -8 && npx tsc -b 2>&1 | tail -20'`
Expected: PASS. Kui tsc kurdab `Record<MovementKind, …>` või `kind` võrdluse üle teistes failides (`stockApi.ts` laokaart), lisa sinna `COUNT` haru: laokaardi `delta` = 0 ajutiselt (Task 4 teeb õigeks) — ära muuda muud käitumist.

- [ ] **Step 5: Kõik testid, commit, release**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test 2>&1 | tail -5 && \
git add src/server/stockFifo.ts src/server/stockFifo.test.ts src/server/stockApi.ts && \
git commit -m "Inventuur: FIFO inventuuri liikumine ja seis kuupäeval

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release 2>&1 | tail -5'
```

---

### Task 2: Andmemudel, inventuuri sisendi reeglid ja hoiatuse tekst

**Files:**
- Modify: `prisma/schema.prisma`, `src/server/stockRules.ts`
- Test: `src/server/stockRules.test.ts`

**Interfaces:**
- Produces: Prisma `StockDocumentKind.INVENTORY`, `StockDocumentLine.countedQty Float?`, `diffQty Float?`; `StockDocumentKind` (stockRules) sisaldab `'INVENTORY'`; `StockDocumentInput.lines: { articleId: string; quantity: number; amount: number | null; countedQty?: number | null }[]` (INVENTORY: `quantity: 0`, `amount: null`, `countedQty` ≥ 0); `inventoryNoticeText(isoDates: string[]): string | null`; `stockRequiresFinance('/api/stock/inventory-preview', 'GET') === true`.

Skeem tuleb selles ülesandes, sest `saveStockDocument` annab `kind`-i Prismale edasi ja `tsc` nõuab, et enum tunneks `INVENTORY`-t.

- [ ] **Step 0a: Skeem** — `prisma/schema.prisma`:

```prisma
enum StockDocumentKind {
  RECEIPT // arvele võtmine
  WRITE_OFF // mahakandmine
  TRANSFER // ladudevaheline ülekanne
  INVENTORY // inventuur: tegelik seis, vahe arvutab ümberarvutus
}

enum WriteOffReason {
  SPOILED // riknenud
  INVENTORY // inventuuri vahe (ainult vanadel kannetel; uutele ei pakuta)
  OTHER // muu (täpsustus märkuses)
}
```
`StockDocument` kommentaar: `// Laokanne: arvele võtmine, mahakandmine, ülekanne või inventuur`; `warehouseId` kommentaar: `// RECEIPT: sihtladu; WRITE_OFF ja TRANSFER: lähteladu; INVENTORY: inventeeritav ladu`.
`StockDocumentLine`:
```prisma
  quantity    Float // laoühikus, > 0; INVENTORY: |diffQty| (kirjutab ümberarvutus)
  amount      Decimal? @db.Decimal(12, 2) // RECEIPT: rea summa km-ta; INVENTORY: ülejäägi väärtus
  fifoCost    Decimal? @db.Decimal(12, 2) // WRITE_OFF, TRANSFER, INVENTORY puudujääk: arvutatud maksumus; null = (osaliselt) hindamata
  shortageQty Float? // TRANSFER: kogus, mida lähtelaos hinnaga kaubana polnud (probleem)
  countedQty  Float? // INVENTORY: tegelik seis; 0 = kõik maha
  diffQty     Float? // INVENTORY: arvutatud vahe (+ juurde, − maha); kirjutab ümberarvutus
```
Uuenda ka sektsiooni päise kommentaar: `// Laod → laokanded (arvele võtmine, mahakandmine, ülekanne, inventuur) + põllutöö kande materjali- ja kütuseread.`

- [ ] **Step 0b: Varukoopia ja db push**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && \
pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump && ls -t ~/backups | head -1 && \
npx prisma db push && npx prisma generate && \
psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql && \
MIGRATE_DATABASE_URL="$MIGRATE_DATABASE_URL" npx tsx scripts/tenancy/05-tenant-fk-triggers.mts'
```
Expected: „Your database is now in sync“ ilma andmekao hoiatuseta; `OK: N trigerit`. Andmekao küsimus → peatu, ära kinnita, teata (BLOCKED).

- [ ] **Step 1: Kirjuta testid** — lisa `src/server/stockRules.test.ts`-i (impordi ka `inventoryNoticeText`):

```ts
describe('inventuuri sisend', () => {
  const inv = { kind: 'INVENTORY', date: '2026-05-31', warehouseId: 'w1' };
  it('tühi tegelik seis jäetakse välja, 0 jääb alles', () => {
    const r = parseStockDocument({ ...inv, supplierId: 's1', writeOffReason: 'SPOILED', toWarehouseId: 'w2', lines: [
      { articleId: 'a1', countedQty: '' }, { articleId: 'a2', countedQty: '0' }, { articleId: 'a3', countedQty: '12,5' }
    ] });
    expect(r).toEqual({ ok: true, doc: expect.objectContaining({
      kind: 'INVENTORY', supplierId: null, writeOffReason: null, toWarehouseId: null,
      lines: [{ articleId: 'a2', quantity: 0, amount: null, countedQty: 0 }, { articleId: 'a3', quantity: 0, amount: null, countedQty: 12.5 }]
    }) });
  });
  it('vead', () => {
    expect(parseStockDocument({ ...inv, lines: [{ articleId: 'a1', countedQty: '' }] })).toEqual({ ok: false, error: 'Sisesta vähemalt ühe artikli tegelik seis' });
    expect(parseStockDocument({ ...inv, lines: [{ articleId: 'a1', countedQty: '-1' }] })).toEqual({ ok: false, error: 'Tegelik seis ei tohi olla negatiivne' });
    expect(parseStockDocument({ ...inv, lines: [{ articleId: 'a1', countedQty: 'x' }] })).toEqual({ ok: false, error: 'Tegelik seis peab olema arv' });
    expect(parseStockDocument({ ...inv, lines: [{ articleId: 'a1', countedQty: 1 }, { articleId: 'a1', countedQty: 2 }] })).toEqual({ ok: false, error: 'Artikkel on inventuuris mitu korda' });
  });
});

describe('inventoryNoticeText', () => {
  it('kuupäevad kasvavalt ja kordumatult', () => {
    expect(inventoryNoticeText([])).toBeNull();
    expect(inventoryNoticeText(['2026-05-31', '2026-03-31', '2026-05-31'])).toBe('See kanne muudab inventuuri 31.03.2026, 31.05.2026 vahet');
  });
});
```
Ja `stockRequiresFinance` describe'i esimesse testi: `expect(stockRequiresFinance('/api/stock/inventory-preview', 'GET')).toBe(true);`

- [ ] **Step 2: Käivita, veendu et kukuvad**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stockRules.test.ts 2>&1 | tail -15'`
Expected: FAIL.

- [ ] **Step 3: Muuda `src/server/stockRules.ts`**

```ts
export type StockDocumentKind = 'RECEIPT' | 'WRITE_OFF' | 'TRANSFER' | 'INVENTORY';
```
`StockDocumentInput.lines` tüüp: `{ articleId: string; quantity: number; amount: number | null; countedQty?: number | null }[]`.
`const KINDS: StockDocumentKind[] = ['RECEIPT', 'WRITE_OFF', 'TRANSFER', 'INVENTORY'];`

`parseStockDocument`-is, ridade tsükli **ette** (pärast `if (!linesIn.length) …`):
```ts
  if (kind === 'INVENTORY') {
    // Inventuur: tühi tegelik seis = rida ei salvestata; 0 = kogu seis maha
    const counted: StockDocumentInput['lines'] = [];
    for (const l of linesIn) {
      const raw = String(l?.countedQty ?? '').trim();
      if (!raw) continue;
      const articleId = text(l?.articleId, 64);
      if (!articleId) return fail('Vali igale reale materjal');
      const countedQty = num(raw);
      if (countedQty === null) return fail('Tegelik seis peab olema arv');
      if (countedQty < 0) return fail('Tegelik seis ei tohi olla negatiivne');
      if (counted.some((c) => c.articleId === articleId)) return fail('Artikkel on inventuuris mitu korda');
      counted.push({ articleId, quantity: 0, amount: null, countedQty });
    }
    if (!counted.length) return fail('Sisesta vähemalt ühe artikli tegelik seis');
    return {
      ok: true,
      doc: { kind, date, warehouseId, toWarehouseId: null, supplierId: null, documentNo: text(b.documentNo, 80), writeOffReason: null, notes: text(b.notes, 2000), lines: counted }
    };
  }
```
`stockRequiresFinance` esimene rida:
```ts
  if (pathname === '/api/stock/documents' || pathname.startsWith('/api/stock/documents/') || pathname === '/api/stock/inventory-preview') return true;
```
Faili lõppu:
```ts
const fmtIsoDay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.');

/** Hoiatus, kui salvestatud liikumine jääb inventuuri(de) ette samas laos; null = hoiatust pole. */
export function inventoryNoticeText(isoDates: string[]): string | null {
  const dates = [...new Set(isoDates.map((d) => d.slice(0, 10)))].sort();
  return dates.length ? `See kanne muudab inventuuri ${dates.map(fmtIsoDay).join(', ')} vahet` : null;
}
```

- [ ] **Step 4: Testid ja tüübikontroll**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stockRules.test.ts 2>&1 | tail -8 && npx tsc -b 2>&1 | tail -20'`
Expected: PASS; tsc vigadeta.

- [ ] **Step 5: Kõik testid, commit, release**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test 2>&1 | tail -5 && \
git add prisma/schema.prisma src/server/stockRules.ts src/server/stockRules.test.ts && \
git commit -m "Inventuur: andmemudel, sisendi reeglid ja hoiatuse tekst

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release 2>&1 | tail -5'
```

---

### Task 3: Ümberarvutus ja inventuuri hoiatus

**Files:**
- Modify: `src/server/stock.ts`, `src/server/articleUnitChange.ts`, `src/server/fieldWorks.ts` (artiklite ühendamine, ~rida 872–885)
- Create test: `src/server/inventory.test.ts`

**Interfaces:**
- Consumes: Task 1 `COUNT`, `counts`, `movementCost`; Task 2 skeem (`countedQty`, `diffQty`, `INVENTORY`), `StockDocumentInput`, `inventoryNoticeText`.
- Produces: `inventoryNotice(tx, touches: { articleId: string; warehouseId: string }[], fromDate: Date, excludeDocumentId: string | null): Promise<string | null>`; `entryStockTouches(tx, lines: { kind: string; articleId: string | null }[], entryWarehouseId: string): Promise<{ articleId: string; warehouseId: string }[]>`. Pärast ümberarvutust on INVENTORY real: `diffQty` = vahe, `quantity` = |vahe|, `amount` = ülejäägi väärtus (muidu null), `fifoCost` = puudujäägi FIFO maksumus (vahe 0 → 0; ülejääk → null).

- [ ] **Step 1: Kirjuta andmebaasitest** `src/server/inventory.test.ts`:

```ts
// Inventuur ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { getDefaultWarehouseId, saveStockDocument, inventoryNotice } from './stock';
import { changeArticleUnit } from './articleUnitChange';
import { systemCategoryId } from './articleCategories';
import type { StockDocumentInput } from './stockRules';

const T = `test-tenant-inventory-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(`${s}T00:00:00Z`);
let articleId = '';
let wh = '';
const doc = (p: Partial<StockDocumentInput>): StockDocumentInput => ({
  kind: 'RECEIPT', date: d('2026-03-01'), warehouseId: wh, toWarehouseId: null, supplierId: null,
  documentNo: null, writeOffReason: null, notes: null, lines: [], ...p
});
const save = (p: Partial<StockDocumentInput>) => run(() => tenantTransaction((tx) => saveStockDocument(tx, null, doc(p))));
const lineOf = (documentId: string) => run(() => prisma.stockDocumentLine.findFirstOrThrow({ where: { documentId } }));
const stock = () => run(() => prisma.articleStock.findUniqueOrThrow({ where: { articleId_warehouseId: { articleId, warehouseId: wh } } }));

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test inventuur' } });
  await run(async () => {
    const catId = await tenantTransaction((tx) => systemCategoryId(tx, 'FERTILIZER'));
    articleId = (await prisma.article.create({ data: { name: 'Inventuuriväetis', categoryId: catId, unit: 'kg' } })).id;
    wh = await tenantTransaction((tx) => getDefaultWarehouseId(tx));
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.stockDocument.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

describe('inventuur', () => {
  let invId = '';
  it('puudujääk kantakse maha FIFO maksumusega', async () => {
    await save({ lines: [{ articleId, quantity: 100, amount: 200 }] }); // 2 €/kg
    invId = await save({ kind: 'INVENTORY', date: d('2026-03-31'), lines: [{ articleId, quantity: 0, amount: null, countedQty: 90 }] });
    const l = await lineOf(invId);
    expect(l.countedQty).toBe(90);
    expect(l.diffQty).toBe(-10);
    expect(l.quantity).toBe(10);
    expect(Number(l.fifoCost)).toBe(20);
    expect(l.amount).toBeNull();
    const s = await stock();
    expect(s.qty).toBe(90);
    expect(Number(s.value)).toBe(180);
  });

  it('tagantjärele mahakandmine muudab vahet, seis jääb tegelikuks; hoiatus', async () => {
    await save({ kind: 'WRITE_OFF', date: d('2026-03-15'), writeOffReason: 'SPOILED', lines: [{ articleId, quantity: 5, amount: null }] });
    const l = await lineOf(invId);
    expect(l.diffQty).toBe(-5);
    expect(Number(l.fifoCost)).toBe(10);
    expect((await stock()).qty).toBe(90);
    const touches = [{ articleId, warehouseId: wh }];
    expect(await run(() => tenantTransaction((tx) => inventoryNotice(tx, touches, d('2026-03-15'), null)))).toBe('See kanne muudab inventuuri 31.03.2026 vahet');
    expect(await run(() => tenantTransaction((tx) => inventoryNotice(tx, touches, d('2026-03-31'), null)))).toBe('See kanne muudab inventuuri 31.03.2026 vahet');
    expect(await run(() => tenantTransaction((tx) => inventoryNotice(tx, touches, d('2026-04-01'), null)))).toBeNull();
    expect(await run(() => tenantTransaction((tx) => inventoryNotice(tx, touches, d('2026-03-15'), invId)))).toBeNull();
  });

  it('0 kannab kogu seisu maha; hilisem ülejääk saab viimase arvelevõtu hinna', async () => {
    await save({ kind: 'INVENTORY', date: d('2026-04-30'), lines: [{ articleId, quantity: 0, amount: null, countedQty: 0 }] });
    expect((await stock()).qty).toBe(0);
    const id = await save({ kind: 'INVENTORY', date: d('2026-05-31'), lines: [{ articleId, quantity: 0, amount: null, countedQty: 10 }] });
    const l = await lineOf(id);
    expect(l.diffQty).toBe(10);
    expect(Number(l.amount)).toBe(20);
    expect(l.fifoCost).toBeNull();
    const s = await stock();
    expect(s.qty).toBe(10);
    expect(Number(s.value)).toBe(20);
  });

  it('ühiku teisendus teisendab tegeliku seisu ja vahe', async () => {
    await run(() => tenantTransaction((tx) => changeArticleUnit(tx, articleId, 'kg', 't', 0.001)));
    const l = await lineOf(invId);
    expect(l.countedQty).toBeCloseTo(0.09, 9);
    expect(l.diffQty).toBeCloseTo(-0.005, 9);
    expect((await stock()).qty).toBeCloseTo(0.01, 9);
  });
});
```

- [ ] **Step 2: Käivita, veendu et kukub**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/inventory.test.ts 2>&1 | tail -15'`
Expected: FAIL (`inventoryNotice` puudub; read ei saa vahet).

- [ ] **Step 3: Muuda `src/server/stock.ts`**

Päise kommentaar: „…loeb materjali liikumised (laokanded, sh inventuur, + põllutöö kande kulumaterjali- ja kütuseread)…“. Impordi `inventoryNoticeText`: `import { inventoryNoticeText, type StockDocumentInput } from './stockRules.ts';`

`ArticleMovements.docLines` tüüp: `{ id: string; ref: string; kind: 'RECEIPT' | 'WRITE_OFF' | 'TRANSFER' | 'INVENTORY' }[]`.

`loadMovements`-is laokande ridade `select`-i lisa `countedQty: true` ja liikumine:
```ts
      out.movements.push({
        ref, date: isoDay(doc.date), seq: doc.createdAt.getTime() * 1000 + l.sortOrder,
        kind: doc.kind === 'RECEIPT' ? 'IN' : doc.kind === 'TRANSFER' ? 'TRANSFER' : doc.kind === 'INVENTORY' ? 'COUNT' : 'OUT',
        warehouseId: doc.warehouseId, toWarehouseId: doc.toWarehouseId ?? undefined,
        // Inventuuril on liikumise kogus tegelik seis
        quantity: doc.kind === 'INVENTORY' ? l.countedQty ?? 0 : l.quantity,
        amount: l.amount === null ? undefined : Number(l.amount)
      });
```
Inventuuri real on `amount` ümberarvutuse kirjutatud ülejäägi väärtus — `COUNT` ei loe seda (`amount` mõjutab ainult `IN`-i).

`recomputeArticleStock`-is: `const { outs, counts, stock } = fifoReplay(mm.movements);` ja laokande ridade tsükkel:
```ts
    // Laokande read: maksumus, ülekande puudujääk, inventuuri vahe
    for (const l of mm.docLines) {
      if (l.kind === 'RECEIPT') continue;
      const o = outs.get(l.ref);
      if (l.kind === 'INVENTORY') {
        const diff = counts.get(l.ref)?.diffQty ?? 0;
        await tx.stockDocumentLine.update({
          where: { id: l.id },
          data: {
            diffQty: diff,
            quantity: Math.abs(diff),
            amount: diff > 0 ? counts.get(l.ref)!.amount : null,
            fifoCost: diff < 0 ? movementCost('OUT', o) : diff === 0 ? 0 : null,
            shortageQty: null
          }
        });
        continue;
      }
      await tx.stockDocumentLine.update({
        where: { id: l.id },
        data: {
          fifoCost: movementCost(l.kind === 'TRANSFER' ? 'TRANSFER' : 'OUT', o),
          shortageQty: l.kind === 'TRANSFER' && o && o.shortageQty > 0 ? o.shortageQty : null
        }
      });
    }
```
`saveStockDocument`-is ridade kaardistus:
```ts
  const lines = doc.lines.map((l, i) => ({ articleId: l.articleId, quantity: l.quantity, amount: l.amount, countedQty: l.countedQty ?? null, sortOrder: i }));
```
Faili lõppu:
```ts
/**
 * Hoiatus, kui liikumine (kuupäevast fromDate) jääb mõne inventuuri ette samas laos — muudab selle vahet.
 * Inventuur on päeva viimane, seega ka sama päeva liikumine muudab vahet. null = hoiatust pole.
 */
export async function inventoryNotice(
  tx: TxClient, touches: { articleId: string; warehouseId: string }[], fromDate: Date, excludeDocumentId: string | null
): Promise<string | null> {
  if (!touches.length) return null;
  const rows = await tx.stockDocumentLine.findMany({
    where: {
      document: { kind: 'INVENTORY', date: { gte: fromDate }, ...(excludeDocumentId ? { id: { not: excludeDocumentId } } : {}) },
      OR: touches.map((t) => ({ articleId: t.articleId, document: { warehouseId: t.warehouseId } }))
    },
    select: { document: { select: { date: true } } }
  });
  return inventoryNoticeText(rows.map((r) => isoDay(r.document.date)));
}

/** Põllutöö kande kaubaread (artikkel + ladu, kust maha kantakse) inventuuri hoiatuse jaoks. */
export async function entryStockTouches(
  tx: TxClient, lines: { kind: string; articleId: string | null }[], entryWarehouseId: string
): Promise<{ articleId: string; warehouseId: string }[]> {
  const goods = lines.filter((l): l is { kind: 'MATERIAL' | 'FUEL'; articleId: string } => (l.kind === 'MATERIAL' || l.kind === 'FUEL') && !!l.articleId);
  if (!goods.length) return [];
  const arts = await tx.article.findMany({ where: { id: { in: goods.map((l) => l.articleId) } }, select: { id: true, defaultWarehouseId: true } });
  const dw = new Map(arts.map((a) => [a.id, a.defaultWarehouseId]));
  return goods.map((l) => ({ articleId: l.articleId, warehouseId: entryLineWarehouseId(l.kind, dw.get(l.articleId) ?? null, entryWarehouseId) }));
}
```
(`entryLineWarehouseId` on juba imporditud; kontrolli selle signatuuri `src/services/articleRules.ts`-is ja kohanda tüüpi vajadusel.)

- [ ] **Step 4: Ühiku teisendus** — `src/server/articleUnitChange.ts`:
```ts
  const docLines = await tx.stockDocumentLine.findMany({ where: { articleId }, select: { id: true, quantity: true, shortageQty: true, countedQty: true, diffQty: true } });
  for (const l of docLines) {
    await tx.stockDocumentLine.update({
      where: { id: l.id },
      data: { quantity: scale(l.quantity, factor)!, shortageQty: scale(l.shortageQty, factor), countedQty: scale(l.countedQty, factor), diffQty: scale(l.diffQty, factor) }
    });
  }
```

- [ ] **Step 5: Artiklite ühendamine** — `src/server/fieldWorks.ts` (asendamine, ~rida 872–885). Laokande ridade päringule lisa `countedQty: true, documentId: true`; tsükkel:
```ts
      for (const l of docLines) {
        const counted = l.countedQty === null ? null : convertQty(l.countedQty, source.unit, target.unit)!;
        // Sama inventuuri sihtartikli rida: tegelikud seisud liidetakse (artikkel on inventuuris üks kord)
        const twin = counted === null ? null : await tx.stockDocumentLine.findFirst({ where: { documentId: l.documentId, articleId: target.id }, select: { id: true, countedQty: true } });
        if (twin) {
          await tx.stockDocumentLine.update({ where: { id: twin.id }, data: { countedQty: (twin.countedQty ?? 0) + counted! } });
          await tx.stockDocumentLine.delete({ where: { id: l.id } });
          continue;
        }
        await tx.stockDocumentLine.update({ where: { id: l.id }, data: { articleId: target.id, quantity: convertQty(l.quantity, source.unit, target.unit)!, countedQty: counted } });
      }
```

- [ ] **Step 6: Testid ja tüübikontroll**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/inventory.test.ts src/server/stock.test.ts src/server/stockFifo.test.ts 2>&1 | tail -10 && npx tsc -b 2>&1 | tail -20'`
Expected: PASS; tsc vigadeta.

- [ ] **Step 7: Kõik testid, commit, release**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test 2>&1 | tail -5 && \
git add src/server/stock.ts src/server/articleUnitChange.ts src/server/fieldWorks.ts src/server/inventory.test.ts && \
git commit -m "Inventuur: vahe ümberarvutuses, hoiatus tagantjärele liikumisele

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release 2>&1 | tail -5'
```

---

### Task 4: API — eelvaade, laokanded, laokaart, hoiatus, MCP

**Files:**
- Modify: `src/server/stockApi.ts`, `src/server/fieldWorks.ts` (kande POST ~rida 1283–1303 ja PUT ~rida 1323–1350), `src/server/mcp/tools/stock.ts`

**Interfaces:**
- Consumes: Task 1 `stockAtDate`, `counts`; Task 3 `inventoryNotice`, `entryStockTouches`.
- Produces:
  - `GET /api/stock/inventory-preview?warehouseId&date=YYYY-MM-DD[&documentId]` → `{ articleId, articleName, unit, bookQty, unitPrice: number | null }[]` (nime järgi); viga 400 „Vali ladu ja kuupäev“.
  - Laokande DTO real lisaks `countedQty`, `diffQty`; INVENTORY kande `total` = ülejääk − puudujääk; POST/PUT vastuses `inventoryNotice: string | null`.
  - Laokaardi liikumine `kind: 'COUNT'`, `delta` = vahe, `quantity` = |vahe|, `countedQty`.
  - Põllutöö kande POST/PUT vastuses `inventoryNotice` (ainult finantsõigusega).

- [ ] **Step 1: Eelvaade** — `src/server/stockApi.ts`: impordi `stockAtDate` (`./stockFifo.ts`) ja `inventoryNotice` (`./stock.ts`). Lisa „Laoseis (kogus) kõigile“ ploki järele:
```ts
  // --- Inventuuri eelvaade (finants): lao kaubad arvestusliku seisuga kuupäeva lõpus ---
  if (pathname === '/api/stock/inventory-preview' && method === 'GET') {
    const warehouseId = text(url.searchParams.get('warehouseId'), 64);
    const date = text(url.searchParams.get('date'), 10);
    const documentId = text(url.searchParams.get('documentId'), 64);
    if (!warehouseId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      json(res, { error: 'Vali ladu ja kuupäev' }, 400);
      return true;
    }
    const rows = await tenantTransaction(async (tx) => {
      const goods = await tx.article.findMany({ where: { category: { group: { not: 'SERVICE' } } }, select: { id: true, name: true, unit: true } });
      // Muudetava inventuuri enda read ei loe arvestuslikku seisu; selle artiklid on alati nimekirjas
      const own = documentId ? await tx.stockDocumentLine.findMany({ where: { documentId }, select: { id: true, articleId: true } }) : [];
      const exclude = new Set(own.map((l) => `doc:${l.id}`));
      const ownArticles = new Set(own.map((l) => l.articleId));
      const byId = new Map(goods.map((a) => [a.id, a]));
      const out: { articleId: string; articleName: string; unit: string; bookQty: number; unitPrice: number | null }[] = [];
      for (const mm of await loadMovements(tx, goods.map((a) => a.id))) {
        const s = stockAtDate(mm.movements, warehouseId, date, exclude);
        if (!s.touched && s.qty === 0 && !ownArticles.has(mm.articleId)) continue;
        const a = byId.get(mm.articleId)!;
        out.push({ articleId: a.id, articleName: a.name, unit: a.unit, bookQty: s.qty, unitPrice: s.surplusUnitCost });
      }
      return out.sort((x, y) => x.articleName.localeCompare(y.articleName, 'et'));
    }, { timeout: 60000 });
    json(res, rows);
    return true;
  }
```
(Kui `category: { group: … }` filter annab Prisma tüübivea, kasuta `category: { is: { group: { not: 'SERVICE' } } }`.)

- [ ] **Step 2: Laokande DTO** — `documentDto`:
```ts
  const lines = d.lines.map((l: any) => ({
    id: l.id, articleId: l.articleId, articleName: l.article.name, unit: l.article.unit,
    quantity: l.quantity, amount: money(l.amount), fifoCost: money(l.fifoCost), shortageQty: l.shortageQty,
    countedQty: l.countedQty, diffQty: l.diffQty
  }));
  // Inventuuri summa = ülejäägi väärtus − puudujäägi maksumus
  const value = (l: any) => (d.kind === 'RECEIPT' ? l.amount : d.kind === 'INVENTORY' ? (l.amount ?? 0) - (l.fifoCost ?? 0) : l.fifoCost);
  const total = lines.reduce((s: number, l: any) => s + (value(l) ?? 0), 0);
  const unpricedInventory = (l: any) => ((l.diffQty ?? 0) > 0 ? l.amount === null : (l.diffQty ?? 0) < 0 ? l.fifoCost === null : false);
```
ja tagastuses:
```ts
    hasUnpriced: d.kind === 'INVENTORY' ? lines.some(unpricedInventory) : d.kind !== 'RECEIPT' && lines.some((l: any) => l.fifoCost === null),
```
Laokannete loendi filtris: `(['RECEIPT', 'WRITE_OFF', 'TRANSFER', 'INVENTORY'] as const)`.

- [ ] **Step 3: Hoiatus laokande salvestamisel** — POST/PUT plokis enne `saveStockDocument`-i loe muudetava kande vana päis ja artiklid; pärast salvestust arvuta hoiatus:
```ts
    try {
      const old = id ? await prisma.stockDocument.findUnique({ where: { id }, select: { date: true, warehouseId: true, toWarehouseId: true, lines: { select: { articleId: true } } } }) : null;
      const savedId = await tenantTransaction((tx) => saveStockDocument(tx, id, parsed.doc), { timeout: 60000 });
      // Liikumine enne inventuuri samas laos muudab selle vahet (vana ja uus kuupäev, ladu ja artiklid)
      const whIds = [...new Set([parsed.doc.warehouseId, parsed.doc.toWarehouseId, old?.warehouseId, old?.toWarehouseId].filter((x): x is string => !!x))];
      const articleIds = [...new Set([...parsed.doc.lines.map((l) => l.articleId), ...(old?.lines.map((l) => l.articleId) ?? [])])];
      const fromDate = old && old.date < parsed.doc.date ? old.date : parsed.doc.date;
      const notice = await tenantTransaction((tx) => inventoryNotice(tx, articleIds.flatMap((articleId) => whIds.map((warehouseId) => ({ articleId, warehouseId }))), fromDate, savedId));
      const d = await prisma.stockDocument.findUniqueOrThrow({ where: { id: savedId }, include: DOC_INCLUDE });
      json(res, { ...documentDto(d), inventoryNotice: notice });
    } catch (err) {
```

- [ ] **Step 4: Laokaart** — liikumiste plokis `const { outs, counts } = fifoReplay(mm.movements);` ning tsüklis:
```ts
        let delta = 0;
        if (m.kind === 'IN') delta = m.quantity;
        else if (m.kind === 'OUT') delta = -m.quantity;
        else if (m.kind === 'COUNT') delta = counts.get(m.ref)?.diffQty ?? 0;
        else if (warehouseId) delta = m.warehouseId === warehouseId ? -m.quantity : m.quantity;
```
```ts
        const base = { ref: m.ref, date: m.date, kind: m.kind, quantity: m.kind === 'COUNT' ? Math.abs(delta) : m.quantity, delta, balance,
          warehouseName: whName.get(m.warehouseId) ?? '', toWarehouseName: m.toWarehouseId ? whName.get(m.toWarehouseId) ?? '' : null,
          ...(m.kind === 'COUNT' ? { countedQty: m.quantity } : {}) };
        // Inventuur: ülejäägi väärtus, puudujäägi FIFO maksumus, vahe 0 → 0
        const countCost = delta > 0 ? counts.get(m.ref)?.amount ?? null : delta < 0 ? movementCost('OUT', o) : 0;
        const cost = m.kind === 'IN' ? (m.amount ?? 0) : m.kind === 'COUNT' ? countCost : movementCost(m.kind, o);
```
(Asenda Task 1-s lisatud ajutine `COUNT` haru.)

- [ ] **Step 5: Hoiatus põllutöö kande salvestamisel** — `src/server/fieldWorks.ts`, impordi `inventoryNotice`, `entryStockTouches` (`./stock.ts`).
POST (pärast `syncFieldWorkStatus`):
```ts
    const finance = canSeeFinance(req);
    // Finantsjuhile hoiatus, kui kanne jääb inventuuri ette (muudab selle vahet)
    const notice = finance && saved.warehouseId
      ? await tenantTransaction(async (tx) => inventoryNotice(tx, await entryStockTouches(tx, saved.lines, saved.warehouseId!), saved.date, null))
      : null;
    json(res, { ...entryDto(saved, finance), ...(finance ? { inventoryNotice: notice } : {}) });
```
PUT (asenda `json(res, entryDto(saved, canSeeFinance(req)));`):
```ts
    const finance = canSeeFinance(req);
    const notice = finance && saved.warehouseId
      ? await tenantTransaction(async (tx) => inventoryNotice(tx, [
          ...(await entryStockTouches(tx, old.lines, old.warehouseId ?? saved.warehouseId!)),
          ...(await entryStockTouches(tx, saved.lines, saved.warehouseId!))
        ], old.date < saved.date ? old.date : saved.date, null))
      : null;
    json(res, { ...entryDto(saved, finance), ...(finance ? { inventoryNotice: notice } : {}) });
```
(Kontrolli, et `saved.lines` ja `old.lines` sisaldavad `kind` ja `articleId` — `ENTRY_INCLUDE` ja `old` päring; vajadusel kohanda.)

- [ ] **Step 6: MCP laoliikumised** — `src/server/mcp/tools/stock.ts`: tööriista kirjeldusse lisa „inventuur (INVENTORY: quantity = vahe, + juurde / − maha; counted = tegelik seis)“. Laokande ridade päringu `select`/`include`-i lisa `countedQty`, `diffQty`, ja rea kaardistus:
```ts
          article: l.article.name,
          quantity: l.document.kind === 'INVENTORY' ? round2(l.diffQty ?? 0) : round2(l.quantity),
          ...(l.document.kind === 'INVENTORY' ? { counted: round2(l.countedQty ?? 0) } : {}),
          unit: l.article.unit, supplier: l.document.supplier?.name ?? null, documentNo: l.document.documentNo,
          reason: l.document.writeOffReason,
          cost: money(l.document.kind === 'RECEIPT' ? l.amount : l.document.kind === 'INVENTORY' && (l.diffQty ?? 0) > 0 ? l.amount : l.fifoCost)
```
(`Row` tüübile lisa `counted?: number`.)

- [ ] **Step 7: Testid ja tüübikontroll**

Run: `ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npm test 2>&1 | tail -6 && npx tsc -b 2>&1 | tail -20'`
Expected: PASS; tsc vigadeta.

- [ ] **Step 8: Commit ja release**
```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/stockApi.ts src/server/fieldWorks.ts src/server/mcp/tools/stock.ts && \
git commit -m "Inventuur: eelvaade, laokande ja laokaardi andmed, hoiatus salvestamisel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release 2>&1 | tail -5'
```

---

### Task 5: Kasutajaliides

**Files:**
- Modify: `src/types/stock.ts`, `src/types/fieldWork.ts`, `src/services/api.ts`, `src/components/StockDocumentsPanel.tsx`, `src/components/StockDocumentDialog.tsx`, `src/components/ArticleStockCard.tsx`, `src/components/FieldWorkEntryDialog.tsx`
- Create: `src/components/InventoryDialog.tsx`

**Interfaces:**
- Consumes: Task 4 otspunktid ja väljad.

- [ ] **Step 1: Tüübid** — `src/types/stock.ts`:
```ts
export type StockDocumentKind = 'RECEIPT' | 'WRITE_OFF' | 'TRANSFER' | 'INVENTORY';

export const STOCK_DOC_KIND_LABEL: Record<StockDocumentKind, string> = {
  RECEIPT: 'Arvele võtmine',
  WRITE_OFF: 'Mahakandmine',
  TRANSFER: 'Ülekanne',
  INVENTORY: 'Inventuur'
};
```
`StockDocumentLine`-ile: `countedQty: number | null; // inventuur: tegelik seis` ja `diffQty: number | null; // inventuur: vahe (+ juurde, − maha)`.
`StockDocument`-ile: `inventoryNotice?: string | null; // salvestuse vastuses: kanne muudab inventuuri vahet`.
`StockDocumentInput.lines`: `{ articleId: string; quantity?: string | number; amount?: string | number | null; countedQty?: string | number | null }[]`.
`StockMovement.kind`: `'IN' | 'TRANSFER' | 'OUT' | 'COUNT'`; lisa `countedQty?: number; // inventuur: tegelik seis`.
Uus:
```ts
/** Inventuuri vormi rida: arvestuslik seis kuupäeva lõpus ja ülejäägi eeldatav ühikuhind. */
export interface InventoryPreviewRow {
  articleId: string;
  articleName: string;
  unit: string;
  bookQty: number;
  unitPrice: number | null;
}
```
`src/types/fieldWork.ts` `WorkEntry`-le: `inventoryNotice?: string | null; // salvestuse vastuses (finants): kanne muudab inventuuri vahet`.

- [ ] **Step 2: API klient** — `src/services/api.ts` (impordi `InventoryPreviewRow`), `getStockLevels` järele:
```ts
  async getInventoryPreview(warehouseId: string, date: string, documentId?: string): Promise<InventoryPreviewRow[]> {
    const q = new URLSearchParams({ warehouseId, date, ...(documentId ? { documentId } : {}) });
    return jsonOrThrow(await apiFetch(`/api/stock/inventory-preview?${q}`), 'Arvestusliku seisu laadimine ebaõnnestus');
  },
```

- [ ] **Step 3: Inventuuri vorm** — `src/components/InventoryDialog.tsx`:
```tsx
// src/components/InventoryDialog.tsx — inventuur: lao kaubad arvestusliku seisuga, tegelik seis sisestusväljas.
// Tühi tegelik seis = rida ei salvestata; 0 = kogu seis maha. Vahe ja maksumuse arvutab server ümberarvutusel.
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClipboardCheck, X } from 'lucide-react';
import { formatQty } from '../services/units';
import { isGoods } from '../services/articleRules';
import { api } from '../services/api';
import { alertDialog } from './ConfirmDialog';
import { DateInput } from './DateInput';
import { todayTallinn } from '../services/dateFormat';
import type { Article } from '../types/fieldWork';
import type { InventoryPreviewRow, StockDocument, Warehouse } from '../types/stock';

const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });
const parseNum = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() && Number.isFinite(n) ? n : null;
};
const fmtInput = (n: number | null | undefined) =>
  n == null ? '' : n.toLocaleString('et-EE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

interface Props {
  initial: StockDocument | null;
  warehouses: Warehouse[];
  articles: Article[];
  onClose: () => void;
  onSaved: () => void;
}

export const InventoryDialog: React.FC<Props> = ({ initial, warehouses, articles, onClose, onSaved }) => {
  const [date, setDate] = useState(initial?.date ?? todayTallinn());
  const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? warehouses.find((w) => w.isDefault)?.id ?? '');
  const [documentNo, setDocumentNo] = useState(initial?.documentNo ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [preview, setPreview] = useState<InventoryPreviewRow[]>([]);
  const [added, setAdded] = useState<string[]>([]); // käsitsi lisatud artiklid, mida nimekirjas polnud
  const [counted, setCounted] = useState<Record<string, string>>(
    () => Object.fromEntries((initial?.lines ?? []).map((l) => [l.articleId, fmtInput(l.countedQty)]))
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!warehouseId || !date) return;
    let alive = true;
    api.getInventoryPreview(warehouseId, date, initial?.id)
      .then((rows) => { if (alive) setPreview(rows); })
      .catch((e) => { if (alive) void alertDialog(e instanceof Error ? e.message : 'Arvestusliku seisu laadimine ebaõnnestus'); });
    return () => { alive = false; };
  }, [warehouseId, date, initial?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const rows = useMemo(() => {
    const listed = new Set(preview.map((p) => p.articleId));
    const extra = added.filter((id) => !listed.has(id)).flatMap((id) => {
      const a = articles.find((x) => x.id === id);
      return a ? [{ articleId: a.id, articleName: a.name, unit: a.unit, bookQty: 0, unitPrice: null }] : [];
    });
    return [...preview, ...extra];
  }, [preview, added, articles]);

  const addable = articles
    .filter((a) => isGoods(a.category.group) && a.isActive && !rows.some((r) => r.articleId === a.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'et'));
  const activeWarehouses = warehouses.filter((w) => w.isActive || w.id === warehouseId);

  // Vahe ja eeldatav väärtus (lao keskmise hinnaga; puudujäägi tegelik maksumus tuleb FIFO-st pärast salvestust)
  const calc = (r: InventoryPreviewRow) => {
    const c = parseNum(counted[r.articleId] ?? '');
    if (c === null) return null;
    const diff = Math.round((c - r.bookQty) * 1e6) / 1e6;
    return { diff, value: r.unitPrice == null ? null : Math.round(diff * r.unitPrice * 100) / 100 };
  };
  const results = rows.map(calc);
  const shortage = results.reduce((s, x) => s + (x && x.diff < 0 ? -(x.value ?? 0) : 0), 0);
  const surplus = results.reduce((s, x) => s + (x && x.diff > 0 ? x.value ?? 0 : 0), 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = rows.filter((r) => (counted[r.articleId] ?? '').trim());
    const bad = filled.find((r) => parseNum(counted[r.articleId]) === null);
    if (bad) return void alertDialog(`Tegelik seis peab olema arv: ${bad.articleName}`);
    if (!filled.length) return void alertDialog('Sisesta vähemalt ühe artikli tegelik seis');
    setBusy(true);
    try {
      const saved = await api.saveStockDocument(
        {
          kind: 'INVENTORY', date, warehouseId, documentNo: documentNo || null, notes: notes || null,
          lines: filled.map((r) => ({ articleId: r.articleId, countedQty: counted[r.articleId] }))
        },
        initial?.id
      );
      if (saved.inventoryNotice) await alertDialog(saved.inventoryNotice);
      onSaved();
    } catch (err) {
      void alertDialog(err instanceof Error ? err.message : 'Inventuuri salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <form className="modal-content animate-scale-up stock-doc-modal" onSubmit={save}>
        <div className="modal-header">
          <div className="modal-title-group">
            <ClipboardCheck size={20} className="text-emerald" />
            <h3>{initial ? 'Muuda: ' : ''}Inventuur</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="inv-date">Kuupäev *</label>
              <DateInput id="inv-date" value={date} onChange={setDate} className="form-input" required />
            </div>
            <div className="form-group">
              <label htmlFor="inv-wh">Ladu *</label>
              <select id="inv-wh" className="form-input" required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">– vali –</option>
                {activeWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="inv-no">Dokumendi nr</label>
              <input id="inv-no" className="form-input" value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} />
            </div>
            <div className="form-group full-width">
              <label htmlFor="inv-notes">Märkus</label>
              <input id="inv-notes" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <p className="muted">Tühi tegelik seis: rida ei arvestata. 0: kogu seis kantakse maha.</p>

          <table className="register-table stock-doc-lines">
            <thead>
              <tr>
                <th>Artikkel</th>
                <th className="num">Arvestuslik</th>
                <th className="num">Tegelik</th>
                <th className="num">Vahe</th>
                <th className="num">Eeldatav väärtus</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="muted">Selles laos pole kaupu. Lisa artikkel allpool.</td></tr>}
              {rows.map((r, i) => {
                const x = results[i];
                return (
                  <tr key={r.articleId}>
                    <td>{r.articleName}</td>
                    <td className={`num ${r.bookQty < 0 ? 'article-overuse' : ''}`}>{formatQty(r.bookQty)}<span className="stock-doc-unit">{r.unit}</span></td>
                    <td className="num">
                      <span className="input-with-unit">
                        <input
                          className="form-input num" inputMode="decimal" aria-label={`Tegelik seis: ${r.articleName}`}
                          value={counted[r.articleId] ?? ''}
                          onChange={(e) => setCounted({ ...counted, [r.articleId]: e.target.value })}
                          onBlur={() => { const n = parseNum(counted[r.articleId] ?? ''); if (n !== null) setCounted({ ...counted, [r.articleId]: fmtInput(n) }); }}
                        />
                        <span className="stock-doc-unit">{r.unit}</span>
                      </span>
                    </td>
                    <td className={`num ${x && x.diff < 0 ? 'stock-qty-out' : x && x.diff > 0 ? 'stock-qty-in' : ''}`}>
                      {x ? `${x.diff > 0 ? '+' : ''}${formatQty(x.diff)}` : '–'}
                    </td>
                    <td className="num">{!x || x.diff === 0 ? '–' : x.value == null ? <span className="muted">hindamata</span> : fmtEur(x.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="stock-doc-footer-row">
            <select className="form-input" aria-label="Lisa artikkel" value="" onChange={(e) => e.target.value && setAdded([...added, e.target.value])}>
              <option value="">+ Lisa artikkel, mida nimekirjas pole</option>
              {addable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <span>Puudujääk: <strong>{fmtEur(shortage)}</strong> · Ülejääk: <strong>{fmtEur(surplus)}</strong></span>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Loobu</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>Salvesta</button>
        </div>
      </form>
    </div>,
    document.body
  );
};
```

- [ ] **Step 4: Laokannete paneel** — `src/components/StockDocumentsPanel.tsx`: impordi `ClipboardCheck` ja `InventoryDialog`. Nuppude reale „Ülekanne“ järele:
```tsx
          <button className="btn btn-secondary btn-sm" onClick={() => setForm({ kind: 'INVENTORY', initial: null })}><ClipboardCheck size={14} /><span>Inventuur</span></button>
```
Vormi renderdus:
```tsx
      {form && form.kind === 'INVENTORY' && (
        <InventoryDialog
          initial={form.initial}
          warehouses={warehouses}
          articles={articles}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); void reload(); onChanged(); }}
        />
      )}
      {form && form.kind !== 'INVENTORY' && (
        <StockDocumentDialog … olemasolevad propsid … />
      )}
```
Summa veerus inventuuri kanne näitab netosummat (`d.total`, võib olla negatiivne) — muutust pole vaja.

- [ ] **Step 5: Laokande vorm** — `src/components/StockDocumentDialog.tsx`:
  - Põhjuse valikus jäta `INVENTORY` välja, kui see pole kande praegune põhjus: `(Object.keys(WRITE_OFF_REASON_LABEL) as WriteOffReason[]).filter((r) => r !== 'INVENTORY' || reason === 'INVENTORY')`.
  - Salvestus: `const saved = await api.saveStockDocument(…);` ja enne `onSaved()`: `if (saved.inventoryNotice) await alertDialog(saved.inventoryNotice);`

- [ ] **Step 6: Laokaart** — `src/components/ArticleStockCard.tsx` `describe`-s enne `TRANSFER` tagastust:
```ts
  if (m.documentKind === 'INVENTORY') return [kind, m.countedQty != null ? `loetud ${fmtQty(m.countedQty)}` : null, m.documentNo].filter(Boolean).join(' · ');
```

- [ ] **Step 7: Põllutöö kande vorm** — `src/components/FieldWorkEntryDialog.tsx` (~rida 333): `const saved = await api.saveWorkEntry(…);` ja kohe pärast seda (enne vormi sulgemist / `onSaved`): `if (saved.inventoryNotice) await alertDialog(saved.inventoryNotice);` (impordi `alertDialog`, kui pole). Muud vormi käitumist ära muuda.

- [ ] **Step 8: Tüübikontroll, testid, commit, release, andmemudel**

```bash
ssh -o BatchMode=yes debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc -b 2>&1 | tail -20 && npm test 2>&1 | tail -5 && \
git add src/types/stock.ts src/types/fieldWork.ts src/services/api.ts src/components/InventoryDialog.tsx src/components/StockDocumentsPanel.tsx src/components/StockDocumentDialog.tsx src/components/ArticleStockCard.tsx src/components/FieldWorkEntryDialog.tsx && \
git commit -m "Inventuur: vorm, laokannete nupp, laokaardi rida, hoiatus salvestamisel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release 2>&1 | tail -5 && \
npx tsx scripts/generate-erd.mts && git add docs/andmemudel.md && git commit -m "Andmemudel: inventuur

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && git log --oneline -3'
```
Expected: tsc vigadeta, testid PASS, release õnnestub.
