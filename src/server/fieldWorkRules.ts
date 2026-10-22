// src/server/fieldWorkRules.ts — põllutööde registri reeglid (andmebaasist sõltumatud, testitavad).
import { EMPTY_PRIA_ATTRS, type PriaAttrs } from '../services/pria.ts';

export type LineKind = 'LABOR' | 'MACHINE' | 'IMPLEMENT' | 'FUEL' | 'MATERIAL' | 'HARVEST' | 'OBSERVATION';
export type FinanceStatus = 'PENDING' | 'CONFIRMED' | 'CHANGED';

export interface LineDraft extends PriaAttrs {
  kind: LineKind;
  vehicleId: string | null;
  implementId: string | null;
  materialId: string | null;
  label: string;
  quantity: number;
  unit: string;
  sortOrder: number;
  ratePerHa: number | null; // kogus ha kohta (PRIA)
}

export interface StoredLine extends LineDraft {
  unitPrice: number | null;
  confirmedQuantity: number | null;
}

export interface EntryQuantities {
  laborHours?: number | null;
  workerName?: string | null;
  vehicle?: { id: string; name: string } | null;
  implement?: { id: string; name: string } | null;
  equipmentHours?: number | null; // masina ja haakeriista töötunnid sisestatakse korraga
  fuelLiters?: number | null;
  materials?: { id: string; name: string; unit: string; quantity: number; ratePerHa?: number | null; pria?: Partial<PriaAttrs> }[];
  harvestTonnes?: number | null; // lihtne saak (vana vorm)
  harvest?: { tonnes: number; ratePerHa: number | null; priaKind: string | null; priaSpec: string | null } | null;
  observations?: { label: string; quantity: number; unit: string; priaRegister: string | null }[];
}

const positive = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

// Tühi, "Määramata" või serveri vaikeväärtus "Teadmata kultuur" = kultuur valimata.
export function isUndeterminedCrop(crop: string | null | undefined): boolean {
  const c = (crop ?? '').trim().toLowerCase();
  return c === '' || c === 'määramata' || c === 'teadmata kultuur';
}

// PRIA kultuurinimi ("Talinisu allakülvita", "Muu põlduba") → kultuuride registri kirje.
// Pikemad nimed enne, et täpsem vaste võidaks.
export function matchCrop<T extends { id: string; name: string }>(cropText: string | null | undefined, crops: T[]): T | null {
  if (isUndeterminedCrop(cropText)) return null;
  const text = String(cropText).toLowerCase().trim();
  const sorted = [...crops].sort((a, b) => b.name.length - a.name.length);
  return (
    sorted.find((c) => {
      const name = c.name.toLowerCase();
      return name === text || text.includes(name) || name.startsWith(text);
    }) ?? null
  );
}

// Talivilja tuvastamine (nt "Talinisu allakülvita", "Taliraps", "Rukis" jne).
export function isWinterCrop(cropText: string | null | undefined, crops?: { name: string; isWinterCrop?: boolean }[]): boolean {
  if (isUndeterminedCrop(cropText)) return false;
  if (crops && crops.length > 0) {
    const matched = matchCrop(cropText, crops as any);
    if (matched && typeof (matched as any).isWinterCrop === 'boolean') {
      return (matched as any).isWinterCrop;
    }
  }
  const text = String(cropText).toLowerCase().trim();
  return text.startsWith('tali') || text.includes('talinisu') || text.includes('taliraps') || text.includes('talioder') || text.includes('rukis');
}

// Kande kogustest finantsread. Masin ja haakeriist saavad sama tundide arvu, aga eraldi read,
// sest neile pannakse erinev ühiku kulu.
export function buildEntryLines(q: EntryQuantities): LineDraft[] {
  const lines: LineDraft[] = [];
  const push = (l: Omit<LineDraft, 'sortOrder' | 'vehicleId' | 'implementId' | 'materialId' | 'ratePerHa' | keyof PriaAttrs> & Partial<LineDraft>) =>
    lines.push({ vehicleId: null, implementId: null, materialId: null, ratePerHa: null, ...EMPTY_PRIA_ATTRS, ...l, sortOrder: lines.length });

  if (positive(q.laborHours)) push({ kind: 'LABOR', label: q.workerName || 'Tööaeg', quantity: q.laborHours, unit: 'h' });
  if (positive(q.equipmentHours)) {
    if (q.vehicle) push({ kind: 'MACHINE', vehicleId: q.vehicle.id, label: q.vehicle.name, quantity: q.equipmentHours, unit: 'h' });
    if (q.implement) push({ kind: 'IMPLEMENT', implementId: q.implement.id, label: q.implement.name, quantity: q.equipmentHours, unit: 'h' });
  }
  if (positive(q.fuelLiters)) push({ kind: 'FUEL', label: 'Kütus', quantity: q.fuelLiters, unit: 'l' });
  for (const m of q.materials ?? []) {
    if (positive(m.quantity)) {
      push({ kind: 'MATERIAL', materialId: m.id, label: m.name, quantity: m.quantity, unit: m.unit, ratePerHa: m.ratePerHa ?? null, ...m.pria });
    }
  }
  if (q.harvest && positive(q.harvest.tonnes)) {
    push({ kind: 'HARVEST', label: 'Saak', quantity: q.harvest.tonnes, unit: 't', ratePerHa: q.harvest.ratePerHa, priaKind: q.harvest.priaKind, priaSpec: q.harvest.priaSpec });
  } else if (positive(q.harvestTonnes)) {
    push({ kind: 'HARVEST', label: 'Saak', quantity: q.harvestTonnes, unit: 't' });
  }
  // Seire leid salvestatakse ka koguseta (nt "Muu oluline sündmus")
  for (const o of q.observations ?? []) {
    if (o.label.trim()) push({ kind: 'OBSERVATION', label: o.label.trim(), quantity: o.quantity, unit: o.unit, priaRegister: o.priaRegister });
  }
  return lines;
}

