// Kande tööaja teenused ja kütuse FIFO ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { systemCategoryId } from './articleCategories';
import { setSessionUserForTest } from './authGate';
import { handleFieldWorks } from './fieldWorks';
import { saveStockDocument, getDefaultWarehouseId } from './stock';
import { ensureDefaultServices } from './entryArticles';

const T = `test-tenant-entryfuel-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(`${s}T00:00:00Z`);

const ADMIN = {
  id: `entryfuel-u-${process.pid}`, username: `entryfuel-${process.pid}`, displayName: null, passwordHash: '', isActive: true,
  isAdmin: true, isFinanceManager: true, mustChangePassword: false, tenantId: T
};

async function call(method: string, path: string, body?: unknown) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const req = Object.assign(Readable.from(raw ? [Buffer.from(raw)] : []), {
    method, url: path, headers: { host: 'localhost', 'content-type': 'application/json' }, socket: {}
  }) as unknown as IncomingMessage;
  setSessionUserForTest(req, ADMIN);
  const out = { status: 200, body: '' };
  const res = {
    statusCode: 200,
    setHeader() {}, writeHead(code: number) { out.status = code; },
    end(chunk?: string) { out.body += chunk ?? ''; out.status = (res as any).statusCode; }
  } as unknown as ServerResponse;
  const url = new URL(path, 'http://localhost');
  await run(() => handleFieldWorks(req, res, url.pathname, method, url));
  return { status: out.status, json: out.body ? JSON.parse(out.body) : null };
}

const s = { main: '', tank: '', fuel: '', vehicle: '', fieldWorkId: '' };

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test kütus kandel' } });
  await authDb().user.create({ data: { id: ADMIN.id, username: ADMIN.username, passwordHash: '', isAdmin: true, isFinanceManager: true, tenantId: T } });
  await run(async () => {
    s.main = await tenantTransaction((tx) => getDefaultWarehouseId(tx));
    s.tank = (await prisma.warehouse.create({ data: { name: 'Kütusemahuti' } })).id;
    const fuelCat = await tenantTransaction((tx) => systemCategoryId(tx, 'FUEL'));
    s.fuel = (await prisma.article.create({ data: { name: 'Diislikütus', categoryId: fuelCat, unit: 'l', defaultWarehouseId: s.tank } })).id;
    await tenantTransaction((tx) => saveStockDocument(tx, null, {
      kind: 'RECEIPT', date: d('2026-04-01'), warehouseId: s.tank, toWarehouseId: null, supplierId: null,
      documentNo: null, writeOffReason: null, notes: null, lines: [{ articleId: s.fuel, quantity: 100, amount: 150 }]
    }));
    await tenantTransaction((tx) => ensureDefaultServices(tx));
    await prisma.article.updateMany({ where: { isDefaultService: true, name: 'Töötaja tööaeg' }, data: { price: 20 } });
    s.vehicle = (await prisma.vehicle.create({ data: { name: 'Traktor', type: 'TRACTOR', model: 'X', hourlyRate: 55, fuelArticleId: s.fuel } })).id;
    const field = await prisma.field.create({ data: { num: '1', name: 'Testpõld', fieldCode: 'T-1' } });
    const fs = await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 2, crop: 'test', geometry: {} } });
    const wt = await prisma.workType.create({ data: { name: 'Testkülv', phase: 'SOWING' } });
    s.fieldWorkId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fs.id, workTypeId: wt.id, phase: 'SOWING' } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.vehicle.deleteMany({});
    await prisma.stockDocument.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.warehouse.deleteMany({});
  });
  await authDb().tenant.delete({ where: { id: T } });
});

const lineOf = (e: any, kind: string) => e.lines.find((l: any) => l.kind === kind);

describe('kanne teenuste ja kütusega', () => {
  let entryId = '';
  it('tööaja read saavad hinna, kütus FIFO hinna ja väheneb kütuse laost', async () => {
    const r = await call('POST', '/api/work-entries', {
      fieldWorkId: s.fieldWorkId, date: '2026-05-10', laborHours: 8, vehicleId: s.vehicle, equipmentHours: 6, fuelLiters: 40
    });
    expect(r.status).toBe(200);
    entryId = r.json.id;
    expect(lineOf(r.json, 'LABOR').unitPrice).toBe(20);
    expect(lineOf(r.json, 'MACHINE').unitPrice).toBe(55);
    expect(lineOf(r.json, 'FUEL')).toMatchObject({ articleId: s.fuel, label: 'Diislikütus', unitPrice: 1.5 });
    const stock = await run(() => prisma.articleStock.findMany({ where: { articleId: s.fuel } }));
    expect(stock).toHaveLength(1);
    expect(stock[0]).toMatchObject({ warehouseId: s.tank, qty: 60 });
  });
  it('vaikimisi teenuse hinna muutus ei muuda olemasolevat rida', async () => {
    await run(() => prisma.article.updateMany({ where: { isDefaultService: true, name: 'Töötaja tööaeg' }, data: { price: 30 } }));
    const r = await call('PUT', `/api/work-entries/${entryId}`, {
      date: '2026-05-10', laborHours: 9, vehicleId: s.vehicle, equipmentHours: 6, fuelLiters: 40
    });
    expect(r.status).toBe(200);
    expect(lineOf(r.json, 'LABOR')).toMatchObject({ quantity: 9, unitPrice: 20 });
  });
  it('finantsjuhi käsitsi hind kütusereal ei muutu', async () => {
    const e = await run(() => prisma.workEntryLine.findFirstOrThrow({ where: { entryId, kind: 'FUEL' } }));
    const r = await call('PATCH', `/api/finance/entries/${entryId}`, { prices: { [e.id]: 9 } });
    expect(r.status).toBe(200);
    const after = await run(() => prisma.workEntryLine.findUniqueOrThrow({ where: { id: e.id } }));
    expect(Number(after.unitPrice)).toBe(1.5);
  });
  it('artiklita kütuserida: kinnitamine keelatud põhjusega', async () => {
    await run(() => prisma.vehicle.update({ where: { id: s.vehicle }, data: { fuelArticleId: null } }));
    const fuelCat = await run(() => tenantTransaction((tx) => systemCategoryId(tx, 'FUEL')));
    await run(() => prisma.article.create({ data: { name: 'Bensiin', categoryId: fuelCat, unit: 'l' } }));
    const r = await call('POST', '/api/work-entries', { fieldWorkId: s.fieldWorkId, date: '2026-05-11', fuelLiters: 10, laborHours: 1 });
    expect(lineOf(r.json, 'FUEL').articleId).toBeNull();
    const c = await call('PATCH', `/api/finance/entries/${r.json.id}`, { prices: {}, confirm: true });
    expect(c.status).toBe(400);
    expect(c.json.error).toBe('Kütuse artikkel määramata');
  });
  it('kütuseartikli vaikimisi lao muutus kannab kütuse ümber', async () => {
    const r = await call('POST', '/api/articles', { id: s.fuel, name: 'Diislikütus', categoryId: (await run(() => prisma.article.findUniqueOrThrow({ where: { id: s.fuel } }))).categoryId, unit: 'l', defaultWarehouseId: s.main });
    expect(r.status).toBe(200);
    const stock = await run(() => prisma.articleStock.findMany({ where: { articleId: s.fuel }, orderBy: { qty: 'asc' } }));
    expect(stock.map((x) => [x.warehouseId, x.qty])).toEqual([[s.main, -40], [s.tank, 100]]);
  });
});
