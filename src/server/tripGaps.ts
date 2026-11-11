// src/server/tripGaps.ts — sõitude vahede kontroll: kahe järjestikuse sõidu vahelised jälgimata töö märgid.
// Toide kadus ja seade vaikis arvutatakse ainult seadmetele, mis saadavad andmeid ka seisu ajal (parkedSigns); teistel on need tühjad.
// Puhas: andmebaasi ei puutu. Vahe = eelmise sõidu lõpp → järgmise sõidu algus; tagastatakse ainult piiri ületanud vahed.
import { GAP_LIMITS } from '../services/tripGapLimits.ts';

export type GapTrip = {
  id: string;
  startedAt: Date;
  endedAt: Date;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  fuelLevelStartPct: number | null;
  fuelLevelEndPct: number | null;
};

// Seadme punkt: pinge (V) ja masina CAN mootori koguaeg (h); kumbki võib puududa
export type GapSample = { time: Date; voltage: number | null; canHours: number | null };

export type GapSigns = {
  powerLostMinutes: number | null;
  silentMinutes: number | null;
  fuelDropPct: number | null;
  jumpM: number;
  engineHoursGrowth: number | null;
};

export type GapCalc = GapSigns & { prevTripId: string; nextTripId: string; startedAt: Date; endedAt: Date };

export const LOW_VOLTAGE_V = 6;
export const HOURS_LOOKAROUND_MS = 60 * 60 * 1000;
const SILENT_MS = GAP_LIMITS.silentMinutes * 60_000;
const EARTH_RADIUS_M = 6371000;
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLng = (bLng - aLng) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export const isFlagged = (g: GapSigns): boolean =>
  (g.powerLostMinutes ?? 0) >= GAP_LIMITS.powerLostMinutes ||
  (g.silentMinutes ?? 0) >= GAP_LIMITS.silentMinutes ||
  (g.fuelDropPct ?? 0) >= GAP_LIMITS.fuelDropPct ||
  g.jumpM >= GAP_LIMITS.jumpM ||
  (g.engineHoursGrowth ?? 0) >= GAP_LIMITS.engineHoursGrowth;

function signsOf(prev: GapTrip, next: GapTrip, samples: GapSample[], parkedSigns: boolean): GapSigns {
  const s = prev.endedAt.getTime();
  const e = next.startedAt.getTime();
  const inside = samples.filter((p) => p.time.getTime() >= s && p.time.getTime() <= e);

  // Seade vaikis: pikim paus punktide vahel, vahe algus ja lõpp kaasa
  let silentMs = 0;
  let last = s;
  for (const p of inside) {
    silentMs = Math.max(silentMs, p.time.getTime() - last);
    last = p.time.getTime();
  }
  silentMs = Math.max(silentMs, e - last);

  // Toide kadus: pingepunktist järgmiseni (viimasest vahe lõpuni), kui pinge < 6 V; vaikimise aega (≥ 3 h) ei loeta
  const volt = inside.filter((p) => p.voltage != null);
  let powerLostMinutes: number | null = null;
  if (parkedSigns && volt.length) {
    let ms = 0;
    for (let i = 0; i < volt.length; i++) {
      const t = volt[i].time.getTime();
      const dt = (i + 1 < volt.length ? volt[i + 1].time.getTime() : e) - t;
      if (volt[i].voltage! < LOW_VOLTAGE_V && dt < SILENT_MS) ms += dt;
    }
    powerLostMinutes = round(ms / 60_000, 1);
  }

  // CAN mootoritunnid: viimane näit enne vahet ja esimene pärast (kuni 1 h väljapoole)
  let before: number | null = null;
  let after: number | null = null;
  for (const p of samples) {
    if (p.canHours == null) continue;
    const t = p.time.getTime();
    if (t <= s && t >= s - HOURS_LOOKAROUND_MS) before = p.canHours;
    if (t >= e && t <= e + HOURS_LOOKAROUND_MS && after == null) after = p.canHours;
  }

  const fuelDropPct = prev.fuelLevelEndPct != null && next.fuelLevelStartPct != null
    ? round(prev.fuelLevelEndPct - next.fuelLevelStartPct, 1)
    : null;

  return {
    powerLostMinutes,
    silentMinutes: parkedSigns ? round(silentMs / 60_000, 1) : null,
    fuelDropPct,
    jumpM: Math.round(distanceM(prev.endLat, prev.endLng, next.startLat, next.startLng)),
    engineHoursGrowth: before != null && after != null ? round(after - before, 2) : null
  };
}

/** Kustutamata sõidud (ajas kasvavalt) ja seadme punktid (ajas kasvavalt) → piiri ületanud vahed. */
export function computeGaps(trips: GapTrip[], samples: GapSample[], opts: { parkedSigns: boolean } = { parkedSigns: true }): GapCalc[] {
  const out: GapCalc[] = [];
  for (let i = 1; i < trips.length; i++) {
    const prev = trips[i - 1];
    const next = trips[i];
    if (next.startedAt.getTime() <= prev.endedAt.getTime()) continue;
    const signs = signsOf(prev, next, samples, opts.parkedSigns);
    if (!isFlagged(signs)) continue;
    out.push({ prevTripId: prev.id, nextTripId: next.id, startedAt: prev.endedAt, endedAt: next.startedAt, ...signs });
  }
  return out;
}
