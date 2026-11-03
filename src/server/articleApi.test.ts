// Artiklite API (ümbernimetamine, asendamine, liigi muutmise piirangud, hind, rea sobivus)
// ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { systemCategoryId } from './articleCategories';
import { setSessionUserForTest } from './authGate';
import { handleFieldWorks } from './fieldWorks';

const T = `test-tenant-artapi-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const d = (s: string) => new Date(`${s}T00:00:00Z`);

const ADMIN = {
  id: `artapi-u-${process.pid}`, username: `artapi-${process.pid}`, displayName: null, passwordHash: '', isActive: true,
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

const cat = { machine: '', fuel: '', seed: '', otherConsumable: '', otherService: '' };
let fieldWorkId = '';
let entryId = '';
let fuelId = '';

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test artiklite API' } });
  await run(async () => {
    cat.machine = await tenantTransaction((tx) => systemCategoryId(tx, 'MACHINE_TIME'));
    cat.fuel = await tenantTransaction((tx) => systemCategoryId(tx, 'FUEL'));
    cat.seed = await tenantTransaction((tx) => systemCategoryId(tx, 'SEED'));
    cat.otherConsumable = (await prisma.articleCategory.create({ data: { name: 'Testkulu', group: 'CONSUMABLE' } })).id;
    cat.otherService = (await prisma.articleCategory.create({ data: { name: 'Testteenus', group: 'SERVICE' } })).id;
    fuelId = (await prisma.article.create({ data: { name: 'Diisel', categoryId: cat.fuel, unit: 'l' } })).id;
    const field = await prisma.field.create({ data: { num: '1', name: 'Testpõld', fieldCode: 'T-1' } });
    const fs = await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 2, crop: 'test', geometry: {} } });
    const wt = await prisma.workType.create({ data: { name: 'Testkülv', phase: 'SOWING' } });
    fieldWorkId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fs.id, workTypeId: wt.id, phase: 'SOWING' } })).id;
    entryId = (await prisma.workEntry.create({ data: { fieldWorkId, date: d('2026-05-10') } })).id;
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
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

const addEntryLine = (data: { kind: any; articleId: string; label: string; unit: string }) =>
  run(() => prisma.workEntryLine.create({ data: { entryId, quantity: 1, ...data } }));

describe('artikli ümbernimetamine', () => {
  it('muudab nime ainult materjali- ja kütuseridadel', async () => {
    const fuelLine = await addEntryLine({ kind: 'FUEL', articleId: fuelId, label: 'Diisel', unit: 'l' });
    const machineLine = await addEntryLine({ kind: 'MACHINE', articleId: fuelId, label: 'Traktor', unit: 'h' });
    const r = await call('POST', '/api/articles', { id: fuelId, name: 'Diislikütus', categoryId: cat.fuel, unit: 'l' });
    expect(r.status).toBe(200);
    const [f, m] = await run(() => Promise.all([
      prisma.workEntryLine.findUnique({ where: { id: fuelLine.id } }),
      prisma.workEntryLine.findUnique({ where: { id: machineLine.id } })
    ]));
    expect(f?.label).toBe('Diislikütus');
    expect(m?.label).toBe('Traktor');
    await run(() => prisma.workEntryLine.deleteMany({ where: { id: { in: [fuelLine.id, machineLine.id] } } }));
  });
});

describe('artikli asendamine', () => {
  it('viib kõik read üle, nimi muutub ainult materjaliridadel; hind, kultuur ja ladu kanduvad üle', async () => {
    const [src, tgt] = await run(() => Promise.all([
      prisma.article.create({ data: { name: 'Masin A', categoryId: cat.machine, unit: 'h', price: 40 } }),
      prisma.article.create({ data: { name: 'Masin B', categoryId: cat.machine, unit: 'h' } })
    ]));
    const line = await addEntryLine({ kind: 'MACHINE', articleId: src.id, label: 'Traktor', unit: 'h' });
    const r = await call('POST', `/api/articles/${src.id}/merge`, { targetId: tgt.id });
    expect(r.status).toBe(200);
    const [l, t] = await run(() => Promise.all([
      prisma.workEntryLine.findUnique({ where: { id: line.id } }),
      prisma.article.findUnique({ where: { id: tgt.id } })
    ]));
    expect(l?.articleId).toBe(tgt.id);
    expect(l?.label).toBe('Traktor');
    expect(Number(t?.price)).toBe(40);
    await run(() => prisma.workEntryLine.delete({ where: { id: line.id } }));
  });
});

describe('teenuse ja kauba vahetus', () => {
  it('kulumaterjalina kasutatavat kaupa ei saa teenuseks muuta', async () => {
    const a = await run(() => prisma.article.create({ data: { name: 'Muu kulu', categoryId: cat.otherConsumable, unit: 'kg' } }));
    await run(() => prisma.fieldWorkLine.create({ data: { fieldWorkId, kind: 'MATERIAL', articleId: a.id, label: 'Muu kulu', unit: 'kg' } }));
    const r = await call('POST', '/api/articles', { id: a.id, name: 'Muu kulu', categoryId: cat.otherService, unit: 'kg' });
    expect(r.status).toBe(409);
    expect(r.json.error).toBe('Artikkel on kasutusel kulumaterjalina, seda ei saa teenuseks muuta');
  });
  it('tööaja ridadel kasutatavat teenust ei saa kaubaks muuta', async () => {
    const a = await run(() => prisma.article.create({ data: { name: 'Muu teenus', categoryId: cat.otherService, unit: 'h' } }));
    await addEntryLine({ kind: 'LABOR', articleId: a.id, label: 'Tööaeg', unit: 'h' });
    const r = await call('POST', '/api/articles', { id: a.id, name: 'Muu teenus', categoryId: cat.otherConsumable, unit: 'h' });
    expect(r.status).toBe(409);
    expect(r.json.error).toBe('Teenus on kasutusel tööaja ridadel, seda ei saa kaubaks muuta');
  });
});

describe('artikli hind', () => {
  it('negatiivne või liiga suur hind → 400', async () => {
    for (const price of [-1, 100000000]) {
      const r = await call('POST', '/api/articles', { name: `Hinnatest ${price}`, categoryId: cat.machine, unit: 'h', price });
      expect(r.status).toBe(400);
      expect(r.json.error).toBe('Hind peab olema 0 või suurem');
    }
    expect((await call('POST', '/api/articles', { name: 'Hinnatest 0', categoryId: cat.machine, unit: 'h', price: 0 })).status).toBe(200);
  });
});

describe('artikli sobivus reale', () => {
  it('kütust ei saa panna kande materjalireale', async () => {
    const r = await call('POST', '/api/work-entries', { fieldWorkId, date: '2026-05-11', articles: [{ articleId: fuelId, quantity: 5 }] });
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/^Artikkel „.+“ ei sobi sellele reale$/);
  });
  it('kütust ei saa panna plaani materjalireale, seemet saab', async () => {
    const bad = await call('PATCH', `/api/field-works/${fieldWorkId}`, { lines: [{ kind: 'MATERIAL', articleId: fuelId, label: 'Diisel', unit: 'l' }] });
    expect(bad.status).toBe(400);
    const seed = await run(() => prisma.article.create({ data: { name: 'Testseeme', categoryId: cat.seed, unit: 'kg' } }));
    const ok = await call('PATCH', `/api/field-works/${fieldWorkId}`, { lines: [{ kind: 'MATERIAL', articleId: seed.id, label: 'Testseeme', unit: 'kg' }] });
    expect(ok.status).toBe(200);
  });
});

describe('vaikimisi teenus', () => {
  const defaultId = async () => (await run(() => prisma.article.findFirstOrThrow({ where: { isDefaultService: true, category: { systemKind: 'MACHINE_TIME' } } }))).id;

  it('artiklite loend loob vaikimisi teenused ja näitab märget', async () => {
    const r = await call('GET', '/api/articles');
    expect(r.json.filter((a: any) => a.isDefaultService).map((a: any) => a.name).sort())
      .toEqual(['Haakeriista tööaeg', 'Kuivatamise tööaeg', 'Masina tööaeg', 'Töötaja tööaeg']);
  });
  it('vaikimisi teenust ei saa kustutada', async () => {
    const r = await call('DELETE', `/api/articles/${await defaultId()}`);
    expect(r.status).toBe(409);
    expect(r.json.error).toBe('Vaikimisi teenust ei saa kustutada');
  });
  it('vaikimisi teenust ei saa mitteaktiivseks muuta ega märget eemaldada', async () => {
    const id = await defaultId();
    const off = await call('POST', '/api/articles', { id, name: 'Masina tööaeg', categoryId: cat.machine, unit: 'h', isActive: false, isDefaultService: true });
    expect(off.status).toBe(400);
    expect(off.json.error).toBe('Vaikimisi teenust ei saa teise gruppi viia ega mitteaktiivseks muuta');
    const unflag = await call('POST', '/api/articles', { id, name: 'Masina tööaeg', categoryId: cat.machine, unit: 'h', isDefaultService: false });
    expect(unflag.status).toBe(200);
    expect(unflag.json.isDefaultService).toBe(true);
  });
  it('teise teenuse märkimine vaikimisi teenuseks võtab märke vanalt', async () => {
    const old = await defaultId();
    const r = await call('POST', '/api/articles', { name: 'Masinatund 2026', categoryId: cat.machine, unit: 'h', isDefaultService: true });
    expect(r.status).toBe(200);
    expect(r.json.isDefaultService).toBe(true);
    const prev = await run(() => prisma.article.findUniqueOrThrow({ where: { id: old } }));
    expect(prev.isDefaultService).toBe(false);
  });
  it('mitte-tööaja liigi artikkel ei saa vaikimisi teenuseks', async () => {
    const r = await call('POST', '/api/articles', { name: 'Konsultatsioon', categoryId: cat.otherService, unit: 'h', isDefaultService: true });
    expect(r.status).toBe(200);
    expect(r.json.isDefaultService).toBe(false);
  });
  it('asendamine viib masina teenuse ja vaikimisi märke sihtartiklile', async () => {
    const source = await defaultId();
    const target = (await run(() => prisma.article.create({ data: { name: 'Masinatund uus', categoryId: cat.machine, unit: 'h' } }))).id;
    const v = await run(() => prisma.vehicle.create({ data: { name: 'T', type: 'TRACTOR', model: 'X', serviceArticleId: source } }));
    const r = await call('POST', `/api/articles/${source}/merge`, { targetId: target });
    expect(r.status).toBe(200);
    expect((await run(() => prisma.vehicle.findUniqueOrThrow({ where: { id: v.id } }))).serviceArticleId).toBe(target);
    expect((await run(() => prisma.article.findUniqueOrThrow({ where: { id: target } }))).isDefaultService).toBe(true);
    await run(() => prisma.vehicle.delete({ where: { id: v.id } }));
  });
});
