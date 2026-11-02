import { describe, expect, it } from 'vitest';
import { parseStockDocument, stockRequiresFinance, inventoryNoticeText, stockCardFinanceFields, articleStockFields } from './stockRules';

const base = { date: '2026-05-01', warehouseId: 'w1', lines: [{ articleId: 'm1', quantity: '10', amount: '25,50' }] };

describe('parseStockDocument', () => {
  it('arvele võtmine: summa nõutud, koma lubatud, põhjus ja sihtladu nullitakse', () => {
    const r = parseStockDocument({ ...base, kind: 'RECEIPT', supplierId: 's1', writeOffReason: 'SPOILED', toWarehouseId: 'w2' });
    expect(r).toEqual({ ok: true, doc: expect.objectContaining({ kind: 'RECEIPT', supplierId: 's1', writeOffReason: null, toWarehouseId: null, lines: [{ articleId: 'm1', quantity: 10, amount: 25.5 }] }) });
    expect(parseStockDocument({ ...base, kind: 'RECEIPT', lines: [{ articleId: 'm1', quantity: 1 }] })).toEqual({ ok: false, error: 'Arvele võtmisel on rea summa kohustuslik' });
    expect(parseStockDocument({ ...base, kind: 'RECEIPT', lines: [{ articleId: 'm1', quantity: 1, amount: -1 }] })).toEqual({ ok: false, error: 'Summa ei tohi olla negatiivne' });
  });
  it('mahakandmine: põhjus nõutud, summa ja tarnija nullitakse', () => {
    expect(parseStockDocument({ ...base, kind: 'WRITE_OFF' })).toEqual({ ok: false, error: 'Vali mahakandmise põhjus' });
    const r = parseStockDocument({ ...base, kind: 'WRITE_OFF', writeOffReason: 'INVENTORY', supplierId: 's1' });
    expect(r).toEqual({ ok: true, doc: expect.objectContaining({ writeOffReason: 'INVENTORY', supplierId: null, lines: [{ articleId: 'm1', quantity: 10, amount: null }] }) });
  });
  it('ülekanne: sihtladu nõutud ja erinev', () => {
    expect(parseStockDocument({ ...base, kind: 'TRANSFER' })).toEqual({ ok: false, error: 'Vali sihtladu' });
    expect(parseStockDocument({ ...base, kind: 'TRANSFER', toWarehouseId: 'w1' })).toEqual({ ok: false, error: 'Lähte- ja sihtladu peavad erinema' });
    expect(parseStockDocument({ ...base, kind: 'TRANSFER', toWarehouseId: 'w2' })).toMatchObject({ ok: true });
  });
  it('üldised vead', () => {
    expect(parseStockDocument({ ...base, kind: 'X' })).toEqual({ ok: false, error: 'Vigane kande liik' });
    expect(parseStockDocument({ ...base, kind: 'RECEIPT', date: '' })).toEqual({ ok: false, error: 'Kuupäev on kohustuslik' });
    expect(parseStockDocument({ ...base, kind: 'RECEIPT', warehouseId: '' })).toEqual({ ok: false, error: 'Vali ladu' });
    expect(parseStockDocument({ ...base, kind: 'RECEIPT', lines: [] })).toEqual({ ok: false, error: 'Lisa vähemalt üks rida' });
    expect(parseStockDocument({ ...base, kind: 'WRITE_OFF', writeOffReason: 'OTHER', lines: [{ articleId: 'm1', quantity: 0 }] })).toEqual({ ok: false, error: 'Kogus peab olema suurem kui 0' });
    expect(parseStockDocument({ ...base, kind: 'WRITE_OFF', writeOffReason: 'OTHER', lines: [{ articleId: '', quantity: 1 }] })).toEqual({ ok: false, error: 'Vali igale reale materjal' });
  });
});

