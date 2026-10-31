// Console design system primitives. Every signed-in page is built only from
// these, so spacing, type and status colour live in one place.
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
  neutral: "bg-sub/50",
};

/** Page heading row: title, one-line description, optional controls. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="relative z-20 flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-sub max-w-[70ch]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Bordered block with a header strip. `flush` drops body padding (tables, maps). */
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
    <section className={`rounded-2xl c-card flex flex-col min-w-0 ${className}`}>
      {title && (
        <div className="flex items-center gap-3 px-5 h-14 shrink-0">
          <h2 className="text-[15px] font-semibold text-ink truncate">{title}</h2>
          {meta && <span className="text-xs text-sub truncate">{meta}</span>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "flex-1 min-h-0" : "flex-1 px-5 pb-5"}>{children}</div>
    </section>
  );
}

/** Single KPI cell. Designed to sit inside <MetricStrip>. */
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
    <div className="bg-surface px-5 py-4 min-w-0">
      <p className="text-xs text-sub truncate">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1">
        <span className={`font-mono text-2xl font-medium tabular-nums ${tone === "neutral" ? "text-ink" : toneText[tone]}`}>
          {value}
        </span>
        {unit && <span className="text-xs text-sub">{unit}</span>}
      </p>
      {foot && <p className="mt-1 text-xs text-sub truncate">{foot}</p>}
    </div>
  );
}

/** Hairline-divided row of metrics (1px gaps over the line colour). */
export function MetricStrip({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 6 }) {
  const grid = {
    2: "grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    6: "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
  }[cols];
  return (
    <div className={`grid ${grid} gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-[0_1px_2px_rgb(15_26_46/0.04)]`}>{children}</div>
  );
}

const toneDot: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
  info: "bg-accent",
  neutral: "bg-sub/70",
};

/** Status pill: neutral chip, state shown by a small haloed dot only. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-line bg-raised pl-2 pr-2.5 text-xs font-medium leading-none whitespace-nowrap text-ink">
      <i aria-hidden className={`mx-px h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[tone]}`} />
      <span className="inline-block leading-none first-letter:uppercase">{children}</span>
    </span>
  );
}

/** Thin horizontal bar for a 0-100 value. */
export function Meter({ pct, tone = "info" }: { pct: number; tone?: Tone }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-raised overflow-hidden" role="presentation">
      <div className={`meter-fill h-full rounded-full ${toneFill[tone]}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-sub">{children}</p>;
}

export { Select } from "@/components/console/Select";

export const field =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-sub focus-visible:outline-2 focus-visible:outline-accent";

export const button =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-raised active:translate-y-px disabled:opacity-40 disabled:pointer-events-none";

export const buttonPrimary =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent/90 active:translate-y-px disabled:opacity-40 disabled:pointer-events-none";

/** Flat card shell used by the redesigned pages. */
export const card = "c-card rounded-2xl";

/** Filter chip. */
export function chip(on: boolean) {
  return `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
    on ? "border-accent/40 bg-accent-soft text-accent" : "border-line bg-surface text-sub hover:text-ink"
  }`;
}

/** Small uppercase mono label above a block. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-wider text-sub">{children}</p>;
}

/** Table classes. Tables stay native <table>; these keep every one identical. */
export const table = {
  wrap: "overflow-x-auto",
  table: "w-full text-[13px]",
  head: "text-left text-xs text-sub",
  th: "px-4 h-9 font-medium whitespace-nowrap border-b border-line",
  row: "border-b border-line last:border-0 transition-colors hover:bg-raised",
  td: "px-4 py-2.5",
  num: "px-4 py-2.5 font-mono tabular-nums text-right",
  thNum: "px-4 h-9 font-medium whitespace-nowrap border-b border-line text-right",
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
