#!/usr/bin/env bash
# Native macOS development. State, backups, logs, and PIDs stay in .local/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/.local"
BACKEND="$ROOT/meghdrishti-backend"
PG="$(brew --prefix postgresql@16)/bin"
mkdir -p "$STATE/logs" "$STATE/redis"
chmod 700 "$STATE"

start_process() {
  local name="$1"; shift
  if [[ -f "$STATE/$name.pid" ]] && kill -0 "$(cat "$STATE/$name.pid")" 2>/dev/null; then
    echo "$name already running"; return
  fi
  "$BACKEND/.venv/bin/python" - "$STATE" "$name" "$@" <<'PY'
import subprocess
import sys
from pathlib import Path
state, name, *command = sys.argv[1:]
if name == "frontend":
    # Reuse a Next dev server already running in this project.
    listeners = subprocess.run(["lsof", "-tiTCP:3000", "-sTCP:LISTEN"],
                               capture_output=True, text=True).stdout.split()
    if listeners:
        pid = listeners[0]
        cwd = subprocess.check_output(["lsof", "-a", "-p", pid, "-d", "cwd", "-Fn"], text=True)
        process_name = subprocess.check_output(["ps", "-p", pid, "-o", "command="], text=True)
        if f"n{Path.cwd()}\n" not in cwd or "next" not in process_name:
            raise SystemExit("Port 3000 belongs to another app; stop it before starting MeghDrishti.")
        parent = subprocess.check_output(["ps", "-p", pid, "-o", "ppid="], text=True).strip()
        parent_name = subprocess.check_output(["ps", "-p", parent, "-o", "command="], text=True)
        if "next dev" in parent_name:
            pid = parent
        (Path(state) / "frontend.pid").write_text(pid)
        print("frontend already running; added to launcher tracking")
        raise SystemExit(0)
with (Path(state) / "logs" / f"{name}.log").open("a") as log:
    process = subprocess.Popen(command, stdin=subprocess.DEVNULL,
                               stdout=log, stderr=log, start_new_session=True)
(Path(state) / f"{name}.pid").write_text(str(process.pid))
PY
}

stop_process() {
  local name="$1" pid
  [[ -f "$STATE/$name.pid" ]] || return 0
  pid="$(cat "$STATE/$name.pid")"
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM "$pid"
    for ((i=0; i<60; i++)); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$pid" 2>/dev/null; then
      echo "$name still finishing work; retry stop later" >&2; return 1
    fi
  fi
  rm -f "$STATE/$name.pid"
}

case "${1:-start}" in
  start)
    [[ -x "$BACKEND/.venv/bin/python" && -d "$ROOT/node_modules" ]] || {
      echo 'Install backend .venv and npm dependencies first (see README).' >&2; exit 1;
    }
    if [[ ! -f "$STATE/postgres/PG_VERSION" ]]; then
      "$PG/initdb" -D "$STATE/postgres" -A trust --encoding UTF8 --locale C
      cat >> "$STATE/postgres/postgresql.conf" <<EOF
listen_addresses = '127.0.0.1'
port = 5432
shared_buffers = '64MB'
max_connections = 40
unix_socket_directories = '$STATE'
EOF
    fi
    "$PG/pg_ctl" -D "$STATE/postgres" status >/dev/null 2>&1 || \
      "$PG/pg_ctl" -D "$STATE/postgres" -l "$STATE/postgres.log" start
    if ! "$PG/psql" -h 127.0.0.1 -d postgres -Atc "SELECT 1 FROM pg_roles WHERE rolname='meghdrishti'" | grep -q 1; then
      "$PG/createuser" -h 127.0.0.1 meghdrishti
    fi
    if ! "$PG/psql" -h 127.0.0.1 -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname='meghdrishti'" | grep -q 1; then
      "$PG/createdb" -h 127.0.0.1 -O meghdrishti meghdrishti
    fi
    if [[ ! -f "$STATE/redis/redis.conf" ]]; then
      cat > "$STATE/redis/redis.conf" <<EOF
bind 127.0.0.1
port 6379
dir $STATE/redis
daemonize yes
pidfile $STATE/redis/redis.pid
logfile $STATE/redis/redis.log
appendonly yes
EOF
    fi
    if [[ ! -f "$STATE/redis/redis.pid" ]] || ! kill -0 "$(cat "$STATE/redis/redis.pid")" 2>/dev/null; then
      redis-server "$STATE/redis/redis.conf"
    fi
    redis-cli ping
    cd "$BACKEND"
    [[ -f .env ]] || cp .env.example .env
    .venv/bin/alembic upgrade head
    if [[ "$("$PG/psql" -h 127.0.0.1 -U meghdrishti -d meghdrishti -Atc 'SELECT count(*) FROM users')" == 0 ]]; then
      .venv/bin/python -m app.db.seed
    fi
    start_process api .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 \
      --timeout-graceful-shutdown 15
    for ((i=0; i<30; i++)); do
      curl -fsS http://127.0.0.1:8000/ready >/dev/null 2>&1 && break
      sleep 1
    done
    curl -fsS http://127.0.0.1:8000/ready
    start_process worker env DB_POOLING=false .venv/bin/celery -A app.workers.celery_app worker \
      --pool solo --concurrency 1 -Q qc,features,ml,context,alert,health,realtime,schedule \
      -l info -n native@%h
    start_process beat .venv/bin/celery -A app.workers.celery_app beat \
      -l info --schedule "$STATE/celerybeat-schedule" --pidfile "$STATE/celerybeat.pid"
    cd "$ROOT"
    [[ -f .env.local ]] || cp .env.example .env.local
    start_process frontend node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000
    echo; echo 'Frontend: http://localhost:3000  API: http://localhost:8000/docs'
    ;;
  stop)
    for name in beat frontend worker api; do stop_process "$name"; done
    if [[ -f "$STATE/redis/redis.pid" ]] && kill -0 "$(cat "$STATE/redis/redis.pid")" 2>/dev/null; then
      redis-cli shutdown
    fi
    "$PG/pg_ctl" -D "$STATE/postgres" status >/dev/null 2>&1 && \
      "$PG/pg_ctl" -D "$STATE/postgres" stop -m fast || true
    ;;
  status)
    for name in api worker beat frontend; do
      if [[ -f "$STATE/$name.pid" ]] && kill -0 "$(cat "$STATE/$name.pid")" 2>/dev/null; then
        echo "$name running ($(cat "$STATE/$name.pid"))"
      else echo "$name stopped"; fi
    done
    "$PG/pg_ctl" -D "$STATE/postgres" status || true
    redis-cli ping || true
    ;;
  *) echo 'Usage: bash scripts/local.sh {start|stop|status}' >&2; exit 1 ;;
esac
