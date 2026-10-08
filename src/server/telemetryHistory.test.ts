import { describe, it, expect } from 'vitest';
import { prisma, tsdb } from './db';
import { getTelemetrySuggestionsForField } from './fieldWorks';

// Kombaini seade oli pärast ümbertõstmist (04.10 16:00 UTC) vaikne kuni 07.10 hommikuni, mil masin
// päriselt tööle hakkas. Live-andmetest sõltuvad kontrollid piiratakse selle vaikse aknaga.
const KOMBAIN_QUIET_UNTIL = new Date('2026-10-07T00:00:00.000Z');

describe('Device Assignment and Telemetry History', () => {
  it('loads vehicle lastKnownPosition from db', async () => {
    const claas = await prisma.vehicle.findUnique({
      where: { id: 'veh-1789925816295' }
    });
    expect(claas).not.toBeNull();
    expect(claas?.name).toBe('Suur Claas');
    expect(claas?.lastLatitude).toBeCloseTo(58.1378716, 5);
    expect(claas?.lastLongitude).toBeCloseTo(25.881495, 5);
    expect(claas?.lastActiveAt).not.toBeNull();
  });

  it('has assignment history for Suur Claas (12:00 - 19:00 local / 09:00 - 16:00 UTC)', async () => {
    const claasAssignment = await prisma.deviceAssignment.findFirst({
      where: { vehicleId: 'veh-1789925816295' }
    });
    expect(claasAssignment).not.toBeNull();
    expect(claasAssignment?.startedAt.toISOString()).toBe('2026-10-04T09:00:00.000Z');
    expect(claasAssignment?.endedAt?.toISOString()).toBe('2026-10-04T16:00:00.000Z');
  });

  it('has active assignment for Kombain starting at 19:00 local (16:00 UTC)', async () => {
    const kombainAssignment = await prisma.deviceAssignment.findFirst({
      where: { vehicleId: 'veh-1791133380519', endedAt: null }
    });
    expect(kombainAssignment).not.toBeNull();
    expect(kombainAssignment?.startedAt.toISOString()).toBe('2026-10-04T16:00:00.000Z');
    expect(kombainAssignment?.endedAt).toBeNull();
  });

  if (tsdb) {
    it('returns Claas GPS points within its assignment interval', async () => {
      if (!tsdb) return;
      const claasAssignment = await prisma.deviceAssignment.findFirst({
        where: { vehicleId: 'veh-1789925816295' },
        include: { device: true }
      });
      const imei = claasAssignment!.device.imei!;
      const from = claasAssignment!.startedAt;
      const to = claasAssignment!.endedAt!;

      const rows = await tsdb.$queryRaw<{ count: bigint }[]>`
        SELECT count(DISTINCT time) as count
        FROM measurements
        WHERE device = ${imei}
          AND measurement = 'data'
          AND time >= ${from}
          AND time <= ${to}
      `;
      expect(Number(rows[0].count)).toBeGreaterThan(100);
    });

    it('returns 0 points for Kombain after 16:00 UTC so it does not falsely replay Claas daytime work', async () => {
      if (!tsdb) return;
      const kombainAssignment = await prisma.deviceAssignment.findFirst({
        where: { vehicleId: 'veh-1791133380519', endedAt: null },
        include: { device: true }
      });
      const imei = kombainAssignment!.device.imei!;
      const from = kombainAssignment!.startedAt;

      const rows = await tsdb.$queryRaw<{ count: bigint }[]>`
        SELECT count(DISTINCT time) as count
        FROM measurements
        WHERE device = ${imei}
          AND measurement = 'data'
          AND time >= ${from}
          AND time < ${KOMBAIN_QUIET_UNTIL}
      `;
      expect(Number(rows[0].count)).toBe(0);
    });

    it('confirms last measurement in tsdb occurred before Kombain assignment started', async () => {
      if (!tsdb) return;
      const kombainAssignment = await prisma.deviceAssignment.findFirst({
        where: { vehicleId: 'veh-1791133380519', endedAt: null },
        include: { device: true }
      });
      const imei = kombainAssignment!.device.imei!;
      const rows = await tsdb.$queryRaw<{ max_time: Date }[]>`
        SELECT max(time) as max_time FROM measurements WHERE device = ${imei} AND time < ${KOMBAIN_QUIET_UNTIL}
      `;
      const lastMeasurement = rows[0]?.max_time;
      expect(lastMeasurement).toBeDefined();
      expect(lastMeasurement.getTime()).toBeLessThan(kombainAssignment!.startedAt.getTime());
    });

    // Päris kasutaja võib olla selle sõidu kohta juba kande teinud (see peidab soovituse).
    // Testid jätavad sellise kande arvutusest välja; kasutaja kannet ei muudeta.
    const findRealClaasEntryId = async (): Promise<string | null> => {
      const e = await prisma.workEntry.findFirst({
        where: { date: new Date('2026-10-04T00:00:00.000Z'), vehicleId: 'veh-1789925816295' },
        select: { id: true }
      });
      return e?.id ?? null;
    };

    it('detects telemetry field sessions and suggests Suur Claas for field 450 on 2026-10-04', async () => {
      if (!tsdb) return;
      const suggestions = await getTelemetrySuggestionsForField(450, '2026-10-04', await findRealClaasEntryId());
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      const claasSuggestion = suggestions.find((s) => s.vehicleName === 'Suur Claas');
      expect(claasSuggestion).toBeDefined();
      expect(claasSuggestion?.startTime).toBe('15:45');
      expect(claasSuggestion?.endTime).toBe('17:05');
      expect(claasSuggestion?.durationHours).toBeGreaterThan(1);
      expect(claasSuggestion?.pointCount).toBeGreaterThan(100);
      expect(claasSuggestion?.implementName).toBe('Külvik');
      expect(claasSuggestion?.implementId).toBe('imp-01');
      expect(claasSuggestion?.workedAreaHa).toBeCloseTo(5.45, 1);
    });

    it('excludes telemetry suggestion when an overlapping workEntry exists on that date', async () => {
      if (!tsdb) return;
      // Väljajätmist saab kontrollida ainult siis, kui päris kannet pole (üks välistatav kanne korraga)
      if (await findRealClaasEntryId()) return;
      const suggestionsBefore = await getTelemetrySuggestionsForField(450, '2026-10-04');
      const target = suggestionsBefore.find((s) => s.vehicleName === 'Suur Claas');
      if (!target) return;

      const dummy = await prisma.workEntry.create({
        data: {
          fieldWorkId: 'cmuu5kxuh000tlqf39dxrftc8',
          date: new Date('2026-10-04T00:00:00.000Z'),
          vehicleId: target.vehicleId,
          startTime: target.startTime,
          endTime: target.endTime,
          telemetryAreaHa: target.workedAreaHa
        }
      });

      try {
        expect(dummy.telemetryAreaHa).toBeCloseTo(5.45, 1);
        const suggestionsWithDummy = await getTelemetrySuggestionsForField(450, '2026-10-04');
        expect(suggestionsWithDummy.some((s) => s.vehicleId === target.vehicleId)).toBe(false);

        const suggestionsExcluded = await getTelemetrySuggestionsForField(450, '2026-10-04', dummy.id);
        expect(suggestionsExcluded.some((s) => s.vehicleId === target.vehicleId)).toBe(true);
      } finally {
        await prisma.workEntry.delete({ where: { id: dummy.id } });
      }
    });

    it('returns workedAreaHa 0 and implementId null when no implement assignment matches the session timeframe', async () => {
      if (!tsdb) return;
      const asgn = await prisma.implementAssignment.findFirst({
        where: { vehicleId: 'veh-1789925816295', implementId: 'imp-01' }
      });
      if (!asgn) return;

      await prisma.implementAssignment.update({
        where: { id: asgn.id },
        data: { endedAt: new Date('2026-10-04T08:00:00.000Z') }
      });

      try {
        const suggestions = await getTelemetrySuggestionsForField(450, '2026-10-04', await findRealClaasEntryId());
        const claasSuggestion = suggestions.find((s) => s.vehicleName === 'Suur Claas');
        expect(claasSuggestion).toBeDefined();
        expect(claasSuggestion?.implementId).toBeNull();
        expect(claasSuggestion?.implementName).toBeNull();
        expect(claasSuggestion?.workedAreaHa).toBe(0);
      } finally {
        await prisma.implementAssignment.update({
          where: { id: asgn.id },
          data: { endedAt: asgn.endedAt }
        });
      }
    });
  }
});
