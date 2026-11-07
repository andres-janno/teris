// src/server/fieldWorkRules.ts — põllutööde registri reeglid (andmebaasist sõltumatud, testitavad).
import { EMPTY_PRIA_ATTRS, type PriaAttrs } from '../services/pria.ts';

export type LineKind = 'LABOR' | 'MACHINE' | 'IMPLEMENT' | 'FUEL' | 'MATERIAL' | 'HARVEST' | 'OBSERVATION';
export type FinanceStatus = 'PENDING' | 'CONFIRMED' | 'CHANGED';

export interface LineDraft extends PriaAttrs {
  kind: LineKind;
  vehicleId: string | null;
  implementId: string | null;
  articleId: string | null;
  label: string;
  quantity: number;
  unit: string;
  sortOrder: number;
  ratePerHa: number | null; // kogus ha kohta (PRIA)
  unitPrice: number | null; // tööaja real pakutud teenuse hind; kütusel ja materjalil tuleb hind laost (FIFO)
  warehouseId?: string | null; // kulumaterjali rea ladu; tühi = kande ladu
}

export interface StoredLine extends LineDraft {
  confirmedQuantity: number | null;
}

/** Tööaja rea teenusartikkel ja pakutud hind (src/server/entryArticles.ts loadEntryArticles). */
export interface ServiceChoice {
  articleId: string;
  price: number | null;
}

