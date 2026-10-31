"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, ZoomControl, useMap } from "react-leaflet";
import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Bell, CheckCircle2, ChevronRight } from "lucide-react";
import { statusMeta, type Alert, type Station } from "@/lib/mock-data";
import { fetchAlerts, regionLabel } from "@/lib/api";
import { useLiveDataWs } from "@/lib/useLiveData";

const severityStyle: Record<string, string> = {
  critical: "text-crit font-bold",
  warning: "text-warn font-bold",
  info: "text-accent font-bold",
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

function StationMarker({
  station,
  active,
  alerts,
  onSelect,
  onOpenNotification,
}: {
  station: Station;
  active: boolean;
  alerts: Alert[];
  onSelect?: (s: Station) => void;
  onOpenNotification?: (alert: Alert) => void;
}) {
  const markerRef = useRef<LeafletCircleMarker>(null);

  // Automatically open the notification popup when selected/redirected
  useEffect(() => {
    if (active && markerRef.current) {
      const timer = setTimeout(() => {
        try {
          markerRef.current?.openPopup();
        } catch {
          // ignore
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [active]);

  const stationAlerts = alerts.filter((a) => a.station === station.id);

  return (
    <CircleMarker
      ref={markerRef}
      center={[station.lat, station.lon]}
      radius={active ? 9 : station.status === "offline" ? 3 : 5}
      pathOptions={{
        color: active ? "#0f1a2e" : statusColor[station.status],
        weight: active ? 2.5 : 1,
        fillColor: statusColor[station.status],
        fillOpacity: station.status === "offline" ? 0.35 : 0.9,
      }}
      eventHandlers={{
        click: () => onSelect?.(station),
      }}
    >
      <Tooltip direction="top" offset={[0, -6]}>
        <span className="text-xs font-semibold">
          {station.id} · {station.name} · {statusMeta[station.status].label}
        </span>
      </Tooltip>

      <Popup minWidth={280} maxWidth={340} autoPan autoPanPadding={[28, 28]}>
        <div className="text-xs space-y-2 break-words p-0.5 font-sans">
          {/* Station Identity Header */}
          <div className="flex items-start justify-between gap-2 border-b border-line pb-2">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-ink truncate">{station.name}</p>
              <p className="font-mono text-[10px] text-sub uppercase">
                {station.id} · {regionLabel(station.region)}
              </p>
            </div>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                station.status === "critical"
                  ? "bg-crit/15 text-crit border border-crit/30"
                  : station.status === "warning"
                  ? "bg-warn/15 text-warn border border-warn/30"
                  : station.status === "offline"
                  ? "bg-sub/15 text-sub border border-sub/30"
                  : "bg-ok/15 text-ok border border-ok/30"
              }`}
            >
              {statusMeta[station.status].label}
            </span>
          </div>

          {/* Quick Telemetry Strip */}
          <div className="grid grid-cols-2 gap-2 rounded bg-raised/50 p-2 font-mono text-[11px]">
            <div>
              <span className="text-sub block text-[9px] uppercase tracking-wider">Surface Temp</span>
              <span className="font-bold text-ink text-xs">
                {station.status === "offline" || station.temp == null ? "–" : `${station.temp.toFixed(1)}°C`}
              </span>
            </div>
            <div>
              <span className="text-sub block text-[9px] uppercase tracking-wider">Coordinates</span>
              <span className="font-semibold text-ink text-[10px]">
                {station.lat.toFixed(2)}°N, {station.lon.toFixed(2)}°E
              </span>
            </div>
          </div>

          {/* Incident / Notification Section */}
          {stationAlerts.length === 0 ? (
            <div className="rounded border border-ok/25 bg-ok/10 p-2 text-[11px] text-ok flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Nominal synoptic telemetry. No active anomaly notifications.</span>
            </div>
          ) : (
            <div className="space-y-1.5 border-t border-line pt-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-crit">
                  <Bell className="h-3 w-3 animate-pulse" />
                  Active Incident Notifications ({stationAlerts.length})
                </span>
              </div>
              <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {stationAlerts.map((a) => (
                  <li key={a.id} className="rounded border border-line bg-surface p-2 text-left shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-[11px] ${severityStyle[a.severity]}`}>
                        {a.code}
                      </span>
                      <span className="font-mono text-[10px] text-sub font-semibold">
                        CONF {a.confidence}%
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-ink">{a.message}</p>
                    <div className="mt-1.5 flex items-center justify-between border-t border-line/50 pt-1 font-mono text-[10px] text-sub">
                      <span>{a.time}</span>
                      {onOpenNotification && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNotification(a);
                          }}
                          className="inline-flex items-center gap-0.5 font-bold text-accent hover:underline cursor-pointer"
                        >
                          Open Dossier <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}

export default function LeafletMapScene({
  stations,
  selectedId,
  onSelect,
  onOpenNotification,
}: {
  stations: Station[];
  selectedId?: string;
  onSelect?: (s: Station) => void;
  onOpenNotification?: (alert: Alert) => void;
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

      {stations.map((s) => (
        <StationMarker
          key={s.id}
          station={s}
          active={s.id === selectedId}
          alerts={alerts}
          onSelect={onSelect}
          onOpenNotification={onOpenNotification}
        />
      ))}

      <MapViewportController stations={stations} selectedStation={selected} />
    </MapContainer>
  );
}
