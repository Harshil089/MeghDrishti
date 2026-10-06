"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import StationMap from "@/components/StationMap";
import { PageHeader, Section, Badge, Empty, type Tone } from "@/components/console/ui";
import { statusMeta, type Station, type StationStatus } from "@/lib/mock-data";
import { fetchStations } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const statusTone: Record<StationStatus, Tone> = { normal: "ok", warning: "warn", critical: "crit", offline: "neutral" };

export default function NetworkPage() {
  const stations = useLiveData(fetchStations, [] as Station[]);
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string>(searchParams.get("station") ?? "");
  const selected = stations.find((s) => s.id === selectedId) ?? stations[0];

  const counts = stations.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.status]: (acc[s.status] ?? 0) + 1 }), {});

  return (
    <>
      <PageHeader
        title="Network"
        description="Station locations and current status. Select a station on the map or in the list."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(statusMeta) as StationStatus[]).map((key) => (
              <Badge key={key} tone={statusTone[key]}>
                {statusMeta[key].label} <span className="ml-1 font-mono">{counts[key] ?? 0}</span>
              </Badge>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <Section flush className="lg:col-span-8 overflow-hidden">
          <div className="relative h-[460px] md:h-[600px]">
            {stations.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-sub">Loading station network</div>
            ) : (
              <StationMap stations={stations} selectedId={selected?.id} onSelect={(s) => setSelectedId(s.id)} />
            )}
          </div>
        </Section>

        <Section title="Stations" meta={stations.length ? `${stations.length}` : undefined} flush className="lg:col-span-4">
          {stations.length === 0 ? (
            <Empty>No stations yet</Empty>
          ) : (
            <ul className="max-h-[600px] overflow-y-auto">
              {stations.map((s) => {
                const active = s.id === selected?.id;
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelectedId(s.id)}
                      aria-pressed={active}
                      className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 border-b border-line px-4 py-2.5 text-left transition-colors last:border-0 ${
                        active ? "bg-accent/10" : "hover:bg-raised"
                      }`}
                    >
                      <span className="truncate text-[13px] font-medium text-ink">{s.name}</span>
                      <Badge tone={statusTone[s.status]}>{statusMeta[s.status].label}</Badge>
                      <span className="truncate font-mono text-[11px] text-sub">{s.id}</span>
                      <span className="text-right font-mono text-xs tabular-nums text-ink">
                        {s.status === "offline" ? "-" : `${s.temp}°C`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
