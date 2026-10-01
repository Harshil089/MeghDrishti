# MeghDrishti Backend

AI/ML-based intelligent anomaly detection for Automatic Weather Stations.
Distinguishes genuine extreme weather from sensor malfunction using rule-based
QC, Isolation Forest, and external context validation — never on statistical
extremity alone.

## Local development

Recommended for laptop development. Follow the root [Quickstart](../README.md#quickstart):

```bash
# From repository root, after installing dependencies:
npm run dev
npm run status
npm run stop
```

The launcher uses `.venv`, dedicated Postgres/Redis data in `../.local/`,
one Celery worker with a solo pool, and Celery Beat instead of Airflow.
`DB_POOLING=false` on the worker prevents reuse of asyncpg connections across
Celery tasks' separate event loops. API database pooling stays enabled.
Optional Grafana and Prometheus processes are not started by the launcher.

Four UTC schedules run ingestion, model training, calibration,
and station roster jobs. Backfill is available through the native scheduled
job task; see the root README. Candidate models and calibration profiles
remain inactive until explicitly activated. Scheduled failures are logged;
Beat does not provide DAG run history or scheduled-operation retries.

Open http://localhost:3000 for the app and http://localhost:8000/docs for the
API. From this backend directory, `make up`, `make down`, and `make status`
also control the full native stack. Logs are in `../.local/logs/`.

## Tests

```bash
# Create a dedicated test database first; never use the application database.
"$(brew --prefix postgresql@16)/bin/createdb" -h localhost -O meghdrishti meghdrishti_test
DATABASE_URL=postgresql+asyncpg://meghdrishti:meghdrishti@localhost:5432/meghdrishti_test \
  REDIS_URL=redis://localhost:6379/3 .venv/bin/pytest -q
.venv/bin/ruff check app
.venv/bin/mypy app   # non-blocking in CI; a handful of SQLAlchemy Mapped[]
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
`context_results`) before fusion. See the root README for the application overview.

### Modules

| Layer | Path |
|---|---|
| API | `app/api/` |
| Domain models | `app/models/` |
| Repositories | `app/repositories/` |
| Ingestion adapters | `app/ingestion/` (Open-Meteo real, IMD real, credentials required, GHCN/ERA5/GPM real-interface-with-graceful-fallback) |
| QC rule engine | `app/qc/` |
| Feature engineering | `app/features/` |
| ML (Isolation Forest) | `app/ml/` |
| Context validation | `app/context/` |
| Evidence fusion / decision | `app/scoring/` |
| Alerting | `app/alerts/` |
| Station health | `app/health/` |
| Celery worker and Beat schedules | `app/workers/` |
| Optional legacy Airflow DAGs | `airflow/dags/` |

## Implemented capabilities

- Foundation: FastAPI app, structured JSON logging, `/health`, `/ready`, `/metrics`
- Full DB schema (26 tables) + Alembic migration, verified upgrade/downgrade
- JWT auth (access + refresh), Argon2 password hashing, RBAC (5 roles)
- Ingestion: adapter interface, Open-Meteo (real HTTP), IMD (real interface; credentials required), raw preservation, idempotent
  dedup by payload hash, schema validation, normalization
  Synthetic data and its generator have been removed. IMD is scheduled only
  when enabled with credentials.
  See the [stored alert audit](docs/alert-audit.md).
- QC rule engine: all 11 rules from the spec, configurable thresholds
- Feature engineering: deltas, rolling stats, rate of change, z-score,
  neighbor stats, historical baselines — never zero-fills missing data
- Isolation Forest: training, candidate registry (never auto-activates),
  evaluation, inference — all on engineered features, never raw values.
  Models contribute to fusion when an active version is registered.
  Train with `scripts/train_models.py`; API/CLI use the same source-filtered,
  chronological holdout policy. Demo data and unverified wind units are excluded.
  Forecast candidates are diagnostic only and cannot be activated. Activation
  of eligible sensor candidates is explicit; it does not establish accuracy.
  See [ML evidence and limitations](docs/provider-ml-audit.md#ml-improvement-follow-up--2026-10-01).
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
  Optional native Prometheus scrape configuration and an importable Grafana
  dashboard are supplied; neither process is started by the launcher
- Rate limiting on login, security headers, error envelope, audit logging
- Synthetic fault generator (`scripts/inject_fault.py`), all 6 fault types
  verified against a live database

## Known gaps / follow-ups

- **Scheduled operations**: native startup and worker connectivity are
  verified; full execution of each Beat scheduled operation remains unverified.
- **Airflow DAGs** are an optional alternative in a separate Python environment.
  Use a localhost backend API URL and export the admin credentials to Airflow.
  Do not schedule the same jobs concurrently with Beat.
- **Live providers / ML validation**: Open-Meteo passed 15/15 live samples
  on 2026-10-01. Its wind-unit mapping and UTC handling are fixed; historical
  wind data remains affected. Zero independent labels and zero active models
  mean ML accuracy is unknown. See [the audit](docs/provider-ml-audit.md) and
  [fused decision evaluation](docs/decision-accuracy.md).
- **ERA5 / NASA GPM adapters** require CDS/Earthdata credentials and batch
  retrieval. Missing credentials are surfaced as unavailable context.
  ERA5 credentials are present locally, but retrieval was not verified in
  this audit; use the backfill workflow to validate access and data delivery.
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
