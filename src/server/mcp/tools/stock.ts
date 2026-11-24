// src/server/mcp/tools/stock.ts — laoseis (kogus kõigile, raha finantsõigusega) ja laoliikumised (ainult finantsõigusega).
import { z } from 'zod';
import { prisma, tenantTransaction } from '../../db.ts';
import { convertQty } from '../../../services/units.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { saveStockDocument, StockValidationError } from '../../stock.ts';
import { defineTool, canSeeFinance, type McpContext } from '../context.ts';
import { pickOne, parseDateInput, dayAfter, fieldLabel, fmtDate, round2, limitRows, ToolInputError } from '../format.ts';

const canWriteStock = (ctx: McpContext): boolean => canSeeFinance(ctx) && !ctx.license.readOnly;
const tallinnTodayUtc = (): Date => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' }).format(new Date()).split('-');
  return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
};

async function resolveWarehouseId(query: string | undefined): Promise<string | undefined> {
  if (!query) return undefined;
  const rows = await prisma.warehouse.findMany({ select: { id: true, name: true } });
  return pickOne('Ladu', query, rows.map((w) => ({ id: w.id, label: w.name, keys: [w.name] }))).id;
}

const ci = (s: string) => ({ contains: s, mode: 'insensitive' as const });
const money = (x: unknown) => (x === null || x === undefined ? null : round2(Number(x)));

