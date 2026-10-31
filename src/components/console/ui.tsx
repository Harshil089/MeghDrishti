// Institutional Console Design System Primitives
// Standardized across all MoES / IMD National AWS Telemetry Command screens.
import type { ReactNode } from "react";

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
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
  info: "bg-accent",
  neutral: "bg-sub/70",
};

/** Institutional page heading row: classification tag, title, operational description, and right-hand toolbar. */
export function PageHeader({
  title,
  description,
  code = "IMD-AWS // NATIONAL TELEMETRY GRID",
  actions,
}: {
  title: string;
  description?: string;
  code?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="relative z-20 mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">{code}</p>
        <h1 className="mt-1 text-[23px] font-semibold tracking-tight text-ink md:text-[25px]">{title}</h1>
        {description && <p className="mt-1 max-w-[78ch] text-[13px] leading-relaxed text-sub">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Structured institutional panel with a recessed header bar. `flush` drops body padding (for tables & GIS maps). */
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
    <section className={`c-card flex min-w-0 flex-col overflow-hidden rounded-md ${className}`}>
      {title && (
        <div className="flex h-11 shrink-0 items-center gap-3 border-b border-line bg-raised/55 px-4">
          <h2 className="truncate text-[13px] font-semibold uppercase tracking-wide text-ink">{title}</h2>
          {meta && <span className="truncate font-mono text-[11px] text-sub">{meta}</span>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "min-h-0 flex-1" : "flex-1 p-4 md:p-5"}>{children}</div>
    </section>
  );
}

/** Single KPI cell designed to sit inside <MetricStrip>. */
export function Metric({
  label,
  value,
  unit,
  foot,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  foot?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className={`min-w-0 bg-surface px-4 py-3.5 ${toneTopBorder[tone]}`}>
      <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`font-mono text-2xl font-semibold tabular-nums tracking-tight ${tone === "neutral" ? "text-ink" : toneText[tone]}`}>
          {value}
        </span>
        {unit && <span className="font-mono text-xs text-sub">{unit}</span>}
      </p>
      {foot && <p className="mt-1 truncate text-[11px] text-sub">{foot}</p>}
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
    <div className={`grid ${grid} gap-px overflow-hidden rounded-md border border-line bg-line shadow-[0_1px_2px_rgb(11_21_40/0.04)]`}>
      {children}
    </div>
  );
}

/** Crisp rectangular institutional status tag with semantic border, tint, and status indicator dot. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-5 items-center gap-1.5 rounded border px-2 font-mono text-[10px] font-semibold uppercase tracking-wider leading-none whitespace-nowrap ${toneBadgeStyle[tone]}`}
    >
      <i aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[tone]}`} />
      <span className="inline-block leading-none">{children}</span>
    </span>
  );
}

/** Precision horizontal meter bar for a 0-100 value. */
export function Meter({ pct, tone = "info" }: { pct: number; tone?: Tone }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-sm bg-raised" role="presentation">
      <div className={`meter-fill h-full rounded-sm ${toneFill[tone]}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center font-mono text-xs uppercase tracking-wider text-sub">{children}</p>;
}

export { Select } from "@/components/console/Select";

export const field =
  "h-8 w-full rounded border border-line bg-surface px-2.5 text-[13px] text-ink placeholder:text-sub/75 focus-visible:outline-2 focus-visible:outline-accent";

export const button =
  "inline-flex h-8 items-center gap-1.5 rounded border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-raised active:translate-y-px disabled:opacity-40 disabled:pointer-events-none";

export const buttonPrimary =
  "inline-flex h-8 items-center gap-1.5 rounded bg-accent px-3.5 text-xs font-semibold text-on-accent transition-colors hover:bg-accent/90 active:translate-y-px disabled:opacity-40 disabled:pointer-events-none";

/** Institutional flat card shell (6px radius, 1px crisp border). */
export const card = "c-card rounded-md";

/** Structured filter tab / chip. */
export function chip(on: boolean) {
  return `inline-flex h-7 items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition-colors ${
    on
      ? "border-accent bg-accent-soft text-accent font-semibold"
      : "border-line bg-surface text-sub hover:bg-raised hover:text-ink"
  }`;
}

/** Uppercase monospace section eyebrow. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-sub">{children}</p>;
}

/** High-density institutional data table classes. */
export const table = {
  wrap: "overflow-x-auto",
  table: "w-full text-[13px] border-collapse",
  head: "bg-raised/70 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-sub",
  th: "px-4 h-9 font-semibold whitespace-nowrap border-b border-line",
  row: "border-b border-line/80 last:border-0 transition-colors hover:bg-raised/60",
  td: "px-4 py-2.5",
  num: "px-4 py-2.5 font-mono text-xs tabular-nums text-right text-ink",
  thNum: "px-4 h-9 font-semibold whitespace-nowrap border-b border-line text-right",
};

/** Map a 0-100 health/reliability value to a WMO status tone. */
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
