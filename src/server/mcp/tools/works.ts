// src/server/mcp/tools/works.ts — plaanitud tööd, tegelikud kanded (põlluraamat) ja materjalikulu kokkuvõte.
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma, tenantTransaction } from '../../db.ts';
import { convertQty } from '../../../services/units.ts';
import { articleAllowedOnLine } from '../../../services/articleRules.ts';
import { workTypeDisplayName } from '../../../services/workTypeName.ts';
import { buildEntryLines } from '../../fieldWorkRules.ts';
import { loadEntryArticles } from '../../entryArticles.ts';
import { recomputeArticleStock, resolveEntryWarehouseId, validateLineWarehouses, StockValidationError } from '../../stock.ts';
import { applyEntryHarvest, lotBunkerArticleIds, HarvestLotError } from '../../harvestLots.ts';
import { syncFieldWorkStatus } from '../../fieldWorkStatus.ts';
import { defineTool, canSeeFinance, type McpContext } from '../context.ts';
import { parseDateInput, dayAfter, pickOne, fieldLabel, fmtDate, fmtDateTime, round2, limitRows, tallinnYear, ToolInputError } from '../format.ts';
import { resolveFieldSeason, articleLineOut } from './fields.ts';

const canWrite = (ctx: McpContext): boolean => !ctx.license.readOnly;
const stockArticleIdsOf = (lines: { kind?: string; articleId: string | null }[]) =>
  lines.filter((l) => ['MATERIAL', 'FUEL'].includes(l.kind ?? 'MATERIAL') && l.articleId).map((l) => l.articleId as string);

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
          fieldSeason: { select: { num: true, field: { select: { num: true, name: true } } } },
          plannedWorker: { select: { name: true } },
          finishedBy: { select: { displayName: true, username: true } },
          lines: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { entries: true } }
        }
      });
      const out = limitRows(rows, a.limit);
      return {
        year: y ?? null, total: out.total, shown: out.shown,
        rows: out.rows.map((w) => ({
          id: w.id,
          field: fieldLabel({ num: w.fieldSeason.num ?? w.fieldSeason.field.num, name: w.fieldSeason.field.name }),
          work: workTypeDisplayName(w.workType), phase: w.phase, status: w.status, source: w.source, plannedCount: w.plannedCount,
          planned: w.plannedDateFrom ? [fmtDate(w.plannedDateFrom), fmtDate(w.plannedDateTo)].filter(Boolean).join(' – ') : w.plannedText,
          plannedAreaHa: round2(w.plannedAreaHa), method: w.method, plannedWorker: w.plannedWorker?.name ?? null,
          finishedAt: fmtDateTime(w.finishedAt), finishedBy: w.finishedBy ? (w.finishedBy.displayName || w.finishedBy.username) : null,
          notes: w.notes, entries: w._count.entries,
          plannedArticles: w.lines.filter((l) => l.kind === 'MATERIAL').map((l) => ({ name: l.label, ratePerHa: round2(l.ratePerHa), unit: l.unit, activeIngredient: l.activeIngredient ?? undefined })),
          plannedHarvest: w.lines.filter((l) => l.kind === 'HARVEST').map((l) => ({ name: l.label, ratePerHa: round2(l.ratePerHa), unit: l.unit }))
        }))
      };
    }
  }),
  defineTool({
    name: 'create_field_work',
    title: 'Loo põllutöö plaan',
    description: 'Loob põllule hooaja põllutöö plaani (tööliik, plaanitud aeg, pindala, viis, teostaja, märkused ning plaanitud materjalid või saak). Põld, tööliik, teostaja ja artiklid antakse nime (või põllu numbri) järgi. Nõuab kehtivat (mitte-read-only) litsentsi ja avatud hooaega.',
    readOnly: false,
    when: canWrite,
    input: {
      field: z.string().min(1).describe('Põllu nimi või number'),
      workType: z.string().min(1).describe('Tööliigi nimi või lühinimi (vt list_work_types)'),
      year: z.number().int().min(1990).max(2100).optional().describe('Hooaja aasta (vaikimisi jooksev aasta)'),
      plannedDateFrom: z.string().optional().describe('Plaanitud alguskuupäev (pp.kk.aaaa või aaaa-kk-pp)'),
      plannedDateTo: z.string().optional().describe('Plaanitud lõppkuupäev (pp.kk.aaaa või aaaa-kk-pp; tühi = üks päev)'),
      plannedText: z.string().max(80).optional().describe('Ligikaudne plaanitud aeg tekstina, nt "okt 2026" või "Sügis 2026"'),
      plannedAreaHa: z.number().positive().optional().describe('Plaanitud pindala ha (tühi = kogu põllu pindala)'),
      method: z.string().max(80).optional().describe('Tööviis, nt väetamisviis "Paisklaotamine" või "Pritsimine"'),
      plannedWorker: z.string().optional().describe('Plaanitud teostaja nimi (seotud isik)'),
      notes: z.string().max(2000).optional().describe('Märkused'),
      plannedArticles: z.array(z.object({
        article: z.string().min(1).describe('Artikli nimi (kulumaterjal, vt list_articles)'),
        ratePerHa: z.number().positive().optional().describe('Plaanitud norm ha kohta'),
        unit: z.string().min(1).max(20).optional().describe('Ühik (tühi = artikli vaikeühik)')
      })).max(50).optional().describe('Plaanitud materjalid normiga ha kohta'),
      plannedHarvest: z.object({
        ratePerHa: z.number().positive().optional().describe('Plaanitud saak t/ha'),
        priaKind: z.string().max(120).optional().describe('Saagi tüüp, nt "Terad"'),
        priaSpec: z.string().max(120).optional().describe('Kultuuri tüüp, nt "Põhikultuur"')
      }).optional().describe('Plaanitud saak (koristustööle)')
    },
    run: async (a) => {
      const y = a.year ?? tallinnYear();
      const fsRef = await resolveFieldSeason(a.field, y);
      const fs = await prisma.fieldSeason.findUniqueOrThrow({
        where: { id: fsRef.id },
        select: { id: true, areaHa: true, season: { select: { isLocked: true } } }
      });
      if (fs.season.isLocked) throw new ToolInputError('Lukus hooaja töid ei saa lisada');

      const plannedDateFrom = parseDateInput(a.plannedDateFrom, 'plannedDateFrom') ?? null;
      const plannedDateTo = parseDateInput(a.plannedDateTo, 'plannedDateTo') ?? null;
      if (plannedDateFrom && plannedDateTo && plannedDateFrom > plannedDateTo) {
        throw new ToolInputError('Alguskuupäev on hilisem kui lõppkuupäev');
      }

      const workTypes = await prisma.workType.findMany({
        where: { isActive: true },
        select: { id: true, name: true, shortName: true, phase: true }
      });
      const wtHit = pickOne('Tööliik', a.workType, workTypes.map((wt) => ({
        id: wt.id,
        label: wt.shortName && wt.shortName !== wt.name ? `${wt.shortName} (${wt.name})` : wt.name,
        keys: [wt.name, wt.shortName ?? '', workTypeDisplayName(wt)].filter(Boolean)
      })));
      const workType = workTypes.find((wt) => wt.id === wtHit.id)!;

      let plannedWorkerId: string | null = null;
      if (a.plannedWorker) {
        const parties = await prisma.relatedParty.findMany({
          where: { isActive: true },
          select: { id: true, name: true }
        });
        plannedWorkerId = pickOne('Teostaja', a.plannedWorker, parties.map((p) => ({
          id: p.id, label: p.name, keys: [p.name]
        }))).id;
      }

      const lines: Prisma.FieldWorkLineCreateWithoutFieldWorkInput[] = [];
      if (a.plannedArticles?.length) {
        const allArticles = await prisma.article.findMany({
          select: {
            id: true, name: true, unit: true, priaRegister: true, priaKind: true, priaSpec: true,
            activeIngredient: true, nPct: true, pPct: true, kPct: true,
            category: { select: { group: true, systemKind: true } }
          }
        });
        const candidates = allArticles.map((r) => ({ id: r.id, label: r.name, keys: [r.name] }));
        const byId = new Map(allArticles.map((r) => [r.id, r]));
        for (const item of a.plannedArticles) {
          const hit = pickOne('Artikkel', item.article, candidates);
          const art = byId.get(hit.id)!;
          if (!articleAllowedOnLine('MATERIAL', art.category)) {
            throw new ToolInputError(`Artikkel "${art.name}" ei sobi materjalireale`);
          }
          const unit = item.unit?.trim() || art.unit;
          const ratePerHa = item.ratePerHa ?? null;
          const rateKg = ratePerHa !== null ? convertQty(ratePerHa, unit, 'kg') : null;
          const npk = (pct: number | null) => (rateKg !== null && pct !== null ? round2((rateKg * pct) / 100) : null);
          lines.push({
            kind: 'MATERIAL',
            article: { connect: { id: art.id } },
            label: art.name,
            unit,
            ratePerHa,
            priaRegister: art.priaRegister,
            priaKind: art.priaKind,
            priaSpec: art.priaSpec,
            activeIngredient: art.activeIngredient,
            nKgHa: npk(art.nPct),
            pKgHa: npk(art.pPct),
            kKgHa: npk(art.kPct),
            sortOrder: lines.length
          });
        }
      }
      if (a.plannedHarvest && (a.plannedHarvest.ratePerHa !== undefined || a.plannedHarvest.priaKind?.trim() || a.plannedHarvest.priaSpec?.trim())) {
        lines.push({
          kind: 'HARVEST',
          label: 'Saak',
          unit: 't',
          ratePerHa: a.plannedHarvest.ratePerHa ?? null,
          priaKind: a.plannedHarvest.priaKind?.trim() || null,
          priaSpec: a.plannedHarvest.priaSpec?.trim() || null,
          sortOrder: lines.length
        });
      }

      const last = await prisma.fieldWork.findFirst({
        where: { fieldSeasonId: fs.id },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true }
      });

      const saved = await prisma.fieldWork.create({
        data: {
          fieldSeasonId: fs.id,
          workTypeId: workType.id,
          phase: workType.phase,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          plannedCount: 1,
          plannedDateFrom,
          plannedDateTo,
          plannedText: a.plannedText?.trim() || null,
          plannedAreaHa: a.plannedAreaHa ?? null,
          method: a.method?.trim() || null,
          plannedWorkerId,
          notes: a.notes?.trim() || null,
          ...(lines.length ? { lines: { create: lines } } : {})
        },
        include: {
          workType: { select: { name: true, shortName: true } },
          fieldSeason: { select: { num: true, areaHa: true, field: { select: { num: true, name: true } } } },
          plannedWorker: { select: { name: true } },
          lines: { orderBy: { sortOrder: 'asc' } }
        }
      });

      return {
        id: saved.id,
        year: y,
        field: fieldLabel({ num: saved.fieldSeason.num ?? saved.fieldSeason.field.num, name: saved.fieldSeason.field.name }),
        work: workTypeDisplayName(saved.workType),
        phase: saved.phase,
        status: saved.status,
        planned: saved.plannedDateFrom ? [fmtDate(saved.plannedDateFrom), fmtDate(saved.plannedDateTo)].filter(Boolean).join(' – ') : saved.plannedText,
        plannedAreaHa: round2(saved.plannedAreaHa ?? saved.fieldSeason.areaHa),
        method: saved.method,
        plannedWorker: saved.plannedWorker?.name ?? null,
        notes: saved.notes,
        plannedArticles: saved.lines.filter((l) => l.kind === 'MATERIAL').map((l) => ({
          name: l.label,
          ratePerHa: round2(l.ratePerHa),
          unit: l.unit,
          activeIngredient: l.activeIngredient ?? undefined,
          nKgHa: round2(l.nKgHa) ?? undefined,
          pKgHa: round2(l.pKgHa) ?? undefined,
          kKgHa: round2(l.kKgHa) ?? undefined
        })),
        plannedHarvest: saved.lines.filter((l) => l.kind === 'HARVEST').map((l) => ({
          name: l.label,
          ratePerHa: round2(l.ratePerHa),
          unit: l.unit,
          priaKind: l.priaKind ?? undefined,
          priaSpec: l.priaSpec ?? undefined
        }))
      };
    }
  }),
  defineTool({
    name: 'create_work_entry',
    title: 'Lisa kanne planeeritud tööle',
    description: 'Lisab tegelikult tehtud töö kande (põlluraamat) planeeritud põllutööle: kuupäev, pindala, tegija, masin, haakeriist, töötunnid, kütus, kulutatud materjalid, saak või vaatlused. Uuendab laoseisu ja töö staatust (PLANNED/IN_PROGRESS/DONE). Plaanitud töö saab määrata kas fieldWorkId järgi (vt list_field_works / create_field_work) või field + workType (+ year) abil. Nõuab kehtivat litsentsi ja avatud hooaega; lõpetatud tööle (DONE) ei saa kannet lisada.',
    readOnly: false,
    when: canWrite,
    input: {
      fieldWorkId: z.string().min(1).optional().describe('Plaanitud töö ID (vt list_field_works või create_field_work); kui puudub, määra field ja workType'),
      field: z.string().min(1).optional().describe('Põllu nimi või number (kui fieldWorkId puudub)'),
      workType: z.string().min(1).optional().describe('Tööliigi nimi või lühinimi (kui fieldWorkId puudub)'),
      year: z.number().int().min(1990).max(2100).optional().describe('Hooaja aasta (kui fieldWorkId puudub; vaikimisi jooksev aasta)'),
      date: z.string().min(1).describe('Töö tegemise kuupäev (pp.kk.aaaa või aaaa-kk-pp)'),
      areaHa: z.number().positive().optional().describe('Tehtud pindala ha'),
      worker: z.string().optional().describe('Tegija nimi (seotud isik)'),
      vehicle: z.string().optional().describe('Masina nimi või reg nr'),
      implement: z.string().optional().describe('Haakeriista nimi'),
      equipmentHours: z.number().positive().optional().describe('Masina/haakeriista töötunnid'),
      laborHours: z.number().positive().optional().describe('Töötaja töötunnid'),
      fuelLiters: z.number().positive().optional().describe('Kütusekulu liitrites'),
      startTime: z.string().max(10).optional().describe('Alguskellaaeg (nt "08:00")'),
      endTime: z.string().max(10).optional().describe('Lõpukellaaeg (nt "16:30")'),
      method: z.string().max(80).optional().describe('Tegelik tööviis, nt "Paisklaotamine"'),
      warehouse: z.string().optional().describe('Ladu, kust materjalid maha kantakse (tühi = põhiladu)'),
      notes: z.string().max(2000).optional().describe('Märkused'),
      finish: z.boolean().optional().describe('Märgi töö selle kandega lõpetatuks (vaikimisi false)'),
      articles: z.array(z.object({
        article: z.string().min(1).describe('Artikli nimi (kulumaterjal)'),
        quantity: z.number().positive().describe('Tegelik kulutatud kogus artikli ühikus'),
        ratePerHa: z.number().positive().optional().describe('Norm ha kohta (arvutatakse automaatselt, kui areaHa on antud)'),
        warehouse: z.string().optional().describe('Rea ladu (tühi = kande ladu)')
      })).max(50).optional().describe('Kulutatud materjalid'),
      harvestTonnes: z.number().positive().optional().describe('Koristatud saak tonnides'),
      harvestBunkers: z.number().positive().optional().describe('Koristatud punkrite arv'),
      harvestLot: z.string().optional().describe('Saagipartii nimi (koristuskandel)'),
      observations: z.array(z.object({
        label: z.string().min(1).max(200).describe('Vaatluse/leiu nimetus'),
        quantity: z.number().min(0).optional().describe('Kogus'),
        unit: z.string().max(40).optional().describe('Ühik'),
        priaRegister: z.string().max(80).optional().describe('PRIA register/liik')
      })).max(50).optional().describe('Seire/vaatluse leiud')
    },
    run: async (a, ctx) => {
      const date = parseDateInput(a.date, 'date')!;
      let work: { id: string; status: string; fieldSeasonId: number; fieldSeason: { areaHa: number; season: { isLocked: boolean } } } | null = null;
      if (a.fieldWorkId) {
        work = await prisma.fieldWork.findUnique({
          where: { id: a.fieldWorkId },
          select: { id: true, status: true, fieldSeasonId: true, fieldSeason: { select: { areaHa: true, season: { select: { isLocked: true } } } } }
        });
        if (!work) throw new ToolInputError(`Plaanitud tööd "${a.fieldWorkId}" ei leitud`);
      } else {
        if (!a.field || !a.workType) throw new ToolInputError('Määra kas fieldWorkId või nii field kui ka workType');
        const y = a.year ?? tallinnYear();
        const fsRef = await resolveFieldSeason(a.field, y);
        const candidates = await prisma.fieldWork.findMany({
          where: { fieldSeasonId: fsRef.id, status: { not: 'DONE' } },
          orderBy: [{ plannedDateFrom: 'asc' }, { sortOrder: 'asc' }],
          select: {
            id: true, status: true, fieldSeasonId: true, plannedDateFrom: true, plannedText: true,
            workType: { select: { name: true, shortName: true } },
            fieldSeason: { select: { areaHa: true, season: { select: { isLocked: true } } } }
          }
        });
        const hit = pickOne('Plaanitud töö', a.workType, candidates.map((w) => {
          const wtName = workTypeDisplayName(w.workType);
          const when = w.plannedDateFrom ? fmtDate(w.plannedDateFrom) : w.plannedText;
          return {
            id: w.id,
            label: `${wtName}${when ? ` (${when})` : ''} [id: ${w.id}]`,
            keys: [w.workType.name, w.workType.shortName ?? '', wtName].filter(Boolean)
          };
        }));
        work = candidates.find((w) => w.id === hit.id)!;
      }

      if (work.fieldSeason.season.isLocked) throw new ToolInputError('Lukus hooaja tööle ei saa kannet lisada');
      if (work.status === 'DONE') throw new ToolInputError('Lõpetatud tööle ei saa kannet lisada');

      let worker: { id: string; name: string } | null = null;
      if (a.worker) {
        const parties = await prisma.relatedParty.findMany({ where: { isActive: true }, select: { id: true, name: true } });
        const hit = pickOne('Tegija', a.worker, parties.map((p) => ({ id: p.id, label: p.name, keys: [p.name] })));
        worker = parties.find((p) => p.id === hit.id)!;
      }

      let vehicle: { id: string; name: string } | null = null;
      if (a.vehicle) {
        const vId = await resolveVehicleId(a.vehicle);
        vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id: vId }, select: { id: true, name: true } });
      }

      let implement: { id: string; name: string } | null = null;
      if (a.implement) {
        const imps = await prisma.implement.findMany({ select: { id: true, name: true } });
        const hit = pickOne('Haakeriist', a.implement, imps.map((i) => ({ id: i.id, label: i.name, keys: [i.name] })));
        implement = imps.find((i) => i.id === hit.id)!;
      }

      const warehouses = a.warehouse || a.articles?.some((x) => x.warehouse)
        ? await prisma.warehouse.findMany({ select: { id: true, name: true } })
        : [];
      const resolveWh = (q: string | undefined): string | null => {
        if (!q) return null;
        return pickOne('Ladu', q, warehouses.map((w) => ({ id: w.id, label: w.name, keys: [w.name] }))).id;
      };
      const warehouseId = resolveWh(a.warehouse);

      let harvestLotIdIn: string | null = null;
      if (a.harvestLot) {
        const lots = await prisma.harvestLot.findMany({ select: { id: true, name: true } });
        harvestLotIdIn = pickOne('Saagipartii', a.harvestLot, lots.map((l) => ({ id: l.id, label: l.name, keys: [l.name] }))).id;
      }

      const articles: { id: string; name: string; unit: string; quantity: number; ratePerHa: number | null; pria: { priaRegister: string | null; priaKind: string | null; priaSpec: string | null; activeIngredient: string | null; nKgHa: number | null; pKgHa: number | null; kKgHa: number | null }; warehouseId: string | null }[] = [];
      if (a.articles?.length) {
        const allArticles = await prisma.article.findMany({
          select: {
            id: true, name: true, unit: true, priaRegister: true, priaKind: true, priaSpec: true,
            activeIngredient: true, nPct: true, pPct: true, kPct: true,
            category: { select: { group: true, systemKind: true } }
          }
        });
        const candidates = allArticles.map((r) => ({ id: r.id, label: r.name, keys: [r.name] }));
        const byId = new Map(allArticles.map((r) => [r.id, r]));
        for (const item of a.articles) {
          const hit = pickOne('Artikkel', item.article, candidates);
          const art = byId.get(hit.id)!;
          if (!articleAllowedOnLine('MATERIAL', art.category)) {
            throw new ToolInputError(`Artikkel "${art.name}" ei sobi materjalireale`);
          }
          const ratePerHa = item.ratePerHa ?? (a.areaHa ? item.quantity / a.areaHa : null);
          const rateKg = ratePerHa !== null ? convertQty(ratePerHa, art.unit, 'kg') : null;
          const npk = (pct: number | null) => (rateKg !== null && pct !== null ? round2((rateKg * pct) / 100) : null);
          articles.push({
            id: art.id,
            name: art.name,
            unit: art.unit,
            quantity: item.quantity,
            ratePerHa,
            pria: {
              priaRegister: art.priaRegister,
              priaKind: art.priaKind,
              priaSpec: art.priaSpec,
              activeIngredient: art.activeIngredient,
              nKgHa: npk(art.nPct),
              pKgHa: npk(art.pPct),
              kKgHa: npk(art.kPct)
            },
            warehouseId: resolveWh(item.warehouse)
          });
        }
      }

      const harvest = a.harvestTonnes !== undefined || a.harvestBunkers !== undefined
        ? { tonnes: a.harvestTonnes ?? null, ratePerHa: a.harvestTonnes && a.areaHa ? a.harvestTonnes / a.areaHa : null, priaKind: null, priaSpec: null, withBunkers: a.harvestBunkers !== undefined }
        : null;
      const observations = (a.observations ?? []).map((o) => ({
        label: o.label.trim(),
        quantity: o.quantity ?? 0,
        unit: o.unit?.trim() ?? '',
        priaRegister: o.priaRegister?.trim() || null
      }));

      let savedId: string;
      try {
        savedId = await tenantTransaction(async (tx) => {
          const entryArticles = await loadEntryArticles(tx, {
            workerId: worker?.id ?? null,
            vehicleId: vehicle?.id ?? null,
            implementId: implement?.id ?? null
          });
          const drafts = buildEntryLines({
            ...entryArticles,
            laborHours: a.laborHours ?? null,
            workerName: worker ? `Tööaeg · ${worker.name}` : null,
            vehicle,
            implement,
            equipmentHours: a.equipmentHours ?? null,
            fuelLiters: a.fuelLiters ?? null,
            articles,
            harvestTonnes: a.harvestTonnes ?? null,
            harvest,
            observations
          });
          const harvestTonnesManual = (drafts.find((l) => l.kind === 'HARVEST')?.quantity ?? 0) > 0;
          let harvestLotId: string | null = null;
          if (drafts.some((l) => l.kind === 'HARVEST')) {
            harvestLotId = await applyEntryHarvest(tx, drafts, {
              fieldSeasonId: work!.fieldSeasonId,
              areaHa: a.areaHa ?? null,
              fieldAreaHa: work!.fieldSeason.areaHa,
              bunkers: a.harvestBunkers ?? null,
              manual: harvestTonnesManual,
              requestedLotId: harvestLotIdIn,
              old: null
            });
          }
          await validateLineWarehouses(tx, drafts.map((l) => l.warehouseId), []);
          const resolvedWarehouseId = await resolveEntryWarehouseId(tx, warehouseId, null);
          const created = await tx.workEntry.create({
            data: {
              fieldWorkId: work!.id,
              date,
              areaHa: a.areaHa ?? null,
              workerId: worker?.id ?? null,
              vehicleId: vehicle?.id ?? null,
              implementId: implement?.id ?? null,
              equipmentHours: a.equipmentHours ?? null,
              laborHours: a.laborHours ?? null,
              fuelLiters: a.fuelLiters ?? null,
              startTime: a.startTime?.trim() || null,
              endTime: a.endTime?.trim() || null,
              method: a.method?.trim() || null,
              harvestBunkers: a.harvestBunkers ?? null,
              harvestLotId,
              harvestTonnesManual,
              warehouseId: resolvedWarehouseId,
              notes: a.notes?.trim() || null,
              createdById: ctx.user.id,
              lines: { create: drafts }
            }
          });
          await recomputeArticleStock(tx, [...stockArticleIdsOf(drafts), ...await lotBunkerArticleIds(tx, [harvestLotId])]);
          return created.id;
        }, { timeout: 60000 });
      } catch (err) {
        if (err instanceof StockValidationError || err instanceof HarvestLotError) {
          throw new ToolInputError(err.message);
        }
        throw err;
      }

      await syncFieldWorkStatus(work.id, a.finish === true, ctx.user.id, prisma);

      const finance = canSeeFinance(ctx);
      const saved = await prisma.workEntry.findUniqueOrThrow({
        where: { id: savedId },
        include: {
          fieldWork: { select: { id: true, status: true, workType: { select: { name: true, shortName: true } }, fieldSeason: { select: { num: true, field: { select: { num: true, name: true } } } } } },
          worker: { select: { name: true } }, vehicle: { select: { name: true } }, implement: { select: { name: true } },
          harvestLot: { select: { name: true } }, warehouse: { select: { name: true } },
          lines: { orderBy: { sortOrder: 'asc' } }
        }
      });
      const costLineOut = (l: { kind: string; label: string; quantity: number; unit: string; unitPrice: unknown }) => {
        const up = l.unitPrice === null || l.unitPrice === undefined ? null : Number(l.unitPrice);
        return {
          kind: l.kind, name: l.label, quantity: round2(l.quantity), unit: l.unit,
          ...(finance ? { unitPrice: round2(up), cost: up === null ? null : round2(up * l.quantity) } : {})
        };
      };
      return {
        id: saved.id,
        fieldWorkId: saved.fieldWork.id,
        workStatus: saved.fieldWork.status,
        date: fmtDate(saved.date),
        field: fieldLabel({ num: saved.fieldWork.fieldSeason.num ?? saved.fieldWork.fieldSeason.field.num, name: saved.fieldWork.fieldSeason.field.name }),
        work: workTypeDisplayName(saved.fieldWork.workType),
        worker: saved.worker?.name ?? null,
        vehicle: saved.vehicle?.name ?? null,
        implement: saved.implement?.name ?? null,
        areaHa: round2(saved.areaHa),
        equipmentHours: round2(saved.equipmentHours),
        laborHours: round2(saved.laborHours),
        fuelLiters: round2(saved.fuelLiters),
        harvestBunkers: round2(saved.harvestBunkers),
        harvestLot: saved.harvestLot?.name ?? null,
        warehouse: saved.warehouse?.name ?? null,
        method: saved.method,
        notes: saved.notes,
        articles: saved.lines.filter((l) => l.kind === 'MATERIAL').map((l) => articleLineOut(l, ctx)),
        services: saved.lines.filter((l) => l.kind === 'LABOR' || l.kind === 'MACHINE' || l.kind === 'IMPLEMENT').map(costLineOut),
        fuelLines: saved.lines.filter((l) => l.kind === 'FUEL').map(costLineOut),
        harvest: saved.lines.filter((l) => l.kind === 'HARVEST').map((l) => ({ quantity: round2(l.quantity), unit: l.unit })),
        observations: saved.lines.filter((l) => l.kind === 'OBSERVATION').map((l) => ({ name: l.label, kind: l.priaRegister ?? undefined }))
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
          fieldWork: { select: { workType: { select: { name: true, shortName: true } }, fieldSeason: { select: { num: true, field: { select: { num: true, name: true } } } } } },
          worker: { select: { name: true } }, vehicle: { select: { name: true } }, implement: { select: { name: true } },
          harvestLot: { select: { name: true } }, warehouse: { select: { name: true } },
          financeConfirmedBy: { select: { displayName: true, username: true } },
          lines: { orderBy: { sortOrder: 'asc' } }
        }
      });
      const out = limitRows(rows, a.limit);
      const costLineOut = (l: { kind: string; label: string; quantity: number; unit: string; unitPrice: unknown }) => {
        const up = l.unitPrice === null || l.unitPrice === undefined ? null : Number(l.unitPrice);
        return {
          kind: l.kind, name: l.label, quantity: round2(l.quantity), unit: l.unit,
          ...(finance ? { unitPrice: round2(up), cost: up === null ? null : round2(up * l.quantity) } : {})
        };
      };
      return {
        total: out.total, shown: out.shown,
        rows: out.rows.map((e) => {
          const costed = e.lines.filter((l) => l.unitPrice !== null);
          return {
            date: fmtDate(e.date), dateTo: fmtDate(e.dateTo), startTime: e.startTime, endTime: e.endTime, occurrenceNo: e.occurrenceNo,
            field: fieldLabel({ num: e.fieldWork.fieldSeason.num ?? e.fieldWork.fieldSeason.field.num, name: e.fieldWork.fieldSeason.field.name }),
            work: workTypeDisplayName(e.fieldWork.workType), source: e.source,
            worker: e.worker?.name ?? null, vehicle: e.vehicle?.name ?? null, implement: e.implement?.name ?? null,
            areaHa: round2(e.areaHa), telemetryAreaHa: round2(e.telemetryAreaHa),
            equipmentHours: round2(e.equipmentHours), laborHours: round2(e.laborHours), fuelLiters: round2(e.fuelLiters),
            harvestBunkers: round2(e.harvestBunkers), harvestLot: e.harvestLot?.name ?? null, warehouse: e.warehouse?.name ?? null, tripId: e.tripId,
            method: e.method, notes: e.notes,
            articles: e.lines.filter((l) => l.kind === 'MATERIAL').map((l) => articleLineOut(l, ctx)),
            services: e.lines.filter((l) => l.kind === 'LABOR' || l.kind === 'MACHINE' || l.kind === 'IMPLEMENT').map(costLineOut),
            fuelLines: e.lines.filter((l) => l.kind === 'FUEL').map(costLineOut),
            harvest: e.lines.filter((l) => l.kind === 'HARVEST').map((l) => ({ quantity: round2(l.quantity), unit: l.unit })),
            observations: e.lines.filter((l) => l.kind === 'OBSERVATION').map((l) => ({ name: l.label, kind: l.priaRegister ?? undefined })),
            ...(finance ? {
              financeStatus: e.financeStatus,
              financeConfirmedAt: fmtDateTime(e.financeConfirmedAt),
              financeConfirmedBy: e.financeConfirmedBy ? (e.financeConfirmedBy.displayName || e.financeConfirmedBy.username) : null,
              financeNotes: e.financeNotes,
              totalCost: round2(costed.reduce((s, l) => s + Number(l.unitPrice) * l.quantity, 0)),
              unpricedLines: e.lines.filter((l) => l.unitPrice === null && l.kind !== 'HARVEST' && l.kind !== 'OBSERVATION').length
            } : {})
          };
        })
      };
    }
  }),
  defineTool({
    name: 'summarize_article_usage',
    title: 'Materjalikulu kokku',
    description: 'Kulumaterjalide kogus kokku artikli ja põllu või kultuuri kaupa (kanded). Pindala = nende kannete pindala summa. Finantsõigusega ka summa €.',
    input: { ...entryFilters, groupBy: z.enum(['field', 'crop']).default('field').describe('Grupeeri põllu või kultuuri järgi') },
    run: async (a, ctx) => {
      const finance = canSeeFinance(ctx);
      const entries = await prisma.workEntry.findMany({
        where: await entryWhere(a),
        select: {
          id: true, areaHa: true,
          fieldWork: { select: { fieldSeason: { select: { crop: true, field: { select: { num: true, name: true } } } } } },
          lines: { where: { kind: { in: ['MATERIAL', 'FUEL'] }, ...(a.article ? { label: ci(a.article) } : {}) }, select: { label: true, quantity: true, unit: true, unitPrice: true } }
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
