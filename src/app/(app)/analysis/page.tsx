"use client";

import { useState } from "react";
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import Topbar from "@/components/Topbar";
import { fetchAnomalyAnalytics, fetchStationAnomalies, fetchStationOptions } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { BarChart3 } from "lucide-react";

const classificationTone: Record<string, string> = {
  NORMAL: "from-emerald-400 to-emerald-500",
  WATCH: "from-cyan-400 to-cyan-500",
  SUSPICIOUS: "from-amber-400 to-amber-500",
  PROBABLE_SENSOR_FAULT: "from-rose-400 to-rose-500",
  LIKELY_GENUINE_EXTREME: "from-purple-400 to-purple-500",
  INSUFFICIENT_CONTEXT: "from-slate-400 to-slate-500",
};

const severityStyle: Record<string, string> = {
  CRITICAL: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  HIGH: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  MEDIUM: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  LOW: "bg-cyan-400/10 text-cyan-300 border-cyan-400/30",
};

function Bars({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (entries.length === 0) return <p className="text-xs text-muted">No data in this window.</p>;
  return (
    <ul className="space-y-3">
      {entries.map(([key, value]) => (
        <li key={key}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-foreground/80">{key}</span>
            <span className="text-muted">{value}</span>
          </div>
          <div className="h-2 rounded-full bg-panel-2 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${classificationTone[key] ?? "from-cyan-400 to-emerald-400"}`}
              style={{ width: `${(100 * value) / max}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AnalysisPage() {
  const stations = useLiveData(fetchStationOptions, []);
  const [stationId, setStationId] = useState<string>("");
  const activeId = stationId || "";

  const analytics = useLiveData(
    () => fetchAnomalyAnalytics(activeId || undefined),
    {
      window_hours: 24,
      classification_counts: {},
      rule_trigger_counts: {},
      hourly_series: [],
      average_fault_score: null,
      average_confidence: null,
    },
    15000,
    [activeId]
  );

  const anomalies = useLiveData(
    () => (activeId ? fetchStationAnomalies(activeId, 15) : Promise.resolve([])),
    [],
    15000,
    [activeId]
  );

  return (
    <>
      <Topbar title="Analysis" />
      <main className="flex-1 p-4 md:p-6 space-y-4">
        <div className="glass rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-cyan-300" />
            <h3 className="text-sm font-semibold">Anomaly analysis — last {analytics.window_hours}h</h3>
          </div>
          <select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            className="bg-panel-2 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground/90"
          >
            <option value="">All stations</option>
            {stations.map((s) => (
              <option key={s.dbId} value={s.dbId}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass rounded-xl p-5">
            <h4 className="text-sm font-semibold mb-4">Classification breakdown</h4>
            <Bars counts={analytics.classification_counts} />
          </div>
          <div className="glass rounded-xl p-5">
            <h4 className="text-sm font-semibold mb-4">Rule checks triggered</h4>
            <Bars counts={analytics.rule_trigger_counts} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Average fault score</p>
            <p className="text-2xl font-semibold text-rose-400">
              {analytics.average_fault_score !== null ? analytics.average_fault_score.toFixed(2) : "—"}
            </p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-muted mb-1">Average confidence</p>
            <p className="text-2xl font-semibold text-emerald-400">
              {analytics.average_confidence !== null ? analytics.average_confidence.toFixed(2) : "—"}
            </p>
          </div>
          <div className="glass rounded-xl p-4 flex flex-col">
            <p className="text-xs text-muted mb-1">Anomalies per hour</p>
            <div className="h-14 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.hourly_series}>
                  <XAxis dataKey="hour" hide />
                  <Tooltip
                    contentStyle={{ background: "#0b1220", border: "1px solid #1c2740", borderRadius: 8, fontSize: 11 }}
                    labelFormatter={(v) => new Date(v as string).toLocaleTimeString([], { hour: "2-digit" })}
                  />
                  <Bar dataKey="count" fill="#22d3ee" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {activeId && (
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Classification</th>
                  <th className="px-4 py-3 font-medium">Fault score</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                  <th className="px-4 py-3 font-medium">Reason codes</th>
                  <th className="px-4 py-3 font-medium">Severity</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted text-xs">
                      No anomalies for this station in range.
                    </td>
                  </tr>
                )}
                {anomalies.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 text-foreground/80">
                      {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5">{a.classification}</td>
                    <td className="px-4 py-2.5">{a.fault_score.toFixed(2)}</td>
                    <td className="px-4 py-2.5">{a.confidence.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-[11px] text-muted">{a.reason_codes.join(", ") || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${severityStyle[a.severity] ?? severityStyle.LOW}`}>
                        {a.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
