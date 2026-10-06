"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader, Section, Select, Empty, button, table } from "@/components/console/ui";
import { TrendChart } from "@/components/console/TrendChart";
import { fetchStationObservations, fetchStationOptions, pullLatest, seriesFromReadings } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useLiveData } from "@/lib/useLiveData";

const cell = (v: number | null | undefined) => v ?? "-";

export default function LiveMonitorPage() {
  const stations = useLiveData(fetchStationOptions, []);
  const [stationId, setStationId] = useState<string>("");
  const activeId = stationId || stations[0]?.dbId || "";

  const readings = useLiveData(
    () => (activeId ? fetchStationObservations(activeId, 20) : Promise.resolve([])),
    [],
    10000,
    [activeId]
  );
  const series = seriesFromReadings(readings);

  // Manual catch-up after sleep/outage: re-pull the last 24 h for all
  // stations. Readings already stored are skipped as duplicates.
  const { user } = useAuth();
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState<string | null>(null);
  async function pull() {
    setPulling(true);
    setPullMsg(null);
    try {
      const { stored, failed } = await pullLatest(24 * 60);
      setPullMsg(`${stored} new readings queued${failed ? `, ${failed} stations failed` : ""}. Processing takes a minute.`);
    } catch (err) {
      setPullMsg(err instanceof Error ? err.message : "Pull failed");
    } finally {
      setPulling(false);
    }
  }
  const latest = readings[0];

  return (
    <>
      <PageHeader
        title="Live"
        description="Latest 20 observations for one station. Refreshes every 10 seconds."
        actions={
          <>
          {user?.roles.includes("ADMIN") && (
            <button onClick={pull} disabled={pulling} className={button} title="Fetch the last 24 hours for all stations; existing readings are skipped">
              <RefreshCw className={`h-3.5 w-3.5 ${pulling ? "animate-spin" : ""}`} />
              {pulling ? "Pulling" : "Pull latest"}
            </button>
          )}
          <Select aria-label="Station" value={activeId} onChange={(e) => setStationId(e.target.value)}>
            {stations.map((s) => (
              <option key={s.dbId} value={s.dbId}>
                {s.code} · {s.name}
              </option>
            ))}
          </Select>
          </>
        }
      />

      {pullMsg && (
        <p role="status" className="mb-4 rounded-md border border-line bg-surface px-4 py-2.5 text-[13px] text-ink">
          {pullMsg}
        </p>
      )}

      {!activeId ? (
        <div className="rounded-md border border-line bg-surface">
          <Empty>No stations available.</Empty>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-3">
            <TrendChart label="Temperature" unit="°C" current={latest?.temperature_c} data={series.temperature} note="Normal 18 to 34" />
            <TrendChart label="Humidity" unit="%" current={latest?.humidity_pct} data={series.humidity} note="Normal 40 to 80" />
            <TrendChart label="Pressure" unit="hPa" current={latest?.pressure_hpa} data={series.pressure} note="Normal 1000 to 1015" />
          </div>

          <Section title="Observations" meta={`${readings.length} rows`} flush>
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Time</th>
                    <th className={table.th}>Source</th>
                    <th className={table.thNum}>Temp °C</th>
                    <th className={table.thNum}>Humidity %</th>
                    <th className={table.thNum}>Pressure hPa</th>
                    <th className={table.thNum}>Rain mm</th>
                    <th className={table.thNum}>Wind m/s</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <Empty>No observations yet for this station.</Empty>
                      </td>
                    </tr>
                  )}
                  {readings.map((r) => (
                    <tr key={r.id} className={table.row}>
                      <td className={`${table.td} font-mono text-xs text-ink whitespace-nowrap`}>
                        {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className={`${table.td} text-sub`}>{r.source}</td>
                      <td className={table.num}>{cell(r.temperature_c)}</td>
                      <td className={table.num}>{cell(r.humidity_pct)}</td>
                      <td className={table.num}>{cell(r.pressure_hpa)}</td>
                      <td className={table.num}>{cell(r.rainfall_mm)}</td>
                      <td className={table.num}>{cell(r.wind_speed_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </>
  );
}
