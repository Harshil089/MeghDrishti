"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Bell, MapPin, Search, Thermometer } from "lucide-react";
import StationMap from "@/components/StationMap";
import { PageHeader, Badge, Empty, Select, card, chip as chipCls, field, type Tone } from "@/components/console/ui";
import { statusMeta, type Alert, type Station, type StationStatus } from "@/lib/mock-data";
import { fetchAlerts, fetchStations, regionLabel } from "@/lib/api";
import { useLiveData, useLiveDataWs } from "@/lib/useLiveData";

const statusTone: Record<StationStatus, Tone> = { normal: "ok", new: "neutral", warning: "warn", critical: "crit", offline: "neutral" };
const order: StationStatus[] = ["normal", "new", "warning", "critical", "offline"];

export default function NetworkPage() {
  const stations = useLiveData(fetchStations, [] as Station[]);
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string>(searchParams.get("station") ?? "");
  const [filter, setFilter] = useState<StationStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");

  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stations) counts.set(s.region ?? "", (counts.get(s.region ?? "") ?? 0) + 1);
    return [...counts].sort(([a], [b]) => regionLabel(a).localeCompare(regionLabel(b)));
  }, [stations]);
  const inRegion = useMemo(() => stations.filter((s) => !region || (s.region ?? "") === region), [stations, region]);
  const selected = stations.find((s) => s.id === selectedId) ?? inRegion.find((s) => s.status !== "offline") ?? inRegion[0];

  const counts = useMemo(
    () => inRegion.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {}),
    [inRegion]
  );
  const online = inRegion.filter((s) => s.status !== "offline");
  const temps = online.flatMap((s) => (s.temp == null ? [] : [s.temp]));
  const avgTemp = temps.length ? (temps.reduce((a, t) => a + t, 0) / temps.length).toFixed(1) : "-";
  const attention = (counts.warning ?? 0) + (counts.critical ?? 0);

  const visible = inRegion.filter(
    (s) =>
      (filter === "all" || s.status === filter) &&
      `${s.name} ${s.id}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  const stationAlerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts").filter((a) => a.station === selected?.id).length;

  const chip = "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-sub";
  const rank = { critical: 0, warning: 1, new: 2, normal: 3, offline: 4 } as const;
  const dock = [...inRegion].sort((a, b) => rank[a.status] - rank[b.status]).slice(0, 5);

  return (
    <>
      <PageHeader
        title="Network"
        description="Station locations and live status. IMD stations report every 15 minutes, about 25 minutes behind."
        actions={
          <>
            <span className={chip}>
              <b className="font-mono font-medium text-ink">{inRegion.length || "-"}</b> stations
            </span>
            <span className={chip}>
              <b className="font-mono font-medium text-ink">{online.length}</b> reporting
            </span>
            <span className={chip}>
              <b className={`font-mono font-medium ${attention ? "text-warn" : "text-ink"}`}>{attention}</b> need attention
            </span>
            <span className={chip}>
              <b className="font-mono font-medium text-ink">{avgTemp}</b>°C avg
            </span>
          </>
        }
      />

      <div className={`${card} relative h-[calc(100dvh-330px)] min-h-[520px] overflow-hidden`}>
        {stations.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-sub">Loading station network</div>
        ) : (
          <StationMap stations={inRegion} selectedId={selected?.id} onSelect={(s) => setSelectedId(s.id)} />
        )}

        {/* Station list floats over the map */}
        <aside className="absolute left-3 top-3 z-[900] flex max-h-[calc(100%-1.5rem)] w-[min(19rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lg shadow-ink/10">
          <div className="space-y-2.5 border-b border-line p-3">
            <Select
              aria-label="State"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setSelectedId("");
              }}
              className="w-full"
            >
              <option value="">All states ({stations.length})</option>
              {regions.map(([r, n]) => (
                <option key={r} value={r}>
                  {regionLabel(r)} ({n})
                </option>
              ))}
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sub" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stations"
                aria-label="Search stations"
                className={`${field} pl-8`}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...order] as const).map((k) => {
                const on = filter === k;
                const n = k === "all" ? inRegion.length : counts[k] ?? 0;
                return (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    aria-pressed={on}
                    className={`${chipCls(on)} h-7 px-2.5`}
                  >
                    {k === "all" ? "All" : statusMeta[k].label}
                    <span className="ml-1.5 font-mono tabular-nums text-sub">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {visible.length === 0 ? (
            <Empty>{stations.length ? "No stations match" : "No stations yet"}</Empty>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {visible.map((s) => {
                const active = s.id === selected?.id;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      aria-pressed={active}
                      className={`relative grid w-full grid-cols-[1fr_auto] items-center gap-x-3 border-b border-line px-3.5 py-2.5 text-left transition-colors last:border-0 ${
                        active ? "bg-accent-soft" : "hover:bg-raised"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`absolute inset-y-0 left-0 w-0.5 bg-accent transition-transform duration-300 ${active ? "scale-y-100" : "scale-y-0"}`}
                      />
                      <span className="truncate text-[13px] font-medium text-ink">{s.name}</span>
                      <span className="text-right font-mono text-xs tabular-nums text-ink">
                        {s.status === "offline" || s.temp == null ? "-" : `${s.temp}°C`}
                      </span>
                      <span className="truncate font-mono text-[11px] text-sub">{s.id}</span>
                      <span className="justify-self-end">
                        <Badge tone={statusTone[s.status]}>{statusMeta[s.status].label}</Badge>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Selected station */}
        {selected && (
          <div key={selected.id} className="absolute bottom-3 right-3 z-[900] w-[min(20rem,calc(100%-1.5rem))] rounded-2xl border border-line bg-surface p-4 shadow-lg shadow-ink/10">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{selected.name}</p>
                <p className="truncate font-mono text-[11px] text-sub">{selected.id} · {regionLabel(selected.region)}</p>
              </div>
              <Badge tone={statusTone[selected.status]}>{statusMeta[selected.status].label}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3 text-xs">
              <div>
                <dt className="flex items-center gap-1 text-sub"><Thermometer className="h-3 w-3" />Temp</dt>
                <dd className="mt-0.5 font-mono text-sm tabular-nums text-ink">{selected.status === "offline" || selected.temp == null ? "-" : `${selected.temp}°C`}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-sub"><Bell className="h-3 w-3" />Alerts</dt>
                <dd className="mt-0.5 font-mono text-sm tabular-nums text-ink">{stationAlerts}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-sub"><MapPin className="h-3 w-3" />Position</dt>
                <dd className="mt-0.5 font-mono text-[11px] tabular-nums text-ink">{selected.lat.toFixed(1)}, {selected.lon.toFixed(1)}</dd>
              </div>
            </dl>
            {stationAlerts > 0 && (
              <Link href="/alerts" className="mt-3 flex items-center justify-end gap-1 text-xs text-accent hover:underline">
                View alerts <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Dock: worst stations in view, one click to focus them on the map */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {dock.map((s) => {
          const on = s.id === selected?.id;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`${card} flex min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:border-accent/40 ${on ? "border-accent ring-1 ring-accent" : ""}`}
            >
              <span className={`h-9 w-1 shrink-0 rounded-full ${s.status === "critical" ? "bg-crit" : s.status === "warning" ? "bg-warn" : s.status === "offline" ? "bg-sub/40" : "bg-ok"}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{s.name}</span>
                <span className="block truncate text-[11px] text-sub">{statusMeta[s.status].label} · {regionLabel(s.region)}</span>
              </span>
              <span className="text-xl font-light tracking-tight text-ink">{s.temp == null || s.status === "offline" ? "–" : `${s.temp.toFixed(1)}°`}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
