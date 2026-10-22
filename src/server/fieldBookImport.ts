// src/server/fieldBookImport.ts — PRIA põlluraamatu väljavõtte rida → Terise töö (plaan) + kanne.
// Olemasolev sobiv töö (sama tegevus, ±2 päeva, taimekaitsel/väetamisel ühine toode) ainult täiendatakse:
// täidetakse tühjad plaaniväljad ja puuduvad plaaniread; kandeid ei looda ega muudeta.
// Ei impordi db.ts-i ega HTTP käsitlejat — kasutab ka eraldiseisev üleviimisskript.
import type { Prisma } from '@prisma/client';
import type { FieldBookImportOperation } from '../types/fieldOperation.ts';
import type { WorkPhase } from '../types/fieldWork.ts';
import { PRIA_ACTIVITIES, nameKey, totalFromRate } from '../services/pria.ts';
import { findMatchingWork, operationLines, type ExistingWork, type OperationLine } from './fieldBookRules.ts';
import { syncFieldWorkStatus, type PrismaClientLike } from './fieldWorkStatus.ts';

type Tx = Prisma.TransactionClient;
type Fn = (args: any) => Promise<unknown>;
// Laiendatud kliendi (tenantTransaction) tehing ei ühildu TransactionClient tüübiga — struktuurne tüüp,
// käitusajal samad päringud (vt fieldWorkStatus.ts).
export interface ImportClientLike extends PrismaClientLike {
  workType: { findFirst: Fn; create: Fn };
  material: { findFirst: Fn; create: Fn };
  fieldWork: PrismaClientLike['fieldWork'] & { findMany: Fn; findFirst: Fn; create: Fn };
  fieldWorkLine: { create: Fn };
}
export type ImportClient = Tx | ImportClientLike;
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const asDate = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

export async function ensurePriaWorkTypes(client: ImportClient): Promise<Map<string, { id: string; phase: WorkPhase }>> {
  const tx = client as Tx;
  const map = new Map<string, { id: string; phase: WorkPhase }>();
  for (const a of PRIA_ACTIVITIES) {
    const row = (await tx.workType.findFirst({ where: { priaCode: a.name } }))
      ?? (await tx.workType.create({ data: { name: a.name, priaCode: a.name, phase: a.phase, usesMaterials: a.usesMaterials, sortOrder: a.sortOrder } }));
    map.set(a.name, { id: row.id, phase: row.phase as WorkPhase });
  }
  return map;
}

