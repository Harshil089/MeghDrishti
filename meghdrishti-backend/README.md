# MeghDrishti Backend

AI/ML-based intelligent anomaly detection for Automatic Weather Stations.
Distinguishes genuine extreme weather from sensor malfunction using rule-based
QC, Isolation Forest, and external context validation — never on statistical
extremity alone.

## Quickstart

```bash
cp .env.example .env
docker compose up -d
alembic upgrade head
python -m app.db.seed
```

Then open:

- API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Grafana: http://localhost:3001 (admin/admin)
- Airflow: http://localhost:8080
- Prometheus: http://localhost:9090

## Local development without Docker

This was built and tested against a native Homebrew Postgres 16 + Redis
(no Docker available in the dev sandbox). To reproduce:

```bash
brew install postgresql@16
/opt/homebrew/opt/postgresql@16/bin/pg_ctl -D /opt/homebrew/var/postgresql@16 start
redis-server --daemonize yes

createuser meghdrishti --pwprompt   # password: meghdrishti
createdb meghdrishti -O meghdrishti
createdb meghdrishti_test -O meghdrishti   # used by the test suite

uv venv --python 3.12 .venv && source .venv/bin/activate
uv pip install -e ".[dev]"

cp .env.example .env
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload
```

## Tests

```bash
pytest -q          # 57 tests: unit, integration, API — all against a real
                    # Postgres + Redis, not mocks/sqlite
ruff check app
mypy app            # non-blocking in CI; a handful of SQLAlchemy Mapped[]
                    # typing false-positives remain (see below)
```

## Demo: inject a synthetic fault and watch the full pipeline run

```bash
python scripts/inject_fault.py --station IMD_PUNE_001 --type spike \
    --measurement temperature_c --process
```

This seeds 15 normal readings, injects a fault observation, and runs it
through the complete pipeline (rules → features → ML → context → fusion →
decision → anomaly → alert policy → station health → WebSocket event),
printing the resulting anomaly id. Fault types: `stuck`, `spike`, `drift`,
`dropout`, `telemetry_gap`, `physical_impossibility`.

## Architecture

```
RAW OBSERVATION → INGESTION → SCHEMA VALIDATION → NORMALIZATION → FEATURES
    ↓
 ┌──────────────┬────────────────┬───────────────────┐
 │ Rule Engine  │ Isolation      │ Context Validator  │
 │ (app/qc)     │ Forest         │ (app/context)      │
 │              │ (app/ml)       │                    │
 └──────────────┴────────────────┴───────────────────┘
    ↓
 EVIDENCE FUSION → CONFIDENCE → DECISION (ExtremeEventGuard) (app/scoring)
    ↓
 NORMAL / WATCH / SUSPICIOUS / PROBABLE_SENSOR_FAULT / LIKELY_GENUINE_EXTREME
 / INSUFFICIENT_CONTEXT
    ↓
 ALERT POLICY (app/alerts) → OPERATOR REVIEW (app/api/reviews.py) → LABEL STORE
```

Raw observations (`raw_observations`) are never mutated. Rule/ML/context
outputs are persisted independently (`qc_rule_results`, `ml_results`,
`context_results`) before fusion. See `AGENTS.md` at the repo root for the
full original specification this implements.

### Modules

| Layer | Path |
|---|---|
| API | `app/api/` |
| Domain models | `app/models/` |
| Repositories | `app/repositories/` |
| Ingestion adapters | `app/ingestion/` (Open-Meteo real, IMD real+demo, NOAA/ERA5/GPM real-interface-with-graceful-fallback) |
| QC rule engine | `app/qc/` |
| Feature engineering | `app/features/` |
| ML (Isolation Forest) | `app/ml/` |
| Context validation | `app/context/` |
| Evidence fusion / decision | `app/scoring/` |
| Alerting | `app/alerts/` |
| Station health | `app/health/` |
| Celery workers | `app/workers/` |
| Airflow DAGs | `airflow/dags/` |

## What's fully implemented and tested (73 automated tests, real Postgres/Redis)

