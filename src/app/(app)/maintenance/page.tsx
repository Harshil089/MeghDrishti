"use client";

import Topbar from "@/components/Topbar";
import { fetchMaintenance, type MaintenanceReport } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { Wrench } from "lucide-react";

const EMPTY: MaintenanceReport = { predictions: [], recommended_actions: [] };

function severityBar(pct: number) {
  if (pct >= 50) return "from-rose-500 to-rose-400";
  if (pct >= 25) return "from-amber-400 to-amber-300";
  return "from-emerald-400 to-emerald-300";
}

export default function MaintenancePage() {
  const { predictions, recommended_actions } = useLiveData(fetchMaintenance, EMPTY);

  return (
    <>
      <Topbar title="Maintenance" />
      <main className="flex-1 p-4 md:p-6 grid md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold">Predicted maintenance needs</h3>
          </div>
          <p className="text-[11px] text-muted mb-4">
            Ranked by station health score — worst first. Note shows the QC rule contributing most triggers.
          </p>
          <ul className="space-y-4">
            {predictions.length === 0 && <li className="text-xs text-muted">No station health data yet.</li>}
            {predictions.map((m) => (
              <li key={m.station_id}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-foreground/80">
                    {m.station_code} <span className="text-muted font-normal">· {m.name}</span>
                  </span>
                  <span className="text-muted font-mono">{m.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-panel-2 overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${severityBar(m.pct)}`} style={{ width: `${m.pct}%` }} />
                </div>
                <p className="text-[11px] text-muted mt-1">{m.note}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-1">Priority queue</h3>
          <p className="text-[11px] text-muted mb-4">Generated from live station health + rule-trigger data.</p>
          {recommended_actions.length === 0 ? (
            <p className="text-xs text-muted">No actions recommended — fleet is healthy.</p>
          ) : (
            <ol className="space-y-2 text-xs text-muted list-decimal list-inside">
              {recommended_actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ol>
          )}
        </div>
      </main>
    </>
  );
}
