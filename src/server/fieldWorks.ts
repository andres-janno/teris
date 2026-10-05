// src/server/fieldWorks.ts — põllutööde register: tööd, materjalid, mallid, hooaja tööd, kanded, finantsid.
// PRIA põlluraamatust (field_operations) täiesti lahus.
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma } from './db.ts';
import { json, parseBody } from './http.ts';
import { sessionUserOf } from './authGate.ts';
import {
  buildEntryLines,
  canConfirm,
  isUndeterminedCrop,
  isWinterCrop,
  matchCrop,
  mergeLines,
  summarizeLines,
  type FinanceStatus,
  type StoredLine
} from './fieldWorkRules.ts';

const PHASES = ['PREPARATION', 'SOWING', 'CARE', 'HARVEST'] as const;
const REPEAT_MODES = ['ONCE', 'UP_TO', 'INTERVAL'] as const;
const MATERIAL_CATEGORIES = ['SEED', 'FERTILIZER', 'PLANT_PROTECTION', 'OTHER'] as const;
const MAX_BODY_BYTES = 256 * 1024;

type Phase = (typeof PHASES)[number];

const text = (v: unknown, max = 500): string | null => {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null =>
  list.includes(String(v) as T) ? (String(v) as T) : null;
const dateOnly = (v: unknown): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};
const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().split('T')[0] : null);
const decimalToNumber = (d: unknown): number | null => (d === null || d === undefined ? null : Number(d));

// Finantse näevad finantsjuht ja admin.
const canSeeFinance = (req: IncomingMessage) => {
  const u = sessionUserOf(req) as { isAdmin?: boolean; isFinanceManager?: boolean } | null;
  return u?.isAdmin === true || u?.isFinanceManager === true;
};
const FINANCE_FORBIDDEN = 'Finantsandmed on nähtavad ainult finantsjuhile ja adminile';

// ---------------------------------------------------------------------------
// Algandmed: tööde register ja üldmall (lisatakse, kui register on tühi)
// ---------------------------------------------------------------------------

const SEED_WORK_TYPES: { name: string; phase: Phase; repeatMode?: 'ONCE' | 'UP_TO' | 'INTERVAL'; maxRepeats?: number; intervalDays?: number; usesMaterials?: boolean }[] = [
  { name: 'Kõrrekoorimine', phase: 'PREPARATION' },
  { name: 'Künd', phase: 'PREPARATION' },
  { name: 'Kivikoristus', phase: 'PREPARATION' },
  { name: 'Randaalimine', phase: 'PREPARATION' },
  { name: 'Libistamine', phase: 'PREPARATION' },
  { name: 'Rullimine', phase: 'PREPARATION' },
  { name: 'Umbrohutõrje (enne külvi)', phase: 'PREPARATION', usesMaterials: true },
  { name: 'Külv', phase: 'SOWING', usesMaterials: true },
  { name: 'Väetamine', phase: 'CARE', repeatMode: 'UP_TO', maxRepeats: 3, usesMaterials: true },
  { name: 'Taimekaitse', phase: 'CARE', repeatMode: 'UP_TO', maxRepeats: 4, usesMaterials: true },
  { name: 'Leheväetamine', phase: 'CARE', repeatMode: 'UP_TO', maxRepeats: 2, usesMaterials: true },
  { name: 'Koristus', phase: 'HARVEST' }
];

const SEED_SPRING_TEMPLATE: { name: string; timing: string; count?: number }[] = [
  { name: 'Künd', timing: 'sügis / aprill' },
  { name: 'Libistamine', timing: 'aprill' },
  { name: 'Randaalimine', timing: 'aprill – mai' },
  { name: 'Külv', timing: 'aprill – mai', count: 1 },
  { name: 'Väetamine', timing: 'aprill – mai', count: 2 },
  { name: 'Taimekaitse', timing: 'mai – juuni', count: 2 },
  { name: 'Leheväetamine', timing: 'mai', count: 1 },
  { name: 'Seire', timing: 'mai – juuni' },
  { name: 'Koristus', timing: 'august – september', count: 1 }
];

const SEED_AUTUMN_TEMPLATE: { name: string; timing: string; count?: number }[] = [
  { name: 'Künd', timing: 'juuli – august' },
  { name: 'Randaalimine', timing: 'august' },
  { name: 'Külv', timing: 'august – september', count: 1 },
  { name: 'Taimekaitse', timing: 'sügis (sept–okt) / kevad (mai–juuni)', count: 3 },
  { name: 'Väetamine', timing: 'sügis (aug–sept) / kevad (apr–mai)', count: 3 },
  { name: 'Leheväetamine', timing: 'mai', count: 1 },
  { name: 'Seire', timing: 'aprill – mai' },
  { name: 'Koristus', timing: 'juuli – august', count: 1 }
];

