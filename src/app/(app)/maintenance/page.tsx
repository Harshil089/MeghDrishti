"use client";

import { Wrench } from "lucide-react";
import { PageHeader, Empty, Eyebrow, card, type Tone } from "@/components/console/ui";
import { fetchMaintenance, type MaintenancePrediction, type MaintenanceReport } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const EMPTY: MaintenanceReport = { predictions: [], recommended_actions: [] };
const COLUMNS: { title: string; tone: Tone; test: (p: number) => boolean }[] = [
  { title: "Inspect now", tone: "crit", test: (p) => p >= 50 },
  { title: "Schedule", tone: "warn", test: (p) => p >= 25 && p < 50 },
  { title: "Watch", tone: "info", test: (p) => p >= 10 && p < 25 },
  { title: "Healthy", tone: "ok", test: (p) => p < 10 },
];
const dot: Record<Tone, string> = { crit: "bg-crit", warn: "bg-warn", info: "bg-accent", ok: "bg-ok", neutral: "bg-sub" };
// shortcut: each column renders its first 40 stations; with ~3,000 stations, add paging if operators need the tail.
const PER_COLUMN = 40;

function JobCard({ m, tone }: { m: MaintenancePrediction; tone: Tone }) {
  return (
    <li className="rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink" title={m.name}>
          {m.name}
        </span>
        <span className="font-mono text-[13px] text-ink">{m.pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
        <div className={`h-full rounded-full ${dot[tone]}`} style={{ width: `${Math.max(3, m.pct)}%` }} />
      </div>
      <p className="mt-2 truncate text-xs text-sub" title={m.note}>
        {m.note}
      </p>
    </li>
  );
}

export default function MaintenancePage() {
  const { predictions, recommended_actions } = useLiveData(fetchMaintenance, EMPTY);
  const first = predictions.slice(0, 3);

  return (
    <>
      <PageHeader title="Upkeep" description="Stations ranked by maintenance need from 7-day QC trigger rates." />

      {predictions.length === 0 ? (
        <div className={card}>
          <Empty>No station health data yet</Empty>
        </div>
      ) : (
        <div className="space-y-5">
          <section className={`${card} grid gap-6 p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]`}>
            <div className="min-w-0">
              <Eyebrow>Visit first</Eyebrow>
              <p className="mt-1 text-[30px] font-light leading-tight tracking-tight text-ink">{first.map((p) => p.name).join(" → ")}</p>
              <p className="mt-2 text-sm text-sub">
                The {first.length} stations with the highest maintenance need · {predictions.filter((p) => p.pct >= 50).length} need inspection now
              </p>
            </div>
            <ol className="space-y-2">
              {recommended_actions.slice(0, 3).map((a, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl bg-raised px-3.5 py-2.5 text-[13px] leading-snug text-ink">
                  <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                  {a}
                </li>
              ))}
              {recommended_actions.length === 0 && <li className="text-sm text-sub">No actions recommended.</li>}
            </ol>
          </section>

          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((c) => {
              const items = predictions.filter((p) => c.test(p.pct));
              return (
                <section key={c.title} className={`${card} bg-raised/60 p-3`}>
                  <h2 className="flex items-center gap-2 px-1.5 pb-3 pt-1">
                    <span className={`h-2 w-2 rounded-full ${dot[c.tone]}`} />
                    <span className="text-[13px] font-semibold text-ink">{c.title}</span>
                    <span className="font-mono text-xs text-sub">{items.length.toLocaleString()}</span>
                  </h2>
                  {items.length === 0 ? (
                    <p className="px-1.5 pb-2 text-xs text-sub">None</p>
                  ) : (
                    <ul className="max-h-[560px] space-y-2 overflow-y-auto pr-0.5">
                      {items.slice(0, PER_COLUMN).map((m) => (
                        <JobCard key={m.station_id} m={m} tone={c.tone} />
                      ))}
                      {items.length > PER_COLUMN && (
                        <li className="px-1.5 py-1 text-xs text-sub">+{(items.length - PER_COLUMN).toLocaleString()} more</li>
                      )}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
