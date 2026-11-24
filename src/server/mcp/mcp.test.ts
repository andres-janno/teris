// MCP otspunkt päris HTTP serveriga (juhuslik port) ja SDK kliendiga; ajutised ettevõtted live-andmebaasis.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { handleMcpRequest, isOAuthDiscoveryPath } from './handler';
import { createTestTenant, type TestTenant } from './testTenant';
import { MCP_INSTRUCTIONS_KEY, saveMcpInstructions, resetMcpInstructions, getMcpInstructionsAdmin, DEFAULT_MCP_INSTRUCTIONS } from './instructions';
import { authDb, prisma, runAsTenant } from '../db';

let server: http.Server;
let base = '';
let A: TestTenant;
let B: TestTenant;
let W: TestTenant;

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
  W = await createTestTenant('w', { modules: ['WEATHER'] });
}, 60_000);

afterAll(async () => {
  await A?.cleanup();
  await B?.cleanup();
  await W?.cleanup();
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
  it('isOAuthDiscoveryPath', () => {
    expect(isOAuthDiscoveryPath('/.well-known/oauth-protected-resource')).toBe(true);
    expect(isOAuthDiscoveryPath('/.well-known/oauth-protected-resource/mcp/x')).toBe(true);
    expect(isOAuthDiscoveryPath('/.well-known/oauth-authorization-server')).toBe(true);
    expect(isOAuthDiscoveryPath('/.well-known/other')).toBe(false);
    expect(isOAuthDiscoveryPath('/mcp')).toBe(false);
  });
  it('GET → 405', async () => {
    const r = await fetch(`${base}/mcp/${A.plainKey}`);
    expect(r.status).toBe(405);
  });
});

describe('server', () => {
  it('juhis ja tööriistade readOnlyHint märge', async () => {
    const client = await connect(A.plainKey);
    expect(client.getInstructions()).toContain('Teris');
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint, t.name).toBe(t.name !== 'create_article');
    }
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
    expect(r.works[0].entries[0].articles[0]).toMatchObject({ name: 'Ammooniumnitraat', quantity: 150, unit: 'kg' });
    expect(r.works[0].entries[0].articles[0].unitPrice).toBeUndefined();
  });
  it('get_field: finantsjuht näeb hinda', async () => {
    const r = (await call(A.financeKey, 'get_field', { field: '4', year: 2026 })).data;
    expect(r.works[0].entries[0].articles[0]).toMatchObject({ unitPrice: 0.45, cost: 67.5 });
  });
  it('get_field: rent ja maamaks ainult finantsjuhile', async () => {
    const plain = (await call(A.plainKey, 'get_field', { field: '4', year: 2026 })).data.cadastralParcels[0];
    expect(plain).toMatchObject({ code: 'T-KAT-1', owner: 'Jaan Tamm', ownership: 'RENTED' });
    expect('rentFeeEurYear' in plain).toBe(false);
    expect('landTaxEurYear' in plain).toBe(false);
    expect('rentFeeEurHa' in plain).toBe(false);
    const fin = (await call(A.financeKey, 'get_field', { field: '4', year: 2026 })).data.cadastralParcels[0];
    expect(fin).toMatchObject({ rentFeeEurYear: 1200, landTaxEurYear: 80 });
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
    expect(r.rows[0].plannedArticles[0]).toMatchObject({ name: 'Ammooniumnitraat', ratePerHa: 200, unit: 'kg' });
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
    expect(r.rows[0]).toMatchObject({ financeStatus: 'PENDING', totalCost: 67.5, unpricedLines: 0 });
  });
  it('summarize_article_usage: põllu kaupa; raha ainult finantsjuhile', async () => {
    const plain = (await call(A.plainKey, 'summarize_article_usage', { year: 2026, groupBy: 'field' })).data;
    expect(plain.rows[0]).toMatchObject({ article: 'Ammooniumnitraat', group: 'Nr 4 Toosi', quantity: 150, unit: 'kg', areaHa: 12.4 });
    expect(plain.rows[0].cost).toBeUndefined();
    const fin = (await call(A.financeKey, 'summarize_article_usage', { year: 2026, groupBy: 'crop' })).data;
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
    expect(r.rows[0].articles[0].unitPrice).toBeUndefined();
  });
});

