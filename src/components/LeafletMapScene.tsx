"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { statusMeta, type Alert, type Station } from "@/lib/mock-data";
import { fetchAlerts } from "@/lib/api";
import { useLiveDataWs } from "@/lib/useLiveData";

const severityStyle: Record<string, string> = {
  critical: "text-rose-400",
  warning: "text-amber-400",
  info: "text-cyan-300",
};

const statusColor: Record<Station["status"], string> = {
  normal: "#34d399",
  warning: "#fbbf24",
  critical: "#fb7185",
  offline: "#64748b",
};

const OSM_TILE = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

function useIsLight() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const check = () => setLight(document.documentElement.classList.contains("light"));
    check();
    window.addEventListener("themechange", check);
    return () => window.removeEventListener("themechange", check);
  }, []);
  return light;
}

function stationIcon(color: string, ringColor: string, selected: boolean) {
  const box = selected ? 34 : 26;
  const dot = selected ? 7 : 5;
  const half = box / 2;
  return L.divIcon({
    className: "",
    iconSize: [box, box],
    iconAnchor: [half, half],
    html: `
      <span class="station-pin" style="width:${box}px;height:${box}px;">
        <span class="station-pin__ping" style="width:${dot}px;height:${dot}px;background:${ringColor};"></span>
        <span class="station-pin__dot" style="width:${dot}px;height:${dot}px;background:${color};"></span>
      </span>
    `,
  });
}

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
  const light = useIsLight();
  const alerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts");
  const selected = stations.find((s) => s.id === selectedId);

  return (
    <MapContainer
      center={[22.5, 80]}
      zoom={5}
      minZoom={4}
      maxZoom={18}
      scrollWheelZoom
      className={`h-full w-full ${light ? "" : "map-dark-tiles"}`}
      style={{ background: light ? "#eef1f8" : "#0b1220" }}
    >
      <TileLayer url={OSM_TILE.url} attribution={OSM_TILE.attribution} />

      {stations.map((s) => {
        const stationAlerts = alerts.filter((a) => a.station === s.id);
        const active = s.id === selectedId;
        return (
          <Marker
            key={s.id}
            position={[s.lat, s.lon]}
            icon={stationIcon(statusColor[s.status], statusColor[s.status], active)}
            eventHandlers={{ click: () => onSelect?.(s) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <span className="text-xs">
                {s.id} · {s.name} · {statusMeta[s.status].label}
              </span>
            </Tooltip>

            <Popup minWidth={220}>
              <div className="text-xs space-y-1.5">
                <p className="font-semibold text-sm">
                  {s.id} · {s.name}
                </p>
                <p className={statusMeta[s.status].color}>
                  {statusMeta[s.status].label}
                  {s.status !== "offline" && ` · ${s.temp}°C`}
                </p>

                {stationAlerts.length === 0 ? (
                  <p className="text-muted">No active anomaly. Readings within expected range.</p>
                ) : (
                  <ul className="space-y-1.5 pt-1 border-t border-border">
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
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {selected && <FlyToSelected station={selected} />}
    </MapContainer>
  );
}
