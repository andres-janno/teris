// src/server/mcp/tools/fields.ts — põllud hooaja kaupa ja ühe põllu hooaja täisvaade.
import { z } from 'zod';
import { prisma, tenantTransaction } from '../../db.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { defineTool, canSeeFinance, type McpContext } from '../context.ts';
import { pickOne, fieldLabel, fmtDate, round2, limitRows, tallinnYear, ToolInputError } from '../format.ts';

const canWrite = (ctx: McpContext): boolean => !ctx.license.readOnly;
const year = z.number().int().min(1990).max(2100).optional().describe('Hooaja aasta; vaikimisi jooksev aasta');
const limit = z.number().int().min(1).max(1000).optional().describe('Ridade arv (vaikimisi 200)');

/** Põllu hooaeg nime või numbri järgi (mitu vastet → valikud veateates). */
export async function resolveFieldSeason(query: string, y: number): Promise<{ id: number; label: string }> {
  const rows = await prisma.fieldSeason.findMany({ where: { year: y }, select: { id: true, num: true, field: { select: { num: true, name: true } } } });
  const hit = pickOne('Põld', query, rows.map((r) => {
    const num = r.num ?? r.field.num;
    return { id: String(r.id), label: fieldLabel({ num, name: r.field.name }), keys: [num, r.field.num, r.field.name] };
  }));
  return { id: Number(hit.id), label: hit.label };
}

const byNum = (a: { num: string }, b: { num: string }) => a.num.localeCompare(b.num, 'et', { numeric: true });

