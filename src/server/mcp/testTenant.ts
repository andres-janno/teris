// src/server/mcp/testTenant.ts — MCP testide ajutine ettevõte (live-andmebaas): kaks kasutajat
// (tavaline ja finantsjuht) koos võtmetega ning väike andmestik. cleanup() kustutab kõik.
import { prisma, authDb, runAsTenant } from '../db.ts';
import { createApiKey } from '../apiKeys.ts';
import type { LicenseModule } from '../license.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

export type TestTenant = {
  tenantId: string;
  plainKey: string;
  financeKey: string;
  plainUserId: string;
  financeUserId: string;
  ids: { fieldId: number; fieldSeasonId: number; materialId: string; warehouseId: string; vehicleId: string; implementId: string; workTypeId: string };
  cleanup: () => Promise<void>;
};

export async function createTestTenant(suffix: string, opts: { modules?: LicenseModule[] } = {}): Promise<TestTenant> {
  const tenantId = `test-mcp-${suffix}-${process.pid}`;
  const plainUserId = `${tenantId}-plain`;
  const financeUserId = `${tenantId}-fin`;
  await authDb().tenant.create({ data: { id: tenantId, name: `MCP test ${suffix}`, status: 'ACTIVE' } });
  await authDb().tenantLicense.create({ data: { tenantId, validUntil: d('2099-12-31'), modules: opts.modules ?? [] } });
  await authDb().user.createMany({ data: [
    { id: plainUserId, username: plainUserId, displayName: 'Mari Tavaline', passwordHash: 'x', tenantId },
    { id: financeUserId, username: financeUserId, displayName: 'Jaan Finants', passwordHash: 'x', tenantId, isFinanceManager: true }
  ] });
  const cleanup = async () => {
    await runAsTenant(tenantId, async () => {
      await prisma.workEntry.deleteMany({});
      await prisma.fieldWork.deleteMany({});
      await prisma.workType.deleteMany({});
      await prisma.fieldCadastralParcel.deleteMany({});
      await prisma.cadastralParcel.deleteMany({});
      await prisma.fieldSeason.deleteMany({});
      await prisma.field.deleteMany({});
      await prisma.season.deleteMany({});
      await prisma.stockDocument.deleteMany({});
      await prisma.materialStock.deleteMany({});
      await prisma.material.deleteMany({});
      await prisma.warehouse.deleteMany({});
      await prisma.vehicle.deleteMany({});
      await prisma.implement.deleteMany({});
    }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
    await authDb().apiKey.deleteMany({ where: { userId: { in: [plainUserId, financeUserId] } } }).catch((e) => console.error('Testi puhastus', e));
    await authDb().user.deleteMany({ where: { tenantId } }).catch((e) => console.error('Testi puhastus', e));
    await authDb().tenantLicense.deleteMany({ where: { tenantId } }).catch((e) => console.error('Testi puhastus', e));
    await authDb().tenant.deleteMany({ where: { id: tenantId } }).catch((e) => console.error('Testi puhastus', e));
  };

  let plainKey = '';
  let financeKey = '';
  let ids: TestTenant['ids'];
  try {
  const plain = await createApiKey(plainUserId, 'test');
  const fin = await createApiKey(financeUserId, 'test');
  if (!plain.ok || !fin.ok) throw new Error('Testvõtme loomine ebaõnnestus');
  plainKey = plain.key;
  financeKey = fin.key;

  ids = await runAsTenant(tenantId, async () => {
    const season = await prisma.season.create({ data: { year: 2026, name: '2026' } });
    const field = await prisma.field.create({ data: { num: '4', name: 'Toosi', fieldCode: 'T-4', soilType: 'Leostunud liivsavi' } });
    await prisma.field.create({ data: { num: '14', name: 'Toosi alumine', fieldCode: 'T-14' } });
    const fs = await prisma.fieldSeason.create({ data: { fieldId: field.id, seasonId: season.id, year: 2026, areaHa: 12.4, crop: 'Talinisu', cropVariety: 'Ada', geometry: {} } });
    const parcel = await prisma.cadastralParcel.create({ data: { cadastralCode: 'T-KAT-1', name: 'Testkatastri' } });
    await prisma.fieldCadastralParcel.create({ data: { fieldSeasonId: fs.id, cadastralParcelId: parcel.id, fieldAreaHa: 12.4, ownershipType: 'RENTED', rentFeeEurYear: 1200, landTaxEurYear: 80 } });
    const warehouse = await prisma.warehouse.create({ data: { name: 'Põhiladu', isDefault: true } });
    const material = await prisma.material.create({ data: { name: 'Ammooniumnitraat', category: 'FERTILIZER', unit: 'kg', nPct: 34 } });
    await prisma.materialStock.create({ data: { materialId: material.id, warehouseId: warehouse.id, qty: -150, value: 0, pricedQty: 0, unpricedQty: 150 } });
    const wt = await prisma.workType.create({ data: { name: 'Mineraalväetise kasutamine', shortName: 'Väetamine', phase: 'CARE', usesMaterials: true } });
    const vehicle = await prisma.vehicle.create({ data: { name: 'Valtra T1', type: 'TRACTOR', model: 'T194', regNumber: '123ABC', acquisitionCost: 150000, lastLatitude: 58.1, lastLongitude: 25.5 } });
    const implement = await prisma.implement.create({ data: { name: 'Amazone ZA', type: 'SEEDER', workingWidthM: 24, acquisitionCost: 20000 } });
    const fw = await prisma.fieldWork.create({
      data: { fieldSeasonId: fs.id, workTypeId: wt.id, phase: 'CARE', plannedDateFrom: d('2026-05-01'), status: 'DONE',
        lines: { create: [{ kind: 'MATERIAL', materialId: material.id, label: 'Ammooniumnitraat', unit: 'kg', ratePerHa: 200 }] } }
    });
    await prisma.workEntry.create({
      data: {
        fieldWorkId: fw.id, date: d('2026-05-10'), areaHa: 12.4, vehicleId: vehicle.id, implementId: implement.id, equipmentHours: 3.5, fuelLiters: 40,
        lines: { create: [{ kind: 'MATERIAL', materialId: material.id, label: 'Ammooniumnitraat', quantity: 150, unit: 'kg', ratePerHa: 12.15, unitPrice: 0.45, nKgHa: 4.13 }] }
      }
    });
    await prisma.stockDocument.create({
      data: { kind: 'RECEIPT', date: d('2026-04-01'), warehouseId: warehouse.id, documentNo: 'ARV-1',
        lines: { create: [{ materialId: material.id, quantity: 1000, amount: 450 }] } }
    });
    return { fieldId: field.id, fieldSeasonId: fs.id, materialId: material.id, warehouseId: warehouse.id, vehicleId: vehicle.id, implementId: implement.id, workTypeId: wt.id };
  });

  } catch (err) {
    await cleanup();
    throw err;
  }
  return { tenantId, plainKey, financeKey, plainUserId, financeUserId, ids, cleanup };
}