let seedChecked = false;
async function ensureSeed(): Promise<void> {
  if (seedChecked) return;
  if ((await prisma.workType.count()) === 0) {
    await prisma.$transaction(async (tx) => {
      const ids = new Map<string, string>();
      for (const [i, w] of SEED_WORK_TYPES.entries()) {
        const created = await tx.workType.create({
          data: {
            name: w.name,
            phase: w.phase,
            repeatMode: w.repeatMode ?? 'ONCE',
            maxRepeats: w.maxRepeats ?? null,
            intervalDays: w.intervalDays ?? null,
            usesMaterials: w.usesMaterials ?? false,
            sortOrder: i
          }
        });
        ids.set(w.name, created.id);
      }
      const spring = await tx.workTemplate.create({ data: { cropId: null, isWinter: false } });
      for (const [i, t] of SEED_SPRING_TEMPLATE.entries()) {
        await tx.workTemplateItem.create({
          data: { templateId: spring.id, workTypeId: ids.get(t.name)!, sortOrder: i, typicalTiming: t.timing, plannedCount: t.count ?? null }
        });
      }
      const autumn = await tx.workTemplate.create({ data: { cropId: null, isWinter: true } });
      for (const [i, t] of SEED_AUTUMN_TEMPLATE.entries()) {
        await tx.workTemplateItem.create({
          data: { templateId: autumn.id, workTypeId: ids.get(t.name)!, sortOrder: i, typicalTiming: t.timing, plannedCount: t.count ?? null }
        });
      }
    });
  } else {
    const types = await prisma.workType.findMany();
    const ids = new Map(types.map((w) => [w.name, w.id]));
    const ensureGeneral = async (isWinter: boolean, items: typeof SEED_SPRING_TEMPLATE) => {
      let t = await prisma.workTemplate.findFirst({ where: { cropId: null, isWinter } });
      if (!t) {
        t = await prisma.workTemplate.create({ data: { cropId: null, isWinter } });
        for (const [i, it] of items.entries()) {
          const typeId = ids.get(it.name);
          if (typeId) {
            await prisma.workTemplateItem.create({
              data: { templateId: t.id, workTypeId: typeId, sortOrder: i, typicalTiming: it.timing, plannedCount: it.count ?? null }
            });
          }
        }
      }
    };
    await ensureGeneral(false, SEED_SPRING_TEMPLATE);
    await ensureGeneral(true, SEED_AUTUMN_TEMPLATE);
  }
  seedChecked = true;
}

// ---------------------------------------------------------------------------
// Mall → hooaja põllu tööd (üldmall või kultuuri erimall)
// ---------------------------------------------------------------------------

// Rakendab malli jooksva koristusaasta kultuurile (fieldSeasonId).
// - Talivili: lisatakse AINULT CARE ja HARVEST (ettevalmistus ja külv tehti eelmisel sügisel).
// - Suvivili: lisatakse PREPARATION, SOWING, CARE, HARVEST.
export async function applyCropTemplate(fieldSeasonId: number): Promise<void> {
  await ensureSeed();
  const fs = await prisma.fieldSeason.findUnique({
    where: { id: fieldSeasonId },
    select: { id: true, fieldId: true, year: true, crop: true, season: { select: { isLocked: true } } }
  });
  if (!fs || fs.season?.isLocked) return;
  if (isUndeterminedCrop(fs.crop)) return;

  const crops = await prisma.crop.findMany({ select: { id: true, name: true, isWinterCrop: true } });
  const crop = matchCrop(fs.crop, crops);
  const isWinter = isWinterCrop(fs.crop, crops);

  const template =
    (crop
      ? await prisma.workTemplate.findFirst({ where: { cropId: crop.id }, include: { items: { include: { workType: true } } } })
      : null) ||
    (await prisma.workTemplate.findFirst({ where: { cropId: null, isWinter }, include: { items: { include: { workType: true } } } }));

  if (!template || !template.items.length) return;

  // Kanneteta tööd eemaldatakse enne uuesti lisamist:
  // Taliviljal eemaldatakse ainult CARE ja HARVEST, et mitte puutuda sügisel tehtud ettevalmistust/külvi
  if (isWinter) {
    await prisma.fieldWork.deleteMany({
      where: { fieldSeasonId, fromTemplate: true, phase: { in: ['CARE', 'HARVEST'] }, entries: { none: {} } }
    });
  } else {
    // Kui suviviljal oli sügisene ettevalmistus tehtud (nt sügiskünd), hoiame selle alles
    const hasAutumnPrep = await prisma.fieldWork.count({
      where: { fieldSeasonId, phase: 'PREPARATION', plannedText: { contains: 'ügis' } }
    });
    if (hasAutumnPrep > 0) {
      await prisma.fieldWork.deleteMany({
        where: { fieldSeasonId, fromTemplate: true, phase: { in: ['SOWING', 'CARE', 'HARVEST'] }, entries: { none: {} } }
      });
    } else {
      await prisma.fieldWork.deleteMany({
        where: { fieldSeasonId, fromTemplate: true, entries: { none: {} } }
      });
    }
  }

  const existing = new Set(
    (await prisma.fieldWork.findMany({ where: { fieldSeasonId }, select: { workTypeId: true } })).map((w) => w.workTypeId)
  );

  const items = [...template.items].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const item of items) {
    const wt = item.workType;
    if (!wt || !wt.isActive || existing.has(wt.id)) continue;

    // Taliviljal käesoleval koristusaastal kevadist ettevalmistust ja külvi ei tehta!
    if (isWinter && (wt.phase === 'PREPARATION' || wt.phase === 'SOWING')) continue;

    await prisma.fieldWork.create({
      data: {
        fieldSeasonId,
        workTypeId: wt.id,
        phase: wt.phase,
        sortOrder: item.sortOrder,
        plannedText: item.typicalTiming,
        plannedCount: (item.plannedCount ?? (wt.repeatMode === 'UP_TO' ? wt.maxRepeats : 1)) ?? 1,
        fromTemplate: true
      }
    });
    existing.add(wt.id);
  }
}

