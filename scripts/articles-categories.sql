-- Artikli liigid: MaterialCategory enum → article_categories tabel. Andmed jäävad alles.
-- Käivita ühe korra tabelite omanikuna: psql "${MIGRATE_DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f scripts/articles-categories.sql
-- Pärast seda: npx prisma db push (lisab indeksid, välisvõtmed ja price/cropId/defaultWarehouseId).
BEGIN;
CREATE TYPE "ArticleGroup" AS ENUM ('SERVICE', 'CONSUMABLE', 'PRODUCE', 'OTHER_GOODS');
CREATE TYPE "ArticleSystemKind" AS ENUM ('LABOR_TIME', 'MACHINE_TIME', 'IMPLEMENT_TIME', 'DRYING_TIME', 'SEED', 'FERTILIZER', 'PLANT_PROTECTION', 'FUEL', 'DRYING_OIL', 'GRAIN');

CREATE TABLE article_categories (
  id           text PRIMARY KEY,
  tenant_id    text NOT NULL DEFAULT current_setting('app.tenant_id'),
  name         text NOT NULL,
  "group"      "ArticleGroup" NOT NULL,
  "systemKind" "ArticleSystemKind",
  "sortOrder"  integer NOT NULL DEFAULT 0,
  "isActive"   boolean NOT NULL DEFAULT true,
  "createdAt"  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  timestamp(3) NOT NULL,
  "createdBy"  text,
  "updatedBy"  text
);

-- Iga ettevõte: süsteemsed liigid + „Muu kulumaterjal“
INSERT INTO article_categories (id, tenant_id, name, "group", "systemKind", "sortOrder", "updatedAt")
SELECT gen_random_uuid()::text, t.id, c.name, c.grp::"ArticleGroup", c.kind::"ArticleSystemKind", c.sort, CURRENT_TIMESTAMP
FROM tenants t
CROSS JOIN (VALUES
  ('Töötaja tööaeg', 'SERVICE', 'LABOR_TIME', 10),
  ('Masina tööaeg', 'SERVICE', 'MACHINE_TIME', 20),
  ('Haakeriista tööaeg', 'SERVICE', 'IMPLEMENT_TIME', 30),
  ('Kuivatamise tööaeg', 'SERVICE', 'DRYING_TIME', 40),
  ('Seeme', 'CONSUMABLE', 'SEED', 110),
  ('Väetis', 'CONSUMABLE', 'FERTILIZER', 120),
  ('Taimekaitsevahend', 'CONSUMABLE', 'PLANT_PROTECTION', 130),
  ('Kütus', 'CONSUMABLE', 'FUEL', 140),
  ('Kuivatusõli', 'CONSUMABLE', 'DRYING_OIL', 150),
  ('Terad', 'PRODUCE', 'GRAIN', 210),
  ('Muu kulumaterjal', 'CONSUMABLE', NULL, 190)
) AS c(name, grp, kind, sort);

-- Omanik näeb kõigi ettevõtete artikleid ainult ilma FORCE RLS-ita (taastatakse lõpus; 02-rls.sql seab selle samuti)
ALTER TABLE articles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE articles ADD COLUMN "categoryId" text;
UPDATE articles a SET "categoryId" = c.id
FROM article_categories c
WHERE c.tenant_id = a.tenant_id
  AND ((a.category = 'SEED' AND c."systemKind" = 'SEED')
    OR (a.category = 'FERTILIZER' AND c."systemKind" = 'FERTILIZER')
    OR (a.category = 'PLANT_PROTECTION' AND c."systemKind" = 'PLANT_PROTECTION')
    OR (a.category = 'OTHER' AND c."systemKind" IS NULL AND c.name = 'Muu kulumaterjal'));
ALTER TABLE articles ALTER COLUMN "categoryId" SET NOT NULL;

-- Vana unikaalsus (tenant, category, name) ja veerg ära
DROP INDEX IF EXISTS "articles_tenant_id_category_name_key";
ALTER TABLE articles DROP COLUMN category;
DROP TYPE "MaterialCategory";

-- Unikaalsused kohe Prisma nimedega: db push ei pea neid lisama (unikaalsuse lisamisel nõuaks ta --accept-data-loss)
CREATE UNIQUE INDEX "article_categories_tenant_id_name_key" ON article_categories (tenant_id, name);
CREATE UNIQUE INDEX "article_categories_tenant_id_systemKind_key" ON article_categories (tenant_id, "systemKind");
CREATE UNIQUE INDEX "articles_tenant_id_categoryId_name_key" ON articles (tenant_id, "categoryId", name);
ALTER TABLE articles FORCE ROW LEVEL SECURITY;
COMMIT;
