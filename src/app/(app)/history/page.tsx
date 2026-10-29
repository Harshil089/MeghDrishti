"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag, X } from "lucide-react";
import { StationPicker } from "@/components/console/StationPicker";
import { Badge, Empty, Metric, MetricStrip, PageHeader, Section, button, field, severityTone, table, type Tone } from "@/components/console/ui";
import { fetchHistory, fetchReviews, fetchStationOptions, type HistoryReading, type OperatorReviewRow } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const PAGE = 25;
const MEASURES = ["temperature_c", "humidity_pct", "pressure_hpa", "rainfall_mm", "wind_speed_ms"] as const;
const HEAD = ["Temp °C", "Humidity %", "Pressure hPa", "Rain mm", "Wind m/s"];

const verdictTone: Record<string, Tone> = {
  CONFIRMED_SENSOR_FAULT: "crit",
  VALID_EXTREME_WEATHER: "info",
  FALSE_POSITIVE: "ok",
  UNKNOWN: "neutral",
  REVIEW_LATER: "warn",
};
const pretty = (k: string) => k.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
// date input gives local YYYY-MM-DD; send the whole local day as an instant range
const dayStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const dayEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined);

function Pager({ page, setPage, total }: { page: number; setPage: (n: number) => void; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const first = total === 0 ? 0 : page * PAGE + 1;
  const last = Math.min(total, (page + 1) * PAGE);
  const arrow = "grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-sub transition-colors hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs text-sub">
      <span>
        <span className="font-mono tabular-nums text-ink">
          {first}-{last}
        </span>{" "}
        of <span className="font-mono tabular-nums">{total.toLocaleString()}</span>
      </span>
      <div className="flex items-center gap-2">
        <span className="font-mono tabular-nums">
          {page + 1}/{pages}
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
  humidity_pct: "Humidity (%)",
  pressure_hpa: "Pressure (hPa)",
  rainfall_mm: "Rainfall (mm)",
  wind_speed_ms: "Wind speed (m/s)",
  wind_direction_deg: "Wind direction (°)",
};

function ReadingDrawer({ reading, station, onClose }: { reading: HistoryReading; station: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-title"
        className="page-fade relative flex h-full w-full max-w-md flex-col border-l border-line bg-surface text-ink shadow-2xl shadow-black/30"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="reading-title" className="text-base font-semibold">
              {station}
            </h2>
            <p className="mt-1 font-mono text-xs text-sub">
              {new Date(reading.timestamp).toLocaleString()} · {reading.source}
            </p>
          </div>
          <button
            onClick={onClose}
            autoFocus
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sub hover:bg-raised hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-4 text-[13px]">
          <section>
            <h3 className="mb-1.5 text-xs font-medium text-sub">Stored values</h3>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {Object.entries(LABELS).map(([k, label]) => (
                <div key={k} className="bg-surface px-3 py-2.5">
                  <dt className="truncate text-[11px] text-sub">{label}</dt>
                  <dd className="mt-0.5 font-mono text-base tabular-nums">{reading.measurements[k] ?? "-"}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="mb-1.5 text-xs font-medium text-sub">Quality flags</h3>
            {reading.flags.length === 0 ? (
              <p className="text-sub">Nothing was raised against this reading.</p>
            ) : (
              <ul className="space-y-2">
                {reading.flags.map((f) => (
                  <li key={f.anomaly_id} className="rounded-lg border border-line bg-raised p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{pretty(f.classification)}</span>
                      <Badge tone={severityTone[f.severity] ?? "info"}>{f.severity.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-sub">
                      {f.measurement ? `${LABELS[f.measurement] ?? f.measurement} · ` : ""}fault score {f.fault_score.toFixed(2)} · confidence{" "}
                      {f.confidence.toFixed(2)}
                    </p>
                    {f.reason_codes.length > 0 && (
                      <p className="mt-1 font-mono text-xs text-sub">
                        {f.reason_codes.filter((c) => c !== "INSUFFICIENT_CONTEXT").join(", ") || "-"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {reading.flags.length > 0 && (
          <div className="border-t border-line bg-raised px-5 py-4">
            <Link href="/alerts" className={`${button} w-full justify-center`}>
              Review in Alerts
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
  const latest = rows[0] ? new Date(rows[0].timestamp).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
  const active = [stationId, source, from, to].filter(Boolean).length;
  const sources = [
    ["", "All"],
    ["OPEN_METEO", "Open-Meteo"],
    ["IMD", "IMD"],
  ] as const;

  return (
    <div className="space-y-4">
    <MetricStrip>
      <Metric label="Records" value={total.toLocaleString()} foot={active ? `${active} filter${active > 1 ? "s" : ""} on` : "All stored readings"} />
      <Metric label="Flagged on this page" value={flagged} tone={flagged ? "warn" : "ok"} foot={`of ${rows.length} shown`} />
      <Metric label="Latest on page" value={latest} foot={stationId ? station(stationId) : "All stations"} />
      <Metric label="Source" value={source ? sources.find(([v]) => v === source)![1] : "All"} foot="Stored as received" />
    </MetricStrip>
    <Section title="Readings" meta="Select a row for details" flush>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <StationPicker stations={stations} value={stationId} onChange={reset(setStationId)} allowAll />
        <div className="flex gap-1.5" role="group" aria-label="Source">
          {sources.map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={source === v}
              onClick={() => reset(setSource)(v)}
              className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                source === v ? "border-accent bg-accent/15 text-ink" : "border-line text-sub hover:bg-raised hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input type="date" aria-label="From date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className={`${field} w-auto`} />
        <span className="text-xs text-sub">to</span>
        <input type="date" aria-label="To date" value={to} onChange={(e) => reset(setTo)(e.target.value)} className={`${field} w-auto`} />
        {active > 0 && (
          <button
            className={`${button} ml-auto`}
            onClick={() => {
              setStationId("");
              setSource("");
              setFrom("");
              setTo("");
              setPage(0);
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div className={table.wrap}>
        <table className={table.table}>
          <thead className={table.head}>
            <tr>
              <th className={table.th}>Time</th>
              <th className={table.th}>Station</th>
              <th className={table.th}>Source</th>
              {HEAD.map((h) => (
                <th key={h} className={table.thNum}>
                  {h}
                </th>
              ))}
              <th className={table.th}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <Empty>No readings match these filters.</Empty>
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
                  {r.flags.length > 0 && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
                  {new Date(r.timestamp).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className={`${table.td} whitespace-nowrap text-ink`}>{station(r.station_id)}</td>
                <td className={`${table.td} text-sub`}>{r.source}</td>
                {MEASURES.map((m) => (
                  <td key={m} className={table.num}>
                    {r.measurements[m] ?? "-"}
                  </td>
                ))}
                <td className={table.td}>
                  {r.flags.length === 0 ? (
                    <span className="text-sub">-</span>
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
  const { rows, total } = useLiveData(() => fetchReviews(PAGE, page * PAGE), { rows: [] as OperatorReviewRow[], total: 0 }, 60000, [page]);
  return (
    <Section title="Operator reviews" meta={`${total.toLocaleString()} recorded`} flush>
      {rows.length === 0 ? (
        <Empty>No operator reviews yet. They appear when an alert is marked as a fault, real weather or a false positive.</Empty>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 border-b border-line px-4 py-3.5 transition-colors last:border-0 hover:bg-raised">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-raised text-sub">
                <Flag className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                  <span className="font-medium text-ink">{r.station}</span>
                  {r.measurement && <span className="font-mono text-xs text-sub">{r.measurement}</span>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-sub">
                  <span>{pretty(r.previous_classification)}</span>
                  <ChevronRight className="h-3 w-3" aria-hidden />
                  <Badge tone={verdictTone[r.operator_classification] ?? "neutral"}>{pretty(r.operator_classification)}</Badge>
                </div>
                {r.comment && <p className="mt-1.5 text-xs text-sub">&ldquo;{r.comment}&rdquo;</p>}
              </div>
              <div className="shrink-0 text-right text-[11px] text-sub">
                <p className="font-mono">{new Date(r.created_at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                <p className="mt-0.5">{r.reviewer ?? "-"}</p>
              </div>
            </li>
          ))}
        </ul>
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
        title="History"
        description="Stored readings and operator decisions."
        actions={
          <div role="tablist" className="relative grid grid-cols-2 rounded-full border border-line bg-surface p-0.5 text-[13px]">
            <span
              aria-hidden
              className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-accent/15 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--c-accent)_35%,transparent)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: tab === "readings" ? "none" : "translateX(100%)" }}
            />
            {(["readings", "reviews"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`relative z-10 rounded-full px-4 py-1.5 transition-colors ${tab === t ? "font-medium text-ink" : "text-sub hover:text-ink"}`}
              >
                {t === "readings" ? "Readings" : "Reviews"}
              </button>
            ))}
          </div>
        }
      />
      {tab === "readings" ? <Readings /> : <Reviews />}
    </>
  );
}
