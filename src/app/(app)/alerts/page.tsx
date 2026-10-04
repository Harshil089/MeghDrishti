"use client";

import Topbar from "@/components/Topbar";
import Reveal from "@/components/Reveal";
import AlertDetailModal from "@/components/AlertDetailModal";
import { useState } from "react";
import type { Alert } from "@/lib/mock-data";
import { fetchAlerts } from "@/lib/api";
import { useLiveDataWs } from "@/lib/useLiveData";

const severityStyle: Record<string, string> = {
  critical: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  warning: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  info: "bg-cyan-400/10 text-cyan-300 border-cyan-400/30",
};

const emptyFilters = { time: "", station: "", code: "", message: "", confidence: "", severity: "" };
const textColumns = [
  { key: "time", label: "Reading time" },
  { key: "station", label: "Station" },
  { key: "code", label: "Reason code" },
  { key: "message", label: "Message" },
] as const;
const filterStyle = "w-full min-w-28 rounded-md border border-border bg-panel px-2 py-1.5 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-cyan-500";

export default function AlertsPage() {
  const alerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const filteredAlerts = alerts.filter((alert) =>
    textColumns.every(({ key }) => alert[key].toLowerCase().includes(filters[key].trim().toLowerCase()))
    && (filters.confidence === "" || alert.confidence >= Number(filters.confidence))
    && (filters.severity === "" || alert.severity === filters.severity)
  );
  const hasFilters = Object.values(filters).some((value) => value !== "");
  return (
    <>
      <Topbar title="Alerts" />
      <AlertDetailModal
        key={selectedAlert?.id}
        alert={selectedAlert}
        onClose={() => setSelectedAlert(null)}
      />
      <main className="flex-1 p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted">
          <p role="status">{filteredAlerts.length} of {alerts.length} loaded alerts · latest 50</p>
          <button type="button" disabled={!hasFilters} onClick={() => setFilters(emptyFilters)} className="rounded-md border border-border px-3 py-1.5 hover:text-foreground disabled:opacity-40">Clear filters</button>
        </div>
        <Reveal className="glass rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="px-4 py-3 font-medium">Reading time</th>
                <th className="px-4 py-3 font-medium">Station</th>
                <th className="px-4 py-3 font-medium">Reason code</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Severity</th>
              </tr>
              <tr className="border-b border-border">
                {textColumns.map(({ key, label }) => (
                  <td key={key} className="px-4 py-2">
                    <input type="search" aria-label={`Filter ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}`} value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })} className={filterStyle} />
                  </td>
                ))}
                <td className="px-4 py-2">
                  <input type="number" min={0} max={100} aria-label="Minimum confidence percent" placeholder="Min %" value={filters.confidence} onChange={(event) => setFilters({ ...filters, confidence: event.target.value })} className={filterStyle} />
                </td>
                <td className="px-4 py-2">
                  <select aria-label="Filter severity" value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value })} className={filterStyle}>
                    <option value="">All severities</option>
                    <option value="critical">Critical</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                </td>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted">
                    {alerts.length > 0 ? "No alerts match these filters." : "No alerts in this view. This does not confirm station health."}
                  </td>
                </tr>
              )}
              {filteredAlerts.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelectedAlert(a)}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-white/[0.04] focus-within:bg-white/[0.04]"
                >
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{a.time}</td>
                  <td className="px-4 py-3 font-medium">{a.station}</td>
                  <td className="px-4 py-3 text-cyan-300 font-mono text-xs">
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-label={`View alert ${a.code} for ${a.station}`}
                      className="text-left hover:underline focus-visible:outline-2 focus-visible:outline-cyan-500 focus-visible:outline-offset-4"
                    >
                      {a.code}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted max-w-sm">{a.message}</td>
                  <td className="px-4 py-3 text-muted">{a.confidence}%</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${severityStyle[a.severity]}`}>
                      {a.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </main>
    </>
  );
}
