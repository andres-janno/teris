// scripts/harvest-lots-init.mts — saagipartiide algseis: olemasolevad koristuskanded (sh PRIA import) jäävad
// käsitsi tonnidega ja partiita (lattu ei lähe). Korduvkäivitatav. Käivita: npx tsx scripts/harvest-lots-init.mts
import { authDb, runAsTenant, tenantTransaction } from '../src/server/db.ts';

const tenants = await authDb().tenant.findMany({ select: { id: true, name: true } });
for (const t of tenants) {
  await runAsTenant(t.id, async () => {
    const { count } = await tenantTransaction((tx) => tx.workEntry.updateMany({
      where: { harvestLotId: null, harvestTonnesManual: false, lines: { some: { kind: 'HARVEST' } } },
      data: { harvestTonnesManual: true }
    }));
    console.log(`${t.name}: käsitsi tonnidega koristuskandeid ${count}`);
  });
}
await authDb().$disconnect();
process.exit(0);
