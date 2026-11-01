// Kulumaterjali ühiku muutmine ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { getDefaultWarehouseId, saveStockDocument } from './stock';
import { changeArticleUnit } from './articleUnitChange';
import { systemCategoryId } from './articleCategories';

const T = `test-tenant-unit-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(`${s}T00:00:00Z`);
let articleId = '';
let mainWh = '';

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test ühik' } });
  await run(async () => {
    const catId = await tenantTransaction((tx) => systemCategoryId(tx, 'SEED'));
    articleId = (await prisma.article.create({ data: { name: 'Testseeme', categoryId: catId, unit: 'kott' } })).id;
    mainWh = await tenantTransaction((tx) => getDefaultWarehouseId(tx));
    // Sissetulek 10 kotti 1000 € eest
    await tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'RECEIPT', date: d('2026-03-01'), warehouseId: mainWh, toWarehouseId: null, supplierId: null,
      documentNo: null, writeOffReason: null, notes: null, lines: [{ articleId, quantity: 10, amount: 1000 }]
    }));
    const field = await prisma.field.create({ data: { num: '1', name: 'Testpõld', fieldCode: 'T-1' } });
    const fs = await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 2, crop: 'test', geometry: {} } });
    const wt = await prisma.workType.create({ data: { name: 'Testkülv', phase: 'SOWING' } });
    const fw = await prisma.fieldWork.create({
      data: {
        fieldSeasonId: fs.id, workTypeId: wt.id, phase: 'SOWING',
        lines: { create: [{ kind: 'MATERIAL', articleId, label: 'Testseeme', unit: 'kott', ratePerHa: 1 }] }
      }
    });
    await prisma.workEntry.create({
      data: {
        fieldWorkId: fw.id, date: d('2026-05-10'), warehouseId: mainWh,
        lines: { create: [
          { kind: 'MATERIAL', articleId, label: 'Testseeme', quantity: 2, unit: 'kott', ratePerHa: 1, unitPrice: 100 },
          { kind: 'MATERIAL', articleId, label: 'Testseeme', quantity: 3, unit: 'l' }
        ] }
      }
    });
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.stockDocument.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

describe('changeArticleUnit', () => {
  it('kott → kg (1 kott = 500 kg) teisendab laokanded, vanas ühikus kande- ja plaaniread; väärtus ei muutu', async () => {
    await run(() => tenantTransaction((tx) => changeArticleUnit(tx, articleId, 'kott', 'kg', 500)));
    const [article, docLine, entryLines, planLine, stock] = await run(() => Promise.all([
      prisma.article.findUnique({ where: { id: articleId } }),
      prisma.stockDocumentLine.findFirst({ where: { articleId } }),
      prisma.workEntryLine.findMany({ where: { articleId }, orderBy: { quantity: 'asc' } }),
      prisma.fieldWorkLine.findFirst({ where: { articleId } }),
      prisma.articleStock.findFirst({ where: { articleId, warehouseId: mainWh } })
    ]));
    expect(article?.unit).toBe('kg');
    expect(docLine?.quantity).toBe(5000);
    expect(Number(docLine?.amount)).toBe(1000);
    const kg = entryLines.find((l) => l.unit === 'kg')!;
    expect(kg.quantity).toBe(1000);
    expect(kg.ratePerHa).toBe(500);
    // 1000 € / 5000 kg = 0,2 €/kg (laoseisu ümberarvutus kirjutab FIFO hinna)
    expect(Number(kg.unitPrice)).toBeCloseTo(0.2, 4);
    // Muus ühikus rida jääb puutumata
    expect(entryLines.find((l) => l.unit === 'l')?.quantity).toBe(3);
    expect(planLine?.unit).toBe('kg');
    expect(planLine?.ratePerHa).toBe(500);
    expect(stock?.qty).toBe(4000);
  });
});
