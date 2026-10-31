<div align="center">

<img src="src/app/icon.svg" width="72" alt="MeghDrishti logo" />

# MeghDrishti

**Tell a real storm from a broken sensor.**

AI/ML quality control for Automatic Weather Stations. MeghDrishti flags suspicious readings,
checks them against independent weather context, and separates genuine extreme weather
from sensor faults, drift, spikes and telemetry gaps. It never decides on statistical extremity alone.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Celery-DC382D?logo=redis&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-Isolation%20Forest-F7931E?logo=scikitlearn&logoColor=white)
![SIH 2026](https://img.shields.io/badge/Smart%20India%20Hackathon-2026-FF6F00)

[Screenshots](#a-look-inside) · [How it works](#how-it-works) · [Quickstart](#quickstart) · [Data sources](#data-sources) · [Backend docs](meghdrishti-backend/README.md)

<br />

<img src="docs/screenshots/landing.png" alt="MeghDrishti National AWS Quality Control Landing Page" width="100%" />

</div>

---

## Why MeghDrishti

A weather station reports 48 °C. Is it a heatwave or a sensor sitting in the sun?
Classic QC either throws away real extremes or lets faulty sensors through.
MeghDrishti treats every unusual reading as a question and answers it with evidence:

- **3,111+ National Stations**: Full-scale pan-India coverage across all IMD AWS and ARG locations
- **11 WMO Rule Checks**: Physical range, step changes, spikes, persistence, drift and telemetry dropouts
- **Isolation Forest ML**: Scoring on engineered anomaly features, never raw values
- **Multi-Source Spatial Consensus**: Independent verification against neighboring AWS, NASA GPM satellite rain, ECMWF ERA5, and NWP forecasts
- **Extreme Event Protection Guard**: Refuses to call a real extreme weather event "fake" when spatial context confirms it
- **Cryptographic Operator Ledger**: Explainable evidence dossiers with binding operator dispositions logged for audit compliance

---

## A look inside

### Command Overview
Real-time national AWS network command overview: 4-parameter fleet KPIs, priority station telemetry spotlight with 5-parameter readings, fleet integrity breakdown, and 24-hour spatial-temporal anomaly matrix.

<img src="docs/screenshots/overview.png" alt="National AWS Network Command Overview" width="100%" />

<table>
  <tr>
    <td width="50%">
      <b>Anomaly Triage Workbench</b><br />
      Flagged observation queue on the left; multi-source spatial consensus, WMO runbooks, and binding operator dispositions on the right.<br /><br />
      <img src="docs/screenshots/alerts.png" alt="Anomaly Triage Workbench" />
    </td>
    <td width="50%">
      <b>National AWS Spatial Grid</b><br />
      Interactive GIS network map with state/district directory, live station status, and quick-jump priority dock.<br /><br />
      <img src="docs/screenshots/network.png" alt="National AWS Spatial Grid Map" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <b>QC & Rule Analytics</b><br />
      Ensemble classification breakdown, deterministic rule trigger leaderboard, and interactive hourly anomaly histogram.<br /><br />
      <img src="docs/screenshots/analysis.png" alt="QC and Rule Analytics" />
    </td>
    <td width="50%">
      <b>Live Telemetry Stream</b><br />
      Real-time 10-second polling of station waveforms, multi-parameter traces, packet-to-packet deltas, and WMO dials.<br /><br />
      <img src="docs/screenshots/live.png" alt="Live Telemetry Stream" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <b>Telemetry & Audit Ledger</b><br />
      Immutable archive of raw ingested observations (stored without interpolation) alongside the operator classification ledger.<br /><br />
      <img src="docs/screenshots/history.png" alt="Telemetry and Operator Audit Ledger" />
    </td>
    <td width="50%">
      <b>Sensor Fleet Reliability</b><br />
      7-day probe reliability index across all 6 WMO meteorological instruments derived from quality check trigger rates.<br /><br />
      <img src="docs/screenshots/sensors.png" alt="Sensor Fleet Reliability" />
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <b>Field Maintenance & Calibration Dispatch</b><br />
      Predictive 4-tier dispatch matrix prioritizing stations for regional instrument division dispatch and automated work orders.<br /><br />
      <img src="docs/screenshots/maintenance.png" alt="Field Maintenance and Calibration Dispatch" />
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <b>Pipeline Operations & ML Admin</b><br />
      4-stage telemetry ingestion DAG health, source uptime matrix, job replay queue, and Isolation Forest model registry.<br /><br />
      <img src="docs/screenshots/admin.png" alt="Pipeline Operations and Model Registry Admin" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <b>System Calibration & Feeds</b><br />
      Active WMO decision thresholds, ensemble evidence fusion weights, and external context feed connectors.<br /><br />
      <img src="docs/screenshots/settings.png" alt="System Calibration and Feeds" />
    </td>
    <td width="50%">
      <b>Operator Clearance Gateway</b><br />
      Institutional clearance portal with role-based meteorological personnel authentication.<br /><br />
      <img src="docs/screenshots/login.png" alt="Operator Clearance Gateway" />
    </td>
  </tr>
</table>


---

## How it works

```mermaid
flowchart LR
    A[Providers<br/>Open-Meteo · IMD] --> B[Ingestion<br/>raw preserved]
    B --> C[Schema check<br/>+ normalize]
    C --> D[Features]
    D --> E1[Rule engine]
    D --> E2[Isolation Forest]
    D --> E3[Context<br/>neighbors · forecast<br/>ERA5 · GPM]
    E1 & E2 & E3 --> F[Evidence fusion<br/>+ ExtremeEventGuard]
    F --> G{Decision}
    G --> H[Alert policy]
    H --> I[Operator review]
    I --> J[(Label store)]
```

Every reading ends up as one of:

| Classification | Meaning |
|---|---|
| `NORMAL` | Nothing unusual |
| `WATCH` | Mildly unusual, keep an eye on it |
| `SUSPICIOUS` | Unusual and unexplained |
| `PROBABLE_SENSOR_FAULT` | Rules or model point at the instrument |
| `LIKELY_GENUINE_EXTREME` | Unusual, but independent context agrees it is real weather |
| `INSUFFICIENT_CONTEXT` | Unusual, and there is no independent evidence to decide either way |

Raw observations are never mutated. Rule, ML and context outputs are stored separately before fusion,
so every alert can show exactly why it was raised.

---

## Quickstart

**Prerequisites:** Node.js, Python 3.12+, Homebrew and [`uv`](https://docs.astral.sh/uv/).

```bash
# one-time setup
brew install postgresql@16 redis
cd meghdrishti-backend
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e ".[dev]"
test -f .env || cp .env.example .env
cd ..
npm install
```

```bash
npm run dev      # start everything
npm run status   # what's running
npm run stop     # stop everything
```

| Service | URL |
|---|---|
| App | http://localhost:13000 |
| API + Swagger | http://localhost:18000/docs |

`npm run dev` starts dedicated Postgres and Redis instances, FastAPI, one Celery worker,
Celery Beat and Next.js. State and logs live in the ignored `.local/` folder.
Ports 15432, 16379, 18000 and 13000 must be free.

> **Running on a laptop?** The scheduler only runs while the machine is awake.
> After sleep, open **Live** and click **Pull latest** to backfill the last 24 hours.

<details>
<summary><b>More on local operation</b></summary>

- Celery Beat schedules ingestion every 15 minutes, the station roster refresh daily at 03:00 UTC,
  model candidate training daily 03:30 UTC, and calibration proposals Monday 04:00 UTC.
  Run only one Beat instance.
- The single worker processes jobs sequentially, so slow ingestion or training can delay QC.
  It is meant for laptop development, not as a throughput claim.
- Logs: `.local/logs/` (API, worker, beat, frontend), `.local/postgres.log`, `.local/redis/redis.log`.
- API shutdown allows 15 seconds for active requests. Workers finish their current task;
  if that takes more than 60 seconds, run `stop` again.
- Historical backfill (example: 7 days):

  ```bash
  cd meghdrishti-backend
  .venv/bin/celery -A app.workers.celery_app call \
    app.workers.schedule_tasks.run_scheduled_job --queue schedule \
    --args '["ingest"]' --kwargs '{"window_minutes":10080,"sources":["OPEN_METEO"]}'
  ```

- Prometheus and Grafana are optional and not started by the launcher. Configs live in
  `meghdrishti-backend/monitoring/`.
- Optional legacy Airflow DAGs can replace Beat. Never run both on the same jobs.
- Shutdown check: `meghdrishti-backend/.venv/bin/python scripts/verify_local_shutdown.py`.

</details>

---

## Data sources

| Source | Role | What it covers | Setup |
|---|---|---|---|
| **Open-Meteo** | Primary feed | All measurements, every 15 minutes | No key needed |
| **NASA GPM** (IMERG Early) | Context | Rainfall, about 4 hours behind real time | Earthdata or PPS login in `.env` |
| **ERA5** (Copernicus) | Context | Temperature, pressure, humidity, about 5 days behind | CDS key + accepted licence |
| **NOAA GHCN** | Station network | Daily summaries from nearby stations | Token in `.env` (sparse recent coverage for India) |
| **IMD** | Primary feed | Real Indian station observations | Adapter built, waiting for API access |

> Open-Meteo is model output, so it is never used to confirm itself. Until real sensor data or
> independent context is available, recent readings can show `INSUFFICIENT_CONTEXT`. That is the system
> being honest, not a bug. See [`queue/imd-integration.md`](queue/imd-integration.md) for the IMD status.

---

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, Recharts, Leaflet, WebGL2 (ASCII backdrop), Framer Motion |
| API | FastAPI, Pydantic, SQLAlchemy (async), Alembic, JWT + Argon2, RBAC with 5 roles |
| Pipeline | Celery + Beat, Redis Pub/Sub, WebSockets |
| ML | scikit-learn Isolation Forest with a candidate registry and explicit activation |
| Context | gpm-api (NASA IMERG), cdsapi (ERA5), NOAA NCEI |
| Observability | Structured JSON logs, Prometheus metrics, optional Grafana dashboard |

---

## Project structure

```
MeghDrishti/
├── src/
│   ├── app/
│   │   ├── page.tsx              # public landing page
│   │   ├── login/                # Google Sign-In + email/password
│   │   └── (app)/                # signed-in console (overview, live, alerts, ...)
│   ├── components/
│   │   ├── console/              # console design system: header, panels, charts
│   │   └── ascii/                # WebGL ASCII backdrop + generated art
│   └── lib/                      # API client, auth, live-data hooks
├── meghdrishti-backend/          # FastAPI + Celery backend  → see its README
├── scripts/local.sh              # native start / stop / status
├── scripts/ascii-art/            # regenerates the ASCII art from live station data
├── docs/screenshots/             # images used in this README
└── queue/                        # items blocked on external processes
```

---

## Sign-in and roles

- The landing page at `/` is public. Everything in the console needs sign-in;
  signed-out visitors are sent back to `/`.
- **Google Sign-In** is the main path. It needs `GOOGLE_CLIENT_ID` (backend) and
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend). A first-time Google user gets a `VIEWER` account.
- **Email and password** works for the seeded demo admin.
- **Roles:** `VIEWER`, `OPERATOR`, `MAINTENANCE`, `SCIENTIST`, `ADMIN`.
  Settings data needs `SCIENTIST` or `ADMIN`; the Admin page and **Pull latest** need `ADMIN`.

---

## Status and honesty notes

- **Real data only.** Every number in the console comes from a live backend query.
  `src/lib/mock-data.ts` holds only types, colours and static reference text.
- **Tests.** The backend suite passes 120 tests. A synthetic-source integration test proves raw → anomaly
  → alert → station health → WebSocket event.
- **ML.** Isolation Forest models are trained as candidates and must be activated explicitly.
  Candidates trained on forecast data are diagnostic only and cannot be activated; that needs real
  sensor data with chronological holdout evaluation. ML accuracy is unknown until operator labels exist.
- **Decisions.** 240 controlled synthetic scenarios match their intended classifications
  ([decision evaluation](meghdrishti-backend/docs/decision-accuracy.md)). This is diagnostic, not field accuracy.
- **Audits.** [Provider and ML audit](meghdrishti-backend/docs/provider-ml-audit.md) ·
  [Stored alert audit](meghdrishti-backend/docs/alert-audit.md)

<details>
<summary><b>Security notes: feeds and browser origins</b></summary>

- `CORS_ORIGINS` accepts exact HTTP(S) origins only, with no paths or wildcards.
  Writes from an unapproved origin are rejected before reaching API handlers.
- There is no public observation-upload endpoint. Ingestion uses configured adapters only.
- Each normalized record must match its adapter's source and requested station, and fall inside the requested window.
- Rejected payloads stay in raw storage with a reason and never reach normalized observations.
- These checks cannot detect every plausible forged reading from a compromised provider,
  or protect against an attacker who already controls the database.

</details>

<details>
<summary><b>ASCII backdrop (landing page and console)</b></summary>

- Renderer: `src/components/ascii/AsciiBackdrop.tsx`, one WebGL2 full-screen pass with a bold monospace glyph atlas.
- Art in `src/components/ascii/art.ts` is generated, not drawn by hand: `scripts/ascii-art/make_sources.py` plots
  MeghDrishti data (station positions, a temperature field, a 48 h Delhi Safdarjung trace) and
  [ASCII-generator](https://github.com/vietnh1009/ASCII-generator) converts the images to text. The radar is illustrative.
- Each piece scrolls at its own depth for parallax and has a subtle effect: stations twinkle, isotherms drift,
  the trace draws itself, the radar sweeps.
- Device pixel ratio is capped at 2, rendering pauses when the tab is hidden, and reduced motion renders one still frame.
- The console uses the same backdrop, quieter, behind the side rail and pages.

</details>

---

<div align="center">

Built for **Smart India Hackathon 2026** · Original pitch deck: `SIH2026-IDEA-MeghDrishti-Winner-Style-v2_ Edit (1).pptx.pdf`

</div>
