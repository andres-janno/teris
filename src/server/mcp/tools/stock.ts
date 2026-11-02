// src/server/mcp/tools/stock.ts — laoseis (kogus kõigile, raha finantsõigusega) ja laoliikumised (ainult finantsõigusega).
import { z } from 'zod';
import { prisma } from '../../db.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { defineTool, canSeeFinance } from '../context.ts';
import { pickOne, parseDateInput, dayAfter, fieldLabel, fmtDate, round2, limitRows, ToolInputError } from '../format.ts';

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
    description: 'Kaupade laoseis lao ja artikli kaupa (laoühikus). group = rühm (CONSUMABLE kulumaterjal, PRODUCE toodang, OTHER_GOODS muu kaup), category = liik. negative = laoseis on miinuses (kanded on kulutanud rohkem kui arvele võetud). Finantsõigusega ka väärtus (FIFO) ja keskmine hind.',
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
    description: 'Laoliikumised: arvele võtmine (RECEIPT), mahakandmine (WRITE_OFF), ülekanne (TRANSFER), inventuur (INVENTORY: quantity = vahe, + juurde / − maha; counted = tegelik seis) ja põllutöö kande kulu (FIELD_WORK), koos tarnija, dokumendi nr ja maksumusega. Uuemad eespool.',
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
      const [docLines, entryLines] = await Promise.all([
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
        })
      ]);
      type Row = { sortDate: Date; date: string | null; type: string; warehouse: string; toWarehouse?: string | null; article: string; quantity: number | null; counted?: number | null; unit: string; supplier?: string | null; documentNo?: string | null; reason?: string | null; field?: string; work?: string; cost: number | null };
      const rows: Row[] = [
        ...docLines.map((l) => ({
          sortDate: l.document.date, date: fmtDate(l.document.date), type: l.document.kind, warehouse: l.document.warehouse.name, toWarehouse: l.document.toWarehouse?.name ?? null,
          article: l.article.name,
          quantity: l.document.kind === 'INVENTORY' ? round2(l.diffQty ?? 0) : round2(l.quantity),
          ...(l.document.kind === 'INVENTORY' ? { counted: round2(l.countedQty ?? 0) } : {}),
          unit: l.article.unit, supplier: l.document.supplier?.name ?? null, documentNo: l.document.documentNo,
          reason: l.document.writeOffReason, cost: money(l.document.kind === 'RECEIPT' ? l.amount : l.document.kind === 'INVENTORY' && (l.diffQty ?? 0) > 0 ? l.amount : l.document.kind === 'INVENTORY' && (l.diffQty ?? 0) === 0 ? 0 : l.fifoCost)
        })),
        ...entryLines.map((l) => ({
          sortDate: l.entry.date, date: fmtDate(l.entry.date), type: 'FIELD_WORK', warehouse: l.entry.warehouse?.name ?? defaultWh?.name ?? '',
          article: l.label, quantity: round2(l.quantity), unit: l.unit,
          field: fieldLabel(l.entry.fieldWork.fieldSeason.field), work: workTypeDisplayName(l.entry.fieldWork.workType),
          cost: l.unitPrice === null ? null : round2(Number(l.unitPrice) * l.quantity)
        }))
      ];
      rows.sort((p, q) => q.sortDate.getTime() - p.sortDate.getTime());
      const out = limitRows(rows, a.limit);
      return { total: out.total, shown: out.shown, rows: out.rows.map(({ sortDate: _s, ...r }) => r) };
    }
  })
];
