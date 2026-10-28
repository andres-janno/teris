// Laoseisu ümberarvutus ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import {
  getDefaultWarehouseId, recomputeMaterialStock, transferShortageKeys, saveStockDocument, deleteStockDocument, StockValidationError,
  saveWarehouse, resolveEntryWarehouseId
} from './stock';

const T = `test-tenant-stock-${process.pid}`;
const T2 = `${T}-b`; // tühi ettevõte põhilao samaaegse loomise testiks
// await laseb laisa Prisma lubaduse täita ettevõtte kontekstis
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(`${s}T00:00:00Z`);
let materialId = '';
let mainWh = '';
let otherWh = '';
let entryLineId = '';
let fieldWorkId = '';

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test ladu' } });
  await run(async () => {
    materialId = (await prisma.material.create({ data: { name: 'Testväetis', category: 'FERTILIZER', unit: 'kg' } })).id;
    mainWh = await tenantTransaction((tx) => getDefaultWarehouseId(tx));
    otherWh = (await prisma.warehouse.create({ data: { name: 'Teine ladu' } })).id;
    // Põllutöö kanne: hooaeg → põld → töö → kanne 1500 g... ja 200 kg
    const field = await prisma.field.create({ data: { num: '1', name: 'Testpõld', fieldCode: 'T-1' } });
    const fs = await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 1, crop: 'test', geometry: {} } });
    const wt = await prisma.workType.create({ data: { name: 'Testväetamine', phase: 'CARE' } });
    const fw = await prisma.fieldWork.create({ data: { fieldSeasonId: fs.id, workTypeId: wt.id, phase: 'CARE' } });
    fieldWorkId = fw.id;
    const entry = await prisma.workEntry.create({
      data: {
        fieldWorkId: fw.id, date: d('2026-05-10'),
        lines: { create: [
          { kind: 'MATERIAL', materialId, label: 'Testväetis', quantity: 200, unit: 'kg' },
          { kind: 'MATERIAL', materialId, label: 'Testväetis', quantity: 3, unit: 'l' }
        ] }
      },
      include: { lines: true }
    });
    entryLineId = entry.lines.find((l) => l.unit === 'kg')!.id;
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
    await prisma.materialStock.deleteMany({});
    await prisma.material.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: { in: [T, T2] } } });
});

describe('laoseisu ümberarvutus', () => {
  it('põhiladu luuakse üks kord', async () => {
    const again = await run(() => tenantTransaction((tx) => getDefaultWarehouseId(tx)));
    expect(again).toBe(mainWh);
    expect(await run(() => prisma.warehouse.count({ where: { isDefault: true } }))).toBe(1);
  });

  it('ilma arvele võtmiseta on kanne miinuses ja hindamata; teisendamatu rida on probleem', async () => {
    await run(() => tenantTransaction((tx) => recomputeMaterialStock(tx, [materialId])));
    const s = await run(() => prisma.materialStock.findUnique({ where: { materialId_warehouseId: { materialId, warehouseId: mainWh } } }));
    expect(s?.qty).toBe(-200);
    expect(s?.unpricedQty).toBe(200);
    const line = await run(() => prisma.workEntryLine.findUnique({ where: { id: entryLineId } }));
    expect(line?.unitPrice).toBeNull();
    const m = await run(() => prisma.material.findUnique({ where: { id: materialId } }));
    expect(m?.stockIssueCount).toBe(1);
  });

  it('tagantjärele arvele võtmine annab kandereale FIFO hinna', async () => {
    await run(async () => {
      await prisma.stockDocument.create({
        data: { kind: 'RECEIPT', date: d('2026-04-01'), warehouseId: mainWh, lines: { create: [{ materialId, quantity: 500, amount: 250 }] } }
      });
      await tenantTransaction((tx) => recomputeMaterialStock(tx, [materialId]));
    });
    const line = await run(() => prisma.workEntryLine.findUnique({ where: { id: entryLineId } }));
    expect(Number(line?.unitPrice)).toBe(0.5);
    const s = await run(() => prisma.materialStock.findUnique({ where: { materialId_warehouseId: { materialId, warehouseId: mainWh } } }));
    expect(s?.qty).toBe(300);
    expect(Number(s?.value)).toBe(150);
  });

  it('ülekanne üle saadaoleva annab puudujäägi võtme', async () => {
    await run(async () => {
      await prisma.stockDocument.create({
        data: { kind: 'TRANSFER', date: d('2026-06-01'), warehouseId: mainWh, toWarehouseId: otherWh, lines: { create: [{ materialId, quantity: 400 }] } }
      });
      await tenantTransaction((tx) => recomputeMaterialStock(tx, [materialId]));
    });
    const keys = await run(() => tenantTransaction((tx) => transferShortageKeys(tx, [materialId])));
    expect(keys.size).toBe(1);
    const line = await run(() => prisma.stockDocumentLine.findFirst({ where: { document: { kind: 'TRANSFER' } } }));
    expect(line?.shortageQty).toBe(100);
    expect(line?.fifoCost).toBeNull();
  });
});

import { materialStockSummary } from './stock';

