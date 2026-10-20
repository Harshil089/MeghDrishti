"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Minus, RefreshCw } from "lucide-react";
import { PageHeader, Section, Select, Empty, Metric, MetricStrip, button, table } from "@/components/console/ui";
import { TrendChart } from "@/components/console/TrendChart";
import { fetchStationObservations, fetchStationOptions, pullLatest, seriesFromReadings, type LiveReading } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useLiveData } from "@/lib/useLiveData";

const cell = (v: number | null | undefined) => v ?? "-";

const TILES = [
  { key: "temperature_c", label: "Temperature", unit: "°C" },
  { key: "humidity_pct", label: "Humidity", unit: "%" },
  { key: "pressure_hpa", label: "Pressure", unit: "hPa" },
  { key: "rainfall_mm", label: "Rainfall", unit: "mm" },
  { key: "wind_speed_ms", label: "Wind", unit: "m/s" },
] as const satisfies readonly { key: keyof LiveReading; label: string; unit: string }[];

/** Change since the previous reading, as a small arrow + number. */
function Delta({ now, prev }: { now: number | null | undefined; prev: number | null | undefined }) {
  if (now == null || prev == null) return <span>No previous reading</span>;
  const d = +(now - prev).toFixed(2);
  const Icon = d > 0 ? ArrowUp : d < 0 ? ArrowDown : Minus;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3 text-accent" />
      <span className="font-mono tabular-nums">{d > 0 ? "+" : ""}{d}</span> since last
    </span>
  );
}

const ago = (iso: string | undefined) => {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

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

  // Rows that arrive after the first load flash once, so new data is noticeable.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (readings.length === 0) return;
    const ids = new Set(readings.map((r) => r.id));
    if (seen.current) setFresh(new Set([...ids].filter((id) => !seen.current!.has(id))));
    seen.current = ids;
  }, [readings]);
  useEffect(() => {
    seen.current = null;
    setFresh(new Set());
  }, [activeId]);

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
          <MetricStrip cols={6}>
            {TILES.map((t) => (
              <Metric
                key={t.key}
                label={t.label}
                value={cell(latest?.[t.key])}
                unit={t.unit}
                foot={<Delta now={latest?.[t.key]} prev={readings[1]?.[t.key]} />}
              />
            ))}
            <Metric label="Latest reading" value={ago(latest?.timestamp) || "-"} foot={latest?.source ?? "No data yet"} />
          </MetricStrip>

          <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
            <TrendChart live label="Temperature" unit="°C" current={latest?.temperature_c} data={series.temperature} note="Normal 18 to 34" />
            <TrendChart live label="Humidity" unit="%" current={latest?.humidity_pct} data={series.humidity} note="Normal 40 to 80" />
            <TrendChart live label="Pressure" unit="hPa" current={latest?.pressure_hpa} data={series.pressure} note="Normal 1000 to 1015" />
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
                    <tr key={r.id} className={`${table.row} ${fresh.has(r.id) ? "row-flash" : ""}`}>
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
