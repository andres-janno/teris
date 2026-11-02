// Inventuur ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { getDefaultWarehouseId, saveStockDocument, inventoryNotice } from './stock';
import { changeArticleUnit } from './articleUnitChange';
import { systemCategoryId } from './articleCategories';
import { StockValidationError } from './stock';
import type { StockDocumentInput } from './stockRules';

const T = `test-tenant-inventory-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(`${s}T00:00:00Z`);
let articleId = '';
let wh = '';
const doc = (p: Partial<StockDocumentInput>): StockDocumentInput => ({
  kind: 'RECEIPT', date: d('2026-03-01'), warehouseId: wh, toWarehouseId: null, supplierId: null,
  documentNo: null, writeOffReason: null, notes: null, lines: [], ...p
});
const save = (p: Partial<StockDocumentInput>) => run(() => tenantTransaction((tx) => saveStockDocument(tx, null, doc(p))));
const lineOf = (documentId: string) => run(() => prisma.stockDocumentLine.findFirstOrThrow({ where: { documentId } }));
const stock = () => run(() => prisma.articleStock.findUniqueOrThrow({ where: { articleId_warehouseId: { articleId, warehouseId: wh } } }));

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test inventuur' } });
  await run(async () => {
    const catId = await tenantTransaction((tx) => systemCategoryId(tx, 'FERTILIZER'));
    articleId = (await prisma.article.create({ data: { name: 'Inventuuriväetis', categoryId: catId, unit: 'kg' } })).id;
    wh = await tenantTransaction((tx) => getDefaultWarehouseId(tx));
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.stockDocument.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

describe('inventuur', () => {
  let invId = '';
  it('puudujääk kantakse maha FIFO maksumusega', async () => {
    await save({ lines: [{ articleId, quantity: 100, amount: 200 }] }); // 2 €/kg
    invId = await save({ kind: 'INVENTORY', date: d('2026-03-31'), lines: [{ articleId, quantity: 0, amount: null, countedQty: 90 }] });
    const l = await lineOf(invId);
    expect(l.countedQty).toBe(90);
    expect(l.diffQty).toBe(-10);
    expect(l.quantity).toBe(10);
    expect(Number(l.fifoCost)).toBe(20);
    expect(l.amount).toBeNull();
    const s = await stock();
    expect(s.qty).toBe(90);
    expect(Number(s.value)).toBe(180);
  });

  it('tagantjärele mahakandmine muudab vahet, seis jääb tegelikuks; hoiatus', async () => {
    await save({ kind: 'WRITE_OFF', date: d('2026-03-15'), writeOffReason: 'SPOILED', lines: [{ articleId, quantity: 5, amount: null }] });
    const l = await lineOf(invId);
    expect(l.diffQty).toBe(-5);
    expect(Number(l.fifoCost)).toBe(10);
    expect((await stock()).qty).toBe(90);
    const touches = [{ articleId, warehouseId: wh }];
    expect(await run(() => tenantTransaction((tx) => inventoryNotice(tx, touches, d('2026-03-15'), null)))).toBe('See kanne muudab inventuuri 31.03.2026 vahet');
    expect(await run(() => tenantTransaction((tx) => inventoryNotice(tx, touches, d('2026-03-31'), null)))).toBe('See kanne muudab inventuuri 31.03.2026 vahet');
    expect(await run(() => tenantTransaction((tx) => inventoryNotice(tx, touches, d('2026-04-01'), null)))).toBeNull();
    expect(await run(() => tenantTransaction((tx) => inventoryNotice(tx, touches, d('2026-03-15'), invId)))).toBeNull();
  });

  it('0 kannab kogu seisu maha; hilisem ülejääk saab viimase arvelevõtu hinna', async () => {
    await save({ kind: 'INVENTORY', date: d('2026-04-30'), lines: [{ articleId, quantity: 0, amount: null, countedQty: 0 }] });
    expect((await stock()).qty).toBe(0);
    const id = await save({ kind: 'INVENTORY', date: d('2026-05-31'), lines: [{ articleId, quantity: 0, amount: null, countedQty: 10 }] });
    const l = await lineOf(id);
    expect(l.diffQty).toBe(10);
    expect(Number(l.amount)).toBe(20);
    expect(l.fifoCost).toBeNull();
    const s = await stock();
    expect(s.qty).toBe(10);
    expect(Number(s.value)).toBe(20);
  });

  it('ühiku teisendus teisendab tegeliku seisu ja vahe', async () => {
    await run(() => tenantTransaction((tx) => changeArticleUnit(tx, articleId, 'kg', 't', 0.001)));
    const l = await lineOf(invId);
    expect(l.countedQty).toBeCloseTo(0.09, 9);
    expect(l.diffQty).toBeCloseTo(-0.005, 9);
    expect((await stock()).qty).toBeCloseTo(0.01, 9);
  });

  it('inventuuriga leitud hindamata kaup on ülekantav; päris puudujääk lükatakse tagasi', async () => {
    const catId = await run(() => tenantTransaction((tx) => systemCategoryId(tx, 'FERTILIZER')));
    const art = (await run(() => prisma.article.create({ data: { name: 'Hindamata leid', categoryId: catId, unit: 'kg' } }))).id;
    const wh2 = (await run(() => prisma.warehouse.create({ data: { name: 'Teine ladu' } }))).id;
    await save({ kind: 'INVENTORY', date: d('2026-06-01'), lines: [{ articleId: art, quantity: 0, amount: null, countedQty: 10 }] });
    const trId = await save({ kind: 'TRANSFER', date: d('2026-06-02'), toWarehouseId: wh2, lines: [{ articleId: art, quantity: 5, amount: null }] });
    expect((await lineOf(trId)).fifoCost).toBeNull();
    const st = (w: string) => run(() => prisma.articleStock.findUniqueOrThrow({ where: { articleId_warehouseId: { articleId: art, warehouseId: w } } }));
    expect((await st(wh)).qty).toBe(5);
    expect((await st(wh2)).qty).toBe(5);
    await expect(save({ kind: 'TRANSFER', date: d('2026-06-03'), toWarehouseId: wh2, lines: [{ articleId: art, quantity: 15, amount: null }] })).rejects.toBeInstanceOf(StockValidationError);
  });
});
