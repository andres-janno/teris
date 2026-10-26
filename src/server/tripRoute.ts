// src/server/tripRoute.ts — telemeetria sõidu teekond: algus, läbitud kohad (põllud, huvipunktid) ja lõpp.
// Puhtad funktsioonid (segmentTrip, buildRoute) ei puutu andmebaasi; loadPlaces laeb kohad ettevõtte piires.
// Koordinaate ei saadeta kuhugi välja — kohad tuvastatakse ainult oma põldude ja huvipunktide järgi.
import * as turf from '@turf/turf';
import type { Polygon, MultiPolygon, Position } from 'geojson';

export type TripPoint = { time: Date; lat: number; lng: number; ignition: boolean | null };

export type PlaceRef = { id: string; kind: 'FIELD' | 'POI'; label: string };

export type Place = PlaceRef & {
  geometry?: Polygon | MultiPolygon;
  lat?: number;
  lng?: number;
};

export type TripStop = { time: string; lat: number; lng: number; place: PlaceRef | null };
export type TripVisit = { place: PlaceRef; arrive: string; leave: string };
export type TripRoute = { start: TripStop; end: TripStop; visits: TripVisit[] };

export type RouteOptions = {
  fieldRadiusM: number;
  poiRadiusM: number;
  minVisitMs: number;
  preferPlaceId?: string;
};

export const DEFAULT_ROUTE_OPTIONS: RouteOptions = { fieldRadiusM: 10, poiRadiusM: 25, minVisitMs: 60_000 };
export const TRIP_GAP_MS = 20 * 60 * 1000;

const isOn = (p: TripPoint) => p.ignition !== false;

/**
 * Sõit = ühe seadme katkematu süüte-sees-jada, mis sisaldab põllusessiooni [sessionStart, sessionEnd].
 * Laiendatakse sessioonist mõlemale poole, kuni süüde lülitub välja või punktide vahe ületab gapMs.
 * Süüteväljata seadme punktid (ignition = null) loetakse süüte sees olevaks. Punktid peavad olema ajas kasvavalt.
 */
export function segmentTrip(
  points: TripPoint[],
  sessionStart: Date,
  sessionEnd: Date,
  opts: { gapMs?: number } = {}
): { start: Date; end: Date; points: TripPoint[] } | null {
  const gapMs = opts.gapMs ?? TRIP_GAP_MS;
  const s0 = sessionStart.getTime();
  const s1 = sessionEnd.getTime();
  let first = -1;
  let last = -1;
  for (let i = 0; i < points.length; i++) {
    const t = points[i].time.getTime();
    if (t < s0 || t > s1 || !isOn(points[i])) continue;
    if (first < 0) first = i;
    last = i;
  }
  if (first < 0) return null;

  while (first > 0 && isOn(points[first - 1]) && points[first].time.getTime() - points[first - 1].time.getTime() <= gapMs) first--;
  while (last < points.length - 1 && isOn(points[last + 1]) && points[last + 1].time.getTime() - points[last].time.getTime() <= gapMs) last++;

  const tripPoints = points.slice(first, last + 1).filter(isOn);
  return { start: tripPoints[0].time, end: tripPoints[tripPoints.length - 1].time, points: tripPoints };
}

type PreparedPlace = {
  ref: PlaceRef;
  bbox: [number, number, number, number]; // laiendatud raadiuse võrra
  poly?: Polygon | MultiPolygon;
  rings?: Position[][];
  center?: [number, number];
  radiusM: number;
};

const M_PER_DEG_LAT = 110_574;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

