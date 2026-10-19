-- Käivita omanikuna: set -a && . ./.env && set +a && psql -v ON_ERROR_STOP=1 -f scripts/tenancy/04-privileges.sql
-- Platvormi tabelid on ainult teris_platform rollile (authDb()). Korduvkäivitatav.
REVOKE ALL ON tenants, tenant_licenses, sessions, password_tokens, platform_users, platform_sessions, platform_audit_log, catalog_crops, catalog_crop_varieties, catalog_work_types, catalog_work_templates, catalog_work_template_items, support_sessions, help_articles, landing_events, interest_requests FROM teris_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, tenant_licenses, sessions, password_tokens, platform_users, platform_sessions, platform_audit_log, catalog_crops, catalog_crop_varieties, catalog_work_types, catalog_work_templates, catalog_work_template_items, support_sessions, help_articles, landing_events, interest_requests TO teris_platform;
REVOKE ALL ON SEQUENCE landing_events_id_seq FROM teris_app;
GRANT USAGE, SELECT ON SEQUENCE landing_events_id_seq TO teris_platform;
-- NB: Uued platvormi tabelid lisa ülal REVOKE/GRANT lausetesse ja 02-rls.sql lõppu.
