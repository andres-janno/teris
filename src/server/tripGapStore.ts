// src/server/tripGapStore.ts — sõitude vahede salvestus: seadme vahed ajaaknas uuesti → vehicle_trip_gaps.
// Vahe võti on järgmine sõit (nextTripId). Ümberarvutus uuendab märke, kontrolli märge jääb alles;
// vahe, mis enam piiri ei ületa, kustutatakse — v.a. kontrollitud (läbivaadatud otsust ei kustutata).
import { prisma, tenantTransaction, type TxClient } from './db.ts';
import { computeGaps, HOURS_LOOKAROUND_MS, type GapCalc, type GapSample, type GapTrip } from './tripGaps.ts';

export type FetchGapSamples = (imei: string, fromExclusive: Date, toInclusive: Date) => Promise<GapSample[]>;

// Üheaegsed impordid ja API muudatused ei tohi sama seadme sõite ega vahesid korraga kirjutada
export const lockDevice = (tx: TxClient, deviceId: string) =>
  tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('trip-import:' || current_setting('app.tenant_id') || ':' || ${deviceId}))`;

const TRIP_SELECT = {
  id: true, startedAt: true, endedAt: true, startLat: true, startLng: true, endLat: true, endLng: true,
  fuelLevelStartPct: true, fuelLevelEndPct: true
} as const;

/** Vahed sõitudele, mille algus on (from, to]; vahe eelmine sõit võib olla varasem. */
export async function recomputeGaps(
  device: { id: string; imei: string }, from: Date, to: Date, fetchGapSamples: FetchGapSamples, now = new Date()
): Promise<void> {
  const [dev, prev, inWindow] = await Promise.all([
    prisma.telemetryDevice.findUnique({ where: { id: device.id }, select: { reportsWhenParked: true } }),
    prisma.vehicleTrip.findFirst({
      where: { deviceId: device.id, deletedAt: null, startedAt: { lte: from } }, orderBy: { startedAt: 'desc' }, select: TRIP_SELECT
    }),
    prisma.vehicleTrip.findMany({
      where: { deviceId: device.id, deletedAt: null, startedAt: { gt: from, lte: to } }, orderBy: { startedAt: 'asc' }, select: TRIP_SELECT
    })
  ]);
  const trips: GapTrip[] = prev ? [prev, ...inWindow] : inWindow;
  let calcs: GapCalc[] = [];
  if (trips.length >= 2) {
    const samples = await fetchGapSamples(
      device.imei,
      new Date(trips[0].endedAt.getTime() - HOURS_LOOKAROUND_MS),
      new Date(trips[trips.length - 1].startedAt.getTime() + HOURS_LOOKAROUND_MS)
    );
    calcs = computeGaps(trips, samples, { parkedSigns: dev?.reportsWhenParked === true });
  }
  await tenantTransaction(async (tx) => {
    await lockDevice(tx, device.id);
    const existing = await tx.vehicleTripGap.findMany({
      where: { deviceId: device.id, nextTrip: { startedAt: { gt: from, lte: to } } },
      select: { id: true, nextTripId: true, reviewedAt: true }
    });
    const keep = new Set(calcs.map((c) => c.nextTripId));
    const drop = existing.filter((g) => !keep.has(g.nextTripId) && !g.reviewedAt).map((g) => g.id);
    if (drop.length) await tx.vehicleTripGap.deleteMany({ where: { id: { in: drop } } });
    for (const c of calcs) {
      const data = {
        prevTripId: c.prevTripId, startedAt: c.startedAt, endedAt: c.endedAt,
        powerLostMinutes: c.powerLostMinutes, silentMinutes: c.silentMinutes, fuelDropPct: c.fuelDropPct,
        jumpM: c.jumpM, engineHoursGrowth: c.engineHoursGrowth, computedAt: now
      };
      await tx.vehicleTripGap.upsert({
        where: { nextTripId: c.nextTripId },
        create: { deviceId: device.id, nextTripId: c.nextTripId, ...data },
        update: data
      });
    }
  }, { timeout: 60_000 });
}
