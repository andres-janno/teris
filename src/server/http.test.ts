import { describe, expect, it } from 'vitest';
import { shouldGzip } from './http.ts';

describe('shouldGzip', () => {
  it('pakib suure keha, kui klient lubab gzip-i', () => {
    expect(shouldGzip('gzip, deflate, br', 5000)).toBe(true);
    expect(shouldGzip(['br', 'gzip'], 5000)).toBe(true);
    expect(shouldGzip('*', 5000)).toBe(true);
  });

  it('ei paki väikest keha', () => {
    expect(shouldGzip('gzip', 1024)).toBe(false);
    expect(shouldGzip('gzip', 10)).toBe(false);
  });

  it('ei paki, kui gzip pole lubatud', () => {
    expect(shouldGzip(undefined, 5000)).toBe(false);
    expect(shouldGzip('', 5000)).toBe(false);
    expect(shouldGzip('br, deflate', 5000)).toBe(false);
    expect(shouldGzip('gzip;q=0', 5000)).toBe(false);
    expect(shouldGzip('gzip; q=0.5', 5000)).toBe(true);
  });
});
