// src/services/ndvi.ts
// NDVI väärtus Satiladu NDVI pildi värvist. WMS annab ainult värvitud pildi (toorväärtusi ega WCS-i pole),
// värviskaala on aga tükiti lineaarne (tuletatud teenuse legendist ja pikslitest), nii et väärtuse saab
// värvist tagasi arvutada ~0,01 täpsusega. Negatiivne NDVI (vesi) on eraldi sinine skaala → loetakse 0-ks.

type Rgb = [number, number, number];

const NDVI_SEGMENTS: { from: Rgb; to: Rgb; v0: number; v1: number }[] = [
  { from: [0, 5, 50], to: [170, 0, 44], v0: 0, v1: 0.1 },
  { from: [170, 0, 44], to: [255, 238, 169], v0: 0.1, v1: 0.5 },
  { from: [255, 238, 169], to: [1, 105, 61], v0: 0.5, v1: 0.9 },
  // Negatiivsed väärtused (vesi): tumesinine → sinine
  { from: [0, 5, 50], to: [0, 55, 110], v0: 0, v1: 0 }
];

/** Kaugemal skaalast olev värv (nt servade silumine) jäetakse arvestusest välja */
const MAX_COLOR_DISTANCE = 30;

/** NDVI (0 … 0,9) pildi värvist; null, kui värv ei kuulu skaalale. */
export function ndviFromColor(r: number, g: number, b: number): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const s of NDVI_SEGMENTS) {
    const dx = s.to[0] - s.from[0], dy = s.to[1] - s.from[1], dz = s.to[2] - s.from[2];
    const len2 = dx * dx + dy * dy + dz * dz;
    const t = Math.max(0, Math.min(1, ((r - s.from[0]) * dx + (g - s.from[1]) * dy + (b - s.from[2]) * dz) / len2));
    const ex = r - (s.from[0] + t * dx), ey = g - (s.from[1] + t * dy), ez = b - (s.from[2] + t * dz);
    const dist = Math.sqrt(ex * ex + ey * ey + ez * ez);
    if (dist < bestDist) {
      bestDist = dist;
      best = s.v0 + t * (s.v1 - s.v0);
    }
  }
  return bestDist <= MAX_COLOR_DISTANCE ? best : null;
}

/**
 * Pilv või udu RGB pildil: hele ja peaaegu värvitu piksel. Läviväärtused on valitud Satiladu piltide järgi:
 * udune päev jääb ~90% ulatuses sisse, selge päeva põllud ja hele kuiv muld (beež, toonierinevus > 30) välja.
 */
export function isCloudPixel(r: number, g: number, b: number): boolean {
  return Math.min(r, g, b) >= 200 && Math.max(r, g, b) - Math.min(r, g, b) <= 30;
}

/** Punkt hulknurgas (paarsusreegel; augud on lihtsalt lisarõngad) */
export function pointInRings(x: number, y: number, rings: [number, number][][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Klassid põllu kokkuvõttes (ka legendi selgitused) */
export const NDVI_CLASSES = [
  { key: 'bare', max: 0.25, label: 'Paljas muld, kõrs', color: '#c0303f' },
  { key: 'sparse', max: 0.5, label: 'Hõre taimkate', color: '#f2cf95' },
  { key: 'dense', max: Infinity, label: 'Tihe roheline taimkate', color: '#2b7c4c' }
] as const;

export interface NdviSummary {
  mean: number;
  /** Osakaal (0…1) NDVI_CLASSES järjekorras, arvestatud ainult kehtivatest pikslitest */
  classShares: number[];
  /** Kehtivate (pilvevabade ja andmetega) pikslite osakaal põllust */
  coverage: number;
  /** Pilves pikslite osakaal põllust */
  cloudShare: number;
}

export function summarizeNdvi(values: number[], totalPixels: number, cloudPixels: number): NdviSummary | null {
  if (!values.length || !totalPixels) return null;
  const counts = NDVI_CLASSES.map(() => 0);
  let sum = 0;
  for (const v of values) {
    sum += v;
    counts[NDVI_CLASSES.findIndex((c) => v < c.max)]++;
  }
  return {
    mean: sum / values.length,
    classShares: counts.map((c) => c / values.length),
    coverage: values.length / totalPixels,
    cloudShare: cloudPixels / totalPixels
  };
}
