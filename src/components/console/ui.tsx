// Console design system primitives. Every signed-in page is built only from
// these, so spacing, type and status colour live in one place.
import type { ReactNode, SelectHTMLAttributes } from "react";

export type Tone = "ok" | "warn" | "crit" | "info" | "neutral";

const toneText: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
  info: "text-accent",
  neutral: "text-sub",
};

const toneBadge: Record<Tone, string> = {
  ok: "text-ok border-ok/30 bg-ok/10",
  warn: "text-warn border-warn/30 bg-warn/10",
  crit: "text-crit border-crit/30 bg-crit/10",
  info: "text-accent border-accent/30 bg-accent/10",
  neutral: "text-sub border-line bg-raised",
};

const toneFill: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
  info: "bg-accent",
  neutral: "bg-sub",
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
    <header className="flex flex-wrap items-end justify-between gap-4 pb-5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
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
    <section className={`rounded-md border border-line bg-surface flex flex-col min-w-0 ${className}`}>
      {title && (
        <div className="flex items-center gap-3 border-b border-line px-4 h-11 shrink-0">
          <h2 className="text-[13px] font-semibold text-ink truncate">{title}</h2>
          {meta && <span className="text-xs text-sub truncate">{meta}</span>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "flex-1 min-h-0" : "flex-1 p-4"}>{children}</div>
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
    <div className="bg-surface px-4 py-3.5 min-w-0">
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
    <div className={`grid ${grid} gap-px overflow-hidden rounded-md border border-line bg-line`}>{children}</div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-[4px] border px-1.5 py-px text-[11px] font-medium whitespace-nowrap ${toneBadge[tone]}`}>
      {children}
    </span>
  );
}

/** Thin horizontal bar for a 0-100 value. */
export function Meter({ pct, tone = "info" }: { pct: number; tone?: Tone }) {
  return (
    <div className="h-1 w-full rounded-full bg-raised overflow-hidden" role="presentation">
      <div className={`h-full rounded-full ${toneFill[tone]}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-sub">{children}</p>;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`h-8 rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-accent ${props.className ?? ""}`}
    />
  );
}

export const field =
  "h-8 w-full rounded-md border border-line bg-canvas px-2.5 text-[13px] text-ink placeholder:text-sub focus-visible:outline-2 focus-visible:outline-accent";

export const button =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:bg-raised active:translate-y-px disabled:opacity-40 disabled:pointer-events-none";

/** Table classes. Tables stay native <table>; these keep every one identical. */
export const table = {
  wrap: "overflow-x-auto",
  table: "w-full text-[13px]",
  head: "text-left text-xs text-sub bg-raised",
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