- Foundation: FastAPI app, structured JSON logging, `/health`, `/ready`, `/metrics`
- Full DB schema (26 tables) + Alembic migration, verified upgrade/downgrade
- JWT auth (access + refresh), Argon2 password hashing, RBAC (5 roles)
- Ingestion: adapter interface, Open-Meteo (real HTTP), IMD (real interface +
  labelled demo fallback when no credentials), raw preservation, idempotent
  dedup by payload hash, schema validation, normalization
- QC rule engine: all 11 rules from the spec, configurable thresholds
- Feature engineering: deltas, rolling stats, rate of change, z-score,
  neighbor stats, historical baselines — never zero-fills missing data
- Isolation Forest: training, candidate registry (never auto-activates),
  evaluation, inference — all on engineered features, never raw values.
  **6 models (one per measurement) trained on real ingested data and
  activated** (`scripts/train_models.py`) — ML genuinely contributes to
  fusion scores now, not a placeholder.
- Context engine: distinguishes "unavailable" from "disagrees", neighbor/
  forecast/ERA5/GPM consistency scoring. **Station neighbors computed**
  (`scripts/compute_neighbors.py`) — spatial context is real.
- **Calibration profiles wired end-to-end**: a default active profile
  exists and the pipeline actually loads and applies its rule thresholds,
  fusion weights, decision thresholds, and health weights — not just
  stored in the DB and ignored (proven by
  `tests/integration/test_calibration_wiring.py`).
- Models API (`GET/POST /api/v1/models`) — was speced but never built;
  now exists with list/get/activate.
- Admin endpoints: `GET /admin/calibration`, `GET /admin/data-sources`,
  `POST /admin/ingest/{station_id}` (manual trigger), plus the existing
  ingestion-jobs list/replay.
- Evidence fusion, confidence scoring (distinct from fault score),
  ExtremeEventGuard, reason codes — validated against both canonical spec
  end-to-end cases (genuine extreme rainfall vs. sensor-fault temperature spike)
- Alert policies with deduplication (burst/consecutive/critical/informational)
- Operator review → label store → audit log
- Station health scoring
- Celery pipeline wiring (`process_observation` orchestrates the full chain);
  full end-to-end integration test proves raw → ... → anomaly → alert →
  health → WebSocket event
- WebSocket relay over real Redis Pub/Sub (`/ws/dashboard`, `/ws/alerts`,
  `/ws/stations/{id}`)
- Prometheus metrics wired into ingestion/QC/ML/context/alerts/websockets;
  **Prometheus + Grafana verified actually running** (locally via Homebrew,
  no Docker needed — dashboard imported and confirmed scraping live data),
  not just configured on disk
- Rate limiting on login, security headers, error envelope, audit logging
- Synthetic fault generator (`scripts/inject_fault.py`), all 6 fault types
  verified against a live database

## Known gaps / follow-ups

- **Docker Compose / full multi-container stack** — written, never booted
  (no Docker in this dev environment). Each piece has been verified to
  actually work standalone outside Docker (Postgres/Redis via Homebrew,
  Prometheus/Grafana via Homebrew), which derisks the compose file
  somewhat, but the compose file itself has not been run.
- **Airflow DAGs** (`airflow/dags/*.py`) are written and syntax-checked but
  not runtime-verified — no Docker in this environment to run the Airflow
  image. They're thin wrappers around already-tested service code
  (`IngestionService`, `ModelRegistry`, etc.), so the risk is limited to
  DAG-definition glue, not business logic.
- **ERA5 / NASA GPM adapters** implement the real interface but return
  `[]` (correctly surfaced as "context unavailable", not "zero") until
  CDS/Earthdata credentials are configured — these require batch retrieval
  workflows (cdsapi jobs, IMERG granule subsetting) out of scope for a
  synchronous per-observation fetch; wire them through the backfill DAG
  when credentials are available.
- **mypy**: 41 findings remain, almost entirely `Mapped[datetime]` being
  seen as `DateTime` across module boundaries (a stub-resolution artifact,
  not a real type error — every one of those call sites is exercised by a
  passing test). CI runs mypy non-blocking; worth tightening later with
  `disallow_untyped_defs` once the codebase settles.
- **Feature climatology** (`historical_same_month_mean`) uses a simple
  windowed query rather than a precomputed rollup table; fine at current
  scale, would want a materialized view once station count grows.
- No Kubernetes, per the spec — the modular monolith + independently
  scalable Celery workers is deliberate.
