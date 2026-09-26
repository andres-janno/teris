import { describe, it, expect } from 'vitest';
import { normalizeUsername, checkAdminChange } from './adminRules';

describe('normalizeUsername', () => {
  it('trimmib ja teeb väiketähtedeks', () => {
    expect(normalizeUsername('  Mari.Maasikas ')).toBe('mari.maasikas');
    expect(normalizeUsername('a_b-c9')).toBe('a_b-c9');
  });
  it('lükkab tagasi tühja, liiga pika ja keelatud märgid', () => {
    expect(normalizeUsername('')).toBeNull();
    expect(normalizeUsername(undefined)).toBeNull();
    expect(normalizeUsername('a'.repeat(65))).toBeNull();
    expect(normalizeUsername('a'.repeat(64))).toBe('a'.repeat(64));
    expect(normalizeUsername('mari maasikas')).toBeNull();
    expect(normalizeUsername('jüri')).toBeNull();
  });
});

describe('checkAdminChange', () => {
  const admin = { id: 'a1', isActive: true, isAdmin: true };
  const user = { id: 'u1', isActive: true, isAdmin: false };

  it('keelab iseenda keelamise, kustutamise ja admini õiguse äravõtmise', () => {
    expect(checkAdminChange('a1', admin, { kind: 'update', isActive: false }, 2)).toMatch(/^Seda muudatust ei saa teha/);
    expect(checkAdminChange('a1', admin, { kind: 'update', isAdmin: false }, 2)).toMatch(/^Seda muudatust ei saa teha/);
    expect(checkAdminChange('a1', admin, { kind: 'delete' }, 2)).toMatch(/^Seda muudatust ei saa teha/);
  });

  it('keelab viimase aktiivse admini eemaldamise', () => {
    expect(checkAdminChange('x', admin, { kind: 'update', isAdmin: false }, 1)).toMatch(/^Seda muudatust ei saa teha/);
    expect(checkAdminChange('x', admin, { kind: 'delete' }, 1)).toMatch(/^Seda muudatust ei saa teha/);
  });

  it('lubab tavalised muudatused', () => {
    expect(checkAdminChange('a1', admin, { kind: 'update' }, 1)).toBeNull();
    expect(checkAdminChange('a1', user, { kind: 'update', isActive: false }, 1)).toBeNull();
    expect(checkAdminChange('a1', user, { kind: 'delete' }, 1)).toBeNull();
    expect(checkAdminChange('a1', user, { kind: 'update', isAdmin: true }, 1)).toBeNull();
    expect(checkAdminChange('x', admin, { kind: 'update', isAdmin: false }, 2)).toBeNull();
    // keelatud admin ei loe aktiivsete adminite hulka
    expect(checkAdminChange('x', { id: 'a2', isActive: false, isAdmin: true }, { kind: 'delete' }, 1)).toBeNull();
  });
});
