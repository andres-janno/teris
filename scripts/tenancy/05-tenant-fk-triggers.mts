// scripts/tenancy/05-tenant-fk-triggers.mts — keelab ettevõtteülesed viited.
// Välisvõtme kontroll ja kaskaad mööduvad RLS-ist, seega iga ettevõttesisese relatsiooni
// jaoks on triger: viidatud rida peab kuuluma samale ettevõttele.
// Korduvkäivitatav: npx tsx scripts/tenancy/05-tenant-fk-triggers.mts (omanikuna MIGRATE_DATABASE_URL-iga).
// Pärast skeemimuudatust (uus relatsioon) käivita uuesti.
import { PrismaClient } from '@prisma/client';
import { tenantRelations } from '../../src/server/tenantRelations.ts';

// Tavaline RAISE EXCEPTION (P0001): 23503 maskeeriks Prisma kasutajale nähtava teate.
const FUNCTION_SQL = `
CREATE OR REPLACE FUNCTION tenant_fk_check() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  is_null boolean;
  parent_tenant text;
BEGIN
  EXECUTE format('SELECT ($1).%I IS NULL', TG_ARGV[1]) INTO is_null USING NEW;
  IF is_null THEN RETURN NEW; END IF;
  EXECUTE format('SELECT tenant_id FROM %I.%I WHERE %I = ($1).%I', TG_TABLE_SCHEMA, TG_ARGV[0], TG_ARGV[2], TG_ARGV[1]) INTO parent_tenant USING NEW;
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
    // Eemalda trigerid, mida skeem enam ei vaja (nt kustutatud relatsioon)
    const wanted = new Set(rels.map((r) => `${r.table}.tenant_fk_${r.column}`));
    const existing = await db.$queryRawUnsafe<{ tbl: string; trg: string }[]>(
      `SELECT c.relname AS tbl, tg.tgname AS trg FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid ` +
      `WHERE tg.tgname LIKE 'tenant_fk\\_%' AND NOT tg.tgisinternal`);
    for (const e of existing) {
      if (!wanted.has(`${e.tbl}.${e.trg}`)) await db.$executeRawUnsafe(`DROP TRIGGER "${e.trg}" ON "${e.tbl}"`);
    }
    for (const r of rels) {
      const name = `tenant_fk_${r.column}`;
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${name}" ON "${r.table}"`);
      await db.$executeRawUnsafe(
        `CREATE TRIGGER "${name}" BEFORE INSERT OR UPDATE OF "${r.column}", tenant_id ON "${r.table}" ` +
        `FOR EACH ROW EXECUTE FUNCTION tenant_fk_check('${r.parentTable}', '${r.column}', '${r.parentColumn}')`);
    }
    console.log(`OK: ${rels.length} trigerit`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
