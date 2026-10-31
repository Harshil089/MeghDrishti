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

const statusTone: Record<StationStatus, Tone> = {
  normal: "ok",
  new: "neutral",
  warning: "warn",
  critical: "crit",
  offline: "neutral",
};
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
  const selected =
    stations.find((s) => s.id === selectedId) ?? inRegion.find((s) => s.status !== "offline") ?? inRegion[0];

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

  const stationAlerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts").filter(
    (a) => a.station === selected?.id
  ).length;

  const kpiBox =
    "inline-flex items-center gap-2 rounded border border-line bg-surface px-3 py-1.5 font-mono text-xs text-sub";
  const rank = { critical: 0, warning: 1, new: 2, normal: 3, offline: 4 } as const;
  const dock = [...inRegion].sort((a, b) => rank[a.status] - rank[b.status]).slice(0, 5);

  return (
    <>
      <PageHeader
        code="SYS-GIS-06 // NATIONAL GEOSPATIAL TELEMETRY GRID"
        title="National AWS Spatial Grid"
        description="Geospatial distribution and live operational status across 3,100+ Indian Automatic Weather Stations (15-minute IMD synoptic reporting cycle)."
        actions={
          <>
            <span className={kpiBox}>
              <span>TOTAL GRID:</span>
              <b className="font-semibold text-ink">{inRegion.length || "-"}</b>
            </span>
            <span className={kpiBox}>
              <span>ONLINE:</span>
              <b className="font-semibold text-ok">{online.length}</b>
            </span>
            <span className={kpiBox}>
              <span>FLAGGED:</span>
              <b className={`font-semibold ${attention ? "text-warn" : "text-ink"}`}>{attention}</b>
            </span>
            <span className={kpiBox}>
              <span>MEAN TEMP:</span>
              <b className="font-semibold text-ink">{avgTemp}°C</b>
            </span>
          </>
        }
      />

      <div className={`${card} relative h-[calc(100dvh-310px)] min-h-[540px] overflow-hidden`}>
        {stations.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-wider text-sub">
            Initializing National AWS Spatial Grid…
          </div>
        ) : (
          <StationMap stations={inRegion} selectedId={selected?.id} onSelect={(s) => setSelectedId(s.id)} />
        )}

        {/* Docked Left Sub-Division & Station Directory */}
        <aside className="absolute left-3 top-3 z-[900] flex max-h-[calc(100%-1.5rem)] w-[min(20.5rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-md border border-line bg-surface shadow-xl shadow-ink/15">
          <div className="flex h-9 items-center justify-between border-b border-line bg-raised/70 px-3">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-ink">
              AWS Station Directory
            </span>
            <span className="font-mono text-[10px] text-sub">{visible.length} listed</span>
          </div>

          <div className="space-y-2 border-b border-line p-3 bg-surface">
            <Select
              aria-label="State"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setSelectedId("");
              }}
              className="w-full"
            >
              <option value="">All States & UTs ({stations.length})</option>
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
                placeholder="Search station name or code…"
                aria-label="Search stations"
                className={`${field} pl-8`}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {(["all", ...order] as const).map((k) => {
                const on = filter === k;
                const n = k === "all" ? inRegion.length : counts[k] ?? 0;
                return (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    aria-pressed={on}
                    className={`${chipCls(on)} h-6 px-2 text-[11px]`}
                  >
                    {k === "all" ? "All" : statusMeta[k].label}
                    <span className="ml-1 font-mono text-[10px] tabular-nums text-sub">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {visible.length === 0 ? (
            <Empty>{stations.length ? "No stations match filter" : "Awaiting stations"}</Empty>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-line">
              {visible.map((s) => {
                const active = s.id === selected?.id;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      aria-pressed={active}
                      className={`relative grid w-full grid-cols-[1fr_auto] items-center gap-x-3 px-3.5 py-2.5 text-left transition-colors ${
                        active ? "bg-accent-soft/80" : "hover:bg-raised/60"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`absolute inset-y-0 left-0 w-1 bg-accent transition-transform duration-200 ${
                          active ? "scale-y-100" : "scale-y-0"
                        }`}
                      />
                      <span className="truncate text-xs font-semibold text-ink">{s.name}</span>
                      <span className="text-right font-mono text-xs font-semibold tabular-nums text-ink">
                        {s.status === "offline" || s.temp == null ? "-" : `${s.temp}°C`}
                      </span>
                      <span className="truncate font-mono text-[10px] text-sub">{s.id}</span>
                      <span className="justify-self-end mt-0.5">
                        <Badge tone={statusTone[s.status]}>{statusMeta[s.status].label}</Badge>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Selected Station Telemetry Dossier */}
        {selected && (
          <div
            key={selected.id}
            className="absolute bottom-3 right-3 z-[900] w-[min(21rem,calc(100%-1.5rem))] overflow-hidden rounded-md border border-line border-t-2 border-t-accent bg-surface shadow-xl shadow-ink/15"
          >
            <div className="border-b border-line bg-raised/60 px-4 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-ink">{selected.name}</p>
                  <p className="truncate font-mono text-[10px] uppercase tracking-wider text-sub">
                    {selected.id} · {regionLabel(selected.region)}
                  </p>
                </div>
                <Badge tone={statusTone[selected.status]}>{statusMeta[selected.status].label}</Badge>
              </div>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-line text-xs">
              <div className="px-3 py-2.5">
                <dt className="flex items-center gap-1 font-mono text-[10px] uppercase text-sub">
                  <Thermometer className="h-3 w-3 text-accent" /> Temp
                </dt>
                <dd className="mt-0.5 font-mono text-sm font-bold tabular-nums text-ink">
                  {selected.status === "offline" || selected.temp == null ? "-" : `${selected.temp}°C`}
                </dd>
              </div>
              <div className="px-3 py-2.5">
                <dt className="flex items-center gap-1 font-mono text-[10px] uppercase text-sub">
                  <Bell className="h-3 w-3 text-accent" /> Alerts
                </dt>
                <dd className="mt-0.5 font-mono text-sm font-bold tabular-nums text-ink">{stationAlerts}</dd>
              </div>
              <div className="px-3 py-2.5">
                <dt className="flex items-center gap-1 font-mono text-[10px] uppercase text-sub">
                  <MapPin className="h-3 w-3 text-accent" /> Coords
                </dt>
                <dd className="mt-0.5 font-mono text-[11px] font-semibold tabular-nums text-ink">
                  {selected.lat.toFixed(1)}°N, {selected.lon.toFixed(1)}°E
                </dd>
              </div>
            </dl>

            {stationAlerts > 0 && (
              <div className="border-t border-line bg-raised/40 px-4 py-2 text-right">
                <Link
                  href="/alerts"
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent hover:underline"
                >
                  Inspect Active Flags <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Priority Station Quick-Jump Dock */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {dock.map((s) => {
          const on = s.id === selected?.id;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`${card} flex min-w-0 items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:border-accent/50 ${
                on ? "border-accent ring-1 ring-accent bg-accent-soft/20" : ""
              }`}
            >
              <span
                className={`h-8 w-1 shrink-0 rounded-xs ${
                  s.status === "critical"
                    ? "bg-crit"
                    : s.status === "warning"
                    ? "bg-warn"
                    : s.status === "offline"
                    ? "bg-sub/40"
                    : "bg-ok"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-ink">{s.name}</span>
                <span className="block truncate font-mono text-[10px] uppercase text-sub">
                  {statusMeta[s.status].label} · {regionLabel(s.region)}
                </span>
              </span>
              <span className="font-mono text-base font-bold tabular-nums text-ink">
                {s.temp == null || s.status === "offline" ? "–" : `${s.temp.toFixed(1)}°`}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
