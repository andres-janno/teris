// src/types/fieldWork.ts — põllutööde register (PRIA põlluraamatust lahus)

export type WorkPhase = 'PREPARATION' | 'SOWING' | 'CARE' | 'HARVEST';
export type WorkRepeatMode = 'ONCE' | 'UP_TO' | 'INTERVAL';
export type FieldWorkStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE';
export type FinanceStatus = 'PENDING' | 'CONFIRMED' | 'CHANGED';
export type MaterialCategory = 'SEED' | 'FERTILIZER' | 'PLANT_PROTECTION' | 'OTHER';
export type WorkEntryLineKind = 'LABOR' | 'MACHINE' | 'IMPLEMENT' | 'FUEL' | 'MATERIAL' | 'HARVEST';

export const WORK_PHASES: WorkPhase[] = ['PREPARATION', 'SOWING', 'CARE', 'HARVEST'];

export const WORK_PHASE_META: Record<WorkPhase, { label: string; color: string; bg: string }> = {
  PREPARATION: { label: 'Ettevalmistus', color: '#1d4ed8', bg: '#e8efff' },
  SOWING: { label: 'Külv', color: '#15803d', bg: '#dcf5e4' },
  CARE: { label: 'Hooldamine', color: '#7c3aed', bg: '#efe8fe' },
  HARVEST: { label: 'Koristus', color: '#9a5b00', bg: '#fdf1d8' }
};

export const MATERIAL_CATEGORY_LABEL: Record<MaterialCategory, string> = {
  SEED: 'Seeme',
  FERTILIZER: 'Väetis',
  PLANT_PROTECTION: 'Taimekaitsevahend',
  OTHER: 'Muu'
};

export interface WorkType {
  id: string;
  name: string;
  phase: WorkPhase;
  repeatMode: WorkRepeatMode;
  maxRepeats: number | null;
  intervalDays: number | null;
  usesMaterials: boolean;
  sortOrder: number;
  isActive: boolean;
  templateCount?: number;
  fieldWorkCount?: number;
}

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  cropVarietyId: string | null;
  isActive: boolean;
  notes: string | null;
  usageCount?: number;
}

export interface WorkTemplateItem {
  id?: string;
  workTypeId: string;
  sortOrder: number;
  typicalTiming: string | null;
  plannedCount: number | null;
}

export interface WorkTemplate {
  id: string;
  name?: string;
  cropId: string | null; // null = üldmall (isWinter: false = suvivilja üldmall, true = talivilja üldmall)
  isWinter: boolean;
  items: WorkTemplateItem[];
}

export interface WorkEntryMaterial {
  materialId: string;
  name: string;
  unit: string;
  quantity: number;
}

export interface WorkEntryLine {
  id: string;
  kind: WorkEntryLineKind;
  label: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  confirmedQuantity: number | null;
}

export interface WorkEntry {
  id: string;
  fieldWorkId: string;
  date: string; // ISO YYYY-MM-DD
  workerId: string | null;
  workerName: string | null;
  areaHa: number | null;
  occurrenceNo: number | null;
  vehicleId: string | null;
  vehicleName: string | null;
  implementId: string | null;
  implementName: string | null;
  equipmentHours: number | null;
  fuelLiters: number | null;
  laborHours: number | null;
  materials: WorkEntryMaterial[];
  harvestTonnes: number | null;
  notes: string | null;
  financeStatus: FinanceStatus;
  // ainult finantsjuhile/adminile:
  financeNotes?: string | null;
  financeConfirmedAt?: string | null;
  lines?: WorkEntryLine[];
}

export interface FieldWork {
  id: string;
  fieldSeasonId: number;
  workTypeId: string;
  workTypeName: string;
  phase: WorkPhase;
  repeatMode: WorkRepeatMode;
  intervalDays: number | null;
  usesMaterials: boolean;
  sortOrder: number;
  plannedText: string | null;
  plannedCount: number;
  status: FieldWorkStatus;
  finishedAt: string | null;
  fromTemplate: boolean;
  notes: string | null;
  entries: WorkEntry[];
  carriedOverFromYear?: number | null;
  carriedOverToYear?: number | null;
  seasonYear?: number | null;
  isNextSeasonWinterSowing?: boolean;
}

// Kande sisestus (töötaja: ainult kogused)
export interface WorkEntryInput {
  fieldWorkId: string;
  date: string;
  workerId: string | null;
  areaHa: number | null;
  occurrenceNo: number | null;
  vehicleId: string | null;
  implementId: string | null;
  equipmentHours: number | null;
  fuelLiters: number | null;
  laborHours: number | null;
  materials: { materialId: string; quantity: number }[];
  harvestTonnes: number | null;
  notes: string | null;
  finish: boolean;
}

export interface FinanceEntry extends WorkEntry {
  workTypeName: string;
  fieldSeasonId: number;
  year: number;
  crop: string;
  fieldAreaHa: number;
  fieldNum: string | null;
  fieldName: string;
  lines: WorkEntryLine[];
}

export interface FieldResult {
  fieldSeasonId: number;
  fieldId: number;
  fieldNum: string | null;
  fieldName: string;
  crop: string;
  cropColor: string;
  areaHa: number;
  entriesTotal: number;
  entriesConfirmed: number;
  labor: number;
  equipment: number;
  fuel: number;
  materials: number;
  costTotal: number;
  revenue: number;
  profit: number;
}
