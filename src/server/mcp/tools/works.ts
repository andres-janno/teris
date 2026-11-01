// src/server/mcp/tools/works.ts — plaanitud tööd, tegelikud kanded (põlluraamat) ja materjalikulu kokkuvõte.
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { defineTool, canSeeFinance } from '../context.ts';
import { parseDateInput, dayAfter, pickOne, fieldLabel, fmtDate, round2, limitRows, tallinnYear, ToolInputError } from '../format.ts';
import { resolveFieldSeason, articleLineOut } from './fields.ts';

const year = z.number().int().min(1990).max(2100).optional().describe('Hooaja aasta');
const from = z.string().optional().describe('Alates (pp.kk.aaaa)');
const to = z.string().optional().describe('Kuni, kaasa arvatud (pp.kk.aaaa)');
const limit = z.number().int().min(1).max(1000).optional().describe('Ridade arv (vaikimisi 200)');
const ci = (s: string) => ({ contains: s, mode: 'insensitive' as const });

export async function resolveVehicleId(query: string): Promise<string> {
  const rows = await prisma.vehicle.findMany({ select: { id: true, name: true, regNumber: true } });
  return pickOne('Masin', query, rows.map((v) => ({ id: v.id, label: v.regNumber ? `${v.name} (${v.regNumber})` : v.name, keys: [v.name, v.regNumber ?? ''].filter(Boolean) }))).id;
}

export async function resolveFieldId(query: string): Promise<number> {
  const rows = await prisma.field.findMany({ select: { id: true, num: true, name: true } });
  return Number(pickOne('Põld', query, rows.map((f) => ({ id: String(f.id), label: fieldLabel(f), keys: [f.num, f.name] }))).id);
}

function dateRange(a: { from?: string; to?: string }): Prisma.DateTimeFilter | undefined {
  const f = parseDateInput(a.from, 'from');
  const t = parseDateInput(a.to, 'to');
  if (f && t && f > t) throw new ToolInputError('Algus on hilisem kui lõpp');
  if (!f && !t) return undefined;
  return { ...(f ? { gte: f } : {}), ...(t ? { lt: dayAfter(t) } : {}) };
}

/** Kannete filter: ajavahemik või aasta (vaikimisi jooksev, kui vahemikku pole), põld, töö liik, materjal, masin. */
async function entryWhere(a: { year?: number; from?: string; to?: string; field?: string; workType?: string; article?: string; vehicle?: string }): Promise<Prisma.WorkEntryWhereInput> {
  const range = dateRange(a);
  const y = a.year ?? (range ? undefined : tallinnYear());
  // Vahemik ilma aastata: ei piira hooaega, põld valitakse hooaegadeülese põllu id järgi
  const fieldSeasonId = a.field && y !== undefined ? (await resolveFieldSeason(a.field, y)).id : undefined;
  const fieldId = a.field && y === undefined ? await resolveFieldId(a.field) : undefined;
  return {
    ...(range ? { date: range } : {}),
    fieldWork: {
      ...(y !== undefined ? { fieldSeason: { year: y } } : {}),
      ...(fieldSeasonId !== undefined ? { fieldSeasonId } : {}),
      ...(fieldId !== undefined ? { fieldSeason: { fieldId } } : {}),
      ...(a.workType ? { workType: { OR: [{ name: ci(a.workType) }, { shortName: ci(a.workType) }] } } : {})
    },
    ...(a.article ? { lines: { some: { kind: 'MATERIAL', label: ci(a.article) } } } : {}),
    ...(a.vehicle ? { vehicleId: await resolveVehicleId(a.vehicle) } : {})
  };
}

const entryFilters = {
  year, from, to,
  field: z.string().optional().describe('Põllu nimi või number'),
  workType: z.string().optional().describe('Töö liik (osaline nimi)'),
  article: z.string().optional().describe('Materjal (osaline nimi)'),
  vehicle: z.string().optional().describe('Masina nimi või reg nr')
};

