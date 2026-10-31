// src/server/mcp/ignitionHours.ts — masina töötunnid süüte järgi päevade kaupa (Tallinna aeg).
// Kahe järjestikuse süüte-sees punkti vahe loetakse tööajaks, kui see ei ületa gapMs (sama reegel mis sõidu tuvastusel).
import { TRIP_GAP_MS } from '../tripRoute.ts';

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn' });

export function ignitionHoursByDay(points: { time: Date; ignition: boolean | null }[], gapMs: number = TRIP_GAP_MS): { day: string; hours: number }[] {
  const ms = new Map<string, number>();
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.ignition === false || b.ignition === false) continue;
    const dt = b.time.getTime() - a.time.getTime();
    if (dt <= 0 || dt > gapMs) continue;
    const day = dayFmt.format(a.time);
    ms.set(day, (ms.get(day) ?? 0) + dt);
  }
  return [...ms].sort(([x], [y]) => x.localeCompare(y)).map(([day, v]) => ({ day, hours: Math.round((v / 3_600_000) * 100) / 100 }));
}

const offsetFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Tallinn', timeZoneName: 'longOffset' });

// UTC hetk, mil Tallinnas algab antud päev (aaaa-kk-pp, 00:00). Nihe võetakse eelmise päeva keskpäeval,
// sest suve-/talveaja üleminek toimub öösel pärast kesköö-hetke.
export function tallinnMidnightUtc(isoDay: string): Date {
  const [y, m, d] = isoDay.split('-').map(Number);
  const ref = new Date(Date.UTC(y, m - 1, d - 1, 12));
  const name = offsetFmt.formatToParts(ref).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+2';
  const mt = /GMT([+-])(\d+)(?::(\d+))?/.exec(name);
  const offsetMin = mt ? (mt[1] === '-' ? -1 : 1) * (Number(mt[2]) * 60 + Number(mt[3] ?? 0)) : 0;
  return new Date(Date.UTC(y, m - 1, d) - offsetMin * 60_000);
}