// Sügistööde lisamine järgmise aasta hooajale (nextFieldSeasonId):
// - Taliviljal: lisatakse kogu talivilja elutsükkel: ettevalmistus ja külv sügisesse (näha sügistöödes),
//   hooldus ja koristus saagiaastasse (näha järgmise aasta hooldus- ja koristusveergudes).
// - Suviviljal: lisatakse sügisesse AINULT PREPARATION (sügisene ettevalmistus; külv, hooldus ja koristus on järgmise aasta töödes).
export async function applyAutumnTemplate(nextFieldSeasonId: number): Promise<void> {
  await ensureSeed();
  const nextFs = await prisma.fieldSeason.findUnique({
    where: { id: nextFieldSeasonId },
    select: { id: true, fieldId: true, year: true, crop: true, season: { select: { isLocked: true } } }
  });
  if (!nextFs || nextFs.season?.isLocked) return;
  if (isUndeterminedCrop(nextFs.crop)) return;

  const crops = await prisma.crop.findMany({ select: { id: true, name: true, isWinterCrop: true } });
  const crop = matchCrop(nextFs.crop, crops);
  const isWinter = isWinterCrop(nextFs.crop, crops);

  const template =
    (crop
      ? await prisma.workTemplate.findFirst({ where: { cropId: crop.id }, include: { items: { include: { workType: true } } } })
      : null) ||
    (await prisma.workTemplate.findFirst({ where: { cropId: null, isWinter }, include: { items: { include: { workType: true } } } }));

  if (!template || !template.items.length) return;

  // Eemaldatakse kanneteta tööd enne malli rakendamist:
  // Taliviljal kogu tsükkel, suviviljal ainult sügisene PREPARATION
  if (isWinter) {
    await prisma.fieldWork.deleteMany({
      where: {
        fieldSeasonId: nextFieldSeasonId,
        fromTemplate: true,
        entries: { none: {} }
      }
    });
  } else {
    await prisma.fieldWork.deleteMany({
      where: {
        fieldSeasonId: nextFieldSeasonId,
        fromTemplate: true,
        phase: 'PREPARATION',
        entries: { none: {} }
      }
    });
  }

  const existing = new Set(
    (await prisma.fieldWork.findMany({ where: { fieldSeasonId: nextFieldSeasonId }, select: { workTypeId: true } })).map((w) => w.workTypeId)
  );

  const items = [...template.items].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const item of items) {
    const wt = item.workType;
    if (!wt || !wt.isActive || existing.has(wt.id)) continue;

    // Suviviljal lisatakse sügisesse AINULT PREPARATION tööd (külv, hooldus ja koristus on järgmise aasta töödes)
    if (!isWinter && wt.phase !== 'PREPARATION') continue;

    const isAutumnPhase = wt.phase === 'PREPARATION' || wt.phase === 'SOWING';
    await prisma.fieldWork.create({
      data: {
        fieldSeasonId: nextFieldSeasonId,
        workTypeId: wt.id,
        phase: wt.phase,
        sortOrder: item.sortOrder,
        plannedText: isAutumnPhase ? (item.typicalTiming ?? `Sügis ${nextFs.year - 1}`) : item.typicalTiming,
        plannedCount: (item.plannedCount ?? (wt.repeatMode === 'UP_TO' ? wt.maxRepeats : 1)) ?? 1,
        fromTemplate: true
      }
    });
    existing.add(wt.id);
  }
}

// ---------------------------------------------------------------------------
// Kanded
// ---------------------------------------------------------------------------

async function resolveEntryInput(body: any) {
  const workerId = text(body?.workerId, 64);
  const vehicleId = text(body?.vehicleId, 64);
  const implementId = text(body?.implementId, 64);
  const [worker, vehicle, implement] = await Promise.all([
    workerId ? prisma.relatedParty.findUnique({ where: { id: workerId }, select: { id: true, name: true } }) : null,
    vehicleId ? prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, name: true } }) : null,
    implementId ? prisma.implement.findUnique({ where: { id: implementId }, select: { id: true, name: true } }) : null
  ]);
  const materialsIn: { materialId?: unknown; quantity?: unknown }[] = Array.isArray(body?.materials) ? body.materials : [];
  const materialIds = materialsIn.map((m) => String(m.materialId ?? '')).filter(Boolean);
  const materialRows = materialIds.length
    ? await prisma.material.findMany({ where: { id: { in: materialIds } }, select: { id: true, name: true, unit: true } })
    : [];
  const byId = new Map(materialRows.map((m) => [m.id, m]));
  const materials = materialsIn
    .map((m) => {
      const row = byId.get(String(m.materialId ?? ''));
      const quantity = num(m.quantity);
      return row && quantity !== null ? { ...row, quantity } : null;
    })
    .filter((m): m is { id: string; name: string; unit: string; quantity: number } => m !== null);

  const equipmentHours = num(body?.equipmentHours);
  const fuelLiters = num(body?.fuelLiters);
  const laborHours = num(body?.laborHours);
  const harvestTonnes = num(body?.harvestTonnes);
  const drafts = buildEntryLines({
    laborHours,
    workerName: worker ? `Tööaeg · ${worker.name}` : null,
    vehicle,
    implement,
    equipmentHours,
    fuelLiters,
    materials,
    harvestTonnes
  });
  return {
    data: {
      date: dateOnly(body?.date),
      workerId: worker?.id ?? null,
      areaHa: num(body?.areaHa),
      occurrenceNo: int(body?.occurrenceNo),
      vehicleId: vehicle?.id ?? null,
      implementId: implement?.id ?? null,
      equipmentHours,
      fuelLiters,
      laborHours,
      notes: text(body?.notes, 2000)
    },
    drafts
  };
}

// Töö olek kannete järgi (lõpetatud töö jääb lõpetatuks, kuni see avatakse).
async function syncFieldWorkStatus(fieldWorkId: string, finish: boolean, userId: string | null) {
  const work = await prisma.fieldWork.findUnique({ where: { id: fieldWorkId }, select: { status: true, _count: { select: { entries: true } } } });
  if (!work) return;
  if (finish) {
    await prisma.fieldWork.update({ where: { id: fieldWorkId }, data: { status: 'DONE', finishedAt: new Date(), finishedById: userId } });
  } else if (work.status !== 'DONE') {
    await prisma.fieldWork.update({ where: { id: fieldWorkId }, data: { status: work._count.entries > 0 ? 'IN_PROGRESS' : 'PLANNED' } });
  }
}

