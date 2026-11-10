// src/server/weather/points.ts — põllu hooaeg → lähim ERA5-Landi ruut (ilmapunkt).
// Käivitatakse ettevõtte kontekstis igal ööl enne laadimist ja ilmavaate avamisel, kui leidub sidumata hooaegu.
// Ruut, millel andmeid pole (hasData = false, nt üle vee), asendatakse lähima naaberruuduga.
import { prisma, tenantTransaction } from '../db.ts';
import { snapToCell, neighborCells, geometryCenter, type Cell } from './grid.ts';

async function pointFor(cell: Cell): Promise<number> {
  const candidates = [cell, ...neighborCells(cell)];
  for (const c of candidates) {
    // Samaaegne upsert (öötöö + vaate avamine) võib anda P2002 — loe siis olemasolev rida
    const p = await prisma.weatherPoint.upsert({ where: { lat_lon: c }, create: c, update: {} }).catch(async (e) => {
      if (e?.code !== 'P2002') throw e;
      return prisma.weatherPoint.findUniqueOrThrow({ where: { lat_lon: c } });
    });
    if (p.hasData !== false) return p.id;
  }
  // Kõik naabrid andmeteta — jääb esimese ruudu juurde (UI näitab „andmeid pole“)
  return (await prisma.weatherPoint.findUniqueOrThrow({ where: { lat_lon: cell } })).id;
}

export async function bindWeatherPoints(): Promise<{ bound: number; changed: number }> {
  const seasons = await prisma.fieldSeason.findMany({ select: { id: true, geometry: true, weatherPointId: true } });
  const cache = new Map<string, number>();
  let bound = 0;
  const updates: { id: number; pointId: number }[] = [];
  for (const s of seasons) {
    const center = geometryCenter(s.geometry);
    if (!center) continue;
    const cell = snapToCell(center.lat, center.lon);
    const key = `${cell.lat}:${cell.lon}`;
    if (!cache.has(key)) cache.set(key, await pointFor(cell));
    const pointId = cache.get(key)!;
    bound++;
    if (s.weatherPointId !== pointId) updates.push({ id: s.id, pointId });
  }
  // Toores UPDATE: Prisma update muudaks updatedAt/updatedBy, mis nihutaks sõitude kohtade sõrmejälge
  // (ümberarvutus) ja märgiks vaataja hooaja viimaseks muutjaks. Seos pole kasutaja muudatus.
  if (updates.length) {
    await tenantTransaction(async (tx) => {
      for (const u of updates) await tx.$executeRaw`UPDATE "field_seasons" SET "weatherPointId" = ${u.pointId} WHERE id = ${u.id}`;
    });
  }
  return { bound, changed: updates.length };
}
