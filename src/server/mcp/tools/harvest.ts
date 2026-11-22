// src/server/mcp/tools/harvest.ts — saagipartiid, kaalumised ja kuivatuskulud.
import { z } from 'zod';
import { prisma } from '../../db.ts';
import { defineTool, canSeeFinance } from '../context.ts';
import { pickOne, fieldLabel, fmtDate, fmtDateTime, round2, limitRows } from '../format.ts';

const ci = (s: string) => ({ contains: s, mode: 'insensitive' as const });

export const harvestTools = [
  defineTool({
    name: 'list_harvest_lots',
    title: 'Saagipartiid',
    description: 'Saagipartiid: nimi, hooaeg, kultuur, toodanguartikkel, hoidla, staatus (OPEN/CLOSED), punkrite arv ja arvutatud punkri kaal (t), kaalutud tonnid kokku. Finantsõigusega ka kuivatuskulud kokku (€).',
    input: {
      year: z.number().int().min(1990).max(2100).optional().describe('Hooaja aasta'),
      crop: z.string().optional().describe('Kultuur (osaline nimi)'),
      status: z.enum(['OPEN', 'CLOSED']).optional().describe('Partii staatus'),
      limit: z.number().int().min(1).max(1000).optional().describe('Ridade arv (vaikimisi 200)')
    },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const rows = await prisma.harvestLot.findMany({
        where: {
          ...(a.year !== undefined ? { season: { year: a.year } } : {}),
          ...(a.crop ? { crop: { name: ci(a.crop) } } : {}),
          ...(a.status ? { status: a.status } : {})
        },
        orderBy: [{ season: { year: 'desc' } }, { createdAt: 'desc' }],
        include: {
          season: { select: { year: true } },
          crop: { select: { name: true } },
          article: { select: { name: true, unit: true } },
          warehouse: { select: { name: true } },
          entries: { select: { harvestBunkers: true } },
          weighings: { select: { tonnes: true } },
          costs: { select: { quantity: true, unitPrice: true } }
        }
      });
      const out = limitRows(rows, a.limit);
      return {
        total: out.total,
        shown: out.shown,
        rows: out.rows.map((l) => {
          const totalBunkers = l.entries.reduce((s, e) => s + (e.harvestBunkers ?? 0), 0);
          const totalWeighedTonnes = l.weighings.reduce((s, w) => s + w.tonnes, 0);
          const totalCost = l.costs.reduce((s, c) => s + (c.unitPrice !== null ? Number(c.unitPrice) * c.quantity : 0), 0);
          const unpricedCosts = l.costs.filter((c) => c.unitPrice === null).length;
          return {
            name: l.name,
            year: l.season.year,
            crop: l.crop.name,
            article: l.article.name,
            warehouse: l.warehouse.name,
            status: l.status,
            bunkerTonnes: round2(l.bunkerTonnes),
            closedAt: fmtDateTime(l.closedAt),
            entriesCount: l.entries.length,
            totalBunkers: round2(totalBunkers),
            weighingsCount: l.weighings.length,
            totalWeighedTonnes: round2(totalWeighedTonnes),
            costsCount: l.costs.length,
            notes: l.notes,
            ...(finance ? { totalCost: round2(totalCost), unpricedCosts } : {})
          };
        })
      };
    }
  }),
  defineTool({
    name: 'get_harvest_lot',
    title: 'Saagipartii detailid',
    description: 'Ühe saagipartii täisvaade: seotud koristuskanded (põld, kuupäev, punkrid, tonnid), kaalumised ja kuivatuskulud (kaubad ja teenused; hinnad finantsõigusega).',
    input: { lot: z.string().min(1).describe('Saagipartii nimi') },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const all = await prisma.harvestLot.findMany({ select: { id: true, name: true } });
      const hit = pickOne('Saagipartii', a.lot, all.map((l) => ({ id: l.id, label: l.name, keys: [l.name] })));
      const l = await prisma.harvestLot.findUniqueOrThrow({
        where: { id: hit.id },
        include: {
          season: { select: { year: true } },
          crop: { select: { name: true } },
          article: { select: { name: true, unit: true } },
          warehouse: { select: { name: true } },
          entries: {
            orderBy: { date: 'asc' },
            include: {
              fieldWork: { select: { fieldSeason: { select: { num: true, field: { select: { num: true, name: true } } } } } },
              lines: { where: { kind: 'HARVEST' }, select: { quantity: true, unit: true } }
            }
          },
          weighings: { orderBy: { date: 'asc' } },
          costs: {
            orderBy: { date: 'asc' },
            include: { article: { select: { name: true, unit: true, category: { select: { group: true } } } } }
          }
        }
      });
      return {
        name: l.name,
        year: l.season.year,
        crop: l.crop.name,
        article: l.article.name,
        warehouse: l.warehouse.name,
        status: l.status,
        bunkerTonnes: round2(l.bunkerTonnes),
        closedAt: fmtDateTime(l.closedAt),
        notes: l.notes,
        entries: l.entries.map((e) => ({
          date: fmtDate(e.date),
          field: fieldLabel({ num: e.fieldWork.fieldSeason.num ?? e.fieldWork.fieldSeason.field.num, name: e.fieldWork.fieldSeason.field.name }),
          areaHa: round2(e.areaHa),
          bunkers: round2(e.harvestBunkers),
          tonnes: round2(e.lines.reduce((s, h) => s + h.quantity, 0)),
          manualTonnes: e.harvestTonnesManual
        })),
        weighings: l.weighings.map((w) => ({ date: fmtDate(w.date), tonnes: round2(w.tonnes), notes: w.notes })),
        costs: l.costs.map((c) => {
          const up = c.unitPrice === null ? null : Number(c.unitPrice);
          return {
            date: fmtDate(c.date),
            article: c.article.name,
            group: c.article.category.group,
            quantity: round2(c.quantity),
            unit: c.article.unit,
            notes: c.notes,
            ...(finance ? { unitPrice: round2(up), cost: up === null ? null : round2(up * c.quantity) } : {})
          };
        })
      };
    }
  })
];
