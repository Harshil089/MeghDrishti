"use client";

import { Droplets, Gauge, Thermometer, CloudRain, Wind, Compass, type LucideIcon } from "lucide-react";
import { PageHeader, Badge, Empty, Eyebrow, card, healthTone, type Tone } from "@/components/console/ui";
import { fetchSensorHealth, type SensorHealth } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const statusLabel = { ok: "Healthy", warn: "Degraded", crit: "Unreliable", info: "", neutral: "No data" } as const;
const barColor: Record<Tone, string> = { ok: "bg-ok", warn: "bg-warn", crit: "bg-crit", info: "bg-accent", neutral: "bg-sub/40" };
const tileTint: Record<Tone, string> = { ok: "", warn: "border-warn/40 bg-warn/5", crit: "border-crit/40 bg-crit/5", info: "", neutral: "" };
const icons: Record<string, LucideIcon> = {
  temperature_c: Thermometer,
  humidity_pct: Droplets,
  pressure_hpa: Gauge,
  rainfall_mm: CloudRain,
  wind_speed_ms: Wind,
  wind_direction_deg: Compass,
};

function Ring({ pct }: { pct: number | null }) {
  const stroke = { ok: "var(--c-accent)", warn: "var(--c-warn)", crit: "var(--c-crit)", info: "var(--c-accent)", neutral: "var(--c-sub)" }[healthTone(pct)];
  const r = 42;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90" aria-hidden>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--c-raised)" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)" }} />
    </svg>
  );
}

export default function SensorHealthPage() {
  const sensors = useLiveData(fetchSensorHealth, [] as SensorHealth[]);

  const rated = sensors.filter((s) => s.reliability_pct !== null);
  const weakest = [...rated].sort((x, y) => (x.reliability_pct ?? 0) - (y.reliability_pct ?? 0))[0];
  const readings = sensors.reduce((n, s) => n + s.readings, 0);
  const flagged = sensors.reduce((n, s) => n + s.rule_triggers, 0);
  // Fleet reliability: per-sensor reliability weighted by readings, so a barely-used sensor does not skew it.
  const ratedReadings = rated.reduce((n, s) => n + s.readings, 0);
  const fleet = ratedReadings ? Math.round((10 * rated.reduce((n, s) => n + (s.reliability_pct ?? 0) * s.readings, 0)) / ratedReadings) / 10 : null;

  return (
    <>
      <PageHeader title="Sensors" description="Reliability per sensor type over the last 7 days, from QC rule trigger rates." />

      {sensors.length === 0 ? (
        <div className={card}>
          <Empty>Waiting for sensor data</Empty>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className={`${card} flex flex-wrap items-center gap-7 p-7`}>
              <Ring pct={weakest?.reliability_pct ?? null} />
              <div className="min-w-0 flex-1">
                <Eyebrow>Weakest sensor type</Eyebrow>
                <p className="mt-1 text-[40px] font-light leading-tight tracking-tight text-ink">
                  {weakest ? `${weakest.label} · ${weakest.reliability_pct}%` : "–"}
                </p>
                {weakest && (
                  <p className="mt-2 max-w-[60ch] text-sm text-sub">
                    {weakest.rule_triggers.toLocaleString()} of {weakest.readings.toLocaleString()} {weakest.label.toLowerCase()} readings tripped a quality check
                    this week. Start probe inspections here.
                  </p>
                )}
              </div>
            </section>
            <section className={`${card} p-6`}>
              <Eyebrow>Fleet reliability</Eyebrow>
              <p className="mt-1 text-[44px] font-light tracking-tight text-ink">{fleet === null ? "–" : `${fleet}%`}</p>
              <p className="text-xs text-sub">
                {flagged.toLocaleString()} flagged of {readings.toLocaleString()} readings
              </p>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sensors.map((s) => {
              const tone = healthTone(s.reliability_pct);
              const Icon = icons[s.measurement] ?? Gauge;
              const rate = s.readings ? ((s.rule_triggers / s.readings) * 100).toFixed(1) : "0.0";
              return (
                <article key={s.measurement} className={`${card} ${tileTint[tone]} p-5`}>
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <h2 className="flex-1 truncate text-[15px] font-semibold text-ink">{s.label}</h2>
                    <Badge tone={tone}>{statusLabel[tone]}</Badge>
                  </div>
                  <p className="mt-4 font-mono text-[34px] font-medium tracking-tight text-ink">
                    {s.reliability_pct ?? "–"}
                    <span className="text-base text-sub">%</span>
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
                    <div className={`meter-fill h-full rounded-full ${barColor[tone]}`} style={{ width: `${s.reliability_pct ?? 0}%` }} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-sub">Readings</dt>
                      <dd className="mt-0.5 font-mono text-ink">{s.readings.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-sub">Flagged</dt>
                      <dd className="mt-0.5 font-mono text-ink">{s.rule_triggers.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-sub">Flag rate</dt>
                      <dd className="mt-0.5 font-mono text-ink">{rate}%</dd>
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
