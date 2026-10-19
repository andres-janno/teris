// src/server/landing/interestAdmin.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { authDb } from '../db.ts';
import { listInterest, parseInterestPatch, updateInterest, deleteInterest } from './interestAdmin.ts';

const EMAIL = `test-ia-${process.pid}@example.com`;
let platformUserId = '';

afterAll(async () => {
  await authDb().interestRequest.deleteMany({ where: { email: EMAIL } });
  await authDb().platformAuditLog.deleteMany({ where: { platformUserId, action: { in: ['INTEREST_UPDATE', 'INTEREST_DELETE'] } } });
  if (platformUserId) await authDb().platformUser.delete({ where: { id: platformUserId } });
});

describe('parseInterestPatch', () => {
  it('lubab ainult staatuse ja märkmed', () => {
    expect(parseInterestPatch({ status: 'CONTACTED' })).toEqual({ ok: true, data: { status: 'CONTACTED' } });
    expect(parseInterestPatch({ notes: '  helistan reedel ' })).toEqual({ ok: true, data: { notes: 'helistan reedel' } });
    expect(parseInterestPatch({ notes: '' })).toEqual({ ok: true, data: { notes: null } });
    expect(parseInterestPatch({ status: 'X' })).toEqual({ ok: false, error: 'Tundmatu staatus' });
    expect(parseInterestPatch({ notes: 'x'.repeat(4001) })).toEqual({ ok: false, error: 'Märkmed on liiga pikad (kuni 4000 märki)' });
    expect(parseInterestPatch({})).toEqual({ ok: false, error: 'Muudatus puudub' });
  });
});

describe('huviliste haldus', () => {
  it('nimekiri, staatuse muutus (closedAt), audit, kustutamine', async () => {
    platformUserId = (await authDb().platformUser.create({ data: { username: `test-ia-${process.pid}`, passwordHash: 'x', totpSecretEnc: 'x' } })).id;
    const row = await authDb().interestRequest.create({ data: { name: 'Test', email: EMAIL } });
    expect((await listInterest('NEW')).some((r) => r.id === row.id)).toBe(true);

    const closed = await updateInterest(row.id, { status: 'CLOSED' }, platformUserId);
    expect(closed?.status).toBe('CLOSED');
    expect(closed?.closedAt).not.toBeNull();
    const reopened = await updateInterest(row.id, { status: 'CONTACTED' }, platformUserId);
    expect(reopened?.closedAt).toBeNull();
    expect(await updateInterest('missing', { status: 'NEW' }, platformUserId)).toBeNull();

    expect(await deleteInterest(row.id, platformUserId)).toBe(true);
    expect(await deleteInterest(row.id, platformUserId)).toBe(false);
    const audit = await authDb().platformAuditLog.findMany({ where: { platformUserId } });
    expect(audit.map((a) => a.action).sort()).toEqual(['INTEREST_DELETE', 'INTEREST_UPDATE', 'INTEREST_UPDATE']);
    expect(JSON.stringify(audit)).not.toContain(EMAIL);
  });
});
