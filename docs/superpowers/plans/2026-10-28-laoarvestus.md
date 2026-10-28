# Kulumaterjalide laoarvestus — teostusplaan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kulumaterjalidel on laoseis lao kaupa (kogus ja FIFO väärtus); laokannete registriga võetakse arvele, kantakse maha ja tehakse ladudevahelisi ülekandeid; põllutööde kanded kannavad materjali laost maha ja saavad FIFO hinna.

**Architecture:** Salvestatakse ainult liikumised (laokande read + olemasolevad põllutöö kande materjaliread). Puhas funktsioon `fifoReplay` arvutab ühe materjali kõik liikumised kõigis ladudes kuupäeva järjekorras uuesti; `recomputeMaterialStock(tx, materialIds)` käivitab selle iga muudatuse järel samas tehingus ja kirjutab tulemuse kanderidade `unitPrice`-ks, laokande ridade `fifoCost`-iks ja koondtabelisse `material_stock`. HTTP kiht (`src/server/stockApi.ts`) on õhuke; reeglid on puhastes moodulites.

**Tech Stack:** React 19 + TypeScript + Vite, `node:http` server (`src/server`), Prisma 6 + PostgreSQL (RLS), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-laoarvestus-design.md`

## Global Constraints

- Kood asub serveris; kohalik `/Users/andresj/Progemine/teris` on sshfs-mount samast kaustast. Faile muuda kohalikult (Edit/Write), **kõik käsud** (npm, npx, git, psql) jooksevad serveris:
  `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && <käsk>'`
- Andmebaasi ühendus käsureal: `set -a && . ./.env && set +a` ja siis `psql "${MIGRATE_DATABASE_URL%%\?*}"` (tabelite omanik).
- Varukoopia enne iga andmeid muutvat sammu (skeem, ümberarvutus):
  `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && pg_dump "${PLATFORM_DATABASE_URL%%\?*}" -Fc -f ~/backups/teris-$(date +%F-%H%M).dump && ls -t ~/backups | head -1'`
- Skeemimuudatus: `npx prisma db push` ja `npx prisma generate` (ilma `--accept-data-loss`-ita; kui Prisma seda nõuab, peatu ja küsi kasutajalt). Uued ettevõttepõhised tabelid lisa `scripts/tenancy/02-rls.sql` loendisse ja käivita `psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql` ning `MIGRATE_DATABASE_URL=… npx tsx scripts/tenancy/05-tenant-fk-triggers.mts`.
- Tüübikontroll: `npx tsc --noEmit -p tsconfig.app.json`. Testid: `npx vitest run <fail>`; kõik: `npm test`.
- Iga ülesande lõpus: commit (ainult nimetatud failid, `git add <failid>`) ja `npm run release`. Commit-sõnum eesti keeles, lõpus rida `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Identifikaatorid (muutujad, failid, CSS klassid, URL-id, enumid) inglise keeles; koodikommentaarid ja UI-tekst eesti keeles.
- Kuupäevad UI-s `pp.kk.aaaa` (`formatDate` failist `src/services/dateFormat.ts`), sisestus `DateInput` komponendiga — mitte natiivne `type="date"`.
- Kõik filtrid (rippmenüüd, otsingud) mähitakse `FilterClear` komponenti.
- Raha (laoväärtus, hinnad, summad, maksumused) näevad ja laokandeid/ladusid muudavad ainult admin ja finantsjuht (`isAdmin || isFinanceManager`). Laoseisu kogust näevad kõik.
- Laoseis võib minna miinusesse; ainult **ülekanne** ei tohi lähteladu miinusesse viia ega võtta hindamata kaupa.
- Sama päeva liikumiste järjekord: arvele võtmine → ülekanne → väljaminek (mahakandmine, põllutöö kanne).
- Teisendatavad ühikud: `g`, `kg`, `t` omavahel. Muu erinevus → rida jääb arvestusest välja (probleemne).
- Testides väljamõeldud nimed; päris isikuandmeid ei commit'ita.

## Failide struktuur

| Fail | Vastutus |
|---|---|
| `src/services/units.ts` (uus) | `convertQty` g/kg/t |
| `src/services/units.test.ts` (uus) | testid |
| `src/server/stockFifo.ts` (uus) | puhas `fifoReplay`, `sortMovements`, tüübid |
| `src/server/stockFifo.test.ts` (uus) | testid |
| `src/server/stockRules.ts` (uus) | puhas laokande sisendi valideerimine `parseStockDocument` |
| `src/server/stockRules.test.ts` (uus) | testid |
| `prisma/schema.prisma` | `Warehouse`, `StockDocument`, `StockDocumentLine`, `MaterialStock`, enumid, `WorkEntry.warehouseId`, `Material.stockIssueCount`, `PartyRole.SUPPLIER`, vastasseosed |
| `scripts/tenancy/02-rls.sql` | uued tabelid RLS loendisse |
| `src/server/stock.ts` (uus) | `getDefaultWarehouseId`, `loadMovements`, `recomputeMaterialStock`, `recomputeAllMaterialStock`, `transferShortageKeys`, `StockValidationError` |
| `src/server/stock.test.ts` (uus) | andmebaasi integratsioonitestid ajutise ettevõttega |
| `src/server/stockApi.ts` (uus) | `/api/warehouses*`, `/api/stock/*` |
| `src/server/apiHandler.ts` | `handleStock` ühendus; PRIA import → ümberarvutus; `/api/poi` tagastab lao |
| `src/server/fieldWorks.ts` | kande `warehouseId`; kande loomine/muutmine/kustutamine → ümberarvutus; finants ignoreerib materjali hindu; `/api/materials` laoväljad; ühiku muutmise ja kustutamise kontroll |
| `scripts/stock-init.mts` (uus) | ühekordne: põhiladu + ümberarvutus kõigile ettevõtetele |
| `src/types/stock.ts` (uus) | kliendi tüübid ja sildid |
| `src/types/fieldWork.ts`, `src/types/party.ts`, `src/types/poi.ts` | laoväljad, `SUPPLIER`, `warehouse` |
| `src/services/api.ts` | lao API kliendid |
| `src/components/MaterialsView.tsx` | vahekaardid, laoveerud, lao filter, hoiatused, CSV |
| `src/components/MaterialStockCard.tsx` (uus) | laokaart |
| `src/components/StockDocumentsPanel.tsx` (uus) | laokannete nimekiri |
| `src/components/StockDocumentDialog.tsx` (uus) | laokande vorm |
| `src/components/WarehousesPanel.tsx` (uus) | ladude register + vorm |
| `src/components/FieldWorkEntryDialog.tsx`, `src/components/PriaLinesEditor.tsx` | lao valik, laoseis materjali juures |
| `src/components/FinanceModal.tsx` | materjali hind kirjutuskaitstud |
| `src/components/MapView.tsx`, `src/App.tsx` | lao link huvipunkti hüpikaknas |
| `src/index.css` | stiilid |
| `docs/andmemudel.md` | laoarvestuse tabelid |

---

### Task 1: Ühikute teisendus ja FIFO arvutus (puhtad funktsioonid)

**Files:**
- Create: `src/services/units.ts`, `src/services/units.test.ts`
- Create: `src/server/stockFifo.ts`, `src/server/stockFifo.test.ts`

**Interfaces:**
- Produces:
  - `convertQty(qty: number, from: string, to: string): number | null`
  - `type MovementKind = 'IN' | 'TRANSFER' | 'OUT'`
  - `interface Movement { ref: string; date: string; seq: number; kind: MovementKind; warehouseId: string; toWarehouseId?: string; quantity: number; amount?: number }`
  - `interface OutResult { cost: number; unpricedQty: number; shortageQty: number }`
  - `interface WarehouseStock { qty: number; value: number; unpricedQty: number }`
  - `interface ReplayResult { outs: Map<string, OutResult>; stock: Map<string, WarehouseStock> }`
  - `sortMovements(m: Movement[]): Movement[]`
  - `fifoReplay(m: Movement[]): ReplayResult`

- [ ] **Step 1: Kirjuta ühikute test**

`src/services/units.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { convertQty } from './units';

describe('convertQty', () => {
  it('sama ühik (tõstutundetu, tühikud) jääb samaks', () => {
    expect(convertQty(5, 'kg', ' KG ')).toBe(5);
    expect(convertQty(2, 'l', 'l')).toBe(2);
  });
  it('teisendab g/kg/t vahel', () => {
    expect(convertQty(1500, 'g', 'kg')).toBe(1.5);
    expect(convertQty(2, 't', 'kg')).toBe(2000);
    expect(convertQty(250, 'kg', 't')).toBe(0.25);
  });
  it('teisendamatu paar annab null', () => {
    expect(convertQty(1, 'l', 'kg')).toBeNull();
    expect(convertQty(1, 'tk', 'kg')).toBeNull();
  });
});
```

- [ ] **Step 2: Käivita, veendu et kukub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/services/units.test.ts'`
Expected: FAIL (moodulit `./units` ei leita)

- [ ] **Step 3: Kirjuta `src/services/units.ts`**

```ts
// src/services/units.ts — koguse teisendus materjali laoühikusse (kasutavad server ja klient)
const MASS: Record<string, number> = { g: 0.001, kg: 1, t: 1000 };

const norm = (u: string) => u.trim().toLowerCase();

/** Teisendab koguse ühikust `from` ühikusse `to`; teisendamatu paari korral null. */
export function convertQty(qty: number, from: string, to: string): number | null {
  const f = norm(from);
  const t = norm(to);
  if (f === t) return qty;
  if (f in MASS && t in MASS) return Math.round(((qty * MASS[f]) / MASS[t]) * 1e9) / 1e9;
  return null;
}
```

- [ ] **Step 4: Käivita, veendu et läbib**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/services/units.test.ts'`
Expected: PASS (3 testi)

- [ ] **Step 5: Kirjuta FIFO testid**

`src/server/stockFifo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fifoReplay, sortMovements, type Movement } from './stockFifo';

const A = 'wh-a';
const B = 'wh-b';
let seq = 0;
const inM = (ref: string, date: string, quantity: number, amount: number, warehouseId = A): Movement =>
  ({ ref, date, seq: seq++, kind: 'IN', warehouseId, quantity, amount });
const outM = (ref: string, date: string, quantity: number, warehouseId = A): Movement =>
  ({ ref, date, seq: seq++, kind: 'OUT', warehouseId, quantity });
const trM = (ref: string, date: string, quantity: number, from = A, to = B): Movement =>
  ({ ref, date, seq: seq++, kind: 'TRANSFER', warehouseId: from, toWarehouseId: to, quantity });

describe('sortMovements', () => {
  it('kuupäev, siis IN → TRANSFER → OUT, siis seq', () => {
    const m = [outM('o', '2026-05-01', 1), trM('t', '2026-05-01', 1), inM('i', '2026-05-01', 1, 1), inM('i0', '2026-04-30', 1, 1)];
    expect(sortMovements(m).map((x) => x.ref)).toEqual(['i0', 'i', 't', 'o']);
  });
});

describe('fifoReplay', () => {
  it('võtab vanimast partiist ja jätkab järgmisest', () => {
    const r = fifoReplay([
      inM('i1', '2026-01-01', 100, 100), // 1,00 €/kg
      inM('i2', '2026-02-01', 100, 200), // 2,00 €/kg
      outM('o1', '2026-03-01', 150)
    ]);
    expect(r.outs.get('o1')).toEqual({ cost: 200, unpricedQty: 0, shortageQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: 50, value: 100, unpricedQty: 0 });
  });

  it('sama päeva sissetulek kehtib enne väljaminekut, sõltumata sisestusjärjekorrast', () => {
    const r = fifoReplay([outM('o1', '2026-03-01', 10), inM('i1', '2026-03-01', 10, 50)]);
    expect(r.outs.get('o1')).toEqual({ cost: 50, unpricedQty: 0, shortageQty: 0 });
  });

  it('miinusseis jääb hindamata; hilisem sissetulek katab võla ja annab sellele hinna', () => {
    const r = fifoReplay([
      outM('o1', '2026-03-01', 30),
      inM('i1', '2026-04-01', 50, 150) // 3,00 €/kg
    ]);
    expect(r.outs.get('o1')).toEqual({ cost: 90, unpricedQty: 0, shortageQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: 20, value: 60, unpricedQty: 0 });
  });

  it('katmata võlg jääb laoseisu miinuseks ja hindamata koguseks', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 10), outM('o1', '2026-02-01', 25)]);
    expect(r.outs.get('o1')).toEqual({ cost: 10, unpricedQty: 15, shortageQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: -15, value: 0, unpricedQty: 15 });
  });

  it('tagantjärele lisatud varasem arve muudab hilisema väljamineku hinda', () => {
    const base = [inM('i2', '2026-05-01', 10, 50), outM('o1', '2026-06-01', 10)];
    expect(fifoReplay(base).outs.get('o1')!.cost).toBe(50);
    const withEarlier = [...base, inM('i1', '2026-01-01', 10, 20)];
    expect(fifoReplay(withEarlier).outs.get('o1')!.cost).toBe(20);
  });

  it('nullsummaga sissetulek annab nullhinnaga partii', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 5, 0), outM('o1', '2026-01-02', 5)]);
    expect(r.outs.get('o1')).toEqual({ cost: 0, unpricedQty: 0, shortageQty: 0 });
  });

  it('laod on eraldi', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 10, 10, A), outM('o1', '2026-01-02', 5, B)]);
    expect(r.outs.get('o1')).toEqual({ cost: 0, unpricedQty: 5, shortageQty: 0 });
    expect(r.stock.get(A)).toEqual({ qty: 10, value: 10, unpricedQty: 0 });
    expect(r.stock.get(B)).toEqual({ qty: -5, value: 0, unpricedQty: 5 });
  });

  it('ülekanne kannab partii hinna sihtlattu', () => {
    const r = fifoReplay([
      inM('i1', '2026-01-01', 10, 10), // 1 €
      inM('i2', '2026-01-02', 10, 30), // 3 €
      trM('t1', '2026-02-01', 15),
      outM('o1', '2026-03-01', 12, B)
    ]);
    expect(r.outs.get('t1')).toEqual({ cost: 25, unpricedQty: 0, shortageQty: 0 });
    expect(r.outs.get('o1')).toEqual({ cost: 16, unpricedQty: 0, shortageQty: 0 }); // 10×1 + 2×3
    expect(r.stock.get(A)).toEqual({ qty: 5, value: 15, unpricedQty: 0 });
    expect(r.stock.get(B)).toEqual({ qty: 3, value: 9, unpricedQty: 0 });
  });

  it('ülekanne katab sihtlao võla', () => {
    const r = fifoReplay([
      outM('o1', '2026-01-01', 4, B),
      inM('i1', '2026-01-02', 10, 20),
      trM('t1', '2026-01-03', 10)
    ]);
    expect(r.outs.get('o1')).toEqual({ cost: 8, unpricedQty: 0, shortageQty: 0 });
    expect(r.stock.get(B)).toEqual({ qty: 6, value: 12, unpricedQty: 0 });
  });

  it('ülekanne üle saadaoleva: puudujääk märgitakse, kogus liigub hindamatuna', () => {
    const r = fifoReplay([inM('i1', '2026-01-01', 5, 10), trM('t1', '2026-01-02', 8)]);
    expect(r.outs.get('t1')).toEqual({ cost: 10, unpricedQty: 3, shortageQty: 3 });
    expect(r.stock.get(A)).toEqual({ qty: -3, value: 0, unpricedQty: 3 });
    expect(r.stock.get(B)).toEqual({ qty: 8, value: 10, unpricedQty: 3 });
  });
});
```

- [ ] **Step 6: Käivita, veendu et kukub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stockFifo.test.ts'`
Expected: FAIL (moodulit `./stockFifo` ei leita)

- [ ] **Step 7: Kirjuta `src/server/stockFifo.ts`**

