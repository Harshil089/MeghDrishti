"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Check, Ban, CloudLightning, HelpCircle, ShieldAlert, FileCheck2 } from "lucide-react";
import { Badge, button, severityTone } from "@/components/console/ui";
import { alertSafetySteps, defaultSafetySteps, type Alert } from "@/lib/mock-data";
import { fetchAlertExplanation, submitReview, updateAlertStatus, type ReviewClassification } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const REVIEW_ACTIONS: { classification: ReviewClassification; label: string; code: string; icon: typeof Check }[] = [
  { classification: "CONFIRMED_SENSOR_FAULT", label: "Confirm Sensor Fault", code: "FAULT", icon: Ban },
  { classification: "VALID_EXTREME_WEATHER", label: "Valid Extreme Event", code: "EXTREME", icon: CloudLightning },
  { classification: "FALSE_POSITIVE", label: "Dismiss False Positive", code: "DISMISS", icon: HelpCircle },
];

export default function AlertDetailModal({
  alert,
  onClose,
  onActionComplete,
  inline = false,
}: {
  alert: Alert | null;
  onClose: () => void;
  onActionComplete?: () => void;
  inline?: boolean;
}) {
  const { user, loading } = useAuth();
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<{ id: string; explanation?: Alert["explanation"]; error?: string }>();
  const alertId = alert?.id;
  const explanation = evidence?.id === alertId ? evidence?.explanation ?? alert?.explanation : alert?.explanation;
  const evidenceError = evidence?.id === alertId ? evidence?.error : undefined;

  useEffect(() => {
    let cancelled = false;
    if (alertId) {
      fetchAlertExplanation(alertId)
        .then((data) => {
          if (!cancelled) setEvidence({ id: alertId, explanation: data });
        })
        .catch(() => {
          if (!cancelled) setEvidence({ id: alertId, error: "Could not load additional recorded readings." });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [alertId]);

  const steps = alert ? alertSafetySteps[alert.code] ?? defaultSafetySteps : [];

  async function acknowledge() {
    if (!alert) return;
    setBusy("ack");
    setError(null);
    try {
      await updateAlertStatus(alert.id, "ACKNOWLEDGED");
      setDone("Acknowledged and logged in audit trail");
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to acknowledge");
    } finally {
      setBusy(null);
    }
  }

  async function review(classification: ReviewClassification) {
    if (!alert?.anomalyId) {
      setError("This alert has no linked anomaly to review.");
      return;
    }
    setBusy(classification);
    setError(null);
    try {
      await submitReview(alert.anomalyId, classification);
      await updateAlertStatus(alert.id, "RESOLVED");
      setDone(`Classified as ${classification.replace(/_/g, " ").toLowerCase()}`);
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setBusy(null);
    }
  }

  const inner = alert ? (
    <>
      {/* Dossier Header */}
      <div className="border-b border-line bg-raised/60 px-5 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={severityTone[alert.severity]}>{alert.severity}</Badge>
              <span className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink">
                {alert.code}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-sub">
                DOSSIER #{alert.id.slice(0, 8)}
              </span>
            </div>
            <h2 id="alert-drawer-title" className="mt-2 text-base font-semibold tracking-tight text-ink">
              {alert.stationName ? `${alert.stationName} (${alert.station})` : alert.station}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-sub">{alert.message}</p>
          </div>
          {!inline && (
            <button
              onClick={onClose}
              autoFocus
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line bg-surface text-sub hover:bg-raised hover:text-ink"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Telemetry Metadata Strip */}
      <dl className="grid grid-cols-3 border-b border-line bg-surface text-xs">
        <div className="border-r border-line px-4 py-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-sub">Observation Time</dt>
          <dd className="mt-0.5 font-mono font-semibold text-ink">{alert.time}</dd>
        </div>
        <div className="border-r border-line px-4 py-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-sub">Heuristic Confidence</dt>
          <dd className="mt-0.5 font-mono font-semibold text-ink">{alert.confidence}%</dd>
        </div>
        <div className="px-4 py-2.5">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-sub">Triage Status</dt>
          <dd className="mt-0.5 font-mono font-semibold uppercase text-ink">{alert.status}</dd>
        </div>
      </dl>

      {/* Evidence Body */}
      <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 text-[13px]">
        {evidenceError && <p role="status" className="text-warn">{evidenceError}</p>}
        {explanation && (
          <>
            {explanation.quality_notes?.map((note) => (
              <p key={note} className="rounded border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
                {note}
              </p>
            ))}

            <section className="rounded border border-line bg-canvas/40 p-3.5">
              <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
                <ShieldAlert className="h-3.5 w-3.5 text-accent" />
                Deterministic & ML Detection Evidence
              </h3>
              <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-ink">
                {explanation.findings.map((finding, i) => (
                  <li key={i}>{finding}</li>
                ))}
                {explanation.findings.length === 0 && <li>No detailed detection evidence recorded.</li>}
              </ul>
            </section>

            {explanation.context.length > 0 && (
              <section className="rounded border border-line bg-canvas/40 p-3.5">
                <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
                  Spatial & Satellite Consensus (Neighbors · ERA5 · NASA GPM)
                </h3>
                <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-ink">
                  {explanation.context.map((comparison, i) => (
                    <li key={i}>{comparison}</li>
                  ))}
                </ul>
              </section>
            )}

            {!!explanation.related_readings?.length && (
              <section>
                <h3 className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
                  Correlated Station Packets
                </h3>
                <ul className="divide-y divide-line rounded border border-line bg-surface">
                  {explanation.related_readings.map((reading) => (
                    <li key={reading.anomaly_id} className="px-3 py-2 text-xs">
                      {reading.observed_at && (
                        <p className="font-mono text-[11px] text-sub">{new Date(reading.observed_at).toLocaleString()}</p>
                      )}
                      <p className="mt-0.5 text-ink">{reading.summary}</p>
                    </li>
                  ))}
                </ul>
                {explanation.group_note && <p className="mt-1.5 text-xs text-sub">{explanation.group_note}</p>}
              </section>
            )}

            <section className="rounded border border-line bg-raised/40 px-3.5 py-2.5 font-mono text-[11px] leading-relaxed text-sub space-y-1">
              <p>
                TELEMETRY SOURCE: <span className="text-ink font-semibold">{explanation.source ?? "UNSPECIFIED"}</span>
                {explanation.source === "OPEN_METEO" && " (NWP Forecast Grid)"}
                {explanation.observed_at && ` · OBS ${new Date(explanation.observed_at).toLocaleString()}`}
              </p>
              <p>
                {alert.receivedAt && `INGESTED: ${new Date(alert.receivedAt).toLocaleString()} · `}
                {alert.detectedAt && `EVALUATED: ${new Date(alert.detectedAt).toLocaleString()}`}
              </p>
              <p>POLICY TRIGGER: {alert.policyTitle ?? "Standard WMO/IMD Quality Control Profile"}</p>
            </section>
          </>
        )}

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
            <FileCheck2 className="h-3.5 w-3.5 text-accent" />
            WMO / IMD Standard Operating Procedure (SOP)
          </h3>
          <ol className="space-y-1.5 rounded border border-line bg-surface p-3.5 text-xs">
            {steps.map((step, i) => (
              <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-1.5 leading-relaxed text-ink">
                <span className="font-mono text-[11px] font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Operator Decision Footer */}
      <div className="border-t border-line bg-raised/70 px-5 py-3.5">
        {loading ? null : !user ? (
          <p className="text-xs text-sub">
            <Link href="/login" className="font-semibold text-accent hover:underline" onClick={onClose}>
              Authenticate with Operator Credentials
            </Link>{" "}
            to record an official QC classification.
          </p>
        ) : done ? (
          <p className="flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-ok">
            <Check className="h-4 w-4" /> {done}
          </p>
        ) : (
          <>
            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
              Record Binding Operator Disposition (Logged to Audit Ledger)
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {REVIEW_ACTIONS.map(({ classification, label, icon: Icon }) => (
                <button
                  key={classification}
                  onClick={() => review(classification)}
                  disabled={busy !== null}
                  className={`${button} h-auto min-h-8 justify-center py-1.5 text-xs`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-accent" />
                  {busy === classification ? "Recording…" : label}
                </button>
              ))}
            </div>
            <button
              onClick={acknowledge}
              disabled={busy !== null}
              className="mt-2 inline-flex h-8 w-full items-center justify-center rounded bg-accent text-xs font-semibold uppercase tracking-wider text-on-accent transition-opacity hover:opacity-90 active:translate-y-px disabled:opacity-40"
            >
              {busy === "ack" ? "Acknowledging…" : "Acknowledge Alert & Hold for Field Verification"}
            </button>
            {error && <p className="mt-2 font-mono text-xs text-crit">{error}</p>}
          </>
        )}
      </div>
    </>
  ) : null;

  if (inline) {
    return (
      <section aria-label="Alert review" className="c-card flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-md text-ink">
        {inner ?? (
          <p className="m-auto px-6 text-center font-mono text-xs uppercase tracking-wider text-sub">
            Select an alert from the triage queue to inspect evidence
          </p>
        )}
      </section>
    );
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {alert && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" onClick={onClose} />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-drawer-title"
            className="relative flex h-full w-full max-w-lg flex-col border-l border-line bg-surface text-ink shadow-2xl shadow-ink/25"
            initial={reduce ? false : { x: 32 }}
            animate={{ x: 0 }}
            exit={reduce ? undefined : { x: 32 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {inner}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