describe('materjalide laoseisu kokkuvõte', () => {
  it('summeerib laod ja filtreerib ühe lao', async () => {
    const all = await run(() => tenantTransaction((tx) => materialStockSummary(tx, null)));
    const one = await run(() => tenantTransaction((tx) => materialStockSummary(tx, otherWh)));
    const a = all.get(materialId)!;
    const o = one.get(materialId)!;
    expect(a.qty).toBe(300); // 500 − 200; ülekanne laosiseselt neutraalne
    expect(o.qty).toBe(400);
  });
});

describe('laokande salvestus', () => {
  it('ülekanne üle saadaoleva lükatakse tagasi ja midagi ei salvestu', async () => {
    const before = await run(() => prisma.stockDocument.count());
    await expect(run(() => tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'TRANSFER', date: d('2026-07-01'), warehouseId: otherWh, toWarehouseId: mainWh, supplierId: null,
      documentNo: null, writeOffReason: null, notes: null, lines: [{ materialId, quantity: 100000, amount: null }]
    })))).rejects.toBeInstanceOf(StockValidationError);
    expect(await run(() => prisma.stockDocument.count())).toBe(before);
  });

  it('mahakandmine saab FIFO maksumuse ja kustutamine taastab seisu', async () => {
    const id = await run(() => tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'WRITE_OFF', date: d('2026-04-02'), warehouseId: mainWh, toWarehouseId: null, supplierId: null,
      documentNo: null, writeOffReason: 'SPOILED', notes: null, lines: [{ materialId, quantity: 10, amount: null }]
    })));
    const line = await run(() => prisma.stockDocumentLine.findFirst({ where: { documentId: id } }));
    expect(Number(line?.fifoCost)).toBe(5);
    await run(() => tenantTransaction((tx) => deleteStockDocument(tx, id)));
    expect(await run(() => prisma.stockDocument.findUnique({ where: { id } }))).toBeNull();
  });
});

const receipt = (date: string, warehouseId: string, mat: string, quantity: number, amount: number) => ({
  kind: 'RECEIPT' as const, date: d(date), warehouseId, toWarehouseId: null, supplierId: null,
  documentNo: null, writeOffReason: null, notes: null, lines: [{ materialId: mat, quantity, amount }]
});
const transfer = (date: string, from: string, to: string, mat: string, quantity: number) => ({
  kind: 'TRANSFER' as const, date: d(date), warehouseId: from, toWarehouseId: to, supplierId: null,
  documentNo: null, writeOffReason: null, notes: null, lines: [{ materialId: mat, quantity, amount: null }]
});

let seedId = '';

describe('ülekande puudujääk arvele võtmise muutmisel ja kustutamisel', () => {
  let receiptId = '';
  let transferId = '';
  beforeAll(async () => {
    await run(async () => {
      seedId = (await prisma.material.create({ data: { name: 'Testseeme', category: 'SEED', unit: 'kg' } })).id;
      receiptId = await tenantTransaction((tx) => saveStockDocument(tx, null, receipt('2026-03-01', mainWh, seedId, 100, 200)));
      transferId = await tenantTransaction((tx) => saveStockDocument(tx, null, transfer('2026-03-05', mainWh, otherWh, seedId, 80)));
    });
  });

  it('arvele võtmise vähendamine, mis jätaks ülekande katmata, lükatakse tagasi', async () => {
    await expect(run(() => tenantTransaction((tx) => saveStockDocument(tx, receiptId, receipt('2026-03-01', mainWh, seedId, 50, 100)))))
      .rejects.toBeInstanceOf(StockValidationError);
    const line = await run(() => prisma.stockDocumentLine.findFirst({ where: { documentId: receiptId } }));
    expect(line?.quantity).toBe(100);
    const tr = await run(() => prisma.stockDocumentLine.findFirst({ where: { documentId: transferId } }));
    expect(tr?.shortageQty).toBeNull();
    expect(Number(tr?.fifoCost)).toBe(160);
  });

  it('arvele võtmise kustutamine, mis jätaks ülekande katmata, lükatakse tagasi', async () => {
    await expect(run(() => tenantTransaction((tx) => deleteStockDocument(tx, receiptId)))).rejects.toBeInstanceOf(StockValidationError);
    expect(await run(() => prisma.stockDocument.findUnique({ where: { id: receiptId } }))).not.toBeNull();
    const tr = await run(() => prisma.stockDocumentLine.findFirst({ where: { documentId: transferId } }));
    expect(tr?.shortageQty).toBeNull();
  });

  it('kande rida saab teenuse kaudu salvestamisel valitud lao FIFO hinna', async () => {
    const entryId = await run(() => tenantTransaction(async (tx) => {
      const e = await tx.workEntry.create({
        data: {
          fieldWorkId, date: d('2026-04-01'), warehouseId: await resolveEntryWarehouseId(tx, otherWh, null),
          lines: { create: [{ kind: 'MATERIAL', materialId: seedId, label: 'Testseeme', quantity: 20000, unit: 'g' }] }
        }
      });
      await recomputeMaterialStock(tx, [seedId]);
      return e.id;
    }));
    const line = await run(() => prisma.workEntryLine.findFirst({ where: { entryId } }));
    expect(Number(line?.unitPrice)).toBe(0.002); // 2 €/kg grammides
    const s = await run(() => prisma.materialStock.findUnique({ where: { materialId_warehouseId: { materialId: seedId, warehouseId: otherWh } } }));
    expect(s?.qty).toBe(60);
    expect(s?.pricedQty).toBe(60);
    expect(Number(s?.value)).toBe(120);
  });
});