```ts
// src/server/stockFifo.ts — ühe materjali FIFO arvutus kõigis ladudes (puhas funktsioon).
// Liikumised käiakse kuupäeva järjekorras läbi; sama päeva sees enne sissetulek, siis ülekanne, siis väljaminek.
// Väljaminek võtab lao vanimast partiist; partiide puudumisel tekib võlg, mille järgmine sissetulek katab
// (võla read saavad selle partii hinna). Ülekanne viib võetud partiid koos hinnaga sihtlattu.
export type MovementKind = 'IN' | 'TRANSFER' | 'OUT';

export interface Movement {
  ref: string; // nt 'doc:<reaId>' või 'entry:<reaId>'
  date: string; // YYYY-MM-DD
  seq: number; // sama päeva ja liigi sees stabiilne järjekord
  kind: MovementKind;
  warehouseId: string; // IN: sihtladu; TRANSFER ja OUT: lähteladu
  toWarehouseId?: string; // TRANSFER: sihtladu
  quantity: number; // laoühikus, > 0
  amount?: number; // IN: rea summa
}

export interface OutResult {
  cost: number; // hinnatud osa maksumus
  unpricedQty: number; // hindamata kogus (võlg või hindamata partii)
  shortageQty: number; // ainult TRANSFER: kogus, mida lähtelaos hinnaga partiina polnud
}

export interface WarehouseStock {
  qty: number;
  value: number;
  unpricedQty: number;
}

export interface ReplayResult {
  outs: Map<string, OutResult>;
  stock: Map<string, WarehouseStock>;
}

interface Lot { qty: number; unitCost: number | null }
interface Debt { ref: string; qty: number }

const EPS = 1e-9;
const KIND_ORDER: Record<MovementKind, number> = { IN: 0, TRANSFER: 1, OUT: 2 };
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const roundQ = (n: number) => Math.round(n * 1e6) / 1e6;

export function sortMovements(movements: Movement[]): Movement[] {
  return [...movements].sort(
    (a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.seq - b.seq
  );
}

export function fifoReplay(movements: Movement[]): ReplayResult {
  const lots = new Map<string, Lot[]>();
  const debts = new Map<string, Debt[]>();
  const outs = new Map<string, OutResult>();
  const lotsOf = (w: string) => lots.get(w) ?? (lots.set(w, []), lots.get(w)!);
  const debtsOf = (w: string) => debts.get(w) ?? (debts.set(w, []), debts.get(w)!);
  const outOf = (ref: string) => outs.get(ref) ?? (outs.set(ref, { cost: 0, unpricedQty: 0, shortageQty: 0 }), outs.get(ref)!);

  // Sissetulek lattu: kõigepealt kaetakse võlg vanimast alates, ülejääk läheb partiiks
  const receive = (w: string, qty: number, unitCost: number | null) => {
    let rest = qty;
    const ds = debtsOf(w);
    while (rest > EPS && ds.length) {
      const d = ds[0];
      const take = Math.min(d.qty, rest);
      if (unitCost !== null) {
        const o = outOf(d.ref);
        o.cost += take * unitCost;
        o.unpricedQty -= take;
      }
      d.qty -= take;
      rest -= take;
      if (d.qty <= EPS) ds.shift();
    }
    if (rest > EPS) lotsOf(w).push({ qty: rest, unitCost });
  };

  // Väljaminek laost: võetud tükid (koos hinnaga) ja puudujääk, mis jääb võlaks
  const take = (w: string, qty: number, ref: string): { pieces: Lot[]; missing: number } => {
    const ls = lotsOf(w);
    const pieces: Lot[] = [];
    let rest = qty;
    while (rest > EPS && ls.length) {
      const l = ls[0];
      const t = Math.min(l.qty, rest);
      pieces.push({ qty: t, unitCost: l.unitCost });
      l.qty -= t;
      rest -= t;
      if (l.qty <= EPS) ls.shift();
    }
    if (rest > EPS) debtsOf(w).push({ ref, qty: rest });
    return { pieces, missing: rest > EPS ? rest : 0 };
  };

  for (const m of sortMovements(movements)) {
    if (m.kind === 'IN') {
      receive(m.warehouseId, m.quantity, m.quantity > 0 ? (m.amount ?? 0) / m.quantity : 0);
      continue;
    }
    const o = outOf(m.ref);
    const { pieces, missing } = take(m.warehouseId, m.quantity, m.ref);
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
  }

  const stock = new Map<string, WarehouseStock>();
  for (const w of new Set([...lots.keys(), ...debts.keys()])) {
    const ls = lots.get(w) ?? [];
    const ds = debts.get(w) ?? [];
    const lotQty = ls.reduce((s, l) => s + l.qty, 0);
    const debtQty = ds.reduce((s, d) => s + d.qty, 0);
    stock.set(w, {
      qty: roundQ(lotQty - debtQty) + 0,
      value: round2(ls.reduce((s, l) => s + (l.unitCost === null ? 0 : l.qty * l.unitCost), 0)) + 0,
      unpricedQty: roundQ(debtQty + ls.filter((l) => l.unitCost === null).reduce((s, l) => s + l.qty, 0)) + 0
    });
  }
  for (const o of outs.values()) {
    o.cost = round2(o.cost) + 0;
    o.unpricedQty = roundQ(o.unpricedQty) + 0;
    o.shortageQty = roundQ(o.shortageQty) + 0;
  }
  return { outs, stock };
}
```

(`+ 0` muudab `-0` nulliks, et `toEqual` ei kukuks.)

- [ ] **Step 8: Käivita, veendu et läbib**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stockFifo.test.ts src/services/units.test.ts'`
Expected: PASS (kõik testid)

- [ ] **Step 9: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/services/units.ts src/services/units.test.ts src/server/stockFifo.ts src/server/stockFifo.test.ts && git commit -m "Laoarvestus: ühikute teisendus ja FIFO arvutus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 2: Andmemudel, RLS ja tarnija roll

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `scripts/tenancy/02-rls.sql`
- Modify: `src/types/party.ts`

**Interfaces:**
- Produces: Prisma mudelid `Warehouse`, `StockDocument`, `StockDocumentLine`, `MaterialStock`; enumid `StockDocumentKind` (`RECEIPT|WRITE_OFF|TRANSFER`), `WriteOffReason` (`SPOILED|INVENTORY|OTHER`); `WorkEntry.warehouseId`; `Material.stockIssueCount`; `PartyRole.SUPPLIER`; klient `PartyRole` `'SUPPLIER'`.

- [ ] **Step 1: Varukoopia** (käsk Global Constraints'ist). Expected: väljastab uue `.dump` faili nime.

- [ ] **Step 2: Lisa `PartyRole` enumi `SUPPLIER`**

`prisma/schema.prisma`, `enum PartyRole`:

```prisma
enum PartyRole {
  LANDOWNER
  DRIVER // kuvatakse "Töötaja"
  OPERATOR
  SUPPLIER // "Tarnija" (laokannete arvele võtmine)
  OTHER // "Muu seotud isik" (täpsustus märkustes)
}
```

- [ ] **Step 3: Lisa laoarvestuse mudelid** `model WorkEntryLine { … }` järele (enne sektsiooni „10. KASUTAJAD“):

```prisma
// ============================================================================
// 9b. LAOARVESTUS
// Laod → laokanded (arvele võtmine, mahakandmine, ülekanne) + põllutöö kande materjaliread.
// Laoseis ja FIFO hinnad arvutatakse liikumistest (src/server/stock.ts); material_stock on koond.
// ============================================================================

enum StockDocumentKind {
  RECEIPT // arvele võtmine
  WRITE_OFF // mahakandmine
  TRANSFER // ladudevaheline ülekanne
}

enum WriteOffReason {
  SPOILED // riknenud
  INVENTORY // inventuuri vahe
  OTHER // muu (täpsustus märkuses)
}

// Ladu; ettevõttel täpselt üks põhiladu (isDefault), tagab rakendus (src/server/stock.ts)
model Warehouse {
  id        String   @id @default(cuid())
  tenantId  String   @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  name      String
  isDefault Boolean  @default(false) // põhiladu: põllutöö kanded vaikimisi, PRIA import
  isActive  Boolean  @default(true)
  poiId     String?  @unique // asukoht kaardil (huvipunkt)
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String? // looja kasutajatunnus (täidetakse automaatselt)
  updatedBy String? // viimase muutja kasutajatunnus (täidetakse automaatselt)

  poi           PointOfInterest? @relation(fields: [poiId], references: [id], onDelete: SetNull)
  documentsFrom StockDocument[]  @relation("StockDocFrom")
  documentsTo   StockDocument[]  @relation("StockDocTo")
  entries       WorkEntry[]
  stock         MaterialStock[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("warehouses")
}

// Laokanne: arvele võtmine, mahakandmine või ülekanne
model StockDocument {
  id             String            @id @default(cuid())
  tenantId       String            @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  kind           StockDocumentKind
  date           DateTime
  warehouseId    String // RECEIPT: sihtladu; WRITE_OFF ja TRANSFER: lähteladu
  toWarehouseId  String? // ainult TRANSFER: sihtladu
  supplierId     String? // ainult RECEIPT: seotud isik rolliga Tarnija
  documentNo     String? // arve / saatelehe number
  writeOffReason WriteOffReason? // ainult WRITE_OFF
  notes          String?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  createdBy      String? // looja kasutajatunnus (täidetakse automaatselt)
  updatedBy      String? // viimase muutja kasutajatunnus (täidetakse automaatselt)

  warehouse   Warehouse           @relation("StockDocFrom", fields: [warehouseId], references: [id], onDelete: Restrict)
  toWarehouse Warehouse?          @relation("StockDocTo", fields: [toWarehouseId], references: [id], onDelete: Restrict)
  supplier    RelatedParty?       @relation("StockDocSupplier", fields: [supplierId], references: [id], onDelete: SetNull)
  lines       StockDocumentLine[]

  @@index([date])
  @@index([warehouseId])
  @@index([toWarehouseId])
  @@index([supplierId])
  @@index([tenantId])
  @@map("stock_documents")
}

model StockDocumentLine {
  id           String   @id @default(cuid())
  tenantId     String   @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  documentId   String
  materialId   String
  quantity     Float // laoühikus, > 0
  amount       Decimal? @db.Decimal(12, 2) // RECEIPT: rea summa km-ta
  fifoCost     Decimal? @db.Decimal(12, 2) // WRITE_OFF, TRANSFER: arvutatud maksumus; null = (osaliselt) hindamata
  shortageQty  Float? // TRANSFER: kogus, mida lähtelaos hinnaga kaubana polnud (probleem)
  sortOrder    Int      @default(0)

  document StockDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  material Material      @relation(fields: [materialId], references: [id], onDelete: Restrict)

  @@index([documentId])
  @@index([materialId])
  @@index([tenantId])
  @@map("stock_document_lines")
}

// Laoseisu koond materjali ja lao kaupa; kirjutab ainult ümberarvutus
model MaterialStock {
  tenantId    String  @default(dbgenerated("current_setting('app.tenant_id')")) @map("tenant_id") // Ettevõte; täitub päringu kontekstist
  materialId  String
  warehouseId String
  qty         Float   @default(0) // võib olla negatiivne
  value       Decimal @default(0) @db.Decimal(12, 2) // hinnatud partiide jääk
  unpricedQty Float   @default(0) // hindamata kogus (võlg või hindamata partii)

  material  Material  @relation(fields: [materialId], references: [id], onDelete: Cascade)
  warehouse Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)

  @@id([materialId, warehouseId])
  @@index([warehouseId])
  @@index([tenantId])
  @@map("material_stock")
}
```

- [ ] **Step 4: Lisa olemasolevatele mudelitele väljad ja vastasseosed**

`model Material` — väli `notes` järele ja relatsioonide hulka:

```prisma
  stockIssueCount Int @default(0) // põllutöö kanderead, mida ei saa laoühikusse teisendada (arvestusest väljas)
```
```prisma
  stockLines     StockDocumentLine[]
  stock          MaterialStock[]
```

`model WorkEntry` — väli `harvestBunkers` järele, relatsioon `implement` järele:

```prisma
  warehouseId          String? // ladu, kust kande materjalid võetakse; tühi = põhiladu
```
```prisma
  warehouse          Warehouse?      @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
```
ja indeks `@@index([warehouseId])`.

`model RelatedParty` — relatsioonide hulka:

```prisma
  stockDocuments StockDocument[] @relation("StockDocSupplier")
```

`model PointOfInterest` — relatsioonide hulka:

```prisma
  warehouse Warehouse?
```

- [ ] **Step 5: Lisa tabelid RLS loendisse** `scripts/tenancy/02-rls.sql`, loendi viimane rida:

```sql
    'support_grants','support_access_log','warehouses','stock_documents','stock_document_lines','material_stock'
```

- [ ] **Step 6: Rakenda skeem, RLS ja FK trigerid**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && npx prisma db push && npx prisma generate && psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql && MIGRATE_DATABASE_URL="$MIGRATE_DATABASE_URL" npx tsx scripts/tenancy/05-tenant-fk-triggers.mts'
```
Expected: „Your database is now in sync“, `DO`, `GRANT`… ilma vigadeta. Kui `db push` küsib andmekao kinnitust, peatu ja küsi kasutajalt.

- [ ] **Step 7: Kliendi rolli silt** `src/types/party.ts`:

```ts
export type PartyRole =
  | 'LANDOWNER'      // Maaomanik / Rendileandja
  | 'DRIVER'         // Töötaja (sh masinajuht)
  | 'OPERATOR'       // Põllu operaator / harija
  | 'SUPPLIER'       // Tarnija (laokannete arvele võtmine)
  | 'OTHER';         // Muu seotud isik (täpsustus märkustes)
```
ja `PARTY_ROLE_CONFIG`-isse `OPERATOR` järele:

```ts
  SUPPLIER: {
    label: 'Tarnija',
    icon: '🚚',
    color: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.12)'
  },
```

Kontrolli: `grep -n "PARTY_ROLE_CONFIG\|'OTHER'" src/components/RelatedPartiesModal.tsx` — kui rollide valik on kõvakodeeritud loend, lisa sinna `'SUPPLIER'`.

- [ ] **Step 8: Tüübikontroll ja ettevõtete eralduse test**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/server/tenantIsolation.test.ts'`
Expected: PASS (uued tabelid on RLS-iga ja trigeritega kaetud)

- [ ] **Step 9: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add prisma/schema.prisma scripts/tenancy/02-rls.sql src/types/party.ts src/components/RelatedPartiesModal.tsx && git commit -m "Laoarvestus: laod, laokanded ja laoseisu koond andmemudelis; tarnija roll

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 3: Laoseisu ümberarvutus (`src/server/stock.ts`)

**Files:**
- Create: `src/server/stock.ts`
- Create: `src/server/stock.test.ts`

**Interfaces:**
- Consumes: `fifoReplay`, `Movement` (Task 1), `convertQty` (Task 1), Prisma mudelid (Task 2), `TxClient`, `tenantTransaction` failist `./db.ts`.
- Produces:
  - `class StockValidationError extends Error`
  - `getDefaultWarehouseId(tx: TxClient): Promise<string>`
  - `loadMovements(tx: TxClient, materialIds: string[]): Promise<MaterialMovements[]>` kus `interface MaterialMovements { materialId: string; unit: string; movements: Movement[]; entryLines: { id: string; ref: string; quantity: number }[]; docLines: { id: string; ref: string; kind: 'RECEIPT'|'WRITE_OFF'|'TRANSFER' }[]; issueEntryLineIds: string[] }`
  - `recomputeMaterialStock(tx: TxClient, materialIds: string[]): Promise<void>`
  - `recomputeAllMaterialStock(tx: TxClient): Promise<void>`
  - `transferShortageKeys(tx: TxClient, materialIds: string[]): Promise<Set<string>>` (võti `${documentId}:${materialId}`)
  - Viited: kanderida `entry:<lineId>`, laokande rida `doc:<lineId>`.

- [ ] **Step 1: Kirjuta integratsioonitest** `src/server/stock.test.ts`

```ts
// Laoseisu ümberarvutus ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { getDefaultWarehouseId, recomputeMaterialStock, transferShortageKeys } from './stock';

const T = `test-tenant-stock-${process.pid}`;
const run = <R>(fn: () => Promise<R>) => runAsTenant(T, fn);
const d = (s: string) => new Date(`${s}T00:00:00Z`);
let materialId = '';
let mainWh = '';
let otherWh = '';
let entryLineId = '';

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test ladu' } });
  await run(async () => {
    materialId = (await prisma.material.create({ data: { name: 'Testväetis', category: 'FERTILIZER', unit: 'kg' } })).id;
    mainWh = await tenantTransaction((tx) => getDefaultWarehouseId(tx));
    otherWh = (await prisma.warehouse.create({ data: { name: 'Teine ladu' } })).id;
    // Põllutöö kanne: hooaeg → põld → töö → kanne 1500 g... ja 200 kg
    const field = await prisma.field.create({ data: { num: '1', name: 'Testpõld', fieldCode: 'T-1', areaHa: 1 } as any });
    const fs = await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 1 } as any });
    const wt = await prisma.workType.create({ data: { name: 'Testväetamine', phase: 'CARE' } });
    const fw = await prisma.fieldWork.create({ data: { fieldSeasonId: fs.id, workTypeId: wt.id, phase: 'CARE' } });
    const entry = await prisma.workEntry.create({
      data: {
        fieldWorkId: fw.id, date: d('2026-05-10'),
        lines: { create: [
          { kind: 'MATERIAL', materialId, label: 'Testväetis', quantity: 200, unit: 'kg' },
          { kind: 'MATERIAL', materialId, label: 'Testväetis', quantity: 3, unit: 'l' }
        ] }
      },
      include: { lines: true }
    });
    entryLineId = entry.lines.find((l) => l.unit === 'kg')!.id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.stockDocument.deleteMany({});
    await prisma.materialStock.deleteMany({});
    await prisma.material.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

describe('laoseisu ümberarvutus', () => {
  it('põhiladu luuakse üks kord', async () => {
    const again = await run(() => tenantTransaction((tx) => getDefaultWarehouseId(tx)));
    expect(again).toBe(mainWh);
    expect(await run(() => prisma.warehouse.count({ where: { isDefault: true } }))).toBe(1);
  });

  it('ilma arvele võtmiseta on kanne miinuses ja hindamata; teisendamatu rida on probleem', async () => {
    await run(() => tenantTransaction((tx) => recomputeMaterialStock(tx, [materialId])));
    const s = await run(() => prisma.materialStock.findUnique({ where: { materialId_warehouseId: { materialId, warehouseId: mainWh } } }));
    expect(s?.qty).toBe(-200);
    expect(s?.unpricedQty).toBe(200);
    const line = await run(() => prisma.workEntryLine.findUnique({ where: { id: entryLineId } }));
    expect(line?.unitPrice).toBeNull();
    const m = await run(() => prisma.material.findUnique({ where: { id: materialId } }));
    expect(m?.stockIssueCount).toBe(1);
  });

  it('tagantjärele arvele võtmine annab kandereale FIFO hinna', async () => {
    await run(async () => {
      await prisma.stockDocument.create({
        data: { kind: 'RECEIPT', date: d('2026-04-01'), warehouseId: mainWh, lines: { create: [{ materialId, quantity: 500, amount: 250 }] } }
      });
      await tenantTransaction((tx) => recomputeMaterialStock(tx, [materialId]));
    });
    const line = await run(() => prisma.workEntryLine.findUnique({ where: { id: entryLineId } }));
    expect(Number(line?.unitPrice)).toBe(0.5);
    const s = await run(() => prisma.materialStock.findUnique({ where: { materialId_warehouseId: { materialId, warehouseId: mainWh } } }));
    expect(s?.qty).toBe(300);
    expect(Number(s?.value)).toBe(150);
  });

  it('ülekanne üle saadaoleva annab puudujäägi võtme', async () => {
    await run(async () => {
      await prisma.stockDocument.create({
        data: { kind: 'TRANSFER', date: d('2026-06-01'), warehouseId: mainWh, toWarehouseId: otherWh, lines: { create: [{ materialId, quantity: 400 }] } }
      });
      await tenantTransaction((tx) => recomputeMaterialStock(tx, [materialId]));
    });
    const keys = await run(() => tenantTransaction((tx) => transferShortageKeys(tx, [materialId])));
    expect(keys.size).toBe(1);
    const line = await run(() => prisma.stockDocumentLine.findFirst({ where: { document: { kind: 'TRANSFER' } } }));
    expect(line?.shortageQty).toBe(100);
    expect(line?.fifoCost).toBeNull();
  });
});
```

