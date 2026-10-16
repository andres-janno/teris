import { describe, it, expect } from 'vitest';
import {
  base32Encode, base32Decode, generateTotpSecret, totpCode, totpStep, verifyTotp,
  otpauthUri, encryptTotpSecret, decryptTotpSecret
} from './totp';

// RFC 6238 lisa B: saladus "12345678901234567890" (SHA-1), 8-kohalised koodid → meie 6 viimast numbrit
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('base32', () => {
  it('kodeerib ja dekodeerib', () => {
    expect(RFC_SECRET).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(RFC_SECRET).toString()).toBe('12345678901234567890');
    expect(base32Decode('gezd gnbv-gy3t')).toEqual(base32Decode('GEZDGNBVGY3T')); // tühikud, sidekriipsud, väiketähed
  });
});

describe('totpCode (RFC 6238)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037']
  ])('T=%i → %s', (t, code) => expect(totpCode(RFC_SECRET, Math.floor(t / 30))).toBe(code));
});

describe('verifyTotp', () => {
  const now = new Date(1234567890 * 1000);
  const step = totpStep(now);
  it('aktsepteerib praeguse ja ±1 sammu koodi', () => {
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), now, 0)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), now, 0)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), now, 0)).toBe(step + 1);
  });
  it('lükkab tagasi vana, vigase ja juba kasutatud koodi', () => {
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), now, 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET, '000000', now, 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abc', now, 0)).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), now, step)).toBeNull();
  });
});

describe('saladus', () => {
  it('genereerib 32-märgilise base32 saladuse', () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateTotpSecret()).not.toBe(s);
  });
  it('otpauth URI', () => {
    expect(otpauthUri('andres', 'ABC')).toBe('otpauth://totp/Teris:andres?secret=ABC&issuer=Teris&algorithm=SHA1&digits=6&period=30');
  });
  it('krüpteerib ja dekrüpteerib; vale võtmega viskab', () => {
    const key = 'a'.repeat(64);
    const enc = encryptTotpSecret('GEZDGNBV', key);
    expect(enc).not.toContain('GEZDGNBV');
    expect(decryptTotpSecret(enc, key)).toBe('GEZDGNBV');
    expect(() => decryptTotpSecret(enc, 'b'.repeat(64))).toThrow();
  });
});
