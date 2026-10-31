"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag, X, Filter } from "lucide-react";
import { StationPicker } from "@/components/console/StationPicker";
import {
  Badge,
  Empty,
  Eyebrow,
  PageHeader,
  Section,
  button,
  card,
  chip,
  field,
  severityTone,
  table,
  type Tone,
} from "@/components/console/ui";
import { fetchHistory, fetchReviews, fetchStationOptions, type HistoryReading, type OperatorReviewRow } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const PAGE = 25;
const MEASURES = ["temperature_c", "humidity_pct", "pressure_hpa", "rainfall_mm", "wind_speed_ms"] as const;
const HEAD = ["Temp (°C)", "RH (%)", "Pressure (hPa)", "Rain (mm)", "Wind (m/s)"];

const verdictTone: Record<string, Tone> = {
  CONFIRMED_SENSOR_FAULT: "crit",
  VALID_EXTREME_WEATHER: "info",
  FALSE_POSITIVE: "ok",
  UNKNOWN: "neutral",
  REVIEW_LATER: "warn",
};
const pretty = (k: string) => k.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const dayStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const dayEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined);

function Pager({ page, setPage, total }: { page: number; setPage: (n: number) => void; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const first = total === 0 ? 0 : page * PAGE + 1;
  const last = Math.min(total, (page + 1) * PAGE);
  const arrow =
    "grid h-7 w-7 place-items-center rounded border border-line bg-surface text-sub transition-colors hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="flex items-center justify-between border-t border-line bg-raised/40 px-4 py-2.5 font-mono text-xs text-sub">
      <span>
        RECORDS{" "}
        <span className="font-semibold tabular-nums text-ink">
          {first}–{last}
        </span>{" "}
        OF <span className="font-semibold tabular-nums text-ink">{total.toLocaleString()}</span>
      </span>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          PAGE {page + 1} / {pages}
        </span>
        <button className={arrow} aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button className={arrow} aria-label="Next page" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const LABELS: Record<string, string> = {
  temperature_c: "Temperature (°C)",
  humidity_pct: "Relative Humidity (%)",
  pressure_hpa: "Barometric Pressure (hPa)",
  rainfall_mm: "Precipitation (mm)",
  wind_speed_ms: "Wind Speed (m/s)",
  wind_direction_deg: "Wind Direction (°)",
};

function ReadingDrawer({
  reading,
  station,
  onClose,
}: {
  reading: HistoryReading;
  station: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-title"
        className="page-fade relative flex h-full w-full max-w-md flex-col border-l border-line bg-surface text-ink shadow-2xl shadow-ink/25"
      >
        <div className="flex items-start gap-3 border-b border-line bg-raised/60 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
              ARCHIVED TELEMETRY PACKET
            </p>
            <h2 id="reading-title" className="mt-1 text-base font-bold text-ink">
              {station}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-sub">
              {new Date(reading.timestamp).toLocaleString()} · SOURCE: {reading.source}
            </p>
          </div>
          <button
            onClick={onClose}
            autoFocus
            aria-label="Close"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line bg-surface text-sub hover:bg-raised hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 text-[13px]">
          <section>
            <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
              Raw Stored Observations (Unmodified)
            </h3>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line">
              {Object.entries(LABELS).map(([k, label]) => (
                <div key={k} className="bg-surface px-3 py-2.5">
                  <dt className="truncate font-mono text-[10px] uppercase tracking-wider text-sub">{label}</dt>
                  <dd className="mt-0.5 font-mono text-base font-bold tabular-nums text-ink">
                    {reading.measurements[k] ?? "-"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
              Attached Quality Control Flags
            </h3>
            {reading.flags.length === 0 ? (
              <p className="rounded border border-ok/30 bg-ok/5 px-3 py-2.5 font-mono text-xs text-ok">
                NOMINAL · No quality flags raised against this packet.
              </p>
            ) : (
              <ul className="space-y-2">
                {reading.flags.map((f) => (
                  <li key={f.anomaly_id} className="rounded border border-line bg-raised/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{pretty(f.classification)}</span>
                      <Badge tone={severityTone[f.severity] ?? "info"}>{f.severity.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-sub">
                      {f.measurement ? `${LABELS[f.measurement] ?? f.measurement} · ` : ""}FAULT SCORE{" "}
                      {f.fault_score.toFixed(2)} · CONF {f.confidence.toFixed(2)}
                    </p>
                    {f.reason_codes.length > 0 && (
                      <p className="mt-1 font-mono text-xs text-ink">
                        CODES: {f.reason_codes.filter((c) => c !== "INSUFFICIENT_CONTEXT").join(", ") || "-"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {reading.flags.length > 0 && (
          <div className="border-t border-line bg-raised/70 px-5 py-3.5">
            <Link href="/alerts" className={`${button} w-full justify-center`}>
              Inspect in Alert Triage Workbench
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function Readings() {
  const stations = useLiveData(fetchStationOptions, []);
  const [stationId, setStationId] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<HistoryReading | null>(null);
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };
  const { rows, total } = useLiveData(
    () => fetchHistory({ stationId, source, start: dayStart(from), end: dayEnd(to), limit: PAGE, offset: page * PAGE }),
    { rows: [] as HistoryReading[], total: 0 },
    60000,
    [stationId, source, from, to, page]
  );
  const station = (id: string) => stations.find((s) => s.dbId === id)?.name ?? id.slice(0, 8);

  const flagged = rows.filter((r) => r.flags.length > 0).length;
  const latest = rows[0]
    ? new Date(rows[0].timestamp).toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "-";
  const active = [stationId, source, from, to].filter(Boolean).length;
  const sources = [
    ["", "All Feeds"],
    ["OPEN_METEO", "Open-Meteo"],
    ["IMD", "IMD AWS"],
  ] as const;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
      <aside className={`${card} overflow-hidden`}>
        <div className="flex h-10 items-center gap-2 border-b border-line bg-raised/60 px-4">
          <Filter className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink">
            Ledger Filter Parameters
          </span>
        </div>

        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Eyebrow>AWS Station Scope</Eyebrow>
            <StationPicker
              stations={stations}
              value={stationId}
              onChange={reset(setStationId)}
              allowAll
              className="flex-col items-stretch [&>*]:w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Eyebrow>Telemetry Source</Eyebrow>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Source">
              {sources.map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={source === v}
                  onClick={() => reset(setSource)(v)}
                  className={chip(source === v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Eyebrow>Observation Date Window</Eyebrow>
            <input
              type="date"
              aria-label="From date"
              value={from}
              onChange={(e) => reset(setFrom)(e.target.value)}
              className={`${field} font-mono text-xs`}
            />
            <input
              type="date"
              aria-label="To date"
              value={to}
              onChange={(e) => reset(setTo)(e.target.value)}
              className={`${field} font-mono text-xs`}
            />
          </div>

          <dl className="space-y-1.5 border-t border-line pt-3.5 font-mono text-xs">
            <div className="flex justify-between">
              <dt className="text-sub">MATCHED RECORDS</dt>
              <dd className="font-semibold text-ink">{total.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sub">FLAGGED ON PAGE</dt>
              <dd className="font-semibold text-ink">
                {flagged} / {rows.length}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sub">NEWEST PACKET</dt>
              <dd className="font-semibold text-ink">{latest}</dd>
            </div>
          </dl>

          {active > 0 && (
            <button
              className={`${button} w-full justify-center`}
              onClick={() => {
                setStationId("");
                setSource("");
                setFrom("");
                setTo("");
                setPage(0);
              }}
            >
              Reset Filter Scope
            </button>
          )}
        </div>
      </aside>

      <Section
        title="Immutable Raw Observation Archive"
        meta="STORED EXACTLY AS RECEIVED · CLICK ANY ROW FOR PACKET DOSSIER"
        flush
      >
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.head}>
              <tr>
                <th className={table.th}>Timestamp</th>
                <th className={table.th}>AWS Station</th>
                <th className={table.th}>Source</th>
                {HEAD.map((h) => (
                  <th key={h} className={table.thNum}>
                    {h}
                  </th>
                ))}
                <th className={table.th}>QC Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <Empty>No archived observations match the selected filter parameters.</Empty>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  tabIndex={0}
                  onClick={() => setOpen(r)}
                  onKeyDown={(e) => e.key === "Enter" && setOpen(r)}
                  className={`${table.row} cursor-pointer focus-visible:outline-2 focus-visible:outline-accent`}
                >
                  <td className={`${table.td} relative whitespace-nowrap font-mono text-xs text-ink`}>
                    {r.flags.length > 0 && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-warn" />}
                    {new Date(r.timestamp).toLocaleString([], {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </td>
                  <td className={`${table.td} whitespace-nowrap font-medium text-ink`}>{station(r.station_id)}</td>
                  <td className={table.td}>
                    <span className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-sub">
                      {r.source}
                    </span>
                  </td>
                  {MEASURES.map((m) => (
                    <td key={m} className={table.num}>
                      {r.measurements[m] ?? "-"}
                    </td>
                  ))}
                  <td className={table.td}>
                    {r.flags.length === 0 ? (
                      <span className="font-mono text-[10px] uppercase text-ok">NOMINAL</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.flags.map((f, i) => (
                          <Badge key={i} tone={severityTone[f.severity] ?? "info"}>
                            {pretty(f.classification)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} setPage={setPage} total={total} />
        {open && <ReadingDrawer reading={open} station={station(open.station_id)} onClose={() => setOpen(null)} />}
      </Section>
    </div>
  );
}

function Reviews() {
  const [page, setPage] = useState(0);
  const { rows, total } = useLiveData(
    () => fetchReviews(PAGE, page * PAGE),
    { rows: [] as OperatorReviewRow[], total: 0 },
    60000,
    [page]
  );
  const days = new Map<string, OperatorReviewRow[]>();
  for (const r of rows) {
    const d = new Date(r.created_at).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    days.set(d, [...(days.get(d) ?? []), r]);
  }
  return (
    <Section
      title="Operator Classification & Override Ledger"
      meta={`${total.toLocaleString()} LOGGED DECISIONS · IMMUTABLE AUDIT TRAIL`}
      flush
    >
      {rows.length === 0 ? (
        <Empty>
          No operator classifications recorded yet. Dispositions logged in the Triage Workbench appear here permanently.
        </Empty>
      ) : (
        <div className="px-5 pb-4">
          {[...days].map(([day, list]) => (
            <div key={day} className="pt-4">
              <Eyebrow>{day}</Eyebrow>
              <ol className="mt-3">
                {list.map((r, i) => (
                  <li key={r.id} className="grid grid-cols-[54px_28px_1fr] gap-3">
                    <span className="pt-1 font-mono text-xs text-sub">
                      {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                    <span className="flex flex-col items-center">
                      <span className="grid h-7 w-7 place-items-center rounded border border-line bg-raised text-accent">
                        <Flag className="h-3.5 w-3.5" />
                      </span>
                      {i < list.length - 1 && <span className="w-px flex-1 bg-line" />}
                    </span>
                    <div className="min-w-0 pb-5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-ink">{r.station}</span>
                        {r.measurement && (
                          <span className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-sub">
                            {r.measurement}
                          </span>
                        )}
                        <span className="font-mono text-[11px] text-sub">OPERATOR: {r.reviewer ?? "SYSTEM"}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-sub">
                        <span className="font-mono text-[11px]">ENSEMBLE: {pretty(r.previous_classification)}</span>
                        <ChevronRight className="h-3 w-3" aria-hidden />
                        <Badge tone={verdictTone[r.operator_classification] ?? "neutral"}>
                          {pretty(r.operator_classification)}
                        </Badge>
                      </div>
                      {r.comment && <p className="mt-1.5 text-xs text-sub">&ldquo;{r.comment}&rdquo;</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      <Pager page={page} setPage={setPage} total={total} />
    </Section>
  );
}

export default function HistoryPage() {
  const [tab, setTab] = useState<"readings" | "reviews">("readings");
  return (
    <>
      <PageHeader
        code="SYS-AUD-08 // IMMUTABLE TELEMETRY & OPERATOR DECISION LEDGER"
        title="Telemetry & Operator Audit Ledger"
        description="Non-destructive archival ledger of raw ingested AWS observations (stored without interpolation) and cryptographically logged operator classifications."
        actions={
          <div role="tablist" className="inline-flex rounded border border-line bg-surface p-0.5 text-xs">
            {(
              [
                ["readings", "Raw Telemetry Archive"],
                ["reviews", "Operator Decision Ledger"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-xs px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  tab === t ? "bg-accent text-on-accent" : "text-sub hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      {tab === "readings" ? <Readings /> : <Reviews />}
    </>
  );
}
