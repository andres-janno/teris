// src/server/weather/points.ts — põllu hooaeg → lähim ERA5-Landi ruut (ilmapunkt).
// Käivitatakse ettevõtte kontekstis igal ööl enne laadimist ja ilmavaate avamisel, kui leidub sidumata hooaegu.
// Ruut, millel andmeid pole (hasData = false, nt üle vee), asendatakse lähima naaberruuduga.
import { prisma } from '../db';
import { snapToCell, neighborCells, geometryCenter, type Cell } from './grid';

async function pointFor(cell: Cell): Promise<number> {
  const candidates = [cell, ...neighborCells(cell)];
  for (const c of candidates) {
    const p = await prisma.weatherPoint.upsert({ where: { lat_lon: c }, create: c, update: {} });
    if (p.hasData !== false) return p.id;
  }
  // Kõik naabrid andmeteta — jääb esimese ruudu juurde (UI näitab „andmeid pole“)
  return (await prisma.weatherPoint.findUniqueOrThrow({ where: { lat_lon: cell } })).id;
}

export async function bindWeatherPoints(): Promise<{ bound: number; changed: number }> {
  const seasons = await prisma.fieldSeason.findMany({ select: { id: true, geometry: true, weatherPointId: true } });
  const cache = new Map<string, number>();
  let bound = 0, changed = 0;
  for (const s of seasons) {
    const center = geometryCenter(s.geometry);
    if (!center) continue;
    const cell = snapToCell(center.lat, center.lon);
    const key = `${cell.lat}:${cell.lon}`;
    if (!cache.has(key)) cache.set(key, await pointFor(cell));
    const pointId = cache.get(key)!;
    bound++;
    if (s.weatherPointId !== pointId) {
      await prisma.fieldSeason.update({ where: { id: s.id }, data: { weatherPointId: pointId } });
      changed++;
    }
  }
  return { bound, changed };
}
