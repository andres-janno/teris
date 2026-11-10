// src/server/weather/grid.ts — ERA5-Landi ruudustik (0,1°): lähim ruut, naabrid, põllu keskpunkt.
import * as turf from '@turf/turf';

export type Cell = { lat: number; lon: number };

const STEP = 0.1;
const round1 = (x: number) => Math.round(x * 10) / 10;

export function snapToCell(lat: number, lon: number): Cell {
  return { lat: round1(lat), lon: round1(lon) };
}

/** 8 naaberruutu; külgnaabrid enne nurki (lähemad ees). */
export function neighborCells(c: Cell): Cell[] {
  const side: [number, number][] = [[1, 0], [-1, 0], [0, -1], [0, 1]];
  const corner: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  return [...side, ...corner].map(([dy, dx]) => ({ lat: round1(c.lat + dy * STEP), lon: round1(c.lon + dx * STEP) }));
}

export function geometryCenter(geometry: unknown): Cell | null {
  try {
    const g = geometry as { type?: string; coordinates?: unknown[] } | null;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon') || !Array.isArray(g.coordinates) || g.coordinates.length === 0) return null;
    const [lon, lat] = turf.centroid(g as never).geometry.coordinates;
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  } catch {
    return null;
  }
}
