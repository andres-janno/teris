import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  validateNewPassword,
  generateSessionToken,
  hashToken,
  parseCookies,
  sessionCookie,
  clearSessionCookie,
  createLoginLimiter,
  checkMutationRequest,
  clientIpFrom,
  allowedDuringForcedPasswordChange
} from './auth';

describe('paroolid', () => {
  it('räsib ja kontrollib', async () => {
    const stored = await hashPassword('saladus-12345');
    expect(stored.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(await verifyPassword('saladus-12345', stored)).toBe(true);
    expect(await verifyPassword('vale-parool-1', stored)).toBe(false);
  });
  it('sama parool annab erineva räsi (sool)', async () => {
    expect(await hashPassword('saladus-12345')).not.toBe(await hashPassword('saladus-12345'));
  });
  it('rikutud räsi ei kehti', async () => {
    expect(await verifyPassword('x', 'rikutud')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$16384$8$1$$')).toBe(false);
  });
  it('uue parooli pikkus', () => {
    expect(validateNewPassword('lühike')).toBe('Parool peab olema vähemalt 10 märki');
    expect(validateNewPassword('piisavalt-pikk')).toBeNull();
  });
});

describe('verifyPassword', () => {
  it('tühi räsi (kutsutud kasutaja, parool määramata) ei kehti kunagi', async () => {
    expect(await verifyPassword('', '')).toBe(false);
    expect(await verifyPassword('midagi', '')).toBe(false);
  });
});

describe('sessioonitoken ja küpsis', () => {
  it('token on juhuslik ja räsi determineeritud', () => {
    const t = generateSessionToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateSessionToken()).not.toBe(t);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });
  it('loeb küpsiseid', () => {
    expect(parseCookies('a=1; teris_session=abc%3D; b=2')).toEqual({ a: '1', teris_session: 'abc=', b: '2' });
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('vigane; x=%E0%A4%A')).toEqual({});
  });
  it('seab ja kustutab küpsise', () => {
    expect(sessionCookie('tok', 1209600)).toBe('teris_session=tok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1209600');
    expect(clearSessionCookie()).toBe('teris_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  });
});

describe('sisselogimise piiraja', () => {
  it('blokeerib 10 ebaõnnestumise järel ja vabastab akna möödudes', () => {
    let t = 0;
    const lim = createLoginLimiter({ max: 10, windowMs: 1000 }, () => t);
    for (let i = 0; i < 9; i++) lim.registerFailure('u:x');
    expect(lim.isBlocked('u:x')).toBe(false);
    lim.registerFailure('u:x');
    expect(lim.isBlocked('u:x')).toBe(true);
    expect(lim.isBlocked('u:teine')).toBe(false);
    t = 1001;
    expect(lim.isBlocked('u:x')).toBe(false);
  });
  it('reset nullib', () => {
    const lim = createLoginLimiter({ max: 2, windowMs: 1000 }, () => 0);
    lim.registerFailure('ip:1');
    lim.registerFailure('ip:1');
    lim.reset('ip:1');
    expect(lim.isBlocked('ip:1')).toBe(false);
  });
  it('ei jäta mällu nähtamata võtit ega aegunud võtit (mälukasvu kaitse)', () => {
    let t = 0;
    const lim = createLoginLimiter({ max: 10, windowMs: 1000 }, () => t);
    // isBlocked nähtamata võtme jaoks ei tohi midagi salvestada
    expect(lim.isBlocked('u:kunagi-nagitud')).toBe(false);
    expect(lim.size()).toBe(0);
    // aknast väljunud rike eemaldatakse Map'ist, mitte ei jäeta tühja loendina
    lim.registerFailure('u:proovinud');
    expect(lim.size()).toBe(1);
    t = 1001;
    expect(lim.isBlocked('u:proovinud')).toBe(false);
    expect(lim.size()).toBe(0);
  });
});

describe('clientIpFrom', () => {
  it('üks väärtus', () => {
    expect(clientIpFrom('1.2.3.4', '5.6.7.8')).toBe('1.2.3.4');
  });
  it('mitu väärtust — viimane (mod_proxy lisatud) on tõene kliendiaadress', () => {
    expect(clientIpFrom('spoofed, real', '5.6.7.8')).toBe('real');
  });
  it('massiivina antud päis — kasutatakse viimast päist ja selle viimast väärtust', () => {
    expect(clientIpFrom(['1.1.1.1', 'spoofed, real'], '5.6.7.8')).toBe('real');
  });
  it('päis puudub — kasutatakse remoteAddress', () => {
    expect(clientIpFrom(undefined, '5.6.7.8')).toBe('5.6.7.8');
  });
  it('midagi pole teada — tundmatu', () => {
    expect(clientIpFrom(undefined, undefined)).toBe('tundmatu');
  });
});

describe('checkMutationRequest', () => {
  const allowed = ['https://teris.ee'];
  it('GET on alati lubatud', () => {
    expect(checkMutationRequest({ method: 'GET', hasBody: false }, allowed)).toBe('ok');
  });
  it('POST nõuab lubatud päritolu', () => {
    expect(checkMutationRequest({ method: 'POST', origin: 'https://kuri.ee', contentType: 'application/json', hasBody: true }, allowed)).toBe('bad-origin');
    expect(checkMutationRequest({ method: 'POST', contentType: 'application/json', hasBody: true }, allowed)).toBe('bad-origin');
  });
  it('kehaga päring peab olema JSON', () => {
    expect(checkMutationRequest({ method: 'POST', origin: allowed[0], contentType: 'text/plain', hasBody: true }, allowed)).toBe('bad-content-type');
    expect(checkMutationRequest({ method: 'POST', origin: allowed[0], contentType: 'application/json; charset=utf-8', hasBody: true }, allowed)).toBe('ok');
  });
  it('DELETE ilma kehata lubatud päritoluga on ok', () => {
    expect(checkMutationRequest({ method: 'DELETE', origin: allowed[0], hasBody: false }, allowed)).toBe('ok');
  });
});

describe('allowedDuringForcedPasswordChange', () => {
  it('lubab ainult me, parooli vahetuse ja väljalogimise', () => {
    expect(allowedDuringForcedPasswordChange('/api/auth/me', 'GET')).toBe(true);
    expect(allowedDuringForcedPasswordChange('/api/auth/password', 'POST')).toBe(true);
    expect(allowedDuringForcedPasswordChange('/api/auth/logout', 'post')).toBe(true);
  });
  it('keelab muud teed ja meetodid', () => {
    expect(allowedDuringForcedPasswordChange('/api/status', 'GET')).toBe(false);
    expect(allowedDuringForcedPasswordChange('/api/auth/password', 'GET')).toBe(false);
    expect(allowedDuringForcedPasswordChange('/api/admin/users', 'GET')).toBe(false);
  });
});
