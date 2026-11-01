// src/server/stockApi.ts — laod, laokanded, laoseis ja laokaart (HTTP). Reeglid: stockRules.ts, stock.ts.
// Laoseisu kogust näevad kõik; raha ning ladude ja laokannete muutmine ainult finantsjuhile ja adminile.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, tenantTransaction } from './db.ts';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';
import { parseStockDocument, stockRequiresFinance, stockCardFinanceFields } from './stockRules.ts';
import { getDefaultWarehouseId, loadMovements, saveStockDocument, deleteStockDocument, saveWarehouse, StockValidationError } from './stock.ts';
import { fifoReplay, movementCost, sortMovements } from './stockFifo.ts';
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
  lines: { orderBy: { sortOrder: 'asc' as const }, include: { article: { select: { name: true, unit: true } } } }
};

function documentDto(d: any) {
  const lines = d.lines.map((l: any) => ({
    id: l.id, articleId: l.articleId, articleName: l.article.name, unit: l.article.unit,
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
    hasShortage: d.kind === 'TRANSFER' && lines.some((l: any) => (l.shortageQty ?? 0) > 0),
    lines
  };
}

export async function handleStock(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL): Promise<boolean> {
  if (!pathname.startsWith('/api/warehouses') && !pathname.startsWith('/api/stock/')) return false;
  const finance = canSeeFinance(req);
  const idOf = (prefix: string) => decodeURIComponent(pathname.slice(prefix.length));
  if (!finance && stockRequiresFinance(pathname, method)) {
    json(res, { error: FINANCE_FORBIDDEN }, 403);
    return true;
  }

  // --- Laod ---
  if (pathname === '/api/warehouses' && method === 'GET') {
    await tenantTransaction((tx) => getDefaultWarehouseId(tx));
    const rows = await prisma.warehouse.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], include: { poi: { select: { name: true } } } });
    json(res, rows.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault, isActive: w.isActive, poiId: w.poiId, poiName: w.poi?.name ?? null, notes: w.notes })));
    return true;
  }
  if (pathname === '/api/warehouses' && method === 'POST') {
    const b = await parseBody(req);
    const id = text(b?.id, 64);
    const name = text(b?.name, 120);
    if (!name) {
      json(res, { error: 'Lao nimi on kohustuslik' }, 400);
      return true;
    }
    try {
      const saved = await tenantTransaction((tx) => saveWarehouse(tx, id, {
        name, isDefault: b?.isDefault === true, isActive: b?.isActive !== false, poiId: text(b?.poiId, 64), notes: text(b?.notes, 1000)
      }));
      json(res, saved);
    } catch (err: any) {
      if (err instanceof StockValidationError) json(res, { error: err.message }, 400);
      else if (err?.code === 'P2002') json(res, { error: 'Sama nime või huvipunktiga ladu on juba olemas' }, 409);
      else throw err;
    }
    return true;
  }
  if (pathname.startsWith('/api/warehouses/') && method === 'DELETE') {
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
    const rows = await prisma.articleStock.findMany({ where: warehouseId ? { warehouseId } : {}, select: { articleId: true, qty: true } });
    const sum = new Map<string, number>();
    for (const r of rows) sum.set(r.articleId, Math.round(((sum.get(r.articleId) ?? 0) + r.qty) * 1e6) / 1e6);
    json(res, [...sum].map(([articleId, qty]) => ({ articleId, qty })));
    return true;
  }

  // --- Laokaart ---
  const mv = /^\/api\/stock\/articles\/([^/]+)\/movements$/.exec(pathname);
  if (mv && method === 'GET') {
    const articleId = decodeURIComponent(mv[1]);
    const warehouseId = text(url.searchParams.get('warehouseId'), 64);
    const result = await tenantTransaction(async (tx) => {
      const [mm] = await loadMovements(tx, [articleId]);
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
        const cost = m.kind === 'IN' ? (m.amount ?? 0) : movementCost(m.kind, o);
        if (type === 'doc') {
          const l = docById.get(lineId)!;
          // Tarnija ja dokumendi nr on ostuinfo — ainult finantsõigusega
          const moneyPart = stockCardFinanceFields(finance, { cost, documentNo: l.document.documentNo, supplierName: l.document.supplier?.name ?? null });
          rows.push({ ...base, ...moneyPart, source: 'DOCUMENT', documentId: l.documentId, documentKind: l.document.kind,
            writeOffReason: l.document.writeOffReason, shortageQty: l.shortageQty });
        } else {
          const l = entryById.get(lineId)!;
          rows.push({ ...base, ...stockCardFinanceFields(finance, { cost }), source: 'FIELD_WORK', entryId: l.entry.id,
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
    if (!result) json(res, { error: 'Artiklit ei leitud' }, 404);
    else json(res, result);
    return true;
  }

  // --- Laokanded (finants; õigus kontrollitud ülal) ---
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
