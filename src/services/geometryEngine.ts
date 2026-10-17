// src/services/geometryEngine.ts
import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon, LineString, Position } from 'geojson';
import type { TelemetryPoint } from '../types/telemetry';
import type { FieldFeature } from '../types/field';

/**
 * Creates a buffered swath polygon from telemetry points where isWorking is true
 * @param points Array of telemetry points with lat, lng, isWorking, workingWidthM
 */
export function generateCultivationPolygon(points: TelemetryPoint[]): {
  swathPolygon: Feature<Polygon | MultiPolygon> | null;
  trailLine: Feature<LineString> | null;
  totalDistanceKm: number;
  totalWorkedAreaHa: number;
} {
  if (points.length < 2) {
    return { swathPolygon: null, trailLine: null, totalDistanceKm: 0, totalWorkedAreaHa: 0 };
  }

  // Create full trajectory LineString
  const lineCoords: Position[] = points.map(p => [p.lng, p.lat]);
  const trailLine = turf.lineString(lineCoords);
  const totalDistanceKm = Math.round(turf.length(trailLine, { units: 'kilometers' }) * 100) / 100;

  // Segment the trajectory into working segments
  const workingSegments: Feature<LineString>[] = [];
  let currentSegment: Position[] = [];
  let currentWidth = 12; // default 12m

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.isWorking) {
      currentSegment.push([pt.lng, pt.lat]);
      currentWidth = pt.workingWidthM || 12;
    } else {
      if (currentSegment.length >= 2) {
        workingSegments.push(turf.lineString(currentSegment, { width: currentWidth }));
      }
      currentSegment = [];
    }
  }
  if (currentSegment.length >= 2) {
    workingSegments.push(turf.lineString(currentSegment, { width: currentWidth }));
  }

  if (workingSegments.length === 0) {
    return { swathPolygon: null, trailLine, totalDistanceKm, totalWorkedAreaHa: 0 };
  }

  // Buffer each segment according to its implement working width (radius = width / 2 in kilometers)
  const bufferedPolygons: Feature<Polygon | MultiPolygon>[] = [];

  for (const seg of workingSegments) {
    const widthMeters = (seg.properties?.width as number) || 12;
    const radiusKm = (widthMeters / 2) / 1000;
    try {
      const buffered = turf.buffer(seg, radiusKm, { units: 'kilometers', steps: 8 });
      if (buffered) {
        bufferedPolygons.push(buffered);
      }
    } catch (e) {
      console.warn('Error buffering segment:', e);
    }
  }

  if (bufferedPolygons.length === 0) {
    return { swathPolygon: null, trailLine, totalDistanceKm, totalWorkedAreaHa: 0 };
  }

  // Union all buffered swaths into one coverage layer
  let combinedPolygon = bufferedPolygons[0];
  for (let i = 1; i < bufferedPolygons.length; i++) {
    try {
      const unionResult = turf.union(turf.featureCollection([combinedPolygon, bufferedPolygons[i]]));
      if (unionResult) {
        combinedPolygon = unionResult as Feature<Polygon | MultiPolygon>;
      }
    } catch (e) {
      // If turf.union fails on complex self-intersections, continue with previous
    }
  }

  const areaSqMeters = turf.area(combinedPolygon);
  const totalWorkedAreaHa = Math.round((areaSqMeters / 10000) * 100) / 100;

  return {
    swathPolygon: combinedPolygon,
    trailLine,
    totalDistanceKm,
    totalWorkedAreaHa
  };
}

/**
 * Calculates how much of a specific field has been worked (intersection of field and swath)
 */
export function calculateFieldWorkProgress(
  field: FieldFeature, 
  cultivationPolygon: Feature<Polygon | MultiPolygon> | null
): { workedAreaHa: number; progressPct: number } {
  if (!cultivationPolygon || !field.geometry) {
    return { workedAreaHa: 0, progressPct: 0 };
  }

  try {
    const intersection = turf.intersect(
      turf.featureCollection([field as Feature<Polygon | MultiPolygon>, cultivationPolygon])
    );

    if (!intersection) {
      return { workedAreaHa: 0, progressPct: 0 };
    }

    const workedSqMeters = turf.area(intersection);
    const workedAreaHa = Math.round((workedSqMeters / 10000) * 100) / 100;
    const totalAreaHa = field.properties.areaHa || 1;
    const progressPct = Math.min(100, Math.round((workedAreaHa / totalAreaHa) * 100));

    return { workedAreaHa, progressPct };
  } catch (err) {
    console.warn('Could not calculate field intersection:', err);
    return { workedAreaHa: 0, progressPct: 0 };
  }
}

/**
 * Gets [minLng, minLat, maxLng, maxLat] bounding box
 */
export function getBoundingBox(geojson: any): [number, number, number, number] {
  return turf.bbox(geojson) as [number, number, number, number];
}

