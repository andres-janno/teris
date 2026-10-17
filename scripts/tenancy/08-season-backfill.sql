-- Käivita teris_platform rolliga (BYPASSRLS), pärast hooaja veergude eemaldamist (prisma db push):
--   set -a && . ./.env && set +a && psql "${PLATFORM_DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f scripts/tenancy/08-season-backfill.sql
-- Hooaja valik näitab ainult hooaegade tabelis olevaid aastaid: loo puuduvad hooajad aastatele,
-- millel on põllu- või mullaprooviandmeid, ja seo hooajata põllukirjed hooajaga. Korduvkäivitatav.
BEGIN;

INSERT INTO seasons (tenant_id, year, name, "isLocked", "createdAt", "updatedAt")
SELECT d.tenant_id, d.year, 'Hooaeg ' || d.year, false, now(), now()
FROM (
  SELECT tenant_id, year FROM field_seasons
  UNION
  SELECT tenant_id, year FROM soil_samples
) d
WHERE d.year BETWEEN 1990 AND 2100
ON CONFLICT (tenant_id, year) DO NOTHING;

UPDATE field_seasons fs
SET "seasonId" = s.id
FROM seasons s
WHERE s.tenant_id = fs.tenant_id AND s.year = fs.year AND fs."seasonId" IS NULL;

COMMIT;