Märkus: kui `Field`/`FieldSeason` nõuavad teisi kohustuslikke välju, vaata `prisma/schema.prisma` mudeleid ja täienda `data` objekte (testi eesmärk on ainult üks kanne).

- [ ] **Step 2: Käivita, veendu et kukub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stock.test.ts'`
Expected: FAIL (moodulit `./stock` ei leita)

- [ ] **Step 3: Kirjuta `src/server/stock.ts`**

```ts
// src/server/stock.ts — laoseisu ümberarvutus: loeb materjali liikumised (laokanded + põllutöö kande
// materjaliread), käivitab FIFO (stockFifo.ts) ja kirjutab tulemuse kanderidade ühikuhinnaks,
// laokande ridade maksumuseks ja koondtabelisse material_stock. Kutsu samas tehingus pärast iga
// liikumist muutvat salvestust.
import type { TxClient } from './db.ts';
import { fifoReplay, type Movement } from './stockFifo.ts';
import { convertQty } from '../services/units.ts';

export class StockValidationError extends Error {}

const DEFAULT_WAREHOUSE_NAME = 'Põhiladu';
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** Põhilao id; puudumisel luuakse "Põhiladu" (uus ettevõte, esimene kasutus). */
export async function getDefaultWarehouseId(tx: TxClient): Promise<string> {
  const found = await tx.warehouse.findFirst({ where: { isDefault: true }, select: { id: true } });
  if (found) return found.id;
  const byName = await tx.warehouse.findFirst({ where: { name: DEFAULT_WAREHOUSE_NAME }, select: { id: true } });
  if (byName) {
    await tx.warehouse.update({ where: { id: byName.id }, data: { isDefault: true, isActive: true } });
    return byName.id;
  }
  return (await tx.warehouse.create({ data: { name: DEFAULT_WAREHOUSE_NAME, isDefault: true } })).id;
}

export interface MaterialMovements {
  materialId: string;
  unit: string;
  movements: Movement[];
  entryLines: { id: string; ref: string; quantity: number }[];
  docLines: { id: string; ref: string; kind: 'RECEIPT' | 'WRITE_OFF' | 'TRANSFER' }[];
  issueEntryLineIds: string[];
}

export async function loadMovements(tx: TxClient, materialIds: string[]): Promise<MaterialMovements[]> {
  if (!materialIds.length) return [];
  const defaultWh = await getDefaultWarehouseId(tx);
  const [materials, docLines, entryLines] = await Promise.all([
    tx.material.findMany({ where: { id: { in: materialIds } }, select: { id: true, unit: true } }),
    tx.stockDocumentLine.findMany({
      where: { materialId: { in: materialIds } },
      select: {
        id: true, materialId: true, quantity: true, amount: true, sortOrder: true,
        document: { select: { kind: true, date: true, warehouseId: true, toWarehouseId: true, createdAt: true } }
      }
    }),
    tx.workEntryLine.findMany({
      where: { kind: 'MATERIAL', materialId: { in: materialIds } },
      select: { id: true, materialId: true, quantity: true, unit: true, sortOrder: true, entry: { select: { date: true, warehouseId: true, createdAt: true } } }
    })
  ]);
  return materials.map((m) => {
    const out: MaterialMovements = { materialId: m.id, unit: m.unit, movements: [], entryLines: [], docLines: [], issueEntryLineIds: [] };
    for (const l of docLines.filter((x) => x.materialId === m.id)) {
      const ref = `doc:${l.id}`;
      const doc = l.document;
      out.docLines.push({ id: l.id, ref, kind: doc.kind });
      out.movements.push({
        ref, date: isoDay(doc.date), seq: doc.createdAt.getTime() * 1000 + l.sortOrder,
        kind: doc.kind === 'RECEIPT' ? 'IN' : doc.kind === 'TRANSFER' ? 'TRANSFER' : 'OUT',
        warehouseId: doc.warehouseId, toWarehouseId: doc.toWarehouseId ?? undefined,
        quantity: l.quantity, amount: l.amount === null ? undefined : Number(l.amount)
      });
    }
    for (const l of entryLines.filter((x) => x.materialId === m.id)) {
      const qty = convertQty(l.quantity, l.unit, m.unit);
      if (qty === null) {
        out.issueEntryLineIds.push(l.id);
        continue;
      }
      if (qty <= 0) continue;
      const ref = `entry:${l.id}`;
      out.entryLines.push({ id: l.id, ref, quantity: l.quantity });
      out.movements.push({
        ref, date: isoDay(l.entry.date), seq: l.entry.createdAt.getTime() * 1000 + l.sortOrder,
        kind: 'OUT', warehouseId: l.entry.warehouseId ?? defaultWh, quantity: qty
      });
    }
    return out;
  });
}

export async function recomputeMaterialStock(tx: TxClient, materialIds: string[]): Promise<void> {
  const ids = [...new Set(materialIds.filter(Boolean))];
  for (const mm of await loadMovements(tx, ids)) {
    const { outs, stock } = fifoReplay(mm.movements);

    // Põllutöö kanderead: ühikuhind kanderea ühikus; hindamata või teisendamatu → null
    const current = new Map(
      (await tx.workEntryLine.findMany({ where: { kind: 'MATERIAL', materialId: mm.materialId }, select: { id: true, unitPrice: true } }))
        .map((l) => [l.id, l.unitPrice === null ? null : Number(l.unitPrice)])
    );
    const wanted = new Map<string, number | null>(mm.issueEntryLineIds.map((id) => [id, null]));
    for (const l of mm.entryLines) {
      const o = outs.get(l.ref);
      wanted.set(l.id, o && o.unpricedQty === 0 && l.quantity > 0 ? round4(o.cost / l.quantity) : null);
    }
    for (const [id, price] of wanted) {
      if (current.get(id) !== price) await tx.workEntryLine.update({ where: { id }, data: { unitPrice: price } });
    }

    // Laokande read: maksumus ja ülekande puudujääk
    for (const l of mm.docLines) {
      if (l.kind === 'RECEIPT') continue;
      const o = outs.get(l.ref);
      await tx.stockDocumentLine.update({
        where: { id: l.id },
        data: {
          fifoCost: o && o.unpricedQty === 0 ? o.cost : null,
          shortageQty: l.kind === 'TRANSFER' && o && o.shortageQty > 0 ? o.shortageQty : null
        }
      });
    }

    await tx.materialStock.deleteMany({ where: { materialId: mm.materialId } });
    const rows = [...stock].map(([warehouseId, s]) => ({ materialId: mm.materialId, warehouseId, qty: s.qty, value: s.value, unpricedQty: s.unpricedQty }));
    if (rows.length) await tx.materialStock.createMany({ data: rows });
    await tx.material.update({ where: { id: mm.materialId }, data: { stockIssueCount: mm.issueEntryLineIds.length } });
  }
}

export async function recomputeAllMaterialStock(tx: TxClient): Promise<void> {
  const ids = (await tx.material.findMany({ select: { id: true } })).map((m) => m.id);
  await recomputeMaterialStock(tx, ids);
}

/** Ülekande read, millel on puudujääk (võti documentId:materialId) — salvestuse eel ja järel võrdlemiseks. */
export async function transferShortageKeys(tx: TxClient, materialIds: string[]): Promise<Set<string>> {
  const rows = await tx.stockDocumentLine.findMany({
    where: { materialId: { in: materialIds }, shortageQty: { gt: 0 }, document: { kind: 'TRANSFER' } },
    select: { documentId: true, materialId: true }
  });
  return new Set(rows.map((r) => `${r.documentId}:${r.materialId}`));
}
```

- [ ] **Step 4: Käivita, veendu et läbib**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stock.test.ts && npx tsc --noEmit -p tsconfig.app.json'`
Expected: PASS (4 testi), tüübivigu pole

- [ ] **Step 5: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/stock.ts src/server/stock.test.ts && git commit -m "Laoarvestus: laoseisu ja FIFO hindade ümberarvutus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 4: Põllutöö kanded, PRIA import, finants ja materjalide API laoarvestusega

**Files:**
- Modify: `src/server/fieldWorks.ts` (kande sisend/DTO, `/api/work-entries*`, `/api/finance/entries/:id` PATCH, `/api/materials*`)
- Modify: `src/server/apiHandler.ts` (`/api/field-book/import`)
- Modify: `src/server/stock.test.ts`

**Interfaces:**
- Consumes: `recomputeMaterialStock`, `recomputeAllMaterialStock`, `getDefaultWarehouseId` (Task 3); `convertQty` (Task 1).
- Produces:
  - Kande sisend ja DTO väli `warehouseId: string | null`.
  - `GET /api/materials?year=&warehouseId=` lisaväljad `stockQty: number`, `unpricedQty: number`, `stockIssueCount: number`, finantsõigusega `stockValue: number`.
  - `POST /api/materials` võtab vastu `confirmUnitChange?: boolean`; vastus `409 { error, needsConfirm: true }`, kui uude ühikusse ei saa kanderidu teisendada.

- [ ] **Step 1: Kirjuta test** — lisa `src/server/stock.test.ts` lõppu:

```ts
import { materialStockSummary } from './stock';

describe('materjalide laoseisu kokkuvõte', () => {
  it('summeerib laod ja filtreerib ühe lao', async () => {
    const all = await run(() => tenantTransaction((tx) => materialStockSummary(tx, null)));
    const one = await run(() => tenantTransaction((tx) => materialStockSummary(tx, otherWh)));
    const a = all.get(materialId)!;
    const o = one.get(materialId)!;
    expect(a.qty).toBe(300); // 500 − 200; ülekanne laosiseselt neutraalne
    expect(o.qty).toBe(400);
  });
});
```

- [ ] **Step 2: Käivita, veendu et kukub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stock.test.ts'`
Expected: FAIL (`materialStockSummary` puudub)

- [ ] **Step 3: Lisa `src/server/stock.ts` lõppu**

```ts
export interface StockSummary { qty: number; value: number; unpricedQty: number }

/** Materjalide laoseis: valitud lao või kõigi ladude summa. */
export async function materialStockSummary(tx: TxClient, warehouseId: string | null): Promise<Map<string, StockSummary>> {
  const rows = await tx.materialStock.findMany({ where: warehouseId ? { warehouseId } : {} });
  const out = new Map<string, StockSummary>();
  for (const r of rows) {
    const s = out.get(r.materialId) ?? { qty: 0, value: 0, unpricedQty: 0 };
    s.qty = Math.round((s.qty + r.qty) * 1e6) / 1e6;
    s.value = Math.round((s.value + Number(r.value)) * 100) / 100;
    s.unpricedQty = Math.round((s.unpricedQty + r.unpricedQty) * 1e6) / 1e6;
    out.set(r.materialId, s);
  }
  return out;
}
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stock.test.ts'` — Expected: PASS

- [ ] **Step 4: Kande ladu sisendis ja DTO-s** (`src/server/fieldWorks.ts`)

Impordi faili päises:

```ts
import { recomputeMaterialStock, materialStockSummary, getDefaultWarehouseId } from './stock.ts';
import { convertQty } from '../services/units.ts';
```

`resolveEntryInput` — `Promise.all` loendisse lisa lao kontroll ja `data` objekti väli:

```ts
  const warehouseIdIn = text(body?.warehouseId, 64);
  const warehouse = warehouseIdIn
    ? await prisma.warehouse.findFirst({ where: { id: warehouseIdIn, isActive: true }, select: { id: true } })
    : null;
```
```ts
      warehouseId: warehouse?.id ?? null,
```

`entryDto` — `implementName` järele:

```ts
    warehouseId: e.warehouseId ?? null,
```

- [ ] **Step 5: Kande loomine/muutmine/kustutamine käivitavad ümberarvutuse** (`src/server/fieldWorks.ts`)

Abifunktsioon `ENTRY_INCLUDE` järele:

```ts
const materialIdsOf = (lines: { kind?: string; materialId: string | null }[]) =>
  lines.filter((l) => (l.kind ?? 'MATERIAL') === 'MATERIAL' && l.materialId).map((l) => l.materialId as string);
```

`POST /api/work-entries` — asenda `const saved = await prisma.workEntry.create({ … });` ja järgnev `syncFieldWorkStatus`:

```ts
    const saved = await tenantTransaction(async (tx) => {
      const created = await tx.workEntry.create({
        data: { ...data, date: data.date!, fieldWorkId: work.id, createdById: userId, lines: { create: drafts } }
      });
      await recomputeMaterialStock(tx, materialIdsOf(drafts));
      return tx.workEntry.findUniqueOrThrow({ where: { id: created.id }, include: ENTRY_INCLUDE });
    });
    await syncFieldWorkStatus(work.id, b?.finish === true, userId, prisma);
```

`PUT /api/work-entries/:id` — tehingu sees `tx.workEntry.update(...)` järel enne `return`:

```ts
      const updated = await tx.workEntry.update({
        where: { id },
        data: {
          ...data,
          date: data.date!,
          financeStatus: merged.financeStatus,
          lines: { create: merged.lines.map((l) => ({ ...l, unitPrice: l.unitPrice })) }
        }
      });
      await recomputeMaterialStock(tx, [...materialIdsOf(old.lines), ...materialIdsOf(merged.lines)]);
      return tx.workEntry.findUniqueOrThrow({ where: { id: updated.id }, include: ENTRY_INCLUDE });
```

`DELETE /api/work-entries/:id` — `findUnique` laeb read ja kustutamine käib tehingus:

```ts
    const e = await prisma.workEntry.findUnique({ where: { id }, include: { lines: { select: { kind: true, materialId: true } } } });
```
```ts
    await tenantTransaction(async (tx) => {
      await tx.workEntry.delete({ where: { id } });
      await recomputeMaterialStock(tx, materialIdsOf(e.lines));
    });
```

- [ ] **Step 6: Finants ei muuda materjaliridade hinda** — `PATCH /api/finance/entries/:id`:

```ts
      // Materjaliridade hind tuleb laost (FIFO), käsitsi seda ei muudeta
      const lines = entry.lines.map((l) => ({
        ...l,
        unitPrice: l.kind !== 'MATERIAL' && l.id in prices ? num(prices[l.id]) : decimalToNumber(l.unitPrice)
      }));
```
ja kinnitamise vea tekst:

```ts
        json(res, { error: 'Igal real peab olema ühiku kulu. Materjali hind tuleb laost — hindamata materjal ootab arvele võtmist.' }, 400);
```

- [ ] **Step 7: Materjalide API** — `GET /api/materials`:

```ts
    const warehouseId = text(url.searchParams.get('warehouseId'), 64);
    const stock = await tenantTransaction((tx) => materialStockSummary(tx, warehouseId));
    const finance = canSeeFinance(req);
```
ja `rows.map` objekti lõppu:

```ts
        stockQty: stock.get(m.id)?.qty ?? 0,
        unpricedQty: stock.get(m.id)?.unpricedQty ?? 0,
        stockIssueCount: m.stockIssueCount,
        ...(finance ? { stockValue: stock.get(m.id)?.value ?? 0 } : {})
```

`POST /api/materials` — enne `try`:

```ts
    const id = text(b?.id, 64);
    const old = id ? await prisma.material.findUnique({ where: { id }, select: { unit: true } }) : null;
    const unitChanged = !!old && old.unit.trim().toLowerCase() !== unit.trim().toLowerCase();
    if (unitChanged) {
      const docLines = await prisma.stockDocumentLine.count({ where: { materialId: id! } });
      if (docLines) {
        json(res, { error: `Materjalil on ${docLines} laokande rida; laoühikut ei saa muuta.` }, 409);
        return true;
      }
      const lines = await prisma.workEntryLine.findMany({ where: { materialId: id!, kind: 'MATERIAL' }, select: { unit: true } });
      const bad = lines.filter((l) => convertQty(1, l.unit, unit) === null).length;
      if (bad && b?.confirmUnitChange !== true) {
        json(res, { error: `${bad} kannet ei saa ühikusse "${unit}" teisendada ja need jäävad laoarvestusest välja.`, needsConfirm: true }, 409);
        return true;
      }
    }
```
`try` plokis kasuta juba arvutatud `id`-d ja salvesta tehingus koos ümberarvutusega:

