"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, ZoomControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { statusMeta, type Alert, type Station } from "@/lib/mock-data";
import { fetchAlerts } from "@/lib/api";
import { useLiveDataWs } from "@/lib/useLiveData";

const severityStyle: Record<string, string> = {
  critical: "text-crit",
  warning: "text-warn",
  info: "text-accent",
};

const statusText: Record<Station["status"], string> = {
  normal: "text-accent",
  new: "text-sub",
  warning: "text-warn",
  critical: "text-crit",
  offline: "text-sub",
};

const statusColor: Record<Station["status"], string> = {
  normal: "#1d4ed8",
  new: "#60a5fa",
  warning: "#b45309",
  critical: "#b91c1c",
  offline: "#94a3b8",
};

const OSM_TILE = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

function FlyToSelected({ station }: { station: Station }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([station.lat, station.lon], Math.max(map.getZoom(), 6), { duration: 0.8 });
  }, [station, map]);
  return null;
}

export default function LeafletMapScene({
  stations,
  selectedId,
  onSelect,
}: {
  stations: Station[];
  selectedId?: string;
  onSelect?: (s: Station) => void;
}) {
  const alerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts");
  const selected = stations.find((s) => s.id === selectedId);

  return (
    <MapContainer
      center={[22.5, 80]}
      zoom={5}
      minZoom={4}
      maxZoom={18}
      scrollWheelZoom
      zoomControl={false}
      // ~3,000 stations: canvas circles instead of one DOM pin each.
      preferCanvas
      className="h-full w-full"
      style={{ background: "#eef2f8" }}
    >
      <TileLayer url={OSM_TILE.url} attribution={OSM_TILE.attribution} />
      <ZoomControl position="topright" />

      {stations.map((s) => {
        const stationAlerts = alerts.filter((a) => a.station === s.id);
        const active = s.id === selectedId;
        return (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lon]}
            radius={active ? 8 : s.status === "offline" ? 3 : 5}
            pathOptions={{
              color: active ? "#0f1a2e" : statusColor[s.status],
              weight: active ? 2 : 1,
              fillColor: statusColor[s.status],
              fillOpacity: s.status === "offline" ? 0.35 : 0.85,
            }}
            eventHandlers={{ click: () => onSelect?.(s) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-xs">
                {s.id} · {s.name} · {statusMeta[s.status].label}
              </span>
            </Tooltip>

            <Popup minWidth={220} maxWidth={280} keepInView autoPanPadding={[24, 24]}>
              <div className="text-xs space-y-1.5 break-words">
                <p className="font-semibold text-sm">
                  {s.id} · {s.name}
                </p>
                <p className={statusText[s.status]}>
                  {statusMeta[s.status].label}
                  {s.status !== "offline" && s.temp != null && ` · ${s.temp}°C`}
                </p>

                {stationAlerts.length === 0 ? (
                  <p className="text-muted">No active anomaly. Readings within expected range.</p>
                ) : (
                  <div className="pt-2 border-t border-border">
                    <p className="font-semibold">Alerts ({stationAlerts.length})</p>
                    <ul
                      tabIndex={0}
                      aria-label={`Alerts for ${s.name}`}
                      className="space-y-1.5 overflow-y-auto overscroll-contain pr-2 focus-visible:outline-2 focus-visible:outline-accent"
                      style={{ maxHeight: "min(240px, 35dvh)" }}
                    >
                    {stationAlerts.map((a) => (
                      <li key={a.id}>
                        <p className={`font-mono text-[11px] ${severityStyle[a.severity]}`}>{a.code}</p>
                        <p className="text-muted">{a.message}</p>
                        <p className="text-muted">
                          {a.time} · confidence {a.confidence}%
                        </p>
                      </li>
                    ))}
                    </ul>
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {selected && <FlyToSelected station={selected} />}
    </MapContainer>
  );
}
