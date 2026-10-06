"use client";

import { useState } from "react";
import AlertDetailModal from "@/components/AlertDetailModal";
import { PageHeader, Badge, Empty, button, field, table, severityTone } from "@/components/console/ui";
import type { Alert } from "@/lib/mock-data";
import { fetchAlerts } from "@/lib/api";
import { useLiveDataWs } from "@/lib/useLiveData";

const emptyFilters = { time: "", station: "", code: "", message: "", confidence: "", severity: "" };
const textColumns = [
  { key: "time", label: "Reading time" },
  { key: "station", label: "Station" },
  { key: "code", label: "Reason code" },
  { key: "message", label: "Message" },
] as const;

export default function AlertsPage() {
  const alerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const filtered = alerts.filter(
    (alert) =>
      textColumns.every(({ key }) => alert[key].toLowerCase().includes(filters[key].trim().toLowerCase())) &&
      (filters.confidence === "" || alert.confidence >= Number(filters.confidence)) &&
      (filters.severity === "" || alert.severity === filters.severity)
  );
  const hasFilters = Object.values(filters).some((value) => value !== "");
  const set = (key: keyof typeof emptyFilters) => (e: { target: { value: string } }) =>
    setFilters({ ...filters, [key]: e.target.value });

  return (
    <>
      <AlertDetailModal key={selectedAlert?.id} alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      <PageHeader
        title="Alerts"
        description="Latest 50 alerts raised by the quality policies. Select a row to review it."
        actions={
          <>
            <span role="status" className="font-mono text-xs text-sub">
              {filtered.length}/{alerts.length}
            </span>
            <button type="button" disabled={!hasFilters} onClick={() => setFilters(emptyFilters)} className={button}>
              Clear filters
            </button>
          </>
        }
      />

      <div className="rounded-md border border-line bg-surface">
        <div className="sticky top-[89px] z-10 grid grid-cols-2 gap-2 rounded-t-md border-b border-line bg-surface p-3 md:grid-cols-6">
          {textColumns.map(({ key, label }) => (
            <input
              key={key}
              type="search"
              aria-label={`Filter by ${label.toLowerCase()}`}
              placeholder={label}
              value={filters[key]}
              onChange={set(key)}
              className={field}
            />
          ))}
          <input
            type="number"
            min={0}
            max={100}
            aria-label="Minimum confidence percent"
            placeholder="Min confidence %"
            value={filters.confidence}
            onChange={set("confidence")}
            className={field}
          />
          <select aria-label="Filter by severity" value={filters.severity} onChange={set("severity")} className={field}>
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.head}>
              <tr>
                <th className={table.th}>Severity</th>
                <th className={table.th}>Station</th>
                <th className={table.th}>Reason code</th>
                <th className={table.th}>Message</th>
                <th className={table.thNum}>Confidence</th>
                <th className={table.th}>Reading time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <Empty>
                      {alerts.length > 0 ? "No alerts match these filters." : "No alerts in this view. This does not confirm station health."}
                    </Empty>
                  </td>
                </tr>
              )}
              {filtered.map((a) => (
                <tr key={a.id} onClick={() => setSelectedAlert(a)} className={`${table.row} cursor-pointer`}>
                  <td className={table.td}>
                    <Badge tone={severityTone[a.severity]}>{a.severity}</Badge>
                  </td>
                  <td className={`${table.td} font-medium text-ink whitespace-nowrap`}>{a.station}</td>
                  <td className={`${table.td} font-mono text-xs`}>
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-label={`Review alert ${a.code} for ${a.station}`}
                      className="text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                    >
                      {a.code}
                    </button>
                  </td>
                  <td className={`${table.td} max-w-md text-sub`}>{a.message}</td>
                  <td className={table.num}>{a.confidence}%</td>
                  <td className={`${table.td} font-mono text-xs text-sub whitespace-nowrap`}>{a.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