```ts
      const saved = await tenantTransaction(async (tx) => {
        const s = id ? await tx.material.update({ where: { id }, data }) : await tx.material.create({ data });
        if (unitChanged) await recomputeMaterialStock(tx, [s.id]);
        return s;
      });
      json(res, saved);
```

`DELETE /api/materials/:id` — lisa loendusse laokande read:

```ts
    const [usedInEntries, usedInPlans, usedInStock] = await Promise.all([
      prisma.workEntryLine.count({ where: { materialId: id } }),
      prisma.fieldWorkLine.count({ where: { materialId: id } }),
      prisma.stockDocumentLine.count({ where: { materialId: id } })
    ]);
    if (usedInEntries || usedInPlans || usedInStock) {
      const where = [
        usedInEntries ? `${usedInEntries} kandes` : null,
        usedInPlans ? `${usedInPlans} töö plaanis` : null,
        usedInStock ? `${usedInStock} laokandes` : null
      ].filter(Boolean).join(' ja ');
```

- [ ] **Step 8: PRIA import arvutab laoseisu ümber** (`src/server/apiHandler.ts`, `/api/field-book/import`)

Impordi: `import { recomputeAllMaterialStock } from './stock.ts';`
Tehingu sees enne `return { imported, … }`:

```ts
          // Import lisab materjaliga kandeid → laoseis ja FIFO hinnad uuesti
          if (entriesAdded + created > 0) await recomputeAllMaterialStock(tx);
```

- [ ] **Step 9: Tüübikontroll ja testid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npm test'`
Expected: PASS

- [ ] **Step 10: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/fieldWorks.ts src/server/apiHandler.ts src/server/stock.ts src/server/stock.test.ts && git commit -m "Laoarvestus: põllutöö kanded ja PRIA import kannavad laost maha, materjalide laoseis API-s

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 5: Laokannete reeglid ja lao API

**Files:**
- Create: `src/server/stockRules.ts`, `src/server/stockRules.test.ts`
- Create: `src/server/stockApi.ts`
- Modify: `src/server/apiHandler.ts` (ühendus `handleFieldWorks` järel; `/api/poi` GET lao nimi)
- Modify: `src/server/stock.test.ts`

**Interfaces:**
- Consumes: Task 3 funktsioonid, `sortMovements` (Task 1).
- Produces:
  - `parseStockDocument(body: unknown): { ok: true; doc: StockDocumentInput } | { ok: false; error: string }`
  - `interface StockDocumentInput { kind: 'RECEIPT'|'WRITE_OFF'|'TRANSFER'; date: Date; warehouseId: string; toWarehouseId: string | null; supplierId: string | null; documentNo: string | null; writeOffReason: 'SPOILED'|'INVENTORY'|'OTHER' | null; notes: string | null; lines: { materialId: string; quantity: number; amount: number | null }[] }`
  - `saveStockDocument(tx, id: string | null, doc: StockDocumentInput): Promise<string>` (failis `stock.ts`; viskab `StockValidationError`)
  - `deleteStockDocument(tx, id: string): Promise<void>` (failis `stock.ts`)
  - `handleStock(req, res, pathname, method, url): Promise<boolean>`
  - HTTP: `GET /api/warehouses`; `POST /api/warehouses`; `DELETE /api/warehouses/:id`; `GET /api/stock/levels?warehouseId=`; `GET /api/stock/documents?kind=&warehouseId=&from=&to=&supplierId=`; `GET /api/stock/documents/:id`; `POST /api/stock/documents`; `PUT /api/stock/documents/:id`; `DELETE /api/stock/documents/:id`; `GET /api/stock/materials/:id/movements?warehouseId=`
  - `/api/poi` GET objektil `warehouse?: { id: string; name: string }`

- [ ] **Step 1: Kirjuta reeglite testid** `src/server/stockRules.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { parseStockDocument } from './stockRules';

const base = { date: '2026-05-01', warehouseId: 'w1', lines: [{ materialId: 'm1', quantity: '10', amount: '25,50' }] };

describe('parseStockDocument', () => {
  it('arvele võtmine: summa nõutud, koma lubatud, põhjus ja sihtladu nullitakse', () => {
    const r = parseStockDocument({ ...base, kind: 'RECEIPT', supplierId: 's1', writeOffReason: 'SPOILED', toWarehouseId: 'w2' });
    expect(r).toEqual({ ok: true, doc: expect.objectContaining({ kind: 'RECEIPT', supplierId: 's1', writeOffReason: null, toWarehouseId: null, lines: [{ materialId: 'm1', quantity: 10, amount: 25.5 }] }) });
    expect(parseStockDocument({ ...base, kind: 'RECEIPT', lines: [{ materialId: 'm1', quantity: 1 }] })).toEqual({ ok: false, error: 'Arvele võtmisel on rea summa kohustuslik' });
    expect(parseStockDocument({ ...base, kind: 'RECEIPT', lines: [{ materialId: 'm1', quantity: 1, amount: -1 }] })).toEqual({ ok: false, error: 'Summa ei tohi olla negatiivne' });
  });
  it('mahakandmine: põhjus nõutud, summa ja tarnija nullitakse', () => {
    expect(parseStockDocument({ ...base, kind: 'WRITE_OFF' })).toEqual({ ok: false, error: 'Vali mahakandmise põhjus' });
    const r = parseStockDocument({ ...base, kind: 'WRITE_OFF', writeOffReason: 'INVENTORY', supplierId: 's1' });
    expect(r).toEqual({ ok: true, doc: expect.objectContaining({ writeOffReason: 'INVENTORY', supplierId: null, lines: [{ materialId: 'm1', quantity: 10, amount: null }] }) });
  });
  it('ülekanne: sihtladu nõutud ja erinev', () => {
    expect(parseStockDocument({ ...base, kind: 'TRANSFER' })).toEqual({ ok: false, error: 'Vali sihtladu' });
    expect(parseStockDocument({ ...base, kind: 'TRANSFER', toWarehouseId: 'w1' })).toEqual({ ok: false, error: 'Lähte- ja sihtladu peavad erinema' });
    expect(parseStockDocument({ ...base, kind: 'TRANSFER', toWarehouseId: 'w2' })).toMatchObject({ ok: true });
  });
  it('üldised vead', () => {
    expect(parseStockDocument({ ...base, kind: 'X' })).toEqual({ ok: false, error: 'Vigane kande liik' });
    expect(parseStockDocument({ ...base, kind: 'RECEIPT', date: '' })).toEqual({ ok: false, error: 'Kuupäev on kohustuslik' });
    expect(parseStockDocument({ ...base, kind: 'RECEIPT', warehouseId: '' })).toEqual({ ok: false, error: 'Vali ladu' });
    expect(parseStockDocument({ ...base, kind: 'RECEIPT', lines: [] })).toEqual({ ok: false, error: 'Lisa vähemalt üks rida' });
    expect(parseStockDocument({ ...base, kind: 'WRITE_OFF', writeOffReason: 'OTHER', lines: [{ materialId: 'm1', quantity: 0 }] })).toEqual({ ok: false, error: 'Kogus peab olema suurem kui 0' });
    expect(parseStockDocument({ ...base, kind: 'WRITE_OFF', writeOffReason: 'OTHER', lines: [{ materialId: '', quantity: 1 }] })).toEqual({ ok: false, error: 'Vali igale reale materjal' });
  });
});
```

- [ ] **Step 2: Käivita, veendu et kukub**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stockRules.test.ts'`
Expected: FAIL

- [ ] **Step 3: Kirjuta `src/server/stockRules.ts`**

```ts
// src/server/stockRules.ts — laokande sisendi valideerimine (puhas funktsioon)
export type StockDocumentKind = 'RECEIPT' | 'WRITE_OFF' | 'TRANSFER';
export type WriteOffReason = 'SPOILED' | 'INVENTORY' | 'OTHER';

export interface StockDocumentInput {
  kind: StockDocumentKind;
  date: Date;
  warehouseId: string;
  toWarehouseId: string | null;
  supplierId: string | null;
  documentNo: string | null;
  writeOffReason: WriteOffReason | null;
  notes: string | null;
  lines: { materialId: string; quantity: number; amount: number | null }[];
}

const KINDS: StockDocumentKind[] = ['RECEIPT', 'WRITE_OFF', 'TRANSFER'];
const REASONS: WriteOffReason[] = ['SPOILED', 'INVENTORY', 'OTHER'];
const text = (v: unknown, max = 500): string | null => {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const dateOnly = (v: unknown): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};
const fail = (error: string) => ({ ok: false as const, error });

export function parseStockDocument(body: unknown): { ok: true; doc: StockDocumentInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, any>;
  const kind = KINDS.find((k) => k === b.kind);
  if (!kind) return fail('Vigane kande liik');
  const date = dateOnly(b.date);
  if (!date) return fail('Kuupäev on kohustuslik');
  const warehouseId = text(b.warehouseId, 64);
  if (!warehouseId) return fail('Vali ladu');
  const toWarehouseId = kind === 'TRANSFER' ? text(b.toWarehouseId, 64) : null;
  if (kind === 'TRANSFER' && !toWarehouseId) return fail('Vali sihtladu');
  if (kind === 'TRANSFER' && toWarehouseId === warehouseId) return fail('Lähte- ja sihtladu peavad erinema');
  const writeOffReason = kind === 'WRITE_OFF' ? REASONS.find((r) => r === b.writeOffReason) ?? null : null;
  if (kind === 'WRITE_OFF' && !writeOffReason) return fail('Vali mahakandmise põhjus');

  const linesIn: any[] = Array.isArray(b.lines) ? b.lines : [];
  if (!linesIn.length) return fail('Lisa vähemalt üks rida');
  const lines: StockDocumentInput['lines'] = [];
  for (const l of linesIn) {
    const materialId = text(l?.materialId, 64);
    if (!materialId) return fail('Vali igale reale materjal');
    const quantity = num(l?.quantity);
    if (quantity === null || quantity <= 0) return fail('Kogus peab olema suurem kui 0');
    let amount: number | null = null;
    if (kind === 'RECEIPT') {
      amount = num(l?.amount);
      if (amount === null) return fail('Arvele võtmisel on rea summa kohustuslik');
      if (amount < 0) return fail('Summa ei tohi olla negatiivne');
    }
    lines.push({ materialId, quantity, amount });
  }
  return {
    ok: true,
    doc: {
      kind, date, warehouseId, toWarehouseId,
      supplierId: kind === 'RECEIPT' ? text(b.supplierId, 64) : null,
      documentNo: text(b.documentNo, 80),
      writeOffReason,
      notes: text(b.notes, 2000),
      lines
    }
  };
}
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stockRules.test.ts'` — Expected: PASS

- [ ] **Step 4: Kirjuta salvestuse integratsioonitest** — lisa `src/server/stock.test.ts` lõppu:

```ts
import { saveStockDocument, deleteStockDocument, StockValidationError } from './stock';

describe('laokande salvestus', () => {
  it('ülekanne üle saadaoleva lükatakse tagasi ja midagi ei salvestu', async () => {
    const before = await run(() => prisma.stockDocument.count());
    await expect(run(() => tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'TRANSFER', date: d('2026-07-01'), warehouseId: otherWh, toWarehouseId: mainWh, supplierId: null,
      documentNo: null, writeOffReason: null, notes: null, lines: [{ materialId, quantity: 100000, amount: null }]
    })))).rejects.toBeInstanceOf(StockValidationError);
    expect(await run(() => prisma.stockDocument.count())).toBe(before);
  });

  it('mahakandmine saab FIFO maksumuse ja kustutamine taastab seisu', async () => {
    const id = await run(() => tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'WRITE_OFF', date: d('2026-04-02'), warehouseId: mainWh, toWarehouseId: null, supplierId: null,
      documentNo: null, writeOffReason: 'SPOILED', notes: null, lines: [{ materialId, quantity: 10, amount: null }]
    })));
    const line = await run(() => prisma.stockDocumentLine.findFirst({ where: { documentId: id } }));
    expect(Number(line?.fifoCost)).toBe(5);
    await run(() => tenantTransaction((tx) => deleteStockDocument(tx, id)));
    expect(await run(() => prisma.stockDocument.findUnique({ where: { id } }))).toBeNull();
  });
});
```

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stock.test.ts'` — Expected: FAIL (`saveStockDocument` puudub)

- [ ] **Step 5: Lisa `src/server/stock.ts` lõppu salvestus ja kustutamine**

```ts
import type { StockDocumentInput } from './stockRules.ts';

const fmtDay = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('.');

// Uus ülekande puudujääk (mida enne muudatust polnud) lükkab muudatuse tagasi; tehing veereb tagasi.
async function assertNoNewShortage(tx: TxClient, materialIds: string[], before: Set<string>) {
  const after = await transferShortageKeys(tx, materialIds);
  const fresh = [...after].filter((k) => !before.has(k));
  if (!fresh.length) return;
  const [documentId, materialId] = fresh[0].split(':');
  const line = await tx.stockDocumentLine.findFirst({
    where: { documentId, materialId },
    select: { quantity: true, shortageQty: true, material: { select: { name: true, unit: true } }, document: { select: { date: true, warehouse: { select: { name: true } } } } }
  });
  const available = Math.max(0, (line?.quantity ?? 0) - (line?.shortageQty ?? 0));
  throw new StockValidationError(
    `Laos "${line?.document.warehouse.name}" on ${line ? fmtDay(line.document.date) : ''} seisuga materjali "${line?.material.name}" ` +
    `ülekandeks saadaval ${available.toLocaleString('et-EE', { maximumFractionDigits: 3 })} ${line?.material.unit}.`
  );
}

export async function saveStockDocument(tx: TxClient, id: string | null, doc: StockDocumentInput): Promise<string> {
  const whIds = [doc.warehouseId, doc.toWarehouseId].filter((x): x is string => !!x);
  const whs = await tx.warehouse.findMany({ where: { id: { in: whIds } }, select: { id: true } });
  if (whs.length !== whIds.length) throw new StockValidationError('Ladu ei leitud');
  const mats = await tx.material.count({ where: { id: { in: doc.lines.map((l) => l.materialId) } } });
  if (mats !== new Set(doc.lines.map((l) => l.materialId)).size) throw new StockValidationError('Materjali ei leitud');

  const oldMaterialIds = id
    ? (await tx.stockDocumentLine.findMany({ where: { documentId: id }, select: { materialId: true } })).map((l) => l.materialId)
    : [];
  const materialIds = [...new Set([...oldMaterialIds, ...doc.lines.map((l) => l.materialId)])];
  const before = await transferShortageKeys(tx, materialIds);
  if (id) before.forEach((k) => k.startsWith(`${id}:`) && before.delete(k)); // muudetav kanne kontrollitakse uuesti

  const header = {
    kind: doc.kind, date: doc.date, warehouseId: doc.warehouseId, toWarehouseId: doc.toWarehouseId,
    supplierId: doc.supplierId, documentNo: doc.documentNo, writeOffReason: doc.writeOffReason, notes: doc.notes
  };
  const lines = doc.lines.map((l, i) => ({ materialId: l.materialId, quantity: l.quantity, amount: l.amount, sortOrder: i }));
  let docId = id;
  if (id) {
    await tx.stockDocumentLine.deleteMany({ where: { documentId: id } });
    await tx.stockDocument.update({ where: { id }, data: { ...header, lines: { create: lines } } });
  } else {
    docId = (await tx.stockDocument.create({ data: { ...header, lines: { create: lines } } })).id;
  }
  await recomputeMaterialStock(tx, materialIds);
  await assertNoNewShortage(tx, materialIds, before);
  return docId!;
}

export async function deleteStockDocument(tx: TxClient, id: string): Promise<void> {
  const materialIds = (await tx.stockDocumentLine.findMany({ where: { documentId: id }, select: { materialId: true } })).map((l) => l.materialId);
  const before = await transferShortageKeys(tx, materialIds);
  await tx.stockDocument.delete({ where: { id } });
  await recomputeMaterialStock(tx, materialIds);
  await assertNoNewShortage(tx, materialIds, before);
}
```

(`import type` rida pane faili päisesse teiste importide juurde.)

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx vitest run src/server/stock.test.ts'` — Expected: PASS

- [ ] **Step 6: Kirjuta `src/server/stockApi.ts`**

