// Sessiooni kehtivus: peatatud või puuduva ettevõtte kasutaja sessioon ei kehti.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { authDb } from './db';
import { findActiveSession } from './authGate';
import { hashToken } from './auth';

const T = `test-sess-tenant-${process.pid}`;
const U = `test-sess-user-${process.pid}`;
const TOKEN = hashToken(`test-sess-token-${process.pid}`);

beforeAll(async () => {
  await authDb().tenant.create({ data: { id: T, name: 'Sessioonitest', status: 'ACTIVE' } });
  await authDb().user.create({ data: { id: U, username: U, passwordHash: 'x', tenantId: T } });
  await authDb().session.create({ data: { userId: U, tokenHash: TOKEN, expiresAt: new Date(Date.now() + 3600_000) } });
});

afterAll(async () => {
  await authDb().session.deleteMany({ where: { userId: U } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().user.deleteMany({ where: { id: U } }).catch((e) => console.error('Testi puhastus', e));
  await authDb().tenant.deleteMany({ where: { id: T } }).catch((e) => console.error('Testi puhastus', e));
});

describe('findActiveSession', () => {
  it('aktiivse ettevõtte sessioon kehtib', async () => {
    const s = await findActiveSession(TOKEN);
    expect(s?.user.id).toBe(U);
    expect(s?.user.tenantId).toBe(T);
  });
  it('peatatud ettevõtte sessioon ei kehti', async () => {
    await authDb().tenant.update({ where: { id: T }, data: { status: 'SUSPENDED' } });
    expect(await findActiveSession(TOKEN)).toBeNull();
    await authDb().tenant.update({ where: { id: T }, data: { status: 'ACTIVE' } });
  });
  it('tundmatu token ei kehti', async () => {
    expect(await findActiveSession(hashToken('olematu'))).toBeNull();
  });
});
