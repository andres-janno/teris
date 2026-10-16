-- Käivita omanikuna: set -a && . ./.env && set +a && psql -v ON_ERROR_STOP=1 -f scripts/tenancy/04-privileges.sql
-- Platvormi tabelid on ainult teris_platform rollile (authDb()). Korduvkäivitatav.
REVOKE ALL ON tenants, tenant_licenses, sessions, password_tokens, platform_users, platform_sessions, platform_audit_log FROM teris_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, tenant_licenses, sessions, password_tokens, platform_users, platform_sessions, platform_audit_log TO teris_platform;
-- NB: ALTER DEFAULT PRIVILEGES annab ka tulevastele tabelitele teris_app-ile õigused — etapi 3b platvormi tabelid tuleb lisada sellesse skripti.
