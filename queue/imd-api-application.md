# IMD API access application — drafted answers

**Status:** draft, needs your review before submission — bracketed fields are
placeholders I can't fill in (team/institution identity, real dates, exact
IMD product name). Don't submit as-is.

---

## MD Questionnaire

**1. Briefly introduce your company or organization.**

`[Team/Organization name]` — a `[student team / startup / research group]`
participating in Smart India Hackathon 2026 under the problem statement for
AI/ML-based intelligent anomaly detection for Automatic Weather Stations.
MeghDrishti is a software-only quality-intelligence platform: it ingests
observations from Automatic Weather Stations and reference sources, and
distinguishes genuine extreme weather events from sensor malfunction, drift,
spikes, and telemetry faults, using rule-based checks, Isolation Forest, and
cross-validation against nearby stations, forecasts, and reanalysis data.

**2. Is your organization generating any revenue through the use of these
APIs? Please provide a declaration.**

No. MeghDrishti does not generate, and at this stage has no plans to
generate, any revenue through use of IMD APIs or the data obtained from
them. This is a non-commercial `[hackathon prototype / academic research
project]`. If this changes — e.g. pursuing deployment with a government
body or as a paid product — that must be re-declared to IMD before
monetizing.

**3. How will your organization acknowledge the India Meteorological
Department when sharing this data with your users?**

All IMD-sourced observations are attributed as "Source: India
Meteorological Department (IMD)" at the point of display — station
listings, the observation detail view, and any exported report will carry
that attribution wherever IMD is the origin source of a shown reading.
Internally, every observation is tagged with its originating source (IMD,
Open-Meteo, NOAA, etc.) at ingestion time and this tag is never stripped or
overwritten, so IMD data remains traceable end-to-end.

**4. How will you disseminate information obtained from these APIs to your
users?**

Data is not resold or redistributed as a raw feed. It is processed
internally (quality-checked, normalized, anomaly-scored) and disseminated
only through:
- A web dashboard for station operators/analysts, showing station status,
  live readings, and flagged anomalies with confidence and reason codes.
- Alerts to operators when a sensor fault or genuine extreme event is
  detected, for their own review and action.

No public API re-exposing raw IMD data is offered to third parties; access
is limited to authenticated users of the platform (`[name the intended user
group]`).

---

## Project Description

MeghDrishti is an AI/ML-based backend platform that improves the
reliability of Automatic Weather Station networks by distinguishing
genuine extreme weather from sensor and telemetry faults — a distinction
current AWS pipelines don't make automatically. Incoming readings pass
through physical-range and rate-of-change rule checks, an Isolation Forest
anomaly model trained on engineered features, and a context-validation
layer that cross-checks the reading against nearby stations, short-range
forecasts, and reanalysis data (ERA5/GPM). Evidence from all three is fused
into a fault score and confidence score with explainable reason codes, so
an unusual-but-real event (e.g. a genuine heatwave or cloudburst) is never
auto-flagged as a broken sensor, while stuck/drifting/spiking sensors are
caught and routed to operators for review. IMD data would be used as a
primary station-observation source alongside Open-Meteo, feeding this
pipeline; no raw data is resold — only processed anomaly/quality insight is
surfaced to authenticated platform users.

## Project Objective

Build an AI/ML-based quality-intelligence layer for Automatic Weather
Station networks that distinguishes genuine extreme weather events from
sensor malfunction, drift, spikes, and telemetry faults — so operators can
trust an anomaly flag instead of manually re-verifying every unusual
reading. The system combines rule-based physical checks, an Isolation
Forest anomaly model, and cross-validation against nearby stations,
forecasts, and reanalysis data to produce an explainable fault-vs-genuine-
extreme classification with a confidence score.

## IMD APIs Required

Automatic Weather Station (AWS) real-time/near-real-time observation data
API — station-level readings for temperature, humidity, pressure, rainfall,
wind speed and direction. `[Name the specific IMD API/product if their
portal lists one by name — I don't have IMD's exact product catalog.]`

## Inputs

- IMD AWS observation data (primary station source)
- Open-Meteo forecast API (short-range forecast context, no key required)
- NOAA ISD (secondary station cross-reference, where available)
- ERA5 reanalysis (Copernicus CDS) — historical/contextual atmospheric state
- NASA GPM (IMERG) — satellite rainfall estimate for rainfall-event validation
- Station metadata: location, elevation, sensor inventory (self-maintained)
- Operator feedback (confirm/dismiss labels) used for calibration, not raw ingestion

## Methodology

Each incoming observation is schema-validated, normalized into a canonical
format, and engineered into features (deltas, rolling statistics, rate of
change, historical baselines, neighbor-station deviation). Three
independent evidence sources are computed in parallel: (1) a rule engine
checking physical plausibility, spikes, persistence, stuck-sensor and
dropout patterns; (2) an Isolation Forest model trained on the engineered
features, scoring statistical abnormality; (3) a context validator
comparing the reading against nearby stations, forecast, ERA5, and GPM to
determine whether external evidence supports or contradicts the reading.
These three signals are fused into a fault score and a separately-computed
confidence score (based on evidence agreement and completeness, not just
score magnitude), yielding a final classification — e.g. Normal, Watch,
Suspicious, Probable Sensor Fault, or Likely Genuine Extreme — with
explainable machine-readable reason codes. Operator reviews feed a label
store used for periodic, human-supervised threshold recalibration; no
automatic retraining occurs.

## Expected Outputs

- A backend API + operator dashboard showing live station status, flagged
  anomalies, and alerts with severity, confidence, and reason codes
- Station health scoring (per-station reliability trend, not just
  per-reading flags)
- Real-time WebSocket alert stream for operators
- Model registry with versioned Isolation Forest candidates and evaluation
  metrics (for internal QA, not public-facing)
- Audit trail of every anomaly decision and operator review, for
  traceability

## Project Timeline

`[Confirm actual dates.]` Start: **2026-09-12** (repo work began) — End:
**`[insert target date, e.g. SIH2026 final submission/demo date]`**
