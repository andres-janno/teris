// scripts/season-crop-link.mts — seob olemasolevad põllu hooajad kultuuride registriga (cropId kultuurinime järgi).
// Korduvkäivitatav. Käivita: npx tsx scripts/season-crop-link.mts
import { authDb, runAsTenant, tenantTransaction } from '../src/server/db.ts';
import { relinkSeasonCrops } from '../src/server/seasonCropLink.ts';

const tenants = await authDb().tenant.findMany({ select: { id: true, name: true } });
for (const t of tenants) {
  await runAsTenant(t.id, async () => {
    const changed = await tenantTransaction((tx) => relinkSeasonCrops(tx));
    console.log(`${t.name}: seotud hooaegu ${changed}`);
  });
}
await authDb().$disconnect();
process.exit(0);
