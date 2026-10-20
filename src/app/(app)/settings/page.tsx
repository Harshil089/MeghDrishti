"use client";

import { Database, KeyRound, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { PageHeader, Section, Badge, Empty, Meter } from "@/components/console/ui";
import { fetchActiveCalibration, fetchDataSources, type CalibrationProfile, type DataSourceStatus } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { useAuth } from "@/lib/useAuth";

const pretty = (k: string) => k.replace(/_/g, " ");

/** Grid of labelled numbers. */
function Thresholds({ values }: { values: Record<string, number | string> }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
      {Object.entries(values).map(([k, v]) => (
        <div key={k} className="bg-surface px-3.5 py-3">
          <dt className="truncate text-[11px] text-sub capitalize">{pretty(k)}</dt>
          <dd className="mt-1 font-mono text-lg tabular-nums text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One gradient bar per weight, scaled to the largest. */
function Weights({ values }: { values: Record<string, number | string> }) {
  const nums = Object.values(values).map(Number);
  const max = Math.max(...nums, 0) || 1;
  return (
    <ul className="space-y-3.5">
      {Object.entries(values).map(([k, v]) => (
        <li key={k}>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="capitalize text-sub">{pretty(k)}</span>
            <span className="font-mono tabular-nums text-ink">{v}</span>
          </div>
          <Meter pct={(Number(v) / max) * 100} tone="info" />
        </li>
      ))}
    </ul>
  );
}

function SubHead({ icon: Icon, children }: { icon: typeof SlidersHorizontal; children: string }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-xs font-medium text-ink">
      <Icon className="h-3.5 w-3.5 text-accent" />
      {children}
    </h3>
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
      <PageHeader title="Settings" description="Active configuration. Read-only here." />

      <div className="space-y-4">
        <section className="c-card flex flex-wrap items-center gap-4 rounded-lg border border-line p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user?.full_name || user?.email || "Signed in"}</p>
            {user?.full_name && <p className="truncate text-xs text-sub">{user.email}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(user?.roles ?? []).map((r) => (
              <Badge key={r} tone="info">
                {r.toLowerCase()}
              </Badge>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-12">
          <Section
            title="Calibration profile"
            meta={calibration ? `Updated ${new Date(calibration.updated_at).toLocaleString()}` : undefined}
            actions={calibration && <Badge tone="ok">{calibration.name}</Badge>}
            className="lg:col-span-7"
          >
            {!canCalibration ? (
              <Empty>Requires an admin or scientist account.</Empty>
            ) : !calibration ? (
              <Empty>No active profile. Built-in defaults are in use.</Empty>
            ) : (
              <div className="space-y-6">
                <div>
                  <SubHead icon={SlidersHorizontal}>Decision thresholds</SubHead>
                  <Thresholds values={calibration.decision_thresholds} />
                </div>
                <div>
                  <SubHead icon={ShieldCheck}>Fusion weights</SubHead>
                  <Weights values={calibration.fusion_weights} />
                </div>
              </div>
            )}
          </Section>

          <Section
            title="Data sources"
            meta={sources.length ? `${enabled} of ${sources.length} enabled` : undefined}
            flush
            className="lg:col-span-5 self-start"
          >
            {!isAdmin ? (
              <Empty>Requires an admin account.</Empty>
            ) : sources.length === 0 ? (
              <Empty>No data sources configured</Empty>
            ) : (
              <ul>
                {sources.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center gap-3 border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-raised"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-raised text-sub">
                      {s.is_enabled ? <Database className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{s.name}</p>
                      <p className="truncate text-xs text-sub">{s.kind}</p>
                    </div>
                    <Badge tone={s.is_enabled ? "ok" : "neutral"}>{s.is_enabled ? "Enabled" : "Needs key"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
