"use client";

import Topbar from "@/components/Topbar";
import Reveal from "@/components/Reveal";
import SpotlightCard from "@/components/SpotlightCard";
import { fetchActiveCalibration, fetchDataSources, type CalibrationProfile, type DataSourceStatus } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { Settings as SettingsIcon, Database, SlidersHorizontal } from "lucide-react";

export default function SettingsPage() {
  const calibration = useLiveData(fetchActiveCalibration, null as CalibrationProfile | null, 30000);
  const sources = useLiveData(fetchDataSources, [] as DataSourceStatus[], 30000);

  return (
    <>
      <Topbar title="Settings" />
      <main className="flex-1 p-4 md:p-6 space-y-4">
        <div className="glass rounded-xl p-4 flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-cyan-300" />
          <h3 className="text-sm font-semibold">System configuration</h3>
          <span className="text-[11px] text-muted ml-auto">read-only — edit via calibration DAG / admin API</span>
        </div>

        <Reveal className="grid md:grid-cols-2 gap-4">
          <SpotlightCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <SlidersHorizontal className="h-4 w-4 text-amber-400" />
              <h4 className="text-sm font-semibold">Active calibration profile</h4>
            </div>
            {!calibration ? (
              <p className="text-xs text-muted">No active profile — system running on hardcoded defaults.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  <span className="text-foreground/80 font-medium">{calibration.name}</span> · updated{" "}
                  {new Date(calibration.updated_at).toLocaleString()}
                </p>
                <div>
                  <p className="text-[11px] text-muted mb-1.5">Decision thresholds</p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                    {Object.entries(calibration.decision_thresholds).map(([k, v]) => (
                      <div key={k} className="flex justify-between rounded bg-panel-2 px-2 py-1">
                        <span className="text-muted">{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-muted mb-1.5">Fusion weights</p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                    {Object.entries(calibration.fusion_weights).map(([k, v]) => (
                      <div key={k} className="flex justify-between rounded bg-panel-2 px-2 py-1">
                        <span className="text-muted">{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </SpotlightCard>

          <SpotlightCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-emerald-400" />
              <h4 className="text-sm font-semibold">Data sources</h4>
            </div>
            <ul className="space-y-2">
              {sources.length === 0 && <li className="text-xs text-muted">Connecting…</li>}
              {sources.map((s) => (
                <li key={s.name} className="flex items-center justify-between text-xs rounded-lg bg-panel-2 px-3 py-2">
                  <div>
                    <span className="font-medium text-foreground/90">{s.name}</span>
                    <span className="text-muted ml-2">{s.kind}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[10px] ${
                      s.is_enabled
                        ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                        : "text-muted border-border"
                    }`}
                  >
                    {s.is_enabled ? "enabled" : "pending credentials"}
                  </span>
                </li>
              ))}
            </ul>
          </SpotlightCard>
        </Reveal>
      </main>
    </>
  );
}
