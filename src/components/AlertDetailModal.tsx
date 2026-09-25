"use client";

import { useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ShieldCheck, X, Check, Ban, CloudLightning, HelpCircle } from "lucide-react";
import { alertSafetySteps, defaultSafetySteps, type Alert } from "@/lib/mock-data";
import { submitReview, updateAlertStatus, type ReviewClassification } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

const severityStyle: Record<Alert["severity"], string> = {
  critical: "text-rose-400 border-rose-500/30 bg-rose-500/10",
  warning: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  info: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
};

const REVIEW_ACTIONS: { classification: ReviewClassification; label: string; icon: typeof Check; tone: string }[] = [
  { classification: "CONFIRMED_SENSOR_FAULT", label: "Confirm sensor fault", icon: Ban, tone: "text-rose-400 border-rose-500/30 hover:bg-rose-500/10" },
  { classification: "VALID_EXTREME_WEATHER", label: "Valid extreme weather", icon: CloudLightning, tone: "text-purple-400 border-purple-500/30 hover:bg-purple-500/10" },
  { classification: "FALSE_POSITIVE", label: "False positive", icon: HelpCircle, tone: "text-amber-400 border-amber-400/30 hover:bg-amber-400/10" },
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
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-md rounded-2xl border border-border bg-panel-2 p-5 shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-rose-400" />
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${severityStyle[alert.severity]}`}>
                {alert.severity}
              </span>
              <span className="font-mono text-[11px] text-muted">{alert.code}</span>
            </div>

            <h3 className="text-base font-semibold mb-1">
              {alert.station} <span className="text-muted font-normal">— what&apos;s wrong</span>
            </h3>
            <p className="text-sm text-muted leading-relaxed mb-4">{alert.message}</p>

            <div className="flex items-center gap-4 text-xs text-muted mb-5 pb-4 border-b border-border">
              <span>{alert.time}</span>
              <span>confidence {alert.confidence}%</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide">{alert.status}</span>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h4 className="text-sm font-semibold">Recommended next steps</h4>
            </div>
            <ol className="space-y-2 mb-5">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-muted leading-relaxed">
                  <span className="shrink-0 h-4 w-4 rounded-full bg-emerald-400/15 text-emerald-400 text-[10px] flex items-center justify-center font-mono mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <div className="border-t border-border pt-4">
              {!user ? (
                <p className="text-xs text-muted">
                  <Link href="/login" className="text-cyan-300 hover:underline" onClick={onClose}>
                    Sign in
                  </Link>{" "}
                  to acknowledge or review this alert.
                </p>
              ) : done ? (
                <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> {done}
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-muted mb-2">Operator action</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={acknowledge}
                      disabled={busy !== null}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/80 hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                    >
                      {busy === "ack" ? "Acknowledging…" : "Acknowledge"}
                    </button>
                    {REVIEW_ACTIONS.map(({ classification, label, icon: Icon, tone }) => (
                      <button
                        key={classification}
                        onClick={() => review(classification)}
                        disabled={busy !== null}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${tone}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {busy === classification ? "Submitting…" : label}
                      </button>
                    ))}
                  </div>
                  {error && <p className="text-[11px] text-rose-400 mt-2">{error}</p>}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
