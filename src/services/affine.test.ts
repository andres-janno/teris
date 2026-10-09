import { describe, it, expect } from 'vitest';
import { affineFromTriangles } from './affine';

const apply = ([a, b, c, d, e, f]: number[], [x, y]: [number, number]) => [a * x + c * y + e, b * x + d * y + f];

describe('affineFromTriangles', () => {
  it('viib lähtekolmnurga tipud sihtkolmnurga tippudesse', () => {
    const s: [[number, number], [number, number], [number, number]] = [[10, 20], [110, 25], [5, 120]];
    const d: [[number, number], [number, number], [number, number]] = [[0, 0], [256, 0], [0, 256]];
    const m = affineFromTriangles(s, d);
    s.forEach((p, i) => {
      const [x, y] = apply(m, p);
      expect(x).toBeCloseTo(d[i][0], 9);
      expect(y).toBeCloseTo(d[i][1], 9);
    });
  });

  it('identsus', () => {
    const t: [[number, number], [number, number], [number, number]] = [[0, 0], [1, 0], [0, 1]];
    expect(affineFromTriangles(t, t).map((v) => Math.abs(v) < 1e-12 ? 0 : v)).toEqual([1, 0, 0, 1, 0, 0]);
  });
});
