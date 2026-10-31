"use client";

import { Database, KeyRound, UserRound } from "lucide-react";
import { PageHeader, Badge, Empty, Eyebrow, card } from "@/components/console/ui";
import { fetchActiveCalibration, fetchDataSources, type CalibrationProfile, type DataSourceStatus } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { useAuth } from "@/lib/useAuth";

const pretty = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const SECTIONS = [
  ["profile", "Profile"],
  ["calibration", "Calibration"],
  ["sources", "Data sources"],
] as const;

/** Read-only slider for a threshold. Values in [0, 1] get a track; anything else is shown as a number. */
function Threshold({ name, value }: { name: string; value: number | string }) {
  const n = Number(value);
  const onScale = Number.isFinite(n) && n >= 0 && n <= 1;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-ink">{pretty(name)}</span>
        <span className="font-mono text-ink">{value}</span>
      </div>
      {onScale && (
        <div className="relative mt-2.5 h-4" role="presentation">
          <div className="absolute inset-x-0 top-1.5 h-1 rounded-full bg-raised" />
          <div className="absolute left-0 top-1.5 h-1 rounded-full bg-accent" style={{ width: `${n * 100}%` }} />
          <div className="absolute top-0 h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-accent bg-surface" style={{ left: `${n * 100}%` }} />
        </div>
      )}
    </div>
  );
}

/** Fusion weights as one stacked bar, each segment a lighter tint of the accent. */
function WeightsBar({ values }: { values: Record<string, number | string> }) {
  const entries = Object.entries(values).map(([k, v]) => [k, Number(v)] as const).filter(([, v]) => Number.isFinite(v) && v > 0);
  const total = entries.reduce((n, [, v]) => n + v, 0) || 1;
  return (
    <div className="flex h-10 w-full gap-1">
      {entries.map(([k, v], i) => (
        <div
          key={k}
          title={`${pretty(k)} ${v}`}
          className={`flex min-w-0 items-center justify-center rounded-lg px-2 text-xs font-medium ${i === 0 ? "text-on-accent" : "text-ink"}`}
          style={{ flexGrow: v, background: `color-mix(in srgb, var(--c-accent) ${Math.max(18, 100 - i * 30)}%, white)` }}
        >
          <span className="truncate">
            {pretty(k)} {Math.round((100 * v) / total)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  // Both endpoints are permission-gated server-side (403 for viewers), and
  // useLiveData swallows errors, so gate on role instead of loading forever.
  const { user } = useAuth();
  const isAdmin = !!user?.roles.includes("ADMIN");
  const canCalibration = isAdmin || !!user?.roles.includes("SCIENTIST");
  const calibration = useLiveData(
    () => (canCalibration ? fetchActiveCalibration() : Promise.resolve(null)),
    null as CalibrationProfile | null,
    30000,
    [canCalibration]
  );
  const sources = useLiveData(
    () => (isAdmin ? fetchDataSources() : Promise.resolve([] as DataSourceStatus[])),
    [] as DataSourceStatus[],
    30000,
    [isAdmin]
  );
  const enabled = sources.filter((s) => s.is_enabled).length;

  return (
    <>
      <PageHeader title="Settings" description="Active configuration. Read-only here; change it through the calibration DAG or admin API." />

      <div className="grid items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className={`${card} p-2 lg:sticky lg:top-6`}>
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block rounded-lg px-3.5 py-2.5 text-[13px] text-sub transition-colors hover:bg-raised hover:text-ink">
              {label}
            </a>
          ))}
        </nav>

        <div className="space-y-5">
          <section id="profile" className={`${card} flex scroll-mt-6 flex-wrap items-center gap-4 p-6`}>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <UserRound className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-ink">{user?.full_name || user?.email || "Signed in"}</p>
              {user?.full_name && <p className="truncate text-xs text-sub">{user.email}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {(user?.roles ?? []).map((r) => (
                <Badge key={r} tone="info">
                  {r.toLowerCase()}
                </Badge>
              ))}
            </div>
          </section>

          <section id="calibration" className={`${card} scroll-mt-6 p-6`}>
            <div className="mb-6 flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold text-ink">Calibration</h2>
                <p className="mt-0.5 text-xs text-sub">
                  {calibration ? `Profile ${calibration.name} · updated ${new Date(calibration.updated_at).toLocaleString()}` : "Decision thresholds and fusion weights"}
                </p>
              </div>
              {calibration && <Badge tone="ok">Active</Badge>}
            </div>
            {!canCalibration ? (
              <Empty>Requires an admin or scientist account.</Empty>
            ) : !calibration ? (
              <Empty>No active profile. Built-in defaults are in use.</Empty>
            ) : (
              <div className="space-y-7">
                <div className="space-y-5">
                  <Eyebrow>Decision thresholds</Eyebrow>
                  {Object.entries(calibration.decision_thresholds).map(([k, v]) => (
                    <Threshold key={k} name={k} value={v} />
                  ))}
                </div>
                <div className="space-y-3">
                  <Eyebrow>How evidence is weighed</Eyebrow>
                  <WeightsBar values={calibration.fusion_weights} />
                </div>
              </div>
            )}
          </section>

          <section id="sources" className={`${card} scroll-mt-6 p-6`}>
            <div className="mb-5 flex items-baseline gap-3">
              <h2 className="text-[15px] font-semibold text-ink">Data sources</h2>
              {sources.length > 0 && <span className="text-xs text-sub">{enabled} of {sources.length} enabled</span>}
            </div>
            {!isAdmin ? (
              <Empty>Requires an admin account.</Empty>
            ) : sources.length === 0 ? (
              <Empty>No data sources configured</Empty>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {sources.map((s) => (
                  <li key={s.name} className="flex items-center gap-3 rounded-xl border border-line bg-raised/50 px-4 py-3.5">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${s.is_enabled ? "bg-accent-soft text-accent" : "bg-raised text-sub"}`}>
                      {s.is_enabled ? <Database className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{s.name}</span>
                      <span className={`block truncate text-xs ${s.is_enabled ? "text-sub" : "text-warn"}`}>{s.is_enabled ? s.kind : "Needs API key"}</span>
                    </span>
                    <Badge tone={s.is_enabled ? "ok" : "neutral"}>{s.is_enabled ? "On" : "Off"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
