// src/services/fieldBookWorkbook.ts
// SheetJS: e-PRIA põlluraamatu .xls → lehtede read → parsitud põllud.
import * as XLSX from 'xlsx';
import type { FieldBookSheetResult } from '../types/fieldOperation';
import { parseFieldBookSheet } from './fieldBookParser';

export function readFieldBookWorkbook(buffer: ArrayBuffer): { sheetName: string; rows: string[][] }[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false });
  return wb.SheetNames.map((sheetName) => {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: '',
      blankrows: true
    });
    return {
      sheetName,
      rows: aoa.map((row) => row.map((v) => (v === null || v === undefined ? '' : String(v))))
    };
  });
}

export function parseFieldBookFile(buffer: ArrayBuffer): FieldBookSheetResult[] {
  const sheets = readFieldBookWorkbook(buffer);
  const isFieldBook = sheets.some(
    (s) =>
      (s.rows[0] ?? []).some((v) => v.includes('Põlluraamatu väljavõte')) &&
      s.rows.some((row) => (row[0] ?? '').trim() === 'Tegevus')
  );
  if (!isFieldBook) throw new Error('See ei ole e-PRIA põlluraamatu väljavõte');

  return sheets.map((s) => {
    try {
      return { sheetName: s.sheetName, sheet: parseFieldBookSheet(s.sheetName, s.rows), error: null };
    } catch (err) {
      return { sheetName: s.sheetName, sheet: null, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
