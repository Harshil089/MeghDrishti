"use client";

// Linear & Apple Notes Inspired Console Design System Primitives
// High density, zero fluff, instant visual clarity.
import React, { type ReactNode } from "react";
import { motion } from "framer-motion";
import { motionTransitions } from "@/lib/motion-tokens";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

export type Tone = "ok" | "warn" | "crit" | "info" | "neutral";

const toneText: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
  info: "text-accent",
  neutral: "text-sub",
};

const toneFill: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
  info: "bg-accent",
  neutral: "bg-sub/60",
};

const toneTopBorder: Record<Tone, string> = {
  ok: "border-t-2 border-t-ok",
  warn: "border-t-2 border-t-warn",
  crit: "border-t-2 border-t-crit",
  info: "border-t-2 border-t-accent",
  neutral: "border-t-2 border-t-line",
};

const toneBadgeStyle: Record<Tone, string> = {
  ok: "border-ok/30 bg-ok/10 text-ok",
  warn: "border-warn/30 bg-warn/10 text-warn",
  crit: "border-crit/30 bg-crit/10 text-crit",
  info: "border-accent/30 bg-accent-soft text-accent",
  neutral: "border-line bg-raised text-sub",
};

const toneDot: Record<Tone, string> = {
  ok: "bg-ok shadow-[0_0_6px_rgba(21,128,61,0.5)]",
  warn: "bg-warn shadow-[0_0_6px_rgba(180,83,9,0.5)]",
  crit: "bg-crit shadow-[0_0_6px_rgba(185,28,28,0.5)]",
  info: "bg-accent shadow-[0_0_6px_rgba(29,78,216,0.5)]",
  neutral: "bg-sub/70",
};

/** Crisp, uncluttered page heading: clean title and action bar. */
export function PageHeader({
  title,
  actions,
}: {
  title: string;
  description?: string;
  code?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="relative z-20 mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line/80 pb-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-[26px]">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Focused, high-contrast container with refined header and clean elevation. */
export function Section({
  title,
  meta,
  actions,
  flush,
  className = "",
  children,
}: {
  title?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`c-card group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all duration-200 hover:shadow-xs ${className}`}
    >
      {title && (
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line bg-raised/35 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="truncate text-xs font-semibold tracking-tight text-ink">{title}</h2>
            {meta && <span className="truncate font-mono text-[11px] text-sub">{meta}</span>}
          </div>
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "min-h-0 flex-1" : "flex-1 p-4 md:p-5"}>{children}</div>
    </section>
  );
}

/** Formats numeric display with EasyUI AnimatedNumber where appropriate */
function renderMetricValue(value: ReactNode): ReactNode {
  if (typeof value === "number") {
    const isFloat = value % 1 !== 0;
    return <AnimatedNumber value={value} decimals={isFloat ? 1 : 0} />;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== "" && !trimmed.includes(":")) {
      const parts = trimmed.split(".");
      const decimals = parts.length > 1 ? parts[1].length : 0;
      return <AnimatedNumber value={num} decimals={decimals} />;
    }
  }
  return value;
}

/** Minimal, razor-sharp KPI cell designed for Linear-style dashboards. */
export function Metric({
  label,
  value,
  unit,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  foot?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div
      className={`group relative min-w-0 bg-surface px-4 py-3.5 transition-colors duration-200 hover:bg-raised/30 ${toneTopBorder[tone]}`}
    >
      <p className="truncate text-xs font-medium text-sub">{label}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={`font-mono text-2xl font-semibold tabular-nums tracking-tight ${
            tone === "neutral" ? "text-ink" : toneText[tone]
          }`}
        >
          {renderMetricValue(value)}
        </span>
        {unit && <span className="font-mono text-xs text-sub">{unit}</span>}
      </div>
    </div>
  );
}

/** Hairline-divided row of metrics (1px structural grid). */
export function MetricStrip({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 6 }) {
  const grid = {
    2: "grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
  }[cols];
  return (
    <div className={`grid ${grid} gap-px overflow-hidden rounded-xl border border-line bg-line shadow-xs`}>
      {children}
    </div>
  );
}

/** Minimal status badge with status dot. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 rounded-full border px-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider leading-none whitespace-nowrap transition-colors ${toneBadgeStyle[tone]}`}
    >
      <i aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[tone]}`} />
      <span className="inline-block leading-none">{children}</span>
    </span>
  );
}

/** Precision horizontal meter bar with smooth spring fill. */
export function Meter({ pct, tone = "info" }: { pct: number; tone?: Tone }) {
  const bounded = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised" role="presentation">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${bounded}%` }}
        transition={motionTransitions.springSmooth}
        className={`meter-fill h-full rounded-full ${toneFill[tone]}`}
      />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center font-mono text-xs uppercase tracking-wider text-sub">{children}</p>;
}

export { Select } from "@/components/console/Select";

export const field =
  "h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] text-ink placeholder:text-sub/75 transition-colors focus-visible:outline-2 focus-visible:outline-accent";

export const button =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink transition-all hover:bg-raised active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer";

export const buttonPrimary =
  "inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-xs font-semibold text-on-accent transition-all hover:bg-accent/90 shadow-xs active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer";

/** Standard card shell. */
export const card = "c-card rounded-xl";

/** Filter tab / chip with tactile spring states. */
export function chip(on: boolean) {
  return `inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all active:scale-[0.97] cursor-pointer ${
    on
      ? "border-accent bg-accent-soft text-accent font-semibold shadow-xs"
      : "border-line bg-surface text-sub hover:bg-raised hover:text-ink"
  }`;
}

/** Monospace section eyebrow. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-sub">{children}</p>;
}

/** High-density institutional data table classes. */
export const table = {
  wrap: "overflow-x-auto",
  table: "w-full text-[13px] border-collapse",
  head: "bg-raised/60 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-sub",
  th: "px-4 h-9 font-semibold whitespace-nowrap border-b border-line",
  row: "border-b border-line/80 last:border-0 transition-colors hover:bg-raised/50",
  td: "px-4 py-2.5",
  num: "px-4 py-2.5 font-mono text-xs tabular-nums text-right text-ink",
  thNum: "px-4 h-9 font-semibold whitespace-nowrap border-b border-line text-right",
};

/** Map a 0-100 health/reliability value to a status tone. */
export function healthTone(pct: number | null): Tone {
  if (pct === null) return "neutral";
  if (pct >= 90) return "ok";
  if (pct >= 70) return "warn";
  return "crit";
}

/** Map a 0-100 risk value (higher is worse) to a status tone. */
export function riskTone(pct: number): Tone {
  if (pct >= 50) return "crit";
  if (pct >= 25) return "warn";
  return "ok";
}

export const severityTone: Record<string, Tone> = {
  critical: "crit",
  warning: "warn",
  info: "info",
  CRITICAL: "crit",
  HIGH: "crit",
  MEDIUM: "warn",
  LOW: "info",
};
