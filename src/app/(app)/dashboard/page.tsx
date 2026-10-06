"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import AlertDetailModal from "@/components/AlertDetailModal";
import { PageHeader, Section, Metric, MetricStrip, Badge, Meter, Empty, healthTone, severityTone, type Tone } from "@/components/console/ui";
import { TrendChart } from "@/components/console/TrendChart";
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

const statTone: Record<DashboardStat["tone"], Tone> = { emerald: "ok", rose: "crit", cyan: "info", amber: "warn" };

export default function DashboardPage() {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
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
            <div className="grid gap-px bg-line md:grid-cols-3 rounded-b-md overflow-hidden">
              <TrendChart label="Temperature" unit="°C" current={fleet.temperature_c.at(-1)?.value} data={fleet.temperature_c} />
              <TrendChart label="Pressure" unit="hPa" current={fleet.pressure_hpa.at(-1)?.value} data={fleet.pressure_hpa} />
              <TrendChart label="Humidity" unit="%" current={fleet.humidity_pct.at(-1)?.value} data={fleet.humidity_pct} />
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
                      className="grid w-full grid-cols-[1fr_auto] items-start gap-x-3 border-b border-line px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-raised"
                    >
                      <span className="truncate text-[13px] text-ink">{a.station}</span>
                      <Badge tone={severityTone[a.severity]}>{a.severity}</Badge>
                      <span className="truncate text-xs text-sub">
                        <span className="font-mono">{a.code}</span> {a.message}
                      </span>
                      <span className="font-mono text-[11px] text-sub">{a.time}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Sensor reliability" meta="Last 7 days" flush>
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
              <ul className="space-y-3">
                {insights.map((insight, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-ink">
                    {insight}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title="Quality pipeline" meta="How each reading is checked">
          <ol className="flex flex-wrap items-center gap-y-2">
            {pipelineStages.map((stage, i) => (
              <li key={stage.key} className="flex items-center">
                <span title={stage.detail} className="rounded-md border border-line bg-raised px-2.5 py-1 text-xs text-ink cursor-help">
                  {stage.label}
                </span>
                {i < pipelineStages.length - 1 && <ChevronRight className="mx-1 h-3.5 w-3.5 text-sub" aria-hidden />}
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </>
  );
}
