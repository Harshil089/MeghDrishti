# Live provider and ML audit

Date: 2026-10-01. Database inspection and model probes were read-only.
The live probe called the adapter directly without inserting observations.

## Provider results

Open-Meteo returned HTTP 200 for **15/15 samples**: three rounds at the
Pune, Mumbai, Nagpur, Delhi, and Bengaluru station coordinates. Each returned
six hourly records, with all six requested measurement fields present.
Median request latency was 0.636 seconds; maximum was 5.923 seconds. The
newest returned hour was 10:00 UTC; evidence was saved at 10:49 UTC.
These repeated requests cover one short window and do not establish an
uptime SLA, resilience during outages, or long-term freshness.

| Provider | Evidence / limitation |
| --- | --- |
| Open-Meteo | Live requests succeeded; response wind units explicitly verified as m/s. |
| IMD | Real access disabled; credentials absent. IMD_DEMO is synthetic. |
| GHCN | Adapter token absent; live ingestion unverified. |
| ERA5 | Credential configured; queued CDS retrieval not exercised. Availability unverified. |
| NASA GPM | Token absent; live retrieval unverified. |

Open-Meteo's forecast endpoint provides weather model output, rather than
independent station sensor measurements. Ingestion and forecast context
also use the same provider, so agreement is not independent corroboration.
See [Open-Meteo documentation](https://open-meteo.com/en/docs).

### Fixed wind units and UTC handling

The adapter previously omitted `wind_speed_unit`, whose default is km/h,
and stored the resulting number in `wind_speed_ms` unchanged. Values were
therefore 3.6 times the intended m/s values. It now requests `ms` explicitly.
Requested windows are converted to UTC before date selection/filtering;
normalized observations carry UTC-aware timestamps.

Historical observations, derived features, and the wind candidate still
contain this unit defect. They were not rewritten during this audit.
Correct or re-ingest affected Open-Meteo wind observations, recompute their
features, and retrain the candidate before evaluating or activating it.
Preserve a backup and reconcile duplicates when repairing historical data.

## Available ML evidence

- Database: 730 observations (560 IMD_DEMO, 170 OPEN_METEO), 541 feature rows.
- Independent operator labels: **0**; operator reviews: **0**.
- Model registry: **4 candidates, 0 active models**. ML currently makes no
  contribution through active-model inference.
- Each candidate records 279 training samples. Reconstructing complete
  feature rows available by model creation gives 260 IMD_DEMO and 19
  OPEN_METEO rows per model: **93.2% synthetic**. This matches sample counts,
  but is inferred provenance; no immutable training membership manifest exists.
- Stored candidate evaluation scores the training data itself. Its ~5%
  anomaly rate reflects the configured contamination/quantile threshold,
  rather than labelled accuracy or evidence of generalization.

All four artifacts loaded and scored successfully. The probe selected
OPEN_METEO observations after each training end, with features created
after model creation. Each measurement had 28 eligible rows; only 18 had
all required features. The remaining 10 were excluded rather than imputed.

| Candidate | Flagged / scoreable rows | Unlabelled flag rate |
| --- | ---: | ---: |
| Temperature | 4 / 18 | 22.2% |
| Humidity | 0 / 18 | 0.0% |
| Pressure | 7 / 18 | 38.9% |
| Wind | 13 / 18 | 72.2% — affected by incorrect historical units |

These are descriptive flag rates, **not precision, recall, false-positive
rates, or accuracy**. A high flag rate can reflect real unusual weather,
training distribution mismatch, a feature defect, or an unsuitable threshold.
There are too few unlabelled rows to distinguish those explanations.

An extreme feature-space perturbation sanity check flagged 18/18 rows for
temperature/humidity/wind and 14/18 for pressure. Each feature was changed
to `(abs(value) + 1) * 10`; these are artificial feature vectors, not realistic
sensor fault incidents. This checks model response only and supplies no
accuracy estimate. Wind results retain the unit caveat.

## Verification and next requirement

The isolated Postgres/Redis backend suite passed **104 tests**, with three
existing dependency deprecation warnings, in 21.33 seconds. The added
Open-Meteo regression checks m/s requests and an IST window crossing the
UTC date boundary, including UTC-aware normalization.

To measure precision/recall, collect independently reviewed normal readings,
confirmed faults, and valid weather extremes; evaluate on time/station
holdouts after repairing wind units. Keep these candidates inactive until
that evidence supports activation. This audit did not retrain or activate models.

Native app services were restored to the stopped state after inspection.
Raw evidence is local and ignored by Git:

- `.local/live-provider-samples.json`
- `.local/provider-ml-data-audit.json`
- `.local/ml-training-lineage.json`
- `.local/ml-candidate-probe.json`

Paths are relative to the repository root. The Graphify map guided source
inspection; runtime evidence above comes from provider calls and database
queries. The existing graph has not been rebuilt for these edits.

## ML improvement follow-up — 2026-10-01

The API, CLI and weekly scheduler now share `app/ml/workflow.py`:

- Use observation timestamps within the past 90 days, excluding future readings
  and synthetic demo sources. Rebuild features with strictly earlier history
  from the same station and source; duplicate event times use the newest reading.
- Train on the earlier 80% of distinct timestamps and evaluate on the later 20%.
  Require at least 20 usable training rows and 10 holdout rows. All stations at
  one timestamp stay in the same partition.
- Exclude operator-confirmed faults from fitting. Score reviewed holdout rows
  against their latest operator classification; missing labels stay unknown.
  These metrics describe the anomaly flag, not the complete fused decision.
- Store exact feature inputs, observation IDs, source counts and a dataset hash
  with each candidate. Missing/non-finite features are rejected in training and
  inference.
- Record Open-Meteo wind units in new raw payloads. Old wind rows without an
  explicit `m/s` unit are excluded from training and its historical features;
  historical observations are not rewritten by this change.
- Refuse activation of legacy or forecast-based candidates. Sensor candidates
  still require explicit operator activation; passing the data gate does not
  prove accuracy. No models were activated.
- Keep QC and feature histories source-specific. Open-Meteo observations no
  longer use Open-Meteo forecasts or same-provider neighbor output to validate
  themselves as independent weather evidence. ERA5/GPM self-comparisons are
  likewise excluded.

Three diagnostic candidates were trained from the available Open-Meteo data:
120 training rows and 30 holdout rows per measurement, covering five stations.
The holdout covers only six timestamps, September 27 06:00–11:00 UTC.
Temperature flagged 2/30, humidity 6/30 and pressure 7/30 holdout readings.
**These are flag rates, not false-positive rates or accuracy.** Wind was skipped
because no usable wind history had trustworthy unit provenance.

At training time there were zero operator labels and no IMD/GHCN sensor rows.
Accuracy, precision and recall therefore remain unknown. Forecast candidates
cannot establish fault detection performance, and this small holdout cannot
establish seasonal or geographic generalization. Genuine accuracy measurement
requires reviewed sensor readings including normal weather, valid extremes and
confirmed faults, followed by a separate evaluation of the fused decisions.

Static Ruff and Python compilation checks passed. No test suite was run for
this follow-up. Earlier audit counts and service-state notes above are snapshots;
the native stack is now running.
