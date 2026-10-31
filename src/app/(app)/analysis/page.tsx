"use client";

import { useState } from "react";
import { StationPicker } from "@/components/console/StationPicker";
import { PageHeader, Section, Badge, Empty, card, table, severityTone, type Tone } from "@/components/console/ui";
import { CountBars, chartColors } from "@/components/console/TrendChart";
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

const toneHex: Record<Tone, string> = { ok: chartColors.ok, warn: chartColors.warn, crit: chartColors.crit, info: chartColors.accent, neutral: "#9aa6bd" };

/** Donut of classification counts, coloured by what each class means. */
function Donut({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((n, [, v]) => n + v, 0);
  if (!total) return <Empty>No anomalies in this window</Empty>;
  const r = 60, c = 2 * Math.PI * r;
  // Running start of each segment along the circle.
  const starts = entries.map((_, i) => entries.slice(0, i).reduce((n, [, v]) => n + (v / total) * c, 0));
  return (
    <div className="flex flex-wrap items-center gap-8">
      <div className="relative h-40 w-40 shrink-0">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="80" cy="80" r={r} fill="none" stroke="var(--c-raised)" strokeWidth="18" />
          {entries.map(([k, v], i) => (
            <circle key={k} cx="80" cy="80" r={r} fill="none" stroke={toneHex[classificationTone[k] ?? "info"]} strokeWidth="18" strokeDasharray={`${Math.max(0, (v / total) * c - 2)} ${c}`} strokeDashoffset={-starts[i]} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-light tracking-tight text-ink">{total.toLocaleString()}</span>
          <span className="text-[11px] text-sub">anomalies</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {entries.map(([k, v]) => (
          <li key={k} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: toneHex[classificationTone[k] ?? "info"] }} />
            <span className="min-w-0 flex-1 truncate text-ink">{pretty(k)}</span>
            <span className="font-mono text-xs text-sub">{Math.round((100 * v) / total)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal leaderboard of rule trigger counts. */
function Leaderboard({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <Empty>No rule checks fired in this window</Empty>;
  return (
    <ul className="space-y-3">
      {entries.map(([k, v]) => (
        <li key={k} className="grid grid-cols-[minmax(0,180px)_1fr_3.5rem] items-center gap-3">
          <span className="truncate font-mono text-xs text-ink" title={k}>{k}</span>
          <span className="h-4 overflow-hidden rounded-md bg-raised">
            <span className="meter-fill block h-full rounded-md bg-accent" style={{ width: `${(100 * v) / max}%` }} />
          </span>
          <span className="text-right font-mono text-xs text-sub">{v.toLocaleString()}</span>
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


  return (
    <>
      <PageHeader
        title="Analysis"
        description={`Anomaly classification and rule activity over the last ${analytics.window_hours} hours.`}
        actions={
          <StationPicker stations={stations} value={stationId} onChange={setStationId} allowAll />
        }
      />

      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <section className={`${card} p-6`}>
            <h2 className="mb-5 text-[15px] font-semibold text-ink">What anomalies turned out to be</h2>
            <Donut counts={analytics.classification_counts} />
            <p className="mt-5 text-xs text-sub">
              Average fault score {analytics.average_fault_score?.toFixed(2) ?? "–"} · confidence {analytics.average_confidence?.toFixed(2) ?? "–"} (heuristic, not calibrated)
            </p>
          </section>
          <section className={`${card} p-6`}>
            <div className="mb-5 flex items-baseline gap-3">
              <h2 className="text-[15px] font-semibold text-ink">Which checks fire most</h2>
              <span className="ml-auto text-xs text-sub">triggers · {analytics.window_hours} h</span>
            </div>
            <Leaderboard counts={analytics.rule_trigger_counts} />
          </section>
        </div>

        <Section
          title="When anomalies happen"
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
