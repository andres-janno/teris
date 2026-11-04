// scripts/land-tenure-refresh.mts — katastriüksuste omandivormi ümberarvutus maaomaniku ja põllu operaatori järgi
// (lukus hooaegu ei muudeta). Korduvkäivitatav. Käivita: npx tsx scripts/land-tenure-refresh.mts
import { authDb, runAsTenant, tenantTransaction } from "../src/server/db.ts";
import { refreshParcelOwnership } from "../src/server/apiHandler.ts";

const tenants = await authDb().tenant.findMany({ select: { id: true, name: true } });
for (const t of tenants) {
  const changed = await runAsTenant(t.id, () => tenantTransaction((tx) => refreshParcelOwnership(tx), { timeout: 300000 }));
  console.log(`${t.name}: muudetud ${changed}`);
}
await authDb().$disconnect();
process.exit(0);
