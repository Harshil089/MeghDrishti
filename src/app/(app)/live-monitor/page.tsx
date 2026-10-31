"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, RefreshCw, Radio, MapPin } from "lucide-react";
import { StationPicker } from "@/components/console/StationPicker";
import { PageHeader, Section, Metric, MetricStrip, Empty, button, card, table } from "@/components/console/ui";
import { TrendChart } from "@/components/console/TrendChart";
import { fetchStationObservations, fetchStationOptions, pullLatest, seriesFromReadings } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useLiveData } from "@/lib/useLiveData";

const cell = (v: number | null | undefined) => v ?? "-";

function Delta({ now, prev, unit = "" }: { now: number | null | undefined; prev: number | null | undefined; unit?: string }) {
  if (now == null || prev == null) return <span>Awaiting prior packet</span>;
  const d = +(now - prev).toFixed(2);
  const Icon = d > 0 ? ArrowUp : d < 0 ? ArrowDown : Minus;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
      <Icon className="h-3 w-3 text-accent" />
      <span className="tabular-nums font-semibold text-ink">
        {d > 0 ? "+" : ""}
        {d}
        {unit}
      </span>{" "}
      <span className="text-sub">vs prev packet</span>
    </span>
  );
}

function Dial({
  code,
  label,
  value,
  unit,
  max,
  note,
}: {
  code: string;
  label: string;
  value: number | null | undefined;
  unit: string;
  max: number;
  note: string;
}) {
  const v = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  const a = Math.PI * (1 - v);
  const x = 80 + 62 * Math.cos(a),
    y = 80 - 62 * Math.sin(a);
  return (
    <div className={`${card} border-t-2 border-t-accent flex flex-col items-center px-4 pb-3.5 pt-3.5`}>
      <div className="flex w-full items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">{label}</span>
        <span className="font-mono text-[10px] text-accent">{code}</span>
      </div>
      <svg viewBox="0 0 160 88" className="mt-1 w-full max-w-[180px]" aria-hidden>
        <path d="M18 80A62 62 0 0 1 142 80" fill="none" stroke="var(--c-raised)" strokeWidth="11" strokeLinecap="butt" />
        {value != null && v > 0 && (
          <path
            d={`M18 80A62 62 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`}
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth="11"
            strokeLinecap="butt"
          />
        )}
      </svg>
      <p className="-mt-6 flex items-baseline gap-1">
        <span className="font-mono text-2xl font-bold tabular-nums tracking-tight text-ink">{value ?? "–"}</span>
        <span className="font-mono text-xs text-sub">{unit}</span>
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-sub">{note}</p>
    </div>
  );
}

