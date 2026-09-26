"use client";

import Topbar from "@/components/Topbar";
import Reveal from "@/components/Reveal";
import SpotlightCard from "@/components/SpotlightCard";
import { fetchSensorHealth, type SensorHealth } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { HeartPulse } from "lucide-react";

function ringColor(pct: number | null): string {
  if (pct === null) return "#64748b";
  if (pct >= 90) return "#34d399";
  if (pct >= 70) return "#fbbf24";
  return "#fb7185";
}

function Gauge({ sensor }: { sensor: SensorHealth }) {
  const pct = sensor.reliability_pct;
  const color = ringColor(pct);
  const angle = pct !== null ? (pct / 100) * 360 : 0;

  return (
    <SpotlightCard className="p-5 flex flex-col items-center text-center">
      <div
        className="relative h-24 w-24 rounded-full flex items-center justify-center"
        style={{
          background: `conic-gradient(${color} ${angle}deg, var(--panel-2) ${angle}deg)`,
        }}
      >
        <div className="h-[76px] w-[76px] rounded-full bg-panel flex flex-col items-center justify-center">
          <span className="font-mono text-lg font-semibold" style={{ color }}>
            {pct !== null ? `${pct}` : "—"}
          </span>
          {pct !== null && <span className="text-[10px] text-muted -mt-0.5">%</span>}
        </div>
      </div>
      <p className="text-sm font-medium mt-3">{sensor.label}</p>
      <p className="text-[11px] text-muted mt-1 font-mono">
        {sensor.readings} readings · {sensor.rule_triggers} flagged
      </p>
    </SpotlightCard>
  );
}

export default function SensorHealthPage() {
  const sensors = useLiveData(fetchSensorHealth, [] as SensorHealth[]);

  return (
    <>
      <Topbar title="Sensor Health" />
      <main className="flex-1 p-4 md:p-6 space-y-4">
        <div className="glass rounded-xl p-4 flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold">Fleet-wide sensor reliability</h3>
          <span className="text-[11px] text-muted ml-auto">
            derived from stuck / drift / spike / physical-range rule trigger rates, last 7 days
          </span>
        </div>

        {sensors.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-sm text-muted">Connecting to backend…</div>
        ) : (
          <Reveal className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {sensors.map((s) => (
              <Gauge key={s.measurement} sensor={s} />
            ))}
          </Reveal>
        )}
      </main>
    </>
  );
}
