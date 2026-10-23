// src/server/fieldBookRules.ts — PRIA põlluraamatu rea sidumine Terise tööga ja rea tooted → read.
// Puhtad funktsioonid (andmebaasita), kasutab fieldBookImport.ts.
import type { FieldBookImportOperation } from '../types/fieldOperation.ts';
import type { MaterialCategory, WorkPhase } from '../types/fieldWork.ts';
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
  fromTemplate: boolean; // töö tuli kultuuri mallist (sageli ainult plannedText, kuupäevata)
}

export function findMatchingWork(
  op: { type: string; dateFrom: string; dateTo: string | null; products: { name: string | null }[] },
  works: ExistingWork[],
  taken: Set<string>
): ExistingWork | null {
  const range = { from: op.dateFrom, to: op.dateTo };
  const opKeys = new Set(op.products.map((p) => nameKey(p.name)).filter(Boolean));
  let best: { work: ExistingWork; gap: number } | null = null;
  let undated: ExistingWork | null = null;
  for (const w of works) {
    if (w.activity !== op.type || taken.has(w.id)) continue;
    // Ühine toode nõutakse ainult siis, kui nii real kui tööl on tooted
    // (nimetatud toodeteta reas otsustavad tegevus ja kuupäev — muidu tekiks korduval impordil duplikaat)
    if (PRODUCT_MATCH_ACTIVITIES.has(op.type) && opKeys.size > 0 && w.productKeys.length > 0 && !w.productKeys.some((k) => opKeys.has(k))) continue;
    const ranges = [...(w.plannedFrom ? [{ from: w.plannedFrom, to: w.plannedTo }] : []), ...w.entries];
    if (!ranges.length) {
      // Kuupäevata ja kanneteta töö (nt mallist) — varuvariant; mallist töö eelistatakse, muidu järjekorras esimene
      if (!undated || (w.fromTemplate && !undated.fromTemplate)) undated = w;
      continue;
    }
    const gap = Math.min(...ranges.map((r) => daysApart(range, r)));
    if (gap <= MATCH_TOLERANCE_DAYS && (!best || gap < best.gap)) best = { work: w, gap };
  }
  return best?.work ?? undated;
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

// PRIA: aastal Y tehtud tööd, mis puudutavad järgmise aasta saaki, kuuluvad hooajale Y+1.
// Külvi liik sobib järgmise hooaja kultuuriga, kui kultuuri nimi sisaldab liiki või liik kultuuri esimest sõna
// ("Talioder" ~ "Talioder allakülvita"). Liigita külv loetakse sobivaks.
export function sowingKindMatchesCrop(kind: string | null, crop: string): boolean {
  const k = nameKey(kind);
  if (!k) return true;
  const c = nameKey(crop);
  const first = c.split(' ')[0];
  return c.includes(k) || (!!first && k.includes(first));
}

// Viimase saagikoristuse järel tehtud tööd (v.a koristus) → järgmine hooaeg; vahekultuuri külv (liik ei sobi
// järgmise kultuuriga) jääb. Faas: külv → SOWING; kuni sügiskülvi päevani (k.a) PREPARATION, hiljem CARE.
export function splitPostHarvestOperations(
  ops: FieldBookImportOperation[],
  nextCrop: string | null
): { current: FieldBookImportOperation[]; next: (FieldBookImportOperation & { phase: WorkPhase })[] } {
  const harvests = ops.filter((o) => o.type === PRIA_ACTIVITY.HARVEST).map((o) => o.dateFrom);
  if (nextCrop == null || !harvests.length) return { current: ops, next: [] };
  const harvestDate = harvests.reduce((a, b) => (b > a ? b : a));
  const moves = (o: FieldBookImportOperation) => {
    if (o.type === PRIA_ACTIVITY.HARVEST || !(o.dateFrom > harvestDate)) return false;
    if (o.type !== PRIA_ACTIVITY.SOWING) return true;
    const kinds = o.products.map((p) => p.kind).filter((k): k is string => !!nameKey(k));
    return !kinds.length || kinds.some((k) => sowingKindMatchesCrop(k, nextCrop));
  };
  const current: FieldBookImportOperation[] = [];
  const moved: FieldBookImportOperation[] = [];
  for (const o of ops) (moves(o) ? moved : current).push(o);
  const sowings = moved.filter((o) => o.type === PRIA_ACTIVITY.SOWING).map((o) => o.dateFrom);
  const firstSowing = sowings.length ? sowings.reduce((a, b) => (b < a ? b : a)) : null;
  const next = moved.map((o) => ({
    ...o,
    phase: (o.type === PRIA_ACTIVITY.SOWING ? 'SOWING' : firstSowing && o.dateFrom > firstSowing ? 'CARE' : 'PREPARATION') as WorkPhase
  }));
  return { current, next };
}
