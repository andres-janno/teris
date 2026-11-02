// src/server/stock.ts — laoseisu ümberarvutus: loeb materjali liikumised (laokanded + põllutöö kande
// kulumaterjali- ja kütuseread; laokanded sh inventuur; saagipartii kaalumised ja kauba kuivatuskulud), käivitab FIFO (stockFifo.ts) ja kirjutab tulemuse kanderidade ühikuhinnaks,
// laokande ridade maksumuseks ja koondtabelisse article_stock. Kutsu samas tehingus pärast iga
// liikumist muutvat salvestust.
import type { TxClient } from './db.ts';
import { fifoReplay, movementCost, type Movement } from './stockFifo.ts';
import { convertQty } from '../services/units.ts';
import { entryLineWarehouseId } from '../services/articleRules.ts';
import { inventoryNoticeText, type StockDocumentInput } from './stockRules.ts';

export class StockValidationError extends Error {}

const DEFAULT_WAREHOUSE_NAME = 'Põhiladu';
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const round4 = (n: number) => Math.round(n * 10000) / 10000;

// Põhilao loomine ja vahetus serialiseeritakse ettevõtte piires tehingulukuga (osalist unikaalset
// indeksit ei kasutata, sest prisma db push eemaldaks skeemivälise indeksi). Lukk vabaneb tehingu lõpus.
async function lockDefaultWarehouse(tx: TxClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('warehouse-default:' || current_setting('app.tenant_id')))`;
}

/** Põhilao id; puudumisel luuakse "Põhiladu" (uus ettevõte, esimene kasutus). */
export async function getDefaultWarehouseId(tx: TxClient): Promise<string> {
  const found = await tx.warehouse.findFirst({ where: { isDefault: true }, select: { id: true } });
  if (found) return found.id;
  await lockDefaultWarehouse(tx);
  // Lukku oodates võis teine tehing põhilao juba luua
  const created = await tx.warehouse.findFirst({ where: { isDefault: true }, select: { id: true } });
  if (created) return created.id;
  const byName = await tx.warehouse.findFirst({ where: { name: DEFAULT_WAREHOUSE_NAME }, select: { id: true } });
  if (byName) {
    await tx.warehouse.update({ where: { id: byName.id }, data: { isDefault: true, isActive: true } });
    return byName.id;
  }
  return (await tx.warehouse.create({ data: { name: DEFAULT_WAREHOUSE_NAME, isDefault: true } })).id;
}

export interface WarehouseInput { name: string; isDefault: boolean; isActive: boolean; poiId: string | null; notes: string | null }

/** Lao lisamine või muutmine. Põhilaoks märkimine võtab märke teistelt; põhiladu ei saa lihtsalt maha võtta. */
export async function saveWarehouse(tx: TxClient, id: string | null, w: WarehouseInput) {
  await lockDefaultWarehouse(tx);
  const old = id ? await tx.warehouse.findUnique({ where: { id } }) : null;
  if (id && !old) throw new StockValidationError('Ladu ei leitud');
  if (old?.isDefault && !w.isDefault) throw new StockValidationError('Põhiladu muudetakse, kui mõni teine ladu märgitakse põhilaoks');
  const data = { ...w, isActive: w.isDefault || w.isActive };
  if (data.isDefault) await tx.warehouse.updateMany({ where: { isDefault: true, ...(id ? { NOT: { id } } : {}) }, data: { isDefault: false } });
  return id ? tx.warehouse.update({ where: { id }, data }) : tx.warehouse.create({ data });
}

/**
 * Põllutöö kande ladu, mis salvestatakse alati päris id-na (põhilao vahetus ei tohi ajalugu liigutada).
 * Valimata → kande senine ladu või põhiladu. Kande senine ladu jääb alles ka mitteaktiivsena;
 * teise lao valikul peab see olema aktiivne.
 */
export async function resolveEntryWarehouseId(tx: TxClient, requested: string | null, current: string | null): Promise<string> {
  if (!requested) return current ?? getDefaultWarehouseId(tx);
  if (requested === current) return requested;
  const w = await tx.warehouse.findUnique({ where: { id: requested }, select: { isActive: true } });
  if (!w) throw new StockValidationError('Ladu ei leitud');
  if (!w.isActive) throw new StockValidationError('Valitud ladu ei ole aktiivne. Vali aktiivne ladu.');
  return requested;
}

export interface ArticleMovements {
  articleId: string;
  unit: string;
  movements: Movement[];
  entryLines: { id: string; ref: string; quantity: number }[];
  docLines: { id: string; ref: string; kind: 'RECEIPT' | 'WRITE_OFF' | 'TRANSFER' | 'INVENTORY' }[];
  issueEntryLineIds: string[];
  lotCostLines: { id: string; ref: string; quantity: number }[];
}

export async function loadMovements(tx: TxClient, articleIds: string[]): Promise<ArticleMovements[]> {
  if (!articleIds.length) return [];
  const defaultWh = await getDefaultWarehouseId(tx);
  const [articles, docLines, entryLines, weighings, lotCosts] = await Promise.all([
    tx.article.findMany({ where: { id: { in: articleIds } }, select: { id: true, unit: true, defaultWarehouseId: true } }),
    tx.stockDocumentLine.findMany({
      where: { articleId: { in: articleIds } },
      select: {
        id: true, articleId: true, quantity: true, amount: true, sortOrder: true, countedQty: true,
        document: { select: { kind: true, date: true, warehouseId: true, toWarehouseId: true, createdAt: true } }
      }
    }),
    tx.workEntryLine.findMany({
      where: { kind: { in: ['MATERIAL', 'FUEL'] }, articleId: { in: articleIds } },
      select: { id: true, articleId: true, kind: true, quantity: true, unit: true, sortOrder: true, entry: { select: { date: true, warehouseId: true, createdAt: true } } }
    }),
    tx.harvestLotWeighing.findMany({
      where: { lot: { articleId: { in: articleIds } } },
      select: { id: true, date: true, tonnes: true, createdAt: true, lot: { select: { articleId: true, warehouseId: true } } }
    }),
    tx.harvestLotCost.findMany({
      where: { articleId: { in: articleIds }, article: { category: { group: { not: 'SERVICE' } } } },
      select: { id: true, articleId: true, date: true, quantity: true, createdAt: true, lot: { select: { warehouseId: true } } }
    })
  ]);
  return articles.map((m) => {
    const out: ArticleMovements = { articleId: m.id, unit: m.unit, movements: [], entryLines: [], docLines: [], issueEntryLineIds: [], lotCostLines: [] };
    for (const l of docLines.filter((x) => x.articleId === m.id)) {
      const ref = `doc:${l.id}`;
      const doc = l.document;
      out.docLines.push({ id: l.id, ref, kind: doc.kind });
      out.movements.push({
        ref, date: isoDay(doc.date), seq: doc.createdAt.getTime() * 1000 + l.sortOrder,
        kind: doc.kind === 'RECEIPT' ? 'IN' : doc.kind === 'TRANSFER' ? 'TRANSFER' : doc.kind === 'INVENTORY' ? 'COUNT' : 'OUT',
        warehouseId: doc.warehouseId, toWarehouseId: doc.toWarehouseId ?? undefined,
        // Inventuuril on liikumise kogus tegelik seis
        quantity: doc.kind === 'INVENTORY' ? l.countedQty ?? 0 : l.quantity,
        amount: l.amount === null ? undefined : Number(l.amount)
      });
    }
    for (const l of entryLines.filter((x) => x.articleId === m.id)) {
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
        // Tühi ladu (vana kanne enne ühekordset täitmist) — varuvariandina põhiladu; kütus artikli vaikimisi laost
        kind: 'OUT', warehouseId: entryLineWarehouseId(l.kind as 'MATERIAL' | 'FUEL', m.defaultWarehouseId, l.entry.warehouseId ?? defaultWh), quantity: qty
      });
    }
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
    return out;
  });
}

export async function recomputeArticleStock(tx: TxClient, articleIds: string[]): Promise<void> {
  const ids = [...new Set(articleIds.filter(Boolean))];
  for (const mm of await loadMovements(tx, ids)) {
    const { outs, counts, stock } = fifoReplay(mm.movements);

    // Põllutöö kanderead: ühikuhind kanderea ühikus; hindamata või teisendamatu → null
    const current = new Map(
      (await tx.workEntryLine.findMany({ where: { kind: { in: ['MATERIAL', 'FUEL'] }, articleId: mm.articleId }, select: { id: true, unitPrice: true } }))
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

    // Partii kuivatuskulu (kaup): FIFO ühikuhind; hindamata → null
    for (const l of mm.lotCostLines) {
      const o = outs.get(l.ref);
      await tx.harvestLotCost.update({ where: { id: l.id }, data: { unitPrice: o && o.unpricedQty === 0 ? round4(o.cost / l.quantity) : null } });
    }

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

    await tx.articleStock.deleteMany({ where: { articleId: mm.articleId } });
    const rows = [...stock].map(([warehouseId, s]) => ({ articleId: mm.articleId, warehouseId, qty: s.qty, value: s.value, unpricedQty: s.unpricedQty, pricedQty: s.pricedQty }));
    if (rows.length) await tx.articleStock.createMany({ data: rows });
    await tx.article.update({ where: { id: mm.articleId }, data: { stockIssueCount: mm.issueEntryLineIds.length } });
  }
}

export async function recomputeAllArticleStock(tx: TxClient): Promise<void> {
  const ids = (await tx.article.findMany({ select: { id: true } })).map((m) => m.id);
  await recomputeArticleStock(tx, ids);
}

/** Ülekande read, millel on puudujääk (võti documentId:articleId) — salvestuse eel ja järel võrdlemiseks. */
export async function transferShortageKeys(tx: TxClient, articleIds: string[]): Promise<Set<string>> {
  const rows = await tx.stockDocumentLine.findMany({
    where: { articleId: { in: articleIds }, shortageQty: { gt: 0 }, document: { kind: 'TRANSFER' } },
    select: { documentId: true, articleId: true }
  });
  return new Set(rows.map((r) => `${r.documentId}:${r.articleId}`));
}

export interface StockSummary { qty: number; value: number; unpricedQty: number; pricedQty: number }

/** Materjalide laoseis: valitud lao või kõigi ladude summa. */
export async function articleStockSummary(tx: TxClient, warehouseId: string | null): Promise<Map<string, StockSummary>> {
  const rows = await tx.articleStock.findMany({ where: warehouseId ? { warehouseId } : {} });
  const out = new Map<string, StockSummary>();
  for (const r of rows) {
    const s = out.get(r.articleId) ?? { qty: 0, value: 0, unpricedQty: 0, pricedQty: 0 };
    s.qty = Math.round((s.qty + r.qty) * 1e6) / 1e6;
    s.value = Math.round((s.value + Number(r.value)) * 100) / 100;
    s.unpricedQty = Math.round((s.unpricedQty + r.unpricedQty) * 1e6) / 1e6;
    s.pricedQty = Math.round((s.pricedQty + r.pricedQty) * 1e6) / 1e6;
    out.set(r.articleId, s);
  }
  return out;
}

const fmtDay = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('.');

// Uus ülekande puudujääk (mida enne muudatust polnud) lükkab muudatuse tagasi; tehing veereb tagasi.
// Lükatakse tagasi ainult lähtelaos füüsiliselt puuduv kogus; olemasolev, kuid hindamata kaup (nt inventuuriga leitud) on ülekantav.
async function assertNoNewShortage(tx: TxClient, articleIds: string[], before: Set<string>) {
  const after = await transferShortageKeys(tx, articleIds);
  const fresh = [...after].filter((k) => !before.has(k));
  if (!fresh.length) return;
  const replays = new Map<string, ReturnType<typeof fifoReplay>>();
  for (const key of fresh) {
    const [documentId, articleId] = key.split(':');
    if (!replays.has(articleId)) replays.set(articleId, fifoReplay((await loadMovements(tx, [articleId]))[0].movements));
    const lines = await tx.stockDocumentLine.findMany({
      where: { documentId, articleId },
      select: { id: true, quantity: true, article: { select: { name: true, unit: true } }, document: { select: { date: true, warehouse: { select: { name: true } } } } }
    });
    for (const line of lines) {
      const missing = replays.get(articleId)!.outs.get(`doc:${line.id}`)?.missingQty ?? 0;
      if (missing <= 0) continue;
      const available = Math.max(0, line.quantity - missing);
      throw new StockValidationError(
        `Laos "${line.document.warehouse.name}" on ${fmtDay(line.document.date)} seisuga materjali "${line.article.name}" ` +
        `ülekandeks saadaval ${available.toLocaleString('et-EE', { maximumFractionDigits: 3 })} ${line.article.unit}.`
      );
    }
  }
}

export async function saveStockDocument(tx: TxClient, id: string | null, doc: StockDocumentInput): Promise<string> {
  const whIds = [doc.warehouseId, doc.toWarehouseId].filter((x): x is string => !!x);
  const whs = await tx.warehouse.findMany({ where: { id: { in: whIds } }, select: { id: true } });
  if (whs.length !== whIds.length) throw new StockValidationError('Ladu ei leitud');
  const arts = await tx.article.findMany({ where: { id: { in: doc.lines.map((l) => l.articleId) } }, select: { category: { select: { group: true } } } });
  if (arts.length !== new Set(doc.lines.map((l) => l.articleId)).size) throw new StockValidationError('Artiklit ei leitud');
  if (arts.some((a) => a.category.group === 'SERVICE')) throw new StockValidationError('Teenust ei saa laokandele panna');

  const oldArticleIds = id
    ? (await tx.stockDocumentLine.findMany({ where: { documentId: id }, select: { articleId: true } })).map((l) => l.articleId)
    : [];
  const articleIds = [...new Set([...oldArticleIds, ...doc.lines.map((l) => l.articleId)])];
  const before = await transferShortageKeys(tx, articleIds);
  if (id) before.forEach((k) => k.startsWith(`${id}:`) && before.delete(k)); // muudetav kanne kontrollitakse uuesti

  const header = {
    kind: doc.kind, date: doc.date, warehouseId: doc.warehouseId, toWarehouseId: doc.toWarehouseId,
    supplierId: doc.supplierId, documentNo: doc.documentNo, writeOffReason: doc.writeOffReason, notes: doc.notes
  };
  const lines = doc.lines.map((l, i) => ({ articleId: l.articleId, quantity: l.quantity, amount: l.amount, countedQty: l.countedQty ?? null, sortOrder: i }));
  let docId = id;
  if (id) {
    await tx.stockDocumentLine.deleteMany({ where: { documentId: id } });
    await tx.stockDocument.update({ where: { id }, data: { ...header, lines: { create: lines } } });
  } else {
    docId = (await tx.stockDocument.create({ data: { ...header, lines: { create: lines } } })).id;
  }
  await recomputeArticleStock(tx, articleIds);
  await assertNoNewShortage(tx, articleIds, before);
  return docId!;
}

export async function deleteStockDocument(tx: TxClient, id: string): Promise<void> {
  const articleIds = (await tx.stockDocumentLine.findMany({ where: { documentId: id }, select: { articleId: true } })).map((l) => l.articleId);
  const before = await transferShortageKeys(tx, articleIds);
  await tx.stockDocument.delete({ where: { id } });
  await recomputeArticleStock(tx, articleIds);
  await assertNoNewShortage(tx, articleIds, before);
}

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
