"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Cloud, CloudRain, Droplets, Gauge, Sun, Thermometer, Wind, ArrowUpRight, AlertTriangle, CheckCircle2, MapPin } from "lucide-react";
import AlertDetailModal from "@/components/AlertDetailModal";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { motionTransitions } from "@/lib/motion-tokens";
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
  const spotlight =
    tone === "crit" ? "rgba(185, 28, 28, 0.12)" : tone === "warn" ? "rgba(180, 83, 9, 0.12)" : "rgba(29, 78, 216, 0.1)";

  return (
    <Link href={`/network?station=${station.id}&notify=1`} className="block group">
      <SpotlightCard
        spotlightColor={spotlight}
        spotlightSize={240}
        className={`${topBorder} flex min-w-0 flex-col gap-2.5 p-3.5 text-left rounded-xl transition-all duration-200 hover:border-accent hover:shadow-md ${
          active ? "border-accent ring-1 ring-accent bg-accent-soft/20" : ""
        }`}
      >
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-ink group-hover:text-accent transition-colors">
              {station.name}
            </span>
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
        <div className="mt-0.5 flex items-center justify-between border-t border-line/60 pt-2 font-mono text-[10px] text-accent">
          <span className="inline-flex items-center gap-1 font-semibold">
            <MapPin className="h-3 w-3" /> Locate & Open Alert
          </span>
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </div>
      </SpotlightCard>
    </Link>
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
        title="Overview"
        actions={
          <>
            <Link href="/network" className={button}>
              Grid Map <ArrowUpRight className="h-3.5 w-3.5 text-sub" />
            </Link>
            <Link href="/alerts" className={buttonPrimary}>
              Alerts ({alerts.length})
            </Link>
          </>
        }
      />

      <div className="space-y-5">
        {/* Top Executive KPI Strip */}
        <MetricStrip cols={4}>
          <Metric
            label="Fleet Health"
            value={health === null ? "–" : `${Math.round(health)}%`}
            unit="composite"
            tone={healthTone(health)}
          />
          <Metric
            label="Active Stations"
            value={onlineCount.toLocaleString()}
            unit={`/ ${stations.length.toLocaleString()}`}
            tone="info"
          />
          <Metric
            label="Active Alerts"
            value={alerts.length.toLocaleString()}
            unit="flags"
            tone={counts.faulty > 0 ? "crit" : counts.watch > 0 ? "warn" : "ok"}
          />
          <Metric
            label="24h Anomalies"
            value={(summary?.anomalies_24h ?? 0).toLocaleString()}
            unit="events"
            tone="neutral"
          />
        </MetricStrip>

        {/* Primary Telemetry Spotlight + Fleet Integrity */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Section
            title="Station Telemetry"
            actions={
              <Link href="/live-monitor" className="text-xs font-medium text-accent hover:underline">
                Full Stream →
              </Link>
            }
          >
            <div className="flex flex-col gap-4">
              {/* Station selector tabs */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-line/80 pb-3">
                {attention.map((s) => (
                  <button key={s.id} onClick={() => setFocus(s.id)} className={chip(s.id === focusCode)}>
                    {s.name}
                  </button>
                ))}
              </div>

              {/* Station Identity & Synoptic Summary */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold tracking-tight text-ink">
                      {focusStation?.name ?? focusCode ?? "No Station Selected"}
                    </h3>
                    {focusStation && <Badge tone={statusTone[focusStation.status]}>{statusMeta[focusStation.status].label}</Badge>}
                    {focusStation && (
                      <Link
                        href={`/network?station=${focusStation.id}&notify=1`}
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline ml-1"
                      >
                        <MapPin className="h-3 w-3" /> Map
                      </Link>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-sub">
                    {focusCode} · {cond}
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-line bg-raised/40 px-3.5 py-1.5">
                  <CondIcon className="h-5 w-5 text-accent" strokeWidth={1.8} aria-hidden />
                  <div className="text-right">
                    <span className="block text-[11px] font-mono text-ink font-semibold">{latest ? hhmm(latest.timestamp) : "--:--"}</span>
                  </div>
                </div>
              </div>

              {/* 5-Parameter Structured Telemetry Grid */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
                {parameters.map(({ Icon, code, label, value, unit }) => (
                  <div key={code} className="bg-surface p-3.5">
                    <div className="flex items-center justify-between text-sub">
                      <span className="text-[11px] font-medium text-sub">{label}</span>
                      <Icon className="h-3.5 w-3.5 text-accent" aria-hidden />
                    </div>
                    <p className="mt-1 flex items-baseline gap-1">
                      <span className="font-mono text-2xl font-bold tabular-nums text-ink">{value ?? "–"}</span>
                      <span className="font-mono text-xs text-sub">{unit}</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Active Diagnostic Verdict Banner */}
              <div
                className={`flex flex-wrap items-start gap-3 rounded-xl border px-4 py-3 text-xs ${
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
                    <span className="font-semibold">
                      {focusAlert ? focusAlert.code : "Nominal"}
                    </span>
                    {focusAlert && (
                      <span className="font-mono text-[11px] text-sub">
                        {focusAlert.confidence}% confidence
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sub">
                    {focusAlert
                      ? focusAlert.message
                      : "All parameters within physical and spatial consistency bounds."}
                  </p>
                </div>
                {focusAlert && (
                  <button
                    onClick={() => setSelectedAlert(focusAlert)}
                    className="shrink-0 text-xs font-medium text-accent hover:underline cursor-pointer"
                  >
                    Inspect →
                  </button>
                )}
              </div>
            </div>
          </Section>

          {/* Right: Fleet Integrity Breakdown */}
          <Section title="Fleet Integrity">
            <div className="flex flex-col justify-between h-full gap-4">
              <div className="flex items-center gap-4 border-b border-line pb-4">
                <TrustRing value={health} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{verdictLine}</p>
                  <p className="mt-1 font-mono text-xs text-sub">
                    {onlineCount.toLocaleString()} online · {counts.offline.toLocaleString()} offline
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { label: "Nominal", count: counts.clean, tone: "bg-ok", textTone: "text-ok" },
                  { label: "Watch", count: counts.watch, tone: "bg-warn", textTone: "text-warn" },
                  { label: "Critical", count: counts.faulty, tone: "bg-crit", textTone: "text-crit" },
                  { label: "Offline", count: counts.offline, tone: "bg-sub/50", textTone: "text-sub" },
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
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
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
          title="Watchlist"
          actions={
            <Link href="/network" className="text-xs font-medium text-accent hover:underline">
              Grid Map →
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
            title="Recent Decisions"
            flush
            actions={
              <Link href="/alerts" className="text-xs font-medium text-accent hover:underline">
                All Alerts →
              </Link>
            }
          >
            {alerts.length === 0 ? (
              <Empty>No active anomaly decisions</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {alerts.slice(0, 6).map((a) => {
                  const tone = severityTone[a.severity];
                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => setSelectedAlert(a)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-raised/60 cursor-pointer"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            tone === "crit" ? "bg-crit" : tone === "warn" ? "bg-warn" : "bg-accent"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-accent">
                              {a.station}
                            </span>
                            <Badge tone={tone}>
                              {a.explanation?.classification ? pretty(a.explanation.classification) : a.severity}
                            </Badge>
                            <span className="text-xs text-ink">{a.code}</span>
                            <span className="ml-auto font-mono text-[11px] text-sub">
                              {hhmm(a.detectedAt)}
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

          <Section title="Anomaly Matrix">
            {attention.length === 0 ? (
              <Empty>Awaiting station hourly series</Empty>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[120px_1fr_36px] gap-2.5 border-b border-line pb-1.5 text-[11px] font-medium text-sub">
                  <span>Station</span>
                  <span className="flex justify-between">
                    <span>-24h</span>
                    <span>-12h</span>
                    <span>Now</span>
                  </span>
                  <span className="text-right">Sum</span>
                </div>
                {attention.map((s) => (
                  <StripRow key={s.id} name={s.name} dbId={dbByCode.get(s.id)} />
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
