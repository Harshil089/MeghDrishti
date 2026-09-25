"use client";

import { useState } from "react";
import Topbar from "@/components/Topbar";
import StatCard from "@/components/StatCard";
import SensorChart from "@/components/SensorChart";
import AtmosphereCanvas from "@/components/AtmosphereCanvas";
import StatsFieldCanvas from "@/components/StatsFieldCanvas";
import AlertPulseCanvas from "@/components/AlertPulseCanvas";
import AlertDetailModal from "@/components/AlertDetailModal";
import Logo from "@/components/Logo";
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
import { AlertTriangle, Sparkles, HeartPulse, ArrowRight } from "lucide-react";

const severityDot: Record<string, string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-400",
  info: "bg-cyan-400",
};

const EMPTY_FLEET_SERIES = { temperature_c: [], humidity_pct: [], pressure_hpa: [] };

export default function DashboardPage() {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const alerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts");
  const statCards = useLiveDataWs(fetchDashboardStats, [] as DashboardStat[], "/ws/dashboard");
  const fleetSeries = useLiveData(fetchFleetSeries, EMPTY_FLEET_SERIES, 30000);
  const insights = useLiveDataWs(fetchInsights, [] as string[], "/ws/dashboard");
  const sensorHealth = useLiveData(fetchSensorHealth, [] as SensorHealth[], 30000);

  const latestTemp = fleetSeries.temperature_c.at(-1)?.value ?? null;
  const latestPressure = fleetSeries.pressure_hpa.at(-1)?.value ?? null;
  const latestHumidity = fleetSeries.humidity_pct.at(-1)?.value ?? null;

  return (
    <>
      <Topbar title="Dashboard" />
      <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* About us / hero */}
        <section className="relative overflow-hidden rounded-2xl border border-border glass p-6 md:p-8">
          <AtmosphereCanvas />
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Logo size={40} />
              <p className="text-xs uppercase tracking-widest text-cyan-300/80">About MeghDrishti</p>
            </div>
            <h2 className="text-xl md:text-2xl font-semibold leading-snug mb-3">
              A software-only weather-station quality platform that separates genuine
              extremes from sensor and telemetry faults.
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              Hybrid rule checks, drift and dropout detection, and Isolation Forest are
              validated against nearby stations, forecasts, ERA5 and GPM rainfall context —
              then surfaced with confidence scores and reason codes an operator can trust.
            </p>
          </div>

          {/* pipeline strip */}
          <div className="relative z-10 mt-6 flex flex-wrap gap-2">
            {pipelineStages.map((stage, i) => (
              <div key={stage.key} className="flex items-center gap-2">
                <div className="group relative rounded-lg border border-border bg-panel-2/80 px-3 py-2 text-xs">
                  <span className="text-foreground/90 font-medium">{stage.label}</span>
                  <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-lg border border-border bg-panel-2 p-2 text-[11px] text-muted shadow-xl group-hover:block">
                    {stage.detail}
                  </div>
                </div>
                {i < pipelineStages.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted/50" />}
              </div>
            ))}
          </div>
        </section>

        {/* stat cards */}
        <section className="relative">
          <StatsFieldCanvas />
          <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="glass rounded-xl p-4 h-[92px] animate-pulse" />
                ))
              : statCards.map((c) => <StatCard key={c.label} {...c} />)}
          </div>
        </section>

        {/* live sensor data */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground/90">Fleet Average Readings</h3>
            <span className="text-[11px] text-muted flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
              live · hourly average across active stations
            </span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <SensorChart title="Temperature" unit="°C" current={latestTemp ?? 0} range="fleet hourly avg" data={fleetSeries.temperature_c} color="#22d3ee" />
            <SensorChart title="Pressure" unit="hPa" current={latestPressure ?? 0} range="fleet hourly avg" data={fleetSeries.pressure_hpa} color="#f97316" />
            <SensorChart title="Humidity" unit="%" current={latestHumidity ?? 0} range="fleet hourly avg" data={fleetSeries.humidity_pct} color="#34d399" />
          </div>
        </section>

        {/* bottom row */}
        <section className="grid lg:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <h3 className="text-sm font-semibold">Recent Alerts</h3>
              <AlertPulseCanvas size={20} />
            </div>
            <ul className="space-y-1">
              {alerts.length === 0 && <li className="text-xs text-muted px-1.5 py-1">No open alerts.</li>}
              {alerts.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => setSelectedAlert(a)}
                    className="w-full flex items-start gap-2.5 text-xs text-left rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-white/[0.04] transition-colors"
                  >
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${severityDot[a.severity]}`} />
                    <div className="min-w-0">
                      <p className="text-foreground/90 truncate">
                        <span className="text-muted">{a.time}</span> · {a.station} — {a.code}
                      </p>
                      <p className="text-muted truncate">{a.message}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-semibold">Insights</h3>
            </div>
            <ul className="space-y-2.5">
              {insights.length === 0 && <li className="text-xs text-muted">Connecting…</li>}
              {insights.map((insight, i) => (
                <li key={i} className="text-xs text-muted leading-relaxed pl-3 border-l border-cyan-400/30">
                  {insight}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold">Sensor Health</h3>
            </div>
            <ul className="space-y-3">
              {sensorHealth.length === 0 && <li className="text-xs text-muted">Connecting…</li>}
              {sensorHealth.map((s) => (
                <li key={s.measurement}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted">{s.label}</span>
                    <span className="text-foreground/80 font-mono">{s.reliability_pct ?? "—"}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                      style={{ width: `${s.reliability_pct ?? 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
