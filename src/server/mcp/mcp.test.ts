// MCP otspunkt päris HTTP serveriga (juhuslik port) ja SDK kliendiga; ajutised ettevõtted live-andmebaasis.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { handleMcpRequest } from './handler';
import { createTestTenant, type TestTenant } from './testTenant';

let server: http.Server;
let base = '';
let A: TestTenant;
let B: TestTenant;

async function connect(key: string): Promise<Client> {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp/${key}`)));
  return client;
}

async function call(key: string, name: string, args: Record<string, unknown> = {}) {
  const client = await connect(key);
  try {
    const r = await client.callTool({ name, arguments: args });
    const textOut = (r.content as { type: string; text: string }[])[0]?.text ?? '';
    return { isError: r.isError === true, text: textOut, data: r.isError ? null : JSON.parse(textOut) };
  } finally {
    await client.close();
  }
}

beforeAll(async () => {
  server = http.createServer((req, res) => void handleMcpRequest(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  A = await createTestTenant('a', { modules: ['TELEMETRY'] });
  B = await createTestTenant('b');
}, 60_000);

afterAll(async () => {
  await A?.cleanup();
  await B?.cleanup();
  await new Promise<void>((r) => server.close(() => r()));
});

describe('autentimine', () => {
  it('vale võti → 401 sama teatega', async () => {
    const r = await fetch(`${base}/mcp/trs_vale`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' });
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: 'Vigane võti' });
  });
  it('vigane %-jada URL-is → 401 sama teatega', async () => {
    const r = await fetch(`${base}/mcp/%E0%A4%A`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' });
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: 'Vigane võti' });
  });
  it('võti päises töötab', async () => {
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${A.plainKey}` } } }));
    const tools = await client.listTools();
    expect(tools.tools.some((t) => t.name === 'whoami')).toBe(true);
    await client.close();
  });
  it('GET → 405', async () => {
    const r = await fetch(`${base}/mcp/${A.plainKey}`);
    expect(r.status).toBe(405);
  });
});

describe('server', () => {
  it('juhis ja ainult lugevad tööriistad', async () => {
    const client = await connect(A.plainKey);
    expect(client.getInstructions()).toContain('Teris');
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) expect(t.annotations?.readOnlyHint, t.name).toBe(true);
    await client.close();
  });
  it('whoami: tavakasutaja vs finantsjuht', async () => {
    expect((await call(A.plainKey, 'whoami')).data).toMatchObject({ user: 'Mari Tavaline', company: 'MCP test a', financeAccess: false, modules: ['TELEMETRY'] });
    expect((await call(A.financeKey, 'whoami')).data.financeAccess).toBe(true);
  });
  it('list_seasons näeb ainult oma ettevõtet', async () => {
    expect((await call(A.plainKey, 'list_seasons')).data).toEqual([{ year: 2026, name: '2026', locked: false }]);
  });
});

describe('põllud', () => {
  it('list_fields: aasta põllud, ümardatud pindala, geomeetriata', async () => {
    const r = (await call(A.plainKey, 'list_fields', { year: 2026 })).data;
    expect(r.total).toBe(1);
    expect(r.rows[0]).toMatchObject({ field: 'Nr 4 Toosi', areaHa: 12.4, crop: 'Talinisu', variety: 'Ada' });
    expect(JSON.stringify(r)).not.toContain('geometry');
  });
  it('get_field: täpne nimi võidab osalist; tööd ja kanded kaasas', async () => {
    const r = (await call(A.plainKey, 'get_field', { field: 'Toosi', year: 2026 })).data;
    expect(r.field).toBe('Nr 4 Toosi');
    expect(r.soilType).toBe('Leostunud liivsavi');
    expect(r.works[0].entries[0].materials[0]).toMatchObject({ name: 'Ammooniumnitraat', quantity: 150, unit: 'kg' });
    expect(r.works[0].entries[0].materials[0].unitPrice).toBeUndefined();
  });
  it('get_field: finantsjuht näeb hinda', async () => {
    const r = (await call(A.financeKey, 'get_field', { field: '4', year: 2026 })).data;
    expect(r.works[0].entries[0].materials[0]).toMatchObject({ unitPrice: 0.45, cost: 67.5 });
  });
  it('get_field: olematu põld → selge viga', async () => {
    const r = await call(A.plainKey, 'get_field', { field: 'Mets', year: 2026 });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('ei leitud');
  });
  it('ettevõte B ei näe ettevõtte A põlde', async () => {
    expect((await call(B.plainKey, 'list_fields', { year: 2026 })).data.total).toBe(1);
    const r = (await call(B.plainKey, 'list_fields', { year: 2026 })).data;
    expect(r.rows.every((x: { field: string }) => x.field === 'Nr 4 Toosi')).toBe(true);
    // B andmestik on samanimeline, aga eraldi: A kanne ei tohi B vastuses olla
    const g = (await call(B.plainKey, 'get_field', { field: '4', year: 2026 })).data;
    expect(g.works.flatMap((w: any) => w.entries)).toHaveLength(1);
  });
});

