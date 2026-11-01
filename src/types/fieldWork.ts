// src/types/fieldWork.ts — põllutööde register (PRIA põlluraamatust lahus)
import type { ArticleGroup, ArticleSystemKind } from '../services/articleRules';

export type WorkPhase = 'PREPARATION' | 'SOWING' | 'CARE' | 'HARVEST';
export type WorkRepeatMode = 'ONCE' | 'UP_TO' | 'INTERVAL';
export type FieldWorkStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE';
export type FinanceStatus = 'PENDING' | 'CONFIRMED' | 'CHANGED';
export type PriaArticleKind = 'SEED' | 'FERTILIZER' | 'PLANT_PROTECTION' | 'OTHER';
export type WorkEntryLineKind = 'LABOR' | 'MACHINE' | 'IMPLEMENT' | 'FUEL' | 'MATERIAL' | 'HARVEST' | 'OBSERVATION';
export type WorkSource = 'MANUAL' | 'PRIA_IMPORT';

// PRIA e-põlluraamatu atribuudid materjali/saagi real
export interface PriaLineFields { ratePerHa: number | null; priaRegister: string | null; priaKind: string | null; priaSpec: string | null; activeIngredient: string | null; nKgHa: number | null; pKgHa: number | null; kKgHa: number | null }
// Töö plaani rida (plaanitud materjal või saak)
export interface FieldWorkPlanLine extends PriaLineFields { id?: string; kind: 'MATERIAL' | 'HARVEST'; articleId: string | null; label: string; unit: string }
export interface WorkEntryObservation { label: string; quantity: number; unit: string; priaRegister: string | null }
export interface WorkEntryHarvest { tonnes: number | null; ratePerHa: number | null; priaKind: string | null; priaSpec: string | null }

export const WORK_PHASES: WorkPhase[] = ['PREPARATION', 'SOWING', 'CARE', 'HARVEST'];

export const WORK_PHASE_META: Record<WorkPhase, { label: string; color: string; bg: string }> = {
  PREPARATION: { label: 'Ettevalmistus', color: '#1d4ed8', bg: '#e8efff' },
  SOWING: { label: 'Külv', color: '#15803d', bg: '#dcf5e4' },
  CARE: { label: 'Hooldamine', color: '#7c3aed', bg: '#efe8fe' },
  HARVEST: { label: 'Koristus', color: '#9a5b00', bg: '#fdf1d8' }
};

// Artikli liik
export interface ArticleCategory {
  id: string;
  name: string;
  group: ArticleGroup;
  systemKind: ArticleSystemKind | null;
  sortOrder: number;
  isActive: boolean;
  articleCount?: number;
}
export type ArticleCategoryRef = Pick<ArticleCategory, 'id' | 'name' | 'group' | 'systemKind'>;

export interface WorkType {
  id: string;
  name: string;
  shortName: string | null;
  phase: WorkPhase;
  repeatMode: WorkRepeatMode;
  maxRepeats: number | null;
  intervalDays: number | null;
  usesMaterials: boolean;
  sortOrder: number;
  isActive: boolean;
  priaCode: string | null;
  fieldWorkCount?: number;
}

export interface Article {
  id: string;
  name: string;
  categoryId: string;
  category: ArticleCategoryRef;
  unit: string;
  manufacturer: string | null; // tootja
  cropVarietyId: string | null;
  price?: number | null; // teenuse ühiku hind (ainult finantsõigusega)
  cropId?: string | null; // terade kultuur
  defaultWarehouseId?: string | null; // kauba vaikimisi ladu
  isActive: boolean;
  composition: string | null; // koostisosad
  // PRIA vaikeväärtused plaani/kande reale
  priaRegister?: string | null;
  priaKind?: string | null;
  priaSpec?: string | null; // seemne kategooria
  activeIngredient?: string | null;
  nPct?: number | null; // N, P, K sisaldus %
  pPct?: number | null;
  kPct?: number | null;
  aliases?: string[]; // asendatud materjalide nimed
  notes: string | null;
  usageCount?: number;
  plannedQty?: number | null; // hooaja planeeritud kogus (ainult ?year= päringul)
  usedQty?: number | null; // hooaja kasutatud kogus
  stockQty?: number; // laoseis laoühikus (valitud lao või kõigi ladude summa)
  unpricedQty?: number; // hindamata kogus (ootab arvele võtmist)
  stockIssueCount?: number; // kanderead, mida ei saa laoühikusse teisendada
  stockValue?: number; // laoväärtus € (ainult finantsõigusega)
  pricedQty?: number; // hinnatud partiide kogus, keskmise hinna jagaja (ainult finantsõigusega)
}

// Uue artikli vaikeväärtused
export const NEW_ARTICLE: Partial<Article> = { isActive: true }; // liik ja ühik valitakse alati ise

