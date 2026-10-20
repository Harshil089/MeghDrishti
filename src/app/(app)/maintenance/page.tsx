"use client";

import { PageHeader, Section, Badge, Empty, Metric, MetricStrip, riskTone, type Tone } from "@/components/console/ui";
import { RankBars } from "@/components/console/TrendChart";
import { fetchMaintenance, type MaintenanceReport } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const EMPTY: MaintenanceReport = { predictions: [], recommended_actions: [] };
const levelLabel: Record<Tone, string> = { ok: "Low", warn: "Medium", crit: "High", info: "", neutral: "" };

export default function MaintenancePage() {
  const { predictions, recommended_actions } = useLiveData(fetchMaintenance, EMPTY);

  const high = predictions.filter((p) => p.pct >= 50).length;
  const avg = predictions.length ? Math.round(predictions.reduce((n, p) => n + p.pct, 0) / predictions.length) : null;
  const top = predictions[0];

  return (
    <>
      <PageHeader title="Maintenance" description="Stations ranked by maintenance need, last 7 days." />

      {predictions.length === 0 ? (
        <div className="rounded-lg border border-line c-card">
          <Empty>No station health data yet</Empty>
        </div>
      ) : (
        <div className="space-y-4">
          <MetricStrip>
            <Metric label="Stations tracked" value={predictions.length} foot="With health data" />
            <Metric label="High need" value={high} tone={high ? "crit" : "ok"} foot="50% or more" />
            <Metric label="Average need" value={avg ?? "-"} unit="%" tone={avg === null ? "neutral" : riskTone(avg)} foot="Across stations" />
            <Metric label="Top priority" value={top?.station_code ?? "-"} foot={top ? `${top.pct}% need` : undefined} />
          </MetricStrip>

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-8">
              <Section title="Need by station" meta="Worst first">
                <RankBars data={predictions.map((p) => ({ name: p.station_code, value: p.pct }))} />
              </Section>

              <Section title="Priority list" flush>
                <ul>
                  {predictions.map((m, i) => {
                    const tone = riskTone(m.pct);
                    return (
                      <li
                        key={m.station_id}
                        className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 last:border-0 transition-colors hover:bg-raised"
                      >
                        <span className="font-mono text-xs text-sub">{String(i + 1).padStart(2, "0")}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink">{m.name}</span>
                          <span className="block truncate font-mono text-[11px] text-sub">{m.station_code}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <Badge tone={tone}>{levelLabel[tone]}</Badge>
                          <span className="w-10 text-right font-mono text-sm tabular-nums text-ink">{m.pct}%</span>
                        </span>
                        <span className="col-start-2 col-span-2 truncate text-xs text-sub">{m.note}</span>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            </div>

            <Section title="Action queue" meta={recommended_actions.length ? `${recommended_actions.length}` : undefined} className="lg:col-span-4 self-start">
              {recommended_actions.length === 0 ? (
                <p className="text-sm text-sub">No actions needed. Fleet is healthy.</p>
              ) : (
                <ol className="space-y-2.5">
                  {recommended_actions.map((a, i) => (
                    <li key={i} className="grid grid-cols-[1.75rem_1fr] items-start gap-3 rounded-md border border-line bg-raised p-3 text-[13px] leading-relaxed text-ink">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 font-mono text-[11px] text-accent">
                        {i + 1}
                      </span>
                      {a}
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </div>
        </div>
      )}
    </>
  );
}
