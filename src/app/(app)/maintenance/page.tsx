"use client";

import { Wrench } from "lucide-react";
import { PageHeader, Section, Empty, Eyebrow, card, type Tone } from "@/components/console/ui";
import { fetchMaintenance, type MaintenancePrediction, type MaintenanceReport } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const EMPTY: MaintenanceReport = { predictions: [], recommended_actions: [] };
const COLUMNS: { code: string; title: string; subtitle: string; tone: Tone; test: (p: number) => boolean }[] = [
  { code: "TIER-01", title: "Immediate Dispatch", subtitle: "Degradation ≥50%", tone: "crit", test: (p) => p >= 50 },
  { code: "TIER-02", title: "Scheduled Calibration", subtitle: "Degradation 25–49%", tone: "warn", test: (p) => p >= 25 && p < 50 },
  { code: "TIER-03", title: "Diagnostic Watch", subtitle: "Degradation 10–24%", tone: "info", test: (p) => p >= 10 && p < 25 },
  { code: "TIER-04", title: "Nominal Operation", subtitle: "Degradation <10%", tone: "ok", test: (p) => p < 10 },
];
const dot: Record<Tone, string> = {
  crit: "bg-crit",
  warn: "bg-warn",
  info: "bg-accent",
  ok: "bg-ok",
  neutral: "bg-sub",
};
const topBorder: Record<Tone, string> = {
  crit: "border-t-2 border-t-crit",
  warn: "border-t-2 border-t-warn",
  info: "border-t-2 border-t-accent",
  ok: "border-t-2 border-t-ok",
  neutral: "border-t-2 border-t-line",
};
const PER_COLUMN = 40;

function JobCard({ m, tone }: { m: MaintenancePrediction; tone: Tone }) {
  return (
    <li className="rounded border border-line bg-surface p-3 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-ink" title={m.name}>
          {m.name}
        </span>
        <span className="font-mono text-xs font-bold tabular-nums text-ink">{m.pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-xs bg-raised">
        <div className={`h-full rounded-xs ${dot[tone]}`} style={{ width: `${Math.max(3, m.pct)}%` }} />
      </div>
      <p className="mt-2 truncate font-mono text-[11px] text-sub" title={m.note}>
        {m.note}
      </p>
    </li>
  );
}

export default function MaintenancePage() {
  const { predictions, recommended_actions } = useLiveData(fetchMaintenance, EMPTY);
  const first = predictions.slice(0, 3);
  const urgentCount = predictions.filter((p) => p.pct >= 50).length;
  const scheduledCount = predictions.filter((p) => p.pct >= 25 && p.pct < 50).length;

  return (
    <>
      <PageHeader
        code="SYS-MNT-07 // PREDICTIVE FIELD ENGINEERING & CALIBRATION DISPATCH"
        title="Field Maintenance & Calibration Dispatch"
        description="Stations prioritized for regional instrument division dispatch based on 7-day WMO quality check trigger rates and telemetry dropout frequency."
      />

      {predictions.length === 0 ? (
        <div className={card}>
          <Empty>Awaiting 7-day station maintenance scoring</Empty>
        </div>
      ) : (
        <div className="space-y-5">
          <Section
            title="Priority Field Dispatch Directive"
            meta={`${urgentCount} IMMEDIATE · ${scheduledCount} SCHEDULED`}
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
              <div className="min-w-0">
                <Eyebrow>HIGHEST PRIORITY DISPATCH SEQUENCE</Eyebrow>
                <p className="mt-1.5 text-2xl font-bold leading-snug tracking-tight text-ink">
                  {first.map((p) => p.name).join(" → ")}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-sub">
                  Top {first.length} stations exhibiting elevated 7-day QC rule trigger density or persistent sensor drift.{" "}
                  <strong className="font-mono text-ink">{urgentCount}</strong> stations require immediate field inspection
                  and <strong className="font-mono text-ink">{scheduledCount}</strong> are queued for scheduled remote or
                  on-site recalibration.
                </p>
              </div>

              <div>
                <Eyebrow>RECOMMENDED ENGINEERING WORK ORDERS</Eyebrow>
                <ol className="mt-2 space-y-2">
                  {recommended_actions.slice(0, 3).map((a, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded border border-line bg-raised/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink"
                    >
                      <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                      <span>{a}</span>
                    </li>
                  ))}
                  {recommended_actions.length === 0 && (
                    <li className="text-xs text-sub">No active engineering work orders generated.</li>
                  )}
                </ol>
              </div>
            </div>
          </Section>

          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((c) => {
              const items = predictions.filter((p) => c.test(p.pct));
              return (
                <section key={c.title} className={`${card} ${topBorder[c.tone]} flex flex-col overflow-hidden bg-raised/40`}>
                  <div className="flex items-center justify-between border-b border-line bg-surface px-3.5 py-2.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${dot[c.tone]}`} />
                        <h2 className="text-xs font-bold uppercase tracking-wide text-ink">{c.title}</h2>
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-sub">{c.subtitle}</p>
                    </div>
                    <span className="rounded border border-line bg-raised px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-ink">
                      {items.length.toLocaleString()}
                    </span>
                  </div>

                  <div className="p-2.5">
                    {items.length === 0 ? (
                      <p className="px-2 py-6 text-center font-mono text-xs uppercase tracking-wider text-sub">
                        0 Stations in Tier
                      </p>
                    ) : (
                      <ul className="max-h-[560px] space-y-2 overflow-y-auto pr-0.5">
                        {items.slice(0, PER_COLUMN).map((m) => (
                          <JobCard key={m.station_id} m={m} tone={c.tone} />
                        ))}
                        {items.length > PER_COLUMN && (
                          <li className="px-2 py-1.5 text-center font-mono text-[11px] text-sub">
                            +{(items.length - PER_COLUMN).toLocaleString()} additional stations
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
