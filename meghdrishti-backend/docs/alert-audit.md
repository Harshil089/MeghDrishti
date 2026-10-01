# Stored alert audit — 2026-10-01

Read-only snapshot: 314 open alerts, comprising 276 synthetic `IMD_DEMO`
alerts and 38 `OPEN_METEO` forecast alerts. No operator fault labels were
available. Historical alerts and their classifications were preserved.

## Findings

- Demo polling restarted the same random sequence at arbitrary window starts.
  Overlapping windows could produce artificial persistence and short-interval
  jumps. These alerts do not establish real station faults.
- All 38 forecast alerts predate the current decision evidence policy. Their
  histories could mix demo and forecast readings, and the same forecast provider
  could be used to confirm its own extreme-weather classification. One pressure
  alert recorded a 94.6 hPa change over 7.9 minutes across incompatible histories.
- Replaying the originally selected measurement with strictly earlier,
  same-source history produced the following results:

| Historical classification | Current replay | Count |
| --- | --- | ---: |
| Likely genuine extreme | Normal | 25 |
| Likely genuine extreme | Insufficient context: collection gap | 8 |
| Probable sensor fault | Insufficient context: collection gap | 5 |

- No alerts were created before their observation, and no observations were in
  the future beyond the five-minute audit tolerance. Eighteen alerts were
  processed more than an hour after observation; the largest delay was about
  6 hours 58 minutes. Processing time must not be mistaken for event time.
- A collection gap during backend downtime does not establish a hardware fault.
  Forecast, reanalysis and satellite records also cannot establish an AWS sensor
  fault by themselves.

## Changes applied

- Scheduled ingestion uses Open-Meteo by default and adds IMD only when enabled
  with a configured URL and key. This was superseded by the removal below.
- Demo events use deterministic quarter-hour timestamps and per-event seeds,
  so overlapping windows describe the same synthetic events.
- The alerts API and page exclude demo alerts by default. The initial checkbox and filtering were superseded by the removal below.
- Alert explanations identify synthetic data and unrevalidated legacy decisions.
- Gap-only decisions require more context. Provider-derived records cannot be
  classified as confirmed probable AWS sensor faults by this decision layer.
- Dashboard 24-hour anomaly counts use observation time rather than processing
  time, excluding demo data and future observations.

## Limits

This is a causal replay of each alert's originally selected measurement, not
an independent truth assessment or a full rerun of measurement selection.
It uses available recorded independent context, no refreshed provider calls and
no active ML model. Historical wind units were not corrected by this replay.
The 25 normal results show unsupported historical classifications under current
rules; they are not 25 independently confirmed false positives. Field precision,
recall and false-positive rate remain unknown without confirmed incidents.

Stored station-health history may still reflect earlier demo processing. This
audit did not rewrite health history, reviews or alert records. Raw replay
details are stored locally in `.local/alert-audit.json` (ignored by Git).

## Synthetic data removal — follow-up

At the user's request, the subsequent cleanup deleted 840 synthetic normalized
readings, 840 raw payloads, 278 associated alerts and 420 exclusively synthetic
IMD ingestion jobs. Foreign-key cascades removed their features, QC results,
context, anomalies, evidence and any linked review records. Four old model
candidates trained with demo data and their disk artifacts were removed. Five
station health scores were recomputed from the remaining records.

All 205 provider observations and 38 provider alerts were retained. The runtime
synthetic generator, fallback and UI inclusion control were removed. IMD now
requires enabled access and credentials; missing access produces no fake data.
The earlier sections describe the pre-cleanup audit snapshot, not current counts.
