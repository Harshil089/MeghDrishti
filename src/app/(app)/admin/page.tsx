"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, RotateCcw, Power, X as XIcon } from "lucide-react";
import { PageHeader, Section, Badge, Empty, button, card, chip, type Tone } from "@/components/console/ui";
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
      title="Ingestion jobs"
      meta={`${shown.length}`}
      flush
      actions={
        <button
          type="button"
          aria-pressed={onlyFailed}
          onClick={() => setOnlyFailed(!onlyFailed)}
          className={`${chip(onlyFailed)} h-7`}
        >
          Failed only
        </button>
      }
    >
      {shown.length === 0 ? (
        <Empty>{jobs.length ? "No failed jobs" : "No ingestion jobs yet"}</Empty>
      ) : (
        <ul className="max-h-[460px] overflow-y-auto">
          {shown.map((j) => (
            <li key={j.id} className="flex items-start gap-3 border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-raised">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-xs text-ink">{j.source}</span>
                  <span className="text-[11px] text-sub">· attempt {j.attempt}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-sub" title={new Date(j.created_at).toLocaleString()}>
                  {ago(j.created_at)}
                </p>
                {j.error_message && (
                  <p className="mt-1 truncate text-[11px] text-crit" title={j.error_message}>
                    {j.error_message}
                  </p>
                )}
                {error?.id === j.id && (
                  <p role="alert" className="mt-1 text-[11px] text-crit">
                    {error.message}
                  </p>
                )}
              </div>
              <Badge tone={jobTone[j.status] ?? "neutral"}>{j.status.toLowerCase()}</Badge>
              {j.status === "FAILED" && (
                <button onClick={() => replay(j.id)} disabled={busy === j.id} className={small}>
                  <RotateCcw className="h-3 w-3" />
                  {busy === j.id ? "Replaying" : "Replay"}
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
    <Section title="Isolation Forest models" meta={`${models.length}`} flush>
      {models.length === 0 ? (
        <Empty>No models trained yet</Empty>
      ) : (
        <ul className="max-h-[460px] overflow-y-auto">
          {models.map((m) => (
            <li key={m.id} className="flex items-start gap-3 border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-raised">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-ink">{m.measurement}</p>
                <p className="truncate font-mono text-[11px] text-sub">v{m.model_version}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-sub">
                    {m.metrics.source_group === "sensor" ? "IMD sensor" : m.metrics.source_group === "forecast" ? "Open-Meteo forecast" : "mixed (old)"}
                  </span>
                  {typeof m.metrics.training_samples === "number" && (
                    <span className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-sub">
                      {m.metrics.training_samples.toLocaleString()} rows
                    </span>
                  )}
                  <span className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-sub">
                    contamination {m.contamination}
                  </span>
                  <span className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-sub">
                    threshold {m.threshold?.toFixed(3) ?? "-"}
                  </span>
                </div>
                {m.status === "CANDIDATE" && !m.eligible && m.ineligible_reason && (
                  <p className="mt-1 text-[11px] text-sub">{m.ineligible_reason}</p>
                )}
                {error?.id === m.id && (
                  <p role="alert" className="mt-1 text-[11px] text-crit">
                    {error.message}
                  </p>
                )}
              </div>
              <Badge tone={modelTone[m.status] ?? "neutral"}>{m.status.toLowerCase()}</Badge>
              {m.status === "CANDIDATE" && m.eligible && (
                <button onClick={() => activate(m.id)} disabled={busy === m.id} className={small}>
                  <Power className="h-3 w-3" />
                  {busy === m.id ? "Activating" : "Activate"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const ring: Record<Tone, string> = { ok: "border-ok text-ok", warn: "border-warn text-warn", crit: "border-crit text-crit", info: "border-accent text-accent", neutral: "border-line text-sub" };

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
    for (const j of [...jobs].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) m.set(j.source, [...(m.get(j.source) ?? []), j]);
    return [...m];
  }, [jobs]);

  const stages: { name: string; detail: string; tone: Tone }[] = [
    { name: "Ingestion", detail: rate === null ? "No runs yet" : `${rate}% of ${jobs.length} runs ok`, tone: rate === null ? "warn" : failed ? "crit" : "ok" },
    { name: "Data sources", detail: sources.length ? `${enabledSources} of ${sources.length} enabled` : "Not loaded", tone: !sources.length || enabledSources < sources.length ? "warn" : "ok" },
    { name: "ML scoring", detail: `${active} active · ${candidates} candidate`, tone: active ? "ok" : "warn" },
    { name: "Alerts", detail: summary ? `${summary.alerts.open} open · ${summary.alerts.critical} critical` : "Not loaded", tone: summary?.alerts.critical ? "crit" : "ok" },
  ];

  return (
    <div className="space-y-5">
      <section className={`${card} p-6`}>
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="text-[15px] font-semibold text-ink">Pipeline health</h2>
          <span className="text-xs text-sub">every stage of the quality pipeline</span>
        </div>
        <ol className="flex flex-wrap items-start gap-y-5">
          {stages.map((st, i) => (
            <li key={st.name} className="flex min-w-[150px] flex-1 items-start">
              <div className="flex flex-1 flex-col items-center gap-2 text-center">
                <span className={`grid h-12 w-12 place-items-center rounded-full border-2 bg-raised ${ring[st.tone]}`}>
                  {st.tone === "ok" ? <Check className="h-5 w-5" /> : st.tone === "crit" ? <XIcon className="h-5 w-5" /> : <span className="text-lg font-semibold leading-none">!</span>}
                </span>
                <span className="text-[13px] font-medium text-ink">{st.name}</span>
                <span className="text-xs text-sub">{st.detail}</span>
              </div>
              {i < stages.length - 1 && <span aria-hidden className="mt-6 hidden h-px w-10 shrink-0 bg-line md:block" />}
            </li>
          ))}
        </ol>
      </section>

      <section className={`${card} p-6`}>
        <div className="mb-4 flex items-baseline gap-3">
          <h2 className="text-[15px] font-semibold text-ink">Ingestion by source</h2>
          <span className="text-xs text-sub">latest {jobs.length} runs, oldest left · red = failed</span>
        </div>
        {bySource.length === 0 ? (
          <Empty>No ingestion jobs yet</Empty>
        ) : (
          <div className="space-y-2.5">
            {bySource.map(([src, list]) => {
              const okPct = Math.round((100 * list.filter((j) => j.status === "SUCCEEDED").length) / list.length);
              return (
                <div key={src} className="grid grid-cols-[120px_minmax(0,1fr)_48px] items-center gap-3">
                  <span className="truncate font-mono text-xs text-ink">{src}</span>
                  <span className="flex gap-[3px] overflow-hidden">
                    {list.map((j) => (
                      <span key={j.id} title={`${j.status.toLowerCase()} · ${new Date(j.created_at).toLocaleString()}`} className={`h-6 w-2 shrink-0 rounded-sm ${j.status === "FAILED" ? "bg-crit" : j.status === "SUCCEEDED" ? "bg-accent/60" : "bg-sub/30"}`} />
                    ))}
                  </span>
                  <span className="text-right font-mono text-xs text-sub">{okPct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
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
      <PageHeader title="Admin" description="Replay failed jobs and activate models." />
      {loading ? (
        <Section>
          <Empty>Checking access</Empty>
        </Section>
      ) : !isAdmin ? (
        <Section>
          <Empty>
            Admin role required.{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in as an admin
            </Link>{" "}
            to manage ingestion jobs and models.
          </Empty>
        </Section>
      ) : (
        <AdminConsole />
      )}
    </>
  );
}
