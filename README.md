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

## What's live

- Public landing page at `/` explaining the product; the operator console
  (`/dashboard` and everything else under the sidebar) requires sign-in —
  unauthenticated visitors are redirected to `/`.
- Login (`/login`): Google Sign-In (OAuth2 ID token flow) as the primary
  path, email/password as a fallback for the seeded demo admin. Google
  sign-in needs `GOOGLE_CLIENT_ID` (backend) + `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
  (frontend) set to a real OAuth client ID — until then the button shows a
  clear "not configured" message instead of failing silently. First-time
  Google sign-in provisions a VIEWER account automatically.
- JWT stored client-side; the Topbar reflects real sign-in state; alert
  acknowledge/review actions require it.
- Alert acknowledge/confirm-fault/valid-extreme/false-positive actions in
  `AlertDetailModal` call the real `PATCH /alerts/{id}` and
  `POST /anomalies/{id}/review` endpoints.
- Dashboard alerts/stats and the Topbar notification bell use a real
  WebSocket (`/ws/dashboard`, `/ws/alerts`) with poll fallback, not pure
  polling — alert status changes push immediately.
- 6 Isolation Forest models (one per measurement) trained on real
  ingested data and activated — ML genuinely contributes to fusion now,
  not just rules + context. Retrain with `scripts/train_models.py`.
- Station neighbors computed (`scripts/compute_neighbors.py`) — spatial
  context is real, not always "unavailable".
- A default `calibration_profiles` row is active and the pipeline actually
  loads it (rule thresholds, fusion weights, decision thresholds, health
  weights) — not just stored and ignored.
- `/settings` shows the real active calibration profile + data source
  status; `/admin` (ADMIN role) lists/replays ingestion jobs and
  lists/activates models.
- Prometheus + Grafana verified actually running (locally via Homebrew,
  no Docker needed) against the live backend — not just configured.
- CI actually runs on push (was previously in the wrong directory for
  GitHub Actions to find it — fixed).

## What's still not wired up

- Docker Compose / full multi-container stack — written, never booted (no
  Docker in this dev environment). Config verified correct by proxy (each
  piece works standalone), but the compose file itself is unverified.
- Airflow DAGs — written, syntax-checked, never executed (needs Docker or
  a local Airflow install).
- See [`queue/`](queue/) for anything blocked on an external process
  (IMD credentials, etc).

## Project background

This is a Smart India Hackathon 2026 submission — see
`SIH2026-IDEA-MeghDrishti-Winner-Style-v2_ Edit (1).pptx.pdf` for the
original pitch deck.
