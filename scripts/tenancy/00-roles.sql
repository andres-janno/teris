-- Käivitatakse superkasutajana: sudo -u postgres psql -d <PGDATABASE> -v app_pw=<parool> -v platform_pw=<parool> -f 00-roles.sql
-- (paroolid antakse ilma jutumärkideta; skript tsiteerib need ise kujul :'app_pw')
-- teris_app: rakendus; ei ole tabelite omanik, RLS kehtib.
-- teris_platform: autentimine ja (etapp 3) teenusepakkuja keskkond; BYPASSRLS.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'teris_app') THEN CREATE ROLE teris_app LOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'teris_platform') THEN CREATE ROLE teris_platform LOGIN BYPASSRLS; END IF;
END $$;
ALTER ROLE teris_app PASSWORD :'app_pw';
ALTER ROLE teris_platform PASSWORD :'platform_pw';
SELECT format('GRANT CONNECT ON DATABASE %I TO teris_app, teris_platform', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO teris_app, teris_platform;
-- Tabelite õigused antakse Task 7 skriptis (02-rls.sql), kui tabelid on lõplikud.
