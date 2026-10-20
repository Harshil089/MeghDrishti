"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw, Power } from "lucide-react";
import { PageHeader, Section, Badge, Empty, Metric, MetricStrip, button, type Tone } from "@/components/console/ui";
import { TimelineChart } from "@/components/console/TrendChart";
import { useAuth } from "@/lib/useAuth";
import { useLiveData } from "@/lib/useLiveData";
import {
  fetchIngestionJobs,
  fetchModels,
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
          className={`h-6 rounded-full border px-2.5 text-xs font-medium transition-colors ${
            onlyFailed ? "border-accent bg-accent/15 text-ink" : "border-line text-sub hover:text-ink"
          }`}
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
                    contamination {m.contamination}
                  </span>
                  <span className="rounded-md border border-line bg-raised px-1.5 py-0.5 font-mono text-sub">
                    threshold {m.threshold?.toFixed(3) ?? "-"}
                  </span>
                </div>
                {error?.id === m.id && (
                  <p role="alert" className="mt-1 text-[11px] text-crit">
                    {error.message}
                  </p>
                )}
              </div>
              <Badge tone={modelTone[m.status] ?? "neutral"}>{m.status.toLowerCase()}</Badge>
              {m.status === "CANDIDATE" && (
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

function AdminConsole() {
  const jobs = useLiveData(fetchIngestionJobs, [] as IngestionJob[], 15000);
  const models = useLiveData(fetchModels, [] as ModelVersion[], 15000);

  const failed = jobs.filter((j) => j.status === "FAILED").length;
  const ok = jobs.filter((j) => j.status === "SUCCEEDED").length;
  const rate = jobs.length ? Math.round((ok / jobs.length) * 100) : null;
  const active = models.filter((m) => m.status === "ACTIVE").length;
  const candidates = models.filter((m) => m.status === "CANDIDATE").length;

  // 12 equal time slices across the loaded jobs.
  const history = useMemo(() => {
    const ts = jobs.map((j) => Date.parse(j.created_at)).filter((n) => !Number.isNaN(n));
    if (ts.length < 2) return [];
    const min = Math.min(...ts);
    const size = Math.max(1, (Math.max(...ts) - min) / 12);
    const slices = Array.from({ length: 12 }, (_, i) => ({
      t: new Date(min + i * size).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      value: 0,
    }));
    for (const n of ts) slices[Math.min(11, Math.floor((n - min) / size))].value++;
    return slices;
  }, [jobs]);

  return (
    <div className="space-y-4">
      <MetricStrip>
        <Metric label="Ingestion success" value={rate ?? "-"} unit={rate === null ? undefined : "%"} tone={rate === null ? "neutral" : rate >= 90 ? "ok" : "warn"} foot={`${jobs.length} recent jobs`} />
        <Metric label="Failed jobs" value={failed} tone={failed ? "crit" : "ok"} foot={failed ? "Replay below" : "None"} />
        <Metric label="Active models" value={active} foot={`${models.length} trained`} />
        <Metric label="Awaiting activation" value={candidates} tone={candidates ? "warn" : "neutral"} foot="Candidates" />
      </MetricStrip>

      <Section title="Ingestion activity" meta="Jobs per time slice">
        <div className="h-36">
          <TimelineChart data={history} label="Jobs" />
        </div>
      </Section>

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
