// API-võtmed: loomine, piirang, kehtivus ja omaniku piir (live-andmebaas, ajutine ettevõte).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authDb } from './db';
import { generateApiKey, findActiveApiKey, createApiKey, listApiKeys, revokeApiKey, touchApiKey, MAX_ACTIVE_KEYS } from './apiKeys';

const T = `test-apikey-tenant-${process.pid}`;
const U = `test-apikey-user-${process.pid}`;
const U2 = `test-apikey-user2-${process.pid}`;

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Võtmetest', status: 'ACTIVE' } });
  await authDb().user.createMany({ data: [
    { id: U, username: U, passwordHash: 'x', tenantId: T },
    { id: U2, username: U2, passwordHash: 'x', tenantId: T }
  ] });
});

afterAll(async () => {
  await authDb().apiKey.deleteMany({ where: { userId: { in: [U, U2] } } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().user.deleteMany({ where: { id: { in: [U, U2] } } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().tenant.deleteMany({ where: { id: T } }).catch((e) => console.error('Testi puhastus', e));
});

describe('generateApiKey', () => {
  it('on trs_ eesliitega, base64url ja juhuslik', () => {
    const a = generateApiKey();
    expect(a).toMatch(/^trs_[A-Za-z0-9_-]{43}$/);
    expect(generateApiKey()).not.toBe(a);
  });
});

describe('võtme elutsükkel', () => {
  it('loodud võti kehtib, loendis on ainult prefiks', async () => {
    const r = await createApiKey(U, '  Sülearvuti  ');
    if (!r.ok) throw new Error(r.error);
    expect(r.url).toMatch(/\/mcp\/trs_/);
    expect(r.row.name).toBe('Sülearvuti');
    expect(r.row.keyPrefix).toBe(r.key.slice(0, 10));
    const found = await findActiveApiKey(r.key);
    expect(found?.user.id).toBe(U);
    expect(found?.user.tenantId).toBe(T);
    const rows = await listApiKeys(U);
    expect(JSON.stringify(rows)).not.toContain(r.key);
  });

  it('tühi nimi lükatakse tagasi', async () => {
    const r = await createApiKey(U, '   ');
    expect(r.ok).toBe(false);
  });

  it('tühistatud võti ei kehti; teise kasutaja võtit ei saa tühistada', async () => {
    const r = await createApiKey(U, 'Tühistatav');
    if (!r.ok) throw new Error(r.error);
    expect(await revokeApiKey(U2, r.row.id)).toBe(false);
    expect(await findActiveApiKey(r.key)).not.toBeNull();
    expect(await revokeApiKey(U, r.row.id)).toBe(true);
    expect(await findActiveApiKey(r.key)).toBeNull();
    expect((await listApiKeys(U)).some((k) => k.id === r.row.id)).toBe(false);
  });

  it('mitteaktiivne kasutaja, parooli sundvahetus ja peatatud ettevõte → võti ei kehti', async () => {
    const r = await createApiKey(U2, 'Kontroll');
    if (!r.ok) throw new Error(r.error);
    await authDb().user.update({ where: { id: U2 }, data: { isActive: false } });
    expect(await findActiveApiKey(r.key)).toBeNull();
    await authDb().user.update({ where: { id: U2 }, data: { isActive: true, mustChangePassword: true } });
    expect(await findActiveApiKey(r.key)).toBeNull();
    await authDb().user.update({ where: { id: U2 }, data: { mustChangePassword: false } });
    await authDb().tenant.update({ where: { id: T }, data: { status: 'SUSPENDED' } });
    expect(await findActiveApiKey(r.key)).toBeNull();
    await authDb().tenant.update({ where: { id: T }, data: { status: 'ACTIVE' } });
    expect(await findActiveApiKey(r.key)).not.toBeNull();
  });

  it('tundmatu või vigase kujuga võti ei kehti', async () => {
    expect(await findActiveApiKey('trs_olematu')).toBeNull();
    expect(await findActiveApiKey('')).toBeNull();
  });

  it(`kuni ${MAX_ACTIVE_KEYS} aktiivset võtit`, async () => {
    await authDb().apiKey.deleteMany({ where: { userId: U } });
    for (let i = 0; i < MAX_ACTIVE_KEYS; i++) expect((await createApiKey(U, `Võti ${i}`)).ok).toBe(true);
    const over = await createApiKey(U, 'Liigne');
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.status).toBe(400);
  });

  it('touchApiKey uuendab kuni kord 5 minuti jooksul', async () => {
    const r = await createApiKey(U2, 'Puudutus');
    if (!r.ok) throw new Error(r.error);
    const t0 = new Date('2026-10-31T10:00:00Z');
    await touchApiKey(r.row.id, null, t0);
    await touchApiKey(r.row.id, t0, new Date('2026-10-31T10:03:00Z'));
    expect((await authDb().apiKey.findUnique({ where: { id: r.row.id } }))?.lastUsedAt?.toISOString()).toBe(t0.toISOString());
    await touchApiKey(r.row.id, t0, new Date('2026-10-31T10:06:00Z'));
    expect((await authDb().apiKey.findUnique({ where: { id: r.row.id } }))?.lastUsedAt?.toISOString()).toBe('2026-10-31T10:06:00.000Z');
  });
});
