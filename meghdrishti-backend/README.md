<div align="center">

# MeghDrishti Backend

**The engine behind the console:** ingestion, QC rules, Isolation Forest, context validation,
evidence fusion, alerting and operator review.

![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-async-D71F00?logo=sqlalchemy&logoColor=white)
![Celery](https://img.shields.io/badge/Celery-Beat-37814A?logo=celery&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Pub%2FSub-DC382D?logo=redis&logoColor=white)
![Tests](https://img.shields.io/badge/tests-120%20passing-3ccf91)

[← Project README](../README.md) · [API docs (local)](http://localhost:8000/docs) · [Decision evaluation](docs/decision-accuracy.md) · [Provider & ML audit](docs/provider-ml-audit.md)

<br />

<img src="../docs/screenshots/alert-drawer.png" alt="An alert explained by the backend: findings, comparisons and the readings behind it" width="100%" />

<sub>Every alert carries its evidence: which rules fired, what the context said, and the readings behind it.</sub>

</div>

---

## Pipeline

```mermaid
flowchart TD
    R[Raw observation<br/><i>never mutated</i>] --> V[Schema validation + normalization]
    V --> F[Feature engineering<br/>deltas · rolling stats · z-score · neighbors · climatology]
    F --> Q[Rule engine<br/>app/qc]
    F --> M[Isolation Forest<br/>app/ml]
    F --> C[Context validator<br/>app/context]
    Q --> X[Evidence fusion → confidence → ExtremeEventGuard<br/>app/scoring]
    M --> X
    C --> X
    X --> D{NORMAL · WATCH · SUSPICIOUS<br/>PROBABLE_SENSOR_FAULT<br/>LIKELY_GENUINE_EXTREME<br/>INSUFFICIENT_CONTEXT}
    D --> A[Alert policy<br/>app/alerts]
    A --> W[WebSocket + station health]
    A --> O[Operator review → label store]
```

Rule, ML and context outputs are persisted independently (`qc_rule_results`, `ml_results`,
`context_results`) before fusion. That makes every decision auditable after the fact.

---

## Run it

The backend is started together with the frontend from the repository root.
Follow the root [Quickstart](../README.md#quickstart), then:

```bash
npm run dev      # Postgres, Redis, API, worker, beat, frontend
npm run status
npm run stop
```

From this directory, `make up`, `make down` and `make status` do the same.

- **App:** http://localhost:3000
- **API + Swagger:** http://localhost:8000/docs
- **Logs:** `../.local/logs/`

<details>
<summary><b>Runtime details</b></summary>

- One Celery worker with a solo pool consumes every queue. `DB_POOLING=false` on the worker prevents
  asyncpg connections being reused across Celery tasks' separate event loops; the API keeps pooling on.
- Four UTC Beat schedules run ingestion (every 15 minutes, last 20 minutes of data), the station roster,
  model training and calibration proposals.
- Scheduled failures are logged. Beat has no DAG run history or automatic retries.
- Candidate models and calibration profiles stay inactive until explicitly activated.
- Grafana and Prometheus configs are in `monitoring/`; the launcher does not start them.

</details>

---

## Tests

```bash
# Use a dedicated test database, never the application database.
"$(brew --prefix postgresql@16)/bin/createdb" -h localhost -O meghdrishti meghdrishti_test
DATABASE_URL=postgresql+asyncpg://meghdrishti:meghdrishti@localhost:5432/meghdrishti_test \
  REDIS_URL=redis://localhost:6379/3 .venv/bin/pytest -q
.venv/bin/ruff check app
.venv/bin/mypy app   # non-blocking in CI
```

### Demo: inject a fault and watch it flow through

```bash
python scripts/inject_fault.py --station IMD_PUNE_001 --type spike \
    --measurement temperature_c --process
```

This seeds 15 normal readings, injects one faulty observation, and runs it through the whole chain:
rules → features → ML → context → fusion → decision → anomaly → alert → station health → WebSocket event.

Fault types: `stuck` · `spike` · `drift` · `dropout` · `telemetry_gap` · `physical_impossibility`

---

## Data sources and credentials

All credentials go in `meghdrishti-backend/.env` (see `.env.example`). Missing credentials are reported
as "context unavailable", never as zero.

| Source | Adapter | Env vars | Notes |
|---|---|---|---|
| **Open-Meteo** | `app/ingestion/open_meteo.py` | none | Primary feed, 15-minute steps |
| **NASA GPM** IMERG Early | `app/ingestion/gpm.py` | `NASA_GPM_STORAGE` (`PPS` or `GES_DISC`), `NASA_GPM_USERNAME`, `NASA_GPM_PASSWORD`, `NASA_GPM_DATA_DIR` | Uses [gpm-api](https://gpm-api.readthedocs.io/); about 4 h latency; rainfall only |
| **ERA5** | `app/ingestion/era5.py` | `ERA5_CDS_URL`, `ERA5_CDS_KEY` | Accept the dataset licence on the CDS site first; about 5 days latency, so newer readings are skipped |
| **NOAA GHCN** | `app/ingestion/ghcn.py` | `GHCN_BASE_URL`, `GHCN_API_TOKEN` | Daily summaries; recent coverage for India is sparse |
| **IMD** | `app/ingestion/imd.py` | `IMD_ENABLED`, `IMD_API_BASE_URL`, `IMD_API_KEY` | Waiting for institutional API access |

> A provider is never used to confirm its own data. Open-Meteo readings are not checked against the
> Open-Meteo forecast, and so on.

---

## Code map

| Layer | Path |
|---|---|
| API routes | `app/api/` |
| Domain models | `app/models/` |
| Repositories | `app/repositories/` |
| Ingestion adapters | `app/ingestion/` |
| QC rule engine | `app/qc/` |
| Feature engineering | `app/features/` |
| ML (Isolation Forest) | `app/ml/` |
| Context validation | `app/context/` |
| Evidence fusion and decision | `app/scoring/` |
| Alerting | `app/alerts/` |
| Station health | `app/health/` |
| Celery worker and Beat schedules | `app/workers/` |
| Optional legacy Airflow DAGs | `airflow/dags/` |

---

## What's implemented

<table>
<tr><td>

**Platform**
- FastAPI with structured JSON logs, `/health`, `/ready`, `/metrics`
- 26-table schema with Alembic migrations
- JWT (access + refresh), Argon2, RBAC with 5 roles
- Login rate limiting, security headers, error envelope, audit log
- WebSockets over Redis Pub/Sub: `/ws/dashboard`, `/ws/alerts`, `/ws/stations/{id}`
- Prometheus metrics across ingestion, QC, ML, context, alerts and sockets

</td><td>

**Quality control**
- All 11 QC rules from the spec, with configurable thresholds
- Features that never zero-fill missing data
- Isolation Forest candidate registry with explicit, guarded activation
- Context engine that separates "unavailable" from "disagrees"
- Evidence fusion, confidence (distinct from fault score), ExtremeEventGuard and reason codes
- Alert policies with deduplication; operator review → labels → audit log

</td></tr>
<tr><td>

**Ingestion**
- Raw payloads preserved, deduplicated by payload hash
- Schema validation and normalization to UTC
- Source and station identity checks on every record
- Manual trigger `POST /admin/ingest/{station_id}` plus job list and replay

</td><td>

**Operations**
- Calibration profiles loaded and applied by the pipeline
  (proven by `tests/integration/test_calibration_wiring.py`)
- Models API: `GET/POST /api/v1/models`
- Admin: `GET /admin/calibration`, `GET /admin/data-sources`
  (enabled status reflects configured credentials)
- Station health scoring and maintenance predictions

</td></tr>
</table>

---

## Known gaps

- **ML accuracy is unknown.** There are no independent labels yet and no active model.
  Forecast-trained candidates are diagnostic only; activation needs real sensor data with
  chronological holdout evaluation. See [the audit](docs/provider-ml-audit.md).
- **Context is thin for live data.** With Open-Meteo as the only feed, recent readings often have no
  independent context. GPM covers rainfall after about 4 hours and ERA5 covers older readings after about 5 days.
- **Scheduled operations.** Worker connectivity is verified; full execution of every Beat job is not.
- **Airflow** is an optional alternative in its own Python environment. Do not run it alongside Beat on the same jobs.
- **mypy** reports about 41 findings, almost all `Mapped[datetime]` stub-resolution artefacts. CI runs it non-blocking.
- **Climatology** (`historical_same_month_mean`) uses a windowed query; a materialized view would help at larger scale.
- **No Kubernetes**, by design: a modular monolith with independently scalable Celery workers.
