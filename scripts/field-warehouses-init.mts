// scripts/field-warehouses-init.mts — põllu ladude algseis: iga saagipartii kultuurile punkriartikkel ja punkrite
// laoseisu ümberarvutus (koristuskannete punkrid põllu ladudesse, suletud partiide punkrid partii laost maha).
// Korduvkäivitatav. Käivita: npx tsx scripts/field-warehouses-init.mts
import { authDb, runAsTenant, tenantTransaction } from '../src/server/db.ts';
import { recomputeArticleStock } from '../src/server/stock.ts';
import { lotBunkerArticleIds } from '../src/server/harvestLots.ts';

const tenants = await authDb().tenant.findMany({ select: { id: true, name: true } });
for (const t of tenants) {
  await runAsTenant(t.id, async () => {
    const r = await tenantTransaction(async (tx) => {
      const lots = await tx.harvestLot.findMany({ select: { id: true } });
      const articles = await lotBunkerArticleIds(tx, lots.map((l) => l.id));
      await recomputeArticleStock(tx, articles);
      return { lots: lots.length, articles: articles.length, fieldWarehouses: await tx.warehouse.count({ where: { fieldId: { not: null } } }) };
    }, { timeout: 300000 });
    console.log(`${t.name}: partiisid ${r.lots}, punkriartikleid ${r.articles}, põllu ladusid ${r.fieldWarehouses}`);
  });
}
await authDb().$disconnect();
process.exit(0);
