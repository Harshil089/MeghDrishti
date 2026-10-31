"use client";

import { useEffect, useRef } from "react";
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

function MapViewportController({
  stations,
  selectedStation,
}: {
  stations: Station[];
  selectedStation?: Station;
}) {
  const map = useMap();
  const prevSelectedIdRef = useRef<string | undefined>(undefined);
  const prevStationsSigRef = useRef<string>("");

  useEffect(() => {
    // 1. If a specific station was selected/changed by the user
    if (selectedStation && selectedStation.id !== prevSelectedIdRef.current) {
      prevSelectedIdRef.current = selectedStation.id;
      map.flyTo([selectedStation.lat, selectedStation.lon], Math.max(map.getZoom(), 8), {
        duration: 0.8,
      });
      return;
    }
    prevSelectedIdRef.current = selectedStation?.id;

    // 2. If the station collection changed (e.g., state selected, switched, or cleared)
    const sig = `${stations.length}:${stations[0]?.id ?? ""}:${stations[stations.length - 1]?.id ?? ""}`;
    if (sig !== prevStationsSigRef.current) {
      prevStationsSigRef.current = sig;

      if (stations.length === 0) {
        // Return to pan-India overview
        map.setView([22.5, 80], 5, { animate: true });
        return;
      }

      if (selectedStation) return;

      const valid = stations.filter(
        (s) => typeof s.lat === "number" && typeof s.lon === "number" && !isNaN(s.lat) && !isNaN(s.lon)
      );
      if (valid.length === 0) return;

      if (valid.length === 1) {
        map.flyTo([valid[0].lat, valid[0].lon], 9, { duration: 0.8 });
      } else {
        const lats = valid.map((s) => s.lat);
        const lons = valid.map((s) => s.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        if (minLat === maxLat && minLon === maxLon) {
          map.flyTo([minLat, minLon], 9, { duration: 0.8 });
        } else {
          map.fitBounds(
            [
              [minLat, minLon],
              [maxLat, maxLon],
            ],
            {
              padding: [48, 48],
              maxZoom: 10,
              duration: 0.8,
            }
          );
        }
      }
    }
  }, [stations, selectedStation, map]);

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

      <MapViewportController stations={stations} selectedStation={selected} />
    </MapContainer>
  );
}
