// scripts/tenancy/05-tenant-fk-triggers.mts — keelab ettevõtteülesed viited.
// Välisvõtme kontroll ja kaskaad mööduvad RLS-ist, seega iga ettevõttesisese relatsiooni
// jaoks on triger: viidatud rida peab kuuluma samale ettevõttele.
// Korduvkäivitatav: npx tsx scripts/tenancy/05-tenant-fk-triggers.mts (omanikuna MIGRATE_DATABASE_URL-iga).
// Pärast skeemimuudatust (uus relatsioon) käivita uuesti.
import { PrismaClient } from '@prisma/client';
import { tenantRelations } from '../../src/server/tenantRelations.ts';

// Tavaline RAISE EXCEPTION (P0001): 23503 maskeeriks Prisma kasutajale nähtava teate.
const FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION tenant_fk_check() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  fk_val text;
  parent_tenant text;
BEGIN
  EXECUTE format('SELECT ($1).%I::text', TG_ARGV[1]) INTO fk_val USING NEW;
  IF fk_val IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('SELECT tenant_id FROM %I WHERE %I::text = $1', TG_ARGV[0], TG_ARGV[2]) INTO parent_tenant USING fk_val;
  IF parent_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Viide teise ettevõtte kirjele (%.% → %)', TG_TABLE_NAME, TG_ARGV[1], TG_ARGV[0];
  END IF;
  RETURN NEW;
END $$;`;

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL;
  if (!url) throw new Error('MIGRATE_DATABASE_URL puudub');
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    await db.$executeRawUnsafe(FUNCTION_SQL);
    const rels = tenantRelations();
    for (const r of rels) {
      const name = `tenant_fk_${r.column}`;
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON "${r.table}"`);
      await db.$executeRawUnsafe(
        `CREATE TRIGGER "${name}" BEFORE INSERT OR UPDATE OF "${r.column}" ON "${r.table}" ` +
        `FOR EACH ROW EXECUTE FUNCTION tenant_fk_check('${r.parentTable}', '${r.column}', '${r.parentColumn}')`);
    }
    console.log(`OK: ${rels.length} trigerit`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
