// src/server/mcp/tools/fields.ts — põllud hooaja kaupa ja ühe põllu hooaja täisvaade.
import { z } from 'zod';
import { prisma } from '../../db.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { defineTool, canSeeFinance, type McpContext } from '../context.ts';
import { pickOne, fieldLabel, fmtDate, round2, limitRows, tallinnYear } from '../format.ts';

const year = z.number().int().min(1990).max(2100).optional().describe('Hooaja aasta; vaikimisi jooksev aasta');
const limit = z.number().int().min(1).max(1000).optional().describe('Ridade arv (vaikimisi 200)');

/** Põllu hooaeg nime või numbri järgi (mitu vastet → valikud veateates). */
export async function resolveFieldSeason(query: string, y: number): Promise<{ id: number; label: string }> {
  const rows = await prisma.fieldSeason.findMany({ where: { year: y }, select: { id: true, field: { select: { num: true, name: true } } } });
  const hit = pickOne('Põld', query, rows.map((r) => ({ id: String(r.id), label: fieldLabel(r.field), keys: [r.field.num, r.field.name] })));
  return { id: Number(hit.id), label: hit.label };
}

const byNum = (a: { num: string }, b: { num: string }) => a.num.localeCompare(b.num, 'et', { numeric: true });

/** Kande materjalirea väljund; hind ja kulu ainult finantsõigusega. */
export function materialLineOut(l: { label: string; quantity: number; unit: string; ratePerHa: number | null; activeIngredient: string | null; nKgHa: number | null; pKgHa: number | null; kKgHa: number | null; unitPrice: unknown }, ctx: McpContext) {
  const unitPrice = l.unitPrice === null || l.unitPrice === undefined ? null : Number(l.unitPrice);
  return {
    name: l.label,
    quantity: round2(l.quantity),
    unit: l.unit,
    ratePerHa: round2(l.ratePerHa),
    activeIngredient: l.activeIngredient ?? undefined,
    nKgHa: round2(l.nKgHa) ?? undefined,
    pKgHa: round2(l.pKgHa) ?? undefined,
    kKgHa: round2(l.kKgHa) ?? undefined,
    ...(canSeeFinance(ctx) ? { unitPrice: round2(unitPrice), cost: unitPrice === null ? null : round2(unitPrice * l.quantity) } : {})
  };
}

