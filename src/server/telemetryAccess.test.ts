// Telemeetria päringud ainult ettevõtte omandiperioodide piires: clampWindow ühiktestid ja live-tsdb integratsioon.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { prisma, tsdb, authDb, runAsTenant } from './db';
import { clampWindow, fetchCellularTelemetry, fetchEyeTelemetry, fetchDeviceHistory, ownershipWindows } from './telemetryAccess';

const LOISU = 'tenant-loisu-agro';
const d = (s: string) => new Date(s);

describe('clampWindow', () => {
  const from = d('2026-10-01T00:00:00Z');
  const to = d('2026-10-10T00:00:00Z');

  it('periood täielikult sees jääb samaks (omandi lõpp välistav)', () => {
    const w = [{ from: d('2026-10-02T00:00:00Z'), to: d('2026-10-03T00:00:00Z') }];
    expect(clampWindow(w, from, to)).toEqual([{ from: d('2026-10-02T00:00:00Z'), to: d('2026-10-03T00:00:00Z'), toInclusive: false }]);
  });
  it('periood osaliselt väljas lõigatakse', () => {
    const w = [{ from: d('2026-09-20T00:00:00Z'), to: d('2026-10-03T00:00:00Z') }];
    expect(clampWindow(w, from, to)).toEqual([{ from, to: d('2026-10-03T00:00:00Z'), toInclusive: false }]);
  });
  it('periood täielikult väljas annab tühja', () => {
    const w = [{ from: d('2026-08-01T00:00:00Z'), to: d('2026-09-01T00:00:00Z') }, { from: d('2026-11-01T00:00:00Z'), to: null }];
    expect(clampWindow(w, from, to)).toEqual([]);
  });
  it('avatud lõpuga periood lõigatakse päringu lõpuga (kaasa arvatud)', () => {
    const w = [{ from: d('2000-01-01T00:00:00Z'), to: null }];
    expect(clampWindow(w, from, to)).toEqual([{ from, to, toInclusive: true }]);
  });
  it('omandi lõpp täpselt päringu alguses annab tühja (poollõigatud)', () => {
    expect(clampWindow([{ from: d('2026-09-01T00:00:00Z'), to: from }], from, to)).toEqual([]);
  });
  it('mitu perioodi: järjestatakse ja kattuvad/külgnevad liidetakse', () => {
    const w = [
      { from: d('2026-10-06T00:00:00Z'), to: null },
      { from: d('2026-10-02T00:00:00Z'), to: d('2026-10-04T00:00:00Z') },
      { from: d('2026-10-03T00:00:00Z'), to: d('2026-10-05T00:00:00Z') }
    ];
    expect(clampWindow(w, from, to)).toEqual([
      { from: d('2026-10-02T00:00:00Z'), to: d('2026-10-05T00:00:00Z'), toInclusive: false },
      { from: d('2026-10-06T00:00:00Z'), to, toInclusive: true }
    ]);
    const adjacent = [{ from: d('2026-10-02T00:00:00Z'), to: d('2026-10-04T00:00:00Z') }, { from: d('2026-10-04T00:00:00Z'), to: null }];
    expect(clampWindow(adjacent, from, to)).toEqual([{ from: d('2026-10-02T00:00:00Z'), to, toInclusive: true }]);
  });
  it('perioodideta tulemus on tühi', () => {
    expect(clampWindow([], from, to)).toEqual([]);
  });
});