// Materjalita read (vaatlused) eristatakse nime järgi
const lineKey = (l: Pick<LineDraft, 'kind' | 'vehicleId' | 'implementId' | 'materialId' | 'label'>) =>
  `${l.kind}:${l.vehicleId ?? ''}:${l.implementId ?? ''}:${l.materialId ?? ''}:${l.kind === 'OBSERVATION' ? l.label : ''}`;

// Kande muutmisel säilitatakse sama rea ühiku kulu. Kinnitatud kande koguse muutus → CHANGED
// (kinnita uuesti); confirmedQuantity jätab alles kinnitamise hetke koguse.
export function mergeLines(
  oldLines: StoredLine[],
  drafts: LineDraft[],
  status: FinanceStatus
): { lines: StoredLine[]; financeStatus: FinanceStatus } {
  const byKey = new Map(oldLines.map((l) => [lineKey(l), l]));
  const lines: StoredLine[] = drafts.map((d) => {
    const old = byKey.get(lineKey(d));
    return { ...d, unitPrice: old?.unitPrice ?? null, confirmedQuantity: old?.confirmedQuantity ?? null };
  });
  if (status === 'PENDING') return { lines, financeStatus: 'PENDING' };

  const priced = (l: { kind: LineKind }) => l.kind !== 'OBSERVATION';
  const newKeys = new Set(lines.map(lineKey));
  const changed =
    oldLines.filter(priced).some((l) => !newKeys.has(lineKey(l))) ||
    lines.filter(priced).some((l) => l.confirmedQuantity === null || l.confirmedQuantity !== l.quantity);
  return { lines, financeStatus: changed ? 'CHANGED' : status };
}

// Kinnitada saab, kui igal hinnastataval real on ühiku kulu (ka 0 on lubatud). Vaatlustel hinda pole.
export function canConfirm(lines: (Pick<StoredLine, 'unitPrice'> & { kind?: LineKind })[]): boolean {
  const priced = lines.filter((l) => l.kind !== 'OBSERVATION');
  return priced.length > 0 && priced.every((l) => l.unitPrice !== null && Number.isFinite(l.unitPrice));
}

export interface FieldResult {
  labor: number;
  equipment: number; // masinad ja haakeriistad koos
  fuel: number;
  materials: number;
  costTotal: number;
  revenue: number;
  profit: number;
}

// Põllu tulemus kinnitatud kannete ridadest (kinnitamata kanded ei lähe summadesse).
export function summarizeLines(lines: Pick<StoredLine, 'kind' | 'quantity' | 'unitPrice'>[]): FieldResult {
  const r: FieldResult = { labor: 0, equipment: 0, fuel: 0, materials: 0, costTotal: 0, revenue: 0, profit: 0 };
  for (const l of lines) {
    const sum = l.quantity * (l.unitPrice ?? 0);
    if (l.kind === 'LABOR') r.labor += sum;
    else if (l.kind === 'MACHINE' || l.kind === 'IMPLEMENT') r.equipment += sum;
    else if (l.kind === 'FUEL') r.fuel += sum;
    else if (l.kind === 'MATERIAL') r.materials += sum;
    else if (l.kind === 'HARVEST') r.revenue += sum;
  }
  r.costTotal = r.labor + r.equipment + r.fuel + r.materials;
  r.profit = r.revenue - r.costTotal;
  return r;
}

export type WorkPhase = 'PREPARATION' | 'SOWING' | 'CARE' | 'HARVEST';

// Jooksvas aastas: taliviljal ainult hooldus ja koristus (ettevalmistus ja külv olid sügisel);
// suviviljal kõik 4 faasi.
export function filterTemplatePhasesForCurrent(isWinter: boolean, phase: WorkPhase): boolean {
  if (isWinter) {
    return phase === 'CARE' || phase === 'HARVEST';
  }
  return true;
}

// Sügistöödes (jooksva aasta sügis järgmise aasta saagiks):
// taliviljal ettevalmistus ja külv; suviviljal ainult ettevalmistus (külv, hooldus ja koristus on kevadel).
export function filterTemplatePhasesForAutumn(nextIsWinter: boolean, phase: WorkPhase): boolean {
  if (nextIsWinter) {
    return phase === 'PREPARATION' || phase === 'SOWING';
  }
  return phase === 'PREPARATION';
}


// Malli rakendamine: iga malli rea kohta plannedCount (vaikimisi 1) tööd, millest on maha arvatud
// selle tüübi juba olemasolevad tööd hooaja põllul. Iga töö = üks kord.
export function templateWorksToCreate(items: { workTypeId: string; plannedCount: number | null }[], existingCounts: Map<string, number>): string[] {
  const left = new Map(existingCounts);
  const out: string[] = [];
  for (const it of items) {
    for (let i = 0; i < Math.max(1, it.plannedCount ?? 1); i++) {
      const have = left.get(it.workTypeId) ?? 0;
      if (have > 0) left.set(it.workTypeId, have - 1);
      else out.push(it.workTypeId);
    }
  }
  return out;
}