const ENTRY_INCLUDE = {
  worker: { select: { name: true } },
  vehicle: { select: { name: true } },
  implement: { select: { name: true } },
  lines: { orderBy: { sortOrder: 'asc' as const } }
};

function entryDto(e: any, withFinance: boolean) {
  const lines = (e.lines ?? []) as any[];
  return {
    id: e.id,
    fieldWorkId: e.fieldWorkId,
    date: isoDate(e.date),
    workerId: e.workerId,
    workerName: e.worker?.name ?? null,
    areaHa: e.areaHa,
    occurrenceNo: e.occurrenceNo,
    vehicleId: e.vehicleId,
    vehicleName: e.vehicle?.name ?? null,
    implementId: e.implementId,
    implementName: e.implement?.name ?? null,
    equipmentHours: e.equipmentHours,
    fuelLiters: e.fuelLiters,
    laborHours: e.laborHours,
    materials: lines.filter((l) => l.kind === 'MATERIAL').map((l) => ({ materialId: l.materialId, name: l.label, unit: l.unit, quantity: l.quantity })),
    harvestTonnes: lines.find((l) => l.kind === 'HARVEST')?.quantity ?? null,
    notes: e.notes,
    financeStatus: e.financeStatus,
    ...(withFinance
      ? {
          financeNotes: e.financeNotes,
          financeConfirmedAt: e.financeConfirmedAt?.toISOString() ?? null,
          lines: lines.map((l) => ({
            id: l.id,
            kind: l.kind,
            label: l.label,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: decimalToNumber(l.unitPrice),
            confirmedQuantity: l.confirmedQuantity
          }))
        }
      : {})
  };
}

const toStored = (l: any): StoredLine => ({
  kind: l.kind,
  vehicleId: l.vehicleId,
  implementId: l.implementId,
  materialId: l.materialId,
  label: l.label,
  quantity: l.quantity,
  unit: l.unit,
  sortOrder: l.sortOrder,
  unitPrice: decimalToNumber(l.unitPrice),
  confirmedQuantity: l.confirmedQuantity
});

// ---------------------------------------------------------------------------
// Päringute käsitleja
// ---------------------------------------------------------------------------

