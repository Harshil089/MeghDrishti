"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Minus, RefreshCw } from "lucide-react";
import { StationPicker } from "@/components/console/StationPicker";
import { PageHeader, Empty, button, card, table } from "@/components/console/ui";
import { TrendChart } from "@/components/console/TrendChart";
import { fetchStationObservations, fetchStationOptions, pullLatest, seriesFromReadings, type LiveReading } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useLiveData } from "@/lib/useLiveData";

const cell = (v: number | null | undefined) => v ?? "-";

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

/** Half-ring gauge for a value on a fixed scale. */
function Dial({ label, value, unit, max, note }: { label: string; value: number | null | undefined; unit: string; max: number; note: string }) {
  const v = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  const a = Math.PI * (1 - v);
  const x = 80 + 64 * Math.cos(a), y = 80 - 64 * Math.sin(a);
  return (
    <div className={`${card} flex flex-col items-center px-5 pb-4 pt-5`}>
      <p className="self-start text-xs text-sub">{label}</p>
      <svg viewBox="0 0 160 88" className="mt-1 w-full max-w-[200px]" aria-hidden>
        <path d="M16 80A64 64 0 0 1 144 80" fill="none" stroke="var(--c-raised)" strokeWidth="12" strokeLinecap="round" />
        {value != null && v > 0 && <path d={`M16 80A64 64 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke="var(--c-accent)" strokeWidth="12" strokeLinecap="round" />}
      </svg>
      <p className="-mt-6 flex items-baseline gap-1">
        <span className="text-3xl font-light tracking-tight text-ink">{value ?? "–"}</span>
        <span className="text-xs text-sub">{unit}</span>
      </p>
      <p className="mt-1 text-[11px] text-sub">{note}</p>
    </div>
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

  const lanes = [
    { key: "temperature_c", label: "Temperature", unit: "°C", data: series.temperature },
    { key: "humidity_pct", label: "Humidity", unit: "%", data: series.humidity },
    { key: "pressure_hpa", label: "Pressure", unit: "hPa", data: series.pressure },
  ] as const;
  const stationName = stations.find((s) => s.dbId === activeId)?.name;

  return (
    <>
      <PageHeader
        title={stationName ? `Live · ${stationName}` : "Live"}
        description="Latest 20 readings for one station, refreshed every 10 seconds."
        actions={<StationPicker stations={stations} value={activeId} onChange={setStationId} />}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
          </span>
          {latest ? `Last reading ${ago(latest.timestamp)} · ${latest.source}` : "Waiting for readings"}
        </span>
        {user?.roles.includes("ADMIN") && (
          <button onClick={pull} disabled={pulling} className={`${button} ml-auto`} title="Fetch the last 24 hours for all stations; existing readings are skipped">
            <RefreshCw className={`h-3.5 w-3.5 ${pulling ? "animate-spin" : ""}`} />
            {pulling ? "Pulling" : "Pull latest"}
          </button>
        )}
      </div>

      {pullMsg && (
        <p role="status" className="mb-4 rounded-xl border border-line bg-surface px-4 py-2.5 text-[13px] text-ink">
          {pullMsg}
        </p>
      )}

      {!activeId ? (
        <div className={card}>
          <Empty>No stations available.</Empty>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className={`${card} divide-y divide-line px-6`}>
              {lanes.map((l) => (
                <div key={l.key} className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-5 py-5">
                  <div>
                    <p className="text-xs text-sub">{l.label}</p>
                    <p className="mt-1 flex items-baseline gap-1">
                      <span className="text-[28px] font-light tracking-tight text-ink">{cell(latest?.[l.key])}</span>
                      <span className="text-xs text-sub">{l.unit}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-sub">
                      <Delta now={latest?.[l.key]} prev={readings[1]?.[l.key]} />
                    </p>
                  </div>
                  <div className="h-24">
                    <TrendChart bare live label={l.label} unit={l.unit} current={latest?.[l.key]} data={l.data} />
                  </div>
                </div>
              ))}
            </section>
            <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
              <Dial label="Humidity" value={latest?.humidity_pct} unit="%" max={100} note={readings[1] ? `was ${cell(readings[1].humidity_pct)} %` : "relative humidity"} />
              <Dial label="Wind" value={latest?.wind_speed_ms} unit="m/s" max={20} note="scale 0–20 m/s" />
              <Dial label="Rain" value={latest?.rainfall_mm} unit="mm" max={50} note="per reading, scale 0–50 mm" />
            </div>
          </div>

          <section className={card}>
            <div className="flex items-baseline gap-3 px-6 pb-2 pt-5">
              <h2 className="text-[15px] font-semibold text-ink">Stream</h2>
              <span className="text-xs text-sub">newest first · {readings.length} readings</span>
            </div>
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={`${table.th} pl-6`}>Time</th>
                    <th className={table.th}>Source</th>
                    <th className={table.thNum}>Temp °C</th>
                    <th className={table.thNum}>Humidity %</th>
                    <th className={table.thNum}>Pressure hPa</th>
                    <th className={table.thNum}>Rain mm</th>
                    <th className={`${table.thNum} pr-6`}>Wind m/s</th>
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
                      <td className={`${table.td} pl-6 font-mono text-xs text-ink whitespace-nowrap`}>
                        {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className={`${table.td} text-sub`}>{r.source}</td>
                      <td className={table.num}>{cell(r.temperature_c)}</td>
                      <td className={table.num}>{cell(r.humidity_pct)}</td>
                      <td className={table.num}>{cell(r.pressure_hpa)}</td>
                      <td className={table.num}>{cell(r.rainfall_mm)}</td>
                      <td className={`${table.num} pr-6`}>{cell(r.wind_speed_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
