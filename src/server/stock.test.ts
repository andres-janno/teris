// Laoseisu ümberarvutus ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { getDefaultWarehouseId, recomputeMaterialStock, transferShortageKeys } from './stock';

const T = `test-tenant-stock-${process.pid}`;
// await laseb laisa Prisma lubaduse täita ettevõtte kontekstis
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(`${s}T00:00:00Z`);
let materialId = '';
let mainWh = '';
let otherWh = '';
let entryLineId = '';

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
  await authDb().tenant.deleteMany({ where: { id: T } });
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
