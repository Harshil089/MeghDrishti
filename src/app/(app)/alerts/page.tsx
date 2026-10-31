"use client";

import { useMemo, useState } from "react";
import { Search, X, Filter } from "lucide-react";
import AlertDetailModal from "@/components/AlertDetailModal";
import { Select } from "@/components/console/Select";
import { Empty, PageHeader, Badge, button, card, field, severityTone, type Tone } from "@/components/console/ui";
import type { Alert } from "@/lib/mock-data";
import { districtOf, fetchAlerts, fetchStationOptions, regionLabel } from "@/lib/api";
import { useLiveData, useLiveDataWs } from "@/lib/useLiveData";

type Severity = "all" | "critical" | "warning" | "info";
const SEGMENTS: { key: Severity; code: string; label: string; tone: Tone }[] = [
  { key: "all", code: "QUEUE-ALL", label: "All Active Flags", tone: "neutral" },
  { key: "critical", code: "SEV-CRIT", label: "Critical Faults", tone: "crit" },
  { key: "warning", code: "SEV-WARN", label: "Warning / Suspect", tone: "warn" },
  { key: "info", code: "SEV-INFO", label: "Advisory / Info", tone: "info" },
];
const bar: Record<Tone, string> = {
  crit: "bg-crit",
  warn: "bg-warn",
  info: "bg-accent",
  ok: "bg-ok",
  neutral: "bg-sub",
};
const topBorder: Record<Tone, string> = {
  crit: "border-t-2 border-t-crit",
  warn: "border-t-2 border-t-warn",
  info: "border-t-2 border-t-accent",
  ok: "border-t-2 border-t-ok",
  neutral: "border-t-2 border-t-ink",
};
const hhmm = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
const dayTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "";
const dayStart = (d: string, days = 0) => {
  const t = new Date(`${d}T00:00`);
  t.setDate(t.getDate() + days);
  return t.toISOString();
};