export const fieldTools = [
  defineTool({
    name: 'list_fields',
    title: 'Põllud',
    description: 'Hooaja põllud: pindala, toetusõiguslik pindala, kultuur, sort, staatus, töö edenemine, külvi- ja koristuskuupäev, saagi siht ja tegelik saak (t/ha). Filtrid: aasta, kultuur, nime/numbri otsing.',
    input: { year, crop: z.string().optional().describe('Kultuur (osaline nimi)'), search: z.string().optional().describe('Põllu nimi või number (osaline)'), limit },
    run: async (a) => {
      const y = a.year ?? tallinnYear();
      const rows = await prisma.fieldSeason.findMany({
        where: {
          year: y,
          ...(a.crop ? { crop: { contains: a.crop, mode: 'insensitive' as const } } : {}),
          ...(a.search ? { field: { OR: [{ name: { contains: a.search, mode: 'insensitive' as const } }, { num: { contains: a.search, mode: 'insensitive' as const } }] } } : {})
        },
        select: {
          areaHa: true, eligibleAreaHa: true, crop: true, cropVariety: true, status: true, workProgress: true,
          seedingDate: true, harvestDate: true, targetYieldTonsHa: true, actualYieldTonsHa: true,
          field: { select: { num: true, name: true } }
        }
      });
      rows.sort((p, q) => byNum(p.field, q.field));
      const out = limitRows(rows, a.limit);
      return {
        year: y,
        total: out.total,
        shown: out.shown,
        totalAreaHa: round2(rows.reduce((s, r) => s + r.areaHa, 0)),
        rows: out.rows.map((r) => ({
          field: fieldLabel(r.field), areaHa: round2(r.areaHa), eligibleAreaHa: round2(r.eligibleAreaHa), crop: r.crop, variety: r.cropVariety,
          status: r.status, progressPct: round2(r.workProgress), seeded: fmtDate(r.seedingDate), harvested: fmtDate(r.harvestDate),
          targetYieldTHa: round2(r.targetYieldTonsHa), actualYieldTHa: round2(r.actualYieldTonsHa)
        }))
      };
    }
  }),
  defineTool({
    name: 'get_field',
    title: 'Põllu hooaeg',
    description: 'Ühe põllu hooaja täisvaade: põllu andmed, mullastik, operaator, katastriüksused, kõik plaanitud tööd ja nende kanded koos materjalidega.',
    input: { field: z.string().min(1).describe('Põllu nimi või number'), year },
    run: async (a, ctx) => {
      const y = a.year ?? tallinnYear();
      const fs = await resolveFieldSeason(a.field, y);
      const finance = canSeeFinance(ctx);
      const s = await prisma.fieldSeason.findUniqueOrThrow({
        where: { id: fs.id },
        include: {
          field: { include: { operator: { select: { name: true } } } },
          cadastralParcels: { include: { cadastralParcel: { select: { cadastralCode: true, name: true } } } },
          fieldWorks: {
            orderBy: [{ plannedDateFrom: 'asc' }, { sortOrder: 'asc' }],
            include: {
              workType: { select: { name: true, shortName: true } },
              lines: { orderBy: { sortOrder: 'asc' } },
              entries: {
                orderBy: { date: 'asc' },
                include: {
                  worker: { select: { name: true } }, vehicle: { select: { name: true } }, implement: { select: { name: true } },
                  lines: { where: { kind: { in: ['MATERIAL', 'HARVEST'] } }, orderBy: { sortOrder: 'asc' } }
                }
              }
            }
          }
        }
      });
      return {
        field: fs.label, year: y, areaHa: round2(s.areaHa), eligibleAreaHa: round2(s.eligibleAreaHa), crop: s.crop, variety: s.cropVariety,
        status: s.status, progressPct: round2(s.workProgress), seeded: fmtDate(s.seedingDate), harvested: fmtDate(s.harvestDate),
        targetYieldTHa: round2(s.targetYieldTonsHa), actualYieldTHa: round2(s.actualYieldTonsHa),
        priaCode: s.field.fieldCode, soilType: s.field.soilType, drainage: s.field.drainageSystem, operator: s.field.operator?.name ?? null, notes: s.notes ?? s.field.notes,
        cadastralParcels: s.cadastralParcels.map((p) => ({
          code: p.cadastralParcel.cadastralCode, name: p.cadastralParcel.name, areaHa: round2(p.fieldAreaHa), ownership: p.ownershipType,
          ...(finance ? { rentFeeEurYear: round2(p.rentFeeEurYear), landTaxEurYear: round2(p.landTaxEurYear) } : {})
        })),
        works: s.fieldWorks.map((w) => ({
          work: workTypeDisplayName(w.workType), phase: w.phase, status: w.status,
          planned: w.plannedDateFrom ? [fmtDate(w.plannedDateFrom), fmtDate(w.plannedDateTo)].filter(Boolean).join(' – ') : w.plannedText,
          plannedMaterials: w.lines.filter((l) => l.kind === 'MATERIAL').map((l) => ({ name: l.label, ratePerHa: round2(l.ratePerHa), unit: l.unit })),
          entries: w.entries.map((e) => ({
            date: fmtDate(e.date), dateTo: fmtDate(e.dateTo), worker: e.worker?.name ?? null, vehicle: e.vehicle?.name ?? null, implement: e.implement?.name ?? null,
            areaHa: round2(e.areaHa), equipmentHours: round2(e.equipmentHours), fuelLiters: round2(e.fuelLiters),
            materials: e.lines.filter((l) => l.kind === 'MATERIAL').map((l) => materialLineOut(l, ctx)),
            harvest: e.lines.filter((l) => l.kind === 'HARVEST').map((l) => ({ quantity: round2(l.quantity), unit: l.unit }))
          }))
        }))
      };
    }
  })
];
