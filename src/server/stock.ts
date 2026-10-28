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