```ts
// src/server/stockApi.ts — laod, laokanded, laoseis ja laokaart (HTTP). Reeglid: stockRules.ts, stock.ts.
// Laoseisu kogust näevad kõik; raha ning ladude ja laokannete muutmine ainult finantsjuhile ja adminile.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, tenantTransaction } from './db.ts';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';
import { parseStockDocument } from './stockRules.ts';
import { getDefaultWarehouseId, loadMovements, saveStockDocument, deleteStockDocument, StockValidationError } from './stock.ts';
import { fifoReplay, sortMovements } from './stockFifo.ts';
import { workTypeDisplayName } from '../services/workTypeName.ts';

const FINANCE_FORBIDDEN = 'Laokanded ja laoväärtus on nähtavad ainult finantsjuhile ja adminile';
const canSeeFinance = (req: IncomingMessage) => {
  const u = sessionUserOf(req) as { isAdmin?: boolean; isFinanceManager?: boolean } | null;
  return u?.isAdmin === true || u?.isFinanceManager === true;
};
const text = (v: unknown, max = 500): string | null => {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
};
const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().split('T')[0] : null);
const dateOnly = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
const money = (d: unknown) => (d === null || d === undefined ? null : Number(d));

const DOC_INCLUDE = {
  warehouse: { select: { name: true } },
  toWarehouse: { select: { name: true } },
  supplier: { select: { name: true } },
  lines: { orderBy: { sortOrder: 'asc' as const }, include: { material: { select: { name: true, unit: true } } } }
};

function documentDto(d: any) {
  const lines = d.lines.map((l: any) => ({
    id: l.id, materialId: l.materialId, materialName: l.material.name, unit: l.material.unit,
    quantity: l.quantity, amount: money(l.amount), fifoCost: money(l.fifoCost), shortageQty: l.shortageQty
  }));
  const total = lines.reduce((s: number, l: any) => s + ((d.kind === 'RECEIPT' ? l.amount : l.fifoCost) ?? 0), 0);
  return {
    id: d.id, kind: d.kind, date: isoDate(d.date),
    warehouseId: d.warehouseId, warehouseName: d.warehouse.name,
    toWarehouseId: d.toWarehouseId, toWarehouseName: d.toWarehouse?.name ?? null,
    supplierId: d.supplierId, supplierName: d.supplier?.name ?? null,
    documentNo: d.documentNo, writeOffReason: d.writeOffReason, notes: d.notes,
    total: Math.round(total * 100) / 100,
    hasUnpriced: d.kind !== 'RECEIPT' && lines.some((l: any) => l.fifoCost === null),
    lines
  };
}

export async function handleStock(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL): Promise<boolean> {
  if (!pathname.startsWith('/api/warehouses') && !pathname.startsWith('/api/stock/')) return false;
  const finance = canSeeFinance(req);
  const idOf = (prefix: string) => decodeURIComponent(pathname.slice(prefix.length));
  const denyNonFinance = () => {
    if (finance) return false;
    json(res, { error: FINANCE_FORBIDDEN }, 403);
    return true;
  };

  // --- Laod ---
  if (pathname === '/api/warehouses' && method === 'GET') {
    await tenantTransaction((tx) => getDefaultWarehouseId(tx));
    const rows = await prisma.warehouse.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], include: { poi: { select: { name: true } } } });
    json(res, rows.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault, isActive: w.isActive, poiId: w.poiId, poiName: w.poi?.name ?? null, notes: w.notes })));
    return true;
  }
  if (pathname === '/api/warehouses' && method === 'POST') {
    if (denyNonFinance()) return true;
    const b = await parseBody(req);
    const id = text(b?.id, 64);
    const name = text(b?.name, 120);
    if (!name) {
      json(res, { error: 'Lao nimi on kohustuslik' }, 400);
      return true;
    }
    const isDefault = b?.isDefault === true;
    const isActive = isDefault || b?.isActive !== false;
    try {
      const saved = await tenantTransaction(async (tx) => {
        const old = id ? await tx.warehouse.findUnique({ where: { id } }) : null;
        if (old?.isDefault && !isDefault) throw new StockValidationError('Põhiladu muudetakse, kui mõni teine ladu märgitakse põhilaoks');
        if (isDefault) await tx.warehouse.updateMany({ where: { isDefault: true, ...(id ? { NOT: { id } } : {}) }, data: { isDefault: false } });
        const data = { name, isDefault, isActive, poiId: text(b?.poiId, 64), notes: text(b?.notes, 1000) };
        return id ? tx.warehouse.update({ where: { id }, data }) : tx.warehouse.create({ data });
      });
      json(res, saved);
    } catch (err: any) {
      if (err instanceof StockValidationError) json(res, { error: err.message }, 400);
      else if (err?.code === 'P2002') json(res, { error: 'Sama nime või huvipunktiga ladu on juba olemas' }, 409);
      else throw err;
    }
    return true;
  }
  if (pathname.startsWith('/api/warehouses/') && method === 'DELETE') {
    if (denyNonFinance()) return true;
    const id = idOf('/api/warehouses/');
    const w = await prisma.warehouse.findUnique({ where: { id } });
    if (!w) {
      json(res, { error: 'Ladu ei leitud' }, 404);
      return true;
    }
    const [docs, entries] = await Promise.all([
      prisma.stockDocument.count({ where: { OR: [{ warehouseId: id }, { toWarehouseId: id }] } }),
      prisma.workEntry.count({ where: { warehouseId: id } })
    ]);
    if (w.isDefault || docs || entries) {
      json(res, { error: w.isDefault ? 'Põhiladu ei saa kustutada' : `Laol on ${docs} laokannet ja ${entries} põllutöö kannet. Märgi see mitteaktiivseks.` }, 409);
      return true;
    }
    await prisma.warehouse.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }

  // --- Laoseis (kogus) kõigile ---
  if (pathname === '/api/stock/levels' && method === 'GET') {
    const warehouseId = text(url.searchParams.get('warehouseId'), 64);
    const rows = await prisma.materialStock.findMany({ where: warehouseId ? { warehouseId } : {}, select: { materialId: true, qty: true } });
    const sum = new Map<string, number>();
    for (const r of rows) sum.set(r.materialId, Math.round(((sum.get(r.materialId) ?? 0) + r.qty) * 1e6) / 1e6);
    json(res, [...sum].map(([materialId, qty]) => ({ materialId, qty })));
    return true;
  }

  // --- Laokaart ---
  const mv = /^\/api\/stock\/materials\/([^/]+)\/movements$/.exec(pathname);
  if (mv && method === 'GET') {
    const materialId = decodeURIComponent(mv[1]);
    const warehouseId = text(url.searchParams.get('warehouseId'), 64);
    const result = await tenantTransaction(async (tx) => {
      const [mm] = await loadMovements(tx, [materialId]);
      if (!mm) return null;
      const { outs } = fifoReplay(mm.movements);
      const docIds = mm.docLines.map((l) => l.id);
      const entryIds = [...mm.entryLines.map((l) => l.id), ...mm.issueEntryLineIds];
      const [docLines, entryLines, whs] = await Promise.all([
        tx.stockDocumentLine.findMany({ where: { id: { in: docIds } }, include: { document: { include: { supplier: { select: { name: true } } } } } }),
        tx.workEntryLine.findMany({
          where: { id: { in: entryIds } },
          include: { entry: { select: { id: true, date: true, warehouseId: true, fieldWork: { select: { workType: { select: { name: true, shortName: true } }, fieldSeason: { select: { field: { select: { num: true, name: true } } } } } } } } }
        }),
        tx.warehouse.findMany({ select: { id: true, name: true } })
      ]);
      const whName = new Map(whs.map((w) => [w.id, w.name]));
      const docById = new Map(docLines.map((l) => [l.id, l]));
      const entryById = new Map(entryLines.map((l) => [l.id, l]));
      let balance = 0;
      const rows: any[] = [];
      for (const m of sortMovements(mm.movements)) {
        const touches = !warehouseId || m.warehouseId === warehouseId || m.toWarehouseId === warehouseId;
        if (!touches) continue;
        let delta = 0;
        if (m.kind === 'IN') delta = m.quantity;
        else if (m.kind === 'OUT') delta = -m.quantity;
        else if (warehouseId) delta = m.warehouseId === warehouseId ? -m.quantity : m.quantity;
        balance = Math.round((balance + delta) * 1e6) / 1e6;
        const o = outs.get(m.ref);
        const [type, lineId] = m.ref.split(':');
        const base = { ref: m.ref, date: m.date, kind: m.kind, quantity: m.quantity, delta, balance,
          warehouseName: whName.get(m.warehouseId) ?? '', toWarehouseName: m.toWarehouseId ? whName.get(m.toWarehouseId) ?? '' : null };
        const cost = m.kind === 'IN' ? (m.amount ?? 0) : o && o.unpricedQty === 0 ? o.cost : null;
        const moneyPart = finance ? { cost } : {};
        if (type === 'doc') {
          const l = docById.get(lineId)!;
          rows.push({ ...base, ...moneyPart, source: 'DOCUMENT', documentId: l.documentId, documentKind: l.document.kind,
            documentNo: l.document.documentNo, supplierName: l.document.supplier?.name ?? null, writeOffReason: l.document.writeOffReason,
            shortageQty: l.shortageQty });
        } else {
          const l = entryById.get(lineId)!;
          rows.push({ ...base, ...moneyPart, source: 'FIELD_WORK', entryId: l.entry.id,
            fieldName: `${l.entry.fieldWork.fieldSeason.field.num} ${l.entry.fieldWork.fieldSeason.field.name}`.trim(),
            workTypeName: workTypeDisplayName(l.entry.fieldWork.workType) });
        }
      }
      // Teisendamatud kanderead (arvestusest väljas) näidatakse eraldi
      const issues = mm.issueEntryLineIds.map((id) => {
        const l = entryById.get(id)!;
        return { entryId: l.entry.id, date: isoDate(l.entry.date), quantity: l.quantity, unit: l.unit,
          fieldName: `${l.entry.fieldWork.fieldSeason.field.num} ${l.entry.fieldWork.fieldSeason.field.name}`.trim(),
          workTypeName: workTypeDisplayName(l.entry.fieldWork.workType) };
      });
      return { unit: mm.unit, movements: rows.reverse(), issues };
    });
    if (!result) json(res, { error: 'Materjali ei leitud' }, 404);
    else json(res, result);
    return true;
  }

  // --- Laokanded (finants) ---
  if (pathname.startsWith('/api/stock/documents') && denyNonFinance()) return true;
  if (pathname === '/api/stock/documents' && method === 'GET') {
    const kind = (['RECEIPT', 'WRITE_OFF', 'TRANSFER'] as const).find((k) => k === url.searchParams.get('kind'));
    const warehouseId = text(url.searchParams.get('warehouseId'), 64);
    const supplierId = text(url.searchParams.get('supplierId'), 64);
    const from = dateOnly(url.searchParams.get('from'));
    const to = dateOnly(url.searchParams.get('to'));
    const rows = await prisma.stockDocument.findMany({
      where: {
        ...(kind ? { kind } : {}),
        ...(warehouseId ? { OR: [{ warehouseId }, { toWarehouseId: warehouseId }] } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: DOC_INCLUDE
    });
    json(res, rows.map(documentDto));
    return true;
  }
  if (pathname.startsWith('/api/stock/documents/') && method === 'GET') {
    const d = await prisma.stockDocument.findUnique({ where: { id: idOf('/api/stock/documents/') }, include: DOC_INCLUDE });
    if (!d) json(res, { error: 'Laokannet ei leitud' }, 404);
    else json(res, documentDto(d));
    return true;
  }
  if ((pathname === '/api/stock/documents' && method === 'POST') || (pathname.startsWith('/api/stock/documents/') && method === 'PUT')) {
    const id = method === 'PUT' ? idOf('/api/stock/documents/') : null;
    const parsed = parseStockDocument(await parseBody(req));
    if (!parsed.ok) {
      json(res, { error: parsed.error }, 400);
      return true;
    }
    try {
      const savedId = await tenantTransaction((tx) => saveStockDocument(tx, id, parsed.doc), { timeout: 60000 });
      const d = await prisma.stockDocument.findUniqueOrThrow({ where: { id: savedId }, include: DOC_INCLUDE });
      json(res, documentDto(d));
    } catch (err) {
      if (err instanceof StockValidationError) json(res, { error: err.message }, 400);
      else throw err;
    }
    return true;
  }
  if (pathname.startsWith('/api/stock/documents/') && method === 'DELETE') {
    const id = idOf('/api/stock/documents/');
    try {
      await tenantTransaction((tx) => deleteStockDocument(tx, id), { timeout: 60000 });
      json(res, { success: true, id });
    } catch (err) {
      if (err instanceof StockValidationError) json(res, { error: `Kannet ei saa kustutada: ${err.message}` }, 400);
      else throw err;
    }
    return true;
  }
  return false;
}
```

- [ ] **Step 7: Ühenda `src/server/apiHandler.ts`**

Import: `import { handleStock } from './stockApi.ts';`
`if (await handleFieldWorks(req, res, pathname, method, url)) return;` järele:

```ts
    if (await handleStock(req, res, pathname, method, url)) return;
```

`/api/poi` GET — `findMany` saab `include: { warehouse: { select: { id: true, name: true } } }` ja `mapped` objekt rea:

```ts
        warehouse: p.warehouse ? { id: p.warehouse.id, name: p.warehouse.name } : undefined,
```

Kontrolli, kas `/api/stock` ja `/api/warehouses` peavad olema litsentsi/rolli lubatud loendis: `grep -n "'/api/materials'" src/server/*.ts` — kui materjalide tee on mõnes lubatud teede loendis (nt `licenseGate.ts`), lisa samasse loendisse `/api/stock` ja `/api/warehouses`.

- [ ] **Step 8: Tüübikontroll ja testid**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npm test'`
Expected: PASS

- [ ] **Step 9: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/server/stockRules.ts src/server/stockRules.test.ts src/server/stockApi.ts src/server/stock.ts src/server/stock.test.ts src/server/apiHandler.ts src/server/licenseGate.ts && git commit -m "Laoarvestus: ladude, laokannete ja laokaardi API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```
(`licenseGate.ts` lisa ainult siis, kui seda muutsid.)

---

### Task 6: Algseis live-andmetes (põhiladu + ümberarvutus)

**Files:**
- Create: `scripts/stock-init.mts`

**Interfaces:**
- Consumes: `getDefaultWarehouseId`, `recomputeAllMaterialStock` (Task 3), `runAsTenant`, `tenantTransaction`, `authDb` failist `src/server/db.ts`.

- [ ] **Step 1: Kirjuta skript** `scripts/stock-init.mts`

```ts
// scripts/stock-init.mts — laoarvestuse algseis: igale ettevõttele põhiladu ja laoseisu/FIFO hindade ümberarvutus.
// Korduvkäivitatav. Käivita: npx tsx scripts/stock-init.mts
import { authDb, runAsTenant, tenantTransaction, prisma } from '../src/server/db.ts';
import { getDefaultWarehouseId, recomputeAllMaterialStock } from '../src/server/stock.ts';

const tenants = await authDb().tenant.findMany({ select: { id: true, name: true } });
for (const t of tenants) {
  await runAsTenant(t.id, async () => {
    await tenantTransaction(async (tx) => {
      await getDefaultWarehouseId(tx);
      await recomputeAllMaterialStock(tx);
    }, { timeout: 300000 });
    const [neg, issues] = await Promise.all([
      prisma.materialStock.count({ where: { qty: { lt: 0 } } }),
      prisma.material.count({ where: { stockIssueCount: { gt: 0 } } })
    ]);
    console.log(`${t.name}: miinuses ${neg} materjali/lao paari, teisendamatute ridadega ${issues} materjali`);
  });
}
await authDb().$disconnect();
process.exit(0);
```

