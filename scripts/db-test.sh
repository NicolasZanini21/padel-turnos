#!/usr/bin/env bash
# Levanta un Postgres de Supabase descartable, aplica migraciones + seed y corre las pruebas.
# Uso: scripts/db-test.sh   (requiere Docker)
set -euo pipefail
cd "$(dirname "$0")/.."
IMG=supabase/postgres:17.12.0.002
NAME=gpc-db-test
PORT=${PORT:-54399}
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" "$IMG" >/dev/null
export PGPASSWORD=postgres
until psql -h 127.0.0.1 -p "$PORT" -U postgres -qtAc 'select 1' >/dev/null 2>&1; do sleep 1; done
sleep 3
P="psql -h 127.0.0.1 -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
for f in supabase/migrations/*.sql supabase/seed.sql; do $P -f "$f" >/dev/null; done
$P -f supabase/tests/reservas_test.sql 2>&1 | grep -E 'ok - |ERROR|FALLÓ|^#' | sed 's/^psql:[^:]*:[0-9]*: //; s/^NOTICE:  //'
status=${PIPESTATUS[0]}
[ "${KEEP:-0}" = 1 ] || docker rm -f "$NAME" >/dev/null
exit $status
