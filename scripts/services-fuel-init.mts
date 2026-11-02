// scripts/services-fuel-init.mts — teenuste ja kütuse algseis: tööaja vaikimisi teenused, olemasolevad tööaja read
// vaikimisi teenusega (hinnad jäävad), kütuseartikkel „Diislikütus“ (vaikimisi ladu = põhiladu) masinatele ja
// artiklita kütuseridadele, kütuse FIFO ümberarvutus. Korduvkäivitatav. Käivita: npx tsx scripts/services-fuel-init.mts
import { authDb, runAsTenant, tenantTransaction } from '../src/server/db.ts';
import { getDefaultWarehouseId, recomputeArticleStock } from '../src/server/stock.ts';
import { systemCategoryId } from '../src/server/articleCategories.ts';
import { ensureDefaultServices } from '../src/server/entryArticles.ts';

const FUEL_NAME = 'Diislikütus';
const LINE_SERVICE = [['LABOR', 'LABOR_TIME'], ['MACHINE', 'MACHINE_TIME'], ['IMPLEMENT', 'IMPLEMENT_TIME']] as const;

const tenants = await authDb().tenant.findMany({ select: { id: true, name: true } });
for (const t of tenants) {
  await runAsTenant(t.id, async () => {
    const r = await tenantTransaction(async (tx) => {
      const defaults = await ensureDefaultServices(tx);
      let hourLines = 0;
      for (const [kind, systemKind] of LINE_SERVICE) {
        const { count } = await tx.workEntryLine.updateMany({ where: { kind, articleId: null }, data: { articleId: defaults.get(systemKind)!.id } });
        hourLines += count;
      }
      const fuelCategoryId = await systemCategoryId(tx, 'FUEL');
      const fuel = (await tx.article.findFirst({ where: { categoryId: fuelCategoryId, name: FUEL_NAME }, select: { id: true } }))
        ?? (await tx.article.create({ data: { name: FUEL_NAME, categoryId: fuelCategoryId, unit: 'l', defaultWarehouseId: await getDefaultWarehouseId(tx) }, select: { id: true } }));
      const vehicles = await tx.vehicle.updateMany({ where: { fuelArticleId: null }, data: { fuelArticleId: fuel.id } });
      const fuelLines = await tx.workEntryLine.updateMany({ where: { kind: 'FUEL', articleId: null }, data: { articleId: fuel.id, label: FUEL_NAME } });
      await recomputeArticleStock(tx, [fuel.id]);
      return { hourLines, vehicles: vehicles.count, fuelLines: fuelLines.count };
    }, { timeout: 300000 });
    console.log(`${t.name}: tööaja ridu teenusega ${r.hourLines}, masinaid kütusega ${r.vehicles}, kütuseridu ${r.fuelLines}`);
  });
}
await authDb().$disconnect();
process.exit(0);
