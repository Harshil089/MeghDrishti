"use client";

import { Database, KeyRound, UserRound } from "lucide-react";
import { PageHeader, Section, Badge, Empty, Eyebrow, card } from "@/components/console/ui";
import { fetchActiveCalibration, fetchDataSources, type CalibrationProfile, type DataSourceStatus } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { useAuth } from "@/lib/useAuth";

const pretty = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const SECTIONS = [
  ["profile", "01 · Operator Clearance"],
  ["calibration", "02 · Calibration & Weights"],
  ["sources", "03 · External Data Feeds"],
] as const;

function Threshold({ name, value }: { name: string; value: number | string }) {
  const n = Number(value);
  const onScale = Number.isFinite(n) && n >= 0 && n <= 1;
  return (
    <div className="rounded border border-line bg-canvas/50 p-3.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-mono font-semibold uppercase tracking-wider text-ink">{pretty(name)}</span>
        <span className="font-mono text-sm font-bold tabular-nums text-accent">{value}</span>
      </div>
      {onScale && (
        <div className="relative mt-2.5 h-3" role="presentation">
          <div className="absolute inset-x-0 top-1 h-1.5 rounded-xs bg-raised" />
          <div className="absolute left-0 top-1 h-1.5 rounded-xs bg-accent" style={{ width: `${n * 100}%` }} />
          <div
            className="absolute top-0 h-3.5 w-3.5 -translate-x-1/2 rounded-xs border-2 border-accent bg-surface"
            style={{ left: `${n * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

function WeightsBar({ values }: { values: Record<string, number | string> }) {
  const entries = Object.entries(values)
    .map(([k, v]) => [k, Number(v)] as const)
    .filter(([, v]) => Number.isFinite(v) && v > 0);
  const total = entries.reduce((n, [, v]) => n + v, 0) || 1;
  return (
    <div className="flex h-10 w-full gap-1">
      {entries.map(([k, v], i) => (
        <div
          key={k}
          title={`${pretty(k)} ${v}`}
          className={`flex min-w-0 items-center justify-center rounded border border-accent/25 px-2 font-mono text-[11px] font-semibold uppercase ${
            i === 0 ? "text-on-accent" : "text-ink"
          }`}
          style={{
            flexGrow: v,
            background: `color-mix(in srgb, var(--c-accent) ${Math.max(16, 100 - i * 28)}%, white)`,
          }}
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
      <PageHeader
        code="SYS-CFG-10 // SYSTEM CALIBRATION & EVIDENCE WEIGHTING"
        title="System Calibration & External Data Feeds"
        description="Active WMO/IMD decision thresholds, ensemble evidence fusion weights, and external satellite/reanalysis data source status. Read-only here; update via the calibration DAG or Admin API."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className={`${card} overflow-hidden lg:sticky lg:top-16`}>
          <div className="border-b border-line bg-raised/60 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink">
            Configuration Index
          </div>
          <div className="p-2">
            {SECTIONS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="block rounded px-3 py-2 font-mono text-xs text-sub transition-colors hover:bg-raised hover:text-ink"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <div className="space-y-5">
          <div id="profile" className="scroll-mt-16">
            <Section title="Operator Clearance & Identity Profile" meta="AUTHENTICATED SESSION">
              <div className="flex flex-wrap items-center gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded border border-accent/30 bg-accent-soft text-accent">
                  <UserRound className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {user?.full_name || user?.email || "Authenticated Operator"}
                  </p>
                  {user?.full_name && <p className="truncate font-mono text-xs text-sub">{user.email}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(user?.roles ?? []).map((r) => (
                    <Badge key={r} tone="info">
                      ROLE: {r}
                    </Badge>
                  ))}
                </div>
              </div>
            </Section>
          </div>

          <div id="calibration" className="scroll-mt-16">
            <Section
              title="Ensemble Calibration & Evidence Fusion Profile"
              meta={
                calibration
                  ? `PROFILE: ${calibration.name.toUpperCase()} · UPDATED ${new Date(calibration.updated_at).toLocaleString()}`
                  : "DECISION THRESHOLDS & WEIGHTS"
              }
              actions={calibration && <Badge tone="ok">Active Profile</Badge>}
            >
              {!canCalibration ? (
                <Empty>Requires Administrator or Scientist clearance.</Empty>
              ) : !calibration ? (
                <Empty>No custom profile active; operating on standard WMO/IMD defaults.</Empty>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Eyebrow>Ensemble Classification Decision Thresholds (0.00 – 1.00)</Eyebrow>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Object.entries(calibration.decision_thresholds).map(([k, v]) => (
                        <Threshold key={k} name={k} value={v} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3 border-t border-line pt-5">
                    <Eyebrow>Evidence Source Fusion Weights</Eyebrow>
                    <WeightsBar values={calibration.fusion_weights} />
                  </div>
                </div>
              )}
            </Section>
          </div>

          <div id="sources" className="scroll-mt-16">
            <Section
              title="External Telemetry & Context Data Feeds"
              meta={sources.length > 0 ? `${enabled} OF ${sources.length} FEEDS ENABLED` : "DATA CONNECTORS"}
            >
              {!isAdmin ? (
                <Empty>Requires Administrator clearance.</Empty>
              ) : sources.length === 0 ? (
                <Empty>No external data sources configured</Empty>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {sources.map((s) => (
                    <li
                      key={s.name}
                      className="flex items-center gap-3 rounded border border-line bg-canvas/50 px-3.5 py-3"
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded border ${
                          s.is_enabled
                            ? "border-accent/25 bg-accent-soft text-accent"
                            : "border-line bg-raised text-sub"
                        }`}
                      >
                        {s.is_enabled ? <Database className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs font-bold text-ink">{s.name}</span>
                        <span
                          className={`block truncate font-mono text-[10px] uppercase ${
                            s.is_enabled ? "text-sub" : "text-warn"
                          }`}
                        >
                          {s.is_enabled ? s.kind : "API CREDENTIAL REQUIRED"}
                        </span>
                      </span>
                      <Badge tone={s.is_enabled ? "ok" : "neutral"}>{s.is_enabled ? "ONLINE" : "OFF"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </div>
    </>
  );
}