describe('tööd ja kanded', () => {
  it('list_field_works: plaan koos plaanitud materjaliga', async () => {
    const r = (await call(A.plainKey, 'list_field_works', { year: 2026 })).data;
    expect(r.rows[0]).toMatchObject({ field: 'Nr 4 Toosi', work: 'Väetamine', status: 'DONE', planned: '01.05.2026' });
    expect(r.rows[0].plannedMaterials[0]).toMatchObject({ name: 'Ammooniumnitraat', ratePerHa: 200, unit: 'kg' });
  });
  it('list_work_entries: kuupäevavahemik ja masina filter', async () => {
    const r = (await call(A.plainKey, 'list_work_entries', { from: '01.05.2026', to: '10.05.2026', vehicle: 'Valtra' })).data;
    expect(r.total).toBe(1);
    expect(r.rows[0]).toMatchObject({ date: '10.05.2026', field: 'Nr 4 Toosi', vehicle: 'Valtra T1', equipmentHours: 3.5 });
    expect(r.rows[0].financeStatus).toBeUndefined();
    const none = (await call(A.plainKey, 'list_work_entries', { from: '11.05.2026', to: '31.05.2026' })).data;
    expect(none.total).toBe(0);
  });
  it('list_work_entries: finantsjuht näeb kulu ja staatust', async () => {
    const r = (await call(A.financeKey, 'list_work_entries', { year: 2026 })).data;
    expect(r.rows[0]).toMatchObject({ financeStatus: 'PENDING', totalCost: 67.5 });
  });
  it('summarize_material_usage: põllu kaupa; raha ainult finantsjuhile', async () => {
    const plain = (await call(A.plainKey, 'summarize_material_usage', { year: 2026, groupBy: 'field' })).data;
    expect(plain.rows[0]).toMatchObject({ material: 'Ammooniumnitraat', group: 'Nr 4 Toosi', quantity: 150, unit: 'kg', areaHa: 12.4 });
    expect(plain.rows[0].cost).toBeUndefined();
    const fin = (await call(A.financeKey, 'summarize_material_usage', { year: 2026, groupBy: 'crop' })).data;
    expect(fin.rows[0]).toMatchObject({ group: 'Talinisu', cost: 67.5 });
  });
  it('vigane kuupäev → selge viga', async () => {
    const r = await call(A.plainKey, 'list_work_entries', { from: '31.02.2026' });
    expect(r.isError).toBe(true);
    expect(r.text).toContain('Vigane kuupäev');
  });
  it('põld + vahemik ilma aastata: ei piira jooksva hooajaga', async () => {
    expect((await call(A.plainKey, 'list_work_entries', { field: '4', from: '01.05.2026', to: '31.05.2026' })).data.total).toBe(1);
    const other = await call(A.plainKey, 'list_work_entries', { field: '4', from: '01.05.2025', to: '31.05.2025' });
    expect(other.isError).toBeFalsy();
    expect(other.data.total).toBe(0);
    const w = (await call(A.plainKey, 'list_field_works', { from: '01.04.2026', to: '31.05.2026' })).data;
    expect(w.rows[0].field).toBe('Nr 4 Toosi');
    expect(w.year).toBeNull();
  });
  it('list_work_entries: tavakasutaja ei näe kulu ega hinda', async () => {
    const r = (await call(A.plainKey, 'list_work_entries', { year: 2026 })).data;
    expect(r.rows[0].totalCost).toBeUndefined();
    expect(r.rows[0].materials[0].unitPrice).toBeUndefined();
  });
});

describe('ladu', () => {
  it('list_stock_levels: kogus kõigile, väärtus ainult finantsjuhile, miinus märgitud', async () => {
    const plain = (await call(A.plainKey, 'list_stock_levels')).data;
    expect(plain.rows[0]).toMatchObject({ warehouse: 'Põhiladu', material: 'Ammooniumnitraat', quantity: -150, unit: 'kg', negative: true });
    expect(plain.rows[0].value).toBeUndefined();
    const fin = (await call(A.financeKey, 'list_stock_levels')).data;
    expect(fin.rows[0]).toHaveProperty('value');
  });
  it('list_stock_movements puudub tavakasutajal, finantsjuht näeb liikumisi', async () => {
    const client = await connect(A.plainKey);
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.some((t) => t.name === 'list_stock_movements')).toBe(false);
    const r = (await call(A.financeKey, 'list_stock_movements', { from: '01.01.2026', to: '31.12.2026' })).data;
    expect(r.rows.map((x: { type: string }) => x.type).sort()).toEqual(['FIELD_WORK', 'RECEIPT']);
    expect(r.rows.find((x: { type: string }) => x.type === 'RECEIPT')).toMatchObject({ quantity: 1000, documentNo: 'ARV-1', cost: 450 });
  });
});
