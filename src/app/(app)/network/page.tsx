"use client";

import Topbar from "@/components/Topbar";
import StationMap from "@/components/StationMap";
import RadarSweepCanvas from "@/components/RadarSweepCanvas";
import { statusMeta, type Station } from "@/lib/mock-data";
import { fetchMaintenance, fetchStations, type MaintenanceReport } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { useState } from "react";
import { Wrench, ClipboardList } from "lucide-react";

const EMPTY_MAINTENANCE: MaintenanceReport = { predictions: [], recommended_actions: [] };

function severityBar(pct: number) {
  if (pct >= 50) return "from-rose-500 to-rose-400";
  if (pct >= 25) return "from-amber-400 to-amber-300";
  return "from-emerald-400 to-emerald-300";
}

export default function NetworkPage() {
  const stations = useLiveData(fetchStations, [] as Station[]);
  const maintenance = useLiveData(fetchMaintenance, EMPTY_MAINTENANCE);
  const [selectedId, setSelectedId] = useState<string>("");
  const selected: Station | undefined = stations.find((s) => s.id === selectedId) ?? stations[0];

  return (
    <>
      <Topbar title="Network Map" />
      <main className="flex-1 p-4 md:p-6 space-y-4">
        <section className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4">
            <div className="flex items-center gap-2">
              <RadarSweepCanvas size={32} />
              <h3 className="text-sm font-semibold">Network Map (nearby stations)</h3>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted">
              {Object.entries(statusMeta).map(([key, m]) => (
                <span key={key} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          <div className="relative h-[520px] md:h-[620px] mt-2">
            {stations.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted">Connecting to station network…</div>
            ) : (
              <StationMap stations={stations} selectedId={selected?.id} onSelect={(s) => setSelectedId(s.id)} />
            )}
          </div>

          {selected && (
            <div className="px-4 pb-4 pt-2 flex items-center justify-between text-xs">
              <span className="text-muted">
                Selected: <span className="text-foreground/90 font-medium font-mono">{selected.id}</span> · {selected.name}
              </span>
              <span className={statusMeta[selected.status].color}>
                {selected.status === "offline" ? "—" : `${selected.temp}°C`} · {statusMeta[selected.status].label}
              </span>
            </div>
          )}
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold">Maintenance prediction</h3>
              <span className="text-[10px] text-muted ml-auto">from QC rule trigger rates, 7d</span>
            </div>
            <ul className="space-y-3">
              {maintenance.predictions.length === 0 && (
                <li className="text-xs text-muted">No station health data yet.</li>
              )}
              {maintenance.predictions.map((m) => (
                <li key={m.station_id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted">
                      {m.station_code} <span className="text-foreground/60">· {m.name}</span>
                    </span>
                    <span className="text-foreground/80 font-mono">{m.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${severityBar(m.pct)}`} style={{ width: `${m.pct}%` }} />
                  </div>
                  <p className="text-[11px] text-muted mt-1">{m.note}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-xl p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-semibold">Recommended action</h3>
            </div>
            <ul className="space-y-2 flex-1">
              {maintenance.recommended_actions.length === 0 && (
                <li className="text-xs text-muted">No actions recommended — fleet is healthy.</li>
              )}
              {maintenance.recommended_actions.map((a, i) => (
                <li key={i} className="text-xs text-muted leading-relaxed pl-3 border-l border-cyan-400/30">
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}
