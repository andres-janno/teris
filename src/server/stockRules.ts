// src/server/stockRules.ts — laokande sisendi valideerimine (puhas funktsioon)
export type StockDocumentKind = 'RECEIPT' | 'WRITE_OFF' | 'TRANSFER';
export type WriteOffReason = 'SPOILED' | 'INVENTORY' | 'OTHER';

export interface StockDocumentInput {
  kind: StockDocumentKind;
  date: Date;
  warehouseId: string;
  toWarehouseId: string | null;
  supplierId: string | null;
  documentNo: string | null;
  writeOffReason: WriteOffReason | null;
  notes: string | null;
  lines: { materialId: string; quantity: number; amount: number | null }[];
}

const KINDS: StockDocumentKind[] = ['RECEIPT', 'WRITE_OFF', 'TRANSFER'];
const REASONS: WriteOffReason[] = ['SPOILED', 'INVENTORY', 'OTHER'];
const text = (v: unknown, max = 500): string | null => {
  const s = String(v ?? '').trim().slice(0, max);
  return s || null;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const dateOnly = (v: unknown): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
};
const fail = (error: string) => ({ ok: false as const, error });

export function parseStockDocument(body: unknown): { ok: true; doc: StockDocumentInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, any>;
  const kind = KINDS.find((k) => k === b.kind);
  if (!kind) return fail('Vigane kande liik');
  const date = dateOnly(b.date);
  if (!date) return fail('Kuupäev on kohustuslik');
  const warehouseId = text(b.warehouseId, 64);
  if (!warehouseId) return fail('Vali ladu');
  const toWarehouseId = kind === 'TRANSFER' ? text(b.toWarehouseId, 64) : null;
  if (kind === 'TRANSFER' && !toWarehouseId) return fail('Vali sihtladu');
  if (kind === 'TRANSFER' && toWarehouseId === warehouseId) return fail('Lähte- ja sihtladu peavad erinema');
  const writeOffReason = kind === 'WRITE_OFF' ? REASONS.find((r) => r === b.writeOffReason) ?? null : null;
  if (kind === 'WRITE_OFF' && !writeOffReason) return fail('Vali mahakandmise põhjus');

  const linesIn: any[] = Array.isArray(b.lines) ? b.lines : [];
  if (!linesIn.length) return fail('Lisa vähemalt üks rida');
  const lines: StockDocumentInput['lines'] = [];
  for (const l of linesIn) {
    const materialId = text(l?.materialId, 64);
    if (!materialId) return fail('Vali igale reale materjal');
    const quantity = num(l?.quantity);
    if (quantity === null || quantity <= 0) return fail('Kogus peab olema suurem kui 0');
    let amount: number | null = null;
    if (kind === 'RECEIPT') {
      amount = num(l?.amount);
      if (amount === null) return fail('Arvele võtmisel on rea summa kohustuslik');
      if (amount < 0) return fail('Summa ei tohi olla negatiivne');
    }
    lines.push({ materialId, quantity, amount });
  }
  return {
    ok: true,
    doc: {
      kind, date, warehouseId, toWarehouseId,
      supplierId: kind === 'RECEIPT' ? text(b.supplierId, 64) : null,
      documentNo: text(b.documentNo, 80),
      writeOffReason,
      notes: text(b.notes, 2000),
      lines
    }
  };
}
