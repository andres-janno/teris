// Põllu ladu ja punkrid: koristus → põllu ladu → ülekanne hoidlasse → partii sulgemisel punkrid tonnideks (ajutine ettevõte, live-andmebaas).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { applyEntryHarvest, closeLot, reopenLot, ensureBunkerArticle, ensureGrainArticle, lotBunkerArticleIds, CHOOSE_LOT_ERROR } from './harvestLots';
import { ensureFieldWarehouse, recomputeArticleStock, saveStockDocument, getDefaultWarehouseId } from './stock';
import { buildEntryLines } from './fieldWorkRules';

const T = `test-tenant-fieldwh-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const tx = <R>(fn: (t: any) => Promise<R>) => run(() => tenantTransaction(fn));
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const crop = { id: '', name: 'Kaer' };
let fieldId = 0;
let fsId = 0;
let fwId = '';
let storeWh = ''; // Rõngu
let lotId = '';
let bunkerId = '';

const qtyIn = (articleId: string, warehouseId: string) =>
  run(() => prisma.articleStock.findUnique({ where: { articleId_warehouseId: { articleId, warehouseId } } })).then((s) => s?.qty ?? 0);
const entry = (bunkers: number, manual = false, date = '2026-08-01') => run(() => prisma.workEntry.create({
  data: { fieldWorkId: fwId, date: d(date), harvestLotId: lotId, harvestBunkers: bunkers, harvestTonnesManual: manual,
    lines: { create: [{ kind: 'HARVEST', label: 'Saak', quantity: manual ? 5 : 0, unit: 't' }] } }
}));
const recompute = () => tx((t) => recomputeArticleStock(t, [bunkerId]));

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test põllu ladu' } });
  await run(async () => {
    crop.id = `crop-${T}`;
    await prisma.crop.create({ data: { id: crop.id, name: crop.name } });
    const field = await prisma.field.create({ data: { num: '7', name: 'Mõisapõld', fieldCode: 'F-7' } });
    fieldId = field.id;
    fsId = (await prisma.fieldSeason.create({ data: { fieldId, year: 2026, areaHa: 10, crop: 'Kaer', cropId: crop.id, geometry: {} } })).id;
    const wt = await prisma.workType.create({ data: { name: 'Testkoristus', phase: 'HARVEST' } });
    fwId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fsId, workTypeId: wt.id, phase: 'HARVEST' } })).id;
    await tenantTransaction((t) => getDefaultWarehouseId(t));
    storeWh = (await prisma.warehouse.create({ data: { name: 'Rõngu' } })).id;
    const season = await prisma.season.create({ data: { year: 2026, name: 'Hooaeg 2026' } });
    const articleId = await tenantTransaction((t) => ensureGrainArticle(t, crop));
    lotId = (await prisma.harvestLot.create({ data: { name: 'Kaer 2026 otse', seasonId: season.id, cropId: crop.id, articleId, warehouseId: storeWh } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.harvestLotWeighing.deleteMany({});
    await prisma.harvestLot.deleteMany({});
    await prisma.stockDocument.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.warehouse.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.crop.deleteMany({});
    await prisma.season.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

describe('põllu ladu ja punkrid', () => {
  let fieldWh = '';

  it('punkriartikkel tekib kultuurile ühikuga punker', async () => {
    [bunkerId] = await tx((t) => lotBunkerArticleIds(t, [lotId]));
    const a = await run(() => prisma.article.findUniqueOrThrow({ where: { id: bunkerId }, include: { category: true } }));
    expect(a.name).toBe('Kaer punkrid');
    expect(a.unit).toBe('punker');
    expect(a.category.systemKind).toBe('BUNKERS');
    expect(await tx((t) => ensureBunkerArticle(t, crop))).toBe(bunkerId);
  });

  it('koristuskanne võtab punkrid põllu lattu; käsitsi kanne mitte', async () => {
    await entry(10);
    await entry(3, true);
    await recompute();
    fieldWh = await tx((t) => ensureFieldWarehouse(t, fieldId));
    const w = await run(() => prisma.warehouse.findUniqueOrThrow({ where: { id: fieldWh } }));
    expect(w.name).toBe('Mõisapõld');
    expect(w.fieldId).toBe(fieldId);
    expect(await qtyIn(bunkerId, fieldWh)).toBe(10);
  });

  it('ülekanne viib punkrid hoidlasse; rohkem kui põllul on, ei saa', async () => {
    const transfer = (quantity: number) => tx((t) => saveStockDocument(t, null, {
      kind: 'TRANSFER', date: d('2026-08-02'), warehouseId: fieldWh, toWarehouseId: storeWh, supplierId: null, documentNo: null,
      writeOffReason: null, notes: null, lines: [{ articleId: bunkerId, quantity, amount: null }]
    }));
    await expect(transfer(11)).rejects.toThrow(/saadaval 10/);
    await transfer(10);
    expect(await qtyIn(bunkerId, fieldWh)).toBe(0);
    expect(await qtyIn(bunkerId, storeWh)).toBe(10);
  });

  it('sulgemine teisendab hoidla punkrid tonnideks, avamine võtab tagasi', async () => {
    await run(() => prisma.harvestLotWeighing.create({ data: { lotId, date: d('2026-08-03'), tonnes: 8 } }));
    await tx((t) => closeLot(t, lotId));
    await recompute();
    expect(await qtyIn(bunkerId, storeWh)).toBe(0);
    await tx((t) => reopenLot(t, lotId));
    await recompute();
    expect(await qtyIn(bunkerId, storeWh)).toBe(10);
  });

  it('nime kokkupõrkel saab põllu ladu põllu numbri', async () => {
    const f2 = await run(() => prisma.field.create({ data: { num: '8', name: 'Rõngu', fieldCode: 'F-8' } }));
    const id = await tx((t) => ensureFieldWarehouse(t, f2.id));
    expect((await run(() => prisma.warehouse.findUniqueOrThrow({ where: { id } }))).name).toBe('Rõngu (põld 8)');
  });

  it('mitu lahtist partiid: uus kanne nõuab partii valikut', async () => {
    const lot = await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: lotId } }));
    await run(() => prisma.harvestLot.create({ data: { name: 'Kaer 2026 kuivati', seasonId: lot.seasonId, cropId: crop.id, articleId: lot.articleId, warehouseId: storeWh } }));
    const drafts = buildEntryLines({ harvest: { tonnes: null, ratePerHa: null, priaKind: null, priaSpec: null, withBunkers: true } });
    await expect(tx((t) => applyEntryHarvest(t, drafts, { fieldSeasonId: fsId, areaHa: null, fieldAreaHa: 10, bunkers: 2, manual: false, requestedLotId: null, old: null })))
      .rejects.toThrow(CHOOSE_LOT_ERROR);
  });
});