- [ ] **Step 2: Varukoopia** (käsk Global Constraints'ist).

- [ ] **Step 3: Käivita live-is**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsx scripts/stock-init.mts'`
Expected: iga ettevõtte rida; Loisu Agro puhul ligikaudu 146 miinuses paari ja 1 teisendamatute ridadega materjal (kg vs l).

- [ ] **Step 4: Kontrolli**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && set -a && . ./.env && set +a && psql "${PLATFORM_DATABASE_URL%%\?*}" -At -c "select tenant_id, count(*) filter (where \"isDefault\") from warehouses group by 1; select count(*) from work_entry_lines where kind='"'"'MATERIAL'"'"' and \"unitPrice\" is not null;"'
```
Expected: igal ettevõttel täpselt 1 põhiladu; hinnaga materjaliridu 0 (arvele võtmisi veel pole).

- [ ] **Step 5: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add scripts/stock-init.mts && git commit -m "Laoarvestus: algseisu skript (põhiladu ja ümberarvutus)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 7: Kliendi tüübid ja API

**Files:**
- Create: `src/types/stock.ts`
- Modify: `src/types/fieldWork.ts` (`Material`, `WorkEntry`/`WorkEntryInput`)
- Modify: `src/types/poi.ts`
- Modify: `src/services/api.ts`

**Interfaces:**
- Produces (klient):
  - `Warehouse`, `StockDocumentKind`, `WriteOffReason`, `StockDocument`, `StockDocumentLine`, `StockDocumentInput`, `StockMovement`, `MaterialMovements`, `StockLevel`, `STOCK_DOC_KIND_LABEL`, `WRITE_OFF_REASON_LABEL`
  - `api.getWarehouses()`, `api.saveWarehouse(w)`, `api.deleteWarehouse(id)`, `api.getStockLevels(warehouseId?)`, `api.getStockDocuments(filter)`, `api.saveStockDocument(input, id?)`, `api.deleteStockDocument(id)`, `api.getMaterialMovements(materialId, warehouseId?)`, `api.getMaterials(year?, warehouseId?)`, `api.saveMaterial(m, confirmUnitChange?)`

- [ ] **Step 1: Kirjuta `src/types/stock.ts`**

```ts
// src/types/stock.ts — laoarvestus: laod, laokanded, laokaart
export type StockDocumentKind = 'RECEIPT' | 'WRITE_OFF' | 'TRANSFER';
export type WriteOffReason = 'SPOILED' | 'INVENTORY' | 'OTHER';

export const STOCK_DOC_KIND_LABEL: Record<StockDocumentKind, string> = {
  RECEIPT: 'Arvele võtmine',
  WRITE_OFF: 'Mahakandmine',
  TRANSFER: 'Ülekanne'
};

export const WRITE_OFF_REASON_LABEL: Record<WriteOffReason, string> = {
  SPOILED: 'Riknenud',
  INVENTORY: 'Inventuuri vahe',
  OTHER: 'Muu'
};

export interface Warehouse {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  poiId: string | null;
  poiName: string | null;
  notes: string | null;
}

export interface StockDocumentLine {
  id: string;
  materialId: string;
  materialName: string;
  unit: string;
  quantity: number;
  amount: number | null;
  fifoCost: number | null;
  shortageQty: number | null;
}

export interface StockDocument {
  id: string;
  kind: StockDocumentKind;
  date: string;
  warehouseId: string;
  warehouseName: string;
  toWarehouseId: string | null;
  toWarehouseName: string | null;
  supplierId: string | null;
  supplierName: string | null;
  documentNo: string | null;
  writeOffReason: WriteOffReason | null;
  notes: string | null;
  total: number;
  hasUnpriced: boolean;
  lines: StockDocumentLine[];
}

export interface StockDocumentInput {
  kind: StockDocumentKind;
  date: string;
  warehouseId: string;
  toWarehouseId?: string | null;
  supplierId?: string | null;
  documentNo?: string | null;
  writeOffReason?: WriteOffReason | null;
  notes?: string | null;
  lines: { materialId: string; quantity: string | number; amount?: string | number | null }[];
}

export interface StockDocumentFilter {
  kind?: StockDocumentKind | '';
  warehouseId?: string;
  supplierId?: string;
  from?: string;
  to?: string;
}

export interface StockMovement {
  ref: string;
  date: string;
  kind: 'IN' | 'TRANSFER' | 'OUT';
  quantity: number;
  delta: number;
  balance: number;
  warehouseName: string;
  toWarehouseName: string | null;
  cost?: number | null; // ainult finantsõigusega
  source: 'DOCUMENT' | 'FIELD_WORK';
  documentId?: string;
  documentKind?: StockDocumentKind;
  documentNo?: string | null;
  supplierName?: string | null;
  writeOffReason?: WriteOffReason | null;
  shortageQty?: number | null;
  entryId?: string;
  fieldName?: string;
  workTypeName?: string;
}

export interface MaterialMovements {
  unit: string;
  movements: StockMovement[]; // uuemad eespool
  issues: { entryId: string; date: string; quantity: number; unit: string; fieldName: string; workTypeName: string }[];
}

export interface StockLevel {
  materialId: string;
  qty: number;
}
```

- [ ] **Step 2: Laienda tüüpe**

`src/types/fieldWork.ts`, `interface Material` lõppu:

```ts
  stockQty?: number; // laoseis laoühikus (valitud lao või kõigi ladude summa)
  unpricedQty?: number; // hindamata kogus (ootab arvele võtmist)
  stockIssueCount?: number; // kanderead, mida ei saa laoühikusse teisendada
  stockValue?: number; // laoväärtus € (ainult finantsõigusega)
```

Leia kande tüübid (`grep -n "export interface WorkEntry\b\|export interface WorkEntryInput" src/types/fieldWork.ts`) ja lisa mõlemasse:

```ts
  warehouseId?: string | null; // ladu, kust materjalid võetakse; tühi = põhiladu
```

`src/types/poi.ts`, `interface PointOfInterest` lõppu:

```ts
  warehouse?: { id: string; name: string }; // laoga seotud huvipunkt
```

- [ ] **Step 3: API kliendid** `src/services/api.ts`

Impordi: `import type { Warehouse, StockDocument, StockDocumentInput, StockDocumentFilter, MaterialMovements, StockLevel } from '../types/stock';`

Asenda `getMaterials` ja `saveMaterial`:

```ts
  async getMaterials(year?: number, warehouseId?: string): Promise<Material[]> {
    const q = new URLSearchParams();
    if (year) q.set('year', String(year));
    if (warehouseId) q.set('warehouseId', warehouseId);
    const qs = q.toString();
    return jsonOrThrow(await apiFetch(qs ? `/api/materials?${qs}` : '/api/materials'), 'Materjalide laadimine ebaõnnestus');
  },

  async saveMaterial(m: Partial<Material>, confirmUnitChange = false): Promise<Material> {
    return jsonOrThrow(await apiFetch('/api/materials', jsonInit('POST', { ...m, confirmUnitChange })), 'Materjali salvestamine ebaõnnestus');
  },
```

`deleteMaterial` järele:

```ts
  async getWarehouses(): Promise<Warehouse[]> {
    return jsonOrThrow(await apiFetch('/api/warehouses'), 'Ladude laadimine ebaõnnestus');
  },
  async saveWarehouse(w: Partial<Warehouse>): Promise<Warehouse> {
    return jsonOrThrow(await apiFetch('/api/warehouses', jsonInit('POST', w)), 'Lao salvestamine ebaõnnestus');
  },
  async deleteWarehouse(id: string): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/warehouses/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Lao kustutamine ebaõnnestus');
  },
  async getStockLevels(warehouseId?: string): Promise<StockLevel[]> {
    return jsonOrThrow(await apiFetch(`/api/stock/levels${warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : ''}`), 'Laoseisu laadimine ebaõnnestus');
  },
  async getStockDocuments(f: StockDocumentFilter = {}): Promise<StockDocument[]> {
    const q = new URLSearchParams(Object.entries(f).filter(([, v]) => !!v) as [string, string][]);
    return jsonOrThrow(await apiFetch(`/api/stock/documents?${q}`), 'Laokannete laadimine ebaõnnestus');
  },
  async saveStockDocument(input: StockDocumentInput, id?: string): Promise<StockDocument> {
    return jsonOrThrow(
      await apiFetch(id ? `/api/stock/documents/${encodeURIComponent(id)}` : '/api/stock/documents', jsonInit(id ? 'PUT' : 'POST', input)),
      'Laokande salvestamine ebaõnnestus'
    );
  },
  async deleteStockDocument(id: string): Promise<void> {
    await jsonOrThrow(await apiFetch(`/api/stock/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }), 'Laokande kustutamine ebaõnnestus');
  },
  async getMaterialMovements(materialId: string, warehouseId?: string): Promise<MaterialMovements> {
    return jsonOrThrow(
      await apiFetch(`/api/stock/materials/${encodeURIComponent(materialId)}/movements${warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : ''}`),
      'Laokaardi laadimine ebaõnnestus'
    );
  },
```

Kontrolli, et `jsonOrThrow` viskab vea koos serveri `error` tekstiga ja säilitab vastuse keha (vajalik `needsConfirm` jaoks): `grep -n "async function jsonOrThrow\|const jsonOrThrow" -A12 src/services/api.ts`. Kui viga keha ei säilita, lisa veaobjektile väli `body` (nt `Object.assign(new Error(msg), { status: r.status, body })`) ilma olemasolevat käitumist muutmata.

- [ ] **Step 4: Tüübikontroll**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json'`
Expected: vigadeta

- [ ] **Step 5: Commit ja release**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/types/stock.ts src/types/fieldWork.ts src/types/poi.ts src/services/api.ts && git commit -m "Laoarvestus: kliendi tüübid ja API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" && npm run release'
```

---

### Task 8: Kulumaterjalide vaade — laoseis, lao filter, laokaart

**Files:**
- Modify: `src/components/MaterialsView.tsx`
- Modify: `src/components/MaterialFormDialog.tsx`
- Create: `src/components/MaterialStockCard.tsx`
- Modify: `src/App.tsx` (prop'id)
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Task 7 tüübid ja API.
- Produces:
  - `MaterialsView` uued prop'id `canManageFinance: boolean`, `initialWarehouseId?: string | null`, `onInitialWarehouseConsumed?: () => void`
  - Vahekaart `tab: 'materials' | 'documents' | 'warehouses'` (kaks viimast finantsõigusega; sisu Task 9 ja 10, siin kohatäitjata — vahekaardi nupud lisatakse Task 9/10-s)
  - `MaterialStockCard` prop'id `{ material: Material; warehouseId: string; warehouses: Warehouse[]; canSeeMoney: boolean; onClose: () => void }`

- [ ] **Step 1: `MaterialStockCard.tsx`**

```tsx
// src/components/MaterialStockCard.tsx — materjali laokaart: liikumised kuupäeva järjekorras, jooksev seis, maksumus
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { formatDate } from '../services/dateFormat';
import { FilterClear } from './FilterClear';
import type { Material } from '../types/fieldWork';
import type { MaterialMovements, StockMovement, Warehouse } from '../types/stock';
import { STOCK_DOC_KIND_LABEL, WRITE_OFF_REASON_LABEL } from '../types/stock';

const fmtQty = (n: number) => n.toLocaleString('et-EE', { maximumFractionDigits: 3 });
const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });

const describe = (m: StockMovement) => {
  if (m.source === 'FIELD_WORK') return `${m.workTypeName} · ${m.fieldName}`;
  const kind = STOCK_DOC_KIND_LABEL[m.documentKind!];
  if (m.documentKind === 'RECEIPT') return [kind, m.supplierName, m.documentNo].filter(Boolean).join(' · ');
  if (m.documentKind === 'WRITE_OFF') return [kind, m.writeOffReason ? WRITE_OFF_REASON_LABEL[m.writeOffReason] : null, m.documentNo].filter(Boolean).join(' · ');
  return [kind, `${m.warehouseName} → ${m.toWarehouseName}`, m.documentNo].filter(Boolean).join(' · ');
};

interface Props {
  material: Material;
  warehouseId: string;
  warehouses: Warehouse[];
  canSeeMoney: boolean;
  onClose: () => void;
}

export const MaterialStockCard: React.FC<Props> = ({ material, warehouseId: initialWh, warehouses, canSeeMoney, onClose }) => {
  const [warehouseId, setWarehouseId] = useState(initialWh);
  const [data, setData] = useState<MaterialMovements | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    api.getMaterialMovements(material.id, warehouseId || undefined)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Laokaardi laadimine ebaõnnestus'));
    return () => { alive = false; };
  }, [material.id, warehouseId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <div className="modal-content animate-scale-up stock-card-modal">
        <div className="modal-header">
          <div className="modal-title-group">
            <Package size={20} className="text-emerald" />
            <h3>Laokaart: {material.name}</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="register-actions-bar">
            <FilterClear active={!!warehouseId} onClear={() => setWarehouseId('')}>
              <select className="form-input" aria-label="Ladu" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">Kõik laod</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </FilterClear>
          </div>
          {error && <div className="alert-box error">{error}</div>}
          {data && data.issues.length > 0 && (
            <div className="alert-box warning">
              <AlertTriangle size={14} /> {data.issues.length} kannet on arvestusest väljas, sest nende ühikut ei saa laoühikusse ({data.unit}) teisendada:
              <ul>
                {data.issues.map((i) => <li key={i.entryId}>{formatDate(i.date)} · {i.workTypeName} · {i.fieldName} · {fmtQty(i.quantity)} {i.unit}</li>)}
              </ul>
            </div>
          )}
          <div className="register-table-wrap">
            <table className="register-table stock-card-table">
              <thead>
                <tr>
                  <th>Kuupäev</th>
                  <th>Liikumine</th>
                  {!warehouseId && <th>Ladu</th>}
                  <th className="num">Muutus ({data?.unit ?? material.unit})</th>
                  {warehouseId && <th className="num">Seis</th>}
                  {canSeeMoney && <th className="num">Maksumus</th>}
                </tr>
              </thead>
              <tbody>
                {data && data.movements.length === 0 && (
                  <tr><td colSpan={5} className="muted">Liikumisi pole.</td></tr>
                )}
                {data?.movements.map((m) => (
                  <tr key={m.ref}>
                    <td>{formatDate(m.date)}</td>
                    <td>
                      {describe(m)}
                      {!!m.shortageQty && <span className="material-overuse"> · puudu {fmtQty(m.shortageQty)}</span>}
                    </td>
                    {!warehouseId && <td>{m.kind === 'TRANSFER' ? `${m.warehouseName} → ${m.toWarehouseName}` : m.warehouseName}</td>}
                    <td className={`num ${m.delta < 0 ? 'material-overuse' : ''}`}>
                      {m.kind === 'TRANSFER' && !warehouseId ? fmtQty(m.quantity) : `${m.delta > 0 ? '+' : ''}${fmtQty(m.delta)}`}
                    </td>
                    {warehouseId && <td className={`num ${m.balance < 0 ? 'material-overuse' : ''}`}>{fmtQty(m.balance)}</td>}
                    {canSeeMoney && (
                      <td className="num">{m.cost == null ? <span className="muted" title="Ootab arvele võtmist">hindamata</span> : fmtEur(m.cost)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
```

- [ ] **Step 2: `MaterialsView.tsx` — prop'id, lao filter, laoveerud, hoiatus, laokaart, CSV**

Impordid lisaks:

```tsx
import { AlertTriangle } from 'lucide-react';
import { MaterialStockCard } from './MaterialStockCard';
import type { Warehouse } from '../types/stock';
```

```tsx
const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });
const stockWarning = (m: Material) =>
  [
    m.unpricedQty ? `${fmtQty(m.unpricedQty)} ${m.unit} ootab arvele võtmist (hindamata)` : null,
    m.stockIssueCount ? `${m.stockIssueCount} kannet ei saa laoühikusse teisendada` : null
  ].filter(Boolean).join('\n');
```

`MaterialsViewProps`:

```tsx
  canManageFinance: boolean;
  initialWarehouseId?: string | null; // kaardilt avatud lao filter
  onInitialWarehouseConsumed?: () => void;
```

Komponendi olek ja laadimine:

```tsx
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>(initialWarehouseId ?? '');
  const [stockCard, setStockCard] = useState<Material | null>(null);

  useEffect(() => {
    if (initialWarehouseId) {
      setWarehouseId(initialWarehouseId);
      onInitialWarehouseConsumed?.();
    }
  }, [initialWarehouseId, onInitialWarehouseConsumed]);

  useEffect(() => {
    api.getWarehouses().then(setWarehouses).catch((err) => alertDialog(errorText(err)));
  }, []);
```

`reload` kasutab lao filtrit: `setMaterials(await api.getMaterials(selectedYear, warehouseId || undefined));` ja sõltuvused `[selectedYear, warehouseId]`.

Lao filter `register-actions-bar` sisse otsingu järele:

```tsx
              <FilterClear active={!!warehouseId} onClear={() => setWarehouseId('')}>
                <select className="form-input" aria-label="Ladu" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  <option value="">Kõik laod</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{w.isActive ? '' : ' (mitteaktiivne)'}</option>)}
                </select>
              </FilterClear>
```

Tabeli päis — `Ühik` järele:

```tsx
                    <th className="num" title="Tänane laoseis laoühikus (hooajast sõltumatu)">Laoseis</th>
                    {canManageFinance && <th className="num">Laoväärtus</th>}
                    {canManageFinance && <th className="num" title="Laoväärtus / hinnatud laoseis">Keskm. hind</th>}
```

Tabeli rida — `<tr>` saab `onClick={() => setStockCard(m)}` ja `className` lisab `clickable-row`; tegevusnuppude `onClick`-id kutsuvad `e.stopPropagation()`. Pärast `<td>{m.unit}</td>`:

```tsx
                      <td className={`num ${(m.stockQty ?? 0) < 0 ? 'material-overuse' : ''}`}>
                        {fmtQty(m.stockQty ?? 0)}
                        {stockWarning(m) && <AlertTriangle size={13} className="stock-warning-icon" aria-label={stockWarning(m)}><title>{stockWarning(m)}</title></AlertTriangle>}
                      </td>
                      {canManageFinance && <td className="num">{fmtEur(m.stockValue ?? 0)}</td>}
                      {canManageFinance && (
                        <td className="num">
                          {(m.stockQty ?? 0) - (m.unpricedQty ?? 0) > 0 ? fmtEur((m.stockValue ?? 0) / ((m.stockQty ?? 0) - (m.unpricedQty ?? 0))) : '–'}
                        </td>
                      )}
```

Kui `lucide-react` ikoon ei luba `<title>` last, mähi ikoon `<span title={stockWarning(m)} className="stock-warning-icon">…</span>`.

Tühja rea `colSpan` → `{canManageFinance ? 12 : 10}`.

CSV: päisesse `'Ühik'` järele `'Laoseis'` ja finantsõigusega `'Laoväärtus'`; ridadesse `m.stockQty ?? 0` ja finantsõigusega `m.stockValue ?? 0`:

```tsx
    const headers = ['ID', 'Materjal', 'Liik', 'Ühik', 'Laoseis', ...(canManageFinance ? ['Laoväärtus'] : []), 'Planeeritud', 'Kasutatud', 'Ala/ülekulu', 'Aktiivne', 'Kandeid', 'Märkus'];
```
```tsx
      `"${m.unit}"`,
      m.stockQty ?? 0,
      ...(canManageFinance ? [m.stockValue ?? 0] : []),
```

Laokaart komponendi lõppu `MaterialFormDialog` kõrvale:

```tsx
      {stockCard && (
        <MaterialStockCard material={stockCard} warehouseId={warehouseId} warehouses={warehouses} canSeeMoney={canManageFinance} onClose={() => setStockCard(null)} />
      )}
```

- [ ] **Step 3: `MaterialFormDialog.tsx` — ühiku muutmise kinnitus**

`save` sees asenda `await api.saveMaterial(form);`:

```tsx
      try {
        await api.saveMaterial(form);
      } catch (err: any) {
        if (!err?.body?.needsConfirm) throw err;
        if (!(await confirmDialog(`${err.message} Kas muudan ühiku ikkagi?`))) return;
        await api.saveMaterial(form, true);
      }
```
ja impordi `confirmDialog` failist `./ConfirmDialog`.

- [ ] **Step 4: `App.tsx`**

Olek `mainView` kõrval:

```tsx
  const [materialsWarehouseId, setMaterialsWarehouseId] = useState<string | null>(null);
  const clearMaterialsWarehouse = useCallback(() => setMaterialsWarehouseId(null), []);
```

`MaterialsView` kasutus:

```tsx
          <MaterialsView
            selectedYear={selectedYear}
            onSelectYear={setSelectedYear}
            seasons={seasons}
            canManageFinance={user.isAdmin || user.isFinanceManager}
            initialWarehouseId={materialsWarehouseId}
            onInitialWarehouseConsumed={clearMaterialsWarehouse}
          />
```

- [ ] **Step 5: CSS** `src/index.css` lõppu

```css
/* Laoarvestus */
.materials-table tr.clickable-row { cursor: pointer; }
.stock-warning-icon { color: #d97706; margin-left: 4px; vertical-align: -2px; }
.stock-card-modal { width: min(960px, 96vw); }
.stock-card-table td, .stock-card-table th { white-space: nowrap; }
.stock-card-table td:nth-child(2) { white-space: normal; }
```

- [ ] **Step 6: Tüübikontroll ja käsitsi kontroll**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npm run release'`
Expected: vigadeta. Ava rakendus → Kulumaterjalid: laoseisu veerg (miinused punased), finantsjuhina laoväärtus 0 €, hoiatusikoon hindamata materjalidel; rea klõps avab laokaardi PRIA kannetega; lao filter muudab seisu.

- [ ] **Step 7: Commit** (release tehti eelmises sammus)

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/components/MaterialsView.tsx src/components/MaterialFormDialog.tsx src/components/MaterialStockCard.tsx src/App.tsx src/index.css && git commit -m "Laoarvestus: kulumaterjalide laoseis, lao filter ja laokaart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 9: Laokannete register ja vorm

**Files:**
- Create: `src/components/StockDocumentsPanel.tsx`
- Create: `src/components/StockDocumentDialog.tsx`
- Modify: `src/components/MaterialsView.tsx` (vahekaardid)
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Task 7 API; `RelatedParty` (`src/types/party.ts`), `api.getParties` (kontrolli nime: `grep -n "async getParties\|async getRelatedParties" src/services/api.ts`).
- Produces:
  - `StockDocumentsPanel` prop'id `{ warehouses: Warehouse[]; materials: Material[]; onChanged: () => void }`
  - `StockDocumentDialog` prop'id `{ kind: StockDocumentKind; initial: StockDocument | null; warehouses: Warehouse[]; materials: Material[]; suppliers: RelatedParty[]; onClose: () => void; onSaved: () => void }`
  - `MaterialsView` vahekaart `'documents'`.

- [ ] **Step 1: `StockDocumentDialog.tsx`**

```tsx
// src/components/StockDocumentDialog.tsx — laokande vorm: arvele võtmine, mahakandmine, ülekanne (päis + read)
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X, ArrowRightLeft } from 'lucide-react';
import { api } from '../services/api';
import { alertDialog } from './ConfirmDialog';
import { DateInput } from './DateInput';
import type { Material } from '../types/fieldWork';
import type { RelatedParty } from '../types/party';
import type { StockDocument, StockDocumentKind, Warehouse, WriteOffReason, StockLevel } from '../types/stock';
import { STOCK_DOC_KIND_LABEL, WRITE_OFF_REASON_LABEL } from '../types/stock';

interface Row { materialId: string; quantity: string; amount: string }
const emptyRow: Row = { materialId: '', quantity: '', amount: '' };
const today = () => new Date().toISOString().slice(0, 10);
const fmtQty = (n: number) => n.toLocaleString('et-EE', { maximumFractionDigits: 3 });
const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });
const parseNum = (s: string) => {
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  return s.trim() && Number.isFinite(n) ? n : null;
};

interface Props {
  kind: StockDocumentKind;
  initial: StockDocument | null;
  warehouses: Warehouse[];
  materials: Material[];
  suppliers: RelatedParty[];
  onClose: () => void;
  onSaved: () => void;
}

export const StockDocumentDialog: React.FC<Props> = ({ kind, initial, warehouses, materials, suppliers, onClose, onSaved }) => {
  const defaultWh = warehouses.find((w) => w.isDefault)?.id ?? '';
  const [date, setDate] = useState(initial?.date ?? today());
  const [warehouseId, setWarehouseId] = useState(initial?.warehouseId ?? defaultWh);
  const [toWarehouseId, setToWarehouseId] = useState(initial?.toWarehouseId ?? '');
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? '');
  const [documentNo, setDocumentNo] = useState(initial?.documentNo ?? '');
  const [reason, setReason] = useState<WriteOffReason | ''>(initial?.writeOffReason ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [rows, setRows] = useState<Row[]>(
    initial?.lines.map((l) => ({ materialId: l.materialId, quantity: String(l.quantity).replace('.', ','), amount: l.amount == null ? '' : String(l.amount).replace('.', ',') })) ?? [{ ...emptyRow }]
  );
  const [levels, setLevels] = useState<Map<string, number>>(new Map());
  const [busy, setBusy] = useState(false);

  const activeWarehouses = warehouses.filter((w) => w.isActive || w.id === warehouseId || w.id === toWarehouseId);
  const options = useMemo(
    () => materials.filter((m) => m.isActive || rows.some((r) => r.materialId === m.id)).sort((a, b) => a.name.localeCompare(b.name, 'et')),
    [materials, rows]
  );
  const total = rows.reduce((s, r) => s + (parseNum(r.amount) ?? 0), 0);

  useEffect(() => {
    if (!warehouseId) return;
    api.getStockLevels(warehouseId)
      .then((ls: StockLevel[]) => setLevels(new Map(ls.map((l) => [l.materialId, l.qty]))))
      .catch(() => setLevels(new Map()));
  }, [warehouseId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.saveStockDocument(
        {
          kind, date, warehouseId,
          toWarehouseId: kind === 'TRANSFER' ? toWarehouseId : null,
          supplierId: kind === 'RECEIPT' ? supplierId || null : null,
          documentNo: documentNo || null,
          writeOffReason: kind === 'WRITE_OFF' ? reason || null : null,
          notes: notes || null,
          lines: rows.filter((r) => r.materialId || r.quantity).map((r) => ({ materialId: r.materialId, quantity: r.quantity, amount: kind === 'RECEIPT' ? r.amount : null }))
        },
        initial?.id
      );
      onSaved();
    } catch (err) {
      alertDialog(err instanceof Error ? err.message : 'Laokande salvestamine ebaõnnestus');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop sub-modal">
      <form className="modal-content animate-scale-up stock-doc-modal" onSubmit={save}>
        <div className="modal-header">
          <div className="modal-title-group">
            <ArrowRightLeft size={20} className="text-emerald" />
            <h3>{initial ? 'Muuda: ' : ''}{STOCK_DOC_KIND_LABEL[kind]}</h3>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} title="Sulge (Esc)"><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="sd-date">Kuupäev *</label>
              <DateInput id="sd-date" value={date} onChange={setDate} required />
            </div>
            <div className="form-group">
              <label htmlFor="sd-wh">{kind === 'RECEIPT' ? 'Ladu *' : 'Lähteladu *'}</label>
              <select id="sd-wh" className="form-input" required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">– vali –</option>
                {activeWarehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {kind === 'TRANSFER' && (
              <div className="form-group">
                <label htmlFor="sd-to">Sihtladu *</label>
                <select id="sd-to" className="form-input" required value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
                  <option value="">– vali –</option>
                  {activeWarehouses.filter((w) => w.id !== warehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
            {kind === 'RECEIPT' && (
              <div className="form-group">
                <label htmlFor="sd-sup">Tarnija</label>
                <select id="sd-sup" className="form-input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">– vali –</option>
                  {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {kind === 'WRITE_OFF' && (
              <div className="form-group">
                <label htmlFor="sd-reason">Põhjus *</label>
                <select id="sd-reason" className="form-input" required value={reason} onChange={(e) => setReason(e.target.value as WriteOffReason)}>
                  <option value="">– vali –</option>
                  {(Object.keys(WRITE_OFF_REASON_LABEL) as WriteOffReason[]).map((r) => <option key={r} value={r}>{WRITE_OFF_REASON_LABEL[r]}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="sd-no">Dokumendi nr</label>
              <input id="sd-no" className="form-input" placeholder={kind === 'RECEIPT' ? 'arve / saateleht' : ''} value={documentNo} onChange={(e) => setDocumentNo(e.target.value)} />
            </div>
            <div className="form-group full-width">
              <label htmlFor="sd-notes">Märkus</label>
              <input id="sd-notes" className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <table className="register-table stock-doc-lines">
            <thead>
              <tr>
                <th>Materjal</th>
                <th className="num">Laos</th>
                <th className="num">Kogus</th>
                {kind === 'RECEIPT' && <th className="num">Summa km-ta (€)</th>}
                {kind === 'RECEIPT' && <th className="num">Ühikuhind</th>}
                {kind !== 'RECEIPT' && initial && <th className="num">Maksumus</th>}
                <th className="actions-col"><span className="sr-only">Tegevused</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const m = materials.find((x) => x.id === r.materialId);
                const qty = parseNum(r.quantity);
                const amount = parseNum(r.amount);
                const saved = initial?.lines.find((l) => l.materialId === r.materialId);
                return (
                  <tr key={i}>
                    <td>
                      <select className="form-input" aria-label="Materjal" value={r.materialId} onChange={(e) => setRow(i, { materialId: e.target.value })}>
                        <option value="">– vali –</option>
                        {options.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    </td>
                    <td className={`num ${(levels.get(r.materialId) ?? 0) < 0 ? 'material-overuse' : ''}`}>
                      {m ? `${fmtQty(levels.get(m.id) ?? 0)} ${m.unit}` : '–'}
                    </td>
                    <td className="num">
                      <span className="input-with-unit">
                        <input className="form-input num" inputMode="decimal" aria-label="Kogus" value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value })} />
                        <span>{m?.unit ?? ''}</span>
                      </span>
                    </td>
                    {kind === 'RECEIPT' && (
                      <td className="num">
                        <input className="form-input num" inputMode="decimal" aria-label="Summa" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
                      </td>
                    )}
                    {kind === 'RECEIPT' && (
                      <td className="num muted">{qty && amount != null ? `${fmtEur(amount / qty)}/${m?.unit ?? ''}` : '–'}</td>
                    )}
                    {kind !== 'RECEIPT' && initial && (
                      <td className="num">{saved?.fifoCost == null ? <span className="muted">hindamata</span> : fmtEur(saved.fifoCost)}</td>
                    )}
                    <td className="actions-col">
                      <button type="button" className="icon-btn-danger" title="Eemalda rida" aria-label="Eemalda rida" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ ...emptyRow }])}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="stock-doc-footer-row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRows([...rows, { ...emptyRow }])}>
              <Plus size={14} /><span>Lisa rida</span>
            </button>
            {kind === 'RECEIPT' && <span>Kokku: <strong>{fmtEur(total)}</strong></span>}
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

- [ ] **Step 2: `StockDocumentsPanel.tsx`**

```tsx
// src/components/StockDocumentsPanel.tsx — laokannete register (finantsjuht ja admin)
import React, { useCallback, useEffect, useState } from 'react';
import { PackagePlus, PackageMinus, ArrowRightLeft, Edit2, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { formatDate } from '../services/dateFormat';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import { DateInput } from './DateInput';
import { FilterClear } from './FilterClear';
import { StockDocumentDialog } from './StockDocumentDialog';
import type { Material } from '../types/fieldWork';
import type { RelatedParty } from '../types/party';
import type { StockDocument, StockDocumentFilter, StockDocumentKind, Warehouse } from '../types/stock';
import { STOCK_DOC_KIND_LABEL, WRITE_OFF_REASON_LABEL } from '../types/stock';

const fmtEur = (n: number) => n.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' });
const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

interface Props {
  warehouses: Warehouse[];
  materials: Material[];
  onChanged: () => void;
}

export const StockDocumentsPanel: React.FC<Props> = ({ warehouses, materials, onChanged }) => {
  const [docs, setDocs] = useState<StockDocument[]>([]);
  const [filter, setFilter] = useState<StockDocumentFilter>({});
  const [suppliers, setSuppliers] = useState<RelatedParty[]>([]);
  const [form, setForm] = useState<{ kind: StockDocumentKind; initial: StockDocument | null } | null>(null);

  const reload = useCallback(async () => {
    try {
      setDocs(await api.getStockDocuments(filter));
    } catch (err) {
      alertDialog(errorText(err));
    }
  }, [filter]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    api.getParties().then((ps) => setSuppliers(ps.filter((p) => p.roles.includes('SUPPLIER')))).catch(() => setSuppliers([]));
  }, []);

  const remove = async (d: StockDocument) => {
    if (!(await confirmDialog(`Kas kustutan laokande (${STOCK_DOC_KIND_LABEL[d.kind]}, ${formatDate(d.date)})?`))) return;
    try {
      await api.deleteStockDocument(d.id);
      await reload();
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
    }
  };

  const party = (d: StockDocument) =>
    d.kind === 'RECEIPT' ? d.supplierName ?? '' : d.kind === 'WRITE_OFF' && d.writeOffReason ? WRITE_OFF_REASON_LABEL[d.writeOffReason] : '';

  return (
    <>
      <div className="register-actions-bar">
        <FilterClear active={!!filter.kind} onClear={() => setFilter({ ...filter, kind: '' })}>
          <select className="form-input" aria-label="Liik" value={filter.kind ?? ''} onChange={(e) => setFilter({ ...filter, kind: e.target.value as StockDocumentKind | '' })}>
            <option value="">Kõik liigid</option>
            {(Object.keys(STOCK_DOC_KIND_LABEL) as StockDocumentKind[]).map((k) => <option key={k} value={k}>{STOCK_DOC_KIND_LABEL[k]}</option>)}
          </select>
        </FilterClear>
        <FilterClear active={!!filter.warehouseId} onClear={() => setFilter({ ...filter, warehouseId: '' })}>
          <select className="form-input" aria-label="Ladu" value={filter.warehouseId ?? ''} onChange={(e) => setFilter({ ...filter, warehouseId: e.target.value })}>
            <option value="">Kõik laod</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </FilterClear>
        <FilterClear active={!!filter.supplierId} onClear={() => setFilter({ ...filter, supplierId: '' })}>
          <select className="form-input" aria-label="Tarnija" value={filter.supplierId ?? ''} onChange={(e) => setFilter({ ...filter, supplierId: e.target.value })}>
            <option value="">Kõik tarnijad</option>
            {suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FilterClear>
        <FilterClear active={!!filter.from} onClear={() => setFilter({ ...filter, from: '' })}>
          <DateInput value={filter.from ?? ''} onChange={(v) => setFilter({ ...filter, from: v })} />
        </FilterClear>
        <span className="muted">–</span>
        <FilterClear active={!!filter.to} onClear={() => setFilter({ ...filter, to: '' })}>
          <DateInput value={filter.to ?? ''} onChange={(v) => setFilter({ ...filter, to: v })} />
        </FilterClear>
        <div className="register-io-buttons">
          <button className="btn btn-primary btn-sm" onClick={() => setForm({ kind: 'RECEIPT', initial: null })}><PackagePlus size={14} /><span>Arvele võtmine</span></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setForm({ kind: 'WRITE_OFF', initial: null })}><PackageMinus size={14} /><span>Mahakandmine</span></button>
          <button className="btn btn-secondary btn-sm" onClick={() => setForm({ kind: 'TRANSFER', initial: null })} disabled={warehouses.filter((w) => w.isActive).length < 2}><ArrowRightLeft size={14} /><span>Ülekanne</span></button>
        </div>
      </div>

      <div className="register-table-wrap">
        <table className="register-table">
          <thead>
            <tr>
              <th>Kuupäev</th>
              <th>Liik</th>
              <th>Ladu</th>
              <th>Tarnija / põhjus</th>
              <th>Dokument</th>
              <th className="num">Ridu</th>
              <th className="num">Summa</th>
              <th className="actions-col"><span className="sr-only">Tegevused</span></th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && <tr><td colSpan={8} className="muted">Laokandeid pole.</td></tr>}
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{formatDate(d.date)}</td>
                <td>{STOCK_DOC_KIND_LABEL[d.kind]}</td>
                <td>{d.kind === 'TRANSFER' ? `${d.warehouseName} → ${d.toWarehouseName}` : d.warehouseName}</td>
                <td>{party(d)}</td>
                <td>{d.documentNo ?? ''}</td>
                <td className="num">{d.lines.length}</td>
                <td className="num">{fmtEur(d.total)}{d.hasUnpriced && <span className="muted" title="Osa ridu on hindamata"> *</span>}</td>
                <td className="actions-col">
                  <div className="row-actions">
                    <button className="icon-btn-ghost" title="Muuda" aria-label="Muuda" onClick={() => setForm({ kind: d.kind, initial: d })}><Edit2 size={15} /></button>
                    <button className="icon-btn-danger" title="Kustuta" aria-label="Kustuta" onClick={() => remove(d)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <StockDocumentDialog
          kind={form.kind}
          initial={form.initial}
          warehouses={warehouses}
          materials={materials}
          suppliers={suppliers}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); void reload(); onChanged(); }}
        />
      )}
    </>
  );
};
```

Kui API-s on seotud isikute laadimise nimi teine kui `getParties`, kasuta olemasolevat nime.

- [ ] **Step 3: Vahekaardid `MaterialsView.tsx`-is**

Olek: `const [tab, setTab] = useState<'materials' | 'documents' | 'warehouses'>('materials');`

`register-header-controls` kohale (enne seda) vahekaardid, nähtavad ainult `canManageFinance` korral:

```tsx
            {canManageFinance && (
              <div className="category-filter-tabs materials-tabs">
                <button type="button" className={`filter-tab ${tab === 'materials' ? 'active' : ''}`} onClick={() => setTab('materials')}>Materjalid</button>
                <button type="button" className={`filter-tab ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>Laokanded</button>
                <button type="button" className={`filter-tab ${tab === 'warehouses' ? 'active' : ''}`} onClick={() => setTab('warehouses')}>Laod</button>
              </div>
            )}
```

Olemasolev sisu (hooaja valik, filtrid, tabel) mähi `{tab === 'materials' && (<>…</>)}` sisse ja lisa:

```tsx
            {tab === 'documents' && <StockDocumentsPanel warehouses={warehouses} materials={materials} onChanged={() => void reload()} />}
```

Jaluse loendur (`Kuvatakse … materjali`) näidatakse ainult `tab === 'materials'` korral.

- [ ] **Step 4: CSS** `src/index.css` lõppu

```css
.materials-tabs { margin-bottom: 12px; }
.stock-doc-modal { width: min(980px, 96vw); }
.stock-doc-lines { margin-top: 12px; }
.stock-doc-lines input.num { text-align: right; max-width: 140px; }
.stock-doc-lines .input-with-unit { display: inline-flex; gap: 6px; align-items: center; }
.stock-doc-footer-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
```

- [ ] **Step 5: Tüübikontroll, release ja käsitsi kontroll**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npm run release'`
Käsitsi (finantsjuhi või admini kontoga): Laokanded → Arvele võtmine → üks materjal 1000 kg, summa 500 → salvestamine → Materjalid vahekaardil laoseis kasvas 1000 võrra ja laoväärtus/keskmine hind on täidetud; materjali laokaardil said vanemad PRIA kanded hinna (kui arve kuupäev on varasem või võlg kaeti). Kustuta testkanne.

- [ ] **Step 6: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/components/StockDocumentsPanel.tsx src/components/StockDocumentDialog.tsx src/components/MaterialsView.tsx src/index.css && git commit -m "Laoarvestus: laokannete register ja vorm

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 10: Ladude register ja lao asukoht kaardil

**Files:**
- Create: `src/components/WarehousesPanel.tsx`
- Modify: `src/components/MaterialsView.tsx`
- Modify: `src/components/MapView.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Task 7 API; `PointOfInterest` (`src/types/poi.ts`), POI-de laadimine (`grep -n "async getPois\|async getPoi\b\|/api/poi'" src/services/api.ts`).
- Produces:
  - `WarehousesPanel` prop'id `{ warehouses: Warehouse[]; onChanged: () => void }`
  - `MapView` uus prop `onOpenWarehouse?: (warehouseId: string) => void`

- [ ] **Step 1: `WarehousesPanel.tsx`**

```tsx
// src/components/WarehousesPanel.tsx — ladude register (finantsjuht ja admin): nimi, põhiladu, aktiivsus, asukoht kaardil
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Warehouse as WarehouseIcon, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { confirmDialog, alertDialog } from './ConfirmDialog';
import type { PointOfInterest } from '../types/poi';
import type { Warehouse } from '../types/stock';

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Toiming ebaõnnestus');

interface Props {
  warehouses: Warehouse[];
  onChanged: () => void;
}

export const WarehousesPanel: React.FC<Props> = ({ warehouses, onChanged }) => {
  const [form, setForm] = useState<Partial<Warehouse> | null>(null);
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getPois().then(setPois).catch(() => setPois([]));
  }, []);

  useEffect(() => {
    if (!form) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setForm(null); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [form]);

  // Laohooned eespool; juba teise laoga seotud huvipunktid välja
  const takenPoi = new Set(warehouses.filter((w) => w.id !== form?.id && w.poiId).map((w) => w.poiId));
  const poiOptions = pois
    .filter((p) => !takenPoi.has(p.id))
    .sort((a, b) => Number(b.category === 'warehouse') - Number(a.category === 'warehouse') || a.name.localeCompare(b.name, 'et'));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      await api.saveWarehouse(form);
      setForm(null);
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (w: Warehouse) => {
    if (!(await confirmDialog(`Kas kustutan lao "${w.name}"?`))) return;
    try {
      await api.deleteWarehouse(w.id);
      onChanged();
    } catch (err) {
      alertDialog(errorText(err));
    }
  };

  return (
    <>
      <div className="register-actions-bar">
        <div className="register-io-buttons">
          <button className="btn btn-primary btn-sm" onClick={() => setForm({ isActive: true, isDefault: false })}><Plus size={14} /><span>Lisa ladu</span></button>
        </div>
      </div>
      <div className="register-table-wrap">
        <table className="register-table">
          <thead>
            <tr>
              <th>Ladu</th>
              <th>Asukoht</th>
              <th>Märkus</th>
              <th className="actions-col"><span className="sr-only">Tegevused</span></th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id} className={w.isActive ? '' : 'inactive'}>
                <td className="name-cell">
                  <span className="field-name">{w.name}</span>
                  {w.isDefault && <span className="users-admin-badge">Põhiladu</span>}
                  {!w.isActive && <span className="users-admin-badge">Mitteaktiivne</span>}
                </td>
                <td>{w.poiName ? <><MapPin size={13} /> {w.poiName}</> : <span className="muted">–</span>}</td>
                <td className="muted">{w.notes ?? ''}</td>
                <td className="actions-col">
                  <div className="row-actions">
                    <button className="icon-btn-ghost" title="Muuda" aria-label="Muuda" onClick={() => setForm(w)}><Edit2 size={15} /></button>
                    {!w.isDefault && <button className="icon-btn-danger" title="Kustuta" aria-label="Kustuta" onClick={() => remove(w)}><Trash2 size={15} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && createPortal(
        <div className="modal-backdrop sub-modal">
          <form className="modal-content animate-scale-up work-form-modal" onSubmit={save}>
            <div className="modal-header">
              <div className="modal-title-group">
                <WarehouseIcon size={20} className="text-emerald" />
                <h3>{form.id ? `Muuda ladu: ${form.name}` : 'Lisa ladu'}</h3>
              </div>
              <button type="button" className="icon-btn-ghost" onClick={() => setForm(null)} title="Sulge (Esc)"><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="wh-name">Nimi *</label>
                  <input id="wh-name" className="form-input" required value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="form-group full-width">
                  <label htmlFor="wh-poi">Asukoht kaardil (huvipunkt)</label>
                  <select id="wh-poi" className="form-input" value={form.poiId ?? ''} onChange={(e) => setForm({ ...form, poiId: e.target.value || null })}>
                    <option value="">– pole –</option>
                    {poiOptions.map((p) => <option key={p.id} value={p.id}>{p.name}{p.category === 'warehouse' ? ' (laohoone)' : ''}</option>)}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label htmlFor="wh-notes">Märkus</label>
                  <input id="wh-notes" className="form-input" value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <label className="users-admin-checkbox full-width">
                  <input type="checkbox" checked={form.isDefault ?? false} disabled={!!warehouses.find((w) => w.id === form.id)?.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked, isActive: e.target.checked ? true : form.isActive })} />
                  <span>Põhiladu (põllutöö kannete vaikimisi ladu)</span>
                </label>
                <label className="users-admin-checkbox full-width">
                  <input type="checkbox" checked={form.isActive ?? true} disabled={form.isDefault} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  <span>Aktiivne (kannetes valitav)</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Loobu</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Salvesta</button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </>
  );
};
```

POI-de laadimise funktsiooni nimi võta `api.ts`-ist (kontrollkäsk Interfaces plokis); POI kategooria rakenduses on `'warehouse'` (vastab andmebaasi `STORAGE`).

- [ ] **Step 2: `MaterialsView.tsx`** — ladude vahekaart ja ladude uuesti laadimine

```tsx
  const reloadWarehouses = useCallback(() => {
    api.getWarehouses().then(setWarehouses).catch((err) => alertDialog(errorText(err)));
  }, []);
  useEffect(() => { reloadWarehouses(); }, [reloadWarehouses]);
```
(asendab Task 8 `useEffect`-i ladude laadimisega)

```tsx
            {tab === 'warehouses' && <WarehousesPanel warehouses={warehouses} onChanged={() => { reloadWarehouses(); void reload(); }} />}
```

- [ ] **Step 3: `MapView.tsx`** — lao rida ja link huvipunkti hüpikaknas

Prop'idesse: `onOpenWarehouse?: (warehouseId: string) => void;` ja destruktureerimisse `onOpenWarehouse`.

`marker.bindPopup(...)` HTML-i `accessNotes` rea järele:

```ts
          ${poi.warehouse ? `<div class="popup-row"><span>Ladu:</span> <strong>${poi.warehouse.name}</strong></div><button type="button" class="btn btn-secondary btn-sm poi-warehouse-link">Ava laoseis</button>` : ''}
```

`bindPopup` järele:

```ts
      if (poi.warehouse && onOpenWarehouse) {
        const whId = poi.warehouse.id;
        marker.on('popupopen', (ev) => {
          ev.popup.getElement()?.querySelector('.poi-warehouse-link')?.addEventListener('click', () => onOpenWarehouse(whId), { once: true });
        });
      }
```

ja efekti sõltuvustesse `onOpenWarehouse`.

- [ ] **Step 4: `App.tsx`**

```tsx
  const openWarehouse = useCallback((warehouseId: string) => {
    setMaterialsWarehouseId(warehouseId);
    changeMainView('materials');
  }, [changeMainView]);
```
(kui `changeMainView` pole `useCallback`, kasuta seda otse ilma sõltuvuseta või mähi). `<MapView … onOpenWarehouse={openWarehouse} />`.

- [ ] **Step 5: Tüübikontroll, release ja käsitsi kontroll**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npm run release'`
Käsitsi: Laod → Põhiladu → seo laohoonega → kaardil laohoone hüpikaknas „Ladu: Põhiladu“ ja „Ava laoseis“ avab kulumaterjalid lao filtriga. Lisa teine ladu ja proovi ülekannet üle saadaoleva → veateade „…ülekandeks saadaval …“.

- [ ] **Step 6: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/components/WarehousesPanel.tsx src/components/MaterialsView.tsx src/components/MapView.tsx src/App.tsx && git commit -m "Laoarvestus: ladude register ja lao asukoht kaardil

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```

---

### Task 11: Põllutöö kande lao valik ja finantsvaade

**Files:**
- Modify: `src/components/FieldWorkEntryDialog.tsx`
- Modify: `src/components/PriaLinesEditor.tsx`
- Modify: `src/components/FinanceModal.tsx`
- Modify: `docs/andmemudel.md`

**Interfaces:**
- Consumes: `api.getWarehouses`, `api.getStockLevels` (Task 7); kande `warehouseId` (Task 4).
- Produces: `PriaLinesEditor` valikuline prop `stockLevels?: Map<string, number>`.

- [ ] **Step 1: `PriaLinesEditor.tsx`** — laoseis materjali valiku kõrval

Prop'idesse: `stockLevels?: Map<string, number>; // valitud lao laoseis (ainult kogus)`
Materjali `<select>` järele (rida 120 ümbrus):

```tsx
          {stockLevels && r.materialId && (
            <span className={`stock-level-hint ${(stockLevels.get(r.materialId) ?? 0) < 0 ? 'material-overuse' : ''}`} title="Laoseis valitud laos">
              Laos {(stockLevels.get(r.materialId) ?? 0).toLocaleString('et-EE', { maximumFractionDigits: 2 })} {materials.find((m) => m.id === r.materialId)?.unit ?? ''}
            </span>
          )}
```

- [ ] **Step 2: `FieldWorkEntryDialog.tsx`** — lao valik ja laoseis

Impordid: `import type { Warehouse } from '../types/stock';`
Olek ja laadimine:

```tsx
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>(entry?.warehouseId ?? '');
  const [stockLevels, setStockLevels] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    api.getWarehouses().then((ws) => {
      setWarehouses(ws);
      setWarehouseId((cur) => cur || ws.find((w) => w.isDefault)?.id || '');
    }).catch(() => setWarehouses([]));
  }, []);

  useEffect(() => {
    if (!warehouseId) return;
    api.getStockLevels(warehouseId).then((ls) => setStockLevels(new Map(ls.map((l) => [l.materialId, l.qty])))).catch(() => setStockLevels(new Map()));
  }, [warehouseId]);
```

(`entry` asenda dialoogi olemasoleva kande prop'i nimega.) Salvestatavasse objekti (rida ~325 `materials: rows…` kõrvale): `warehouseId: warehouseId || null,`

Lao valik materjalide sektsioonis `<PriaLinesEditor …>` ette, ainult kui tööl on materjale (sama tingimus, millega `PriaLinesEditor` kuvatakse) ja ladusid on rohkem kui üks:

```tsx
              {warehouses.length > 1 && (
                <div className="form-group">
                  <label htmlFor="we-warehouse">Ladu</label>
                  <select id="we-warehouse" className="form-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                    {warehouses.filter((w) => w.isActive || w.id === warehouseId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )}
```

ja `PriaLinesEditor`-ile `stockLevels={stockLevels}`.

- [ ] **Step 3: `FinanceModal.tsx`** — materjali hind kirjutuskaitstud

Hinna lahtris (rida ~688) materjaliridadel sisendi asemel:

```tsx
                                    <td className="finance-price-cell">
                                      {line.kind === 'MATERIAL' ? (
                                        <span className={`finance-fifo-price ${isMissing ? 'missing' : ''}`} title="Hind tuleb laost (FIFO)">
                                          {isMissing ? 'ootab arvele võtmist' : `${line.parsedPrice!.toLocaleString('et-EE', { maximumFractionDigits: 4 })} €/${line.unit} · FIFO laost`}
                                        </span>
                                      ) : (
                                        <div className={`finance-price-input-wrap ${isMissing ? 'missing' : ''}`}>
                                          {/* olemasolev sisend muutmata */}
                                        </div>
                                      )}
                                    </td>
```

(`{/* olemasolev sisend muutmata */}` kohale jääb praegune `<input …/>` ja `<span className="finance-unit-suffix">` täpselt nagu enne.) Salvestamisel ära saada materjaliridade hindu: leia koht, kus `prices` objekt `saveFinanceEntry`-le kokku pannakse (`grep -n "saveFinanceEntry" src/components/FinanceModal.tsx`) ja filtreeri välja read, mille `kind === 'MATERIAL'`.

CSS `src/index.css` lõppu:

```css
.stock-level-hint { font-size: 12px; color: var(--text-muted, #64748b); margin-left: 6px; white-space: nowrap; }
.finance-fifo-price { font-size: 13px; color: var(--text-muted, #64748b); }
.finance-fifo-price.missing { color: #d97706; }
```

- [ ] **Step 4: Andmemudeli dokumentatsioon** — `docs/andmemudel.md` lisa sektsioon (vorm nagu teistel sektsioonidel):

```markdown
## Laoarvestus

- `warehouses` — laod; täpselt üks põhiladu (`isDefault`); valikuline seos huvipunktiga (`poiId`).
- `stock_documents` / `stock_document_lines` — laokanded: arvele võtmine (summa km-ta), mahakandmine (põhjus), ülekanne (lähte- ja sihtladu). `fifoCost` ja `shortageQty` arvutab süsteem.
- `material_stock` — laoseisu koond materjali ja lao kaupa (kogus, väärtus, hindamata kogus); kirjutab ainult ümberarvutus.
- `work_entries.warehouseId` — ladu, kust kande materjalid võetakse (tühi = põhiladu).
- FIFO: liikumised arvutatakse iga muudatuse järel materjali kaupa uuesti (`src/server/stock.ts`); põllutöö kande materjalirea `unitPrice` = FIFO hind.
```

- [ ] **Step 5: Tüübikontroll, testid, release, käsitsi kontroll**

Run: `ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && npx tsc --noEmit -p tsconfig.app.json && npm run release'`
Käsitsi: ava põllutöö kanne materjaliga → lao valik (kui ladusid > 1) ja „Laos X kg“ materjali juures. Finantsvaates materjalirea hind on kirjutuskaitstud („ootab arvele võtmist“ või „… · FIFO laost“).

- [ ] **Step 6: Commit**

```bash
ssh debian@uvn-243-120.tll07.zonevs.eu 'cd /home/debian/teris && git add src/components/FieldWorkEntryDialog.tsx src/components/PriaLinesEditor.tsx src/components/FinanceModal.tsx src/index.css docs/andmemudel.md && git commit -m "Laoarvestus: põllutöö kande ladu ja laoseis, finantsvaates FIFO hind

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"'
```
