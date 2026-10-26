// src/server/tripPlaces.ts — teekonna tuvastuse teadaolevad kohad: aasta põllud (hooaja geomeetriaga) ja huvipunktid.
// Päringud käivad ettevõtte piires (prisma kontekst).
import { prisma } from './db.ts';
import type { Place } from './tripRoute.ts';

const POI_CATEGORY_LABELS: Record<string, string> = {
  DRYER: 'kuivati',
  WATER_SOURCE: 'veepunkt',
  WORKSHOP: 'töökoda',
  FUEL_STATION: 'tankla',
  FIELD_ENTRANCE: 'põllu sissesõit',
  STORAGE: 'ladu',
  SCALE: 'kaal'
};

export async function loadPlaces(year: number): Promise<Place[]> {
  const [seasons, pois] = await Promise.all([
    prisma.fieldSeason.findMany({
      where: { year },
      select: { id: true, geometry: true, field: { select: { num: true, name: true } } }
    }),
    prisma.pointOfInterest.findMany({ select: { id: true, name: true, category: true, latitude: true, longitude: true, radiusM: true } })
  ]);
  const places: Place[] = [];
  for (const s of seasons) {
    const g = s.geometry as any;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
    places.push({ id: String(s.id), kind: 'FIELD', label: `Nr ${s.field.num} ${s.field.name}`.trim(), geometry: g });
  }
  for (const p of pois) {
    const cat = POI_CATEGORY_LABELS[p.category];
    places.push({ id: p.id, kind: 'POI', label: cat ? `${p.name} (${cat})` : p.name, lat: p.latitude, lng: p.longitude, radiusM: p.radiusM });
  }
  return places;
}
