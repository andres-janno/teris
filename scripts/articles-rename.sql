-- Material → Article: tabelid, veerud, piirangud ja indeksid. Andmed jäävad alles.
-- Käivita tabelite omanikuna ühe korra: psql "${MIGRATE_DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f scripts/articles-rename.sql
BEGIN;
ALTER TABLE materials RENAME TO articles;
ALTER TABLE material_stock RENAME TO article_stock;
ALTER TABLE article_stock RENAME COLUMN "materialId" TO "articleId";
ALTER TABLE work_entry_lines RENAME COLUMN "materialId" TO "articleId";
ALTER TABLE field_work_lines RENAME COLUMN "materialId" TO "articleId";
ALTER TABLE stock_document_lines RENAME COLUMN "materialId" TO "articleId";

-- Prisma vaikenimed (nt materials_pkey, work_entry_lines_materialId_idx) uutele nimedele, et db push neid ei looks uuesti
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.conname, c.conrelid::regclass::text AS tbl FROM pg_constraint c
           JOIN pg_namespace n ON n.oid = c.connamespace
           WHERE n.nspname = 'public' AND c.conname LIKE '%material%' LOOP
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', r.tbl, r.conname,
      replace(replace(r.conname, 'materials', 'articles'), 'material', 'article'));
  END LOOP;
  FOR r IN SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%material%' LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I', r.indexname,
      replace(replace(r.indexname, 'materials', 'articles'), 'material', 'article'));
  END LOOP;
END $$;
COMMIT;
