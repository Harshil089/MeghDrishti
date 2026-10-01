# MeghDrishti

AI/ML-based intelligent anomaly detection for Automatic Weather Stations.
Distinguishes genuine extreme weather from sensor malfunction, drift,
spikes, and telemetry faults — never on statistical extremity alone.

This repo has two parts:

- **`/`** (this directory) — Next.js frontend: dashboard, alerts, network
  map, live monitor, analysis, maintenance, sensor health.
- **`meghdrishti-backend/`** — FastAPI backend: ingestion, rule engine,
  Isolation Forest, context validation, evidence fusion, alerting, operator
  review, Celery worker, and Celery Beat schedules. See
  [`meghdrishti-backend/README.md`](meghdrishti-backend/README.md) for
  full backend docs.

## Quickstart

**Run locally with native services.**

Install prerequisites once: Node.js, Python 3.12+, Homebrew, and `uv`.

```bash
brew install postgresql@16 redis
cd meghdrishti-backend
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e ".[dev]"
test -f .env || cp .env.example .env
cd ..
npm install
```

Start or stop the whole local application from the repository root:

```bash
npm run dev
npm run status
npm run stop
```

This starts dedicated native Postgres and Redis instances, FastAPI, one
Celery worker, Celery Beat, and Next.js. State and logs live in ignored
`.local/`; the existing Homebrew Postgres cluster is not modified. Database
and Redis must use the example localhost URLs. Services run in the background;
use `npm run stop` to shut down the full stack. Repeating `npm run dev`
reuses running services, including this project's existing Next dev server.
Ports 5432, 6379, 8000, and 3000 must be available to this project.
Services bind to loopback. Initial database setup seeds
only an empty users table; existing data is retained.

Celery Beat schedules ingestion every 15 minutes, daily
station roster refresh at 03:00 UTC, model candidate training Sunday
03:00 UTC, and calibration proposals Monday 04:00 UTC. Run only one Beat
instance. Optional legacy Airflow DAGs must not schedule the same jobs simultaneously.
The single worker handles jobs sequentially; slow ingestion or training
can delay QC. It is suitable for laptop development, not a throughput claim.
Beat does not provide Airflow's DAG UI, dependency tracking, or task retry
policy. Inspect `.local/logs/worker.log` for failed scheduled jobs.

Optional historical backfill uses the same native task (example: seven days):

```bash
cd meghdrishti-backend
.venv/bin/celery -A app.workers.celery_app call \
  app.workers.schedule_tasks.run_scheduled_job --queue schedule \
  --args '["ingest"]' --kwargs '{"window_minutes":10080,"sources":["OPEN_METEO"]}'
```

Prometheus and Grafana are optional; the launcher does not start them.
Prometheus's native scrape configuration is
`meghdrishti-backend/monitoring/local/prometheus-local.yml`. Grafana's
`meghdrishti-backend/monitoring/grafana/dashboards/overview.json` can be
imported through its UI.
Airflow DAGs remain an optional alternative in a separate Python environment;
their backend API defaults to `http://localhost:8000/api/v1`. Provide the same
`DEMO_ADMIN_EMAIL` and `DEMO_ADMIN_PASSWORD` in the Airflow process environment.

Docker deployment files have been removed. Existing native data, models,
and private migration backups remain under `.local/` and
`meghdrishti-backend/model_store/`. Logs are in `.local/logs/`; Postgres and
Redis logs are `.local/postgres.log` and `.local/redis/redis.log`.
API shutdown allows up to 15 seconds for active requests, then cancels them.
Workers finish their current task; if that exceeds 60 seconds, retry `stop`.

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

## Interactive weather pipeline hero

The landing page (`/`) embeds the adapted 3D scene beside the headline.
Five selectable modules illustrate ingestion, QC, ML, context and decision
fusion, with the technologies and provider integrations used by MeghDrishti.
The models are weather-system artifacts: an automatic weather station,
QC diagnostic instrument, ML server rack, forecast context equipment and
operator alert terminal. Rendering uses up to 2× pixel density, doubled
canvas-texture resolution and a 30 fps animation cap to bound GPU work.

- Reusable component: `src/components/ui/agentic-factory-3d.tsx`.
- Hero integration: `src/components/WeatherPipelineHero.tsx`, used by `src/app/page.tsx`.
- Styles: global Tailwind styles live in `src/app/globals.css`; scene styles
  are scoped inside the supplied component.
- Dependencies: React, Three.js, `@types/three`, and lucide-react are already
  installed. No image assets, context provider, or state store is needed.
- Props: `height` (default `100vh`), `className`, `embed`, `onStation`, `onReady`.
  The hero stacks on narrow screens and centers the machine in its column.
  Reduced motion pauses simulation by default; pause/reset and module
  controls are keyboard accessible. Labels describe architecture, not live
  telemetry, and distinguish candidate ML and optional integrations.

The project uses Tailwind 4 and TypeScript. `@/*` resolves to `src/*`, so
`src/components/ui` is the equivalent of `/components/ui`. Keep reusable UI
there so imports such as `@/components/ui/agentic-factory-3d` resolve and
future shadcn components have a consistent home.

