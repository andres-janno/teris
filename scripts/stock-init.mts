// scripts/stock-init.mts — laoarvestuse algseis: igale ettevõttele põhiladu, laota põllutöö kannete
// sidumine praeguse põhilaoga (ühekordne täitmine, et põhilao vahetus ajalugu ei liigutaks) ning
// laoseisu/FIFO hindade ümberarvutus. Korduvkäivitatav. Käivita: npx tsx scripts/stock-init.mts
import { authDb, runAsTenant, tenantTransaction, prisma } from '../src/server/db.ts';
import { getDefaultWarehouseId, recomputeAllMaterialStock } from '../src/server/stock.ts';

const tenants = await authDb().tenant.findMany({ select: { id: true, name: true } });
for (const t of tenants) {
  await runAsTenant(t.id, async () => {
    const filled = await tenantTransaction(async (tx) => {
      const defaultWh = await getDefaultWarehouseId(tx);
      const { count } = await tx.workEntry.updateMany({ where: { warehouseId: null }, data: { warehouseId: defaultWh } });
      await recomputeAllMaterialStock(tx);
      return count;
    }, { timeout: 300000 });
    const [neg, issues] = await Promise.all([
      prisma.materialStock.count({ where: { qty: { lt: 0 } } }),
      prisma.material.count({ where: { stockIssueCount: { gt: 0 } } })
    ]);
    console.log(`${t.name}: põhilaoga seotud ${filled} laota kannet, miinuses ${neg} materjali/lao paari, teisendamatute ridadega ${issues} materjali`);
  });
}
await authDb().$disconnect();
process.exit(0);
