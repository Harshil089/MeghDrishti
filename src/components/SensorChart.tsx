"use client";

import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import type { SeriesPoint } from "@/lib/mock-data";

export default function SensorChart({
  title,
  unit,
  current,
  range,
  data,
  color,
}: {
  title: string;
  unit: string;
  current: number;
  range: string;
  data: SeriesPoint[];
  color: string;
}) {
  const gradientId = `grad-${title.replace(/\s+/g, "-")}`;
  return (
    <div className="glass rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-muted">{title}</p>
        <span className="h-1.5 w-1.5 rounded-full animate-pulse-slow" style={{ background: color }} />
      </div>
      <p className="text-2xl font-semibold" style={{ color }}>
        {current}
        <span className="text-sm text-muted ml-1">{unit}</span>
      </p>
      <p className="text-[11px] text-muted mb-2">normal range {range}</p>
      <div className="h-20 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" hide />
            <Tooltip
              contentStyle={{
                background: "#0b1220",
                border: "1px solid #1c2740",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#8492ab" }}
            />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