export interface BoundsParams {
  visibility: {
    fields: boolean;
    vehicles: boolean;
    cultivation: boolean;
    poi: boolean;
    soilSamples?: boolean;
  };
  fields?: { features: FieldFeature[] };
  vehicles?: { position?: [number, number] }[];
  cultivationPass?: { swathPolygon?: any; points?: { lat: number; lng: number }[] };
  /** Põllutööde kihi masinate valmis rajad */
  vehicleTracks?: { swathPolygon?: any; trailLine?: any }[];
  soilSamples?: { lat: number; lng: number }[];
  pois?: { position?: [number, number] }[];
}

/**
 * Calculates a bounding box encompassing all currently visible layer elements
 */
export function getVisibleElementsBounds(params: BoundsParams): [[number, number], [number, number]] | null {
  const points: [number, number][] = []; // [lat, lng]

  // 1. Fields
  if (params.visibility.fields && params.fields && params.fields.features.length > 0) {
    try {
      const bbox = turf.bbox({
        type: 'FeatureCollection',
        features: params.fields.features as any
      }); // [minLng, minLat, maxLng, maxLat]
      points.push([bbox[1], bbox[0]]);
      points.push([bbox[3], bbox[2]]);
    } catch (e) {
      console.warn('Error calculating fields bbox:', e);
    }
  }

  // 2. Vehicles
  if (params.visibility.vehicles && params.vehicles && params.vehicles.length > 0) {
    params.vehicles.forEach(v => {
      if (v.position && v.position.length === 2) {
        points.push([v.position[0], v.position[1]]);
      }
    });
  }

  // 3. Cultivation
  if (params.visibility.cultivation && params.cultivationPass) {
    if (params.cultivationPass.swathPolygon) {
      try {
        const bbox = turf.bbox(params.cultivationPass.swathPolygon);
        points.push([bbox[1], bbox[0]]);
        points.push([bbox[3], bbox[2]]);
      } catch (e) {
        // ignore
      }
    } else if (params.cultivationPass.points && params.cultivationPass.points.length > 0) {
      params.cultivationPass.points.forEach(p => {
        points.push([p.lat, p.lng]);
      });
    }
  }

  // 3b. Põllutööde rajad
  if (params.visibility.cultivation && params.vehicleTracks) {
    params.vehicleTracks.forEach((t) => {
      const geom = t.trailLine ?? t.swathPolygon;
      if (!geom) return;
      try {
        const bbox = turf.bbox(geom);
        points.push([bbox[1], bbox[0]]);
        points.push([bbox[3], bbox[2]]);
      } catch (e) {
        // ignore
      }
    });
  }

  // 3c. Mullaproovid
  if (params.visibility.soilSamples && params.soilSamples) {
    params.soilSamples.forEach((s) => {
      if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) points.push([s.lat, s.lng]);
    });
  }

  // 4. POIs
  if (params.visibility.poi && params.pois && params.pois.length > 0) {
    params.pois.forEach(p => {
      if (p.position && p.position.length === 2) {
        points.push([p.position[0], p.position[1]]);
      }
    });
  }

  if (points.length === 0) return null;

  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];

  for (let i = 1; i < points.length; i++) {
    const [lat, lng] = points[i];
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  return [
    [minLat, minLng],
    [maxLat, maxLng]
  ];
}

/**
 * Calculates perimeter in meters for a GeoJSON Polygon or MultiPolygon
 */
export function getGeometryPerimeterMeters(geometry?: Polygon | MultiPolygon | null): number {
  if (!geometry || !geometry.coordinates) return 0;
  try {
    const line = turf.polygonToLine(geometry as any);
    if (!line) return 0;
    if (Array.isArray(line)) {
      const totalKm = line.reduce((sum, l) => sum + turf.length(l, { units: 'kilometers' }), 0);
      return Math.round(totalKm * 1000);
    }
    const km = turf.length(line as any, { units: 'kilometers' });
    return Math.round(km * 1000);
  } catch (err) {
    return 0;
  }
}

/**
 * Extracts a list of GPS vertex coordinates [lat, lng] for inspector/table display
 */
export function getGeometryCoordinatesList(geometry?: Polygon | MultiPolygon | null): { index: number; lat: number; lng: number }[] {
  if (!geometry || !geometry.coordinates) return [];
  const coords: { index: number; lat: number; lng: number }[] = [];
  let idx = 1;

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring) => {
      ring.forEach(([lng, lat]) => {
        coords.push({ index: idx++, lat, lng });
      });
    });
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((poly) => {
      poly.forEach((ring) => {
        ring.forEach(([lng, lat]) => {
          coords.push({ index: idx++, lat, lng });
        });
      });
    });
  }

  return coords;
}

/**
 * Calculates accurate polygon area in hectares (ha)
 */
export function getGeometryAreaHa(geometry?: Polygon | MultiPolygon | null): number {
  if (!geometry || !geometry.coordinates) return 0;
  try {
    const sqMeters = turf.area(geometry as any);
    return Math.round((sqMeters / 10000) * 100) / 100;
  } catch {
    return 0;
  }
}