describe('stockRequiresFinance', () => {
  it('laokanded ja ladude muutmine nõuavad finantsõigust', () => {
    expect(stockRequiresFinance('/api/stock/documents', 'GET')).toBe(true);
    expect(stockRequiresFinance('/api/stock/inventory-preview', 'GET')).toBe(true);
    expect(stockRequiresFinance('/api/stock/documents', 'POST')).toBe(true);
    expect(stockRequiresFinance('/api/stock/documents/abc', 'GET')).toBe(true);
    expect(stockRequiresFinance('/api/stock/documents/abc', 'PUT')).toBe(true);
    expect(stockRequiresFinance('/api/stock/documents/abc', 'DELETE')).toBe(true);
    expect(stockRequiresFinance('/api/warehouses', 'POST')).toBe(true);
    expect(stockRequiresFinance('/api/warehouses/abc', 'DELETE')).toBe(true);
  });
  it('ladude loend, laoseis ja laokaart on kõigile', () => {
    expect(stockRequiresFinance('/api/warehouses', 'GET')).toBe(false);
    expect(stockRequiresFinance('/api/stock/levels', 'GET')).toBe(false);
    expect(stockRequiresFinance('/api/stock/articles/m1/movements', 'GET')).toBe(false);
  });
});

describe('stockCardFinanceFields', () => {
  const f = { cost: 12.5, supplierName: 'Tarnija OÜ', documentNo: 'A-1' };
  it('finantsõigusega maksumus, tarnija ja dokumendi nr', () => {
    expect(stockCardFinanceFields(true, f)).toEqual(f);
  });
  it('ilma finantsõiguseta mitte midagi', () => {
    expect(stockCardFinanceFields(false, f)).toEqual({});
  });
});

describe('articleStockFields', () => {
  const s = { qty: 10, value: 30, unpricedQty: 4, pricedQty: 6 };
  it('kogus kõigile, väärtus ja hinnatud kogus ainult finantsile', () => {
    expect(articleStockFields(false, s)).toEqual({ stockQty: 10, unpricedQty: 4 });
    expect(articleStockFields(true, s)).toEqual({ stockQty: 10, unpricedQty: 4, stockValue: 30, pricedQty: 6 });
  });
  it('laoseisuta materjal annab nullid', () => {
    expect(articleStockFields(true, undefined)).toEqual({ stockQty: 0, unpricedQty: 0, stockValue: 0, pricedQty: 0 });
  });
});

describe('inventuuri sisend', () => {
  const inv = { kind: 'INVENTORY', date: '2026-05-31', warehouseId: 'w1' };
  it('tühi tegelik seis jäetakse välja, 0 jääb alles', () => {
    const r = parseStockDocument({ ...inv, supplierId: 's1', writeOffReason: 'SPOILED', toWarehouseId: 'w2', lines: [
      { articleId: 'a1', countedQty: '' }, { articleId: 'a2', countedQty: '0' }, { articleId: 'a3', countedQty: '12,5' }
    ] });
    expect(r).toEqual({ ok: true, doc: expect.objectContaining({
      kind: 'INVENTORY', supplierId: null, writeOffReason: null, toWarehouseId: null,
      lines: [{ articleId: 'a2', quantity: 0, amount: null, countedQty: 0 }, { articleId: 'a3', quantity: 0, amount: null, countedQty: 12.5 }]
    }) });
  });
  it('vead', () => {
    expect(parseStockDocument({ ...inv, lines: [{ articleId: 'a1', countedQty: '' }] })).toEqual({ ok: false, error: 'Sisesta vähemalt ühe artikli tegelik seis' });
    expect(parseStockDocument({ ...inv, lines: [{ articleId: 'a1', countedQty: '-1' }] })).toEqual({ ok: false, error: 'Tegelik seis ei tohi olla negatiivne' });
    expect(parseStockDocument({ ...inv, lines: [{ articleId: 'a1', countedQty: 'x' }] })).toEqual({ ok: false, error: 'Tegelik seis peab olema arv' });
    expect(parseStockDocument({ ...inv, lines: [{ articleId: 'a1', countedQty: 1 }, { articleId: 'a1', countedQty: 2 }] })).toEqual({ ok: false, error: 'Artikkel on inventuuris mitu korda' });
  });
});

describe('inventoryNoticeText', () => {
  it('kuupäevad kasvavalt ja kordumatult', () => {
    expect(inventoryNoticeText([])).toBeNull();
    expect(inventoryNoticeText(['2026-05-31', '2026-03-31', '2026-05-31'])).toBe('See kanne muudab inventuuri 31.03.2026, 31.05.2026 vahet');
  });
});
