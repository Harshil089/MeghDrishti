"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Cloud, CloudRain, Droplets, Gauge, Sun, Wind } from "lucide-react";
import AlertDetailModal from "@/components/AlertDetailModal";
import { Badge, Empty, Eyebrow, card, chip, severityTone, type Tone } from "@/components/console/ui";
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

const statusTone: Record<Station["status"], Tone> = { normal: "ok", new: "info", warning: "warn", critical: "crit", offline: "neutral" };
const toneColor: Record<Tone, string> = { ok: chartColors.ok, warn: chartColors.warn, crit: chartColors.crit, info: chartColors.accent, neutral: chartColors.sub };
const pretty = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const hhmm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--");

function condition(r?: LiveReading) {
  if (!r) return { label: "No recent reading", Icon: Cloud };
  if ((r.rainfall_mm ?? 0) > 0) return { label: "Raining", Icon: CloudRain };
  if ((r.humidity_pct ?? 0) >= 85) return { label: "Humid, overcast", Icon: Cloud };
  return { label: "Dry", Icon: Sun };
}

/** Solid ring for a 0-100 score. */
function TrustRing({ value }: { value: number | null }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--c-raised)" strokeWidth="14" />
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--c-accent)" strokeWidth="14" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-light tracking-tight text-ink">{value === null ? "–" : Math.round(v)}</span>
        <span className="text-xs text-sub">of 100</span>
      </div>
    </div>
  );
}

/** One station's anomalies per hour over the last 24 h, from the server's hourly series. */
function StripRow({ name, dbId }: { name: string; dbId?: string }) {
  const a = useLiveData(() => (dbId ? fetchAnomalyAnalytics(dbId) : Promise.resolve(null)), null as Awaited<ReturnType<typeof fetchAnomalyAnalytics>> | null, 60000, [dbId]);
  // Anchor on the newest hour the server returned, so render stays pure.
  const series = a?.hourly_series ?? [];
  const newest = Math.max(0, ...series.map((h) => Date.parse(h.hour)));
  const row: number[] = Array(24).fill(0);
  for (const h of series) {
    const back = Math.round((newest - Date.parse(h.hour)) / 36e5);
    if (back >= 0 && back < 24) row[23 - back] += h.count;
  }
  const max = Math.max(1, ...row);
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-2">
      <span className="truncate text-[11px] text-sub" title={name}>
        {name}
      </span>
      <span className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
        {row.map((n, h) => (
          <span key={h} title={`${n} anomalies`} className={`h-6 rounded-[4px] ${n >= 3 ? "bg-warn" : "bg-accent"}`} style={{ opacity: n === 0 ? 0.07 : 0.3 + 0.7 * (n / max) }} />
        ))}
      </span>
    </div>
  );
}

