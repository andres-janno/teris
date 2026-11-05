// src/server/tripFields.ts — sõidu põllud: põllul oldud aeg, kaetud pindala ja kütus põldude kaupa.
// Puhas: andmebaasi ei puutu. Sisend on sõidu ajavahemiku kõik punktid (ka süüde väljas — need tähistavad pause).
// Põllu punktide jada katkeb (brk), kui vahepeal käidi põllult väljas, süüde oli väljas või vahe > 5 min;
// katkestust ei loeta põllul oldud ajaks, kütuseks ega kaetud jooneks.
import * as turf from '@turf/turf';
import type { MultiPolygon, Polygon } from 'geojson';
import type { TripSample } from './tripSegments.ts';
import type { Place } from './tripRoute.ts';
import { coverageAreaHa, type CoveragePoint } from './coverageArea.ts';

export type ImplementAt = (at: Date) => { implementId: string | null; widthM: number | null };

export type TripFieldCalc = {
  fieldSeasonId: number;
  arriveAt: Date;
  leaveAt: Date;
  activeMinutes: number;
  areaHa: number | null; // tühi = haakeriista laius puudub
  implementId: string | null;
  widthM: number | null;
  fuelFieldL: number | null;
  fuelSharedL: number | null; // põllu kütus + osa teekütusest
};

export const FIELD_STEP_MAX_MS = 5 * 60 * 1000;
const MIN_FIELD_POINTS = 3;
const MIN_FIELD_ACTIVE_MS = 60 * 1000;

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

type PreparedField = { id: number; geometry: Polygon | MultiPolygon; bbox: [number, number, number, number] };

function prepareFields(places: Place[]): PreparedField[] {
  const out: PreparedField[] = [];
  for (const p of places) {
    if (p.kind !== 'FIELD' || !p.geometry) continue;
    const id = Number(p.id);
    if (!Number.isInteger(id)) continue;
    try {
      out.push({ id, geometry: p.geometry, bbox: turf.bbox(p.geometry) as [number, number, number, number] });
    } catch {
      // vigane geomeetria — põld jääb välja
    }
  }
  return out;
}

function fieldOf(fields: PreparedField[], lng: number, lat: number): PreparedField | null {
  for (const f of fields) {
    const [a, b, c, d] = f.bbox;
    if (lng < a || lng > c || lat < b || lat > d) continue;
    try {
      if (turf.booleanPointInPolygon([lng, lat], f.geometry)) return f;
    } catch {
      // vigane geomeetria
    }
  }
  return null;
}

type Acc = {
  field: PreparedField;
  points: CoveragePoint[];
  arriveAt: Date;
  leaveAt: Date;
  activeMs: number;
  fuel: number;
  runCounter: number | null; // kütuseloenduri viimane näit selles katkematus jadas
};

export function computeTripFields(samples: TripSample[], places: Place[], tripFuelL: number | null, implementAt: ImplementAt): TripFieldCalc[] {
  const fields = prepareFields(places);
  if (fields.length === 0) return [];
  const on = samples.filter((s) => s.ignition !== false);
  // Sama allikas, mis sõidu kütusel (tripSegments): loendur, kui vähemalt 2 näitu, muidu tunnikulu
  const useCounter = on.filter((s) => s.fuelUsedL != null).length >= 2;
  const useRate = !useCounter && on.some((s) => s.fuelRateLph != null);
  const acc = new Map<number, Acc>();
  let prev: { sample: TripSample; fieldId: number | null } | null = null;
  let offSeen = false;
  for (const s of samples) {
    if (s.ignition === false) {
      if (prev) offSeen = true;
      continue;
    }
    const f = fieldOf(fields, s.lng, s.lat);
    const dt = prev ? s.time.getTime() - prev.sample.time.getTime() : Infinity;
    const contiguous = !!prev && !offSeen && f != null && prev.fieldId === f.id && dt <= FIELD_STEP_MAX_MS;
    if (f) {
      let a = acc.get(f.id);
      if (!a) {
        a = { field: f, points: [], arriveAt: s.time, leaveAt: s.time, activeMs: 0, fuel: 0, runCounter: null };
        acc.set(f.id, a);
      }
      a.points.push({ lat: s.lat, lng: s.lng, brk: !contiguous });
      a.leaveAt = s.time;
      if (contiguous) a.activeMs += dt;
      if (useCounter) {
        const c = s.fuelUsedL;
        if (!contiguous) a.runCounter = c;
        else if (c != null) {
          if (a.runCounter != null && c > a.runCounter) a.fuel += c - a.runCounter; // loenduri nullimine (langus) ei loe
          a.runCounter = c;
        }
      } else if (useRate && contiguous && prev!.sample.fuelRateLph != null) {
        a.fuel += prev!.sample.fuelRateLph * (dt / 3_600_000);
      }
    }
    prev = { sample: s, fieldId: f?.id ?? null };
    offSeen = false;
  }

  // Läbisõit serva pealt ei ole põllutöö
  const kept = [...acc.values()].filter((a) => a.points.length >= MIN_FIELD_POINTS && a.activeMs >= MIN_FIELD_ACTIVE_MS);
  const fuelOf = (a: Acc) => (useCounter || useRate ? round(a.fuel, 2) : null);
  const totalActive = kept.reduce((sum, a) => sum + a.activeMs, 0);
  const fieldFuel = kept.reduce((sum, a) => sum + (fuelOf(a) ?? 0), 0);
  const roadFuel = tripFuelL == null ? null : Math.max(0, tripFuelL - fieldFuel);
  return kept
    .sort((x, y) => x.arriveAt.getTime() - y.arriveAt.getTime())
    .map((a) => {
      const impl = implementAt(a.arriveAt);
      const widthM = impl.widthM != null && impl.widthM > 0 ? impl.widthM : null;
      const fuelFieldL = fuelOf(a);
      return {
        fieldSeasonId: a.field.id,
        arriveAt: a.arriveAt,
        leaveAt: a.leaveAt,
        activeMinutes: round(a.activeMs / 60_000, 1),
        areaHa: widthM ? coverageAreaHa(a.points, a.field.geometry, widthM) : null,
        implementId: impl.implementId,
        widthM,
        fuelFieldL,
        fuelSharedL: roadFuel == null
          ? null
          : round((fuelFieldL ?? 0) + (totalActive > 0 ? (roadFuel * a.activeMs) / totalActive : 0), 2)
      };
    });
}

/** Sõidu ha = põldude summa; tühi, kui ühelgi põllul pole ha-d. */
export function tripAreaHa(fields: TripFieldCalc[]): number | null {
  const vals = fields.map((f) => f.areaHa).filter((v): v is number => v != null);
  return vals.length ? round(vals.reduce((sum, v) => sum + v, 0), 2) : null;
}
