import * as turf from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';

// Telemeetria sõidujoone kaetud pindala põllu piires ruudustikuga: iga lõigu ümber märgitakse
// haakeriista laiuses ruudud ja loetakse need, mille keskpunkt on põllul. Varem kasutatud
// turf.buffer + intersect pikal (10 000+ punktiga) joonel kestis kümneid sekundeid ja ajas
// serveri mälu täis; ruudustiku mälukasutus sõltub ainult kaetud pinnast. Nagu varemgi, ühendatakse
// sessiooni kõik järjestikused punktid (osa jälgureid saadab punkte harva, lõigud on pikemad kui 50 m).

const M_PER_DEG_LAT = 110_540;

export function coverageAreaHa(
  points: { lat: number; lng: number }[],
  field: Polygon | MultiPolygon | Feature<Polygon | MultiPolygon>,
  widthM: number
): number {
  if (!(widthM > 0) || points.length < 2) return 0;
  const lat0 = points[0].lat;
  const lng0 = points[0].lng;
  const mPerDegLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const toX = (lng: number) => (lng - lng0) * mPerDegLng;
  const toY = (lat: number) => (lat - lat0) * M_PER_DEG_LAT;

  const cell = Math.min(1, widthM / 6);
  const half = widthM / 2;
  const half2 = half * half;
  const covered = new Set<number>();
  // Ruudu võti: ix ja iy nihutatuna positiivseks (±2^20 ruutu ≈ ±1000 km 1 m ruuduga)
  const OFFSET = 1 << 20;
  const key = (ix: number, iy: number) => (ix + OFFSET) * 2 ** 21 + (iy + OFFSET);

  for (let i = 1; i < points.length; i++) {
    const ax = toX(points[i - 1].lng), ay = toY(points[i - 1].lat);
    const bx = toX(points[i].lng), by = toY(points[i].lat);
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;

    const minIx = Math.floor((Math.min(ax, bx) - half) / cell);
    const maxIx = Math.floor((Math.max(ax, bx) + half) / cell);
    const minIy = Math.floor((Math.min(ay, by) - half) / cell);
    const maxIy = Math.floor((Math.max(ay, by) + half) / cell);
    for (let ix = minIx; ix <= maxIx; ix++) {
      const cx = (ix + 0.5) * cell;
      for (let iy = minIy; iy <= maxIy; iy++) {
        const cy = (iy + 0.5) * cell;
        // Ruudu keskpunkti kaugus lõigust
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / len2)) : 0;
        const ex = cx - (ax + t * dx), ey = cy - (ay + t * dy);
        if (ex * ex + ey * ey <= half2) covered.add(key(ix, iy));
      }
    }
  }

  let inside = 0;
  for (const k of covered) {
    const ix = Math.floor(k / 2 ** 21) - OFFSET;
    const iy = (k % 2 ** 21) - OFFSET;
    const lng = lng0 + ((ix + 0.5) * cell) / mPerDegLng;
    const lat = lat0 + ((iy + 0.5) * cell) / M_PER_DEG_LAT;
    if (turf.booleanPointInPolygon([lng, lat], field)) inside++;
  }
  return Math.round(((inside * cell * cell) / 10_000) * 100) / 100;
}
