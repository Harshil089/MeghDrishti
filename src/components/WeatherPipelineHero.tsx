"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Bell, BrainCircuit, CloudDownload, Pause, Play, Radar, RotateCcw, ShieldCheck } from "lucide-react";
import type { StationId } from "@/components/ui/agentic-factory-3d";

const WeatherPipeline = dynamic(() => import("@/components/ui/agentic-factory-3d"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-xs text-muted">Loading the weather pipeline…</div>,
});

const STAGES = [
  { id: "ingestion", name: "Ingest", icon: CloudDownload, tech: "FastAPI · Celery · PostgreSQL", detail: "Weather adapters normalize readings into a common observation format. Open-Meteo supplies weather model data; IMD supports real access and demo data." },
  { id: "qc", name: "QC rules", icon: ShieldCheck, tech: "11 deterministic checks", detail: "Physical limits, spikes, drift and time consistency produce evidence for every reading." },
  { id: "ml", name: "ML", icon: BrainCircuit, tech: "scikit-learn · Isolation Forest", detail: "Models add anomaly evidence after explicit activation. Current models are candidates; accuracy still needs independent labels." },
  { id: "context", name: "Context", icon: Radar, tech: "Open-Meteo · nearby stations", detail: "Forecasts and station neighbors help interpret unusual weather. ERA5 and NASA GPM are optional integrations requiring verified access." },
  { id: "fusion", name: "Decision", icon: Bell, tech: "Evidence fusion · Redis · WebSocket", detail: "Available evidence is fused into an explainable decision, a station health update and an operator alert." },
] as const;

export default function WeatherPipelineHero() {
  const [selected, setSelected] = useState<StationId>("ingestion");
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const stage = STAGES.find((item) => item.id === selected)!;

  function focus(id: StationId) {
    // ponytail: one hero scene; use an instance ref if multiple scenes are needed.
    if (window.__machine?.focusStation(id)) setSelected(id);
  }

  return (
    <div className="relative min-w-0">
      <div className="relative h-[360px] sm:h-[460px] lg:h-[490px]">
        <WeatherPipeline
          height="100%"
          embed
          onStation={setSelected}
          onReady={() => {
            setReady(true);
            setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
          }}
        />
        <div className="absolute inset-x-2 top-1 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">The weather intelligence engine</p>
          <div className="flex gap-1">
            <button type="button" disabled={!ready} aria-label="Reset pipeline view" onClick={() => { window.__machine?.setMode("assembled"); window.__machine?.setCamera("overview"); }} className="rounded-full border border-border p-2 text-muted hover:text-foreground disabled:opacity-40">
              <RotateCcw size={13} />
            </button>
            <button type="button" disabled={!ready} aria-label={playing ? "Pause pipeline animation" : "Play pipeline animation"} aria-pressed={!playing} onClick={() => { if (playing) window.__machine?.pause(); else window.__machine?.play(); setPlaying(!playing); }} className="rounded-full border border-border p-2 text-muted hover:text-foreground disabled:opacity-40">
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </button>
          </div>
        </div>
        <p className="absolute bottom-1 inset-x-0 text-center text-[10px] text-muted">Drag to rotate · Select a module below</p>
      </div>

      <nav aria-label="Explore the weather pipeline" className="grid grid-cols-5 gap-1 border-y border-border py-3">
        {STAGES.map((item, index) => (
          <button key={item.id} type="button" disabled={!ready} aria-pressed={selected === item.id} onClick={() => focus(item.id)} className={`flex flex-col items-center gap-2 rounded-lg px-1 py-2 text-[10px] sm:text-xs transition-colors disabled:opacity-50 ${selected === item.id ? "bg-orange-400/10 text-orange-400" : "text-muted hover:bg-panel-2 hover:text-foreground"}`}>
            <item.icon size={17} />
            <span>{index + 1}. {item.name}</span>
          </button>
        ))}
      </nav>
      <div className="min-h-[128px] py-4" aria-live="polite">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-orange-400">{stage.tech}</p>
        <p className="text-xs leading-relaxed text-muted">{stage.detail}</p>
        <p className="mt-3 text-[10px] text-muted">Illustrative architecture · No live station telemetry</p>
      </div>
    </div>
  );
}
