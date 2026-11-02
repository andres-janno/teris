// src/server/stockRules.ts — laokande sisendi valideerimine (puhas funktsioon)
export type StockDocumentKind = 'RECEIPT' | 'WRITE_OFF' | 'TRANSFER' | 'INVENTORY';
export type WriteOffReason = 'SPOILED' | 'INVENTORY' | 'SOLD' | 'OTHER';

export interface StockDocumentInput {
  kind: StockDocumentKind;
  date: Date;
  warehouseId: string;
  toWarehouseId: string | null;
  supplierId: string | null;
  documentNo: string | null;
  writeOffReason: WriteOffReason | null;
  notes: string | null;
  lines: { articleId: string; quantity: number; amount: number | null; countedQty?: number | null }[];
}

const KINDS: StockDocumentKind[] = ['RECEIPT', 'WRITE_OFF', 'TRANSFER', 'INVENTORY'];
const REASONS: WriteOffReason[] = ['SPOILED', 'INVENTORY', 'SOLD', 'OTHER'];
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
  if (kind === 'INVENTORY') {
    // Inventuur: tühi tegelik seis = rida ei salvestata; 0 = kogu seis maha
    const counted: StockDocumentInput['lines'] = [];
    for (const l of linesIn) {
      const raw = String(l?.countedQty ?? '').trim();
      if (!raw) continue;
      const articleId = text(l?.articleId, 64);
      if (!articleId) return fail('Vali igale reale materjal');
      const countedQty = num(raw);
      if (countedQty === null) return fail('Tegelik seis peab olema arv');
      if (countedQty < 0) return fail('Tegelik seis ei tohi olla negatiivne');
      if (counted.some((c) => c.articleId === articleId)) return fail('Artikkel on inventuuris mitu korda');
      counted.push({ articleId, quantity: 0, amount: null, countedQty });
    }
    if (!counted.length) return fail('Sisesta vähemalt ühe artikli tegelik seis');
    return {
      ok: true,
      doc: { kind, date, warehouseId, toWarehouseId: null, supplierId: null, documentNo: text(b.documentNo, 80), writeOffReason: null, notes: text(b.notes, 2000), lines: counted }
    };
  }
  const lines: StockDocumentInput['lines'] = [];
  for (const l of linesIn) {
    const articleId = text(l?.articleId, 64);
    if (!articleId) return fail('Vali igale reale materjal');
    const quantity = num(l?.quantity);
    if (quantity === null || quantity <= 0) return fail('Kogus peab olema suurem kui 0');
    let amount: number | null = null;
    if (kind === 'RECEIPT') {
      amount = num(l?.amount);
      if (amount === null) return fail('Arvele võtmisel on rea summa kohustuslik');
      if (amount < 0) return fail('Summa ei tohi olla negatiivne');
    }
    lines.push({ articleId, quantity, amount });
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

// --- Õigused (laoseisu kogust näevad kõik; raha ning ladude ja laokannete muutmine finantsjuhile ja adminile) ---

/** Kas päring nõuab finantsõigust: laokanded ja ladude muutmine. Ladude loend, laoseis ja laokaart on kõigile. */
export function stockRequiresFinance(pathname: string, method: string): boolean {
  if (pathname === '/api/stock/documents' || pathname.startsWith('/api/stock/documents/') || pathname === '/api/stock/inventory-preview') return true;
  if ((pathname === '/api/warehouses' || pathname.startsWith('/api/warehouses/')) && method !== 'GET') return true;
  return false;
}

/** Laokaardi rea rahaga seotud väljad: maksumus, tarnija ja dokumendi nr ainult finantsõigusega. */
export function stockCardFinanceFields<T extends { cost: number | null; supplierName?: string | null; documentNo?: string | null }>(
  finance: boolean,
  fields: T
): T | Record<string, never> {
  return finance ? fields : {};
}

/** Materjali laoseisu väljad: kogus kõigile, väärtus ja hinnatud kogus ainult finantsõigusega. */
export function articleStockFields(
  finance: boolean,
  s: { qty: number; value: number; unpricedQty: number; pricedQty: number } | undefined
) {
  return {
    stockQty: s?.qty ?? 0,
    unpricedQty: s?.unpricedQty ?? 0,
    ...(finance ? { stockValue: s?.value ?? 0, pricedQty: s?.pricedQty ?? 0 } : {})
  };
}

const fmtIsoDay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('.');

/** Hoiatus, kui salvestatud liikumine jääb inventuuri(de) ette samas laos; null = hoiatust pole. */
export function inventoryNoticeText(isoDates: string[]): string | null {
  const dates = [...new Set(isoDates.map((d) => d.slice(0, 10)))].sort();
  return dates.length ? `See kanne muudab inventuuri ${dates.map(fmtIsoDay).join(', ')} vahet` : null;
}
