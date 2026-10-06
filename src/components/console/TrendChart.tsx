"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import type { SeriesPoint } from "@/lib/mock-data";

// SVG presentation attributes can't resolve CSS variables, so read the
// console tokens once and again whenever the theme flips.
function useTokens() {
  const [t, setT] = useState({ accent: "#5b9cff", line: "#232831", sub: "#8d949e", surface: "#111419", ink: "#e7e9ec" });
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const v = (n: string) => s.getPropertyValue(n).trim();
      setT({ accent: v("--c-accent"), line: v("--c-line"), sub: v("--c-sub"), surface: v("--c-surface"), ink: v("--c-ink") });
    };
    read();
    window.addEventListener("themechange", read);
    return () => window.removeEventListener("themechange", read);
  }, []);
  return t;
}

function tooltipStyle(t: ReturnType<typeof useTokens>) {
  return {
    contentStyle: { background: t.surface, border: `1px solid ${t.line}`, borderRadius: 6, fontSize: 12, color: t.ink },
    labelStyle: { color: t.sub },
    itemStyle: { color: t.ink },
    cursor: { stroke: t.line },
  };
}

/** Readout + line chart for one measurement. */
export function TrendChart({
  label,
  unit,
  current,
  data,
  note,
}: {
  label: string;
  unit: string;
  current: number | null | undefined;
  data: SeriesPoint[];
  note?: string;
}) {
  const t = useTokens();
  return (
    <div className="bg-surface p-4 min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-sub">{label}</p>
        {note && <p className="text-[11px] text-sub truncate">{note}</p>}
      </div>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-2xl font-medium tabular-nums text-ink">{current ?? "-"}</span>
        <span className="text-xs text-sub">{unit}</span>
      </p>
      <div className="mt-3 h-28">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-line text-xs text-sub">
            No readings yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={t.line} />
              <XAxis dataKey="t" hide />
              <YAxis
                width={36}
                domain={["auto", "auto"]}
                tick={{ fontSize: 10, fill: t.sub }}
                axisLine={false}
                tickLine={false}
                tickCount={3}
              />
              <Tooltip {...tooltipStyle(t)} formatter={(v) => [`${v} ${unit}`, label]} />
              <Line type="monotone" dataKey="value" stroke={t.accent} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/** Compact column chart for counts over time. */
export function CountBars({
  data,
  xKey,
  yKey,
  selected,
  onSelect,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  selected?: string | null;
  onSelect?: (x: string) => void;
}) {
  const t = useTokens();
  if (data.length === 0) {
    return <div className="flex h-full items-center justify-center text-xs text-sub">No data in this window</div>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={t.line} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 10, fill: t.sub }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => new Date(v as string).toLocaleTimeString([], { hour: "2-digit" })}
          minTickGap={24}
        />
        <YAxis width={28} allowDecimals={false} tick={{ fontSize: 10, fill: t.sub }} axisLine={false} tickLine={false} />
        <Tooltip
          {...tooltipStyle(t)}
          cursor={{ fill: t.line }}
          labelFormatter={(v) => new Date(v as string).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
        />
        <Bar
          dataKey={yKey}
          name="Anomalies"
          fill={t.accent}
          radius={[2, 2, 0, 0]}
          isAnimationActive={false}
          cursor={onSelect ? "pointer" : undefined}
          onClick={(entry) => onSelect?.(String((entry as { payload?: Record<string, unknown> }).payload?.[xKey]))}
        >
          {data.map((d) => (
            <Cell key={String(d[xKey])} fillOpacity={!selected || selected === d[xKey] ? 1 : 0.35} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