function StationCard({ station, dbId, active, onPick }: { station: Station; dbId?: string; active: boolean; onPick: () => void }) {
  const readings = useLiveData(() => (dbId ? fetchStationObservations(dbId, 24) : Promise.resolve([])), [] as LiveReading[], 60000, [dbId]);
  const temps = [...readings].reverse().map((r) => r.temperature_c).filter((v): v is number => typeof v === "number");
  const tone = statusTone[station.status];
  return (
    <button
      onClick={onPick}
      className={`${card} flex min-w-0 flex-col gap-3 p-4 text-left transition-colors hover:border-accent/40 ${active ? "border-accent ring-1 ring-accent" : ""}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-ink">{station.name}</span>
          <span className="block truncate font-mono text-[11px] text-sub">{station.id}</span>
        </span>
        <Badge tone={tone}>{statusMeta[station.status].label}</Badge>
      </span>
      <span className="text-[34px] font-light leading-none tracking-tight text-ink">{station.temp == null ? "–" : `${station.temp.toFixed(1)}°`}</span>
      <Sparkline values={temps} color={toneColor[tone]} height={36} />
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

  // Default to the newest alert at a station that is actually reporting, so the hero has a reading.
  const reporting = new Set(stations.filter((s) => s.temp != null && s.status !== "offline").map((s) => s.id));
  const focusCode =
    focus ?? alerts.find((a) => reporting.has(a.station))?.station ?? attention.find((s) => reporting.has(s.id))?.id ?? options[0]?.code ?? null;
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
  const verdictLine = health === null ? "Waiting for health scores." : health >= 90 ? "Healthy across the network." : health >= 70 ? "Degraded. Some stations need a look." : "Attention needed across the network.";

  const reading = [
    { Icon: Droplets, label: "Humidity", value: latest?.humidity_pct, unit: "%" },
    { Icon: Gauge, label: "Pressure", value: latest?.pressure_hpa, unit: "hPa" },
    { Icon: Wind, label: "Wind", value: latest?.wind_speed_ms, unit: "m/s" },
    { Icon: CloudRain, label: "Rain", value: latest?.rainfall_mm, unit: "mm" },
  ];

  return (
    <>
      <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      <h1 className="pb-6 text-[28px] font-semibold tracking-tight text-ink">Tonight across your network</h1>

      <div className="space-y-5">
        {/* Hero: one station's conditions + fleet trust */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className={`${card} flex flex-col gap-5 p-6 md:p-8`}>
            <div className="flex flex-wrap gap-2">
              {attention.map((s) => (
                <button key={s.id} onClick={() => setFocus(s.id)} className={chip(s.id === focusCode)}>
                  {s.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-8">
              <div className="min-w-0">
                <p className="text-sm text-sub">
                  {focusStation?.name ?? focusCode ?? "No station"} · {cond}
                </p>
                <p className="mt-1 flex items-start text-ink">
                  <span className="text-[104px] font-light leading-[0.95] tracking-tighter">{latest?.temperature_c == null ? "–" : latest.temperature_c.toFixed(1)}</span>
                  <span className="mt-3 text-3xl font-light text-sub">°C</span>
                </p>
              </div>
              <CondIcon className="h-24 w-24 text-accent" strokeWidth={1.2} aria-hidden />
            </div>
            <div className="flex flex-wrap gap-3">
              {reading.map(({ Icon, label, value, unit }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-xl bg-raised px-3.5 py-2.5">
                  <Icon className="h-4 w-4 text-accent" aria-hidden />
                  <span>
                    <span className="block text-[11px] text-sub">{label}</span>
                    <span className="block text-[13px] font-medium text-ink">{value == null ? "–" : `${value} ${unit}`}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border border-line px-4 py-3 text-[13px] text-ink">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${focusAlert ? (severityTone[focusAlert.severity] === "crit" ? "bg-crit" : "bg-warn") : "bg-ok"}`} />
              {focusAlert ? focusAlert.message : "No open alerts for this station."}
              {latest && <span className="ml-auto shrink-0 font-mono text-[11px] text-sub">read {hhmm(latest.timestamp)}</span>}
            </div>
          </section>

          <section className={`${card} flex flex-col items-center gap-4 p-6 text-center`}>
            <Eyebrow>Fleet trust</Eyebrow>
            <TrustRing value={health} />
            <p className="max-w-[24ch] text-[13px] font-medium text-ink">{verdictLine}</p>
            <div className="grid w-full grid-cols-4 gap-1 text-center">
              {[
                ["clean", counts.clean, "text-ok"],
                ["watch", counts.watch, "text-warn"],
                ["faulty", counts.faulty, "text-crit"],
                ["offline", counts.offline, "text-sub"],
              ].map(([l, n, c]) => (
                <div key={l as string}>
                  <p className={`font-mono text-xl ${c}`}>{(n as number).toLocaleString()}</p>
                  <p className="text-[11px] text-sub">{l}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Stations needing attention */}
        <div>
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="text-[15px] font-semibold text-ink">Stations needing attention</h2>
            <span className="text-xs text-sub">worst health first · 24 h temperature</span>
            <Link href="/network" className="ml-auto text-xs font-medium text-accent hover:underline">
              Open map →
            </Link>
          </div>
          {attention.length === 0 ? (
            <div className={card}>
              <Empty>Waiting for stations</Empty>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {attention.map((s) => (
                <StationCard key={s.id} station={s} dbId={dbByCode.get(s.id)} active={s.id === focusCode} onPick={() => setFocus(s.id)} />
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
          {/* Decision feed */}
          <section className={`${card} min-w-0 p-6`}>
            <div className="mb-5 flex items-baseline gap-3">
              <h2 className="text-[15px] font-semibold text-ink">Decision feed</h2>
              <span className="text-xs text-sub">what the system concluded, and why</span>
              <Link href="/alerts" className="ml-auto text-xs font-medium text-accent hover:underline">
                Triage →
              </Link>
            </div>
            {alerts.length === 0 ? (
              <Empty>No open decisions</Empty>
            ) : (
              <ol>
                {alerts.slice(0, 5).map((a, i, arr) => {
                  const tone = severityTone[a.severity];
                  return (
                    <li key={a.id} className="grid grid-cols-[14px_1fr] gap-4">
                      <span className="flex flex-col items-center">
                        <span className={`mt-1 h-3 w-3 rounded-full ${tone === "crit" ? "bg-crit" : tone === "warn" ? "bg-warn" : "bg-accent"}`} />
                        {i < arr.length - 1 && <span className="w-px flex-1 bg-line" />}
                      </span>
                      <button onClick={() => setSelectedAlert(a)} className="-mx-2 mb-3 min-w-0 rounded-lg px-2 pb-3 text-left transition-colors hover:bg-raised">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-sub">{hhmm(a.detectedAt)}</span>
                          <span className="text-[13px] font-medium text-ink">{a.station}</span>
                          <Badge tone={tone}>{a.explanation?.classification ? pretty(a.explanation.classification) : a.severity}</Badge>
                          <span className="ml-auto font-mono text-xs text-sub">{a.confidence}% sure</span>
                        </span>
                        <span className="mt-1.5 flex min-w-0 items-center gap-1.5">
                          <span className="shrink-0 rounded-md bg-raised px-2 py-0.5 font-mono text-[11px] text-sub">{a.code}</span>
                          <span className="min-w-0 truncate text-xs text-sub">{a.message}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* 24 h anomaly strip */}
          <section className={`${card} min-w-0 p-6`}>
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-[15px] font-semibold text-ink">Anomalies · 24 h</h2>
              <span className="text-xs text-sub">stations needing attention</span>
              <span className="ml-auto font-mono text-xs text-sub">{(summary?.anomalies_24h ?? 0).toLocaleString()} fleet-wide</span>
            </div>
            {attention.length === 0 ? (
              <Empty>Waiting for stations</Empty>
            ) : (
              <div className="space-y-1.5">
                {attention.map((s) => (
                  <StripRow key={s.id} name={s.name} dbId={dbByCode.get(s.id)} />
                ))}
                <div className="grid grid-cols-[100px_1fr] gap-2 pt-1 font-mono text-[10px] text-sub">
                  <span />
                  <span className="flex justify-between">
                    <span>−24 h</span>
                    <span>−12 h</span>
                    <span>now</span>
                  </span>
                </div>
                <p className="flex items-center gap-2 pt-2 text-[11px] text-sub">
                  <span className="h-2.5 w-2.5 rounded-sm bg-accent/30" /> fewer
                  <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> more
                  <span className="h-2.5 w-2.5 rounded-sm bg-warn" /> 3+ in an hour
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
