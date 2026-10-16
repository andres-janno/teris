// src/server/deviceOwnership.ts — telemeetriaseadme omandiperioodid (DeviceOwnership).
import type { TxClient } from './db.ts';

type Ids = { imei: string | null; macAddress: string | null };

const identifiers = (d: Ids | null): { kind: 'IMEI' | 'MAC'; identifier: string }[] => [
  ...(d?.imei ? [{ kind: 'IMEI' as const, identifier: d.imei }] : []),
  ...(d?.macAddress ? [{ kind: 'MAC' as const, identifier: d.macAddress }] : [])
];

/**
 * Hoiab omandiperioodid seadme tunnustega kooskõlas: kadunud tunnuste jooksvad perioodid
 * suletakse (validTo = now), lisandunud tunnustele avatakse uued. Kasuta ainult tehingu `tx`-iga
 * (ettevõtte piirab RLS, tenantId täitub vaikeväärtusest).
 */
export async function syncOwnership(
  tx: TxClient,
  before: Ids | null,
  after: (Ids & { id: string }) | null,
  now: Date = new Date()
): Promise<void> {
  const key = (x: { kind: string; identifier: string }) => `${x.kind}:${x.identifier}`;
  const prev = identifiers(before);
  const next = identifiers(after);
  const nextKeys = new Set(next.map(key));
  const prevKeys = new Set(prev.map(key));
  for (const p of prev) {
    if (nextKeys.has(key(p))) continue;
    await tx.deviceOwnership.updateMany({ where: { kind: p.kind, identifier: p.identifier, validTo: null }, data: { validTo: now } });
  }
  for (const n of next) {
    if (prevKeys.has(key(n))) continue;
    await tx.deviceOwnership.create({ data: { kind: n.kind, identifier: n.identifier, deviceId: after!.id, validFrom: now } });
  }
}
