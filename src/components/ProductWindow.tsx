// Illustrative-only mockup of the console UI, for the public landing page.
// Never wired to src/lib/api.ts — every value here is a hardcoded constant,
// same posture as page.tsx's ARCHITECTURE_STATS (no live/real data on the
// unauthenticated landing page).
const TABS = ["Dashboard", "Alerts", "Live Monitor"];

const TILES = [
  { label: "Stations reporting", value: "142", sub: "of 148 active" },
  { label: "Open alerts", value: "3", sub: "1 critical" },
  { label: "Network health", value: "Healthy", sub: "rolling 24h score" },
];

const DECISIONS: { code: string; verdict: "flagged" | "clear"; detail: string }[] = [
  { code: "TEMP_SPIKE · NEIGHBOR_MISMATCH", verdict: "flagged", detail: "Pune-04 · probable sensor fault" },
  { code: "RAINFALL_EXTREME · GPM_CONFIRMED", verdict: "clear", detail: "Nagpur-11 · genuine extreme" },
  { code: "PRESSURE_DRIFT · FORECAST_CONFIRMED", verdict: "clear", detail: "Nashik-02 · genuine extreme" },
  { code: "HUMIDITY_JUMP · MODEL_HIGH_ANOMALY_SCORE", verdict: "flagged", detail: "Kolhapur-07 · probable sensor fault" },
];

export default function ProductWindow() {
  return (
    <div className="rounded-lg border border-border bg-panel-2/60 overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        {TABS.map((t, i) => (
          <span
            key={t}
            className={`rounded-md px-2.5 py-1 text-xs font-mono ${
              i === 0 ? "bg-panel text-foreground" : "text-muted"
            }`}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-px bg-border">
        {TILES.map((t) => (
          <div key={t.label} className="bg-panel-2 p-4">
            <p className="text-[11px] font-mono uppercase tracking-wide text-muted mb-2">{t.label}</p>
            <p className="text-2xl font-semibold text-foreground">{t.value}</p>
            <p className="text-[11px] text-muted mt-1">{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-3 md:p-4">
        <p className="text-[11px] font-mono uppercase tracking-wide text-muted mb-2 px-1">
          Recent decisions
        </p>
        <ul className="font-mono text-[11px] md:text-xs">
          {DECISIONS.map((d) => (
            <li
              key={d.code}
              className="flex items-center justify-between gap-3 px-1 py-1.5 border-b border-border/60 last:border-0"
            >
              <span className={d.verdict === "flagged" ? "text-orange-400" : "text-muted"}>{d.code}</span>
              <span className="text-muted shrink-0">{d.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
