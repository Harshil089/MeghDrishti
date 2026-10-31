"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Cloud, CloudRain, Droplets, Gauge, Sun, Thermometer, Wind, ArrowUpRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import AlertDetailModal from "@/components/AlertDetailModal";
import {
  Badge,
  Empty,
  Metric,
  MetricStrip,
  PageHeader,
  Section,
  button,
  buttonPrimary,
  card,
  chip,
  healthTone,
  severityTone,
  type Tone,
} from "@/components/console/ui";
import { Sparkline, chartColors } from "@/components/console/TrendChart";
import { statusMeta, type Alert, type Station } from "@/lib/mock-data";
import {
  fetchAlerts,
  fetchAnomalyAnalytics,
  fetchDashboardSummary,
  fetchStationObservations,
  fetchStationOptions,
  fetchStations,
  type DashboardSummary,
  type LiveReading,
  type StationOption,
} from "@/lib/api";
import { useLiveData, useLiveDataWs } from "@/lib/useLiveData";

const statusTone: Record<Station["status"], Tone> = {
  normal: "ok",
  new: "info",
  warning: "warn",
  critical: "crit",
  offline: "neutral",
};
const toneColor: Record<Tone, string> = {
  ok: chartColors.ok,
  warn: chartColors.warn,
  crit: chartColors.crit,
  info: chartColors.accent,
  neutral: chartColors.sub,
};
const pretty = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const hhmm = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--";

function condition(r?: LiveReading) {
  if (!r) return { label: "Awaiting Packet", Icon: Cloud };
  if ((r.rainfall_mm ?? 0) > 0) return { label: "Active Precipitation", Icon: CloudRain };
  if ((r.humidity_pct ?? 0) >= 85) return { label: "High Humidity / Overcast", Icon: Cloud };
  return { label: "Clear / Nominal Synoptic", Icon: Sun };
}

function TrustRing({ value }: { value: number | null }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const r = 56;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--c-raised)" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth="12"
          strokeLinecap="butt"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-bold tabular-nums tracking-tight text-ink">
          {value === null ? "–" : Math.round(v)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-sub">INDEX / 100</span>
      </div>
    </div>
  );
}

function StripRow({ name, dbId }: { name: string; dbId?: string }) {
  const a = useLiveData(
    () => (dbId ? fetchAnomalyAnalytics(dbId) : Promise.resolve(null)),
    null as Awaited<ReturnType<typeof fetchAnomalyAnalytics>> | null,
    60000,
    [dbId]
  );
  const series = a?.hourly_series ?? [];
  const newest = Math.max(0, ...series.map((h) => Date.parse(h.hour)));
  const row: number[] = Array(24).fill(0);
  for (const h of series) {
    const back = Math.round((newest - Date.parse(h.hour)) / 36e5);
    if (back >= 0 && back < 24) row[23 - back] += h.count;
  }
  const max = Math.max(1, ...row);
  return (
    <div className="grid grid-cols-[120px_1fr_36px] items-center gap-2.5 py-0.5">
      <span className="truncate text-xs font-medium text-ink" title={name}>
        {name}
      </span>
      <span className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
        {row.map((n, h) => (
          <span
            key={h}
            title={`${n} anomalies`}
            className={`h-5 rounded-[2px] ${n >= 3 ? "bg-warn" : "bg-accent"}`}
            style={{ opacity: n === 0 ? 0.08 : 0.35 + 0.65 * (n / max) }}
          />
        ))}
      </span>
      <span className="text-right font-mono text-[11px] tabular-nums text-sub">
        {row.reduce((acc, v) => acc + v, 0)}
      </span>
    </div>
  );
}

