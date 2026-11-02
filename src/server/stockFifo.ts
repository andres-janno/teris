// src/server/stockFifo.ts — ühe materjali FIFO arvutus kõigis ladudes (puhas funktsioon).
// Liikumised käiakse kuupäeva järjekorras läbi; sama päeva sees enne sissetulek, siis ülekanne, siis väljaminek, viimasena inventuur.
// Väljaminek võtab lao vanimast partiist; partiide puudumisel tekib võlg, mille järgmine sissetulek katab
// (võla read saavad selle partii hinna). Ülekanne viib võetud partiid koos hinnaga sihtlattu.
export type MovementKind = 'IN' | 'TRANSFER' | 'OUT' | 'COUNT';

export interface Movement {
  ref: string; // nt 'doc:<reaId>' või 'entry:<reaId>'
  date: string; // YYYY-MM-DD
  seq: number; // sama päeva ja liigi sees stabiilne järjekord
  kind: MovementKind;
  warehouseId: string; // IN: sihtladu; TRANSFER ja OUT: lähteladu; COUNT: inventeeritav ladu
  toWarehouseId?: string; // TRANSFER: sihtladu
  quantity: number; // laoühikus, > 0; COUNT: tegelik seis (≥ 0)
  amount?: number; // IN: rea summa; puudub = hinnata sissetulek (saagi kaalumine)
}

export interface OutResult {
  cost: number; // hinnatud osa maksumus
  unpricedQty: number; // hindamata kogus (võlg või hindamata partii)
  shortageQty: number; // ainult TRANSFER: kogus, mida lähtelaos hinnaga partiina polnud
  missingQty: number; // ainult TRANSFER: kogus, mida lähtelaos füüsiliselt polnud (võlg); hindamata partii ei lähe siia
}

export interface WarehouseStock {
  qty: number;
  value: number;
  unpricedQty: number;
  pricedQty: number; // hinnatud partiide kogus (keskmise hinna jagaja)
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

interface Lot { qty: number; unitCost: number | null }
interface Debt { ref: string; qty: number }

const EPS = 1e-9;
const KIND_ORDER: Record<MovementKind, number> = { IN: 0, TRANSFER: 1, OUT: 2, COUNT: 3 };
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const roundQ = (n: number) => Math.round(n * 1e6) / 1e6;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function sortMovements(movements: Movement[]): Movement[] {
  return [...movements].sort(
    (a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.seq - b.seq
  );
}

export function fifoReplay(movements: Movement[]): ReplayResult {
  const lots = new Map<string, Lot[]>();
  const debts = new Map<string, Debt[]>();
  const outs = new Map<string, OutResult>();
  const counts = new Map<string, CountResult>();
  let lastReceipt: number | null = null;
  const lotsOf = (w: string) => lots.get(w) ?? (lots.set(w, []), lots.get(w)!);
  const debtsOf = (w: string) => debts.get(w) ?? (debts.set(w, []), debts.get(w)!);
  const outOf = (ref: string) => outs.get(ref) ?? (outs.set(ref, { cost: 0, unpricedQty: 0, shortageQty: 0, missingQty: 0 }), outs.get(ref)!);

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
      o.missingQty += missing;
      o.shortageQty += missing + pieces.filter((p) => p.unitCost === null).reduce((s, p) => s + p.qty, 0);
      for (const p of pieces) receive(to, p.qty, p.unitCost);
      if (missing > 0) receive(to, missing, null);
    }
  };

  for (const m of sortMovements(movements)) {
    if (m.kind === 'IN') {
      // Summata sissetulek (saagi kaalumine) on hinnata partii
      const unitCost = m.amount === undefined ? null : m.quantity > 0 ? m.amount / m.quantity : 0;
      receive(m.warehouseId, m.quantity, unitCost);
      if (unitCost !== null && m.quantity > 0) lastReceipt = unitCost;
      continue;
    }
    if (m.kind === 'COUNT') {
      // Inventuur: vahe arvestuslikust seisust; puudujääk FIFO järgi maha, ülejääk lao keskmise hinnaga juurde
      const ls = lotsOf(m.warehouseId);
      const book = ls.reduce((s, l) => s + l.qty, 0) - debtsOf(m.warehouseId).reduce((s, d) => s + d.qty, 0);
      const counted = Math.max(0, m.quantity);
      const diff = roundQ(counted - book) + 0;
      let amount: number | null = null;
      if (diff < 0) issue(m, Math.min(-diff, ls.reduce((s, l) => s + l.qty, 0)));
      else if (diff > 0) {
        // Ülejääk, mis katab varasema võla, hindab selle väljamineku ümber; amount katab kogu vahe
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

  const stock = new Map<string, WarehouseStock>();
  for (const w of new Set([...lots.keys(), ...debts.keys()])) {
    const ls = lots.get(w) ?? [];
    const ds = debts.get(w) ?? [];
    const lotQty = ls.reduce((s, l) => s + l.qty, 0);
    const pricedQty = ls.reduce((s, l) => s + (l.unitCost === null ? 0 : l.qty), 0);
    const debtQty = ds.reduce((s, d) => s + d.qty, 0);
    stock.set(w, {
      qty: roundQ(lotQty - debtQty) + 0,
      value: round2(ls.reduce((s, l) => s + (l.unitCost === null ? 0 : l.qty * l.unitCost), 0)) + 0,
      unpricedQty: roundQ(debtQty + ls.filter((l) => l.unitCost === null).reduce((s, l) => s + l.qty, 0)) + 0,
      pricedQty: roundQ(pricedQty) + 0
    });
  }
  for (const o of outs.values()) {
    o.cost = round2(o.cost) + 0;
    o.unpricedQty = roundQ(o.unpricedQty) + 0;
    o.shortageQty = roundQ(o.shortageQty) + 0;
    o.missingQty = roundQ(o.missingQty) + 0;
  }
  return { outs, counts, stock, lastReceiptUnitCost: lastReceipt };
}

/**
 * Liikumise maksumus kandel: hinnatud osa summa, kui kogu kogus on hinnatud; muidu null.
 * Puudujäägiga ülekanne jääb maksumuseta ka siis, kui hilisem arvele võtmine lähtelao võla katab —
 * sihtlattu läks puudujääk hindamatuna ja maksumus selle eest tekitaks väärtuse augu.
 */
export function movementCost(kind: MovementKind, o: OutResult | undefined): number | null {
  if (!o || o.unpricedQty !== 0) return null;
  if (kind === 'TRANSFER' && o.shortageQty > 0) return null;
  return o.cost;
}

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
