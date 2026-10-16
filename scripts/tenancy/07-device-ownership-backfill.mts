// scripts/tenancy/07-device-ownership-backfill.mts — loob Loisu Agro olemasolevatele telemeetriaseadmetele
// omandiperioodi (alates 2000-01-01). Korduvkäivitatav: olemasolevat kehtivat rida ei dubleerita.
// Käivita serveris (PLATFORM_DATABASE_URL keskkonnast): npx tsx scripts/tenancy/07-device-ownership-backfill.mts
import { authDb } from '../../src/server/db.ts';

const TENANT_ID = 'tenant-loisu-agro';
const VALID_FROM = new Date('2000-01-01T00:00:00Z');

// MAC salvestatakse kujul AA:BB:CC:DD:EE:FF; muud kujud normaliseeritakse (seadme rida jääb muutmata).
function normalizeMac(raw: string): string {
  const hex = raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  return hex.length === 12 ? hex.match(/.{2}/g)!.join(':') : raw.trim().toUpperCase();
}

const db = authDb();
try {
  const devices = await db.telemetryDevice.findMany({ where: { tenantId: TENANT_ID } });
  let created = 0;
  let existing = 0;
  for (const d of devices) {
    const ids: { kind: 'IMEI' | 'MAC'; identifier: string }[] = [];
    if (d.imei) ids.push({ kind: 'IMEI', identifier: d.imei.trim() });
    if (d.macAddress) ids.push({ kind: 'MAC', identifier: normalizeMac(d.macAddress) });
    for (const { kind, identifier } of ids) {
      const found = await db.deviceOwnership.findFirst({ where: { tenantId: TENANT_ID, kind, identifier, validTo: null } });
      if (found) {
        existing++;
        continue;
      }
      await db.deviceOwnership.create({
        data: { tenantId: TENANT_ID, kind, identifier, deviceId: d.id, validFrom: VALID_FROM, validTo: null },
      });
      created++;
    }
  }
  console.log(`Loodud ${created} omandirida, olemas ${existing}`);
} finally {
  await db.$disconnect();
}
