"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, Customized, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import type { SeriesPoint } from "@/lib/mock-data";

// SVG presentation attributes can't resolve CSS variables, so read the
// console tokens once and again whenever the theme flips.
function useTokens() {
  const [t, setT] = useState({ accent: "#5b8cff", accent2: "#3556d8", accent3: "#9bb8ff", line: "#232a42", sub: "#8f98b3", surface: "#0f1320", ink: "#eaecf5" });
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const v = (n: string) => s.getPropertyValue(n).trim();
      setT({ accent: v("--c-accent"), accent2: v("--c-accent-2"), accent3: v("--c-accent-3"), line: v("--c-line"), sub: v("--c-sub"), surface: v("--c-surface"), ink: v("--c-ink") });
    };
    read();
    window.addEventListener("themechange", read);
    return () => window.removeEventListener("themechange", read);
  }, []);
  return t;
}

function tooltipStyle(t: ReturnType<typeof useTokens>) {
  return {
    contentStyle: { background: t.surface, border: `1px solid ${t.line}`, borderRadius: 8, fontSize: 12, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.5)", color: t.ink },
    labelStyle: { color: t.sub },
    itemStyle: { color: t.ink },
    cursor: { stroke: t.line },
    isAnimationActive: true,
    animationDuration: 280,
    animationEasing: "ease-out" as const,
  };
}

const PERIOD = 6000;
const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/** Beeping dot that runs along the plotted line in one direction. It fades out
 *  as it reaches the end and fades in as it leaves the start, so the restart
 *  is never a visible jump. A short trail follows it. */
