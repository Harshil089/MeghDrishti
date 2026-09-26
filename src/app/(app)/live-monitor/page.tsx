"use client";

import { useState } from "react";
import Topbar from "@/components/Topbar";
import SensorChart from "@/components/SensorChart";
import Reveal from "@/components/Reveal";
import { fetchStationObservations, fetchStationOptions, seriesFromReadings } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { Activity, Radio } from "lucide-react";

export default function LiveMonitorPage() {
  const stations = useLiveData(fetchStationOptions, []);
  const [stationId, setStationId] = useState<string>("");
  const activeId = stationId || stations[0]?.dbId || "";

  const readings = useLiveData(
    () => (activeId ? fetchStationObservations(activeId, 20) : Promise.resolve([])),
    [],
    10000,
    [activeId]
  );
  const series = seriesFromReadings(readings);
  const latest = readings[0];

  return (
    <>
      <Topbar title="Live Monitor" />
      <main className="flex-1 p-4 md:p-6 space-y-4">
        <div className="glass rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-300" />
            <h3 className="text-sm font-semibold">Real-time station feed</h3>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 ml-2">
              <Radio className="h-3 w-3 animate-pulse" /> polling every 10s
            </span>
          </div>
          <select
            value={activeId}
            onChange={(e) => setStationId(e.target.value)}
            className="bg-panel-2 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground/90"
          >
            {stations.map((s) => (
              <option key={s.dbId} value={s.dbId}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>

        {!activeId ? (
          <div className="glass rounded-xl p-8 text-center text-sm text-muted">No stations available.</div>
        ) : (
          <>
            <Reveal className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SensorChart title="Temperature" unit="°C" current={latest?.temperature_c ?? 0} range="18 – 34°C" data={series.temperature} color="#22d3ee" />
              <SensorChart title="Humidity" unit="%" current={latest?.humidity_pct ?? 0} range="40 – 80%" data={series.humidity} color="#34d399" />
              <SensorChart title="Pressure" unit="hPa" current={latest?.pressure_hpa ?? 0} range="1000 – 1015 hPa" data={series.pressure} color="#fbbf24" />
            </Reveal>

            <Reveal delay={0.1} className="glass rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Temp (°C)</th>
                    <th className="px-4 py-3 font-medium">Humidity (%)</th>
                    <th className="px-4 py-3 font-medium">Pressure (hPa)</th>
                    <th className="px-4 py-3 font-medium">Rain (mm)</th>
                    <th className="px-4 py-3 font-medium">Wind (m/s)</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-muted text-xs">
                        No observations yet for this station.
                      </td>
                    </tr>
                  )}
                  {readings.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2.5 text-foreground/80">
                        {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{r.source}</td>
                      <td className="px-4 py-2.5">{r.temperature_c ?? "—"}</td>
                      <td className="px-4 py-2.5">{r.humidity_pct ?? "—"}</td>
                      <td className="px-4 py-2.5">{r.pressure_hpa ?? "—"}</td>
                      <td className="px-4 py-2.5">{r.rainfall_mm ?? "—"}</td>
                      <td className="px-4 py-2.5">{r.wind_speed_ms ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </>
        )}
      </main>
    </>
  );
}
