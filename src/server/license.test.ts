import { describe, it, expect, afterAll } from 'vitest';
import {
  tallinnToday, licenseState, moduleForRoute, isAllowedWhenReadOnly, loadLicenseState, LICENSE_MODULES
} from './license';
import { authDb } from './db';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('tallinnToday', () => {
  it('kasutab Eesti aega, mitte UTC-d', () => {
    expect(tallinnToday(new Date('2026-10-15T21:30:00Z'))).toBe('2026-10-16'); // EEST +3
    expect(tallinnToday(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-16'); // EET +2
    expect(tallinnToday(new Date('2026-01-15T21:30:00Z'))).toBe('2026-01-15');
  });
});

describe('licenseState', () => {
  it('kehtiv litsents: kirjutamine lubatud, moodulid alles', () => {
    expect(licenseState({ validUntil: d('2026-12-31'), modules: ['TELEMETRY'] }, '2026-10-15')).toEqual({
      readOnly: false, validUntil: '2026-12-31', expiresSoon: false, modules: ['TELEMETRY']
    });
  });
  it('viimane kehtiv päev on veel kehtiv', () => {
    expect(licenseState({ validUntil: d('2026-10-15'), modules: [] }, '2026-10-15').readOnly).toBe(false);
  });
  it('järgmisel päeval ainult lugemine', () => {
    expect(licenseState({ validUntil: d('2026-10-15'), modules: [] }, '2026-10-16').readOnly).toBe(true);
  });
  it('hoiatus 14 päeva enne, mitte varem', () => {
    expect(licenseState({ validUntil: d('2026-10-29'), modules: [] }, '2026-10-15').expiresSoon).toBe(true);
    expect(licenseState({ validUntil: d('2026-10-30'), modules: [] }, '2026-10-15').expiresSoon).toBe(false);
    expect(licenseState({ validUntil: d('2026-10-10'), modules: [] }, '2026-10-15').expiresSoon).toBe(false);
  });
  it('litsentsi puudumisel ainult lugemine ja ükski moodul', () => {
    expect(licenseState(null, '2026-10-15')).toEqual({ readOnly: true, validUntil: null, expiresSoon: false, modules: [] });
  });
  it('tundmatud moodulid jäetakse välja', () => {
    expect(licenseState({ validUntil: d('2099-12-31'), modules: ['SATELLITE', 'MIDAGI'] }, '2026-10-15').modules).toEqual(['SATELLITE']);
  });
});

describe('moduleForRoute', () => {
  it.each([
    ['/api/fleet/devices', 'TELEMETRY'],
    ['/api/fleet/devices/abc', 'TELEMETRY'],
    ['/api/fleet/devices/assign', 'TELEMETRY'],
    ['/api/fleet/device-assignments', 'TELEMETRY'],
    ['/api/fleet/device-assignments/x1', 'TELEMETRY'],
    ['/api/telemetry/history', 'TELEMETRY'],
    ['/api/field-works/telemetry-suggestions', 'TELEMETRY'],
    ['/api/satellite/dates', 'SATELLITE'],
    ['/api/satellite/cloud-check', 'SATELLITE'],
    ['/api/weather/radar', 'WEATHER'],
    ['/api/weather/radar.png', 'WEATHER']
  ])('%s → %s', (path, mod) => expect(moduleForRoute(path)).toBe(mod));

  it.each(['/api/fleet', '/api/fleet/vehicles', '/api/fleet/implements', '/api/fleet/implement-assignments', '/api/seasons', '/api/fleetdevices'])(
    '%s on põhimoodul', (path) => expect(moduleForRoute(path)).toBeNull()
  );
});

describe('isAllowedWhenReadOnly', () => {
  it('lugemised on lubatud', () => {
    expect(isAllowedWhenReadOnly('/api/seasons', 'GET')).toBe(true);
    expect(isAllowedWhenReadOnly('/api/weather/radar.png', 'HEAD')).toBe(true);
  });
  it('sisuliselt lugemine olev POST on lubatud', () => {
    expect(isAllowedWhenReadOnly('/api/satellite/cloud-check', 'POST')).toBe(true);
  });
  it('muudatused on keelatud', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(isAllowedWhenReadOnly('/api/seasons', m)).toBe(false);
  });
});

describe('loadLicenseState (andmebaas)', () => {
  const T = `test-license-${process.pid}`;
  afterAll(async () => {
    await authDb().tenantLicense.deleteMany({ where: { tenantId: T } });
  });
  it('loeb litsentsi ja puudumisel on fail-closed', async () => {
    expect(await loadLicenseState(T)).toEqual({ readOnly: true, validUntil: null, expiresSoon: false, modules: [] });
    await authDb().tenantLicense.create({ data: { tenantId: T, validUntil: d('2099-12-31'), modules: [...LICENSE_MODULES] } });
    const s = await loadLicenseState(T, new Date('2026-10-15T10:00:00Z'));
    expect(s).toEqual({ readOnly: false, validUntil: '2099-12-31', expiresSoon: false, modules: ['TELEMETRY', 'SATELLITE', 'WEATHER'] });
  });
});