export async function handleFieldWorks(req: IncomingMessage, res: ServerResponse, pathname: string, method: string, url: URL): Promise<boolean> {
  const idOf = (prefix: string) => decodeURIComponent(pathname.slice(prefix.length));
  const user = sessionUserOf(req);
  const userId = user?.id ?? null;

  // --- Tööde register ---
  if (pathname === '/api/work-types' && method === 'GET') {
    await ensureSeed();
    const rows = await prisma.workType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { templateItems: true, fieldWorks: true } } }
    });
    json(res, rows.map(({ _count, createdAt, updatedAt, ...w }) => ({ ...w, templateCount: _count.templateItems, fieldWorkCount: _count.fieldWorks })));
    return true;
  }
  if (pathname === '/api/work-types' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const name = text(b?.name, 120);
    const phase = oneOf(b?.phase, PHASES);
    const repeatMode = oneOf(b?.repeatMode, REPEAT_MODES) ?? 'ONCE';
    if (!name || !phase) {
      json(res, { error: 'Töö nimi ja faas on kohustuslikud' }, 400);
      return true;
    }
    const data = {
      name,
      phase,
      repeatMode,
      maxRepeats: repeatMode === 'UP_TO' ? int(b?.maxRepeats) : null,
      intervalDays: repeatMode === 'INTERVAL' ? int(b?.intervalDays) : null,
      usesMaterials: b?.usesMaterials === true,
      sortOrder: int(b?.sortOrder) ?? 0,
      isActive: b?.isActive !== false
    };
    try {
      const id = text(b?.id, 64);
      const saved = id ? await prisma.workType.update({ where: { id }, data }) : await prisma.workType.create({ data });
      json(res, saved);
    } catch (err: any) {
      if (err?.code === 'P2002') json(res, { error: 'Sellise nimega töö on juba olemas' }, 409);
      else throw err;
    }
    return true;
  }
  if (pathname.startsWith('/api/work-types/') && method === 'DELETE') {
    const id = idOf('/api/work-types/');
    const w = await prisma.workType.findUnique({ where: { id }, include: { _count: { select: { templateItems: true, fieldWorks: true } } } });
    if (!w) {
      json(res, { error: 'Tööd ei leitud' }, 404);
      return true;
    }
    if (w._count.templateItems || w._count.fieldWorks) {
      json(res, { error: `Töö on kasutusel ${w._count.templateItems} mallis ja ${w._count.fieldWorks} põllul. Eemalda need seosed või märgi töö mitteaktiivseks.` }, 409);
      return true;
    }
    await prisma.workType.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }

  // --- Kulumaterjalid ---
  if (pathname === '/api/materials' && method === 'GET') {
    const rows = await prisma.material.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { entryLines: true } } }
    });
    json(res, rows.map(({ _count, createdAt, updatedAt, ...m }) => ({ ...m, usageCount: _count.entryLines })));
    return true;
  }
  if (pathname === '/api/materials' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const name = text(b?.name, 160);
    const category = oneOf(b?.category, MATERIAL_CATEGORIES);
    const unit = text(b?.unit, 16);
    if (!name || !category || !unit) {
      json(res, { error: 'Materjali nimi, liik ja ühik on kohustuslikud' }, 400);
      return true;
    }
    const data = { name, category, unit, cropVarietyId: text(b?.cropVarietyId, 64), isActive: b?.isActive !== false, notes: text(b?.notes, 1000) };
    try {
      const id = text(b?.id, 64);
      const saved = id ? await prisma.material.update({ where: { id }, data }) : await prisma.material.create({ data });
      json(res, saved);
    } catch (err: any) {
      if (err?.code === 'P2002') json(res, { error: 'Selline materjal on juba olemas' }, 409);
      else throw err;
    }
    return true;
  }
  if (pathname.startsWith('/api/materials/') && method === 'DELETE') {
    const id = idOf('/api/materials/');
    const used = await prisma.workEntryLine.count({ where: { materialId: id } });
    if (used) {
      json(res, { error: `Materjal on kasutusel ${used} kandes. Märgi see mitteaktiivseks.` }, 409);
      return true;
    }
    await prisma.material.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }

  // --- Mallid (üldmallid + kultuuride erimallid) ---
  if (pathname === '/api/work-templates' && method === 'GET') {
    await ensureSeed();
    const templates = await prisma.workTemplate.findMany({
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    });

    const result = templates.map((t) => ({
      id: t.id,
      cropId: t.cropId,
      isWinter: t.isWinter,
      name: t.cropId === null ? (t.isWinter ? 'Talivilja üldmall' : 'Suvivilja üldmall') : undefined,
      items: t.items.map((i) => ({
        id: i.id,
        workTypeId: i.workTypeId,
        sortOrder: i.sortOrder,
        typicalTiming: i.typicalTiming,
        plannedCount: i.plannedCount
      }))
    }));

    json(res, result);
    return true;
  }
  if (pathname === '/api/work-templates' && method === 'PUT') {
    await ensureSeed();
    const b = await parseBody(req, MAX_BODY_BYTES);
    const cropId = text(b?.cropId, 64);
    const isWinter = b?.isWinter === true;
    const items: any[] = Array.isArray(b?.items) ? b.items : [];

    const saved = await prisma.$transaction(async (tx) => {
      const template =
        (await tx.workTemplate.findFirst({ where: { cropId, isWinter } })) ?? (await tx.workTemplate.create({ data: { cropId, isWinter } }));
      await tx.workTemplateItem.deleteMany({ where: { templateId: template.id } });
      const seen = new Set<string>();
      for (const [i, it] of items.entries()) {
        const workTypeId = text(it?.workTypeId, 64);
        if (!workTypeId || seen.has(workTypeId)) continue;
        seen.add(workTypeId);
        await tx.workTemplateItem.create({
          data: { templateId: template.id, workTypeId, sortOrder: i, typicalTiming: text(it?.typicalTiming, 80), plannedCount: int(it?.plannedCount) }
        });
      }
      return template;
    });
    json(res, { success: true, id: saved.id });
    return true;
  }
  if (pathname.startsWith('/api/work-templates/') && method === 'DELETE') {
    const id = idOf('/api/work-templates/');
    const t = await prisma.workTemplate.findUnique({ where: { id } });
    if (!t) {
      json(res, { error: 'Malli ei leitud' }, 404);
      return true;
    }
    if (t.cropId === null) {
      json(res, { error: 'Üldmalli ei saa kustutada' }, 409);
      return true;
    }
    await prisma.workTemplate.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }

  // --- Hooaja põllu tööd ---
  if (pathname === '/api/field-works' && method === 'GET') {
    const year = int(url.searchParams.get('year'));
    if (year === null) {
      json(res, { error: 'Hooaeg (year) on kohustuslik' }, 400);
      return true;
    }
    const finance = canSeeFinance(req);
    const crops = await prisma.crop.findMany({ select: { id: true, name: true, isWinterCrop: true } });
    const currentSeasons = await prisma.fieldSeason.findMany({
      where: { year },
      select: {
        id: true,
        fieldId: true,
        crop: true,
        cropColor: true,
        cropVariety: true,
        fieldWorks: { select: { id: true } }
      }
    });

    for (const fs of currentSeasons) {
      // Kui kultuur on määramata, aga eelmisel aastal oli talivili: päri kultuur eelmisest aastast
      if (isUndeterminedCrop(fs.crop)) {
        const prevSeason = await prisma.fieldSeason.findUnique({
          where: { fieldId_year: { fieldId: fs.fieldId, year: year - 1 } },
          select: { crop: true, cropColor: true, cropVariety: true }
        });
        if (prevSeason && isWinterCrop(prevSeason.crop, crops)) {
          await prisma.fieldSeason.update({
            where: { id: fs.id },
            data: {
              crop: prevSeason.crop,
              cropColor: prevSeason.cropColor,
              cropVariety: prevSeason.cropVariety
            }
          });
          fs.crop = prevSeason.crop;
        }
      }
    }

    const rows = await prisma.fieldWork.findMany({
      where: { fieldSeason: { year } },
      orderBy: [{ fieldSeasonId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        workType: true,
        fieldSeason: { select: { id: true, fieldId: true, crop: true, year: true } },
        entries: { orderBy: { date: 'desc' }, include: ENTRY_INCLUDE }
      }
    });

    // Järgmise aasta taliviljade ja suviviljade sügistööd (teostatakse selle aasta sügisel)
    const nextYearSeasons = await prisma.fieldSeason.findMany({
      where: { year: year + 1 },
      select: {
        id: true,
        fieldId: true,
        crop: true,
        year: true,
        fieldWorks: { select: { id: true } }
      }
    });

    const nextAutumnSeasonIds: number[] = [];
    for (const ns of nextYearSeasons) {
      if (!isUndeterminedCrop(ns.crop)) {
        nextAutumnSeasonIds.push(ns.id);
      }
    }

    const nextAutumnRows = nextAutumnSeasonIds.length > 0 ? await prisma.fieldWork.findMany({
      where: {
        fieldSeasonId: { in: nextAutumnSeasonIds }
      },
      orderBy: [{ fieldSeasonId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        workType: true,
        fieldSeason: { select: { id: true, fieldId: true, crop: true, year: true } },
        entries: { orderBy: { date: 'desc' }, include: ENTRY_INCLUDE }
      }
    }) : [];

    const worksDto: any[] = rows.map((w) => {
      const isWinter = isWinterCrop(w.fieldSeason.crop, crops);
      const isAutumnPhase = isWinter && (w.phase === 'PREPARATION' || w.phase === 'SOWING');
      return {
        id: w.id,
        fieldSeasonId: w.fieldSeasonId,
        workTypeId: w.workTypeId,
        workTypeName: w.workType.name,
        phase: w.phase,
        repeatMode: w.workType.repeatMode,
        intervalDays: w.workType.intervalDays,
        usesMaterials: w.workType.usesMaterials,
        sortOrder: w.sortOrder,
        plannedText: w.plannedText,
        plannedCount: w.plannedCount,
        status: w.status,
        finishedAt: isoDate(w.finishedAt),
        fromTemplate: w.fromTemplate,
        notes: w.notes,
        entries: w.entries.map((e) => entryDto(e, finance)),
        carriedOverFromYear: isAutumnPhase ? year - 1 : null,
        carriedOverToYear: null,
        seasonYear: year,
        isNextSeasonWinterSowing: false
      };
    });

    for (const w of nextAutumnRows) {
      const isWinter = isWinterCrop(w.fieldSeason.crop, crops);
      // Suviviljal kuulub sügisesse ainult ettevalmistus (külv, hooldus ja koristus on järgmisel aastal)
      if (!isWinter && w.phase !== 'PREPARATION') continue;
      const isAutumnPhase = w.phase === 'PREPARATION' || w.phase === 'SOWING';
      worksDto.push({
        id: w.id,
        fieldSeasonId: w.fieldSeasonId,
        workTypeId: w.workTypeId,
        workTypeName: w.workType.name,
        phase: w.phase,
        repeatMode: w.workType.repeatMode,
        intervalDays: w.workType.intervalDays,
        usesMaterials: w.workType.usesMaterials,
        sortOrder: w.sortOrder,
        plannedText: isAutumnPhase ? (w.plannedText ?? `Sügis ${year}`) : w.plannedText,
        plannedCount: w.plannedCount,
        status: w.status,
        finishedAt: isoDate(w.finishedAt),
        fromTemplate: w.fromTemplate,
        notes: w.notes,
        entries: w.entries.map((e) => entryDto(e, finance)),
        carriedOverFromYear: null,
        carriedOverToYear: year + 1,
        seasonYear: year + 1,
        isNextSeasonWinterSowing: isWinter && isAutumnPhase
      });
    }

    json(res, worksDto);
    return true;
  }
  if (pathname === '/api/field-works' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const fieldSeasonId = int(b?.fieldSeasonId);
    const workTypeId = text(b?.workTypeId, 64);
    const workType = workTypeId ? await prisma.workType.findUnique({ where: { id: workTypeId } }) : null;
    if (fieldSeasonId === null || !workType) {
      json(res, { error: 'Põld ja töö on kohustuslikud' }, 400);
      return true;
    }
    const preferredSortOrder = int(b?.sortOrder);
    const last = await prisma.fieldWork.findFirst({ where: { fieldSeasonId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    try {
      const saved = await prisma.fieldWork.create({
        data: {
          fieldSeasonId,
          workTypeId: workType.id,
          phase: workType.phase,
          sortOrder: preferredSortOrder !== null ? preferredSortOrder : (last?.sortOrder ?? -1) + 1,
          plannedText: text(b?.plannedText, 80),
          plannedCount: Math.max(1, int(b?.plannedCount) ?? workType.maxRepeats ?? 1)
        }
      });
      json(res, saved);
    } catch (err: any) {
      if (err?.code === 'P2002') json(res, { error: 'See töö on põllul juba olemas' }, 409);
      else throw err;
    }
    return true;
  }
  if (pathname === '/api/field-works/apply-template' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const ids: number[] = (Array.isArray(b?.fieldSeasonIds) ? b.fieldSeasonIds : [b?.fieldSeasonId]).map(int).filter((n: number | null): n is number => n !== null);
    const mode = b?.mode === 'AUTUMN' ? 'AUTUMN' : 'CURRENT';
    for (const id of ids) {
      if (mode === 'AUTUMN') {
        await applyAutumnTemplate(id);
      } else {
        await applyCropTemplate(id);
      }
    }
    json(res, { success: true, count: ids.length, mode });
    return true;
  }
  if (pathname === '/api/field-works/clear' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const fieldSeasonId = int(b?.fieldSeasonId);
    if (!fieldSeasonId) {
      json(res, { error: 'Põlluhooaja ID on kohustuslik' }, 400);
      return true;
    }
    const fs = await prisma.fieldSeason.findUnique({
      where: { id: fieldSeasonId },
      select: { season: { select: { isLocked: true } } }
    });
    if (fs?.season?.isLocked) {
      json(res, { error: 'Lukus hooaja töid ei saa muuta' }, 403);
      return true;
    }
    const mode = b?.mode === 'AUTUMN' ? 'AUTUMN' : 'ALL';
    if (mode === 'AUTUMN') {
      const entriesCount = await prisma.workEntry.count({
        where: { fieldWork: { fieldSeasonId, phase: { in: ['PREPARATION', 'SOWING'] } } }
      });
      if (entriesCount > 0) {
        json(res, { error: `Põllu sügistöödel on ${entriesCount} kannet. Töid ei saa eemaldada enne kannete kustutamist.` }, 409);
        return true;
      }
      const { count } = await prisma.fieldWork.deleteMany({
        where: { fieldSeasonId, phase: { in: ['PREPARATION', 'SOWING'] } }
      });
      json(res, { success: true, count, mode });
      return true;
    }

    const entriesCount = await prisma.workEntry.count({
      where: { fieldWork: { fieldSeasonId } }
    });
    if (entriesCount > 0) {
      json(res, { error: `Põllu töödel on ${entriesCount} kannet. Töid ei saa eemaldada enne kannete kustutamist.` }, 409);
      return true;
    }
    let totalCount = 0;
    const { count } = await prisma.fieldWork.deleteMany({
      where: { fieldSeasonId }
    });
    totalCount += count;

    const nextSeasonId = int(b?.nextSeasonId);
    if (nextSeasonId) {
      const nextFs = await prisma.fieldSeason.findUnique({
        where: { id: nextSeasonId },
        select: { season: { select: { isLocked: true } } }
      });
      if (!nextFs?.season?.isLocked) {
        const nextEntries = await prisma.workEntry.count({
          where: { fieldWork: { fieldSeasonId: nextSeasonId, phase: { in: ['PREPARATION', 'SOWING'] } } }
        });
        if (nextEntries === 0) {
          const resNext = await prisma.fieldWork.deleteMany({
            where: { fieldSeasonId: nextSeasonId, phase: { in: ['PREPARATION', 'SOWING'] } }
          });
          totalCount += resNext.count;
        }
      }
    }

    json(res, { success: true, count: totalCount });
    return true;
  }
  if (pathname.startsWith('/api/field-works/') && method === 'PATCH') {
    const id = idOf('/api/field-works/');
    const b = await parseBody(req, MAX_BODY_BYTES);
    const data: Record<string, unknown> = {};
    if ('plannedText' in b) data.plannedText = text(b.plannedText, 80);
    if ('plannedCount' in b) data.plannedCount = Math.max(1, int(b.plannedCount) ?? 1);
    if ('notes' in b) data.notes = text(b.notes, 2000);
    if (b?.status === 'DONE') Object.assign(data, { status: 'DONE', finishedAt: new Date(), finishedById: userId });
    await prisma.fieldWork.update({ where: { id }, data });
    // Lõpetatud töö avamine: olek kannete järgi.
    if (b?.status === 'REOPEN') {
      const n = await prisma.workEntry.count({ where: { fieldWorkId: id } });
      await prisma.fieldWork.update({ where: { id }, data: { status: n > 0 ? 'IN_PROGRESS' : 'PLANNED', finishedAt: null, finishedById: null } });
    }
    json(res, { success: true, id });
    return true;
  }
  if (pathname.startsWith('/api/field-works/') && method === 'DELETE') {
    const id = idOf('/api/field-works/');
    const n = await prisma.workEntry.count({ where: { fieldWorkId: id } });
    if (n > 0) {
      json(res, { error: `Tööl on ${n} kannet. Kustuta enne kanded.` }, 409);
      return true;
    }
    await prisma.fieldWork.delete({ where: { id } });
    json(res, { success: true, id });
    return true;
  }

  // --- Kanded (töötaja: ainult kogused) ---
  if (pathname === '/api/work-entries' && method === 'POST') {
    const b = await parseBody(req, MAX_BODY_BYTES);
    const fieldWorkId = text(b?.fieldWorkId, 64);
    const work = fieldWorkId ? await prisma.fieldWork.findUnique({ where: { id: fieldWorkId } }) : null;
    const { data, drafts } = await resolveEntryInput(b);
    if (!work || !data.date) {
      json(res, { error: 'Töö ja kuupäev on kohustuslikud' }, 400);
      return true;
    }
    const saved = await prisma.workEntry.create({
      data: { ...data, date: data.date, fieldWorkId: work.id, createdById: userId, lines: { create: drafts } },
      include: ENTRY_INCLUDE
    });
    await syncFieldWorkStatus(work.id, b?.finish === true, userId);
    json(res, entryDto(saved, canSeeFinance(req)));
    return true;
  }
  if (pathname.startsWith('/api/work-entries/') && method === 'PUT') {
    const id = idOf('/api/work-entries/');
    const b = await parseBody(req, MAX_BODY_BYTES);
    const old = await prisma.workEntry.findUnique({ where: { id }, include: { lines: true } });
    const { data, drafts } = await resolveEntryInput(b);
    if (!old || !data.date) {
      json(res, { error: 'Kannet ei leitud või kuupäev puudub' }, 400);
      return true;
    }
    const merged = mergeLines(old.lines.map(toStored), drafts, old.financeStatus as FinanceStatus);
    const saved = await prisma.$transaction(async (tx) => {
      await tx.workEntryLine.deleteMany({ where: { entryId: id } });
      return tx.workEntry.update({
        where: { id },
        data: {
          ...data,
          date: data.date!,
          financeStatus: merged.financeStatus,
          lines: { create: merged.lines.map((l) => ({ ...l, unitPrice: l.unitPrice })) }
        },
        include: ENTRY_INCLUDE
      });
    });
    await syncFieldWorkStatus(old.fieldWorkId, b?.finish === true, userId);
    json(res, entryDto(saved, canSeeFinance(req)));
    return true;
  }
  if (pathname.startsWith('/api/work-entries/') && method === 'DELETE') {
    const id = idOf('/api/work-entries/');
    const e = await prisma.workEntry.findUnique({ where: { id } });
    if (!e) {
      json(res, { error: 'Kannet ei leitud' }, 404);
      return true;
    }
    if (e.financeStatus !== 'PENDING' && !canSeeFinance(req)) {
      json(res, { error: 'Kinnitatud kannet saab kustutada ainult finantsjuht' }, 403);
      return true;
    }
    await prisma.workEntry.delete({ where: { id } });
    await syncFieldWorkStatus(e.fieldWorkId, false, userId);
    json(res, { success: true, id });
    return true;
  }

  // --- Finantsid (finantsjuht ja admin) ---
  if (pathname.startsWith('/api/finance/')) {
    if (!canSeeFinance(req)) {
      json(res, { error: FINANCE_FORBIDDEN }, 403);
      return true;
    }
    if (pathname === '/api/finance/entries' && method === 'GET') {
      const year = int(url.searchParams.get('year'));
      const status = oneOf(url.searchParams.get('status'), ['PENDING', 'CONFIRMED', 'CHANGED'] as const);
      const rows = await prisma.workEntry.findMany({
        where: {
          ...(year !== null ? { fieldWork: { fieldSeason: { year } } } : {}),
          ...(status ? { financeStatus: status } : {})
        },
        orderBy: { date: 'desc' },
        include: {
          ...ENTRY_INCLUDE,
          fieldWork: {
            select: {
              workType: { select: { name: true } },
              fieldSeason: { select: { id: true, year: true, crop: true, areaHa: true, field: { select: { num: true, name: true } } } }
            }
          }
        }
      });
      json(res, rows.map((e) => ({
        ...entryDto(e, true),
        workTypeName: e.fieldWork.workType.name,
        fieldSeasonId: e.fieldWork.fieldSeason.id,
        year: e.fieldWork.fieldSeason.year,
        crop: e.fieldWork.fieldSeason.crop,
        fieldAreaHa: e.fieldWork.fieldSeason.areaHa,
        fieldNum: e.fieldWork.fieldSeason.field.num,
        fieldName: e.fieldWork.fieldSeason.field.name
      })));
      return true;
    }
    if (pathname.startsWith('/api/finance/entries/') && method === 'PATCH') {
      const id = idOf('/api/finance/entries/');
      const b = await parseBody(req, MAX_BODY_BYTES);
      const entry = await prisma.workEntry.findUnique({ where: { id }, include: { lines: true } });
      if (!entry) {
        json(res, { error: 'Kannet ei leitud' }, 404);
        return true;
      }
      const prices: Record<string, unknown> = b?.prices && typeof b.prices === 'object' ? b.prices : {};
      const lines = entry.lines.map((l) => ({
        ...l,
        unitPrice: l.id in prices ? num(prices[l.id]) : decimalToNumber(l.unitPrice)
      }));
      if (b?.confirm === true && !canConfirm(lines)) {
        json(res, { error: 'Igal real peab olema ühiku kulu' }, 400);
        return true;
      }
      await prisma.$transaction(async (tx) => {
        for (const l of lines) {
          await tx.workEntryLine.update({
            where: { id: l.id },
            data: { unitPrice: l.unitPrice, ...(b?.confirm === true ? { confirmedQuantity: l.quantity } : {}) }
          });
        }
        await tx.workEntry.update({
          where: { id },
          data: {
            financeNotes: 'financeNotes' in b ? text(b.financeNotes, 2000) : entry.financeNotes,
            ...(b?.confirm === true ? { financeStatus: 'CONFIRMED', financeConfirmedAt: new Date(), financeConfirmedById: userId } : {})
          }
        });
      });
      json(res, { success: true, id });
      return true;
    }
    if (pathname === '/api/finance/field-results' && method === 'GET') {
      const year = int(url.searchParams.get('year'));
      if (year === null) {
        json(res, { error: 'Hooaeg (year) on kohustuslik' }, 400);
        return true;
      }
      const crops = await prisma.crop.findMany({ select: { name: true, isWinterCrop: true } });
      const seasons = await prisma.fieldSeason.findMany({
        where: { year },
        select: {
          id: true,
          fieldId: true,
          crop: true,
          cropColor: true,
          areaHa: true,
          field: { select: { id: true, num: true, name: true } },
          fieldWorks: { select: { phase: true, entries: { select: { financeStatus: true, lines: { select: { kind: true, quantity: true, unitPrice: true } } } } } }
        }
      });
      const results = [];
      for (const s of seasons) {
        let entries = s.fieldWorks.flatMap((w) => w.entries);
        const isWinter = isWinterCrop(s.crop, crops);
        // Kui tegemist on taliviljaga, kaasame saagiaasta tulemusse ka eelmise sügise ettevalmistuse ja külvi kanded!
        if (isWinter) {
          const prevSeason = await prisma.fieldSeason.findUnique({
            where: { fieldId_year: { fieldId: s.fieldId, year: year - 1 } },
            select: {
              fieldWorks: {
                where: { phase: { in: ['PREPARATION', 'SOWING'] } },
                select: { entries: { select: { financeStatus: true, lines: { select: { kind: true, quantity: true, unitPrice: true } } } } }
              }
            }
          });
          if (prevSeason) {
            const prevEntries = prevSeason.fieldWorks.flatMap((w) => w.entries);
            entries = [...prevEntries, ...entries];
          }
        }
        const confirmed = entries.filter((e) => e.financeStatus === 'CONFIRMED');
        const resObj = summarizeLines(confirmed.flatMap((e) => e.lines.map((l) => ({ kind: l.kind, quantity: l.quantity, unitPrice: decimalToNumber(l.unitPrice) }))));
        results.push({
          fieldSeasonId: s.id,
          fieldId: s.field.id,
          fieldNum: s.field.num,
          fieldName: s.field.name,
          crop: s.crop,
          cropColor: s.cropColor,
          areaHa: s.areaHa,
          entriesTotal: entries.length,
          entriesConfirmed: confirmed.length,
          ...resObj
        });
      }
      json(res, results.filter((r) => r.entriesTotal > 0));
      return true;
    }
    json(res, { error: 'Tundmatu finantspäring' }, 404);
    return true;
  }

  return false;
}
