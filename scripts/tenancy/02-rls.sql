-- Käivita tabelite omanikuna: psql "${MIGRATE_DATABASE_URL%%\?*}" -f scripts/tenancy/02-rls.sql
-- Korduvkäivitatav. Prisma db push ei halda poliitikaid ega muuda neid.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'seasons','cadastral_parcels','fields','field_seasons','related_parties','field_cadastral_parcels',
    'points_of_interest','vehicles','implements','telemetry_devices','device_assignments',
    'implement_assignments','crops','crop_varieties','soil_samples','field_operations',
    'field_operation_products','work_types','materials','work_templates','work_template_items',
    'field_works','work_entries','work_entry_lines','users','device_ownerships',
    'support_grants','support_access_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'', true)) '
      'WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))', t);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO teris_app, teris_platform;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO teris_app, teris_platform;
ALTER DEFAULT PRIVILEGES FOR ROLE teris IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO teris_app, teris_platform;
ALTER DEFAULT PRIVILEGES FOR ROLE teris IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO teris_app, teris_platform;

-- Platvormi tabelid on ainult teris_platform rollile (sama mis 04-privileges.sql): ülaltoodud
-- "ON ALL TABLES" GRANT annaks need teris_app-ile uuesti, seega võta õigused tagasi.
REVOKE ALL ON tenants, tenant_licenses, sessions, password_tokens, platform_users, platform_sessions, platform_audit_log, catalog_crops, catalog_crop_varieties, catalog_work_types, catalog_work_templates, catalog_work_template_items, support_sessions, help_articles, landing_events, interest_requests FROM teris_app;
REVOKE ALL ON SEQUENCE landing_events_id_seq FROM teris_app;
