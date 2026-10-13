#!/bin/sh
set -eu
# Only called on a fresh PostgreSQL data volume. Migrations require an administrative role.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=runtime_password="$DRILL_DB_PASSWORD" <<'SQL'
CREATE ROLE drill_app LOGIN PASSWORD :'runtime_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
SQL
for f in /drill-sql/*.sql; do psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"; done
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
GRANT CONNECT ON DATABASE drill TO drill_app;
GRANT USAGE ON SCHEMA public TO drill_app;
-- auth schema 由 004_auth_compat.sql 建立。权限在这里单独授予，是自托管专用的一段
-- （CloudBase 上由平台管理，不需要也不允许在这里执行）。
GRANT USAGE ON SCHEMA auth TO drill_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO drill_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO drill_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO drill_app;
REVOKE INSERT,UPDATE,DELETE ON kinds,schema_migrations FROM drill_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO drill_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO drill_app;
SQL
