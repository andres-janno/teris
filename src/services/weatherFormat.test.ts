// src/services/weatherFormat.test.ts
import { describe, it, expect } from 'vitest';
import { deviation, fmt1 } from './weatherFormat';

describe('deviation', () => {
  it('sademed üle +1 sd → märg, alla −1 sd → kuiv', () => {
    expect(deviation(500, 400, 50, 'precip')).toBe('wet');
    expect(deviation(340, 400, 50, 'precip')).toBe('dry');
    expect(deviation(420, 400, 50, 'precip')).toBeNull();
  });
  it('GDD → soe/jahe', () => {
    expect(deviation(1300, 1100, 100, 'gdd')).toBe('warm');
    expect(deviation(950, 1100, 100, 'gdd')).toBe('cool');
  });
  it('sd 0 või puuduv → null', () => {
    expect(deviation(5, 5, 0, 'gdd')).toBeNull();
    expect(deviation(null, 5, 1, 'gdd')).toBeNull();
  });
});

describe('fmt1', () => {
  it('eesti vormingus üks komakoht (Node et-EE ei grupeeri 4-kohalisi numbreid)', () => {
    expect(fmt1(1234.56)).toBe('1234,6');
    expect(fmt1(12345.67)).toBe('12 345,7'.replace(' ', ' '));
    expect(fmt1(null)).toBe('—');
  });
});
