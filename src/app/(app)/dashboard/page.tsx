"use client";

import { useState } from "react";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import AlertDetailModal from "@/components/AlertDetailModal";
import { PageHeader, Section, Metric, MetricStrip, Badge, Meter, Empty, healthTone, severityTone, type Tone } from "@/components/console/ui";
import { TimelineChart } from "@/components/console/TrendChart";
import { pipelineStages, type Alert } from "@/lib/mock-data";
import {
  fetchAlerts,
  fetchDashboardStats,
  fetchFleetSeries,
  fetchInsights,
  fetchSensorHealth,
  type DashboardStat,
  type SensorHealth,
} from "@/lib/api";
import { useLiveData, useLiveDataWs } from "@/lib/useLiveData";

const EMPTY_FLEET_SERIES = { temperature_c: [], humidity_pct: [], pressure_hpa: [] };

const FLEET_TABS = [
  { key: "temperature_c", label: "Temperature", unit: "°C" },
  { key: "pressure_hpa", label: "Pressure", unit: "hPa" },
  { key: "humidity_pct", label: "Humidity", unit: "%" },
] as const;

const statTone: Record<DashboardStat["tone"], Tone> = { emerald: "ok", rose: "crit", cyan: "info", amber: "warn" };

export default function DashboardPage() {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [metric, setMetric] = useState<(typeof FLEET_TABS)[number]["key"]>("temperature_c");
  const alerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts");
  const stats = useLiveDataWs(fetchDashboardStats, [] as DashboardStat[], "/ws/dashboard");
  const fleet = useLiveData(fetchFleetSeries, EMPTY_FLEET_SERIES, 30000);
  const insights = useLiveDataWs(fetchInsights, [] as string[], "/ws/dashboard");
  const sensors = useLiveData(fetchSensorHealth, [] as SensorHealth[], 30000);

  return (
    <>
      <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      <PageHeader title="Overview" description="Fleet status across all active stations, refreshed live." />

      <div className="space-y-4">
        <MetricStrip>
          {stats.length === 0
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[92px] bg-surface animate-pulse" />)
            : stats.map((s) => <Metric key={s.label} label={s.label} value={s.value} foot={s.sub} tone={statTone[s.tone]} />)}
        </MetricStrip>

        <div className="grid gap-4 lg:grid-cols-12">
          <Section title="Fleet averages" meta="Hourly mean across active stations" flush className="lg:col-span-8">
            <div role="tablist" aria-label="Measurement" className="grid grid-cols-3 gap-px border-b border-line bg-line">
              {FLEET_TABS.map((t) => {
                const on = metric === t.key;
                const cur = fleet[t.key].at(-1)?.value;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setMetric(t.key)}
                    className={`relative px-4 py-3 text-left transition-colors ${on ? "bg-surface" : "bg-raised/60 hover:bg-surface"}`}
                  >
                    <span className="block text-xs text-sub">{t.label}</span>
                    <span className="mt-1 flex items-baseline gap-1">
                      <span className={`font-mono text-2xl tabular-nums transition-colors ${on ? "text-ink" : "text-sub"}`}>{cur ?? "-"}</span>
                      <span className="text-xs text-sub">{t.unit}</span>
                    </span>
                    {on && <span aria-hidden className="tab-indicator absolute inset-x-0 bottom-0 h-0.5 c-grad-brand" />}
                  </button>
                );
              })}
            </div>
            <div className="h-56 p-4">
              <TimelineChart key={metric} data={fleet[metric]} label={FLEET_TABS.find((t) => t.key === metric)!.label} />
            </div>
          </Section>

          <Section
            title="Open alerts"
            meta={alerts.length > 0 ? `${alerts.length}` : undefined}
            actions={
              <Link href="/alerts" className="text-xs text-accent hover:underline">
                View all
              </Link>
            }
            flush
            className="lg:col-span-4"
          >
            {alerts.length === 0 ? (
              <Empty>No open alerts</Empty>
            ) : (
              <ul>
                {alerts.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelectedAlert(a)}
                      className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 text-left transition-colors last:border-0 hover:bg-raised"
                    >
                      <span className="truncate text-[13px] text-ink">{a.station}</span>
                      <span className="justify-self-end"><Badge tone={severityTone[a.severity]}>{a.severity}</Badge></span>
                      <span className="truncate text-xs text-sub">
                        <span className="font-mono">{a.code}</span> {a.message}
                      </span>
                      <span className="justify-self-end font-mono text-[11px] leading-none text-sub">{a.time}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Sensor reliability" meta="Last 7 days" flush className="self-start">
            {sensors.length === 0 ? (
              <Empty>Waiting for sensor data</Empty>
            ) : (
              <ul>
                {sensors.map((s) => (
                  <li key={s.measurement} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-4 border-b border-line px-4 py-2.5 last:border-0">
                    <span className="truncate text-[13px] text-ink">{s.label}</span>
                    <Meter pct={s.reliability_pct ?? 0} tone={healthTone(s.reliability_pct)} />
                    <span className="text-right font-mono text-[13px] tabular-nums text-ink">
                      {s.reliability_pct ?? "-"}
                      <span className="text-sub">%</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Insights" meta="Generated from live data">
            {insights.length === 0 ? (
              <p className="text-sm text-sub">Waiting for data</p>
            ) : (
              <ul className="space-y-2.5">
                {insights.map((insight, i) => (
                  <li key={i} className="flex gap-3 rounded-md border border-line bg-raised p-3 text-[13px] leading-relaxed text-ink">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                    {insight}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title="Quality pipeline" meta="How each reading is checked">
          <ol className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {pipelineStages.map((stage, i) => (
              <li key={stage.key} className="rounded-md border border-line bg-raised p-3">
                <span className="mb-2 grid h-6 w-6 place-items-center rounded-full bg-accent/15 font-mono text-[11px] text-accent">{i + 1}</span>
                <p className="text-[13px] font-medium text-ink">{stage.label}</p>
                <p className="mt-0.5 text-xs leading-snug text-sub">{stage.detail}</p>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </>
  );
}
