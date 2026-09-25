"use client";

import { useState } from "react";
import Link from "next/link";
import Topbar from "@/components/Topbar";
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
import { ShieldCheck, RotateCcw, Power, Database, Cpu } from "lucide-react";

const jobStatusStyle: Record<string, string> = {
  SUCCEEDED: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  FAILED: "text-rose-400 border-rose-500/30 bg-rose-500/10",
  RUNNING: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
  PENDING: "text-muted border-border",
};

const modelStatusStyle: Record<string, string> = {
  ACTIVE: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  CANDIDATE: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  RETIRED: "text-muted border-border",
  FAILED: "text-rose-400 border-rose-500/30 bg-rose-500/10",
};

function IngestionJobsPanel() {
  const jobs = useLiveData(fetchIngestionJobs, [] as IngestionJob[], 15000);
  const [busy, setBusy] = useState<string | null>(null);

  async function replay(jobId: string) {
    setBusy(jobId);
    try {
      await replayIngestionJob(jobId);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Database className="h-4 w-4 text-cyan-300" />
        <h4 className="text-sm font-semibold">Ingestion jobs</h4>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {jobs.length === 0 && <p className="text-xs text-muted">No ingestion jobs yet.</p>}
        {jobs.map((j) => (
          <div key={j.id} className="flex items-center justify-between rounded-lg bg-panel-2 px-3 py-2 text-xs">
            <div className="min-w-0">
              <p className="font-mono text-foreground/90 truncate">
                {j.source} <span className="text-muted">· attempt {j.attempt}</span>
              </p>
              <p className="text-muted truncate">{new Date(j.created_at).toLocaleString()}</p>
              {j.error_message && <p className="text-rose-400 truncate">{j.error_message}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className={`px-2 py-0.5 rounded-full border ${jobStatusStyle[j.status] ?? "text-muted border-border"}`}>
                {j.status}
              </span>
              {j.status === "FAILED" && (
                <button
                  onClick={() => replay(j.id)}
                  disabled={busy === j.id}
                  className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  {busy === j.id ? "…" : "replay"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelsPanel() {
  const models = useLiveData(fetchModels, [] as ModelVersion[], 15000);
  const [busy, setBusy] = useState<string | null>(null);

  async function activate(id: string) {
    setBusy(id);
    try {
      await activateModel(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Cpu className="h-4 w-4 text-amber-400" />
        <h4 className="text-sm font-semibold">Isolation Forest models</h4>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {models.length === 0 && <p className="text-xs text-muted">No models trained yet.</p>}
        {models.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg bg-panel-2 px-3 py-2 text-xs">
            <div className="min-w-0">
              <p className="font-mono text-foreground/90 truncate">
                {m.measurement} <span className="text-muted">v{m.model_version}</span>
              </p>
              <p className="text-muted">
                contamination {m.contamination} · threshold {m.threshold?.toFixed(3) ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className={`px-2 py-0.5 rounded-full border ${modelStatusStyle[m.status] ?? "text-muted border-border"}`}>
                {m.status}
              </span>
              {m.status === "CANDIDATE" && (
                <button
                  onClick={() => activate(m.id)}
                  disabled={busy === m.id}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                >
                  <Power className="h-3 w-3" />
                  {busy === m.id ? "…" : "activate"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const isAdmin = user?.roles.includes("ADMIN");

  return (
    <>
      <Topbar title="Admin" />
      <main className="flex-1 p-4 md:p-6 space-y-4">
        <div className="glass rounded-xl p-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-cyan-300" />
          <h3 className="text-sm font-semibold">Ingestion &amp; model administration</h3>
        </div>

        {loading ? (
          <div className="glass rounded-xl p-8 text-center text-sm text-muted">Checking access…</div>
        ) : !isAdmin ? (
          <div className="glass rounded-xl p-8 text-center text-sm text-muted">
            Admin role required.{" "}
            <Link href="/login" className="text-cyan-300 hover:underline">
              Sign in as an admin
            </Link>{" "}
            to manage ingestion jobs and models.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <IngestionJobsPanel />
            <ModelsPanel />
          </div>
        )}
      </main>
    </>
  );
}
