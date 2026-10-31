"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, RotateCcw, Power, X as XIcon, AlertTriangle } from "lucide-react";
import { PageHeader, Section, Badge, Empty, button, chip, type Tone } from "@/components/console/ui";
import { useAuth } from "@/lib/useAuth";
import { useLiveData } from "@/lib/useLiveData";
import {
  fetchDashboardSummary,
  fetchDataSources,
  fetchIngestionJobs,
  fetchModels,
  type DashboardSummary,
  type DataSourceStatus,
  replayIngestionJob,
  activateModel,
  type IngestionJob,
  type ModelVersion,
} from "@/lib/api";

const jobTone: Record<string, Tone> = { SUCCEEDED: "ok", FAILED: "crit", RUNNING: "info", PENDING: "neutral" };
const modelTone: Record<string, Tone> = { ACTIVE: "ok", CANDIDATE: "warn", RETIRED: "neutral", FAILED: "crit" };
const small = `${button} h-7 px-2.5 text-xs`;
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

function IngestionJobs({ jobs }: { jobs: IngestionJob[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const shown = onlyFailed ? jobs.filter((j) => j.status === "FAILED") : jobs;

  async function replay(jobId: string) {
    setBusy(jobId);
    setError(null);
    try {
      await replayIngestionJob(jobId);
    } catch (err) {
      setError({ id: jobId, message: err instanceof Error ? err.message : "Replay failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section
      title="Telemetry Ingestion Job Queue"
      meta={`${shown.length} JOBS`}
      flush
      actions={
        <button
          type="button"
          aria-pressed={onlyFailed}
          onClick={() => setOnlyFailed(!onlyFailed)}
          className={`${chip(onlyFailed)} h-7`}
        >
          Failed Only
        </button>
      }
    >
      {shown.length === 0 ? (
        <Empty>{jobs.length ? "No failed ingestion jobs" : "No ingestion jobs recorded"}</Empty>
      ) : (
        <ul className="max-h-[460px] divide-y divide-line overflow-y-auto">
          {shown.map((j) => (
            <li key={j.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-raised/60">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs font-semibold text-ink">{j.source}</span>
                  <span className="font-mono text-[11px] text-sub">· ATTEMPT #{j.attempt}</span>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-sub" title={new Date(j.created_at).toLocaleString()}>
                  EXECUTED {ago(j.created_at).toUpperCase()}
                </p>
                {j.error_message && (
                  <p className="mt-1 truncate font-mono text-[11px] text-crit" title={j.error_message}>
                    {j.error_message}
                  </p>
                )}
                {error?.id === j.id && (
                  <p role="alert" className="mt-1 font-mono text-[11px] text-crit">
                    {error.message}
                  </p>
                )}
              </div>
              <Badge tone={jobTone[j.status] ?? "neutral"}>{j.status.toLowerCase()}</Badge>
              {j.status === "FAILED" && (
                <button onClick={() => replay(j.id)} disabled={busy === j.id} className={small}>
                  <RotateCcw className="h-3 w-3" />
                  {busy === j.id ? "Replaying…" : "Replay"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Models({ models }: { models: ModelVersion[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  async function activate(id: string) {
    setBusy(id);
    setError(null);
    try {
      await activateModel(id);
    } catch (err) {
      setError({ id, message: err instanceof Error ? err.message : "Activation failed" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section title="Isolation Forest Model Registry" meta={`${models.length} VERSIONS`} flush>
      {models.length === 0 ? (
        <Empty>No Isolation Forest models trained yet</Empty>
      ) : (
        <ul className="max-h-[460px] divide-y divide-line overflow-y-auto">
          {models.map((m) => (
            <li key={m.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-raised/60">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-mono text-xs font-bold text-ink">{m.measurement}</p>
                  <span className="font-mono text-[11px] text-sub">v{m.model_version}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink">
                    {m.metrics.source_group === "sensor"
                      ? "IMD Sensor Cohort"
                      : m.metrics.source_group === "forecast"
                      ? "Open-Meteo NWP Cohort"
                      : "Mixed Cohort"}
                  </span>
                  {typeof m.metrics.training_samples === "number" && (
                    <span className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-sub">
                      {m.metrics.training_samples.toLocaleString()} samples
                    </span>
                  )}
                  <span className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-sub">
                    CONTAMINATION: {m.contamination}
                  </span>
                  <span className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-sub">
                    THRESHOLD: {m.threshold?.toFixed(3) ?? "-"}
                  </span>
                </div>
                {m.status === "CANDIDATE" && !m.eligible && m.ineligible_reason && (
                  <p className="mt-1 font-mono text-[11px] text-sub">{m.ineligible_reason}</p>
                )}
                {error?.id === m.id && (
                  <p role="alert" className="mt-1 font-mono text-[11px] text-crit">
                    {error.message}
                  </p>
                )}
              </div>
              <Badge tone={modelTone[m.status] ?? "neutral"}>{m.status.toLowerCase()}</Badge>
              {m.status === "CANDIDATE" && m.eligible && (
                <button onClick={() => activate(m.id)} disabled={busy === m.id} className={small}>
                  <Power className="h-3 w-3 text-accent" />
                  {busy === m.id ? "Promoting…" : "Activate"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const topBorder: Record<Tone, string> = {
  ok: "border-t-2 border-t-ok",
  warn: "border-t-2 border-t-warn",
  crit: "border-t-2 border-t-crit",
  info: "border-t-2 border-t-accent",
  neutral: "border-t-2 border-t-line",
};

function AdminConsole() {
  const jobs = useLiveData(fetchIngestionJobs, [] as IngestionJob[], 15000);
  const models = useLiveData(fetchModels, [] as ModelVersion[], 15000);

  const failed = jobs.filter((j) => j.status === "FAILED").length;
  const ok = jobs.filter((j) => j.status === "SUCCEEDED").length;
  const rate = jobs.length ? Math.round((ok / jobs.length) * 100) : null;
  const active = models.filter((m) => m.status === "ACTIVE").length;
  const candidates = models.filter((m) => m.status === "CANDIDATE").length;

  const sources = useLiveData(fetchDataSources, [] as DataSourceStatus[], 30000);
  const summary = useLiveData(fetchDashboardSummary, null as DashboardSummary | null, 30000);
  const enabledSources = sources.filter((s) => s.is_enabled).length;

  const bySource = useMemo(() => {
    const m = new Map<string, IngestionJob[]>();
    for (const j of [...jobs].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)))
      m.set(j.source, [...(m.get(j.source) ?? []), j]);
    return [...m];
  }, [jobs]);

  const stages: { code: string; name: string; detail: string; tone: Tone }[] = [
    {
      code: "STAGE-01",
      name: "Telemetry Ingestion",
      detail: rate === null ? "No runs recorded" : `${rate}% of ${jobs.length} runs succeeded`,
      tone: rate === null ? "warn" : failed ? "crit" : "ok",
    },
    {
      code: "STAGE-02",
      name: "External Context Feeds",
      detail: sources.length ? `${enabledSources} of ${sources.length} feeds enabled` : "Loading feeds",
      tone: !sources.length || enabledSources < sources.length ? "warn" : "ok",
    },
    {
      code: "STAGE-03",
      name: "Isolation Forest ML",
      detail: `${active} active · ${candidates} candidate models`,
      tone: active ? "ok" : "warn",
    },
    {
      code: "STAGE-04",
      name: "Alert Dispatch Engine",
      detail: summary ? `${summary.alerts.open} open · ${summary.alerts.critical} critical` : "Loading queue",
      tone: summary?.alerts.critical ? "crit" : "ok",
    },
  ];

  return (
    <div className="space-y-5">
      <Section title="Quality Control Pipeline Operational Status" meta="4-STAGE REAL-TIME TELEMETRY DAG">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stages.map((st) => (
            <li
              key={st.name}
              className={`rounded border border-line bg-surface p-4 ${topBorder[st.tone]} flex flex-col justify-between gap-2`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">{st.code}</span>
                <span
                  className={`grid h-6 w-6 place-items-center rounded ${
                    st.tone === "ok"
                      ? "bg-ok/15 text-ok"
                      : st.tone === "crit"
                      ? "bg-crit/15 text-crit"
                      : "bg-warn/15 text-warn"
                  }`}
                >
                  {st.tone === "ok" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : st.tone === "crit" ? (
                    <XIcon className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-ink">{st.name}</p>
                <p className="mt-0.5 font-mono text-xs text-sub">{st.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title="Source Ingestion Uptime Matrix"
        meta={`LATEST ${jobs.length} EXECUTION RUNS · OLDEST LEFT · RED = FAILED`}
      >
        {bySource.length === 0 ? (
          <Empty>No ingestion execution runs recorded yet</Empty>
        ) : (
          <div className="space-y-3">
            {bySource.map(([src, list]) => {
              const okPct = Math.round((100 * list.filter((j) => j.status === "SUCCEEDED").length) / list.length);
              return (
                <div key={src} className="grid grid-cols-[130px_minmax(0,1fr)_56px] items-center gap-3">
                  <span className="truncate font-mono text-xs font-semibold text-ink">{src}</span>
                  <span className="flex gap-[3px] overflow-hidden">
                    {list.map((j) => (
                      <span
                        key={j.id}
                        title={`${j.status.toLowerCase()} · ${new Date(j.created_at).toLocaleString()}`}
                        className={`h-5 w-2.5 shrink-0 rounded-[2px] ${
                          j.status === "FAILED"
                            ? "bg-crit"
                            : j.status === "SUCCEEDED"
                            ? "bg-ok/80"
                            : "bg-sub/30"
                        }`}
                      />
                    ))}
                  </span>
                  <span className="text-right font-mono text-xs font-semibold tabular-nums text-ink">{okPct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid gap-5 xl:grid-cols-2">
        <IngestionJobs jobs={jobs} />
        <Models models={models} />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const isAdmin = user?.roles.includes("ADMIN");

  return (
    <>
      <PageHeader
        code="SYS-ADM-09 // PIPELINE OPERATIONS & ML MODEL GOVERNANCE"
        title="Pipeline Operations & ML Model Governance"
        description="Monitor 4-stage ingestion and scoring pipeline health, replay failed telemetry ingestion jobs, and promote validated Isolation Forest models."
      />
      {loading ? (
        <Section>
          <Empty>Verifying operator clearance…</Empty>
        </Section>
      ) : !isAdmin ? (
        <Section>
          <Empty>
            Administrator clearance required.{" "}
            <Link href="/login" className="text-accent hover:underline">
              Authenticate as an Administrator
            </Link>{" "}
            to manage ingestion jobs and ML models.
          </Empty>
        </Section>
      ) : (
        <AdminConsole />
      )}
    </>
  );
}