/** Kande materjalirea väljund; hind ja kulu ainult finantsõigusega. */
export function articleLineOut(l: { label: string; quantity: number; unit: string; ratePerHa: number | null; activeIngredient: string | null; nKgHa: number | null; pKgHa: number | null; kKgHa: number | null; unitPrice: unknown }, ctx: McpContext) {
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
    description: 'Hooaja põllud: pindala, toetusõiguslik pindala, kultuur (registri nimi) ja PRIA kultuuri nimetus, sort, staatus, töö edenemine, külvi- ja koristuskuupäev, saagi siht ja tegelik saak (t/ha). Filtrid: aasta, kultuur, nime/numbri otsing.',
    input: { year, crop: z.string().optional().describe('Kultuur (osaline nimi)'), search: z.string().optional().describe('Põllu nimi või number (osaline)'), limit },
    run: async (a) => {
      const y = a.year ?? tallinnYear();
      const rows = await prisma.fieldSeason.findMany({
        where: {
          year: y,
          ...(a.crop ? { OR: [{ crop: { contains: a.crop, mode: 'insensitive' as const } }, { priaCropName: { contains: a.crop, mode: 'insensitive' as const } }] } : {}),
          ...(a.search ? { field: { OR: [{ name: { contains: a.search, mode: 'insensitive' as const } }, { num: { contains: a.search, mode: 'insensitive' as const } }] } } : {})
        },
        select: {
          num: true, areaHa: true, eligibleAreaHa: true, workedAreaHa: true, crop: true, priaCropName: true, cropVariety: true, undersowing: true,
          status: true, workProgress: true, seedingDate: true, harvestDate: true, targetYieldTonsHa: true, actualYieldTonsHa: true,
          operator: { select: { name: true } },
          field: { select: { num: true, name: true, operator: { select: { name: true } } } }
        }
      });
      rows.sort((p, q) => byNum({ num: p.num ?? p.field.num }, { num: q.num ?? q.field.num }));
      const out = limitRows(rows, a.limit);
      return {
        year: y,
        total: out.total,
        shown: out.shown,
        totalAreaHa: round2(rows.reduce((s, r) => s + r.areaHa, 0)),
        rows: out.rows.map((r) => ({
          field: fieldLabel({ num: r.num ?? r.field.num, name: r.field.name }),
          areaHa: round2(r.areaHa), eligibleAreaHa: round2(r.eligibleAreaHa), workedAreaHa: round2(r.workedAreaHa),
          crop: r.crop, priaCrop: r.priaCropName, variety: r.cropVariety, undersowing: r.undersowing,
          operator: r.operator?.name ?? r.field.operator?.name ?? null,
          status: r.status, progressPct: round2(r.workProgress), seeded: fmtDate(r.seedingDate), harvested: fmtDate(r.harvestDate),
          targetYieldTHa: round2(r.targetYieldTonsHa), actualYieldTHa: round2(r.actualYieldTonsHa)
        }))
      };
    }
  }),
  defineTool({
    name: 'get_field',
    title: 'Põllu hooaeg',
    description: 'Ühe põllu hooaja täisvaade: põllu andmed, mullastik, operaator, katastriüksused (kinnistu nimi, maaomanik/rendileandja, omandivorm OWNED/RENTED/UNKNOWN; rent ja maamaks finantsõigusega), kõik plaanitud tööd ja nende kanded koos materjalidega.',
    input: { field: z.string().min(1).describe('Põllu nimi või number'), year },
    run: async (a, ctx) => {
      const y = a.year ?? tallinnYear();
      const fs = await resolveFieldSeason(a.field, y);
      const finance = canSeeFinance(ctx);
      const s = await prisma.fieldSeason.findUniqueOrThrow({
        where: { id: fs.id },
        include: {
          operator: { select: { name: true } },
          field: { include: { operator: { select: { name: true } } } },
          cadastralParcels: { orderBy: { id: 'asc' }, include: { cadastralParcel: { select: { cadastralCode: true, name: true } } } },
          fieldWorks: {
            orderBy: [{ plannedDateFrom: 'asc' }, { sortOrder: 'asc' }],
            include: {
              workType: { select: { name: true, shortName: true } },
              plannedWorker: { select: { name: true } },
              lines: { orderBy: { sortOrder: 'asc' } },
              entries: {
                orderBy: { date: 'asc' },
                include: {
                  worker: { select: { name: true } }, vehicle: { select: { name: true } }, implement: { select: { name: true } },
                  harvestLot: { select: { name: true } }, warehouse: { select: { name: true } },
                  lines: { where: { kind: { in: ['MATERIAL', 'HARVEST', 'OBSERVATION'] } }, orderBy: { sortOrder: 'asc' } }
                }
              }
            }
          }
        }
      });
      const soilSamples = s.field.fieldCode
        ? await prisma.soilSample.findMany({ where: { fieldCode: s.field.fieldCode }, orderBy: [{ year: 'desc' }, { sampleNumber: 'asc' }] })
        : [];
      return {
        field: fs.label, year: y, areaHa: round2(s.areaHa), eligibleAreaHa: round2(s.eligibleAreaHa), workedAreaHa: round2(s.workedAreaHa),
        areaChangeReason: s.areaChangeReason, perimeterM: round2(s.perimeterM),
        crop: s.crop, priaCrop: s.priaCropName, variety: s.cropVariety, undersowing: s.undersowing,
        status: s.status, progressPct: round2(s.workProgress), seeded: fmtDate(s.seedingDate), harvested: fmtDate(s.harvestDate),
        targetYieldTHa: round2(s.targetYieldTonsHa), actualYieldTHa: round2(s.actualYieldTonsHa),
        priaCode: s.field.fieldCode, soilType: s.field.soilType, drainage: s.field.drainageSystem,
        operator: s.operator?.name ?? s.field.operator?.name ?? null, notes: s.notes ?? s.field.notes,
        cadastralParcels: s.cadastralParcels.map((p) => ({
          // name = katastriüksuse (kinnistu) nimi; owner = maaomanik/rendileandja sellel hooajal. Sama üksus võib korduda eri omanikega.
          code: p.cadastralParcel.cadastralCode, name: p.cadastralParcel.name, owner: p.ownerName, areaHa: round2(p.fieldAreaHa), ownership: p.ownershipType,
          notes: p.notes,
          ...(finance ? {
            rentFeeEurHa: round2(p.rentFeeEurHa), rentFeeEurYear: round2(p.rentFeeEurYear),
            landTaxEurHa: round2(p.landTaxEurHa), landTaxEurYear: round2(p.landTaxEurYear)
          } : {})
        })),
        soilSamples: soilSamples.map((ss) => ({
          sampleNumber: ss.sampleNumber, year: ss.year, ph: round2(ss.ph),
          p: round2(ss.phosphorus), k: round2(ss.potassium), ca: round2(ss.calcium), mg: round2(ss.magnesium),
          cu: round2(ss.copper), mn: round2(ss.manganese), b: round2(ss.boron), cOrg: round2(ss.organicCarbon),
          limeRequirementTHa: round2(ss.limeRequirement)
        })),
        works: s.fieldWorks.map((w) => ({
          work: workTypeDisplayName(w.workType), phase: w.phase, status: w.status, source: w.source,
          planned: w.plannedDateFrom ? [fmtDate(w.plannedDateFrom), fmtDate(w.plannedDateTo)].filter(Boolean).join(' – ') : w.plannedText,
          plannedAreaHa: round2(w.plannedAreaHa), method: w.method, plannedWorker: w.plannedWorker?.name ?? null, notes: w.notes,
          plannedArticles: w.lines.filter((l) => l.kind === 'MATERIAL').map((l) => ({ name: l.label, ratePerHa: round2(l.ratePerHa), unit: l.unit })),
          plannedHarvest: w.lines.filter((l) => l.kind === 'HARVEST').map((l) => ({ name: l.label, ratePerHa: round2(l.ratePerHa), unit: l.unit })),
          entries: w.entries.map((e) => ({
            date: fmtDate(e.date), dateTo: fmtDate(e.dateTo), startTime: e.startTime, endTime: e.endTime, occurrenceNo: e.occurrenceNo,
            worker: e.worker?.name ?? null, vehicle: e.vehicle?.name ?? null, implement: e.implement?.name ?? null,
            areaHa: round2(e.areaHa), telemetryAreaHa: round2(e.telemetryAreaHa),
            equipmentHours: round2(e.equipmentHours), laborHours: round2(e.laborHours), fuelLiters: round2(e.fuelLiters),
            harvestBunkers: round2(e.harvestBunkers), harvestLot: e.harvestLot?.name ?? null, warehouse: e.warehouse?.name ?? null,
            notes: e.notes,
            articles: e.lines.filter((l) => l.kind === 'MATERIAL').map((l) => articleLineOut(l, ctx)),
            harvest: e.lines.filter((l) => l.kind === 'HARVEST').map((l) => ({ quantity: round2(l.quantity), unit: l.unit })),
            observations: e.lines.filter((l) => l.kind === 'OBSERVATION').map((l) => ({ name: l.label, kind: l.priaRegister ?? undefined }))
          }))
        }))
      };
    }
  }),
  defineTool({
    name: 'update_field_target_yields',
    title: 'Muuda põldude planeeritud saagiootusi',
    description: 'Uuendab ühe või mitme põllu hooaja planeeritud saagiootust (targetYieldTHa, t/ha). Väärtus null eemaldab planeeritud saagiootuse. Nõuab kehtivat (mitte-read-only) litsentsi ja avatud hooaega.',
    readOnly: false,
    when: canWrite,
    input: {
      year,
      items: z.array(z.object({
        field: z.string().min(1).describe('Põllu nimi või number'),
        targetYieldTHa: z.number().positive().nullable().describe('Planeeritud saagiootus t/ha (null eemaldab väärtuse)')
      })).min(1).max(200).describe('Põllud ja nende uued planeeritud saagiootused')
    },
    run: async (a) => {
      const y = a.year ?? tallinnYear();
      const lockedSeason = await prisma.season.findFirst({ where: { year: y, isLocked: true }, select: { id: true } });
      if (lockedSeason) throw new ToolInputError(`Hooaeg ${y} on lukus — saagiootusi ei saa muuta`);

      const fieldSeasons = await prisma.fieldSeason.findMany({
        where: { year: y },
        select: {
          id: true, num: true, areaHa: true, crop: true, targetYieldTonsHa: true,
          season: { select: { isLocked: true } },
          field: { select: { num: true, name: true } }
        }
      });
      const candidates = fieldSeasons.map((r) => {
        const num = r.num ?? r.field.num;
        return { id: String(r.id), label: fieldLabel({ num, name: r.field.name }), keys: [num, r.field.num, r.field.name] };
      });
      const byId = new Map(fieldSeasons.map((r) => [r.id, r]));

      const updates: { fs: (typeof fieldSeasons)[number]; label: string; nextYield: number | null }[] = [];
      const seen = new Set<number>();
      for (const item of a.items) {
        const hit = pickOne('Põld', item.field, candidates);
        const fs = byId.get(Number(hit.id))!;
        if (seen.has(fs.id)) throw new ToolInputError(`Põld "${hit.label}" on nimekirjas mitu korda`);
        if (fs.season?.isLocked) throw new ToolInputError(`Hooaeg ${y} on lukus — saagiootusi ei saa muuta`);
        seen.add(fs.id);
        updates.push({ fs, label: hit.label, nextYield: item.targetYieldTHa });
      }

      await tenantTransaction(async (tx) => {
        for (const u of updates) {
          await tx.fieldSeason.update({
            where: { id: u.fs.id },
            data: { targetYieldTonsHa: u.nextYield }
          });
        }
      });

      return {
        year: y,
        updated: updates.length,
        rows: updates.map((u) => ({
          field: u.label,
          crop: u.fs.crop,
          areaHa: round2(u.fs.areaHa),
          previousTargetYieldTHa: round2(u.fs.targetYieldTonsHa),
          targetYieldTHa: round2(u.nextYield),
          expectedTotalTonnes: u.nextYield === null ? null : round2(u.nextYield * u.fs.areaHa)
        }))
      };
    }
  })
];
