// Kande salvestuse lukustuse lahendus (live-andmebaas, ajutine ettevõte); kustutatakse testi lõpus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Readable } from 'stream';
import type { IncomingMessage, ServerResponse } from 'http';
import { prisma, authDb, runAsTenant } from './db';
import { setSessionUserForTest } from './authGate';
import { handleFieldWorks } from './fieldWorks';

const T = `test-tenant-harvestapi-${process.pid}`;
const run = <R>(fn: () => Promise<R>): Promise<R> => runAsTenant(T, async () => await fn());
const ADMIN = {
  id: `harvestapi-u-${process.pid}`, username: `harvestapi-${process.pid}`, displayName: null, passwordHash: '', isActive: true,
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

let fieldWorkId = '';

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Test saagi API' } });
  await authDb().user.create({ data: { id: ADMIN.id, username: ADMIN.username, passwordHash: '', isAdmin: true, isFinanceManager: true, tenantId: T } });
  await run(async () => {
    const field = await prisma.field.create({ data: { num: '1', name: 'Kultuurita', fieldCode: 'A-1' } });
    const fs = await prisma.fieldSeason.create({ data: { fieldId: field.id, year: 2026, areaHa: 10, crop: 'Määramata', geometry: {} } });
    const wt = await prisma.workType.create({ data: { name: 'Testkoristus', phase: 'HARVEST' } });
    fieldWorkId = (await prisma.fieldWork.create({ data: { fieldSeasonId: fs.id, workTypeId: wt.id, phase: 'HARVEST' } })).id;
  });
});

afterAll(async () => {
  await run(async () => {
    await prisma.workEntry.deleteMany({});
    await prisma.fieldWork.deleteMany({});
    await prisma.workType.deleteMany({});
    await prisma.fieldSeason.deleteMany({});
    await prisma.field.deleteMany({});
    await prisma.articleStock.deleteMany({});
    await prisma.article.deleteMany({});
    await prisma.articleCategory.deleteMany({});
    await prisma.season.deleteMany({});
    await prisma.warehouse.deleteMany({});
  }).catch((e) => console.error('Testi puhastus ebaõnnestus', e));
  await authDb().user.deleteMany({ where: { id: ADMIN.id } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().tenant.deleteMany({ where: { id: T } });
});

describe('kande lukustus puudub päringust', () => {
  it('POST käsitsi tonnidega lukustab; PUT ilma lukustuseta jätab tonnid ja lukustuse', async () => {
    const r = await call('POST', '/api/work-entries', { fieldWorkId, date: '2026-08-01', harvest: { tonnes: 48 } });
    expect(r.status).toBe(200);
    expect(r.json.harvestTonnesManual).toBe(true);
    expect(r.json.harvestTonnes).toBe(48);
    const u = await call('PUT', `/api/work-entries/${r.json.id}`, { date: '2026-08-01', harvest: { tonnes: 48 }, notes: 'muudetud' });
    expect(u.status).toBe(200);
    expect(u.json.harvestTonnesManual).toBe(true);
    expect(u.json.harvestTonnes).toBe(48);
    expect(u.json.harvestLotId).toBeNull();
  });
});
