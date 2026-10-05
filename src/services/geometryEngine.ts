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
  };
  fields?: { features: FieldFeature[] };
  vehicles?: { position?: [number, number] }[];
  cultivationPass?: { swathPolygon?: any; points?: { lat: number; lng: number }[] };
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


