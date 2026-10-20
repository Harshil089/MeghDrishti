"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import AlertDetailModal from "@/components/AlertDetailModal";
import { TimelineChart } from "@/components/console/TrendChart";
import { PageHeader, Badge, Empty, Meter, Section, Select, button, field, severityTone } from "@/components/console/ui";
import type { Alert } from "@/lib/mock-data";
import { fetchAlerts } from "@/lib/api";
import { useLiveDataWs } from "@/lib/useLiveData";

type Severity = "all" | "critical" | "warning" | "info";
const severities: { key: Severity; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "info", label: "Info" },
];

export default function AlertsPage() {
  const alerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState<Severity>("all");
  const [minConf, setMinConf] = useState("");

  const count = (s: string) => alerts.filter((a) => a.severity === s).length;
  const stations = useMemo(() => new Set(alerts.map((a) => a.station)).size, [alerts]);
  const avgConf = alerts.length ? Math.round(alerts.reduce((n, a) => n + a.confidence, 0) / alerts.length) : null;

  // 12 equal time buckets across the alerts' detection span.
  const history = useMemo(() => {
    const ts = alerts.map((a) => (a.detectedAt ? Date.parse(a.detectedAt) : NaN)).filter((n) => !Number.isNaN(n));
    if (ts.length < 2) return [];
    const min = Math.min(...ts);
    const size = Math.max(1, (Math.max(...ts) - min) / 12);
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      t: new Date(min + i * size).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      value: 0,
    }));
    for (const n of ts) buckets[Math.min(11, Math.floor((n - min) / size))].value++;
    return buckets;
  }, [alerts]);

  const top = (key: "station" | "code") => {
    const tally = alerts.reduce<Record<string, number>>((m, a) => ({ ...m, [a[key]]: (m[a[key]] ?? 0) + 1 }), {});
    const [name, n] = Object.entries(tally).sort((x, y) => y[1] - x[1])[0] ?? ["-", 0];
    return { name, n };
  };
  const topStation = top("station");
  const topCode = top("code");

  const q = query.trim().toLowerCase();
  const filtered = alerts.filter(
    (a) =>
      (severity === "all" || a.severity === severity) &&
      (minConf === "" || a.confidence >= Number(minConf)) &&
      (q === "" || `${a.station} ${a.code} ${a.message}`.toLowerCase().includes(q))
  );
  const hasFilters = q !== "" || severity !== "all" || minConf !== "";
  const clear = () => {
    setQuery("");
    setSeverity("all");
    setMinConf("");
  };

  return (
    <>
      <AlertDetailModal key={selectedAlert?.id} alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      <PageHeader title="Alerts" description="Latest 50 alerts. Select one to review." />

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-12">
          <Section title="Alerts over time" meta={`${alerts.length} alerts · ${stations} stations`} className="lg:col-span-8">
            <div className="h-44">
              <TimelineChart data={history} label="Alerts" />
            </div>
          </Section>
          <Section title="Summary" className="lg:col-span-4">
            <div className="space-y-3.5">
              {(["critical", "warning", "info"] as const).map((k) => (
                <div key={k}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="capitalize text-sub">{k}</span>
                    <span className="font-mono tabular-nums text-ink">{count(k)}</span>
                  </div>
                  <Meter pct={alerts.length ? (count(k) / alerts.length) * 100 : 0} tone={severityTone[k]} />
                </div>
              ))}
              <dl className="space-y-2 border-t border-line pt-3 text-xs">
                {[
                  ["Avg confidence", avgConf === null ? "-" : `${avgConf}%`],
                  ["Most alerts", topStation.n ? `${topStation.name} (${topStation.n})` : "-"],
                  ["Top reason", topCode.n ? `${topCode.name} (${topCode.n})` : "-"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-sub">{k}</dt>
                    <dd className="truncate font-mono text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Section>
        </div>

        <section className="rounded-lg border border-line c-card">
          <div className="sticky top-[89px] z-10 flex flex-wrap items-center gap-2 rounded-t-lg border-b border-line bg-surface/95 p-3 backdrop-blur">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sub" />
              <input
                type="search"
                aria-label="Search alerts"
                placeholder="Search station, code or message"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${field} pl-8`}
              />
            </div>
            <div className="flex gap-1.5">
              {severities.map(({ key, label }) => {
                const on = severity === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSeverity(key)}
                    className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                      on ? "border-accent bg-accent/15 text-ink" : "border-line text-sub hover:bg-raised hover:text-ink"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <Select aria-label="Minimum confidence" value={minConf} onChange={(e) => setMinConf(e.target.value)}>
              <option value="">Any confidence</option>
              <option value="50">50%+</option>
              <option value="75">75%+</option>
              <option value="90">90%+</option>
            </Select>
            <span role="status" className="font-mono text-xs text-sub">
              {filtered.length}/{alerts.length}
            </span>
            {hasFilters && (
              <button type="button" onClick={clear} className={button}>
                Clear
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <Empty>{alerts.length > 0 ? "No alerts match." : "No alerts in this view."}</Empty>
          ) : (
            <ul>
              {filtered.map((a) => (
                <li key={a.id} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => setSelectedAlert(a)}
                    aria-haspopup="dialog"
                    aria-label={`Review alert ${a.code} for ${a.station}`}
                    className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:grid-cols-[96px_minmax(140px,200px)_1fr_120px_150px]"
                  >
                    <span className="justify-self-start">
                      <Badge tone={severityTone[a.severity]}>{a.severity}</Badge>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink">{a.station}</span>
                      <span className="block truncate font-mono text-[11px] text-sub">{a.code}</span>
                    </span>
                    <span className="col-span-3 row-start-2 truncate text-[13px] text-sub md:col-span-1 md:row-start-auto">
                      {a.message}
                    </span>
                    <span className="hidden md:block">
                      <span className="mb-1 block font-mono text-xs tabular-nums text-ink">{a.confidence}%</span>
                      <Meter pct={a.confidence} tone="info" />
                    </span>
                    <span className="justify-self-end text-right font-mono text-[11px] text-sub">{a.time}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
