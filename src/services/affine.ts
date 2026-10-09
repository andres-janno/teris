// src/services/affine.ts

/** Afiinteisendus, mis viib lähtepunktid s0, s1, s2 sihtpunktidesse d0, d1, d2 (canvas setTransform kujul). */
export function affineFromTriangles(
  s: [[number, number], [number, number], [number, number]],
  d: [[number, number], [number, number], [number, number]]
): [number, number, number, number, number, number] {
  const u1x = s[1][0] - s[0][0], u1y = s[1][1] - s[0][1];
  const u2x = s[2][0] - s[0][0], u2y = s[2][1] - s[0][1];
  const v1x = d[1][0] - d[0][0], v1y = d[1][1] - d[0][1];
  const v2x = d[2][0] - d[0][0], v2y = d[2][1] - d[0][1];
  const det = u1x * u2y - u2x * u1y;
  const a = (v1x * u2y - v2x * u1y) / det;
  const c = (v2x * u1x - v1x * u2x) / det;
  const b = (v1y * u2y - v2y * u1y) / det;
  const dd = (v2y * u1x - v1y * u2x) / det;
  const e = d[0][0] - a * s[0][0] - c * s[0][1];
  const f = d[0][1] - b * s[0][0] - dd * s[0][1];
  return [a, b, c, dd, e, f];
}
