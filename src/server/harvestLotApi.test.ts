// Saagipartiide API: õigused, partii, kaalumine, kulud, kustutamine, kuivatuskulu finantsaknas
// (live-andmebaas, ajutine ettevõte); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { systemCategoryId } from './articleCategories';
import { setSessionUserForTest } from './authGate';
import { handleHarvestLots } from './harvestLotApi';
import { handleFieldWorks } from './fieldWorks';
import { saveStockDocument, getDefaultWarehouseId } from './stock';
import { ensureDefaultServices } from './entryArticles';

const T = `test-tenant-harvestlotapi-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const user = (suffix: string, finance: boolean) => ({
  id: `hlapi-${suffix}-${process.pid}`, username: `hlapi-${suffix}-${process.pid}`, displayName: null, passwordHash: '', isActive: true,
  isAdmin: finance, isFinanceManager: finance, mustChangePassword: false, tenantId: T
});
const ADMIN = user('a', true);
const WORKER = user('w', false);

async function call(method: string, path: string, body?: unknown, who = ADMIN) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Object.assign(Readable.from(raw ? [Buffer.from(raw)] : []), {
    method, url: path, headers: { host: 'localhost', 'content-type': 'application/json' }, socket: {}
  }) as unknown as IncomingMessage;
  setSessionUserForTest(req, who);
  const out = { status: 200, body: '' };
  const res = {
    statusCode: 200,
    setHeader() {}, writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  const url = new URL(path, 'http://localhost');
  await run(async () => {
    if (!(await handleHarvestLots(req, res, url.pathname, method, url))) await handleFieldWorks(req, res, url.pathname, method, url);
  });
  return { status: out.status, json: out.body ? JSON.parse(out.body) : null };
}
const grainQty = async (articleId: string) =>
  run(async () => (await prisma.articleStock.findMany({ where: { articleId } })).reduce((s, r) => s + r.qty, 0));

const s = { main: '', crop: '', gas: '', serviceOwn: '', serviceDefault: '', fieldSeasonId: 0, fieldSeason2Id: 0, fieldWorkId: '', fieldWork2Id: '' };

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test saagipartii API' } });
  for (const u of [ADMIN, WORKER]) {
    await authDb().user.create({ data: { id: u.id, username: u.username, passwordHash: '', isAdmin: u.isAdmin, isFinanceManager: u.isFinanceManager, tenantId: T } });
  }
  await run(async () => {
    s.main = await tenantTransaction((tx) => getDefaultWarehouseId(tx));
    s.crop = (await prisma.crop.create({ data: { id: `crop-${process.pid}`, name: 'Talinisu' } })).id;
    const fuelCat = await tenantTransaction((tx) => systemCategoryId(tx, 'FUEL'));
    s.gas = (await prisma.article.create({ data: { name: 'Gaas', categoryId: fuelCat, unit: 'l', defaultWarehouseId: s.main } })).id;
    await tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'RECEIPT', date: d('2026-04-01'), warehouseId: s.main, toWarehouseId: null, supplierId: null,
      documentNo: null, writeOffReason: null, notes: null, lines: [{ articleId: s.gas, quantity: 100, amount: 150 }]
    }));
    const labor = await tenantTransaction((tx) => systemCategoryId(tx, 'LABOR_TIME'));
    s.serviceOwn = (await prisma.article.create({ data: { name: 'Kuivati tund', categoryId: labor, unit: 'h', price: 12 } })).id;
    await tenantTransaction((tx) => ensureDefaultServices(tx));
    await prisma.article.updateMany({ where: { isDefaultService: true, name: 'Töötaja tööaeg' }, data: { price: 20 } });
    s.serviceDefault = (await prisma.article.create({ data: { name: 'Hinnata teenus', categoryId: labor, unit: 'h' } })).id;
    const f1 = await prisma.field.create({ data: { num: '1', name: 'Põld A', fieldCode: 'HL-1' } });
    const f2 = await prisma.field.create({ data: { num: '2', name: 'Põld B', fieldCode: 'HL-2' } });
    const fs1 = await prisma.fieldSeason.create({ data: { fieldId: f1.id, year: 2026, areaHa: 10, crop: 'Talinisu', cropId: s.crop, geometry: {} } });
    const fs2 = await prisma.fieldSeason.create({ data: { fieldId: f2.id, year: 2026, areaHa: 10, crop: 'Talinisu', cropId: s.crop, geometry: {} } });
    s.fieldSeasonId = fs1.id;
    s.fieldSeason2Id = fs2.id;
    const wt = await prisma.workType.create({ data: { name: 'Testkoristus', phase: 'HARVEST' } });
    s.fieldWorkId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fs1.id, workTypeId: wt.id, phase: 'HARVEST' } })).id;
    s.fieldWork2Id = (await prisma.fieldWork.create({ data: { fieldSeasonId: fs2.id, workTypeId: wt.id, phase: 'HARVEST' } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.harvestLot.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.stockDocument.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.crop.deleteMany({});
    await prisma.season.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().user.deleteMany({ where: { id: { in: [ADMIN.id, WORKER.id] } } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

describe('saagipartiide API', () => {
  let lotId = '';
  let articleId = '';

  it('mitte-finantsõigusega kasutaja: loend 403, lahtiste valik 200', async () => {
    expect((await call('GET', '/api/harvest-lots?year=2026', undefined, WORKER)).status).toBe(403);
    expect((await call('POST', '/api/harvest-lots', { name: 'x' }, WORKER)).status).toBe(403);
    const open = await call('GET', `/api/harvest-lots/open?fieldSeasonId=${s.fieldSeasonId}`, undefined, WORKER);
    expect(open.status).toBe(200);
    expect(open.json).toEqual([]);
  });

  it('loomine: teraartikkel leitakse, nimi ja ladu kohustuslikud', async () => {
    expect((await call('POST', '/api/harvest-lots', { name: ' ', year: 2026, cropId: s.crop, warehouseId: s.main })).status).toBe(400);
    const r = await call('POST', '/api/harvest-lots', { name: 'Nisu A', year: 2026, cropId: s.crop, warehouseId: s.main, notes: null });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ name: 'Nisu A', seasonYear: 2026, cropName: 'Talinisu', articleName: 'Talinisu terad', status: 'OPEN', bunkers: 0, weighedTonnes: 0, entryCount: 0, closedAt: null });
    lotId = r.json.id;
    articleId = r.json.articleId;
    expect((await call('POST', '/api/harvest-lots', { name: 'Nisu A', year: 2026, cropId: s.crop, warehouseId: s.main })).status).toBe(409);
    const open = await call('GET', `/api/harvest-lots/open?fieldSeasonId=${s.fieldSeasonId}`, undefined, WORKER);
    expect(open.json).toEqual([{ id: lotId, name: 'Nisu A' }]);
  });

  it('kaalumine muudab terade laoseisu; suletud partiile blokeeritud', async () => {
    expect((await call('POST', `/api/harvest-lots/${lotId}/weighings`, { date: '2026-08-01', tonnes: 0 })).status).toBe(400);
    const w = await call('POST', `/api/harvest-lots/${lotId}/weighings`, { date: '2026-08-01', tonnes: 12.5, notes: 'auto 1' });
    expect(w.status).toBe(200);
    expect(await grainQty(articleId)).toBeCloseTo(12.5, 6);
    const w2 = await call('POST', `/api/harvest-lots/${lotId}/weighings`, { date: '2026-08-02', tonnes: 7.5 });
    expect(await grainQty(articleId)).toBeCloseTo(20, 6);
    expect((await call('DELETE', `/api/harvest-lots/${lotId}/weighings/${w2.json.id}`)).status).toBe(200);
    expect(await grainQty(articleId)).toBeCloseTo(12.5, 6);

    // Kaks koristuskannet (põld A 3 punkrit, põld B 1 punker) ja sulgemine
    await run(async () => {
      for (const [fw, bunkers] of [[s.fieldWorkId, 3], [s.fieldWork2Id, 1]] as const) {
        await prisma.workEntry.create({
          data: {
            fieldWorkId: fw, date: d('2026-08-01'), harvestLotId: lotId, harvestBunkers: bunkers, financeStatus: 'CONFIRMED',
            lines: { create: [{ kind: 'HARVEST', label: 'Saak', quantity: 0, unit: 't' }] }
          }
        });
      }
    });
    const closed = await call('POST', `/api/harvest-lots/${lotId}/close`);
    expect(closed.status).toBe(200);
    expect(closed.json).toMatchObject({ status: 'CLOSED', bunkerTonnes: 3.125, bunkers: 4, entryCount: 2 });
    const blocked = await call('POST', `/api/harvest-lots/${lotId}/weighings`, { date: '2026-08-03', tonnes: 1 });
    expect(blocked.status).toBe(409);
    expect(blocked.json.error).toContain('suletud');
    expect(await grainQty(articleId)).toBeCloseTo(12.5, 6);
  });

  it('teenuse kulu hind artiklist või vaikimisi teenusest; kaubal FIFO hind', async () => {
    const own = await call('POST', `/api/harvest-lots/${lotId}/costs`, { date: '2026-08-02', articleId: s.serviceOwn, quantity: 10 });
    expect(own.status).toBe(200);
    expect(own.json).toMatchObject({ isService: true, unitPrice: 12, total: 120 });
    const dflt = await call('POST', `/api/harvest-lots/${lotId}/costs`, { date: '2026-08-02', articleId: s.serviceDefault, quantity: 2 });
    expect(dflt.json).toMatchObject({ unitPrice: 20, total: 40 });
    const goods = await call('POST', `/api/harvest-lots/${lotId}/costs`, { date: '2026-08-02', articleId: s.gas, quantity: 20 });
    expect(goods.status).toBe(200);
    expect(goods.json).toMatchObject({ isService: false, unitPrice: 1.5, total: 30 });
    expect(await run(async () => (await prisma.articleStock.findMany({ where: { articleId: s.gas } })).reduce((a, r) => a + r.qty, 0))).toBeCloseTo(80, 6);
    expect((await call('POST', `/api/harvest-lots/${lotId}/costs`, { date: '2026-08-02', articleId: s.gas, quantity: 0 })).status).toBe(400);

    const detail = await call('GET', `/api/harvest-lots/${lotId}`);
    expect(detail.json.costs).toHaveLength(3);
    expect(detail.json.entries).toHaveLength(2);
    expect(detail.json.weighings).toHaveLength(1);

    // Kauba kulu kustutamine toob laoseisu tagasi
    expect((await call('DELETE', `/api/harvest-lots/${lotId}/costs/${goods.json.id}`)).status).toBe(200);
    expect(await run(async () => (await prisma.articleStock.findMany({ where: { articleId: s.gas } })).reduce((a, r) => a + r.qty, 0))).toBeCloseTo(100, 6);
  });

  it('finantsaken: kuivatus jaotub põldudele punkrite järgi', async () => {
    // Kulu 120 + 40 = 160; põld A 3/4, põld B 1/4
    const r = await call('GET', '/api/finance/field-results?year=2026');
    expect(r.status).toBe(200);
    const a = r.json.find((x: any) => x.fieldSeasonId === s.fieldSeasonId);
    const b = r.json.find((x: any) => x.fieldSeasonId === s.fieldSeason2Id);
    expect(a.drying).toBe(120);
    expect(a.dryingLots).toEqual([{ name: 'Nisu A', amount: 120 }]);
    expect(b.drying).toBe(40);
    expect(a.costTotal).toBeGreaterThanOrEqual(120);
  });

  it('kandetega partii kustutamine annab 409; kandeta partii kustub koos kuludega', async () => {
    expect((await call('DELETE', `/api/harvest-lots/${lotId}`)).status).toBe(409);
    const tmp = await call('POST', '/api/harvest-lots', { name: 'Tühi', year: 2026, cropId: s.crop, warehouseId: s.main });
    await call('POST', `/api/harvest-lots/${tmp.json.id}/weighings`, { date: '2026-08-01', tonnes: 5 });
    await call('POST', `/api/harvest-lots/${tmp.json.id}/costs`, { date: '2026-08-02', articleId: s.gas, quantity: 10 });
    expect((await call('DELETE', `/api/harvest-lots/${tmp.json.id}`)).status).toBe(200);
    expect(await grainQty(articleId)).toBeCloseTo(12.5, 6);
    expect(await run(async () => (await prisma.articleStock.findMany({ where: { articleId: s.gas } })).reduce((a, r) => a + r.qty, 0))).toBeCloseTo(100, 6);
  });
  it('sisendi kontroll: võimatu kuupäev, hooaeg, puuduv põld ja puuduv partii', async () => {
    const lot = await call('POST', '/api/harvest-lots', { name: 'Kontroll', year: 2026, cropId: s.crop, warehouseId: s.main });
    expect(lot.status).toBe(200);
    const bad = await call('POST', `/api/harvest-lots/${lot.json.id}/weighings`, { date: '2026-02-31', tonnes: 1 });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toBe('Kuupäev on kohustuslik');
    expect((await call('GET', '/api/harvest-lots/open')).status).toBe(400);
    expect((await call('GET', '/api/harvest-lots/open?fieldSeasonId=0')).status).toBe(400);
    expect((await call('GET', '/api/harvest-lots?year=abc')).status).toBe(400);
    const missing = await call('POST', '/api/harvest-lots', { id: 'olematu', name: 'X', warehouseId: s.main });
    expect(missing.status).toBe(404);
    expect(missing.json.error).toBe('Saagipartiid ei leitud');
  });
});
