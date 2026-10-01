# Fused decision improvement — 2026-10-01

## Objective

Distinguish sensor/data faults from genuine extreme weather using QC, ML and
independent context. A statistical anomaly alone does not establish a fault.

## Changes

- Available rule signals can trigger investigation even when their weighted
  contribution is below WATCH. Missing ML/context must not turn a strong rule
  into NORMAL. An anomalous ML flag can likewise trigger investigation.
- Unit/domain invariants (humidity outside 0–100%, negative rain/wind, invalid
  bearings, non-positive pressure and temperatures below absolute zero) bypass
  weather confirmation. Configurable regional bounds are not treated as
  universal physical impossibilities.
- Dropouts produce WATCH; strong telemetry/timestamp faults cannot be
  classified as genuine weather because other measurements agree with context.
- Conflicting context sources produce WATCH/SUSPICIOUS rather than letting
  their average conceal disagreement. Evidence records CONTEXT_CONFLICT.
- Zero rainfall and zero wind do not trigger persistence/stuck rules merely
  because dry/calm conditions last. Linear spike detection is disabled for wind
  bearings; context and neighbor features use circular bearing differences.
- Confidence agreement uses available evidence only. Unavailable ML earns no
  model-reliability contribution. Confidence remains a heuristic, not a
  calibrated probability; decision evidence explicitly records this limitation.
- Neighbor features exclude stale observations (30 minutes for other sources,
  120 minutes for hourly Open-Meteo). Open-Meteo telemetry cadence is hourly.
- Rain accumulation evidence applies to rainfall; rain/humidity consistency
  applies only to those measurements. A probable fault takes priority when
  selecting the observation's main decision. All measurement classifications
  and reason codes are retained in DECISION evidence with policy version 2.

## Controlled evaluation

Read-only command, from the backend directory:

```bash
.venv/bin/python scripts/evaluate_decisions.py
```

The script compares the changed QC/context/decision path to committed baseline
`9d79b2aac1ef94ab552607d5c3c2138b3953561a`. It evaluates 240 authored synthetic
scenarios with deterministic variations, using no ML layer. The currently
available registry has no active model, so this covers the live decision mode.
The comparison does not evaluate the entire Celery/alerting pipeline or provider
fetches. The baseline is fixed and may be changed using `--baseline <commit>`.

| Scenario | Samples | Baseline matches | Current matches |
|---|---:|---:|---:|
| Normal temperature | 20 | 20 | 20 |
| Dry weather | 20 | 0 | 20 |
| Calm wind | 20 | 0 | 20 |
| Bearing crosses north | 20 | 0 | 20 |
| Temperature spike fault | 20 | 20 | 20 |
| Impossible humidity despite context agreement | 20 | 0 | 20 |
| Genuine extreme rainfall | 20 | 20 | 20 |
| Genuine heat extreme | 20 | 20 | 20 |
| Missing temperature | 20 | 0 | 20 |
| Moderate spike without context | 20 | 0 | 20 |
| Conflicting weather context | 20 | 0 | 20 |
| Future timestamp | 20 | 0 | 20 |
| **Total expected classification matches** | **240** | **80** | **240** |

**240/240 is synthetic scenario agreement, not measured field accuracy.** These
cases were authored to expose specific logic errors and are not an independent
sensor-fault dataset. They do not establish geographic/seasonal generalization,
long-term drift detection, ML performance or confidence calibration.

The script also evaluates the latest resolved operator review per historical
anomaly, reporting precision/recall for PROBABLE_SENSOR_FAULT. There are currently
zero resolved reviews, so both metrics are null. Reviewed alerts alone also have
selection bias: representative reviewed normal readings are needed to measure
missed faults and population false-positive rates. Historical decisions are
not replayed or overwritten by this script.

Raw output: ignored repository-root `.local/decision-evaluation.json`.
Static Ruff checks, Python compilation and diff whitespace checks passed.
No test suite was added or run for this follow-up.

## Deployment and limits

The native API and worker were restarted to load this policy. Existing historical
anomalies, alerts and reviews remain unchanged. The prior three forecast-based
ML candidates remain inactive; wind history still needs unit repair. New policy
outcomes can be compared with actual operator reviews once sensor data arrives.
See [the provider/ML audit](provider-ml-audit.md) for training evidence.