describe('ladu', () => {
  it('list_stock_levels: kogus kõigile, väärtus ainult finantsjuhile, miinus märgitud', async () => {
    const plain = (await call(A.plainKey, 'list_stock_levels')).data;
    expect(plain.rows[0]).toMatchObject({ warehouse: 'Põhiladu', article: 'Ammooniumnitraat', quantity: -150, unit: 'kg', negative: true });
    expect(plain.rows[0]).toMatchObject({ article: expect.any(String), group: 'CONSUMABLE', category: expect.any(String) });
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
  it('create_stock_inventory: puudub tavakasutajal; finantsjuht saab korrigeerida laoseisu inventuurikandega', async () => {
    const plainClient = await connect(A.plainKey);
    const plainTools = await plainClient.listTools();
    await plainClient.close();
    expect(plainTools.tools.some((t) => t.name === 'create_stock_inventory')).toBe(false);

    const finClient = await connect(A.financeKey);
    const finTools = await finClient.listTools();
    await finClient.close();
    const invTool = finTools.tools.find((t) => t.name === 'create_stock_inventory');
    expect(invTool?.annotations?.readOnlyHint).toBe(false);

    const bad = await call(A.financeKey, 'create_stock_inventory', { items: [{ article: 'Ammooniumnitraat', actualQty: -5 }] });
    expect(bad.isError).toBe(true);

    const created = (await call(A.financeKey, 'create_stock_inventory', {
      warehouse: 'Põhiladu',
      date: '20.05.2026',
      documentNo: 'INV-MCP-1',
      notes: 'MCP kontroll',
      items: [{ article: 'Ammooniumnitraat', actualQty: 500 }]
    })).data;
    expect(created).toMatchObject({ kind: 'INVENTORY', date: '20.05.2026', warehouse: 'Põhiladu', documentNo: 'INV-MCP-1' });
    expect(created.lines[0]).toMatchObject({ article: 'Ammooniumnitraat', countedQty: 500, diffQty: -350 });

    const levels = (await call(A.plainKey, 'list_stock_levels')).data;
    expect(levels.rows[0]).toMatchObject({ article: 'Ammooniumnitraat', quantity: 500, negative: false });
  });
});

describe('ilm', () => {
  it('weather_summary ainult WEATHER mooduliga', async () => {
    const client = await connect(A.plainKey);
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.map((t) => t.name)).not.toContain('weather_summary');
  });
  it('WEATHER mooduliga: tööriist on olemas, majandi vaade ja põllu vaade ilma külvikuupäevata', async () => {
    const client = await connect(W.plainKey);
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.map((t) => t.name)).toContain('weather_summary');
    const farm = (await call(W.plainKey, 'weather_summary', {})).data;
    expect(farm.source).toBe('Copernicus Climate Change Service, ERA5-Land');
    expect(Array.isArray(farm.years)).toBe(true);
    const field = (await call(W.plainKey, 'weather_summary', { field: 'Toosi' })).data;
    expect(field.field).toContain('Toosi');
    expect(field.reason).toBe('NO_SEEDING');
    expect(field.summary).toBeNull();
    expect(field.message).toBe('Hooajal pole külvikuupäeva, ilmakokkuvõtet ei saa arvutada.');
    expect(field.source).toBe('Copernicus Climate Change Service, ERA5-Land');
  });
});