function StationCard({
  station,
  dbId,
  active,
  onPick,
}: {
  station: Station;
  dbId?: string;
  active: boolean;
  onPick: () => void;
}) {
  const readings = useLiveData(
    () => (dbId ? fetchStationObservations(dbId, 24) : Promise.resolve([])),
    [] as LiveReading[],
    60000,
    [dbId]
  );
  const temps = [...readings]
    .reverse()
    .map((r) => r.temperature_c)
    .filter((v): v is number => typeof v === "number");
  const tone = statusTone[station.status];
  const topBorder =
    tone === "crit" ? "border-t-2 border-t-crit" : tone === "warn" ? "border-t-2 border-t-warn" : "border-t-2 border-t-accent";

  return (
    <button
      onClick={onPick}
      className={`${card} ${topBorder} flex min-w-0 flex-col gap-2.5 p-3.5 text-left transition-colors hover:border-accent/50 ${
        active ? "border-accent ring-1 ring-accent bg-accent-soft/20" : ""
      }`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-ink">{station.name}</span>
          <span className="block truncate font-mono text-[10px] text-sub">{station.id}</span>
        </span>
        <Badge tone={tone}>{statusMeta[station.status].label}</Badge>
      </span>
      <div className="flex items-baseline justify-between gap-2 pt-1">
        <span className="font-mono text-2xl font-bold tabular-nums tracking-tight text-ink">
          {station.temp == null ? "–" : `${station.temp.toFixed(1)}°C`}
        </span>
        <span className="font-mono text-[10px] uppercase text-sub">24H TRACE</span>
      </div>
      <Sparkline values={temps} color={toneColor[tone]} height={32} />
    </button>
  );
}

export default function DashboardPage() {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const summary = useLiveDataWs(fetchDashboardSummary, null as DashboardSummary | null, "/ws/dashboard");
  const stations = useLiveData(fetchStations, [] as Station[], 30000);
  const options = useLiveData(fetchStationOptions, [] as StationOption[], 60000);
  const alerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts");

  const dbByCode = useMemo(() => new Map(options.map((o) => [o.code, o.dbId])), [options]);
  const attention = useMemo(() => {
    const rank = { critical: 0, warning: 1, new: 2, normal: 3, offline: 4 } as const;
    return [...stations].sort((a, b) => rank[a.status] - rank[b.status]).slice(0, 5);
  }, [stations]);
  const counts = useMemo(() => {
    const c = { clean: 0, watch: 0, faulty: 0, offline: 0 };
    for (const s of stations) {
      if (s.status === "critical") c.faulty++;
      else if (s.status === "warning") c.watch++;
      else if (s.status === "offline") c.offline++;
      else c.clean++;
    }
    return c;
  }, [stations]);

  const reporting = new Set(stations.filter((s) => s.temp != null && s.status !== "offline").map((s) => s.id));
  const focusCode =
    focus ??
    alerts.find((a) => reporting.has(a.station))?.station ??
    attention.find((s) => reporting.has(s.id))?.id ??
    options[0]?.code ??
    null;
  const focusStation = stations.find((s) => s.id === focusCode);
  const focusDb = focusCode ? dbByCode.get(focusCode) : undefined;
  const readings = useLiveData(
    () => (focusDb ? fetchStationObservations(focusDb, 1) : Promise.resolve([])),
    [] as LiveReading[],
    30000,
    [focusDb]
  );
  const latest = readings[0];
  const focusAlert = alerts.find((a) => a.station === focusCode);
  const { label: cond, Icon: CondIcon } = condition(latest);
  const health = summary?.average_station_health ?? null;
  const verdictLine =
    health === null
      ? "Awaiting composite network telemetry scores."
      : health >= 90
      ? "Nominal quality index across national reporting grid."
      : health >= 70
      ? "Degraded subsystem reliability; review priority stations."
      : "Critical telemetry anomalies detected; immediate triage required.";

  const totalStations = Math.max(1, stations.length);
  const onlineCount = counts.clean + counts.watch + counts.faulty;

  const parameters = [
    { Icon: Thermometer, code: "TEMP", label: "Air Temp", value: latest?.temperature_c?.toFixed(1), unit: "°C" },
    { Icon: Droplets, code: "RH", label: "Rel. Humidity", value: latest?.humidity_pct, unit: "%" },
    { Icon: Gauge, code: "PRES", label: "Baro. Pressure", value: latest?.pressure_hpa, unit: "hPa" },
    { Icon: Wind, code: "WIND", label: "Wind Speed", value: latest?.wind_speed_ms, unit: "m/s" },
    { Icon: CloudRain, code: "PRECIP", label: "Rainfall (15m)", value: latest?.rainfall_mm, unit: "mm" },
  ];

  return (
    <>
      <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />

      <PageHeader
        code="SYS-CMD-01 // NATIONAL SURFACE TELEMETRY OVERVIEW"
        title="National AWS Network Command Overview"
        description="Real-time quality assurance, active station triage queue, and 24-hour spatial anomaly distribution across the India Meteorological Department (IMD) AWS network."
        actions={
          <>
            <Link href="/network" className={button}>
              National GIS Grid <ArrowUpRight className="h-3.5 w-3.5 text-sub" />
            </Link>
            <Link href="/alerts" className={buttonPrimary}>
              Open Alert Triage ({alerts.length})
            </Link>
          </>
        }
      />

      <div className="space-y-5">
        {/* Top Executive KPI Strip */}
        <MetricStrip cols={4}>
          <Metric
            label="Fleet Quality Index (WMO-QC)"
            value={health === null ? "–" : `${Math.round(health)}%`}
            unit="composite"
            tone={healthTone(health)}
            foot={verdictLine}
          />
          <Metric
            label="Active Reporting Stations"
            value={onlineCount.toLocaleString()}
            unit={`/ ${stations.length.toLocaleString()}`}
            tone="info"
            foot={`${counts.offline.toLocaleString()} stations awaiting telemetry uplink`}
          />
          <Metric
            label="Active Triage Queue"
            value={alerts.length.toLocaleString()}
            unit="open flags"
            tone={counts.faulty > 0 ? "crit" : counts.watch > 0 ? "warn" : "ok"}
            foot={`${counts.faulty} critical faults · ${counts.watch} watch advisories`}
          />
          <Metric
            label="24-Hour Flagged Events"
            value={(summary?.anomalies_24h ?? 0).toLocaleString()}
            unit="anomalies"
            tone="neutral"
            foot="Evaluated across 11 deterministic rules + ML"
          />
        </MetricStrip>

        {/* Primary Telemetry Spotlight + Fleet Integrity */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Section
            title="Priority Station Telemetry Spotlight"
            meta={focusCode ? `STATION ID: ${focusCode}` : "SELECT STATION"}
            actions={
              <Link href="/live-monitor" className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent hover:underline">
                Full Stream →
              </Link>
            }
          >
            <div className="flex flex-col gap-4">
              {/* Station selector tabs */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-line pb-3">
                <span className="mr-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
                  PRIORITY QUEUE:
                </span>
                {attention.map((s) => (
                  <button key={s.id} onClick={() => setFocus(s.id)} className={chip(s.id === focusCode)}>
                    {s.name}
                  </button>
                ))}
              </div>

              {/* Station Identity & Synoptic Summary */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold tracking-tight text-ink">
                      {focusStation?.name ?? focusCode ?? "No Station Selected"}
                    </h3>
                    {focusStation && <Badge tone={statusTone[focusStation.status]}>{statusMeta[focusStation.status].label}</Badge>}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-sub">
                    CODE: {focusCode ?? "N/A"} · SYNOPTIC STATE: {cond.toUpperCase()}
                    {latest?.source && ` · SOURCE: ${latest.source}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded border border-line bg-raised/50 px-3.5 py-2">
                  <CondIcon className="h-7 w-7 text-accent" strokeWidth={1.6} aria-hidden />
                  <div className="text-right font-mono">
                    <span className="block text-[10px] uppercase tracking-wider text-sub">LAST PACKET</span>
                    <span className="block text-xs font-semibold text-ink">{latest ? hhmm(latest.timestamp) : "--:--"}</span>
                  </div>
                </div>
              </div>

              {/* 5-Parameter Structured Telemetry Grid */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-5">
                {parameters.map(({ Icon, code, label, value, unit }) => (
                  <div key={code} className="bg-surface p-3.5">
                    <div className="flex items-center justify-between text-sub">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">{code}</span>
                      <Icon className="h-3.5 w-3.5 text-accent" aria-hidden />
                    </div>
                    <p className="mt-1.5 flex items-baseline gap-1">
                      <span className="font-mono text-2xl font-bold tabular-nums text-ink">{value ?? "–"}</span>
                      <span className="font-mono text-[11px] text-sub">{unit}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-sub">{label}</p>
                  </div>
                ))}
              </div>

              {/* Active Diagnostic Verdict Banner */}
              <div
                className={`flex flex-wrap items-start gap-3 rounded border px-4 py-3 text-xs ${
                  focusAlert
                    ? severityTone[focusAlert.severity] === "crit"
                      ? "border-crit/30 bg-crit/5 text-ink"
                      : "border-warn/30 bg-warn/5 text-ink"
                    : "border-ok/30 bg-ok/5 text-ink"
                }`}
              >
                {focusAlert ? (
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      severityTone[focusAlert.severity] === "crit" ? "text-crit" : "text-warn"
                    }`}
                  />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">
                      {focusAlert ? `ACTIVE QC FLAG · ${focusAlert.code}` : "WMO-QC VERIFIED · NOMINAL"}
                    </span>
                    {focusAlert && (
                      <span className="font-mono text-[11px] text-sub">
                        CONFIDENCE: {focusAlert.confidence}%
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 leading-relaxed text-sub">
                    {focusAlert
                      ? focusAlert.message
                      : "All parameters within physical, temporal, and spatial consistency bounds."}
                  </p>
                </div>
                {focusAlert && (
                  <button
                    onClick={() => setSelectedAlert(focusAlert)}
                    className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent hover:underline"
                  >
                    Inspect Evidence →
                  </button>
                )}
              </div>
            </div>
          </Section>

          {/* Right: Fleet Integrity Breakdown */}
          <Section title="Fleet Integrity Breakdown" meta="NATIONAL GRID">
            <div className="flex flex-col justify-between h-full gap-4">
              <div className="flex items-center gap-5 border-b border-line pb-4">
                <TrustRing value={health} />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">
                    NETWORK HEALTH STATUS
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-snug text-ink">{verdictLine}</p>
                  <p className="mt-1.5 font-mono text-[11px] text-sub">
                    {onlineCount.toLocaleString()} reporting · {counts.offline.toLocaleString()} offline
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { label: "Nominal (Verified)", count: counts.clean, tone: "bg-ok", textTone: "text-ok" },
                  { label: "Watch (Suspect Flag)", count: counts.watch, tone: "bg-warn", textTone: "text-warn" },
                  { label: "Critical (Sensor Fault)", count: counts.faulty, tone: "bg-crit", textTone: "text-crit" },
                  { label: "Telemetry Offline", count: counts.offline, tone: "bg-sub/50", textTone: "text-sub" },
                ].map((row) => {
                  const pct = Math.round((row.count / totalStations) * 100);
                  return (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink">{row.label}</span>
                        <span className={`font-mono font-semibold tabular-nums ${row.textTone}`}>
                          {row.count.toLocaleString()}{" "}
                          <span className="text-[10px] font-normal text-sub">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-xs bg-raised">
                        <div className={`h-full ${row.tone}`} style={{ width: `${Math.max(1, pct)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>
        </div>

        {/* Priority Watchlist */}
        <Section
          title="Priority Watchlist · Stations Requiring Operator Attention"
          meta="RANKED BY SEVERITY · 24H TEMPERATURE TRACE"
          actions={
            <Link href="/network" className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent hover:underline">
              Open Spatial Map →
            </Link>
          }
        >
          {attention.length === 0 ? (
            <Empty>Awaiting station telemetry feed</Empty>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {attention.map((s) => (
                <StationCard
                  key={s.id}
                  station={s}
                  dbId={dbByCode.get(s.id)}
                  active={s.id === focusCode}
                  onPick={() => setFocus(s.id)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* Bottom Split: Decision Feed + 24h Anomaly Matrix */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
          <Section
            title="Real-Time Ensemble Decision Stream"
            meta="LATEST REASON-CODED VERDICTS"
            flush
            actions={
              <Link href="/alerts" className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent hover:underline">
                Full Triage Queue →
              </Link>
            }
          >
            {alerts.length === 0 ? (
              <Empty>No active anomaly decisions in queue</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {alerts.slice(0, 6).map((a) => {
                  const tone = severityTone[a.severity];
                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => setSelectedAlert(a)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-raised/60"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            tone === "crit" ? "bg-crit" : tone === "warn" ? "bg-warn" : "bg-accent"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-ink">{a.station}</span>
                            <Badge tone={tone}>
                              {a.explanation?.classification ? pretty(a.explanation.classification) : a.severity}
                            </Badge>
                            <span className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-ink">
                              {a.code}
                            </span>
                            <span className="ml-auto font-mono text-[11px] text-sub">
                              CONF {a.confidence}% · {hhmm(a.detectedAt)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-sub">{a.message}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section
            title="24-Hour Spatial-Temporal Anomaly Matrix"
            meta={`${(summary?.anomalies_24h ?? 0).toLocaleString()} FLEET-WIDE`}
          >
            {attention.length === 0 ? (
              <Empty>Awaiting station hourly series</Empty>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[120px_1fr_36px] gap-2.5 border-b border-line pb-1.5 font-mono text-[10px] uppercase tracking-wider text-sub">
                  <span>STATION</span>
                  <span className="flex justify-between">
                    <span>-24H</span>
                    <span>-12H</span>
                    <span>NOW</span>
                  </span>
                  <span className="text-right">SUM</span>
                </div>
                {attention.map((s) => (
                  <StripRow key={s.id} name={s.name} dbId={dbByCode.get(s.id)} />
                ))}
                <div className="flex flex-wrap items-center gap-4 border-t border-line pt-3 font-mono text-[10px] uppercase tracking-wider text-sub">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[2px] bg-accent/25" /> 1–2 Flags/hr
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[2px] bg-accent" /> Elevated
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-[2px] bg-warn" /> ≥3 Flags/hr (Burst)
                  </span>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
