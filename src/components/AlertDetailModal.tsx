"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Check, Ban, CloudLightning, HelpCircle } from "lucide-react";
import { Badge, button, severityTone } from "@/components/console/ui";
import { alertSafetySteps, defaultSafetySteps, type Alert } from "@/lib/mock-data";
import { fetchAlertExplanation, submitReview, updateAlertStatus, type ReviewClassification } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const REVIEW_ACTIONS: { classification: ReviewClassification; label: string; icon: typeof Check }[] = [
  { classification: "CONFIRMED_SENSOR_FAULT", label: "Sensor fault", icon: Ban },
  { classification: "VALID_EXTREME_WEATHER", label: "Real extreme weather", icon: CloudLightning },
  { classification: "FALSE_POSITIVE", label: "False positive", icon: HelpCircle },
];

export default function AlertDetailModal({
  alert,
  onClose,
  onActionComplete,
}: {
  alert: Alert | null;
  onClose: () => void;
  onActionComplete?: () => void;
}) {
  const { user } = useAuth();
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
      fetchAlertExplanation(alertId).then((data) => {
        if (!cancelled) setEvidence({ id: alertId, explanation: data });
      }).catch(() => {
        if (!cancelled) setEvidence({ id: alertId, error: "Could not load additional recorded readings." });
      });
    }
    return () => { cancelled = true; };
  }, [alertId]);

  const steps = alert ? alertSafetySteps[alert.code] ?? defaultSafetySteps : [];

  async function acknowledge() {
    if (!alert) return;
    setBusy("ack");
    setError(null);
    try {
      await updateAlertStatus(alert.id, "ACKNOWLEDGED");
      setDone("Acknowledged");
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
      setDone(classification.replace(/_/g, " ").toLowerCase());
      onActionComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setBusy(null);
    }
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
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-drawer-title"
            className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-surface text-ink shadow-2xl shadow-black/30"
            initial={reduce ? false : { x: 32 }}
            animate={{ x: 0 }}
            exit={reduce ? undefined : { x: 32 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone={severityTone[alert.severity]}>{alert.severity}</Badge>
                  <span className="font-mono text-xs text-sub">{alert.code}</span>
                </div>
                <h2 id="alert-drawer-title" className="mt-2 text-base font-semibold">
                  {alert.station}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-sub">{alert.message}</p>
              </div>
              <button
                onClick={onClose}
                autoFocus
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sub hover:bg-raised hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="grid grid-cols-3 border-b border-line text-xs">
              <div className="border-r border-line px-5 py-3">
                <dt className="text-sub">Reading</dt>
                <dd className="mt-0.5 font-mono text-ink">{alert.time}</dd>
              </div>
              <div className="border-r border-line px-5 py-3">
                <dt className="text-sub">Confidence</dt>
                <dd className="mt-0.5 font-mono text-ink">{alert.confidence}%</dd>
              </div>
              <div className="px-5 py-3">
                <dt className="text-sub">Status</dt>
                <dd className="mt-0.5 text-ink">{alert.status.toLowerCase()}</dd>
              </div>
            </dl>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5 text-[13px]">
              {evidenceError && <p role="status" className="text-warn">{evidenceError}</p>}
              {explanation && (
                <>
                  {explanation.quality_notes?.map((note) => (
                    <p key={note} className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-warn">
                      {note}
                    </p>
                  ))}
                  <section>
                    <h3 className="mb-1.5 text-xs font-medium text-sub">Why it was flagged</h3>
                    <ul className="list-disc space-y-1 pl-4 leading-relaxed">
                      {explanation.findings.map((finding, i) => <li key={i}>{finding}</li>)}
                      {explanation.findings.length === 0 && <li>No detailed detection evidence recorded.</li>}
                    </ul>
                  </section>
                  {explanation.context.length > 0 && (
                    <section>
                      <h3 className="mb-1.5 text-xs font-medium text-sub">Weather comparisons</h3>
                      <ul className="list-disc space-y-1 pl-4 leading-relaxed">
                        {explanation.context.map((comparison, i) => <li key={i}>{comparison}</li>)}
                      </ul>
                    </section>
                  )}
                  {!!explanation.related_readings?.length && (
                    <section>
                      <h3 className="mb-1.5 text-xs font-medium text-sub">Readings behind this alert</h3>
                      <ul className="divide-y divide-line rounded-md border border-line">
                        {explanation.related_readings.map((reading) => (
                          <li key={reading.anomaly_id} className="px-3 py-2">
                            {reading.observed_at && (
                              <p className="font-mono text-xs text-sub">{new Date(reading.observed_at).toLocaleString()}</p>
                            )}
                            <p>{reading.summary}</p>
                          </li>
                        ))}
                      </ul>
                      {explanation.group_note && <p className="mt-2 text-sub">{explanation.group_note}</p>}
                    </section>
                  )}
                  <section className="space-y-1 text-xs leading-relaxed text-sub">
                    <p>
                      Source: {explanation.source ?? "Not recorded"}
                      {explanation.source === "OPEN_METEO" && " (forecast output, not a sensor measurement)"}
                      {explanation.observed_at && `. Reading time ${new Date(explanation.observed_at).toLocaleString()}`}
                    </p>
                    <p>
                      {alert.receivedAt && `Received ${new Date(alert.receivedAt).toLocaleString()}. `}
                      {alert.detectedAt && `Processed ${new Date(alert.detectedAt).toLocaleString()}. `}
                      Local timezone.
                    </p>
                    <p>Trigger: {alert.policyTitle}. Confidence is a heuristic, not a calibrated fault probability.</p>
                  </section>
                </>
              )}

              <section>
                <h3 className="mb-1.5 text-xs font-medium text-sub">Next steps</h3>
                <ol className="space-y-2">
                  {steps.map((step, i) => (
                    <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-1 leading-relaxed">
                      <span className="pt-px font-mono text-xs text-sub">{String(i + 1).padStart(2, "0")}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <div className="border-t border-line bg-raised px-5 py-4">
              {!user ? (
                <p className="text-[13px] text-sub">
                  <Link href="/login" className="text-accent hover:underline" onClick={onClose}>
                    Sign in
                  </Link>{" "}
                  to acknowledge or review this alert.
                </p>
              ) : done ? (
                <p className="flex items-center gap-1.5 text-[13px] text-ok">
                  <Check className="h-4 w-4" /> {done}
                </p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-sub">Review as</p>
                  <div className="grid grid-cols-3 gap-2">
                    {REVIEW_ACTIONS.map(({ classification, label, icon: Icon }) => (
                      <button
                        key={classification}
                        onClick={() => review(classification)}
                        disabled={busy !== null}
                        className={`${button} h-auto min-h-8 justify-center py-1.5 text-xs`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {busy === classification ? "Saving" : label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={acknowledge}
                    disabled={busy !== null}
                    className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-md bg-accent text-[13px] font-medium text-white transition-opacity hover:opacity-90 active:translate-y-px disabled:opacity-40"
                  >
                    {busy === "ack" ? "Acknowledging" : "Acknowledge"}
                  </button>
                  {error && <p className="mt-2 text-xs text-crit">{error}</p>}
                </>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