function preparePlaces(places: Place[], opts: RouteOptions): PreparedPlace[] {
  const out: PreparedPlace[] = [];
  for (const p of places) {
    const ref: PlaceRef = { id: p.id, kind: p.kind, label: p.label };
    try {
      if (p.kind === 'FIELD' && p.geometry) {
        const [minLng, minLat, maxLng, maxLat] = turf.bbox(p.geometry);
        const r = opts.fieldRadiusM;
        const dLat = (r * 1.5) / M_PER_DEG_LAT;
        const dLng = (r * 1.5) / mPerDegLng(maxLat);
        const rings = p.geometry.type === 'Polygon' ? p.geometry.coordinates : p.geometry.coordinates.flat();
        out.push({ ref, poly: p.geometry, rings, radiusM: r, bbox: [minLng - dLng, minLat - dLat, maxLng + dLng, maxLat + dLat] });
      } else if (p.kind === 'POI' && p.lat != null && p.lng != null) {
        const r = opts.poiRadiusM;
        const dLat = (r * 1.5) / M_PER_DEG_LAT;
        const dLng = (r * 1.5) / mPerDegLng(p.lat);
        out.push({ ref, center: [p.lng, p.lat], radiusM: r, bbox: [p.lng - dLng, p.lat - dLat, p.lng + dLng, p.lat + dLat] });
      }
    } catch {
      // vigane geomeetria — koht jääb välja
    }
  }
  return out;
}

/** Kaugus kohast meetrites (0 = polügooni sees) või null, kui raadiusest väljas. */
function distanceTo(place: PreparedPlace, lng: number, lat: number): number | null {
  const [a, b, c, d] = place.bbox;
  if (lng < a || lng > c || lat < b || lat > d) return null;
  const pt = turf.point([lng, lat]);
  if (place.poly) {
    if (turf.booleanPointInPolygon(pt, place.poly)) return 0;
    let best = Infinity;
    for (const ring of place.rings ?? []) {
      if (ring.length < 2) continue;
      const dist = turf.pointToLineDistance(pt, turf.lineString(ring), { units: 'meters' });
      if (dist < best) best = dist;
    }
    return best <= place.radiusM ? best : null;
  }
  if (place.center) {
    const dist = turf.distance(pt, turf.point(place.center), { units: 'meters' });
    return dist <= place.radiusM ? dist : null;
  }
  return null;
}

function matchPlace(prepared: PreparedPlace[], lng: number, lat: number, preferPlaceId?: string): PlaceRef | null {
  let best: PlaceRef | null = null;
  let bestDist = Infinity;
  for (const p of prepared) {
    const dist = distanceTo(p, lng, lat);
    if (dist == null) continue;
    if (preferPlaceId && p.ref.id === preferPlaceId) return p.ref;
    if (dist < bestDist) {
      bestDist = dist;
      best = p.ref;
    }
  }
  return best;
}

/**
 * Teekond sõidu punktidest: algus, lõpp ja vahepealsed külastused (järjestikused punktid sama koha sees).
 * Lühemad kui minVisitMs külastused (GPS-i hüpped) jäetakse välja; alguse/lõpu koht näidatakse alati.
 */
export function buildRoute(points: TripPoint[], places: Place[], opts: RouteOptions): TripRoute {
  if (points.length === 0) throw new Error('buildRoute: punktid puuduvad');
  const prepared = preparePlaces(places, opts);
  const matches = points.map((p) => matchPlace(prepared, p.lng, p.lat, opts.preferPlaceId));

  const stop = (i: number): TripStop => ({ time: points[i].time.toISOString(), lat: points[i].lat, lng: points[i].lng, place: matches[i] });

  // Järjestikused sama koha punktide jadad
  const runs: { place: PlaceRef; from: number; to: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    const m = matches[i];
    if (!m) continue;
    const lastRun = runs[runs.length - 1];
    if (lastRun && lastRun.place.id === m.id && lastRun.to === i - 1) lastRun.to = i;
    else runs.push({ place: m, from: i, to: i });
  }

  const visits: TripVisit[] = [];
  for (const r of runs) {
    const arrive = points[r.from].time;
    const leave = points[r.to].time;
    if (leave.getTime() - arrive.getTime() < opts.minVisitMs) continue;
    const prev = visits[visits.length - 1];
    // Lühikese hüppe tõttu katkenud sama koha külastus liidetakse
    if (prev && prev.place.id === r.place.id) prev.leave = leave.toISOString();
    else visits.push({ place: r.place, arrive: arrive.toISOString(), leave: leave.toISOString() });
  }

  return { start: stop(0), end: stop(points.length - 1), visits };
}