describe('tehnika', () => {
  it('list_vehicles: soetusmaksumus ainult finantsjuhile, asukoht ainult telemeetriaga', async () => {
    const plain = (await call(A.plainKey, 'list_vehicles')).data;
    const v = plain.vehicles.find((x: { name: string }) => x.name === 'Valtra T1');
    expect(v).toMatchObject({ regNumber: '123ABC', lastPosition: { lat: 58.1, lng: 25.5 } });
    expect(v.acquisitionCost).toBeUndefined();
    expect(plain.implements[0]).toMatchObject({ name: 'Amazone ZA', workingWidthM: 24 });
    expect((await call(A.financeKey, 'list_vehicles')).data.vehicles[0].acquisitionCost).toBe(150000);
    const noTelemetry = (await call(B.plainKey, 'list_vehicles')).data.vehicles[0];
    expect(noTelemetry.lastPosition).toBeUndefined();
    expect(noTelemetry.lastActive).toBeUndefined();
  });
  it('get_vehicle_activity: kanded; telemeetriata ettevõttel telemetry puudub', async () => {
    const r = (await call(B.plainKey, 'get_vehicle_activity', { vehicle: '123ABC', from: '01.05.2026', to: '31.05.2026' })).data;
    expect(r.entries[0]).toMatchObject({ date: '10.05.2026', field: 'Nr 4 Toosi', equipmentHours: 3.5 });
    expect(r.telemetry).toBeUndefined();
  });
  it('get_vehicle_activity: üle 31 päeva → viga', async () => {
    const r = await call(A.plainKey, 'get_vehicle_activity', { vehicle: 'Valtra', from: '01.01.2026', to: '31.03.2026' });
    expect(r.isError).toBe(true);
  });
});

describe('juhis AI-le', () => {
  const pu = { id: `test-pu-${process.pid}`, username: 'testplatvorm' };
  let saved: { value: string; updatedBy: string | null } | null = null;
  // Live-andmebaasis võib admin olla päris juhise salvestanud: võta koopia ja taasta see lõpus täpselt.
  beforeAll(async () => {
    saved = await authDb().platformSetting.findUnique({ where: { key: MCP_INSTRUCTIONS_KEY }, select: { value: true, updatedBy: true } });
  });
  afterAll(async () => {
    if (saved) {
      await authDb().platformSetting.upsert({
        where: { key: MCP_INSTRUCTIONS_KEY },
        create: { key: MCP_INSTRUCTIONS_KEY, value: saved.value, updatedBy: saved.updatedBy },
        update: { value: saved.value, updatedBy: saved.updatedBy }
      });
    } else {
      await authDb().platformSetting.deleteMany({ where: { key: MCP_INSTRUCTIONS_KEY } });
    }
    await authDb().platformAuditLog.deleteMany({ where: { platformUserId: pu.id } });
  });
  it('salvestatud juhis jõuab kliendini; taastamine annab vaikejuhise', async () => {
    await resetMcpInstructions(pu);
    expect((await getMcpInstructionsAdmin()).isDefault).toBe(true);
    expect((await saveMcpInstructions('Testjuhis: vasta lühidalt.', pu)).ok).toBe(true);
    const client = await connect(A.plainKey);
    expect(client.getInstructions()).toBe('Testjuhis: vasta lühidalt.');
    await client.close();
    expect((await getMcpInstructionsAdmin()).updatedBy).toBe('testplatvorm');
    await resetMcpInstructions(pu);
    const c2 = await connect(A.plainKey);
    expect(c2.getInstructions()).toBe(DEFAULT_MCP_INSTRUCTIONS);
    await c2.close();
    const actions = (await authDb().platformAuditLog.findMany({ where: { platformUserId: pu.id }, select: { action: true } })).map((l) => l.action);
    expect(actions).toContain('MCP_INSTRUCTIONS_UPDATE');
    expect(actions).toContain('MCP_INSTRUCTIONS_RESET');
  });
  it('liiga pikk või tühi juhis lükatakse tagasi', async () => {
    expect((await saveMcpInstructions('x'.repeat(20001), pu)).ok).toBe(false);
    expect((await saveMcpInstructions('   ', pu)).ok).toBe(false);
  });
});

