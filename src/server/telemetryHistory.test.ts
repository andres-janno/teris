import { describe, it, expect } from 'vitest';
import { prisma, tsdb } from './db';

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
  }
});
