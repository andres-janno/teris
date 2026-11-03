// Artikli liigid ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { ensureArticleCategories, systemCategoryId, categoryIdForPriaKind } from './articleCategories';
import { saveStockDocument, getDefaultWarehouseId, StockValidationError } from './stock';

const T = `test-tenant-artcat-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test liigid' } });
});

afterAll(async () => {
  await run(async () => {
    await prisma.stockDocument.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.warehouse.deleteMany({});
  });
  await authDb().tenant.delete({ where: { id: T } });
});

describe('ensureArticleCategories', () => {
  it('loob süsteemsed liigid üks kord', async () => {
    await run(() => tenantTransaction(async (tx) => { await ensureArticleCategories(tx); await ensureArticleCategories(tx); }));
    const rows = await run(() => prisma.articleCategory.findMany({ where: { systemKind: { not: null } } }));
    expect(rows).toHaveLength(11);
  });
  it('ümbernimetatud süsteemset liiki ei looda uuesti', async () => {
    const id = await run(() => tenantTransaction((tx) => systemCategoryId(tx, 'FUEL')));
    await run(() => prisma.articleCategory.update({ where: { id }, data: { name: 'Diisel ja bensiin' } }));
    await run(() => tenantTransaction((tx) => ensureArticleCategories(tx)));
    expect(await run(() => prisma.articleCategory.count({ where: { systemKind: 'FUEL' } }))).toBe(1);
  });
});

describe('categoryIdForPriaKind', () => {
  it('OTHER loob „Muu kulumaterjal“ liigi ja kasutab seda edaspidi', async () => {
    const a = await run(() => tenantTransaction((tx) => categoryIdForPriaKind(tx, 'OTHER')));
    const b = await run(() => tenantTransaction((tx) => categoryIdForPriaKind(tx, 'OTHER')));
    expect(a).toBe(b);
    expect(await run(() => prisma.articleCategory.findUnique({ where: { id: a } }))).toMatchObject({ name: 'Muu kulumaterjal', group: 'CONSUMABLE', systemKind: null });
  });
  it('SEED annab süsteemse seemne liigi', async () => {
    const id = await run(() => tenantTransaction((tx) => categoryIdForPriaKind(tx, 'SEED')));
    expect(await run(() => prisma.articleCategory.findUnique({ where: { id } }))).toMatchObject({ systemKind: 'SEED' });
  });
});

describe('laokanne', () => {
  it('teenust ei saa laokandele panna', async () => {
    const catId = await run(() => tenantTransaction((tx) => systemCategoryId(tx, 'MACHINE_TIME')));
    const art = await run(() => prisma.article.create({ data: { name: 'Testmasina tund', categoryId: catId, unit: 'h' } }));
    const wh = await run(() => tenantTransaction((tx) => getDefaultWarehouseId(tx)));
    await expect(run(() => tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'RECEIPT', date: new Date('2026-05-01T00:00:00Z'), warehouseId: wh, toWarehouseId: null, supplierId: null,
      documentNo: null, writeOffReason: null, notes: null, lines: [{ articleId: art.id, quantity: 1, amount: 10 }]
    })))).rejects.toBeInstanceOf(StockValidationError);
  });
});