function TravelingDot({ wrap, fill, ring }: { wrap: React.RefObject<HTMLDivElement | null>; fill: string; ring: string }) {
  const g = useRef<SVGGElement>(null);
  const trail = useRef<(SVGCircleElement | null)[]>([]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = (now: number) => {
      const path = wrap.current?.querySelector<SVGPathElement>("path.recharts-area-curve");
      const len = path?.getTotalLength() ?? 0;
      if (path && len > 0 && g.current) {
        const p = (now % PERIOD) / PERIOD;
        const head = path.getPointAtLength(p * len);
        g.current.setAttribute("transform", `translate(${head.x},${head.y})`);
        g.current.style.opacity = String(smooth(p / 0.08) * smooth((1 - p) / 0.08));
        trail.current.forEach((c, i) => {
          if (!c) return;
          const q = p - ((i + 1) * 70) / PERIOD;
          if (q < 0) {
            c.setAttribute("visibility", "hidden");
            return;
          }
          const pt = path.getPointAtLength(q * len);
          c.setAttribute("visibility", "visible");
          c.setAttribute("cx", String(pt.x - head.x));
          c.setAttribute("cy", String(pt.y - head.y));
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [wrap]);
  return (
    <g ref={g} style={{ opacity: 0 }} pointerEvents="none">
      {[0.32, 0.2, 0.12].map((o, i) => (
        <circle key={i} ref={(el) => { trail.current[i] = el; }} r={3 - i * 0.5} fill={fill} opacity={o} />
      ))}
      <circle className="live-ping" r={4} fill={ring} />
      <circle r={3.5} fill={fill} />
    </g>
  );
}

/** Readout + line chart for one measurement. */
export function TrendChart({
  label,
  unit,
  current,
  data,
  note,
  live,
}: {
  label: string;
  unit: string;
  current: number | null | undefined;
  data: SeriesPoint[];
  note?: string;
  /** Pulsing latest point, sweeping scan line and eased redraws. */
  live?: boolean;
}) {
  const t = useTokens();
  const gid = useId().replace(/:/g, "");
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <div className="bg-surface p-4 min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-sub">{label}</p>
        {live && <span className="live-tag"><i />Live</span>}
        {note && <p className="text-[11px] text-sub truncate ml-auto">{note}</p>}
      </div>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-2xl font-medium tabular-nums text-ink">{current ?? "-"}</span>
        <span className="text-xs text-sub">{unit}</span>
      </p>
      <div ref={wrap} className="relative mt-3 h-28">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded border border-dashed border-line text-xs text-sub">
            No readings yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.accent} stopOpacity={0.45} />
                  <stop offset="60%" stopColor={t.accent2} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={t.accent2} stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`${gid}-stroke`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={t.accent} />
                  <stop offset="100%" stopColor={t.accent3} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={t.line} strokeDasharray="3 4" />
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
              <Area
                type="monotone"
                dataKey="value"
                stroke={`url(#${gid}-stroke)`}
                strokeWidth={2}
                fill={`url(#${gid}-fill)`}
                dot={false}
                activeDot={{ r: 3.5, fill: t.accent, stroke: t.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
              {live && <Customized component={<TravelingDot wrap={wrap} fill={t.accent3} ring={t.accent} />} />}
            </AreaChart>
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
  const gid = useId().replace(/:/g, "");
  if (data.length === 0) {
    return <div className="flex h-full items-center justify-center text-xs text-sub">No data in this window</div>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`${gid}-bar`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.accent3} />
            <stop offset="50%" stopColor={t.accent} />
            <stop offset="100%" stopColor={t.accent2} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={t.line} strokeDasharray="3 4" />
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
          cursor={{ fill: t.line, fillOpacity: 0.5 }}
          labelFormatter={(v) => new Date(v as string).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
        />
        <Bar
          dataKey={yKey}
          name="Anomalies"
          fill={`url(#${gid}-bar)`}
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
          cursor={onSelect ? "pointer" : undefined}
          onClick={(entry) => onSelect?.(String((entry as { payload?: Record<string, unknown> }).payload?.[xKey]))}
        >
          {data.map((d) => (
            <Cell
              key={String(d[xKey])}
              className={`bar-cell${selected === d[xKey] ? " is-selected" : ""}`}
              fillOpacity={!selected || selected === d[xKey] ? 1 : 0.35}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Wide gradient line chart of one series over time, with axes. */
export function TimelineChart({ data, label }: { data: { t: string; value: number }[]; label: string }) {
  const t = useTokens();
  const gid = useId().replace(/:/g, "");
  if (data.length < 2) {
    return <div className="flex h-full items-center justify-center text-xs text-sub">Not enough history</div>;
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`${gid}-f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.accent} stopOpacity={0.4} />
            <stop offset="65%" stopColor={t.accent2} stopOpacity={0.12} />
            <stop offset="100%" stopColor={t.accent2} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${gid}-s`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={t.accent} />
            <stop offset="100%" stopColor={t.accent3} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={t.line} strokeDasharray="3 4" />
        <XAxis dataKey="t" tick={{ fontSize: 10, fill: t.sub }} axisLine={false} tickLine={false} minTickGap={48} />
        <YAxis width={28} allowDecimals={false} tick={{ fontSize: 10, fill: t.sub }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle(t)} formatter={(v) => [v, label]} />
        <Area type="monotone" dataKey="value" stroke={`url(#${gid}-s)`} strokeWidth={2} fill={`url(#${gid}-f)`} dot={false} activeDot={{ r: 3.5, fill: t.accent3, stroke: t.surface, strokeWidth: 2 }} isAnimationActive />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal gradient bars, one per row, 0-100 scale. */
export function RankBars({ data }: { data: { name: string; value: number }[] }) {
  const t = useTokens();
  const gid = useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36 + 8)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap={10}>
        <defs>
          <linearGradient id={`${gid}-h`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={t.accent2} />
            <stop offset="55%" stopColor={t.accent} />
            <stop offset="100%" stopColor={t.accent3} />
          </linearGradient>
        </defs>
        <CartesianGrid horizontal={false} stroke={t.line} strokeDasharray="3 4" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: t.sub }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: t.ink }} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle(t)} cursor={{ fill: t.line, fillOpacity: 0.4 }} formatter={(v) => [`${v}%`, "Need"]} />
        <Bar dataKey="value" fill={`url(#${gid}-h)`} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  );
}
