// Saagipartii kaalumised ja kuivatuskulud laoarvestuses (ajutine ettevõte, live-andmebaas).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { getDefaultWarehouseId, recomputeArticleStock, saveStockDocument } from './stock';
import { systemCategoryId } from './articleCategories';

const T = `test-tenant-lotstock-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(`${s}T00:00:00Z`);
let grainId = '';
let oilId = '';
let lotId = '';
let wh = '';
const stockOf = (articleId: string) => run(() => prisma.articleStock.findUnique({ where: { articleId_warehouseId: { articleId, warehouseId: wh } } }));

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test partii ladu' } });
  await run(async () => {
    wh = await tenantTransaction((tx) => getDefaultWarehouseId(tx));
    const grainCat = await tenantTransaction((tx) => systemCategoryId(tx, 'GRAIN'));
    const oilCat = await tenantTransaction((tx) => systemCategoryId(tx, 'DRYING_OIL'));
    await prisma.crop.create({ data: { id: `crop-${T}`, name: 'Oder' } });
    grainId = (await prisma.article.create({ data: { name: 'Oder terad', categoryId: grainCat, unit: 'kg', cropId: `crop-${T}` } })).id;
    oilId = (await prisma.article.create({ data: { name: 'Kuivatusõli', categoryId: oilCat, unit: 'l' } })).id;
    const season = await prisma.season.create({ data: { year: 2026, name: 'Hooaeg 2026' } });
    lotId = (await prisma.harvestLot.create({ data: { name: 'Oder 2026', seasonId: season.id, cropId: `crop-${T}`, articleId: grainId, warehouseId: wh } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.harvestLot.deleteMany({});
    await prisma.stockDocument.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.crop.deleteMany({});
    await prisma.season.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

describe('partii laoarvestuses', () => {
  it('kaalumine on hinnata sissetulek artikli ühikus partii laos', async () => {
    await run(async () => {
      await prisma.harvestLotWeighing.create({ data: { lotId, date: d('2026-08-02'), tonnes: 2.5 } });
      await tenantTransaction((tx) => recomputeArticleStock(tx, [grainId]));
    });
    const s = await stockOf(grainId);
    expect(s?.qty).toBe(2500);
    expect(s?.unpricedQty).toBe(2500);
    expect(Number(s?.value)).toBe(0);
  });

  it('kauba kuivatuskulu kantakse laost maha FIFO hinnaga', async () => {
    await run(() => tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'RECEIPT', date: d('2026-07-01'), warehouseId: wh, toWarehouseId: null, supplierId: null, documentNo: null,
      writeOffReason: null, notes: null, lines: [{ articleId: oilId, quantity: 100, amount: 150 }]
    })));
    const cost = await run(() => prisma.harvestLotCost.create({ data: { lotId, date: d('2026-08-05'), articleId: oilId, quantity: 30 } }));
    await run(() => tenantTransaction((tx) => recomputeArticleStock(tx, [oilId])));
    const c = await run(() => prisma.harvestLotCost.findUniqueOrThrow({ where: { id: cost.id } }));
    expect(Number(c.unitPrice)).toBe(1.5);
    expect((await stockOf(oilId))?.qty).toBe(70);
  });
});
