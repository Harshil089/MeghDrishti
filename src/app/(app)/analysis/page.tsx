"use client";

import { useState } from "react";
import { PageHeader, Section, Metric, MetricStrip, Select, Badge, Meter, Empty, table, severityTone, type Tone } from "@/components/console/ui";
import { CountBars } from "@/components/console/TrendChart";
import { fetchAnomaliesInRange, fetchAnomalyAnalytics, fetchStationAnomalies, fetchStationOptions } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const classificationTone: Record<string, Tone> = {
  NORMAL: "ok",
  WATCH: "info",
  SUSPICIOUS: "warn",
  PROBABLE_SENSOR_FAULT: "crit",
  LIKELY_GENUINE_EXTREME: "info",
  INSUFFICIENT_CONTEXT: "neutral",
};

// Emitted on every reading that has no outside context (all-Open-Meteo data
// today). It is a data limitation, not a finding, so it is not listed per row.
const reasonList = (codes: string[]) => codes.filter((c) => c !== "INSUFFICIENT_CONTEXT").join(", ") || "-";

const pretty = (key: string) => key.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function Breakdown({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((n, [, v]) => n + v, 0);
  if (entries.length === 0) return <Empty>No data in this window</Empty>;
  return (
    <ul>
      {entries.map(([key, value]) => (
        <li key={key} className="grid grid-cols-[minmax(0,12rem)_1fr_4rem] items-center gap-4 border-b border-line px-4 py-2.5 last:border-0">
          <span className="truncate text-[13px] text-ink" title={key}>
            {pretty(key)}
          </span>
          <Meter pct={(100 * value) / Math.max(1, total)} tone={classificationTone[key] ?? "info"} />
          <span className="text-right font-mono text-[13px] tabular-nums text-ink">{value}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AnalysisPage() {
  const stations = useLiveData(fetchStationOptions, []);
  const [stationId, setStationId] = useState<string>("");

  const analytics = useLiveData(
    () => fetchAnomalyAnalytics(stationId || undefined),
    {
      window_hours: 24,
      classification_counts: {},
      rule_trigger_counts: {},
      hourly_series: [],
      average_fault_score: null,
      average_confidence: null,
    },
    15000,
    [stationId]
  );

  const anomalies = useLiveData(
    () => (stationId ? fetchStationAnomalies(stationId, 15) : Promise.resolve([])),
    [],
    15000,
    [stationId]
  );

  // Clicking a bar in "Anomalies per hour" lists that hour's anomalies.
  const [hour, setHour] = useState<string | null>(null);
  const hourAnomalies = useLiveData(
    () => {
      if (!hour) return Promise.resolve([]);
      const end = new Date(new Date(hour).getTime() + 3600_000).toISOString();
      return fetchAnomaliesInRange(new Date(hour).toISOString(), end, stationId || undefined);
    },
    [],
    60000,
    [hour, stationId]
  );
  const stationLabel = (dbId: string) => {
    const s = stations.find((x) => x.dbId === dbId);
    return s ? `${s.code} · ${s.name}` : dbId.slice(0, 8);
  };
  const hourLabel = (h: string) =>
    new Date(h).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const total = Object.values(analytics.classification_counts).reduce((n, v) => n + v, 0);

  return (
    <>
      <PageHeader
        title="Analysis"
        description={`Anomaly classification and rule activity over the last ${analytics.window_hours} hours.`}
        actions={
          <Select aria-label="Station" value={stationId} onChange={(e) => setStationId(e.target.value)}>
            <option value="">All stations</option>
            {stations.map((s) => (
              <option key={s.dbId} value={s.dbId}>
                {s.code} · {s.name}
              </option>
            ))}
          </Select>
        }
      />

      <div className="space-y-4">
        <MetricStrip cols={3}>
          <Metric label="Readings scored" value={total} />
          <Metric
            label="Average fault score"
            value={analytics.average_fault_score !== null ? analytics.average_fault_score.toFixed(2) : "-"}
            foot="0 clean, 1 certain fault"
          />
          <Metric
            label="Average confidence"
            value={analytics.average_confidence !== null ? analytics.average_confidence.toFixed(2) : "-"}
            foot="Heuristic, not calibrated"
          />
        </MetricStrip>

        <Section
          title="Anomalies per hour"
          meta={hour ? `Showing ${hourLabel(hour)}` : "Click a bar to list its anomalies"}
          actions={
            hour && (
              <button onClick={() => setHour(null)} className="text-xs text-accent hover:underline">
                Clear
              </button>
            )
          }
          flush
        >
          <div className="h-48 px-2 pt-3 pb-1">
            <CountBars
              data={analytics.hourly_series}
              xKey="hour"
              yKey="count"
              selected={hour}
              onSelect={(h) => setHour((cur) => (cur === h ? null : h))}
            />
          </div>
          {hour && (
            <div className={`${table.wrap} border-t border-line`}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Time</th>
                    <th className={table.th}>Station</th>
                    <th className={table.th}>Measurement</th>
                    <th className={table.th}>Classification</th>
                    <th className={table.th}>Severity</th>
                    <th className={table.thNum}>Fault score</th>
                    <th className={table.th}>Reason codes</th>
                  </tr>
                </thead>
                <tbody>
                  {hourAnomalies.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <Empty>Loading anomalies for this hour</Empty>
                      </td>
                    </tr>
                  )}
                  {hourAnomalies.map((a) => (
                    <tr key={a.id} className={table.row}>
                      <td className={`${table.td} font-mono text-xs text-ink whitespace-nowrap`}>
                        {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className={`${table.td} text-ink whitespace-nowrap`}>{stationLabel(a.station_id)}</td>
                      <td className={`${table.td} font-mono text-xs text-sub`}>{a.measurement ?? "-"}</td>
                      <td className={`${table.td} text-ink`}>{pretty(a.classification)}</td>
                      <td className={table.td}>
                        <Badge tone={severityTone[a.severity] ?? "info"}>{a.severity.toLowerCase()}</Badge>
                      </td>
                      <td className={table.num}>{a.fault_score.toFixed(2)}</td>
                      <td className={`${table.td} font-mono text-xs text-sub`}>{reasonList(a.reason_codes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Classification" flush>
            <Breakdown counts={analytics.classification_counts} />
          </Section>
          <Section title="Rule checks triggered" flush>
            <Breakdown counts={analytics.rule_trigger_counts} />
          </Section>
        </div>

        <Section title="Station anomalies" meta={stationId ? "Latest 15. Readings without nearby-station, forecast, ERA5 or GPM context are not marked per row." : "Pick a station to list anomalies"} flush>
          {!stationId ? (
            <Empty>Select a station above to see its individual anomalies.</Empty>
          ) : (
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Time</th>
                    <th className={table.th}>Classification</th>
                    <th className={table.th}>Severity</th>
                    <th className={table.thNum}>Fault score</th>
                    <th className={table.thNum}>Confidence</th>
                    <th className={table.th}>Reason codes</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <Empty>No anomalies for this station in range.</Empty>
                      </td>
                    </tr>
                  )}
                  {anomalies.map((a) => (
                    <tr key={a.id} className={table.row}>
                      <td className={`${table.td} font-mono text-xs text-ink whitespace-nowrap`}>
                        {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className={`${table.td} text-ink`}>{pretty(a.classification)}</td>
                      <td className={table.td}>
                        <Badge tone={severityTone[a.severity] ?? "info"}>{a.severity.toLowerCase()}</Badge>
                      </td>
                      <td className={table.num}>{a.fault_score.toFixed(2)}</td>
                      <td className={table.num}>{a.confidence.toFixed(2)}</td>
                      <td className={`${table.td} font-mono text-xs text-sub`}>{reasonList(a.reason_codes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
