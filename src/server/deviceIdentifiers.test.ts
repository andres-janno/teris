import { describe, it, expect } from 'vitest';
import { validateImei, normalizeMac } from './deviceIdentifiers';

describe('validateImei', () => {
  it.each(['490154203237518', '356938035643809', ' 490154203237518 '])('kehtiv %s', (s) =>
    expect(validateImei(s)).toBe(s.trim()));
  it.each(['490154203237517', '49015420323751', '4901542032375180', '49015420323751a', '', null, 490154203237518])(
    'vigane %s', (s) => expect(validateImei(s)).toBeNull());
});

describe('normalizeMac', () => {
  it.each([
    ['aa:bb:cc:dd:ee:ff', 'AA:BB:CC:DD:EE:FF'],
    ['AA-BB-CC-DD-EE-FF', 'AA:BB:CC:DD:EE:FF'],
    ['aabbccddeeff', 'AA:BB:CC:DD:EE:FF']
  ])('%s → %s', (s, out) => expect(normalizeMac(s)).toBe(out));
  it.each(['aa:bb:cc:dd:ee', 'gg:bb:cc:dd:ee:ff', 'aa:bb-cc:dd:ee:ff', '', null, 123])('vigane %s', (s) =>
    expect(normalizeMac(s)).toBeNull());
});
