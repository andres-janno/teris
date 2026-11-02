// Kande artiklid: vaikimisi teenused, ressursi teenus ja hind, kütuseartikkel, ressursi sisend
// ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { systemCategoryId } from './articleCategories';
import { ensureDefaultServices, loadEntryArticles, resourceCostIn, resourceCostOut } from './entryArticles';

const T = `test-tenant-entryart-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const ids = { machineCat: '', fuelCat: '', vehicle: '', worker: '', ownService: '', fuel1: '', fuel2: '' };

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test kande artiklid' } });
  await run(async () => {
    ids.machineCat = await tenantTransaction((tx) => systemCategoryId(tx, 'MACHINE_TIME'));
    ids.fuelCat = await tenantTransaction((tx) => systemCategoryId(tx, 'FUEL'));
    ids.ownService = (await prisma.article.create({ data: { name: 'Kombain', categoryId: ids.machineCat, unit: 'h', price: 120 } })).id;
    ids.fuel1 = (await prisma.article.create({ data: { name: 'Diisel', categoryId: ids.fuelCat, unit: 'l' } })).id;
    ids.vehicle = (await prisma.vehicle.create({ data: { name: 'Traktor', type: 'TRACTOR', model: 'X' } })).id;
    ids.worker = (await prisma.relatedParty.create({ data: { name: 'Mart', roles: ['DRIVER'] } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.vehicle.deleteMany({});
    await prisma.relatedParty.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
  });
  await authDb().tenant.delete({ where: { id: T } });
});

describe('ensureDefaultServices', () => {
  it('loob neli vaikimisi teenust üks kord', async () => {
    await run(() => tenantTransaction(async (tx) => { await ensureDefaultServices(tx); await ensureDefaultServices(tx); }));
    const rows = await run(() => prisma.article.findMany({ where: { isDefaultService: true }, include: { category: true } }));
    expect(rows.map((r) => r.name).sort()).toEqual(['Haakeriista tööaeg', 'Kuivatamise tööaeg', 'Masina tööaeg', 'Töötaja tööaeg']);
    expect(rows.every((r) => r.unit === 'h' && r.price === null && r.category.group === 'SERVICE')).toBe(true);
  });
});

describe('loadEntryArticles', () => {
  it('ressursita: vaikimisi teenus ja selle hind; ainus kütus', async () => {
    await run(() => prisma.article.updateMany({ where: { isDefaultService: true, name: 'Töötaja tööaeg' }, data: { price: 20 } }));
    const r = await run(() => tenantTransaction((tx) => loadEntryArticles(tx, { workerId: null, vehicleId: null, implementId: null })));
    expect(r.laborService?.price).toBe(20);
    expect(r.machineService?.price).toBeNull();
    expect(r.fuelArticle).toEqual({ id: ids.fuel1, name: 'Diisel' });
  });
  it('ressursi tunnihind ja teenusartikkel', async () => {
    await run(async () => {
      await prisma.vehicle.update({ where: { id: ids.vehicle }, data: { serviceArticleId: ids.ownService } });
      await prisma.relatedParty.update({ where: { id: ids.worker }, data: { hourlyRate: 17.5 } });
    });
    const r = await run(() => tenantTransaction((tx) => loadEntryArticles(tx, { workerId: ids.worker, vehicleId: ids.vehicle, implementId: null })));
    expect(r.machineService).toEqual({ articleId: ids.ownService, price: 120 });
    expect(r.laborService?.price).toBe(17.5);
  });
  it('mitu kütust ilma masina kütuseta → kütus tühi; masina kütusega → masina kütus', async () => {
    ids.fuel2 = await run(async () => (await prisma.article.create({ data: { name: 'Bensiin', categoryId: ids.fuelCat, unit: 'l' } })).id);
    const none = await run(() => tenantTransaction((tx) => loadEntryArticles(tx, { workerId: null, vehicleId: ids.vehicle, implementId: null })));
    expect(none.fuelArticle).toBeNull();
    await run(() => prisma.vehicle.update({ where: { id: ids.vehicle }, data: { fuelArticleId: ids.fuel2 } }));
    const own = await run(() => tenantTransaction((tx) => loadEntryArticles(tx, { workerId: null, vehicleId: ids.vehicle, implementId: null })));
    expect(own.fuelArticle).toEqual({ id: ids.fuel2, name: 'Bensiin' });
  });
});

describe('resourceCostIn / resourceCostOut', () => {
  it('vale liigi teenus → viga', async () => {
    const r = await run(() => resourceCostIn({ serviceArticleId: ids.ownService }, 'LABOR', false, true));
    expect(r).toHaveProperty('error');
  });
  it('kütuseväli ainult kütuseartikliga', async () => {
    const r = await run(() => resourceCostIn({ fuelArticleId: ids.ownService }, 'MACHINE', true, true));
    expect(r).toHaveProperty('error');
  });
  it('tunnihind ainult finantsõigusega; negatiivne hind → viga', async () => {
    expect(await run(() => resourceCostIn({ hourlyRate: '12,5' }, 'MACHINE', true, true))).toEqual({ data: { hourlyRate: 12.5 } });
    expect(await run(() => resourceCostIn({ hourlyRate: '12,5' }, 'MACHINE', true, false))).toEqual({ data: {} });
    expect(await run(() => resourceCostIn({ hourlyRate: -1 }, 'MACHINE', true, true))).toEqual({ error: 'Hind peab olema 0 või suurem' });
  });
  it('puuduv võti ei muuda välja', async () => {
    expect(await run(() => resourceCostIn({}, 'MACHINE', true, true))).toEqual({ data: {} });
    expect(await run(() => resourceCostIn({ serviceArticleId: '' }, 'MACHINE', true, true))).toEqual({ data: { serviceArticleId: null } });
  });
  it('väljund peidab tunnihinna ilma finantsõiguseta', () => {
    expect(resourceCostOut({ serviceArticleId: 's', hourlyRate: { toString: () => '12.5' }, fuelArticleId: 'f' }, true))
      .toEqual({ serviceArticleId: 's', hourlyRate: 12.5, fuelArticleId: 'f' });
    expect(resourceCostOut({ serviceArticleId: 's', hourlyRate: 12.5 }, false)).toEqual({ serviceArticleId: 's' });
  });
});