export const workTools = [
  defineTool({
    name: 'list_field_works',
    title: 'Plaanitud tööd',
    description: 'Põllutööde plaan: põld, töö liik, faas, plaanitud aeg, staatus (PLANNED/IN_PROGRESS/DONE), plaanitud pindala, viis, teostaja ja plaanitud materjalid normiga. Ajavahemik filtreerib alguskuupäeva järgi.',
    input: {
      year,
      field: z.string().optional().describe('Põllu nimi või number'),
      workType: z.string().optional().describe('Töö liik (osaline nimi)'),
      status: z.enum(['PLANNED', 'IN_PROGRESS', 'DONE']).optional(),
      from, to, limit
    },
    run: async (a) => {
      const range = dateRange(a);
      const y = a.year ?? (range ? undefined : tallinnYear());
      const fieldSeasonId = a.field && y !== undefined ? (await resolveFieldSeason(a.field, y)).id : undefined;
      const fieldId = a.field && y === undefined ? await resolveFieldId(a.field) : undefined;
      const rows = await prisma.fieldWork.findMany({
        where: {
          ...(y !== undefined ? { fieldSeason: { year: y } } : {}),
          ...(fieldSeasonId !== undefined ? { fieldSeasonId } : {}),
          ...(fieldId !== undefined ? { fieldSeason: { fieldId } } : {}),
          ...(a.workType ? { workType: { OR: [{ name: ci(a.workType) }, { shortName: ci(a.workType) }] } } : {}),
          ...(a.status ? { status: a.status } : {}),
          ...(range ? { plannedDateFrom: range } : {})
        },
        orderBy: [{ plannedDateFrom: 'asc' }, { sortOrder: 'asc' }],
        include: {
          workType: { select: { name: true, shortName: true } },
          fieldSeason: { select: { field: { select: { num: true, name: true } } } },
          plannedWorker: { select: { name: true } },
          lines: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { entries: true } }
        }
      });
      const out = limitRows(rows, a.limit);
      return {
        year: y ?? null, total: out.total, shown: out.shown,
        rows: out.rows.map((w) => ({
          field: fieldLabel(w.fieldSeason.field), work: workTypeDisplayName(w.workType), phase: w.phase, status: w.status,
          planned: w.plannedDateFrom ? [fmtDate(w.plannedDateFrom), fmtDate(w.plannedDateTo)].filter(Boolean).join(' – ') : w.plannedText,
          plannedAreaHa: round2(w.plannedAreaHa), method: w.method, plannedWorker: w.plannedWorker?.name ?? null, entries: w._count.entries,
          plannedArticles: w.lines.filter((l) => l.kind === 'MATERIAL').map((l) => ({ name: l.label, ratePerHa: round2(l.ratePerHa), unit: l.unit, activeIngredient: l.activeIngredient ?? undefined }))
        }))
      };
    }
  }),
  defineTool({
    name: 'list_work_entries',
    title: 'Kanded (põlluraamat)',
    description: 'Tegelikult tehtud tööd: kuupäev, põld, töö, tegija, masin, haakeriist, pindala, töötunnid, kütus, materjalid (kogus, ühik, norm/ha, toimeaine, NPK) ja saak. Finantsõigusega ka hinnad, kulud ja kinnitamise staatus. Ilma aasta ja vahemikuta: jooksev aasta. unpricedLines > 0 tähendab, et totalCost on osaline. Ajavahemik filtreerib alguskuupäeva järgi.',
    input: { ...entryFilters, limit },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const rows = await prisma.workEntry.findMany({
        where: await entryWhere(a),
        orderBy: { date: 'desc' },
        include: {
          fieldWork: { select: { workType: { select: { name: true, shortName: true } }, fieldSeason: { select: { field: { select: { num: true, name: true } } } } } },
          worker: { select: { name: true } }, vehicle: { select: { name: true } }, implement: { select: { name: true } },
          lines: { orderBy: { sortOrder: 'asc' } }
        }
      });
      const out = limitRows(rows, a.limit);
      return {
        total: out.total, shown: out.shown,
        rows: out.rows.map((e) => {
          const costed = e.lines.filter((l) => l.unitPrice !== null);
          return {
            date: fmtDate(e.date), dateTo: fmtDate(e.dateTo), field: fieldLabel(e.fieldWork.fieldSeason.field), work: workTypeDisplayName(e.fieldWork.workType),
            worker: e.worker?.name ?? null, vehicle: e.vehicle?.name ?? null, implement: e.implement?.name ?? null,
            areaHa: round2(e.areaHa), equipmentHours: round2(e.equipmentHours), laborHours: round2(e.laborHours), fuelLiters: round2(e.fuelLiters),
            method: e.method, notes: e.notes,
            articles: e.lines.filter((l) => l.kind === 'MATERIAL').map((l) => articleLineOut(l, ctx)),
            harvest: e.lines.filter((l) => l.kind === 'HARVEST').map((l) => ({ quantity: round2(l.quantity), unit: l.unit })),
            ...(finance ? { financeStatus: e.financeStatus, totalCost: round2(costed.reduce((s, l) => s + Number(l.unitPrice) * l.quantity, 0)), unpricedLines: e.lines.filter((l) => l.unitPrice === null && l.kind !== 'HARVEST' && l.kind !== 'OBSERVATION').length } : {})
          };
        })
      };
    }
  }),
  defineTool({
    name: 'summarize_article_usage',
    title: 'Materjalikulu kokku',
    description: 'Kulumaterjalide kogus kokku materjali ja põllu või kultuuri kaupa (kanded). Pindala = nende kannete pindala summa. Finantsõigusega ka summa €.',
    input: { ...entryFilters, groupBy: z.enum(['field', 'crop']).default('field').describe('Grupeeri põllu või kultuuri järgi') },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const entries = await prisma.workEntry.findMany({
        where: await entryWhere(a),
        select: {
          id: true, areaHa: true,
          fieldWork: { select: { fieldSeason: { select: { crop: true, field: { select: { num: true, name: true } } } } } },
          lines: { where: { kind: 'MATERIAL', ...(a.article ? { label: ci(a.article) } : {}) }, select: { label: true, quantity: true, unit: true, unitPrice: true } }
        }
      });
      type Acc = { article: string; group: string; unit: string; quantity: number; entryIds: Set<string>; areaHa: number; cost: number };
      const acc = new Map<string, Acc>();
      for (const e of entries) {
        const fs = e.fieldWork.fieldSeason;
        const group = a.groupBy === 'crop' ? fs.crop : fieldLabel(fs.field);
        for (const l of e.lines) {
          const k = `${l.label}\u0000${l.unit}\u0000${group}`;
          const g = acc.get(k) ?? { article: l.label, group, unit: l.unit, quantity: 0, entryIds: new Set<string>(), areaHa: 0, cost: 0 };
          g.quantity += l.quantity;
          if (l.unitPrice !== null) g.cost += Number(l.unitPrice) * l.quantity;
          if (!g.entryIds.has(e.id)) {
            g.entryIds.add(e.id);
            g.areaHa += e.areaHa ?? 0;
          }
          acc.set(k, g);
        }
      }
      const rows = [...acc.values()]
        .sort((p, q) => p.article.localeCompare(q.article, 'et') || p.group.localeCompare(q.group, 'et', { numeric: true }))
        .map((g) => ({ article: g.article, group: g.group, quantity: round2(g.quantity), unit: g.unit, areaHa: round2(g.areaHa), entries: g.entryIds.size, ...(finance ? { cost: round2(g.cost) } : {}) }));
      return { groupBy: a.groupBy, total: rows.length, shown: rows.length, rows };
    }
  })
];
