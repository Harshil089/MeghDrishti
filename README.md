# MeghDrishti

AI/ML-based intelligent anomaly detection for Automatic Weather Stations.
Distinguishes genuine extreme weather from sensor malfunction, drift,
spikes, and telemetry faults — never on statistical extremity alone.

This repo has two parts:

- **`/`** (this directory) — Next.js frontend: dashboard, alerts, network
  map, live monitor, analysis, maintenance, sensor health.
- **`meghdrishti-backend/`** — FastAPI backend: ingestion, rule engine,
  Isolation Forest, context validation, evidence fusion, alerting, operator
  review, Celery workers, Airflow DAGs. See
  [`meghdrishti-backend/README.md`](meghdrishti-backend/README.md) for
  full backend docs.

## Quickstart

**Backend first** (frontend has nothing to show without it):

```bash
cd meghdrishti-backend
cp .env.example .env
# needs Postgres + Redis running — see backend README for local (no-Docker)
# setup, or `docker compose up -d` if you have Docker
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cp .env.example .env.local   # sets NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
npm install
npm run dev
```

Open:
- Frontend: http://localhost:3000
- Backend API + Swagger: http://localhost:8000/docs

## Architecture

```
RAW OBSERVATION → INGESTION → SCHEMA VALIDATION → NORMALIZATION → FEATURES
    ↓
 ┌──────────────┬────────────────┬───────────────────┐
 │ Rule Engine  │ Isolation      │ Context Validator  │
 │              │ Forest         │                    │
 └──────────────┴────────────────┴───────────────────┘
    ↓
 EVIDENCE FUSION → CONFIDENCE → DECISION (ExtremeEventGuard)
    ↓
 NORMAL / WATCH / SUSPICIOUS / PROBABLE_SENSOR_FAULT / LIKELY_GENUINE_EXTREME
    ↓
 ALERT → OPERATOR REVIEW → LABEL STORE
```

Every number the frontend shows comes from a live backend query — nothing
in `src/lib/api.ts` is fabricated. `src/lib/mock-data.ts` holds only types,
UI color/legend config, and static reference copy (operator runbook text,
pipeline-stage descriptions), never numbers presented as live data.

## Live data sources

- **Open-Meteo** — live now, no API key required.
- **IMD** (India Meteorological Department) — real adapter built
  (`meghdrishti-backend/app/ingestion/imd.py`), inactive pending IMD API
  access approval (external legal/institutional process). See
  [`queue/imd-integration.md`](queue/imd-integration.md).
- **NOAA / ERA5 / NASA GPM** — adapter interfaces built, inactive pending
  credentials/implementation. Same "real interface, inert until ready"
  pattern as IMD.

## What's not wired up yet

- No login UI — backend JWT auth is built and tested, frontend has no
  login page, so write actions (submit review, acknowledge alert) aren't
  reachable from the UI yet.
- "Real-time" pages poll every 10–20s; the backend's WebSocket endpoints
  (`/ws/dashboard`, `/ws/alerts`) are built and tested but the frontend
  doesn't open a socket yet.
- No trained/activated ML model yet — anomaly decisions currently run on
  rules + context only until an Isolation Forest is trained and activated
  (`meghdrishti-backend/airflow/dags/model_training.py`, or run the
  training/registry code directly).
- Station neighbor computation and calibration profiles haven't been run
  yet, so spatial context and threshold tuning use defaults.
- See [`queue/`](queue/) for anything blocked on an external process.

## Project background

This is a Smart India Hackathon 2026 submission — see
`SIH2026-IDEA-MeghDrishti-Winner-Style-v2_ Edit (1).pptx.pdf` for the
original pitch deck.
