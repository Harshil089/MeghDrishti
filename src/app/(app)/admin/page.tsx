"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw, Power } from "lucide-react";
import { PageHeader, Section, Badge, Empty, button, table, type Tone } from "@/components/console/ui";
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
const small = `${button} h-7 px-2 text-xs`;

function IngestionJobs() {
  const jobs = useLiveData(fetchIngestionJobs, [] as IngestionJob[], 15000);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

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
    <Section title="Ingestion jobs" meta={jobs.length ? `${jobs.length}` : undefined} flush>
      {jobs.length === 0 ? (
        <Empty>No ingestion jobs yet</Empty>
      ) : (
        <div className={`${table.wrap} max-h-[480px] overflow-y-auto`}>
          <table className={table.table}>
            <thead className={`${table.head} sticky top-0`}>
              <tr>
                <th className={table.th}>Source</th>
                <th className={table.th}>Created</th>
                <th className={table.th}>Status</th>
                <th className={table.th}>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className={table.row}>
                  <td className={table.td}>
                    <p className="font-mono text-xs text-ink">{j.source}</p>
                    <p className="text-[11px] text-sub">Attempt {j.attempt}</p>
                    {j.error_message && <p className="max-w-xs truncate text-[11px] text-crit" title={j.error_message}>{j.error_message}</p>}
                  </td>
                  <td className={`${table.td} font-mono text-xs text-sub whitespace-nowrap`}>{new Date(j.created_at).toLocaleString()}</td>
                  <td className={table.td}>
                    <Badge tone={jobTone[j.status] ?? "neutral"}>{j.status.toLowerCase()}</Badge>
                  </td>
                  <td className={`${table.td} text-right`}>
                    {j.status === "FAILED" && (
                      <button onClick={() => replay(j.id)} disabled={busy === j.id} className={small}>
                        <RotateCcw className="h-3 w-3" />
                        {busy === j.id ? "Replaying" : "Replay"}
                      </button>
                    )}
                    {error?.id === j.id && <p role="alert" className="mt-1 max-w-xs text-left text-[11px] text-crit">{error.message}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Models() {
  const models = useLiveData(fetchModels, [] as ModelVersion[], 15000);
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
    <Section title="Isolation Forest models" meta={models.length ? `${models.length}` : undefined} flush>
      {models.length === 0 ? (
        <Empty>No models trained yet</Empty>
      ) : (
        <div className={`${table.wrap} max-h-[480px] overflow-y-auto`}>
          <table className={table.table}>
            <thead className={`${table.head} sticky top-0`}>
              <tr>
                <th className={table.th}>Model</th>
                <th className={table.thNum}>Contamination</th>
                <th className={table.thNum}>Threshold</th>
                <th className={table.th}>Status</th>
                <th className={table.th}>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className={table.row}>
                  <td className={table.td}>
                    <span className="font-mono text-xs text-ink">{m.measurement}</span>{" "}
                    <span className="font-mono text-[11px] text-sub">v{m.model_version}</span>
                  </td>
                  <td className={table.num}>{m.contamination}</td>
                  <td className={table.num}>{m.threshold?.toFixed(3) ?? "-"}</td>
                  <td className={table.td}>
                    <Badge tone={modelTone[m.status] ?? "neutral"}>{m.status.toLowerCase()}</Badge>
                  </td>
                  <td className={`${table.td} text-right`}>
                    {m.status === "CANDIDATE" && (
                      <button onClick={() => activate(m.id)} disabled={busy === m.id} className={small}>
                        <Power className="h-3 w-3" />
                        {busy === m.id ? "Activating" : "Activate"}
                      </button>
                    )}
                    {error?.id === m.id && <p role="alert" className="mt-1 max-w-xs text-left text-[11px] text-crit">{error.message}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const isAdmin = user?.roles.includes("ADMIN");

  return (
    <>
      <PageHeader title="Admin" description="Replay failed ingestion jobs and promote candidate models." />
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
        <div className="grid gap-4 xl:grid-cols-2">
          <IngestionJobs />
          <Models />
        </div>
      )}
    </>
  );
}