/**
 * Põllu sildi asukoht [lat, lng]: suurima osapolügooni ligipääsmatuse poolus (polylabel) —
 * punkt, mis on servadest kõige kaugemal, nii et number jääb ka L- ja U-kujulisel põllul põllu sisse.
 * Pikkuskraadid skaleeritakse cos(laiuskraad) järgi, et kaugused oleks ligikaudu meetrilised.
 */
export function getGeometryLabelPoint(geometry?: Polygon | MultiPolygon | null): [number, number] | null {
  if (!geometry || !geometry.coordinates?.length) return null;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let best: Position[][] | null = null;
  let bestArea = -1;
  for (const poly of polygons) {
    if (!poly[0]?.length) continue;
    const area = Math.abs(ringSignedArea(poly[0]));
    if (area > bestArea) { bestArea = area; best = poly; }
  }
  if (!best) return null;

  const k = Math.cos((best[0][0][1] * Math.PI) / 180) || 1;
  const rings = best.map((ring) => ring.map(([lng, lat]) => [lng * k, lat] as [number, number]));
  const [x, y] = polylabel(rings, 1e-6);
  return [y, x / k];
}

/**
 * Massiivi sildi asukoht [lat, lng]: massiivi põldude ühend ja selle suurima osa ligipääsmatuse poolus.
 * Kui ühendamine ebaõnnestub, kasutatakse kõiki osapolügoone koos (suurim neist).
 */
export function getGeometriesLabelPoint(geometries: (Polygon | MultiPolygon)[]): [number, number] | null {
  const valid = geometries.filter((g) => g?.coordinates?.length);
  if (!valid.length) return null;
  if (valid.length > 1) {
    try {
      const merged = turf.union(turf.featureCollection(valid.map((g) => turf.feature(g))));
      if (merged) return getGeometryLabelPoint(merged.geometry);
    } catch {
      // vigane geomeetria — allpool ilma ühendamiseta
    }
  }
  const all: Position[][][] = valid.flatMap((g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates));
  return getGeometryLabelPoint({ type: 'MultiPolygon', coordinates: all });
}

function ringSignedArea(ring: Position[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return sum / 2;
}

// Punkti märgiga kaugus polügooni servast (positiivne sees, negatiivne väljas)
function pointToPolygonDist(x: number, y: number, rings: [number, number][][]): number {
  let inside = false;
  let minSq = Infinity;
  for (const ring of rings) {
    for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[j];
      if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      let px = bx, py = by, dx = ax - bx, dy = ay - by;
      if (dx !== 0 || dy !== 0) {
        const t = ((x - bx) * dx + (y - by) * dy) / (dx * dx + dy * dy);
        if (t > 1) { px = ax; py = ay; } else if (t > 0) { px += dx * t; py += dy * t; }
      }
      dx = x - px; dy = y - py;
      minSq = Math.min(minSq, dx * dx + dy * dy);
    }
  }
  return (inside ? 1 : -1) * Math.sqrt(minSq);
}

// Mapboxi polylabel-algoritm (ruutvõrgu jagamine, parim-esimesena otsing)
function polylabel(rings: [number, number][][], precision: number): [number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of rings[0]) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const width = maxX - minX, height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (cellSize === 0) return [minX, minY];

  type Cell = { x: number; y: number; h: number; d: number; max: number };
  const cell = (x: number, y: number, h: number): Cell => {
    const d = pointToPolygonDist(x, y, rings);
    return { x, y, h, d, max: d + h * Math.SQRT2 };
  };

  // Raskuskese algkandidaadiks
  let area = 0, cx = 0, cy = 0;
  const outer = rings[0];
  for (let i = 0, len = outer.length, j = len - 1; i < len; j = i++) {
    const [ax, ay] = outer[i], [bx, by] = outer[j];
    const f = ax * by - bx * ay;
    cx += (ax + bx) * f; cy += (ay + by) * f; area += f * 3;
  }
  let best = area !== 0 ? cell(cx / area, cy / area, 0) : cell(outer[0][0], outer[0][1], 0);
  const bbox = cell(minX + width / 2, minY + height / 2, 0);
  if (bbox.d > best.d) best = bbox;

  const queue: Cell[] = [];
  const h = cellSize / 2;
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) queue.push(cell(x + h, y + h, h));
  }

  let guard = 0;
  while (queue.length && guard++ < 10000) {
    let idx = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].max > queue[idx].max) idx = i;
    const c = queue.splice(idx, 1)[0];
    if (c.d > best.d) best = c;
    if (c.max - best.d <= precision) continue;
    const ch = c.h / 2;
    queue.push(cell(c.x - ch, c.y - ch, ch), cell(c.x + ch, c.y - ch, ch), cell(c.x - ch, c.y + ch, ch), cell(c.x + ch, c.y + ch, ch));
  }
  return [best.x, best.y];
}