describe.skipIf(!tsdb)('telemeetria omandiperioodide piires (live tsdb)', () => {
  vi.setConfig({ testTimeout: 30000 });
  const T = `test-tele-${process.pid}`;
  let imei = '';

  beforeAll(async () => {
    const row = await authDb().deviceOwnership.findFirst({ where: { tenantId: LOISU, kind: 'IMEI' }, orderBy: { createdAt: 'asc' } });
    if (!row) throw new Error('Loisu IMEI omandirida puudub');
    imei = row.identifier;
    await authDb().tenant.create({ data: { id: T, name: 'Telemeetriatest', status: 'ACTIVE' } });
  });
  afterAll(async () => {
    await authDb().deviceOwnership.deleteMany({ where: { tenantId: T } }).catch((e) => console.error('Testi puhastus', e));
    await authDb().tenant.deleteMany({ where: { id: T } }).catch((e) => console.error('Testi puhastus', e));
  });

  it('Loisu: ajalugu, viimased väärtused ja omandiperioodid toimivad', () => runAsTenant(LOISU, async () => {
    const claas = await prisma.deviceAssignment.findFirst({ where: { vehicleId: 'veh-1789925816295' }, include: { device: true } });
    const claasImei = claas!.device.imei!;
    const windows = await ownershipWindows('IMEI', [claasImei]);
    expect(windows.get(claasImei)?.length).toBeGreaterThan(0);

    const rows = await fetchDeviceHistory(claasImei, 24 * 365, claas!.startedAt.toISOString(), claas!.endedAt!.toISOString());
    expect(rows.length).toBeGreaterThan(100);
    for (const r of rows) {
      expect(r.time.getTime()).toBeGreaterThanOrEqual(claas!.startedAt.getTime());
      expect(r.time.getTime()).toBeLessThanOrEqual(claas!.endedAt!.getTime());
    }

    const live = await fetchCellularTelemetry([claasImei]);
    expect(live.get(claasImei)?.lastUpdate).toBeTruthy();
  }));

  it('Loisu: Eye sensori viimased väärtused on sama pesa väljad (kui sensoreid on)', () => runAsTenant(LOISU, async () => {
    const macs = (await prisma.deviceOwnership.findMany({ where: { kind: 'MAC' } })).map((o) => o.identifier);
    const live = await fetchEyeTelemetry(macs);
    for (const [mac, entry] of live) {
      expect(String(entry.mac).toUpperCase()).toBe(mac);
      expect(entry.lastUpdate).toBeTruthy();
    }
  }));

  it('võõras ettevõte: sama IMEI ajalugu on tühi', () => runAsTenant(T, async () => {
    expect(await fetchDeviceHistory(imei, 24 * 365 * 3)).toEqual([]);
  }));

  describe('omandiperioodi ajaaken (võõra ettevõtte kontekstis, Loisu seadmetega)', () => {
    const grant = (kind: 'IMEI' | 'MAC', identifier: string, validFrom: Date, validTo: Date | null) =>
      authDb().deviceOwnership.create({ data: { tenantId: T, kind, identifier, validFrom, validTo } });
    beforeEach(async () => { await authDb().deviceOwnership.deleteMany({ where: { tenantId: T } }); });

    it('ajalugu ja viimased väärtused jäävad alamaknasse [from, to)', async () => {
      const claas = await runAsTenant(LOISU, async () => await prisma.deviceAssignment.findFirst({ where: { vehicleId: 'veh-1789925816295' }, include: { device: true } }));
      const claasImei = claas!.device.imei!;
      const from = d('2026-10-04T13:00:00Z');
      const to = d('2026-10-04T13:30:00Z');
      await grant('IMEI', claasImei, from, to);
      await runAsTenant(T, async () => {
        const rows = await fetchDeviceHistory(claasImei, 24 * 365, '2026-10-01T00:00:00Z', '2026-10-20T00:00:00Z');
        expect(rows.length).toBeGreaterThan(10);
        for (const r of rows) {
          expect(r.time.getTime()).toBeGreaterThanOrEqual(from.getTime());
          expect(r.time.getTime()).toBeLessThan(to.getTime());
        }
        const live = (await fetchCellularTelemetry([claasImei])).get(claasImei);
        expect(live).toBeDefined();
        expect(new Date(live!.lastUpdate).getTime()).toBeGreaterThanOrEqual(from.getTime());
        expect(new Date(live!.lastUpdate).getTime()).toBeLessThan(to.getTime());
      });
    });

    it('omandiperiood enne andmeid annab tühja tulemuse', async () => {
      const claas = await runAsTenant(LOISU, async () => await prisma.deviceAssignment.findFirst({ where: { vehicleId: 'veh-1789925816295' }, include: { device: true } }));
      const claasImei = claas!.device.imei!;
      await grant('IMEI', claasImei, d('2020-01-01T00:00:00Z'), d('2020-02-01T00:00:00Z'));
      await runAsTenant(T, async () => {
        expect(await fetchDeviceHistory(claasImei, 24 * 365 * 10, '2019-01-01T00:00:00Z', '2026-12-31T00:00:00Z')).toEqual([]);
        expect((await fetchCellularTelemetry([claasImei])).size).toBe(0);
      });
    }, 30000);

    it('Eye: periood andmetest eespool on tühi, andmeid katvas aknas tulevad ainult selle akna sensoriväljad', async () => {
      const macs = await runAsTenant(LOISU, async () => (await prisma.deviceOwnership.findMany({ where: { kind: 'MAC' } })).map((o) => o.identifier));
      const loisuLive = await runAsTenant(LOISU, async () => await fetchEyeTelemetry(macs));
      const [mac, entry] = [...loisuLive][0];
      const last = new Date(entry.lastUpdate);
      await grant('MAC', mac, d('2020-01-01T00:00:00Z'), d('2020-02-01T00:00:00Z'));
      await runAsTenant(T, async () => expect((await fetchEyeTelemetry([mac])).size).toBe(0));

      await authDb().deviceOwnership.deleteMany({ where: { tenantId: T } });
      const wFrom = new Date(last.getTime() - 3 * 24 * 3600_000);
      const wTo = new Date(last.getTime() + 1000);
      await grant('MAC', mac, wFrom, wTo);
      await runAsTenant(T, async () => {
        const got = (await fetchEyeTelemetry([mac])).get(mac);
        expect(got).toBeDefined();
        expect(new Date(got!.lastUpdate).getTime()).toBeGreaterThanOrEqual(wFrom.getTime());
        expect(new Date(got!.lastUpdate).getTime()).toBeLessThan(wTo.getTime());
        for (const k of Object.keys(got!)) expect(k === 'mac' || k === 'lastUpdate' || k.startsWith('eye_')).toBe(true);
      });
    }, 30000);
  });

  it('võõras ettevõte: viimased väärtused on tühi Map', () => runAsTenant(T, async () => {
    const live = await fetchCellularTelemetry([imei]);
    expect(live.size).toBe(0);
  }));

  it('võõras ettevõte: Eye sensori päring tundmatu MAC-iga on tühi', () => runAsTenant(T, async () => {
    expect((await fetchEyeTelemetry(['AA:BB:CC:DD:EE:FF'])).size).toBe(0);
  }));
});
