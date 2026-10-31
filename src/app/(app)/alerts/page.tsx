"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import AlertDetailModal from "@/components/AlertDetailModal";
import { Empty, PageHeader, card, field, severityTone, type Tone } from "@/components/console/ui";
import type { Alert } from "@/lib/mock-data";
import { fetchAlerts } from "@/lib/api";
import { useLiveDataWs } from "@/lib/useLiveData";

type Severity = "all" | "critical" | "warning" | "info";
const SEGMENTS: { key: Severity; label: string; tone: Tone }[] = [
  { key: "all", label: "All open", tone: "neutral" },
  { key: "critical", label: "Critical", tone: "crit" },
  { key: "warning", label: "Warning", tone: "warn" },
  { key: "info", label: "Info", tone: "info" },
];
const bar: Record<Tone, string> = { crit: "bg-crit", warn: "bg-warn", info: "bg-accent", ok: "bg-ok", neutral: "bg-sub" };
const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

export default function AlertsPage() {
  const alerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts");
  const [segment, setSegment] = useState<Severity>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const inSegment = (a: Alert) => segment === "all" || a.severity === segment;
  const q = query.trim().toLowerCase();
  const queue = alerts.filter((a) => inSegment(a) && (!q || `${a.station} ${a.code} ${a.message}`.toLowerCase().includes(q)));
  const selected = queue.find((a) => a.id === selectedId) ?? queue[0] ?? null;

  // Most common reason code per segment, shown under each count.
  const topCode = useMemo(() => {
    const out: Partial<Record<Severity, string>> = {};
    for (const s of SEGMENTS) {
      const tally = new Map<string, number>();
      for (const a of alerts) if (s.key === "all" || a.severity === s.key) tally.set(a.code, (tally.get(a.code) ?? 0) + 1);
      out[s.key] = [...tally].sort((x, y) => y[1] - x[1])[0]?.[0];
    }
    return out;
  }, [alerts]);

  return (
    <>
      <PageHeader title="Triage" description={`${alerts.length} open alerts · newest first. Pick one, check the evidence, record your call.`} />

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SEGMENTS.map((s) => {
            const n = s.key === "all" ? alerts.length : alerts.filter((a) => a.severity === s.key).length;
            const on = segment === s.key;
            return (
              <button
                key={s.key}
                onClick={() => {
                  setSegment(s.key);
                  setSelectedId(null);
                }}
                aria-pressed={on}
                className={`${card} flex items-center gap-4 px-5 py-4 text-left transition-colors hover:border-accent/40 ${on ? "border-accent ring-1 ring-accent" : ""}`}
              >
                <span className={`h-10 w-1 shrink-0 rounded-full ${bar[s.tone]}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-ink">{s.label}</span>
                  <span className="block truncate font-mono text-[11px] text-sub">{topCode[s.key] ?? "none"}</span>
                </span>
                <span className="text-[32px] font-light tracking-tight text-ink">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
          <section className={`${card} flex min-w-0 flex-col p-3`}>
            <div className="relative p-1 pb-3">
              <Search className="pointer-events-none absolute left-4 top-[18px] h-3.5 w-3.5 text-sub" />
              <input
                type="search"
                aria-label="Search alerts"
                placeholder="Search station, code or message"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${field} pl-9`}
              />
            </div>
            {queue.length === 0 ? (
              <Empty>{alerts.length ? "Nothing matches." : "No open alerts."}</Empty>
            ) : (
              <ul className="max-h-[calc(100dvh-320px)] min-h-[420px] space-y-1 overflow-y-auto">
                {queue.map((a) => {
                  const on = a.id === selected?.id;
                  const tone = severityTone[a.severity];
                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => setSelectedId(a.id)}
                        aria-current={on}
                        className={`grid w-full grid-cols-[8px_1fr_auto] items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                          on ? "bg-accent-soft" : "hover:bg-raised"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${bar[tone]}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink">{a.station}</span>
                          <span className="block truncate text-xs text-sub">
                            <span className="font-mono">{a.code}</span> · {a.message}
                          </span>
                          <span className="mt-1.5 flex items-center gap-2">
                            <span className="h-1 w-24 overflow-hidden rounded-full bg-raised">
                              <span className="block h-full rounded-full bg-accent" style={{ width: `${a.confidence}%` }} />
                            </span>
                            <span className="font-mono text-[11px] text-sub">{a.confidence}%</span>
                          </span>
                        </span>
                        <span className="self-start font-mono text-[11px] text-sub">{hhmm(a.detectedAt)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <AlertDetailModal
            inline
            key={selected?.id}
            alert={selected}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </div>
    </>
  );
}
