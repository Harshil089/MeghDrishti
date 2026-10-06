"use client";

import { PageHeader, Section, Badge, Empty } from "@/components/console/ui";
import { fetchActiveCalibration, fetchDataSources, type CalibrationProfile, type DataSourceStatus } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { useAuth } from "@/lib/useAuth";

function KeyValues({ title, values }: { title: string; values: Record<string, number | string> }) {
  return (
    <div>
      <h3 className="px-4 pt-4 pb-2 text-xs font-medium text-sub">{title}</h3>
      <dl className="border-y border-line">
        {Object.entries(values).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-line px-4 py-2 last:border-0">
            <dt className="font-mono text-xs text-sub">{k}</dt>
            <dd className="font-mono text-[13px] tabular-nums text-ink">{v}</dd>
          </div>
        ))}
      </dl>
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

  return (
    <>
      <PageHeader
        title="Settings"
        description="Active system configuration. Read-only here; edit through the calibration DAG or admin API."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Calibration profile"
          meta={calibration ? `Updated ${new Date(calibration.updated_at).toLocaleString()}` : undefined}
          actions={calibration && <Badge tone="ok">{calibration.name}</Badge>}
          flush
        >
          {!canCalibration ? (
            <Empty>Requires an admin or scientist account.</Empty>
          ) : !calibration ? (
            <Empty>No active profile. The system is running on built-in defaults.</Empty>
          ) : (
            <div className="pb-4 space-y-2">
              <KeyValues title="Decision thresholds" values={calibration.decision_thresholds} />
              <KeyValues title="Fusion weights" values={calibration.fusion_weights} />
            </div>
          )}
        </Section>

        <Section title="Data sources" meta={sources.length ? `${sources.length}` : undefined} flush>
          {!isAdmin ? (
            <Empty>Requires an admin account.</Empty>
          ) : sources.length === 0 ? (
            <Empty>No data sources configured</Empty>
          ) : (
            <ul>
              {sources.map((s) => (
                <li key={s.name} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{s.name}</p>
                    <p className="text-xs text-sub">{s.kind}</p>
                  </div>
                  <Badge tone={s.is_enabled ? "ok" : "neutral"}>{s.is_enabled ? "Enabled" : "Needs credentials"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