export default function AlertsPage() {
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const past = !!(from || to || region);
  const loaded = useLiveDataWs(
    () =>
      fetchAlerts({
        since: from ? dayStart(from) : undefined,
        until: to ? dayStart(to, 1) : undefined,
        region: region || undefined,
      }),
    [] as Alert[],
    "/ws/alerts",
    60000,
    [from, to, region]
  );
  const alerts = useMemo(
    () => (district ? loaded.filter((a) => a.stationName && districtOf(a.stationName) === district) : loaded),
    [loaded, district]
  );

  const stations = useLiveData(fetchStationOptions, []);
  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stations) counts.set(s.region ?? "", (counts.get(s.region ?? "") ?? 0) + 1);
    return [...counts].filter(([r]) => r).sort(([a], [b]) => regionLabel(a).localeCompare(regionLabel(b)));
  }, [stations]);
  const districts = useMemo(
    () => [...new Set(stations.filter((s) => s.region === region).map((s) => districtOf(s.name)))].sort(),
    [stations, region]
  );
  const [segment, setSegment] = useState<Severity>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const inSegment = (a: Alert) => segment === "all" || a.severity === segment;
  const q = query.trim().toLowerCase();
  const queue = alerts.filter(
    (a) => inSegment(a) && (!q || `${a.station} ${a.stationName ?? ""} ${a.code} ${a.message}`.toLowerCase().includes(q))
  );
  const selected = queue.find((a) => a.id === selectedId) ?? queue[0] ?? null;

  const topCode = useMemo(() => {
    const out: Partial<Record<Severity, string>> = {};
    for (const s of SEGMENTS) {
      const tally = new Map<string, number>();
      for (const a of alerts) if (s.key === "all" || a.severity === s.key) tally.set(a.code, (tally.get(a.code) ?? 0) + 1);
      out[s.key] = [...tally].sort((x, y) => y[1] - x[1])[0]?.[0];
    }
    return out;
  }, [alerts]);

  return (
    <>
      <PageHeader
        code="SYS-TRG-03 // ANOMALY TRIAGE & OPERATOR VERIFICATION"
        title="Anomaly Triage & Verification Workbench"
        description={
          past
            ? `Displaying ${alerts.length} historical & active quality flags matching spatial/temporal criteria.`
            : `${alerts.length} open quality flags in queue (newest first). Select an alert to inspect detection evidence, satellite cross-checks, and record an official operator disposition.`
        }
      />

      {/* Spatial & Temporal Filter Toolbar */}
      <div className={`${card} mb-5 flex flex-wrap items-center gap-2.5 bg-surface px-4 py-2.5`}>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sub mr-1">
          <Filter className="h-3.5 w-3.5 text-accent" />
          SCOPE FILTER:
        </span>
        <Select
          aria-label="State"
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setDistrict("");
            setSelectedId(null);
          }}
          className="min-w-[175px]"
        >
          <option value="">All States & UTs</option>
          {regions.map(([r, n]) => (
            <option key={r} value={r}>
              {regionLabel(r)} ({n})
            </option>
          ))}
        </Select>
        {region && (
          <Select
            aria-label="District"
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setSelectedId(null);
            }}
            className="min-w-[155px]"
          >
            <option value="">All Districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        )}
        <label className="ml-auto flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-sub">
          FROM
          <input
            type="date"
            aria-label="From date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
              setSelectedId(null);
            }}
            className={`${field} w-[145px] font-mono text-xs`}
          />
        </label>
        <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-sub">
          TO
          <input
            type="date"
            aria-label="To date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
              setSelectedId(null);
            }}
            className={`${field} w-[145px] font-mono text-xs`}
          />
        </label>
        {(past || district) && (
          <button
            onClick={() => {
              setRegion("");
              setDistrict("");
              setFrom("");
              setTo("");
              setSelectedId(null);
            }}
            className={button}
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      <div className="space-y-5">
        {/* 4-Segment Severity Strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {SEGMENTS.map((s) => {
            const n = s.key === "all" ? alerts.length : alerts.filter((a) => a.severity === s.key).length;
            const on = segment === s.key;
            return (
              <button
                key={s.key}
                onClick={() => {
                  setSegment(s.key);
                  setSelectedId(null);
                }}
                aria-pressed={on}
                className={`${card} ${topBorder[s.tone]} flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:border-accent/50 ${
                  on ? "border-accent ring-1 ring-accent bg-accent-soft/20" : ""
                }`}
              >
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
                    {s.code}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-ink">{s.label}</span>
                  <span className="mt-1 block truncate font-mono text-[11px] text-sub">
                    DOMINANT: {topCode[s.key] ?? "NONE"}
                  </span>
                </div>
                <span className="font-mono text-3xl font-bold tabular-nums tracking-tight text-ink">{n}</span>
              </button>
            );
          })}
        </div>

        {/* Master-Detail Triage Workbench */}
        <div className="grid items-start gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
          <section className={`${card} flex min-w-0 flex-col overflow-hidden`}>
            <div className="flex h-11 items-center justify-between border-b border-line bg-raised/60 px-4">
              <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                Flagged Observation Queue
              </h2>
              <span className="font-mono text-[11px] text-sub">{queue.length} records</span>
            </div>

            <div className="border-b border-line p-2.5 bg-surface">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sub" />
                <input
                  type="search"
                  aria-label="Search alerts"
                  placeholder="Filter by station name, code, or reason…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`${field} pl-8`}
                />
              </div>
            </div>

            {queue.length === 0 ? (
              <Empty>
                {alerts.length ? "No alerts match filter criteria." : past || district ? "No alerts in window." : "No open alerts."}
              </Empty>
            ) : (
              <ul className="max-h-[calc(100dvh-320px)] min-h-[480px] divide-y divide-line overflow-y-auto">
                {queue.map((a) => {
                  const on = a.id === selected?.id;
                  const tone = severityTone[a.severity];
                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => setSelectedId(a.id)}
                        aria-current={on}
                        className={`relative grid w-full grid-cols-[1fr_auto] items-start gap-2.5 px-4 py-3 text-left transition-colors ${
                          on ? "bg-accent-soft/70" : "hover:bg-raised/60"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`absolute inset-y-0 left-0 w-1 ${on ? "bg-accent" : bar[tone]}`}
                        />
                        <div className="min-w-0 pl-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-semibold text-ink">
                              {a.stationName ?? a.station}
                            </span>
                            {a.status !== "OPEN" && (
                              <Badge tone="neutral">{a.status}</Badge>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink">
                              {a.code}
                            </span>
                            <span className="truncate text-xs text-sub">{a.message}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="h-1.5 w-24 overflow-hidden rounded-xs bg-raised">
                              <span className={`block h-full ${bar[tone]}`} style={{ width: `${a.confidence}%` }} />
                            </span>
                            <span className="font-mono text-[10px] text-sub">CONF {a.confidence}%</span>
                          </div>
                        </div>
                        <span className="whitespace-nowrap font-mono text-[11px] text-sub">
                          {past ? dayTime(a.detectedAt) : hhmm(a.detectedAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <AlertDetailModal inline key={selected?.id} alert={selected} onClose={() => setSelectedId(null)} />
        </div>
      </div>
    </>
  );
}
