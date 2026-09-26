# Queued: IMD live data integration

**Status:** blocked — pending IMD API access approval (legal/institutional process)
**Blocked since:** 2026-09-25

## What this is

Real IMD (India Meteorological Department) Automatic Weather Station data as a
live ingestion source, replacing/supplementing the current Open-Meteo source.

## Why it's queued, not built

IMD API access requires submitting their questionnaire (org declaration,
revenue declaration, data-attribution commitment, dissemination plan) and
getting institutional approval + credentials issued. That's an external legal
process with a timeline outside this codebase's control. See
`queue/imd-api-application.md` for the drafted answers.

## What's already done, ready to activate the moment credentials exist

- `meghdrishti-backend/app/ingestion/imd.py` — real `IMDAdapter` class,
  full `WeatherSourceAdapter` interface (`fetch`, `normalize`, `health_check`).
  Currently inert: `fetch()` returns `[]` and `health_check()` returns `False`
  when `IMD_API_BASE_URL` / `IMD_API_KEY` aren't set — this is intentional
  graceful degradation, not a stub that needs rewriting.
- `IMDDemoAdapter` in the same file is the fallback used today (tagged
  `IMD_DEMO` in the DB, never presented as real data) so the rest of the
  pipeline (schema validation, dedup, QC, ML, context, alerts) can be
  exercised end-to-end without credentials.
- `get_imd_adapter()` already picks `IMDAdapter` vs `IMDDemoAdapter`
  automatically based on config — no code change needed to switch over.

## What unblocks it

1. IMD approves the API access application and issues credentials.
2. Get the actual base URL + endpoint shape for their AWS observation API
   (the current `IMDAdapter.fetch()` assumes a generic
   `GET {base_url}/observations?station_id=&start=&end=` REST shape — this
   was written without IMD's real API spec in hand, since it isn't public.
   **Re-check this against IMD's actual docs once received** — the URL
   pattern, param names, and response envelope may need adjusting to match
   what they actually return.)
3. Set in `.env` (see `meghdrishti-backend/.env.example`):
   ```
   IMD_ENABLED=true
   IMD_API_BASE_URL=<issued base URL>
   IMD_API_KEY=<issued key>
   ```
4. Confirm the IMD attribution line is live wherever IMD-sourced data is
   shown (per the dissemination declaration made in the application) before
   flipping `IMD_ENABLED=true` in any deployment IMD would see.
5. Smoke-test: `IMDAdapter.health_check()` should return `True`, then run
   one station through `IngestionService.run_for_station(station, "IMD", ...)`
   and confirm normalized rows land in `weather_observations` with
   `source="IMD"`.

## Not queued — already works today without IMD

Open-Meteo (no key required) is the live source right now. GHCN/ERA5/GPM
adapters are also built with the same "real interface, inert until
credentials" pattern — same story if/when those are pursued.
