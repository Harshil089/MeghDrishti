"use client";

import { useState } from "react";
import { StationPicker } from "@/components/console/StationPicker";
import { PageHeader, Section, Metric, MetricStrip, Badge, Empty, table, severityTone, type Tone } from "@/components/console/ui";
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

const reasonList = (codes: string[]) => codes.filter((c) => c !== "INSUFFICIENT_CONTEXT").join(", ") || "-";
const pretty = (key: string) => key.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const toneHex: Record<Tone, string> = {
  ok: chartColors.ok,
  warn: chartColors.warn,
  crit: chartColors.crit,
  info: chartColors.accent,
  neutral: "#94a3b8",
};

function Donut({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((n, [, v]) => n + v, 0);
  if (!total) return <Empty>No evaluated observations in window</Empty>;
  const r = 56,
    c = 2 * Math.PI * r;
  const starts = entries.map((_, i) => entries.slice(0, i).reduce((n, [, v]) => n + (v / total) * c, 0));
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--c-raised)" strokeWidth="16" />
          {entries.map(([k, v], i) => (
            <circle
              key={k}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={toneHex[classificationTone[k] ?? "info"]}
              strokeWidth="16"
              strokeDasharray={`${Math.max(0, (v / total) * c - 2)} ${c}`}
              strokeDashoffset={-starts[i]}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-bold tabular-nums tracking-tight text-ink">
            {total.toLocaleString()}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-sub">RECORDS</span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 divide-y divide-line/70 text-xs">
        {entries.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between gap-2 py-1.5">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-xs"
                style={{ background: toneHex[classificationTone[k] ?? "info"] }}
              />
              <span className="truncate font-medium text-ink">{pretty(k)}</span>
            </span>
            <span className="font-mono tabular-nums text-sub">
              <strong className="text-ink">{v.toLocaleString()}</strong> ({Math.round((100 * v) / total)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Leaderboard({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <Empty>No deterministic rule checks triggered in window</Empty>;
  return (
    <ul className="space-y-2.5">
      {entries.map(([k, v]) => (
        <li key={k} className="grid grid-cols-[minmax(0,175px)_1fr_4.5rem] items-center gap-3">
          <span className="truncate font-mono text-xs font-medium text-ink" title={k}>
            {k}
          </span>
          <span className="h-3.5 overflow-hidden rounded-xs bg-raised">
            <span className="meter-fill block h-full rounded-xs bg-accent" style={{ width: `${(100 * v) / max}%` }} />
          </span>
          <span className="text-right font-mono text-xs font-semibold tabular-nums text-ink">{v.toLocaleString()}</span>
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
    new Date(h).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

  const totalEvaluated = Object.values(analytics.classification_counts).reduce((a, b) => a + b, 0);
  const topRule = Object.entries(analytics.rule_trigger_counts).sort((a, b) => b[1] - a[1])[0];

  return (
    <>
      <PageHeader
        code="SYS-ANL-04 // ENSEMBLE QC & DETERMINISTIC RULE ANALYTICS"
        title="Quality Control & Anomaly Analytics"
        description={`Statistical breakdown of ensemble classifications, deterministic WMO rule trigger frequencies, and hourly fault incidence over the last ${analytics.window_hours} hours.`}
        actions={<StationPicker stations={stations} value={stationId} onChange={setStationId} allowAll />}
      />

      <div className="space-y-5">
        <MetricStrip cols={4}>
          <Metric
            label="Evaluated Packets (24h)"
            value={totalEvaluated.toLocaleString()}
            unit="records"
            tone="info"
            foot="Processed through 6-stage QC pipeline"
          />
          <Metric
            label="Mean Ensemble Fault Score"
            value={analytics.average_fault_score?.toFixed(2) ?? "–"}
            unit="/ 1.00"
            tone="neutral"
            foot="Weighted rule + ML + spatial score"
          />
          <Metric
            label="Mean Heuristic Confidence"
            value={analytics.average_confidence?.toFixed(2) ?? "–"}
            unit="/ 1.00"
            tone="ok"
            foot="Evidence agreement index"
          />
          <Metric
            label="Primary Rule Trigger"
            value={topRule ? topRule[1].toLocaleString() : "0"}
            unit="flags"
            tone="warn"
            foot={topRule ? `Rule: ${topRule[0]}` : "No rule triggers"}
          />
        </MetricStrip>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
          <Section title="Ensemble Verdict Classification Breakdown" meta={`${analytics.window_hours}H WINDOW`}>
            <Donut counts={analytics.classification_counts} />
            <p className="mt-4 border-t border-line pt-3 font-mono text-[11px] text-sub">
              FAULT SCORE MEAN: {analytics.average_fault_score?.toFixed(2) ?? "–"} · HEURISTIC CONFIDENCE:{" "}
              {analytics.average_confidence?.toFixed(2) ?? "–"}
            </p>
          </Section>

          <Section title="Deterministic WMO Rule Trigger Frequency" meta={`TOP TRIGGERS · ${analytics.window_hours}H`}>
            <Leaderboard counts={analytics.rule_trigger_counts} />
          </Section>
        </div>

        <Section
          title="Hourly Anomaly Incidence Histogram"
          meta={hour ? `INSPECTING BUCKET: ${hourLabel(hour)}` : "SELECT ANY HOURLY BAR TO INSPECT STATION PACKETS"}
          actions={
            hour && (
              <button
                onClick={() => setHour(null)}
                className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent hover:underline"
              >
                Clear Selection
              </button>
            )
          }
          flush
        >
          <div className="h-52 px-4 pt-4 pb-2">
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
                    <th className={table.th}>Timestamp</th>
                    <th className={table.th}>AWS Station</th>
                    <th className={table.th}>Parameter</th>
                    <th className={table.th}>Ensemble Classification</th>
                    <th className={table.th}>Severity</th>
                    <th className={table.thNum}>Fault Score</th>
                    <th className={table.th}>Triggered Reason Codes</th>
                  </tr>
                </thead>
                <tbody>
                  {hourAnomalies.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <Empty>Loading anomalies for selected hourly bucket…</Empty>
                      </td>
                    </tr>
                  )}
                  {hourAnomalies.map((a) => (
                    <tr key={a.id} className={table.row}>
                      <td className={`${table.td} font-mono text-xs text-ink whitespace-nowrap`}>
                        {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </td>
                      <td className={`${table.td} font-medium text-ink whitespace-nowrap`}>{stationLabel(a.station_id)}</td>
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

        <Section
          title="Station-Specific Anomaly Ledger"
          meta={
            stationId
              ? "LATEST 15 EVALUATIONS FOR SELECTED STATION"
              : "SELECT A SPECIFIC AWS STATION IN THE TOOLBAR ABOVE TO LIST ITS ANOMALY LEDGER"
          }
          flush
        >
          {!stationId ? (
            <Empty>Select an individual AWS station above to inspect its anomaly ledger.</Empty>
          ) : (
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Timestamp</th>
                    <th className={table.th}>Ensemble Classification</th>
                    <th className={table.th}>Severity</th>
                    <th className={table.thNum}>Fault Score</th>
                    <th className={table.thNum}>Confidence</th>
                    <th className={table.th}>Reason Codes</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <Empty>No anomalies recorded for this station in current window.</Empty>
                      </td>
                    </tr>
                  )}
                  {anomalies.map((a) => (
                    <tr key={a.id} className={table.row}>
                      <td className={`${table.td} font-mono text-xs text-ink whitespace-nowrap`}>
                        {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </td>
                      <td className={`${table.td} font-medium text-ink`}>{pretty(a.classification)}</td>
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