export const stockTools = [
  defineTool({
    name: 'list_stock_levels',
    title: 'Laoseis',
    description: 'Kaupade laoseis lao ja artikli kaupa (laoühikus). group = grupp (CONSUMABLE kulumaterjal, PRODUCE toodang, OTHER_GOODS muu kaup), category = kategooria. negative = laoseis on miinuses (kanded on kulutanud rohkem kui arvele võetud). Finantsõigusega ka väärtus (FIFO) ja keskmine hind.',
    input: { warehouse: z.string().optional().describe('Lao nimi'), article: z.string().optional().describe('Artikli nimi (tõstutundetu)') },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const warehouseId = await resolveWarehouseId(a.warehouse);
      const rows = await prisma.articleStock.findMany({
        where: { ...(warehouseId ? { warehouseId } : {}), ...(a.article ? { article: { name: ci(a.article) } } : {}), OR: [{ qty: { not: 0 } }, { unpricedQty: { not: 0 } }] },
        include: { article: { select: { name: true, unit: true, category: { select: { name: true, group: true } } } }, warehouse: { select: { name: true } } }
      });
      rows.sort((p, q) => p.warehouse.name.localeCompare(q.warehouse.name, 'et') || p.article.name.localeCompare(q.article.name, 'et'));
      return {
        total: rows.length, shown: rows.length,
        rows: rows.map((r) => ({
          warehouse: r.warehouse.name, article: r.article.name, group: r.article.category.group, category: r.article.category.name, quantity: round2(r.qty), unit: r.article.unit, negative: r.qty < 0,
          ...(finance ? { value: round2(Number(r.value)), avgPrice: r.pricedQty > 0 ? round2(Number(r.value) / r.pricedQty) : null, unpricedQty: round2(r.unpricedQty) } : {})
        }))
      };
    }
  }),
  defineTool({
    name: 'list_stock_movements',
    title: 'Laoliikumised',
    description: 'Laoliikumised: arvele võtmine (RECEIPT), mahakandmine (WRITE_OFF), ülekanne (TRANSFER), inventuur (INVENTORY: quantity = vahe, + juurde / − maha; counted = tegelik seis) põllutöö kande kulu (FIELD_WORK), saagipartii kaalumine (HARVEST_WEIGHING: quantity artikli ühikus, lot = partii, hinnata), ja partii kuivatuskulu kaubast (HARVEST_LOT_COST), koos tarnija, dokumendi nr ja maksumusega. Uuemad eespool.',
    when: canSeeFinance,
    input: {
      warehouse: z.string().optional().describe('Lao nimi'),
      article: z.string().optional().describe('Materjal (osaline nimi)'),
      from: z.string().optional().describe('Alates (pp.kk.aaaa)'),
      to: z.string().optional().describe('Kuni, kaasa arvatud (pp.kk.aaaa)'),
      limit: z.number().int().min(1).max(1000).optional()
    },
    run: async (a) => {
      const f = parseDateInput(a.from, 'from');
      const t = parseDateInput(a.to, 'to');
      if (f && t && f > t) throw new ToolInputError('Algus on hilisem kui lõpp');
      const date = f || t ? { ...(f ? { gte: f } : {}), ...(t ? { lt: dayAfter(t) } : {}) } : undefined;
      const warehouseId = await resolveWarehouseId(a.warehouse);
      const defaultWh = await prisma.warehouse.findFirst({ where: { isDefault: true }, select: { id: true, name: true } });
      const [docLines, entryLines, weighings, lotCosts] = await Promise.all([
        prisma.stockDocumentLine.findMany({
          where: {
            ...(a.article ? { article: { name: ci(a.article) } } : {}),
            document: { ...(date ? { date } : {}), ...(warehouseId ? { OR: [{ warehouseId }, { toWarehouseId: warehouseId }] } : {}) }
          },
          include: {
            article: { select: { name: true, unit: true } },
            document: { include: { warehouse: { select: { name: true } }, toWarehouse: { select: { name: true } }, supplier: { select: { name: true } } } }
          }
        }),
        prisma.workEntryLine.findMany({
          where: {
            kind: { in: ['MATERIAL', 'FUEL'] }, articleId: { not: null },
            ...(a.article ? { label: ci(a.article) } : {}),
            entry: {
              ...(date ? { date } : {}),
              ...(warehouseId ? (warehouseId === defaultWh?.id ? { OR: [{ warehouseId }, { warehouseId: null }] } : { warehouseId }) : {})
            }
          },
          include: {
            entry: {
              select: {
                date: true, warehouse: { select: { name: true } },
                fieldWork: { select: { workType: { select: { name: true, shortName: true } }, fieldSeason: { select: { field: { select: { num: true, name: true } } } } } }
              }
            }
          }
        }),
        prisma.harvestLotWeighing.findMany({
          where: {
            ...(date ? { date } : {}),
            lot: { ...(warehouseId ? { warehouseId } : {}), ...(a.article ? { article: { name: ci(a.article) } } : {}) }
          },
          include: { lot: { select: { name: true, warehouse: { select: { name: true } }, article: { select: { name: true, unit: true } } } } }
        }),
        prisma.harvestLotCost.findMany({
          where: {
            article: { category: { group: { not: 'SERVICE' } }, ...(a.article ? { name: ci(a.article) } : {}) },
            ...(date ? { date } : {}),
            // Kulu läheb artikli vaikimisi laost, puudumisel partii laost
            ...(warehouseId ? { OR: [{ article: { defaultWarehouseId: warehouseId } }, { article: { defaultWarehouseId: null }, lot: { warehouseId } }] } : {})
          },
          include: { article: { select: { name: true, unit: true, defaultWarehouse: { select: { name: true } } } }, lot: { select: { name: true, warehouse: { select: { name: true } } } } }
        })
      ]);
      type Row = { sortDate: Date; date: string | null; type: string; warehouse: string; toWarehouse?: string | null; article: string; quantity: number | null; counted?: number | null; shortageQty?: number | null; unit: string; supplier?: string | null; documentNo?: string | null; reason?: string | null; notes?: string | null; field?: string; work?: string; lot?: string; cost: number | null };
      const rows: Row[] = [
        ...docLines.map((l) => ({
          sortDate: l.document.date, date: fmtDate(l.document.date), type: l.document.kind, warehouse: l.document.warehouse.name, toWarehouse: l.document.toWarehouse?.name ?? null,
          article: l.article.name,
          quantity: l.document.kind === 'INVENTORY' ? round2(l.diffQty ?? 0) : round2(l.quantity),
          ...(l.document.kind === 'INVENTORY' ? { counted: round2(l.countedQty ?? 0) } : {}),
          ...(l.shortageQty ? { shortageQty: round2(l.shortageQty) } : {}),
          unit: l.article.unit, supplier: l.document.supplier?.name ?? null, documentNo: l.document.documentNo,
          reason: l.document.writeOffReason, notes: l.document.notes,
          cost: money(l.document.kind === 'RECEIPT' ? l.amount : l.document.kind === 'INVENTORY' && (l.diffQty ?? 0) > 0 ? l.amount : l.document.kind === 'INVENTORY' && (l.diffQty ?? 0) === 0 ? 0 : l.fifoCost)
        })),
        ...entryLines.map((l) => ({
          sortDate: l.entry.date, date: fmtDate(l.entry.date), type: 'FIELD_WORK', warehouse: l.entry.warehouse?.name ?? defaultWh?.name ?? '',
          article: l.label, quantity: round2(l.quantity), unit: l.unit,
          field: fieldLabel(l.entry.fieldWork.fieldSeason.field), work: workTypeDisplayName(l.entry.fieldWork.workType),
          cost: l.unitPrice === null ? null : round2(Number(l.unitPrice) * l.quantity)
        })),
        ...weighings.flatMap((w) => {
          const qty = convertQty(w.tonnes, 't', w.lot.article.unit);
          // Teisendamatu kaalumine ei ole laoarvestuses: ära näita 0-ga
          if (qty === null) return [];
          return [{
            sortDate: w.date, date: fmtDate(w.date), type: 'HARVEST_WEIGHING', warehouse: w.lot.warehouse.name,
            article: w.lot.article.name, quantity: Math.round(qty * 1e6) / 1e6, unit: w.lot.article.unit,
            lot: w.lot.name, notes: w.notes, cost: null
          }];
        }),
        ...lotCosts.map((c) => ({
          sortDate: c.date, date: fmtDate(c.date), type: 'HARVEST_LOT_COST', warehouse: c.article.defaultWarehouse?.name ?? c.lot.warehouse.name,
          article: c.article.name, quantity: round2(c.quantity), unit: c.article.unit,
          lot: c.lot.name, notes: c.notes, cost: c.unitPrice === null ? null : round2(Number(c.unitPrice) * c.quantity)
        }))
      ];
      rows.sort((p, q) => q.sortDate.getTime() - p.sortDate.getTime());
      const out = limitRows(rows, a.limit);
      return { total: out.total, shown: out.shown, rows: out.rows.map(({ sortDate: _s, ...r }) => r) };
    }
  }),
  defineTool({
    name: 'list_warehouses',
    title: 'Laod',
    description: 'Kõik laod: nimi, kas põhiladu (isDefault), aktiivsus, seotud huvipunkt või põld (põllu ladu koristatud punkritele), märkused.',
    input: { includeInactive: z.boolean().optional().describe('Kaasa ka mitteaktiivsed laod (vaikimisi false)') },
    run: async (a) => {
      const rows = await prisma.warehouse.findMany({
        where: a.includeInactive ? {} : { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        include: { poi: { select: { name: true } }, field: { select: { num: true, name: true } } }
      });
      return {
        total: rows.length,
        rows: rows.map((w) => ({
          name: w.name, isDefault: w.isDefault, isActive: w.isActive,
          poi: w.poi?.name ?? null, field: w.field ? fieldLabel(w.field) : null, notes: w.notes
        }))
      };
    }
  }),
  defineTool({
    name: 'create_stock_inventory',
    title: 'Loo inventuurikanne (laoseisu korrigeerimine)',
    description: 'Korrigeerib artiklite laoseisu, luues inventuurikande (INVENTORY) etteantud tegelike koguste järgi. Arvutab vahe (diffQty) ja uuendab laoseisu. Nõuab finantsõigust ja aktiivset litsentsi.',
    readOnly: false,
    when: canWriteStock,
    input: {
      warehouse: z.string().optional().describe('Lao nimi (tühi = põhiladu)'),
      date: z.string().optional().describe('Inventuuri kuupäev (pp.kk.aaaa või aaaa-kk-pp; vaikimisi täna)'),
      documentNo: z.string().max(80).optional().describe('Dokumendi number'),
      notes: z.string().max(2000).optional().describe('Märkus'),
      items: z.array(z.object({
        article: z.string().min(1).describe('Artikli nimi'),
        actualQty: z.number().min(0).describe('Tegelik praegune laoseis laoühikus (0 = kogu seis maha)')
      })).min(1).max(200).describe('Artiklid ja nende tegelikud laoseisud')
    },
    run: async (a) => {
      const warehouseId = a.warehouse
        ? (await resolveWarehouseId(a.warehouse))!
        : (await prisma.warehouse.findFirst({ where: { isDefault: true }, select: { id: true } }))?.id;
      if (!warehouseId) throw new ToolInputError('Põhiladu ei leitud');

      const date = parseDateInput(a.date, 'date') ?? tallinnTodayUtc();
      const allArticles = await prisma.article.findMany({
        select: { id: true, name: true, unit: true, category: { select: { group: true } } }
      });
      const candidates = allArticles.map((r) => ({ id: r.id, label: r.name, keys: [r.name] }));
      const byId = new Map(allArticles.map((r) => [r.id, r]));

      const lines: { articleId: string; quantity: number; amount: number | null; countedQty: number }[] = [];
      const seen = new Set<string>();
      for (const item of a.items) {
        const hit = pickOne('Artikkel', item.article, candidates);
        const art = byId.get(hit.id)!;
        if (art.category.group === 'SERVICE') throw new ToolInputError(`Teenusel "${art.name}" ei ole laoseisu`);
        if (seen.has(art.id)) throw new ToolInputError(`Artikkel "${art.name}" on inventuuris mitu korda`);
        seen.add(art.id);
        lines.push({ articleId: art.id, quantity: 0, amount: null, countedQty: item.actualQty });
      }

      let savedId: string;
      try {
        savedId = await tenantTransaction((tx) => saveStockDocument(tx, null, {
          kind: 'INVENTORY',
          date,
          warehouseId,
          toWarehouseId: null,
          supplierId: null,
          documentNo: a.documentNo?.trim() || null,
          writeOffReason: null,
          notes: a.notes?.trim() || null,
          lines
        }), { timeout: 60000 });
      } catch (err) {
        if (err instanceof StockValidationError) throw new ToolInputError(err.message);
        throw err;
      }

      const saved = await prisma.stockDocument.findUniqueOrThrow({
        where: { id: savedId },
        include: {
          warehouse: { select: { name: true } },
          lines: { orderBy: { sortOrder: 'asc' }, include: { article: { select: { name: true, unit: true } } } }
        }
      });
      return {
        documentId: saved.id,
        kind: saved.kind,
        date: fmtDate(saved.date),
        warehouse: saved.warehouse.name,
        documentNo: saved.documentNo,
        notes: saved.notes,
        lines: saved.lines.map((l) => {
          const diff = l.diffQty ?? 0;
          return {
            article: l.article.name,
            unit: l.article.unit,
            countedQty: round2(l.countedQty),
            diffQty: round2(diff),
            cost: money(diff > 0 ? l.amount : diff === 0 ? 0 : l.fifoCost)
          };
        })
      };
    }
  })
];