export interface WorkEntryArticle extends Partial<PriaLineFields> {
  articleId: string;
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
  dateTo: string | null;
  method: string | null;
  source: WorkSource;
  workerId: string | null;
  workerName: string | null;
  areaHa: number | null;
  telemetryAreaHa?: number | null;
  occurrenceNo: number | null;
  vehicleId: string | null;
  vehicleName: string | null;
  implementId: string | null;
  implementName: string | null;
  equipmentHours: number | null;
  fuelLiters: number | null;
  laborHours: number | null;
  startTime: string | null;
  endTime: string | null;
  articles: WorkEntryArticle[];
  harvestTonnes: number | null;
  harvestBunkers: number | null; // punkrite arv (PRIA-s pole)
  harvest: WorkEntryHarvest | null;
  observations: WorkEntryObservation[];
  notes: string | null;
  financeStatus: FinanceStatus;
  // ainult finantsjuhile/adminile:
  financeNotes?: string | null;
  financeConfirmedAt?: string | null;
  lines?: WorkEntryLine[];
  warehouseId?: string | null; // ladu, kust materjalid võetakse; tühi = põhiladu
}

export interface FieldWork {
  id: string;
  fieldSeasonId: number;
  workTypeId: string;
  workTypeName: string;
  priaName: string;
  priaCode: string | null;
  phase: WorkPhase;
  repeatMode: WorkRepeatMode;
  intervalDays: number | null;
  usesMaterials: boolean;
  sortOrder: number;
  plannedText: string | null;
  plannedCount: number;
  plannedDateFrom: string | null;
  plannedDateTo: string | null;
  plannedAreaHa: number | null;
  method: string | null;
  plannedWorkerId: string | null;
  plannedWorkerName: string | null;
  source: WorkSource;
  lines: FieldWorkPlanLine[];
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

// Töö plaani sisend (lisamine ja muutmine); `lines` asendab plaaniread tervikuna
export interface FieldWorkPlanInput {
  plannedText?: string | null; plannedDateFrom?: string | null; plannedDateTo?: string | null; plannedAreaHa?: number | null;
  method?: string | null; plannedWorkerId?: string | null; notes?: string | null; lines?: FieldWorkPlanLine[];
}

export interface TelemetrySuggestion {
  id: string;
  vehicleId: string | null;
  vehicleName: string | null;
  implementId: string | null;
  implementName: string | null;
  workerId: string | null;
  workerName: string | null;
  startTime: string; // süüde sisse (sõidu algus)
  endTime: string; // süüde välja (sõidu lõpp)
  fieldStartTime: string; // põllu piiridesse jõudmine
  fieldEndTime: string; // põllu piiridest lahkumine
  durationHours: number; // põllu piirides süüde sees oldud aeg
  workedAreaHa: number | null;
  pointCount: number;
  route?: TripRoute; // sõidu teekond (algus, läbitud kohad, lõpp)
}

// Telemeetria sõidu teekond (server: src/server/tripRoute.ts)
export interface TripPlaceRef {
  id: string; // põllu puhul põllu hooaja id
  kind: 'FIELD' | 'POI';
  label: string;
}
export interface TripStop {
  time: string; // ISO
  lat: number;
  lng: number;
  place: TripPlaceRef | null;
  near?: { id: string; kind: 'FIELD' | 'POI'; label: string; distanceM: number }; // lähim koht, kui place on null
}
export interface TripVisit {
  place: TripPlaceRef;
  arrive: string; // ISO
  leave: string; // ISO
}
export interface TripRoute {
  start: TripStop;
  end: TripStop;
  visits: TripVisit[];
}

// Kande sisestus (töötaja: ainult kogused)
export interface WorkEntryInput {
  fieldWorkId: string;
  date: string;
  dateTo?: string | null;
  method?: string | null;
  workerId: string | null;
  areaHa: number | null;
  telemetryAreaHa?: number | null;
  occurrenceNo?: number | null;
  vehicleId: string | null;
  implementId: string | null;
  equipmentHours: number | null;
  fuelLiters: number | null;
  laborHours: number | null;
  startTime?: string | null;
  endTime?: string | null;
  articles: { articleId: string; quantity: number; ratePerHa?: number | null; pria?: Partial<PriaLineFields> }[];
  harvestTonnes: number | null;
  harvestBunkers?: number | null;
  harvest?: WorkEntryHarvest | null;
  observations?: WorkEntryObservation[];
  notes: string | null;
  finish: boolean;
  warehouseId?: string | null; // ladu, kust materjalid võetakse; tühi = põhiladu
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
  articles: number;
  costTotal: number;
  revenue: number;
  profit: number;
}

export interface FieldSeasonWorks {
  fieldSeasonId: number | null;
  areaHa: number;
  targetYieldTonsHa: number | null;
  actualYieldTonsHa: number | null;
  works: FieldWork[];
}