export interface EntryQuantities {
  laborService?: ServiceChoice | null;
  machineService?: ServiceChoice | null;
  implementService?: ServiceChoice | null;
  fuelArticle?: { id: string; name: string } | null; // kande kütuseartikkel
  laborHours?: number | null;
  workerName?: string | null;
  vehicle?: { id: string; name: string } | null;
  implement?: { id: string; name: string } | null;
  equipmentHours?: number | null; // masina ja haakeriista töötunnid sisestatakse korraga
  fuelLiters?: number | null;
  articles?: { id: string; name: string; unit: string; quantity: number; ratePerHa?: number | null; pria?: Partial<PriaAttrs>; warehouseId?: string | null }[];
  harvestTonnes?: number | null; // lihtne saak (vana vorm)
  harvest?: { tonnes: number | null; ratePerHa: number | null; priaKind: string | null; priaSpec: string | null; withBunkers?: boolean } | null;
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

// Hooaja registri kultuur: seos (cropId), seose puudumisel nime järgi.
export function seasonRegistryCrop<T extends { id: string; name: string }>(season: { crop: string | null; cropId?: string | null }, crops: T[]): T | null {
  return (season.cropId ? crops.find((c) => c.id === season.cropId) : undefined) ?? matchCrop(season.crop, crops);
}

// Kas hooaja kultuur on talivili (registri seose järgi; registrist puuduval kultuuril nime järgi).
export function isWinterSeason(season: { crop: string | null; cropId?: string | null }, crops: { id: string; name: string; isWinterCrop?: boolean }[]): boolean {
  if (isUndeterminedCrop(season.crop)) return false;
  const reg = season.cropId ? crops.find((c) => c.id === season.cropId) : undefined;
  if (reg && typeof reg.isWinterCrop === 'boolean') return reg.isWinterCrop;
  return isWinterCrop(season.crop, crops);
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
  const push = (l: Omit<LineDraft, 'sortOrder' | 'vehicleId' | 'implementId' | 'articleId' | 'ratePerHa' | 'unitPrice' | keyof PriaAttrs> & Partial<LineDraft>) =>
    lines.push({ vehicleId: null, implementId: null, articleId: null, ratePerHa: null, unitPrice: null, ...EMPTY_PRIA_ATTRS, ...l, sortOrder: lines.length });
  const service = (s: ServiceChoice | null | undefined) => ({ articleId: s?.articleId ?? null, unitPrice: s?.price ?? null });

  if (positive(q.laborHours)) push({ kind: 'LABOR', label: q.workerName || 'Tööaeg', quantity: q.laborHours, unit: 'h', ...service(q.laborService) });
  if (positive(q.equipmentHours)) {
    if (q.vehicle) push({ kind: 'MACHINE', vehicleId: q.vehicle.id, label: q.vehicle.name, quantity: q.equipmentHours, unit: 'h', ...service(q.machineService) });
    if (q.implement) push({ kind: 'IMPLEMENT', implementId: q.implement.id, label: q.implement.name, quantity: q.equipmentHours, unit: 'h', ...service(q.implementService) });
  }
  if (positive(q.fuelLiters)) push({ kind: 'FUEL', articleId: q.fuelArticle?.id ?? null, label: q.fuelArticle?.name ?? 'Kütus', quantity: q.fuelLiters, unit: 'l' });
  for (const m of q.articles ?? []) {
    if (positive(m.quantity)) {
      push({ kind: 'MATERIAL', articleId: m.id, label: m.name, quantity: m.quantity, unit: m.unit, ratePerHa: m.ratePerHa ?? null, ...m.pria, warehouseId: m.warehouseId ?? null });
    }
  }
  // Saagi ja kultuuri tüüp salvestatakse ka siis, kui kogus pole veel teada (kogus 0)
  // Saagi ja kultuuri tüüp salvestatakse ka siis, kui kogus pole veel teada (kogus 0); partii kandel ka punkritega
  if (q.harvest && (positive(q.harvest.tonnes) || q.harvest.priaKind || q.harvest.priaSpec || q.harvest.withBunkers)) {
    push({ kind: 'HARVEST', label: 'Saak', quantity: positive(q.harvest.tonnes) ? q.harvest.tonnes! : 0, unit: 't', ratePerHa: q.harvest.ratePerHa, priaKind: q.harvest.priaKind, priaSpec: q.harvest.priaSpec });
  } else if (positive(q.harvestTonnes)) {
    push({ kind: 'HARVEST', label: 'Saak', quantity: q.harvestTonnes, unit: 't' });
  }
  // Seire leid salvestatakse ka koguseta (nt "Muu oluline sündmus")
  for (const o of q.observations ?? []) {
    if (o.label.trim()) push({ kind: 'OBSERVATION', label: o.label.trim(), quantity: o.quantity, unit: o.unit, priaRegister: o.priaRegister });
  }
  return lines;
}

// Materjalita read (vaatlused) eristatakse nime järgi; artikkel eristab ainult materjaliridu
// (tööaja teenuse või kütuseartikli vahetus ei kaota rea hinda ega kinnitust)
const lineKey = (l: Pick<LineDraft, 'kind' | 'vehicleId' | 'implementId' | 'articleId' | 'label'>) =>
  `${l.kind}:${l.vehicleId ?? ''}:${l.implementId ?? ''}:${l.kind === 'MATERIAL' ? l.articleId ?? '' : ''}:${l.kind === 'OBSERVATION' ? l.label : ''}`;

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
    // Teenuse- ja kütuserea artikkel jääb samaks (nagu hind); rida ilma artiklita saab uue
    const articleId = d.kind === 'MATERIAL' ? d.articleId : old?.articleId ?? d.articleId;
    return { ...d, articleId, unitPrice: old?.unitPrice ?? d.unitPrice, confirmedQuantity: old?.confirmedQuantity ?? null };
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

export const FUEL_ARTICLE_MISSING = 'Kütuse artikkel määramata';

/** Miks kannet ei saa kinnitada; null = saab kinnitada. */
export function confirmBlockReason(lines: { kind: LineKind; unitPrice: number | null; articleId: string | null }[]): string | null {
  if (lines.some((l) => l.kind === 'FUEL' && !l.articleId)) return FUEL_ARTICLE_MISSING;
  if (!canConfirm(lines)) return 'Igal real peab olema ühiku kulu. Materjali ja kütuse hind tuleb laost — hindamata kaup ootab arvele võtmist.';
  return null;
}

export interface FieldResult {
  labor: number;
  equipment: number; // masinad ja haakeriistad koos
  fuel: number;
  articles: number;
  costTotal: number;
  revenue: number;
  profit: number;
}

// Põllu tulemus kinnitatud kannete ridadest (kinnitamata kanded ei lähe summadesse).
export function summarizeLines(lines: Pick<StoredLine, 'kind' | 'quantity' | 'unitPrice'>[]): FieldResult {
  const r: FieldResult = { labor: 0, equipment: 0, fuel: 0, articles: 0, costTotal: 0, revenue: 0, profit: 0 };
  for (const l of lines) {
    const sum = l.quantity * (l.unitPrice ?? 0);
    if (l.kind === 'LABOR') r.labor += sum;
    else if (l.kind === 'MACHINE' || l.kind === 'IMPLEMENT') r.equipment += sum;
    else if (l.kind === 'FUEL') r.fuel += sum;
    else if (l.kind === 'MATERIAL') r.articles += sum;
    else if (l.kind === 'HARVEST') r.revenue += sum;
  }
  r.costTotal = r.labor + r.equipment + r.fuel + r.articles;
  r.profit = r.revenue - r.costTotal;
  return r;
}

export type WorkPhase = 'PREPARATION' | 'SOWING' | 'CARE' | 'HARVEST';