shadcn CLI configuration (`components.json`) is not initialized. To add
shadcn primitives later, run `npx shadcn@latest init` from the repository root;
use `src/app/globals.css`, `@/components`, and `@/components/ui` when prompted.
Review generated CSS/theme changes before accepting them into the existing
design. This procedural component works without shadcn primitives.

## Live data sources

- **Open-Meteo** — live now, no API key required.
- **IMD** (India Meteorological Department) — real adapter built
  (`meghdrishti-backend/app/ingestion/imd.py`), inactive pending IMD API
  access approval (external legal/institutional process). See
  [`queue/imd-integration.md`](queue/imd-integration.md).
- **GHCN / ERA5 / NASA GPM** — optional adapters requiring credentials
  and available data. ERA5 access remains unverified; configured credentials
  alone do not establish provider availability.

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
- Alerts show the source observation time, including its date. API receipt and
  decision processing times are separate fields in the detail view. New burst
  windows, chronological ordering and deduplication use observation time, so
  delayed ingestion/backfill does not make historical readings look new.
  Synthetic readings, their derived alerts and demo-trained models have been
  removed. IMD has no demo fallback and requires enabled access and credentials.
  See the [stored alert audit](meghdrishti-backend/docs/alert-audit.md).
  Existing alert creation times remain preserved for auditing; historical
  processing-time policy counts have not been rewritten.
- Dashboard alerts/stats and the Topbar notification bell use a real
  WebSocket (`/ws/dashboard`, `/ws/alerts`) with poll fallback, not pure
  polling — alert status changes push immediately.
- Isolation Forest models contribute to fusion when an active model is
  registered. Training produces candidates; activation is explicit. Retrain
  with `scripts/train_models.py` from the backend directory.
- Station neighbors computed (`meghdrishti-backend/scripts/compute_neighbors.py`) — spatial
  context is real, not always "unavailable".
- A default `calibration_profiles` row is active and the pipeline actually
  loads it (rule thresholds, fusion weights, decision thresholds, health
  weights) — not just stored and ignored.
- `/settings` shows the real active calibration profile + data source
  status; `/admin` (ADMIN role) lists/replays ingestion jobs and
  lists/activates models.
- Prometheus metrics are exposed by the API. Optional native Prometheus
  and Grafana configurations are provided; they are not started by default.
- CI actually runs on push (was previously in the wrong directory for
  GitHub Actions to find it — fixed).

## What's still not wired up

- Native frontend/API startup and worker connectivity are verified. Full
  execution of each Celery Beat scheduled operation remains unverified.
- Optional legacy Airflow DAGs remain available; normal startup uses Celery Beat.
- See [`queue/`](queue/) for anything blocked on an external process
  (IMD credentials, etc).

## Focused verification

The backend suite passed 104 tests on isolated Postgres/Redis on 2026-10-01.
A synthetic source test verifies raw ingestion, normalization, a persisted
alert, station health, Redis publication, and duplicate processing protection.
Scheduled-job tests cover pagination, protected endpoint calls, and failure
reporting with HTTP fixtures; they do not prove live provider availability.

Separately, Open-Meteo returned 15/15 successful live samples across five
stations. The adapter now explicitly requests wind in m/s and normalizes
timestamps/windows to UTC. Historical wind data still needs correction.
ML accuracy cannot be measured with the current zero independent labels;
all models remain inactive candidates. See the [provider and ML audit](meghdrishti-backend/docs/provider-ml-audit.md)
for evidence, candidate diagnostics, and limitations.

Fused decision improvements are documented in [the decision evaluation](meghdrishti-backend/docs/decision-accuracy.md):
240 controlled synthetic scenarios matched their intended classifications,
compared with 80 at the committed baseline. This is a diagnostic result,
not field accuracy. The read-only evaluation script also reports actual
operator-review precision/recall when labels become available.

To repeat the native shutdown check from the repository root:

```bash
meghdrishti-backend/.venv/bin/python scripts/verify_local_shutdown.py
```

This starts and stops the app twice with an idle WebSocket open and leaves
all native services stopped. Both verified cycles completed in 4.3 seconds
without reaching the API's forced cancellation deadline.

## Project background

This is a Smart India Hackathon 2026 submission — see
`SIH2026-IDEA-MeghDrishti-Winner-Style-v2_ Edit (1).pptx.pdf` for the
original pitch deck.

## Feed acceptance and browser origins

`CORS_ORIGINS` accepts exact HTTP(S) origins only, without paths or wildcards.
Browser methods and headers are explicit. Writes carrying an unapproved Origin
are rejected before reaching API handlers. Scheduled jobs can omit Origin;
the ingestion endpoints still require an authenticated admin permission.
CORS is a browser boundary, not feed authentication or proof that data is true.

There is no public observation-upload endpoint. Ingestion uses configured source
adapters. Each normalized record must match the adapter's source identity and
requested station (GHCN uses the resolved NOAA station ID), and its timestamp
must be within the requested window. GHCN daily dates use daily window semantics.
Rejected payloads remain in raw storage with a rejection reason and are excluded
from normalized observations. API receipt time is assigned by the server.
Existing measurement schema checks, payload deduplication, source-separated
histories, demo exclusion from training and explicit model activation also apply.
These checks do not detect every plausible forged reading from a compromised
provider or protect against an attacker who already controls the database.