// Viimane: blokeerib selle IP vigaste võtmete jaoks (moodulitasemel piirang)
describe('piirang', () => {
  it('vigased katsed blokeeritakse, kehtiv võti läbib ikka', async () => {
    const bad = () => fetch(`${base}/mcp/trs_vale${Math.random().toString(36).slice(2)}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await bad()).status);
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[statuses.length - 1]).toBe(429);
    const client = await connect(A.plainKey);
    expect((await client.listTools()).tools.length).toBeGreaterThan(0);
    await client.close();
  });
});

describe('sõitude vahed (MCP)', () => {
  let deviceId = '';
  beforeAll(async () => {
    await runAsTenant(A.tenantId, async () => {
      deviceId = (await prisma.telemetryDevice.create({ data: { imei: `39${String(process.pid).padStart(13, '0')}`.slice(0, 15), model: 'FMC650' } })).id;
      await prisma.deviceAssignment.create({ data: { deviceId, vehicleId: A.ids.vehicleId, startedAt: new Date('2026-10-01T00:00:00Z') } });
      const row = (s: string, e: string) => ({
        deviceId, startedAt: new Date(s), endedAt: new Date(e), status: 'CLOSED' as const,
        startLat: 58, startLng: 26, endLat: 58, endLng: 26, distanceKm: 1, movingMinutes: 10, idleMinutes: 0, pauseCount: 0, pauseMinutes: 0,
        minLat: 58, minLng: 26, maxLat: 58, maxLng: 26, pointCount: 10, computedAt: new Date()
      });
      const t1 = await prisma.vehicleTrip.create({ data: row('2026-10-23T10:00:00Z', '2026-10-23T13:16:00Z') });
      const t2 = await prisma.vehicleTrip.create({ data: row('2026-10-25T11:50:00Z', '2026-10-25T14:00:00Z') });
      const t3 = await prisma.vehicleTrip.create({ data: row('2026-10-26T08:00:00Z', '2026-10-26T09:00:00Z') });
      await prisma.vehicleTripGap.create({ data: {
        deviceId, prevTripId: t1.id, nextTripId: t2.id, startedAt: t1.endedAt, endedAt: t2.startedAt,
        powerLostMinutes: null, silentMinutes: 30, fuelDropPct: null, jumpM: 800, engineHoursGrowth: 1, computedAt: new Date()
      } });
      await prisma.vehicleTripGap.create({ data: {
        deviceId, prevTripId: t2.id, nextTripId: t3.id, startedAt: t2.endedAt, endedAt: t3.startedAt,
        powerLostMinutes: 40, silentMinutes: 10, fuelDropPct: 2, jumpM: 0, engineHoursGrowth: null,
        reviewedAt: new Date('2026-10-27T08:00:00Z'), reviewedBy: 'mari', reviewNote: 'aku vahetus', computedAt: new Date()
      } });
    });
  });
  afterAll(async () => {
    await runAsTenant(A.tenantId, async () => {
      await prisma.vehicleTrip.deleteMany({ where: { deviceId } });
      await prisma.deviceAssignment.deleteMany({ where: { deviceId } });
      await prisma.telemetryDevice.deleteMany({ where: { id: deviceId } });
    });
  });

  it('ainult TELEMETRY mooduliga', async () => {
    const client = await connect(B.plainKey);
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.map((t) => t.name)).not.toContain('list_trip_gaps');
  });

  it('vaikimisi ainult kontrollimata; masin ja märgid', async () => {
    const r = (await call(A.plainKey, 'list_trip_gaps', { from: '01.10.2026', to: '31.10.2026' })).data;
    expect(r.total).toBe(1);
    expect(r.gaps[0]).toMatchObject({
      vehicle: 'Valtra T1', from: '23.10.2026 16:16', to: '25.10.2026 13:50',
      signs: { jumpM: 800, engineHoursGrowth: 1, silentMinutes: 30, powerLostMinutes: null, fuelDropPct: null }, reviewed: false
    });
  });

  it('unreviewedOnly=false annab ka kontrollitud koos selgitusega; masina filter', async () => {
    const r = (await call(A.plainKey, 'list_trip_gaps', { vehicle: 'Valtra', from: '01.10.2026', to: '31.10.2026', unreviewedOnly: false })).data;
    expect(r.total).toBe(2);
    expect(r.gaps[1]).toMatchObject({ reviewed: true, reviewNote: 'aku vahetus', reviewedBy: 'mari' });
  });

  it('list_trips ja list_telemetry_devices ainult TELEMETRY mooduliga', async () => {
    const client = await connect(B.plainKey);
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.map((t) => t.name)).not.toContain('list_trips');
    expect(tools.map((t) => t.name)).not.toContain('list_telemetry_devices');

    const trips = (await call(A.plainKey, 'list_trips', { vehicle: 'Valtra', from: '01.10.2026', to: '31.10.2026' })).data;
    expect(trips.total).toBe(3);
    expect(trips.rows[0]).toMatchObject({ vehicle: 'Valtra T1', distanceKm: 1 });

    const devs = (await call(A.plainKey, 'list_telemetry_devices')).data;
    expect(devs.total).toBeGreaterThanOrEqual(1);
    expect(devs.rows[0]).toMatchObject({ model: 'FMC650' });
    expect(devs.rows[0].assignments[0]).toMatchObject({ vehicle: 'Valtra T1' });
  });
});

describe('registrid ja saagipartiid (MCP)', () => {
  it('list_warehouses, list_articles, list_work_types, list_crops, list_related_parties, list_points_of_interest, list_soil_samples, harvest_lots', async () => {
    const wh = (await call(A.plainKey, 'list_warehouses')).data;
    expect(wh.rows[0]).toMatchObject({ name: 'Põhiladu', isDefault: true });

    const arts = (await call(A.plainKey, 'list_articles', { search: 'Ammoonium' })).data;
    expect(arts.rows[0]).toMatchObject({ name: 'Ammooniumnitraat', group: 'CONSUMABLE', nPct: 34 });
    expect(arts.rows[0].price).toBeUndefined();
    const artsFin = (await call(A.financeKey, 'list_articles', { search: 'Ammoonium' })).data;
    expect('price' in artsFin.rows[0]).toBe(true);

    const createdArt = (await call(A.plainKey, 'create_article', {
      name: 'NPK 15-15-15',
      category: 'Väetis',
      unit: 'kg',
      nPct: 15,
      pPct: 15,
      kPct: 15
    })).data;
    expect(createdArt).toMatchObject({ name: 'NPK 15-15-15', group: 'CONSUMABLE', category: 'Väetis', unit: 'kg', nPct: 15, pPct: 15, kPct: 15 });
    const dupArt = await call(A.plainKey, 'create_article', { name: 'NPK 15-15-15', category: 'Väetis', unit: 'kg' });
    expect(dupArt.isError).toBe(true);

    const wts = (await call(A.plainKey, 'list_work_types')).data;
    expect(wts.workTypes[0]).toMatchObject({ name: 'Väetamine', phase: 'CARE' });

    const crops = (await call(A.plainKey, 'list_crops')).data;
    expect(Array.isArray(crops.rows)).toBe(true);

    const parties = (await call(A.plainKey, 'list_related_parties')).data;
    expect(Array.isArray(parties.rows)).toBe(true);

    const pois = (await call(A.plainKey, 'list_points_of_interest')).data;
    expect(Array.isArray(pois.rows)).toBe(true);

    const samples = (await call(A.plainKey, 'list_soil_samples')).data;
    expect(Array.isArray(samples.rows)).toBe(true);

    const lots = (await call(A.plainKey, 'list_harvest_lots')).data;
    expect(Array.isArray(lots.rows)).toBe(true);
  });
});
