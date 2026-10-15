import { describe, it, expect } from 'vitest';
import { hasModule, licenseBannerText } from './license';
import type { AuthUser, AuthLicense } from '../types/auth';

const lic = (o: Partial<AuthLicense> = {}): AuthLicense => ({ readOnly: false, validUntil: '2099-12-31', expiresSoon: false, modules: [], ...o });
const user = (license: AuthLicense, isAdmin = false): AuthUser => ({
  id: 'u', username: 'u', displayName: null, isAdmin, isFinanceManager: false, mustChangePassword: false, tenantName: 'T', license
});

describe('hasModule', () => {
  it('vaatab kasutaja litsentsi', () => {
    expect(hasModule(user(lic({ modules: ['SATELLITE'] })), 'SATELLITE')).toBe(true);
    expect(hasModule(user(lic()), 'SATELLITE')).toBe(false);
    expect(hasModule(null, 'SATELLITE')).toBe(false);
  });
  it('litsentsita kasutaja (vana server) — kõik moodulid nähtaval', () => {
    const legacy = { ...user(lic()), license: undefined } as unknown as AuthUser;
    expect(hasModule(legacy, 'TELEMETRY')).toBe(true);
    expect(hasModule(legacy, 'SATELLITE')).toBe(true);
    expect(licenseBannerText(legacy.license, true)).toBeNull();
  });
});

describe('licenseBannerText', () => {
  it('aegunud litsents — kõigile', () => {
    expect(licenseBannerText(lic({ readOnly: true, validUntil: '2026-10-01' }), false))
      .toBe('Litsents aegus 01.10.2026. Andmed on ainult lugemiseks — pikendamiseks võtke ühendust teenusepakkujaga.');
  });
  it('litsents puudub', () => {
    expect(licenseBannerText(lic({ readOnly: true, validUntil: null }), false))
      .toBe('Ettevõttel puudub kehtiv litsents. Andmed on ainult lugemiseks — võtke ühendust teenusepakkujaga.');
  });
  it('aegub peagi — ainult adminile', () => {
    expect(licenseBannerText(lic({ expiresSoon: true, validUntil: '2026-10-20' }), true))
      .toBe('Litsents aegub 20.10.2026. Pikendamiseks võtke ühendust teenusepakkujaga.');
    expect(licenseBannerText(lic({ expiresSoon: true, validUntil: '2026-10-20' }), false)).toBeNull();
  });
  it('kehtiv litsents — riba pole', () => {
    expect(licenseBannerText(lic(), true)).toBeNull();
  });
});
