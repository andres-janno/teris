// src/types/fieldOperation.ts
// e-PRIA põlluraamatu import ja põllutööde kuvamine.

export interface ParsedProduct {
  category: string | null;         // "Register/Materjal"
  name: string | null;             // toode, sort või umbrohi
  kind: string | null;             // "Liik/tüüp"
  spec: string | null;             // "Täpsustus" (nt seemne kategooria OTS)
  amount: number | null;
  unit: string | null;             // "kg/ha", "l/ha", "t/ha", "taime/m2", "g/ha"
  nKgHa: number | null;
  pKgHa: number | null;
  kKgHa: number | null;
  activeIngredient: string | null;
}

export interface ParsedOperation {
  type: string;                    // PRIA "Tegevus"
  dateFrom: string;                // "aaaa-kk-pp"
  dateTo: string | null;
  areaHa: number | null;
  method: string | null;
  performerName: string | null;
  notes: string | null;
  products: ParsedProduct[];
}

export interface ParsedFieldBookSheet {
  sheetName: string;
  season: number;
  fieldCode: string;
  num: string;
  areaHa: number | null;
  crop: string;
  targetYieldTonsHa: number | null;
  actualYieldTonsHa: number | null;
  seedingDate: string | null;
  harvestDate: string | null;
  operations: ParsedOperation[];
}

export interface FieldBookSheetResult {
  sheetName: string;
  sheet: ParsedFieldBookSheet | null;
  error: string | null;
}

export interface FieldBookImportOperation {
  type: string;
  dateFrom: string;
  dateTo: string | null;
  areaHa: number | null;
  method: string | null;
  performerId: string | null;
  notes: string | null;
  products: ParsedProduct[];
}

export interface FieldBookImportField {
  fieldCode: string;
  num: string;
  season: number;
  targetYieldTonsHa: number | null;
  actualYieldTonsHa: number | null;
  seedingDate: string | null;
  harvestDate: string | null;
  operations: FieldBookImportOperation[];
}

export interface FieldBookImportPayload {
  operatorId: string;
  fields: FieldBookImportField[];
}

export interface FieldBookImportResult {
  success: boolean;
  imported: number;
  created: number;      // uued tööd + kanded
  complemented: number; // olemasolevad tööd, mida täiendati (plaaniväljad, plaaniread või kanne)
  linked: number;       // olemasolevad tööd, mis sobisid, aga midagi ei muutunud
  entriesAdded: number; // kanneteta sobinud töödele lisatud kanded
  unknown: number;      // tundmatu tegevusega read — vahele jäetud
  skipped: { fieldCode: string; num: string; season: number; reason: string }[];
}

export interface FieldBookPreviewRow {
  sheetName: string;
  fieldCode: string | null;
  num: string | null;
  season: number | null;
  fieldName: string | null;       // registri nimi, kui sobitus
  matched: boolean;
  operationsCount: number;
  existingWorksCount: number; // Terises sel hooajal juba olevad tööd (import sobitab, ei kustuta)
  productsCount: number;
  unmatchedPerformers: string[];
  seasonLocked: boolean;
  error: string | null;
}
