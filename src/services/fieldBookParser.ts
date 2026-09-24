// src/services/fieldBookParser.ts
// e-PRIA "Põlluraamatu väljavõte" lehe tõlgendamine. Puhtad funktsioonid —
// SheetJS-i siin ei kasutata (vt fieldBookWorkbook.ts), et loogika oleks testitav.
import type { ParsedFieldBookSheet, ParsedOperation, ParsedProduct } from '../types/fieldOperation';

const COLS = 13;
const PRODUCT_COLS = [4, 5, 6, 7, 8, 9, 10, 11];

export function parseDecimal(raw: string): number | null {
  const t = raw.replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseDate(raw: string): string {
  const m = raw.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) throw new Error(`Loetamatu kuupäev: "${raw}"`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function parseDateRange(raw: string): { dateFrom: string; dateTo: string | null } {
  const parts = raw.split(' - ').map((p) => p.trim());
  if (parts.length === 2) return { dateFrom: parseDate(parts[0]), dateTo: parseDate(parts[1]) };
  return { dateFrom: parseDate(raw), dateTo: null };
}

export function parseAmount(raw: string): { amount: number | null; unit: string | null } {
  const t = raw.trim();
  if (!t) return { amount: null, unit: null };
  const m = t.match(/^([\d\s]+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { amount: null, unit: t };
  return { amount: parseDecimal(m[1]), unit: m[2].trim() || null };
}

export function parseFieldBookSheet(sheetName: string, rows: string[][]): ParsedFieldBookSheet {
  const cell = (r: number, c: number) => (rows[r]?.[c] ?? '').trim();
  const find = (label: string) => rows.findIndex((row) => (row[0] ?? '').trim() === label);
  const header = (label: string) => {
    const i = find(label);
    return i >= 0 ? cell(i, 1) : '';
  };

  const season = parseInt(header('Hooaeg'), 10);
  if (Number.isNaN(season)) throw new Error('Hooaeg puudub');
  const fieldCode = header('Põllumassiivi number');
  if (!fieldCode) throw new Error('Põllumassiivi number puudub');

  const opIdx = find('Tegevus');
  if (opIdx < 0) throw new Error('Tegevuste tabel puudub');
  const cropIdx = find('Kultuuri tüüp');

  let targetYieldTonsHa: number | null = null;
  let actualYieldTonsHa: number | null = null;
  if (cropIdx >= 0) {
    for (let i = cropIdx + 1; i < opIdx; i++) {
      if (!cell(i, 0)) continue;
      const target = parseDecimal(cell(i, 3));
      const actual = parseDecimal(cell(i, 4));
      if (target !== null || actual !== null) {
        targetYieldTonsHa = target;
        actualYieldTonsHa = actual;
        break;
      }
    }
  }

  const operations: ParsedOperation[] = [];
  let current: ParsedOperation | null = null;

  for (let i = opIdx + 1; i < rows.length; i++) {
    const c = Array.from({ length: COLS }, (_, j) => cell(i, j));
    if (c[0].startsWith('Trükitud') || c[0].startsWith('Koostaja')) continue;
    if (c[8] === 'NPK Kokku') continue;
    if (c.every((v) => !v)) continue;

    if (c[0]) {
      current = {
        type: c[0],
        ...parseDateRange(c[1]),
        areaHa: parseDecimal(c[2]),
        method: null,
        performerName: null,
        notes: null,
        products: []
      };
      operations.push(current);
    }
    if (!current) continue;

    let activeIngredient: string | null = null;
    const other = c[3];
    if (other.startsWith('Teostaja:')) {
      current.performerName ??= other.slice('Teostaja:'.length).trim() || null;
    } else if (other.startsWith('Toimeaine:')) {
      activeIngredient = other.slice('Toimeaine:'.length).trim() || null;
    } else if (other) {
      current.method ??= other.replace(/;\s*$/, '').trim() || null;
    }

    if (c[12]) current.notes ??= c[12];

    if (PRODUCT_COLS.some((j) => c[j])) {
      const { amount, unit } = parseAmount(c[8]);
      const product: ParsedProduct = {
        category: c[4] || null,
        name: c[5] || null,
        kind: c[6] || null,
        spec: c[7] || null,
        amount,
        unit,
        nKgHa: parseDecimal(c[9]),
        pKgHa: parseDecimal(c[10]),
        kKgHa: parseDecimal(c[11]),
        activeIngredient
      };
      current.products.push(product);
    }
  }

  const crop = header('Põllumajanduskultuur');
  const cropLower = crop.toLowerCase();
  const harvest = operations.find((o) => o.type === 'Saagikoristus' && o.method === 'Põhikultuur');
  const harvestDate = harvest ? harvest.dateTo ?? harvest.dateFrom : null;
  const sowings = operations
    .filter((o) => o.type === 'Külvamine/istutamine')
    .filter((o) => o.products.some((p) => p.kind && cropLower.includes(p.kind.toLowerCase())))
    .filter((o) => !harvest || o.dateFrom <= harvest.dateFrom)
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));

  return {
    sheetName,
    season,
    fieldCode,
    num: header('Põllu number') || sheetName,
    areaHa: parseDecimal(header('Põllu pindala (ha)')),
    crop,
    targetYieldTonsHa,
    actualYieldTonsHa,
    seedingDate: sowings[0]?.dateFrom ?? null,
    harvestDate,
    operations
  };
}
