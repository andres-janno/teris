// scripts/tenancy/01-backfill.mts — loob olemasolevate andmete ettevõtte ja täidab tenant_id.
// Korduvkäivitatav. Käivita serveris: npx tsx scripts/tenancy/01-backfill.mts
import { PrismaClient } from '@prisma/client';

const TENANT_ID = 'tenant-loisu-agro';
const TENANT_NAME = 'Loisu Agro OÜ';
const TABLES = [
  'seasons', 'cadastral_parcels', 'fields', 'field_seasons', 'related_parties', 'field_cadastral_parcels',
  'points_of_interest', 'vehicles', 'implements', 'telemetry_devices', 'device_assignments',
  'implement_assignments', 'crops', 'crop_varieties', 'soil_samples', 'field_operations',
  'field_operation_products', 'work_types', 'materials', 'work_templates', 'work_template_items',
  'field_works', 'work_entries', 'work_entry_lines', 'users'
];

const db = new PrismaClient({ datasources: { db: { url: process.env.MIGRATE_DATABASE_URL } } });

const party = await db.relatedParty.findFirst({
  where: { name: TENANT_NAME, roles: { has: 'OPERATOR' } },
  select: { id: true, code: true }
});
if (!party) throw new Error(`Operaatorit "${TENANT_NAME}" ei leitud`);

await db.tenant.upsert({
  where: { id: TENANT_ID },
  create: { id: TENANT_ID, name: TENANT_NAME, registryCode: party.code, primaryPartyId: party.id },
  update: { primaryPartyId: party.id }
});

await db.$transaction(
  TABLES.map((t) => db.$executeRawUnsafe(`UPDATE "${t}" SET tenant_id = $1 WHERE tenant_id IS NULL`, TENANT_ID))
);

for (const t of TABLES) {
  const [{ n }] = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${t}" WHERE tenant_id IS NULL`);
  if (n !== 0n) throw new Error(`${t}: ${n} rida ilma ettevõtteta`);
}
console.log(`OK: ettevõte ${TENANT_ID}, ${TABLES.length} tabelit täidetud`);
await db.$disconnect();
