// src/components/tripGapText.ts — sõitude vahe hoiatuse tekst: piiri ületanud märgid (mootoritunnid alates +1 h).
import type { TripGap } from '../types/fleet';
import { ENGINE_HOURS_SHOWN_FROM, GAP_LIMITS } from '../services/tripGapLimits';

const num = (n: number, digits: number) => n.toLocaleString('et-EE', { maximumFractionDigits: digits });

export function minutesText(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h} h ${String(r).padStart(2, '0')} min` : `${r} min`;
}

export function gapParts(g: TripGap): string[] {
  const parts: string[] = [];
  if ((g.powerLostMinutes ?? 0) >= GAP_LIMITS.powerLostMinutes) parts.push(`toide kadus ${minutesText(g.powerLostMinutes!)}`);
  if ((g.silentMinutes ?? 0) >= GAP_LIMITS.silentMinutes) parts.push(`seade vaikis ${minutesText(g.silentMinutes!)}`);
  if ((g.fuelDropPct ?? 0) >= GAP_LIMITS.fuelDropPct) parts.push(`kütus −${num(g.fuelDropPct!, 1)}%`);
  if ((g.jumpM ?? 0) >= GAP_LIMITS.jumpM) {
    parts.push(g.jumpM! >= 1000 ? `asukoht +${num(g.jumpM! / 1000, 1)} km` : `asukoht +${Math.round(g.jumpM!)} m`);
  }
  if ((g.engineHoursGrowth ?? 0) >= ENGINE_HOURS_SHOWN_FROM) parts.push(`mootoritunnid +${num(g.engineHoursGrowth!, 2)} h`);
  return parts;
}
