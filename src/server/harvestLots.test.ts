// Saagipartiid ajutises ettevõttes (live-andmebaas); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, authDb, runAsTenant, tenantTransaction } from './db';
import { applyEntryHarvest, closeLot, reopenLot, HarvestLotError, NO_CROP_ERROR } from './harvestLots';
import { buildEntryLines } from './fieldWorkRules';

const T = `test-tenant-harvestlot-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const tx = <R>(fn: (t: any) => Promise<R>) => run(() => tenantTransaction(fn));
const d = (s: string) => new Date(`${s}T00:00:00Z`);
let fsId = 0;
let fsNoCrop = 0;
let fwId = '';
const draft = () => buildEntryLines({ harvest: { tonnes: null, ratePerHa: null, priaKind: null, priaSpec: null, withBunkers: true } });
const input = (p: Partial<Parameters<typeof applyEntryHarvest>[2]> = {}) => ({ fieldSeasonId: fsId, areaHa: null, fieldAreaHa: 10, bunkers: 4, manual: false, requestedLotId: null, old: null, ...p });
// Kanne partiis: punkrid või käsitsi tonnid
const entry = (lotId: string, bunkers: number | null, manual = false, tonnes = 0, financeStatus: 'PENDING' | 'CONFIRMED' = 'PENDING') => run(() => prisma.workEntry.create({
  data: { fieldWorkId: fwId, date: d('2026-08-01'), harvestLotId: lotId, harvestBunkers: bunkers, harvestTonnesManual: manual, financeStatus,
    lines: { create: [{ kind: 'HARVEST', label: 'Saak', quantity: tonnes, unit: 't', confirmedQuantity: financeStatus === 'CONFIRMED' ? tonnes : null }] } },
  include: { lines: true }
}));

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test saagipartii' } });
  await run(async () => {
    await prisma.crop.create({ data: { id: `crop-${T}`, name: 'Talinisu' } });
    const field = await prisma.field.create({ data: { num: '1', name: 'Testpõld', fieldCode: 'H-1' } });
    fsId = (await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 10, crop: 'Talinisu allakülvita', geometry: {} } })).id;
    const field2 = await prisma.field.create({ data: { num: '2', name: 'Kultuurita', fieldCode: 'H-2' } });
    fsNoCrop = (await prisma.fieldSeason.create({ data: { fieldId: field2.id, year: 2026, areaHa: 5, crop: 'Määramata', geometry: {} } })).id;
    const wt = await prisma.workType.create({ data: { name: 'Testkoristus', phase: 'HARVEST' } });
    fwId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fsId, workTypeId: wt.id, phase: 'HARVEST' } })).id;
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
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.crop.deleteMany({});
    await prisma.season.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

describe('saagipartii', () => {
  let lotId = '';
  it('esimene koristuskanne loob partii ja teraartikli; saagirida kaalumata', async () => {
    const drafts = draft();
    lotId = (await tx((t) => applyEntryHarvest(t, drafts, input())))!;
    const lot = await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: lotId }, include: { article: { include: { category: true } } } }));
    expect(lot.name).toBe('Talinisu 2026');
    expect(lot.article.name).toBe('Talinisu terad');
    expect(lot.article.unit).toBe('t');
    expect(lot.article.category.systemKind).toBe('GRAIN');
    expect(drafts[0].quantity).toBe(0);
    expect(await tx((t) => applyEntryHarvest(t, draft(), input()))).toBe(lotId);
  });

  it('kultuurita põllul ilma käsitsi tonnideta viga; käsitsi lubatud partiita', async () => {
    await expect(tx((t) => applyEntryHarvest(t, draft(), input({ fieldSeasonId: fsNoCrop })))).rejects.toThrow(NO_CROP_ERROR);
    expect(await tx((t) => applyEntryHarvest(t, draft(), input({ fieldSeasonId: fsNoCrop, manual: true })))).toBeNull();
  });

  it('sulgemine arvutab punkri kaalu ja kannete tonnid; kinnitatud kanne → CHANGED', async () => {
    const a = await entry(lotId, 4, false, 0, 'CONFIRMED');
    const b = await entry(lotId, 6);
    const c = await entry(lotId, 2, true, 5);
    await run(() => prisma.harvestLotWeighing.createMany({ data: [{ lotId, date: d('2026-08-02'), tonnes: 20 }, { lotId, date: d('2026-08-03'), tonnes: 10 }] }));
    await tx((t) => closeLot(t, lotId));
    const lot = await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: lotId } }));
    expect(lot.status).toBe('CLOSED');
    expect(lot.bunkerTonnes).toBe(2.5);
    const line = (id: string) => run(() => prisma.workEntryLine.findFirstOrThrow({ where: { entryId: id, kind: 'HARVEST' } }));
    expect((await line(a.id)).quantity).toBe(10);
    expect((await line(a.id)).ratePerHa).toBe(1);
    expect((await line(b.id)).quantity).toBe(15);
    expect((await line(c.id)).quantity).toBe(5);
    expect((await run(() => prisma.workEntry.findUniqueOrThrow({ where: { id: a.id } }))).financeStatus).toBe('CHANGED');
  });

  it('suletud partiisse uut kannet ei lisata; muutmata kanne salvestub suletud partii tonnidega', async () => {
    await expect(tx((t) => applyEntryHarvest(t, draft(), input({ requestedLotId: lotId })))).rejects.toThrow('Partii „Talinisu 2026“ on suletud — ava partii uuesti');
    const drafts = draft();
    const old = { harvestLotId: lotId, harvestBunkers: 6, harvestTonnesManual: false, harvestTonnes: 15 };
    expect(await tx((t) => applyEntryHarvest(t, drafts, input({ bunkers: 6, old })))).toBe(lotId);
    expect(drafts[0].quantity).toBe(15);
    await expect(tx((t) => applyEntryHarvest(t, draft(), input({ bunkers: 7, old })))).rejects.toBeInstanceOf(HarvestLotError);
  });

  it('uuesti avamine tühjendab punkri kaalu, tonnid jäävad', async () => {
    await tx((t) => reopenLot(t, lotId));
    const lot = await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: lotId } }));
    expect(lot.status).toBe('OPEN');
    expect(lot.bunkerTonnes).toBeNull();
    const lines = await run(() => prisma.workEntryLine.findMany({ where: { kind: 'HARVEST', entry: { harvestLotId: lotId } }, select: { quantity: true } }));
    expect(lines.map((l) => l.quantity).sort((x, y) => x - y)).toEqual([5, 10, 15]);
  });

  it('punkriteta partii sulgemine keelatakse', async () => {
    const base = await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: lotId } }));
    const empty = await run(() => prisma.harvestLot.create({ data: { name: 'Tühi', seasonId: base.seasonId, cropId: base.cropId, articleId: base.articleId, warehouseId: base.warehouseId } }));
    await expect(tx((t) => closeLot(t, empty.id))).rejects.toThrow('Partiis pole punkritega kandeid, mille tonne arvutada');
    await run(() => prisma.harvestLot.delete({ where: { id: empty.id } })); // muidu oleks see järgmises testis viimane lahtine partii
  });

  it('suletud ainsa partii korral saab uus partiita kanne uue partii', async () => {
    await tx((t) => closeLot(t, lotId)); // kanded a, b, c ja kaalumised on alles
    const next = await tx((t) => applyEntryHarvest(t, draft(), input()));
    expect(next).not.toBe(lotId);
    expect((await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: next! } }))).name).toBe('Talinisu 2026 2');
  });
  it('käsitsi lukustatud kanne partiita: tonnid jäävad ja partiid ei looda', async () => {
    const lotsBefore = await run(() => prisma.harvestLot.count());
    const drafts = buildEntryLines({ harvest: { tonnes: 48, ratePerHa: null, priaKind: null, priaSpec: null, withBunkers: false } });
    const old = { harvestLotId: null, harvestBunkers: null, harvestTonnesManual: true, harvestTonnes: 48 };
    const got = await tx((t) => applyEntryHarvest(t, drafts, input({ fieldSeasonId: fsNoCrop, bunkers: null, manual: true, old })));
    expect(got).toBeNull();
    expect(drafts[0].quantity).toBe(48);
    expect(await run(() => prisma.harvestLot.count())).toBe(lotsBefore);
  });

  it('uuesti avatud partii: muutmata lukustamata kanne säilitab tonnid, muudetud punkrid nullivad', async () => {
    await tx((t) => reopenLot(t, lotId));
    const old = { harvestLotId: lotId, harvestBunkers: 6, harvestTonnesManual: false, harvestTonnes: 15 };
    const same = draft();
    expect(await tx((t) => applyEntryHarvest(t, same, input({ bunkers: 6, old })))).toBe(lotId);
    expect(same[0].quantity).toBe(15);
    expect(same[0].ratePerHa).toBe(1.5);
    const changed = draft();
    await tx((t) => applyEntryHarvest(t, changed, input({ bunkers: 7, old })));
    expect(changed[0].quantity).toBe(0);
  });

  it('teise kultuuri partiid ei saa valida', async () => {
    const base = await run(() => prisma.harvestLot.findUniqueOrThrow({ where: { id: lotId } }));
    const crop2 = await run(() => prisma.crop.create({ data: { id: `crop2-${T}`, name: 'Oder' } }));
    const other = await run(() => prisma.harvestLot.create({ data: { name: 'Oder 2026', seasonId: base.seasonId, cropId: crop2.id, articleId: base.articleId, warehouseId: base.warehouseId } }));
    await expect(tx((t) => applyEntryHarvest(t, draft(), input({ requestedLotId: other.id })))).rejects.toThrow('Valitud partii ei ole selle põllu hooaja ja kultuuri partii');
  });
  it('lukustatud partiita kanne jääb muutmisel partiita ka tuntud kultuuriga põllul', async () => {
    const lotsBefore = await run(() => prisma.harvestLot.count());
    const drafts = buildEntryLines({ harvest: { tonnes: 48, ratePerHa: null, priaKind: null, priaSpec: null, withBunkers: false } });
    const old = { harvestLotId: null, harvestBunkers: null, harvestTonnesManual: true, harvestTonnes: 48 };
    expect(await tx((t) => applyEntryHarvest(t, drafts, input({ bunkers: null, manual: true, old })))).toBeNull();
    expect(drafts[0].quantity).toBe(48);
    expect(await run(() => prisma.harvestLot.count())).toBe(lotsBefore);
  });
});
