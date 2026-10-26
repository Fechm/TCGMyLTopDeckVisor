#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
nombre=myl-pruebas-db
docker rm -f "$nombre" >/dev/null 2>&1 || true
docker run -d --name "$nombre" -e POSTGRES_PASSWORD=pruebas pgvector/pgvector:pg17 >/dev/null
trap 'docker rm -f "$nombre" >/dev/null' EXIT
until docker exec "$nombre" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 2
psql() { docker exec -i "$nombre" psql -q -U postgres -v ON_ERROR_STOP=1 "$@"; }
psql <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema extensions;
grant usage on schema extensions to anon, authenticated;
SQL
for m in migrations/*.sql; do
  echo "migración $m"
  psql < "$m"
done
psql < tests/usuarios.sql
