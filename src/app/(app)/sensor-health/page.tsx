"use client";

import { Droplets, Gauge, Thermometer, CloudRain, Wind, Compass, type LucideIcon } from "lucide-react";
import { PageHeader, Section, Badge, Empty, Eyebrow, card, healthTone, type Tone } from "@/components/console/ui";
import { fetchSensorHealth, type SensorHealth } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const statusLabel = { ok: "Nominal", warn: "Degraded", crit: "Unreliable", info: "", neutral: "No Data" } as const;
const barColor: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
  info: "bg-accent",
  neutral: "bg-sub/40",
};
const topBorder: Record<Tone, string> = {
  ok: "border-t-2 border-t-ok",
  warn: "border-t-2 border-t-warn",
  crit: "border-t-2 border-t-crit",
  info: "border-t-2 border-t-accent",
  neutral: "border-t-2 border-t-line",
};
const icons: Record<string, LucideIcon> = {
  temperature_c: Thermometer,
  humidity_pct: Droplets,
  pressure_hpa: Gauge,
  rainfall_mm: CloudRain,
  wind_speed_ms: Wind,
  wind_direction_deg: Compass,
};
const wmoCode: Record<string, string> = {
  temperature_c: "WMO-TEMP",
  humidity_pct: "WMO-RH",
  pressure_hpa: "WMO-PRES",
  rainfall_mm: "WMO-PRECIP",
  wind_speed_ms: "WMO-WSPD",
  wind_direction_deg: "WMO-WDIR",
};

function Ring({ pct }: { pct: number | null }) {
  const stroke = {
    ok: "var(--c-accent)",
    warn: "var(--c-warn)",
    crit: "var(--c-crit)",
    info: "var(--c-accent)",
    neutral: "var(--c-sub)",
  }[healthTone(pct)];
  const r = 42;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--c-raised)" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="butt"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-bold tabular-nums text-ink">{pct === null ? "–" : `${pct}%`}</span>
      </div>
    </div>
  );
}

export default function SensorHealthPage() {
  const sensors = useLiveData(fetchSensorHealth, [] as SensorHealth[]);

  const rated = sensors.filter((s) => s.reliability_pct !== null);
  const weakest = [...rated].sort((x, y) => (x.reliability_pct ?? 0) - (y.reliability_pct ?? 0))[0];
  const readings = sensors.reduce((n, s) => n + s.readings, 0);
  const flagged = sensors.reduce((n, s) => n + s.rule_triggers, 0);
  const ratedReadings = rated.reduce((n, s) => n + s.readings, 0);
  const fleet = ratedReadings
    ? Math.round((10 * rated.reduce((n, s) => n + (s.reliability_pct ?? 0) * s.readings, 0)) / ratedReadings) / 10
    : null;

  return (
    <>
      <PageHeader
        code="SYS-SNS-05 // SUBSYSTEM INSTRUMENTATION RELIABILITY"
        title="Sensor Fleet & Probe Reliability"
        description="7-day subsystem reliability index derived from WMO physical range, step-change, and persistence rule trigger rates across all reporting AWS stations."
      />

      {sensors.length === 0 ? (
        <div className={card}>
          <Empty>Awaiting 7-day subsystem telemetry aggregation</Empty>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <Section title="Primary Subsystem Attention Directive" meta="LOWEST 7-DAY RELIABILITY">
              <div className="flex flex-wrap items-center gap-6">
                <Ring pct={weakest?.reliability_pct ?? null} />
                <div className="min-w-0 flex-1">
                  <Eyebrow>SUBSYSTEM PRIORITY TARGET</Eyebrow>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-ink">
                    {weakest ? `${weakest.label} · ${weakest.reliability_pct}% Verified` : "–"}
                  </p>
                  {weakest && (
                    <p className="mt-1.5 max-w-[64ch] text-xs leading-relaxed text-sub">
                      <strong className="font-mono text-ink">{weakest.rule_triggers.toLocaleString()}</strong> of{" "}
                      <strong className="font-mono text-ink">{weakest.readings.toLocaleString()}</strong>{" "}
                      {weakest.label.toLowerCase()} observations triggered a WMO quality check over the past 7 days.
                      Prioritize field probe calibration and desiccant/shield inspection on this subsystem.
                    </p>
                  )}
                </div>
              </div>
            </Section>

            <Section title="Weighted Fleet Reliability" meta="ALL 6 WMO PARAMETERS">
              <div className="flex flex-col justify-between h-full">
                <div>
                  <Eyebrow>COMPOSITE SENSOR SCORE</Eyebrow>
                  <p className="mt-2 font-mono text-4xl font-bold tabular-nums tracking-tight text-ink">
                    {fleet === null ? "–" : `${fleet}%`}
                  </p>
                </div>
                <div className="mt-4 border-t border-line pt-3 font-mono text-xs text-sub">
                  <span className="font-semibold text-ink">{flagged.toLocaleString()}</span> flagged of{" "}
                  <span className="font-semibold text-ink">{readings.toLocaleString()}</span> total readings
                </div>
              </div>
            </Section>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sensors.map((s) => {
              const tone = healthTone(s.reliability_pct);
              const Icon = icons[s.measurement] ?? Gauge;
              const rate = s.readings ? ((s.rule_triggers / s.readings) * 100).toFixed(1) : "0.0";
              return (
                <article key={s.measurement} className={`${card} ${topBorder[tone]} flex flex-col justify-between p-5`}>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded border border-accent/25 bg-accent-soft text-accent">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
                          {wmoCode[s.measurement] ?? s.measurement.toUpperCase()}
                        </span>
                        <h2 className="truncate text-sm font-bold text-ink">{s.label}</h2>
                      </div>
                      <Badge tone={tone}>{statusLabel[tone]}</Badge>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between">
                      <p className="font-mono text-3xl font-bold tabular-nums tracking-tight text-ink">
                        {s.reliability_pct ?? "–"}
                        <span className="ml-0.5 text-sm font-normal text-sub">%</span>
                      </p>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-sub">7D RELIABILITY</span>
                    </div>

                    <div className="mt-2 h-1.5 overflow-hidden rounded-xs bg-raised">
                      <div
                        className={`meter-fill h-full rounded-xs ${barColor[tone]}`}
                        style={{ width: `${s.reliability_pct ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line text-xs">
                    <div className="bg-surface px-2.5 py-2">
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-sub">Packets</dt>
                      <dd className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
                        {s.readings.toLocaleString()}
                      </dd>
                    </div>
                    <div className="bg-surface px-2.5 py-2">
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-sub">QC Flags</dt>
                      <dd className="mt-0.5 font-mono font-semibold tabular-nums text-ink">
                        {s.rule_triggers.toLocaleString()}
                      </dd>
                    </div>
                    <div className="bg-surface px-2.5 py-2">
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-sub">Flag Rate</dt>
                      <dd className="mt-0.5 font-mono font-semibold tabular-nums text-ink">{rate}%</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
