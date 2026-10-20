"use client";

import { useId } from "react";
import { PageHeader, Badge, Empty, Metric, MetricStrip, healthTone, type Tone } from "@/components/console/ui";
import { fetchSensorHealth, type SensorHealth } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const statusLabel = { ok: "Healthy", warn: "Degraded", crit: "Unreliable", info: "", neutral: "No data" } as const;
const ringStops: Record<Tone, [string, string]> = {
  ok: ["var(--c-accent-2)", "var(--c-accent-3)"],
  info: ["var(--c-accent-2)", "var(--c-accent-3)"],
  warn: ["#c27a12", "var(--c-warn)"],
  crit: ["#b3243f", "var(--c-crit)"],
  neutral: ["var(--c-sub)", "var(--c-line)"],
};

/** Circular gauge; the arc sweeps in from empty on mount. */
function Ring({ pct, tone }: { pct: number | null; tone: Tone }) {
  const id = useId().replace(/:/g, "");
  const r = 42;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct ?? 0));
  const [a, b] = ringStops[tone];
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a} />
            <stop offset="100%" stopColor={b} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--c-line)" strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 1100ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-baseline justify-center pt-[38px]">
        <span className="font-mono text-2xl font-medium tabular-nums text-ink">{pct ?? "-"}</span>
        {pct !== null && <span className="text-xs text-sub">%</span>}
      </div>
    </div>
  );
}

export default function SensorHealthPage() {
  const sensors = useLiveData(fetchSensorHealth, [] as SensorHealth[]);

  const rated = sensors.filter((s) => s.reliability_pct !== null);
  const avg = rated.length ? Math.round(rated.reduce((n, s) => n + (s.reliability_pct ?? 0), 0) / rated.length) : null;
  const weakest = [...rated].sort((x, y) => (x.reliability_pct ?? 0) - (y.reliability_pct ?? 0))[0];
  const readings = sensors.reduce((n, s) => n + s.readings, 0);
  const flagged = sensors.reduce((n, s) => n + s.rule_triggers, 0);
  const attention = rated.filter((s) => healthTone(s.reliability_pct) !== "ok").length;

  return (
    <>
      <PageHeader title="Sensors" description="Reliability per measurement over the last 7 days." />

      {sensors.length === 0 ? (
        <div className="rounded-lg border border-line c-card">
          <Empty>Waiting for sensor data</Empty>
        </div>
      ) : (
        <div className="space-y-4">
          <MetricStrip>
            <Metric label="Fleet reliability" value={avg ?? "-"} unit={avg === null ? undefined : "%"} tone={avg === null ? "neutral" : healthTone(avg)} foot={`${sensors.length} measurements`} />
            <Metric label="Needs attention" value={attention} tone={attention ? "warn" : "ok"} foot="Below 90%" />
            <Metric label="Weakest" value={weakest?.label ?? "-"} foot={weakest ? `${weakest.reliability_pct}% reliable` : undefined} />
            <Metric label="Flagged readings" value={flagged.toLocaleString()} foot={`of ${readings.toLocaleString()}`} />
          </MetricStrip>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sensors.map((s) => {
              const tone = healthTone(s.reliability_pct);
              const rate = s.readings ? ((s.rule_triggers / s.readings) * 100).toFixed(1) : "0.0";
              return (
                <article key={s.measurement} className="c-card rounded-lg border border-line p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="truncate text-[13px] font-semibold text-ink">{s.label}</h2>
                    <Badge tone={tone}>{statusLabel[tone]}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-5">
                    <Ring pct={s.reliability_pct} tone={tone} />
                    <dl className="min-w-0 flex-1 space-y-2.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <dt className="text-sub">Readings</dt>
                        <dd className="font-mono tabular-nums text-ink">{s.readings.toLocaleString()}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-sub">Flagged</dt>
                        <dd className="font-mono tabular-nums text-ink">{s.rule_triggers.toLocaleString()}</dd>
                      </div>
                      <div className="flex justify-between gap-2 border-t border-line pt-2.5">
                        <dt className="text-sub">Flag rate</dt>
                        <dd className="font-mono tabular-nums text-ink">{rate}%</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
