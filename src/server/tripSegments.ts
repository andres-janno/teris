// src/server/tripSegments.ts — telemeetria punktid → sõidud (süüde sisse → välja) ja nende mõõdikud.
// Puhas: andmebaasi ei puutu. Sõit jätkub üle lühikese pausi (süüde väljas ≤ PAUSE_MAX_MS);
// pikem väljalülitus või andmeauk > TRIP_GAP_MS lõpetab sõidu.
import { TRIP_GAP_MS } from './tripRoute.ts';

export type TripSample = {
  time: Date;
  lat: number;
  lng: number;
  ignition: boolean | null; // null = seade süütet ei saada → loetakse sees olevaks
  speedKmh: number | null;
  fuelUsedL: number | null; // kumulatiivne kütusekulu (l)
  fuelRateLph: number | null; // hetkekulu (l/h)
  fuelLevelPct: number | null;
  engineHours: number | null; // mootori koguaja näit (h)
};

export type SegmentedTrip = {
  startedAt: Date;
  endedAt: Date;
  status: 'ACTIVE' | 'CLOSED';
  points: TripSample[]; // ainult süüte sees punktid
  distanceKm: number;
  movingMinutes: number;
  idleMinutes: number;
  pauseCount: number;
  pauseMinutes: number;
  maxSpeedKmh: number | null;
  avgSpeedKmh: number | null;
  fuelLiters: number | null;
  fuelLevelStartPct: number | null;
  fuelLevelEndPct: number | null;
  engineHoursStart: number | null;
  engineHoursEnd: number | null;
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  pointCount: number;
};

export const PAUSE_MAX_MS = 10 * 60 * 1000;
const STEP_MAX_MS = 5 * 60 * 1000; // pikem vahe süütega punktide vahel ei lähe liikumis-/seisuaega
const MIN_TRIP_MS = 60 * 1000;
const MIN_POINTS = 3;
const MOVING_KMH = 2;
const JITTER_M = 5;
const EARTH_RADIUS_M = 6371000;

const isOn = (s: TripSample) => s.ignition !== false;
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function distanceM(a: TripSample, b: TripSample): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

type Draft = { points: TripSample[]; breaks: Set<number>; pauseCount: number; pauseMs: number };

const firstOf = (pts: TripSample[], f: (p: TripSample) => number | null) => {
  for (const p of pts) { const v = f(p); if (v != null) return v; }
  return null;
};
const lastOf = (pts: TripSample[], f: (p: TripSample) => number | null) => {
  for (let i = pts.length - 1; i >= 0; i--) { const v = f(pts[i]); if (v != null) return v; }
  return null;
};

function fuelLiters(d: Draft): number | null {
  const counter = d.points.filter((p) => p.fuelUsedL != null);
  if (counter.length >= 2) {
    let sum = 0;
    for (let i = 1; i < counter.length; i++) {
      const inc = counter[i].fuelUsedL! - counter[i - 1].fuelUsedL!;
      if (inc > 0) sum += inc; // loenduri nullimine (langus) ei loe
    }
    return round(sum, 2);
  }
  let seen = false;
  let sum = 0;
  for (let i = 1; i < d.points.length; i++) {
    const prev = d.points[i - 1];
    if (prev.fuelRateLph == null) continue;
    seen = true;
    if (d.breaks.has(i)) continue;
    sum += prev.fuelRateLph * ((d.points[i].time.getTime() - prev.time.getTime()) / 3_600_000);
  }
  return seen ? round(sum, 2) : null;
}

function build(d: Draft, status: 'ACTIVE' | 'CLOSED'): SegmentedTrip {
  const pts = d.points;
  let distM = 0;
  let movingMs = 0;
  let idleMs = 0;
  let maxSpeed: number | null = null;
  let minLat = pts[0].lat, maxLat = pts[0].lat, minLng = pts[0].lng, maxLng = pts[0].lng;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.speedKmh != null) maxSpeed = maxSpeed == null ? p.speedKmh : Math.max(maxSpeed, p.speedKmh);
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
    if (i === 0) continue;
    const step = distanceM(pts[i - 1], p);
    if (!(step < JITTER_M && (p.speedKmh ?? 0) < MOVING_KMH)) distM += step;
    if (d.breaks.has(i)) continue;
    const dt = p.time.getTime() - pts[i - 1].time.getTime();
    if ((p.speedKmh ?? 0) >= MOVING_KMH) movingMs += dt;
    else idleMs += dt;
  }
  const distanceKm = round(distM / 1000, 2);
  const movingMinutes = round(movingMs / 60_000, 1);
  return {
    startedAt: pts[0].time,
    endedAt: pts[pts.length - 1].time,
    status,
    points: pts,
    distanceKm,
    movingMinutes,
    idleMinutes: round(idleMs / 60_000, 1),
    pauseCount: d.pauseCount,
    pauseMinutes: round(d.pauseMs / 60_000, 1),
    maxSpeedKmh: maxSpeed,
    avgSpeedKmh: movingMinutes > 0 ? round(distanceKm / (movingMinutes / 60), 1) : null,
    fuelLiters: fuelLiters(d),
    fuelLevelStartPct: firstOf(pts, (p) => p.fuelLevelPct),
    fuelLevelEndPct: lastOf(pts, (p) => p.fuelLevelPct),
    engineHoursStart: firstOf(pts, (p) => p.engineHours),
    engineHoursEnd: lastOf(pts, (p) => p.engineHours),
    minLat, minLng, maxLat, maxLng,
    pointCount: pts.length
  };
}

/** Punktid (ajas kasvavalt) → sõidud. `now` määrab, kas viimane sõit on veel käimas. */
export function segmentTrips(samples: TripSample[], now: Date): SegmentedTrip[] {
  const drafts: Draft[] = [];
  let cur: Draft | null = null;
  let offSeen = false; // pärast viimast süütega punkti tuli süüde väljas
  for (const s of samples) {
    if (!isOn(s)) {
      if (cur) offSeen = true;
      continue;
    }
    if (cur) {
      const last = cur.points[cur.points.length - 1];
      const diff = s.time.getTime() - last.time.getTime();
      if (offSeen ? diff <= PAUSE_MAX_MS : diff <= TRIP_GAP_MS) {
        if (offSeen) {
          cur.pauseCount++;
          cur.pauseMs += diff;
          cur.breaks.add(cur.points.length);
        } else if (diff > STEP_MAX_MS) {
          cur.breaks.add(cur.points.length);
        }
        cur.points.push(s);
        offSeen = false;
        continue;
      }
      drafts.push(cur);
    }
    cur = { points: [s], breaks: new Set(), pauseCount: 0, pauseMs: 0 };
    offSeen = false;
  }
  let lastOpen = false;
  if (cur) {
    drafts.push(cur);
    const age = now.getTime() - cur.points[cur.points.length - 1].time.getTime();
    lastOpen = offSeen ? age <= PAUSE_MAX_MS : age <= TRIP_GAP_MS;
  }
  const out: SegmentedTrip[] = [];
  drafts.forEach((d, i) => {
    const span = d.points[d.points.length - 1].time.getTime() - d.points[0].time.getTime();
    if (d.points.length < MIN_POINTS || span < MIN_TRIP_MS) return;
    out.push(build(d, i === drafts.length - 1 && lastOpen ? 'ACTIVE' : 'CLOSED'));
  });
  return out;
}
