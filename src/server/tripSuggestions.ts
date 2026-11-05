// src/server/tripSuggestions.ts — kande telemeetria soovitused sõitude registrist ja kande ↔ sõidu seose kontroll.
// Soovitus = sõidu põllurida valitud põllul (füüsiline põld, mis tahes hooaeg), mis kattub valitud Tallinna kalendripäevaga.
// Sügistööd (nt sügiskülv) kuuluvad järgmise aasta hooaja alla, sõidu põllurida arvutatakse aga sõidu kalendriaasta hooaja vastu —
// seepärast võrreldakse põldu, mitte hooaega.
// Aeg, ha ja kütus tulevad registrist (sama, mida näitab Tehnika → Sõidud), mitte uuest GPS-arvutusest.
import { prisma } from './db.ts';
import { loadAssignmentResolver } from './tripAssignments.ts';
import { tallinnMidnightUtc } from './mcp/ignitionHours.ts';
import type { TripRoute, TripStop } from './tripRoute.ts';

export interface TelemetrySuggestion {
  id: string; // = tripId
  tripId: string;
  vehicleId: string | null;
  vehicleName: string | null;
  implementId: string | null;
  implementName: string | null;
  workerId: string | null;
  workerName: string | null;
  startTime: string; // sõidu algus; kui sõit käis enne teisel põllul, siis siia põllule jõudmine
  endTime: string; // sõidu lõpp; kui sõit läks pärast teisele põllule, siis siit lahkumine
  fieldStartTime: string; // põllu piiridesse jõudmine
  fieldEndTime: string; // põllu piiridest lahkumine
  durationHours: number; // põllul süütega oldud aeg
  workedAreaHa: number | null; // tühi = haakeriista laius puudub
  fuelLiters: number | null; // põllu kütus + osa teekütusest
  pointCount: number;
  linked: boolean; // muudetav kanne on juba selle sõiduga seotud
  route?: TripRoute; // sõidu teekond (algus, läbitud kohad, lõpp)
}

export const TRIP_NOT_ON_FIELD = 'Valitud sõit ei käinud sellel põllul';
export const TRIP_TAKEN = 'Valitud sõit on juba selle põllu teise kandega seotud';

const timeFmt = new Intl.DateTimeFormat('et-EE', { timeZone: 'Europe/Tallinn', hour: '2-digit', minute: '2-digit', hour12: false });
const hhmm = (d: Date) => timeFmt.format(d);

const nextDay = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

function stopOf(time: Date, lat: number, lng: number, json: unknown): TripStop {
  const p = (json ?? { place: null }) as { place?: TripStop['place']; near?: TripStop['near'] };
  return { time: time.toISOString(), lat, lng, place: p.place ?? null, ...(p.near ? { near: p.near } : {}) };
}

export async function getTelemetrySuggestionsForField(
  fieldSeasonId: number,
  dateStr: string,
  excludeEntryId?: string | null
): Promise<TelemetrySuggestion[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return [];
  const dayStart = tallinnMidnightUtc(dateStr);
  const dayEnd = tallinnMidnightUtc(nextDay(dateStr));
  const season = await prisma.fieldSeason.findUnique({ where: { id: fieldSeasonId }, select: { fieldId: true } });
  if (!season) return [];
  const fieldId = season.fieldId;
  const rows = await prisma.vehicleTripField.findMany({
    where: { fieldSeason: { fieldId }, arriveAt: { lt: dayEnd }, leaveAt: { gte: dayStart } },
    include: {
      trip: {
        include: {
          fields: { select: { arriveAt: true, leaveAt: true, fieldSeason: { select: { fieldId: true } } } },
          workEntries: { select: { id: true, fieldWork: { select: { fieldSeason: { select: { fieldId: true } } } } } }
        }
      }
    },
    orderBy: { arriveAt: 'asc' }
  });
  if (rows.length === 0) return [];
  const resolve = await loadAssignmentResolver(rows.map((r) => r.trip.deviceId));
  const out: TelemetrySuggestion[] = [];
  for (const r of rows) {
    const t = r.trip;
    const own = t.workEntries.filter((e) => e.fieldWork.fieldSeason.fieldId === fieldId);
    // Sama põllu teise kandega seotud sõitu ei pakuta (teise põllu kanne ei sega)
    if (own.some((e) => e.id !== excludeEntryId)) continue;
    const target = resolve(t.deviceId, r.arriveAt);
    // Kui sõit käis enne/pärast teistel põldudel, jagatakse aeg põllu piiril
    const others = t.fields.filter((f) => f.fieldSeason.fieldId !== fieldId);
    const fieldBefore = others.some((f) => f.arriveAt < r.arriveAt);
    const fieldAfter = others.some((f) => f.leaveAt > r.leaveAt);
    out.push({
      id: t.id,
      tripId: t.id,
      vehicleId: target.vehicleId,
      vehicleName: target.vehicleName,
      implementId: target.implementId,
      implementName: target.implementName,
      workerId: null, // töötaja valitakse kandel
      workerName: null,
      startTime: hhmm(fieldBefore ? r.arriveAt : t.startedAt),
      endTime: hhmm(fieldAfter ? r.leaveAt : t.endedAt),
      fieldStartTime: hhmm(r.arriveAt),
      fieldEndTime: hhmm(r.leaveAt),
      durationHours: Math.round((r.activeMinutes / 60) * 100) / 100,
      workedAreaHa: r.areaHa,
      fuelLiters: r.fuelSharedL,
      pointCount: t.pointCount,
      linked: !!excludeEntryId && own.some((e) => e.id === excludeEntryId),
      route: {
        start: stopOf(t.startedAt, t.startLat, t.startLng, t.startPlace),
        end: stopOf(t.endedAt, t.endLat, t.endLng, t.endPlace),
        visits: (t.visits as unknown as TripRoute['visits'] | null) ?? []
      }
    });
  }
  return out.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Kande sõidu seose kontroll: sõidul peab olema selle põllu rida (mis tahes hooaeg) ja sõit ei tohi olla sama põllu teise kandega seotud. */
export async function entryTripError(tripId: string, fieldSeasonId: number, entryId: string | null): Promise<string | null> {
  const season = await prisma.fieldSeason.findUnique({ where: { id: fieldSeasonId }, select: { fieldId: true } });
  if (!season) return TRIP_NOT_ON_FIELD;
  const fieldId = season.fieldId;
  const row = await prisma.vehicleTripField.findFirst({ where: { tripId, fieldSeason: { fieldId } }, select: { id: true } });
  if (!row) return TRIP_NOT_ON_FIELD;
  const other = await prisma.workEntry.findFirst({
    where: { tripId, fieldWork: { fieldSeason: { fieldId } }, ...(entryId ? { id: { not: entryId } } : {}) },
    select: { id: true }
  });
  return other ? TRIP_TAKEN : null;
}
