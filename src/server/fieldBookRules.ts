// src/server/fieldBookRules.ts — PRIA põlluraamatu rea sidumine Terise tööga ja rea tooted → read.
// Puhtad funktsioonid (andmebaasita), kasutab fieldBookImport.ts.
import type { FieldBookImportOperation } from '../types/fieldOperation';
import type { MaterialCategory } from '../types/fieldWork';
import { PRIA_ACTIVITY, baseUnit, daysApart, materialCategoryFor, nameKey, type PriaAttrs } from '../services/pria.ts';

export const MATCH_TOLERANCE_DAYS = 2;

// Tegevused, kus sama päeva lähedal võib olla mitu eri tööd — siis peab ühtima ka toode
const PRODUCT_MATCH_ACTIVITIES = new Set<string>([PRIA_ACTIVITY.PLANT_PROTECTION, PRIA_ACTIVITY.FERTILIZING]);

export interface ExistingWork {
  id: string;
  activity: string; // töötüübi priaCode
  plannedFrom: string | null;
  plannedTo: string | null;
  entries: { from: string; to: string | null }[];
  productKeys: string[]; // plaani- ja kanderidade materjalide nameKey
}

export function findMatchingWork(
  op: { type: string; dateFrom: string; dateTo: string | null; products: { name: string | null }[] },
  works: ExistingWork[],
  taken: Set<string>
): ExistingWork | null {
  const range = { from: op.dateFrom, to: op.dateTo };
  const opKeys = new Set(op.products.map((p) => nameKey(p.name)).filter(Boolean));
  let best: { work: ExistingWork; gap: number } | null = null;
  for (const w of works) {
    if (w.activity !== op.type || taken.has(w.id)) continue;
    if (PRODUCT_MATCH_ACTIVITIES.has(op.type) && !w.productKeys.some((k) => opKeys.has(k))) continue;
    const ranges = [...(w.plannedFrom ? [{ from: w.plannedFrom, to: w.plannedTo }] : []), ...w.entries];
    if (!ranges.length) continue;
    const gap = Math.min(...ranges.map((r) => daysApart(range, r)));
    if (gap <= MATCH_TOLERANCE_DAYS && (!best || gap < best.gap)) best = { work: w, gap };
  }
  return best?.work ?? null;
}

export interface OperationLine extends PriaAttrs {
  kind: 'MATERIAL' | 'HARVEST' | 'OBSERVATION';
  label: string;
  amount: number | null;
  unit: string;
  perHa: boolean; // kogus on hektari kohta (MATERIAL, HARVEST)
  materialCategory: MaterialCategory | null;
}

export function operationLines(op: FieldBookImportOperation): OperationLine[] {
  const out: OperationLine[] = [];
  for (const p of op.products) {
    const unit = p.unit ?? '';
    const common = {
      priaRegister: p.category, priaKind: p.kind, priaSpec: p.spec, activeIngredient: p.activeIngredient,
      nKgHa: p.nKgHa, pKgHa: p.pKgHa, kKgHa: p.kKgHa
    };
    if (op.type === PRIA_ACTIVITY.HARVEST) {
      out.push({ ...common, kind: 'HARVEST', label: 'Saak', amount: p.amount, unit: baseUnit(unit) || 't', perHa: unit.endsWith('/ha'), priaSpec: op.method, materialCategory: null });
    } else if (op.type === PRIA_ACTIVITY.MONITORING) {
      if (p.name) out.push({ ...common, kind: 'OBSERVATION', label: p.name, amount: p.amount, unit, perHa: false, materialCategory: null });
    } else if (p.name) {
      out.push({ ...common, kind: 'MATERIAL', label: p.name, amount: p.amount, unit: baseUnit(unit), perHa: unit.endsWith('/ha'), materialCategory: materialCategoryFor(op.type, p.category) });
    }
  }
  return out;
}
