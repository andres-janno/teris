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
