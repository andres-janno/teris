import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from './secretBox';
import { encryptTotpSecret, decryptTotpSecret } from './totp';

const K1 = 'a'.repeat(64);
const K2 = 'b'.repeat(64);

describe('secretBox', () => {
  it('krüpteerib ja dekrüpteerib; igal korral uus iv', () => {
    const a = encryptSecret('minu-saladus', K1);
    expect(a).not.toContain('minu-saladus');
    expect(decryptSecret(a, K1)).toBe('minu-saladus');
    expect(encryptSecret('minu-saladus', K1)).not.toBe(a);
  });
  it('vale võti ebaõnnestub', () => {
    expect(() => decryptSecret(encryptSecret('x', K1), K2)).toThrow();
  });
  it('muudetud krüptotekst või silt ebaõnnestub', () => {
    const [iv, tag, ct] = encryptSecret('tundlik väärtus', K1).split('.');
    const flip = (s: string) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1);
    expect(() => decryptSecret([iv, tag, flip(ct)].join('.'), K1)).toThrow();
    expect(() => decryptSecret([iv, flip(tag), ct].join('.'), K1)).toThrow();
    expect(() => decryptSecret('a.b', K1)).toThrow();
  });
  it('vigane võtme pikkus keelatakse', () => {
    expect(() => encryptSecret('x', 'abcd')).toThrow();
  });
  it('TOTP abifunktsioonid töötavad edasi', () => {
    expect(decryptTotpSecret(encryptTotpSecret('JBSWY3DP', K1), K1)).toBe('JBSWY3DP');
  });
});