const ago = (iso: string | undefined) => {
  if (!iso) return "";
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
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

  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (readings.length === 0) return;
    const ids = new Set(readings.map((r) => r.id));
    if (seen.current) setFresh(new Set([...ids].filter((id) => !seen.current!.has(id))));
    seen.current = ids;
  }, [readings]);

  function handleStationChange(nextId: string) {
    seen.current = null;
    setFresh(new Set());
    setStationId(nextId);
  }

  const { user } = useAuth();
  const [pulling, setPulling] = useState(false);
  const [pullMsg, setPullMsg] = useState<string | null>(null);
  async function pull() {
    setPulling(true);
    setPullMsg(null);
    try {
      const { stored, failed } = await pullLatest(24 * 60);
      setPullMsg(
        `${stored} new readings queued${failed ? `, ${failed} stations failed` : ""}. Processing takes a minute.`
      );
    } catch (err) {
      setPullMsg(err instanceof Error ? err.message : "Pull failed");
    } finally {
      setPulling(false);
    }
  }
  const latest = readings[0];
  const prev = readings[1];

  const lanes = [
    { key: "temperature_c", code: "TEMP", label: "Surface Air Temperature", unit: "°C", data: series.temperature },
    { key: "humidity_pct", code: "RH", label: "Relative Humidity", unit: "%", data: series.humidity },
    { key: "pressure_hpa", code: "PRES", label: "Barometric Station Pressure", unit: "hPa", data: series.pressure },
  ] as const;
  const activeStation = stations.find((s) => s.dbId === activeId);
  const stationName = activeStation?.name;

  return (
    <>
      <PageHeader
        code="SYS-TEL-02 // REAL-TIME STATION PACKET STREAM"
        title={stationName ? `Live Telemetry · ${stationName}` : "Live Station Telemetry"}
        description="High-frequency 10-second polling of raw AWS observations, multi-parameter waveform traces, and packet-to-packet delta tracking."
        actions={<StationPicker stations={stations} value={activeId} onChange={handleStationChange} />}
      />

      {/* Live Uplink Status Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded border border-ok/30 bg-ok/10 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-ok">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            TELEMETRY UPLINK ACTIVE
          </span>
          <span className="font-mono text-xs text-sub">
            {activeStation ? `STATION CODE: ${activeStation.code} · ` : ""}
            {latest ? `LAST PACKET: ${ago(latest.timestamp)} · SOURCE: ${latest.source}` : "AWAITING INITIAL PACKET"}
          </span>
          {activeStation && (
            <Link
              href={`/network?station=${activeStation.code}&notify=1`}
              className="inline-flex items-center gap-1 rounded border border-line bg-raised/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent hover:bg-raised transition-colors"
            >
              <MapPin className="h-3 w-3 text-accent" /> Locate on Grid Map →
            </Link>
          )}
        </div>

        {user?.roles.includes("ADMIN") && (
          <button
            onClick={pull}
            disabled={pulling}
            className={button}
            title="Fetch the last 24 hours for all stations; existing readings are skipped"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pulling ? "animate-spin" : ""}`} />
            {pulling ? "Synchronizing…" : "Backfill 24h Telemetry"}
          </button>
        )}
      </div>

      {pullMsg && (
        <p role="status" className="mb-4 rounded border border-accent/30 bg-accent-soft px-4 py-2.5 font-mono text-xs text-ink">
          {pullMsg}
        </p>
      )}

      {!activeId ? (
        <div className={card}>
          <Empty>No stations available in directory.</Empty>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top 4-Parameter Live Readout Strip */}
          <MetricStrip cols={4}>
            <Metric
              label="Air Temperature (TEMP)"
              value={cell(latest?.temperature_c)}
              unit="°C"
              tone="info"
              foot={<Delta now={latest?.temperature_c} prev={prev?.temperature_c} unit="°C" />}
            />
            <Metric
              label="Relative Humidity (RH)"
              value={cell(latest?.humidity_pct)}
              unit="%"
              tone="ok"
              foot={<Delta now={latest?.humidity_pct} prev={prev?.humidity_pct} unit="%" />}
            />
            <Metric
              label="Station Pressure (PRES)"
              value={cell(latest?.pressure_hpa)}
              unit="hPa"
              tone="neutral"
              foot={<Delta now={latest?.pressure_hpa} prev={prev?.pressure_hpa} unit=" hPa" />}
            />
            <Metric
              label="Wind Speed & Precipitation"
              value={`${cell(latest?.wind_speed_ms)} m/s`}
              unit={`· ${cell(latest?.rainfall_mm)} mm`}
              tone="neutral"
              foot={<Delta now={latest?.wind_speed_ms} prev={prev?.wind_speed_ms} unit=" m/s" />}
            />
          </MetricStrip>

          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Section
              title="Multi-Parameter Synoptic Waveform Traces"
              meta="20-PACKET ROLLING WINDOW · 10S REFRESH"
              flush
              actions={
                <span className="live-tag">
                  <i /> Live Trace
                </span>
              }
            >
              <div className="divide-y divide-line px-5">
                {lanes.map((l) => (
                  <div key={l.key} className="grid grid-cols-1 items-center gap-4 py-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent">
                          {l.code}
                        </span>
                        <span className="truncate text-xs font-semibold text-ink">{l.label}</span>
                      </div>
                      <p className="mt-2 flex items-baseline gap-1">
                        <span className="font-mono text-3xl font-bold tabular-nums tracking-tight text-ink">
                          {cell(latest?.[l.key])}
                        </span>
                        <span className="font-mono text-xs text-sub">{l.unit}</span>
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
              </div>
            </Section>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <Dial
                code="WMO-RH"
                label="Relative Humidity"
                value={latest?.humidity_pct}
                unit="%"
                max={100}
                note={readings[1] ? `PREV: ${cell(readings[1].humidity_pct)}%` : "SCALE 0–100%"}
              />
              <Dial
                code="WMO-WIND"
                label="Surface Wind Velocity"
                value={latest?.wind_speed_ms}
                unit="m/s"
                max={20}
                note="SCALE 0–20 M/S"
              />
              <Dial
                code="WMO-PRECIP"
                label="Tipping-Bucket Rain"
                value={latest?.rainfall_mm}
                unit="mm"
                max={50}
                note="15-MIN ACCUMULATION (0–50 MM)"
              />
            </div>
          </div>

          <Section
            title="Raw Telemetry Packet Stream"
            meta={`NEWEST FIRST · ${readings.length} STORED OBSERVATIONS`}
            flush
            actions={
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-sub">
                <Radio className="h-3.5 w-3.5 text-accent" /> Auto-Polling 10s
              </span>
            }
          >
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={`${table.th} pl-5`}>Packet Timestamp (Local)</th>
                    <th className={table.th}>Telemetry Source</th>
                    <th className={table.thNum}>Air Temp (°C)</th>
                    <th className={table.thNum}>Rel. Humidity (%)</th>
                    <th className={table.thNum}>Pressure (hPa)</th>
                    <th className={table.thNum}>Rainfall (mm)</th>
                    <th className={`${table.thNum} pr-5`}>Wind Speed (m/s)</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <Empty>No telemetry observations recorded for this station.</Empty>
                      </td>
                    </tr>
                  )}
                  {readings.map((r) => (
                    <tr key={r.id} className={`${table.row} ${fresh.has(r.id) ? "row-flash" : ""}`}>
                      <td className={`${table.td} pl-5 font-mono text-xs font-medium text-ink whitespace-nowrap`}>
                        {new Date(r.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </td>
                      <td className={table.td}>
                        <span className="rounded border border-line bg-raised px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-sub">
                          {r.source}
                        </span>
                      </td>
                      <td className={table.num}>{cell(r.temperature_c)}</td>
                      <td className={table.num}>{cell(r.humidity_pct)}</td>
                      <td className={table.num}>{cell(r.pressure_hpa)}</td>
                      <td className={table.num}>{cell(r.rainfall_mm)}</td>
                      <td className={`${table.num} pr-5`}>{cell(r.wind_speed_ms)}</td>
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
