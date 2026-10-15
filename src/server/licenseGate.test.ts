import { describe, it, expect } from 'vitest';
import { decideLicense, hasModule } from './licenseGate';
import type { LicenseState } from './license';

const full: LicenseState = { readOnly: false, validUntil: '2099-12-31', expiresSoon: false, modules: ['TELEMETRY', 'SATELLITE', 'WEATHER'] };
const basic: LicenseState = { ...full, modules: [] };
const expired: LicenseState = { ...full, readOnly: true };

describe('decideLicense', () => {
  it('lubab kõik täislitsentsiga', () => {
    expect(decideLicense(full, '/api/fleet/devices', 'POST')).toBeNull();
    expect(decideLicense(full, '/api/seasons', 'POST')).toBeNull();
  });
  it('keelab litsentsita mooduli ka lugemisel', () => {
    expect(decideLicense(basic, '/api/weather/radar', 'GET')).toEqual({
      status: 403, body: { error: 'See moodul ei kuulu teie litsentsi', code: 'MODULE_NOT_LICENSED' }
    });
    expect(decideLicense(basic, '/api/telemetry/history', 'GET')?.body.code).toBe('MODULE_NOT_LICENSED');
  });
  it('põhimoodul jääb litsentsita moodulite korral tööle', () => {
    expect(decideLicense(basic, '/api/fleet', 'GET')).toBeNull();
    expect(decideLicense(basic, '/api/seasons', 'POST')).toBeNull();
  });
  it('aegunud litsents: lugemine lubatud, muutmine keelatud', () => {
    expect(decideLicense(expired, '/api/seasons', 'GET')).toBeNull();
    expect(decideLicense(expired, '/api/satellite/cloud-check', 'POST')).toBeNull();
    expect(decideLicense(expired, '/api/seasons', 'POST')).toEqual({
      status: 403, body: { error: 'Litsents on aegunud — andmed on ainult lugemiseks', code: 'LICENSE_READ_ONLY' }
    });
  });
  it('moodulikeeld on tähtsam kui aegumine', () => {
    expect(decideLicense({ ...expired, modules: [] }, '/api/fleet/devices', 'POST')?.body.code).toBe('MODULE_NOT_LICENSED');
  });
});

describe('hasModule', () => {
  it('kontrollib moodulit; olekuta päringul pole ühtki moodulit', () => {
    expect(hasModule(full, 'TELEMETRY')).toBe(true);
    expect(hasModule(basic, 'TELEMETRY')).toBe(false);
    expect(hasModule(null, 'TELEMETRY')).toBe(false);
  });
});