const seedMaterialId = () => seedId;

describe('ladude reeglid', () => {
  it('põhilao saab vahetada ainult teise lao põhilaoks märkimisega; ajalugu jääb oma lattu', async () => {
    const thirdWh = await run(() => tenantTransaction((tx) => saveWarehouse(tx, null, { name: 'Kolmas ladu', isDefault: false, isActive: true, poiId: null, notes: null }))).then((w) => w.id);
    await expect(run(() => tenantTransaction((tx) => saveWarehouse(tx, mainWh, { name: 'Põhiladu', isDefault: false, isActive: true, poiId: null, notes: null }))))
      .rejects.toBeInstanceOf(StockValidationError);
    // Valimata ladu → põhilao päris id
    const entryWh = await run(() => tenantTransaction((tx) => resolveEntryWarehouseId(tx, null, null)));
    expect(entryWh).toBe(mainWh);
    const before = await run(() => prisma.materialStock.findMany({ where: { materialId }, orderBy: { warehouseId: 'asc' } }));
    // Kolmas ladu põhilaoks (mitteaktiivsena märgitu muutub aktiivseks)
    const w = await run(() => tenantTransaction((tx) => saveWarehouse(tx, thirdWh, { name: 'Kolmas ladu', isDefault: true, isActive: false, poiId: null, notes: null })));
    expect(w.isActive).toBe(true);
    expect(await run(() => prisma.warehouse.count({ where: { isDefault: true } }))).toBe(1);
    await run(() => tenantTransaction((tx) => recomputeMaterialStock(tx, [materialId, seedMaterialId()])));
    const entries = await run(() => prisma.workEntry.count({ where: { warehouseId: thirdWh } }));
    expect(entries).toBe(0);
    // Päris lao id-ga kanne (Testseeme, teine ladu) jääb oma lattu
    const seedStock = await run(() => prisma.materialStock.findUnique({ where: { materialId_warehouseId: { materialId: seedMaterialId(), warehouseId: otherWh } } }));
    expect(seedStock?.qty).toBe(60);
    // Laota vana kanne (varuvariant) liigub uude põhilattu; päris id-ga kanded ei liigu
    const after = await run(() => prisma.materialStock.findMany({ where: { materialId, warehouseId: { not: thirdWh } }, orderBy: { warehouseId: 'asc' } }));
    expect(after.find((r) => r.warehouseId === mainWh)!.qty).toBe(before.find((r) => r.warehouseId === mainWh)!.qty + 200);
    // Tagasi
    await run(() => tenantTransaction((tx) => saveWarehouse(tx, mainWh, { name: 'Põhiladu', isDefault: true, isActive: true, poiId: null, notes: null })));
    await run(() => tenantTransaction((tx) => recomputeMaterialStock(tx, [materialId, seedMaterialId()])));
    await run(() => prisma.warehouse.delete({ where: { id: thirdWh } }));
  });

  it('kande ladu: senine mitteaktiivne ladu jääb, mitteaktiivsele vahetamine lükatakse tagasi', async () => {
    const closedWh = await run(() => prisma.warehouse.create({ data: { name: 'Suletud ladu', isActive: false } })).then((w) => w.id);
    expect(await run(() => tenantTransaction((tx) => resolveEntryWarehouseId(tx, closedWh, closedWh)))).toBe(closedWh);
    expect(await run(() => tenantTransaction((tx) => resolveEntryWarehouseId(tx, null, closedWh)))).toBe(closedWh);
    await expect(run(() => tenantTransaction((tx) => resolveEntryWarehouseId(tx, closedWh, mainWh)))).rejects.toThrow('ei ole aktiivne');
    await expect(run(() => tenantTransaction((tx) => resolveEntryWarehouseId(tx, 'puudub', mainWh)))).rejects.toThrow('Ladu ei leitud');
    expect(await run(() => tenantTransaction((tx) => resolveEntryWarehouseId(tx, otherWh, mainWh)))).toBe(otherWh);
    await run(() => prisma.warehouse.delete({ where: { id: closedWh } }));
  });

  it('samaaegsed põhilao päringud tühjas ettevõttes loovad ühe põhilao', async () => {
    await authDb().tenant.create({ data: { id: T2, name: 'Test ladu 2' } });
    const run2 = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T2, async () => await fn());
    try {
      const ids = await Promise.all([1, 2, 3, 4].map(() => run2(() => tenantTransaction((tx) => getDefaultWarehouseId(tx)))));
      expect(new Set(ids).size).toBe(1);
      expect(await run2(() => prisma.warehouse.count())).toBe(1);
    } finally {
      await run2(() => prisma.warehouse.deleteMany({}));
    }
  });
});
