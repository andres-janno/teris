import { describe, expect, it } from 'vitest';
import { clampPercent } from './progress';

describe('clampPercent', () => {
  it('jätab vahemiku 0–100 muutmata', () => {
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(42.5)).toBe(42.5);
    expect(clampPercent(100)).toBe(100);
  });
  it('piirab vahemikku', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(140)).toBe(100);
  });
  it('NaN ja lõpmatus on 0 / 100', () => {
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(Number.POSITIVE_INFINITY)).toBe(100);
    expect(clampPercent(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});
