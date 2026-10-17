#!/usr/bin/env bash
# Starts Postgres 16 and Redis from locally installed binaries, for machines
# without Docker. Data lives in .local/ (gitignored).
# Usage: scripts/local-services.sh start|stop|status
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$ROOT/.local"
PGDATA="$DATA/pg"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PG_PORT="${PG_PORT:-5432}"
REDIS_PORT="${REDIS_PORT:-6379}"

run_pg() {
  if [[ $EUID -eq 0 ]]; then
    chown -R postgres "$DATA/pg" "$DATA/pg.log" 2>/dev/null || true
    su postgres -s /bin/bash -c "$*"
  else
    bash -c "$*"
  fi
}

start() {
  mkdir -p "$DATA"
  if [[ ! -d "$PGDATA" ]]; then
    mkdir -p "$PGDATA" && touch "$DATA/pg.log"
    run_pg "$PG_BIN/initdb -D '$PGDATA' -U everydaily --auth=trust >/dev/null"
  fi
  touch "$DATA/pg.log"
  if ! run_pg "$PG_BIN/pg_ctl -D '$PGDATA' status >/dev/null 2>&1"; then
    run_pg "$PG_BIN/pg_ctl -D '$PGDATA' -l '$DATA/pg.log' -o '-p $PG_PORT -k /tmp' start >/dev/null"
  fi
  for _ in $(seq 1 30); do
    pg_isready -h localhost -p "$PG_PORT" >/dev/null 2>&1 && break
    sleep 0.5
  done
  psql -h localhost -p "$PG_PORT" -U everydaily -d postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname='everydaily'" | grep -q 1 ||
    psql -h localhost -p "$PG_PORT" -U everydaily -d postgres -c "CREATE DATABASE everydaily" >/dev/null
  psql -h localhost -p "$PG_PORT" -U everydaily -d postgres -tc \
    "SELECT 1 FROM pg_database WHERE datname='everydaily_test'" | grep -q 1 ||
    psql -h localhost -p "$PG_PORT" -U everydaily -d postgres -c "CREATE DATABASE everydaily_test" >/dev/null
  if ! redis-cli -p "$REDIS_PORT" ping >/dev/null 2>&1; then
    redis-server --port "$REDIS_PORT" --daemonize yes --dir "$DATA" --logfile "$DATA/redis.log" >/dev/null
  fi
  echo "postgres://everydaily@localhost:$PG_PORT/everydaily"
  echo "redis://localhost:$REDIS_PORT"
}

stop() {
  run_pg "$PG_BIN/pg_ctl -D '$PGDATA' stop >/dev/null 2>&1" || true
  redis-cli -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true
}

status() {
  pg_isready -h localhost -p "$PG_PORT" || true
  redis-cli -p "$REDIS_PORT" ping || true
}

"${1:-start}"