async function materialFor(tx: Tx, line: OperationLine, cache: Map<string, string>): Promise<string | null> {
  if (line.kind !== 'MATERIAL' || !line.materialCategory) return null;
  const key = `${line.materialCategory}:${nameKey(line.label)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const existing = await tx.material.findFirst({ where: { category: line.materialCategory, name: { equals: line.label, mode: 'insensitive' } } });
  const id = existing?.id ?? (await tx.material.create({ data: { name: line.label, category: line.materialCategory, unit: line.unit || 'kg' } })).id;
  cache.set(key, id);
  return id;
}

const planLine = (l: OperationLine, materialId: string | null, sortOrder: number) => ({
  kind: l.kind as 'MATERIAL' | 'HARVEST',
  materialId,
  label: l.label,
  unit: l.unit,
  ratePerHa: l.perHa ? l.amount : null,
  priaRegister: l.priaRegister, priaKind: l.priaKind, priaSpec: l.priaSpec, activeIngredient: l.activeIngredient,
  nKgHa: l.nKgHa, pKgHa: l.pKgHa, kKgHa: l.kKgHa,
  sortOrder
});

export async function importFieldSeasonOperations(
  client: ImportClient,
  fieldSeasonId: number,
  ops: FieldBookImportOperation[],
  opts: { userId: string | null; fieldAreaHa: number }
): Promise<{ created: number; complemented: number }> {
  const tx = client as Tx;
  const types = await ensurePriaWorkTypes(tx);
  const typeById = new Map([...types].map(([name, t]) => [t.id, name]));
  const rows = await tx.fieldWork.findMany({
    where: { fieldSeasonId },
    include: { lines: true, entries: { include: { lines: true } } }
  });
  const existing: ExistingWork[] = rows.map((w) => ({
    id: w.id,
    activity: typeById.get(w.workTypeId) ?? '',
    plannedFrom: day(w.plannedDateFrom),
    plannedTo: day(w.plannedDateTo),
    entries: w.entries.map((e) => ({ from: day(e.date)!, to: day(e.dateTo) })),
    productKeys: [...w.lines.map((l) => nameKey(l.label)), ...w.entries.flatMap((e) => e.lines.filter((l) => l.kind === 'MATERIAL').map((l) => nameKey(l.label)))]
  }));
  const rowById = new Map(rows.map((w) => [w.id, w]));
  const taken = new Set<string>();
  const materials = new Map<string, string>();
  let created = 0;
  let complemented = 0;
  const last = await tx.fieldWork.findFirst({ where: { fieldSeasonId }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
  let sortOrder = (last?.sortOrder ?? -1) + 1;

  for (const op of ops) {
    const type = types.get(op.type);
    if (!type) continue; // tundmatu tegevus (PRIA lisas uue) — jääb vahele
    const lines = operationLines(op);
    const match = findMatchingWork(op, existing, taken);

    if (match) {
      taken.add(match.id);
      const w = rowById.get(match.id)!;
      const patch: Prisma.FieldWorkUncheckedUpdateInput = {};
      if (!w.plannedDateFrom) { patch.plannedDateFrom = asDate(op.dateFrom); patch.plannedDateTo = asDate(op.dateTo); }
      if (w.plannedAreaHa == null && op.areaHa != null) patch.plannedAreaHa = op.areaHa;
      if (!w.method && op.method && op.type !== 'Saagikoristus') patch.method = op.method;
      if (!w.plannedWorkerId && op.performerId) patch.plannedWorkerId = op.performerId;
      if (!w.notes && op.notes) patch.notes = op.notes;
      if (Object.keys(patch).length) await tx.fieldWork.update({ where: { id: w.id }, data: patch });
      const have = new Set(w.lines.map((l) => `${l.kind}:${nameKey(l.label)}`));
      const add = lines.filter((l) => l.kind !== 'OBSERVATION' && !have.has(`${l.kind}:${nameKey(l.label)}`));
      for (const [i, l] of add.entries()) {
        await tx.fieldWorkLine.create({ data: { ...planLine(l, await materialFor(tx, l, materials), w.lines.length + i), fieldWorkId: w.id } });
      }
      complemented++;
      continue;
    }

    const area = op.areaHa ?? opts.fieldAreaHa;
    const planLines = [];
    const entryLines = [];
    for (const l of lines) {
      const materialId = await materialFor(tx, l, materials);
      if (l.kind !== 'OBSERVATION') planLines.push(planLine(l, materialId, planLines.length));
      const quantity = l.perHa ? totalFromRate(l.amount, area) : l.amount;
      entryLines.push({
        kind: l.kind, materialId, label: l.label, unit: l.unit, quantity: quantity ?? 0,
        ratePerHa: l.perHa ? l.amount : null,
        priaRegister: l.priaRegister, priaKind: l.priaKind, priaSpec: l.priaSpec, activeIngredient: l.activeIngredient,
        nKgHa: l.nKgHa, pKgHa: l.pKgHa, kKgHa: l.kKgHa,
        sortOrder: entryLines.length
      });
    }
    const method = op.type === 'Saagikoristus' ? null : op.method;
    const work = await tx.fieldWork.create({
      data: {
        fieldSeasonId, workTypeId: type.id, phase: type.phase, sortOrder: sortOrder++, plannedCount: 1, source: 'PRIA_IMPORT',
        plannedDateFrom: asDate(op.dateFrom), plannedDateTo: asDate(op.dateTo), plannedAreaHa: op.areaHa,
        method, plannedWorkerId: op.performerId, notes: op.notes,
        lines: { create: planLines },
        entries: {
          create: {
            date: asDate(op.dateFrom)!, dateTo: asDate(op.dateTo), areaHa: area, method, workerId: op.performerId,
            notes: op.notes, source: 'PRIA_IMPORT', createdById: opts.userId,
            lines: { create: entryLines }
          }
        }
      }
    });
    await syncFieldWorkStatus(work.id, true, opts.userId, tx);
    taken.add(work.id);
    created++;
  }
  return { created, complemented };
}
