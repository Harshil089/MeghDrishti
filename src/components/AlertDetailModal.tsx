"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import { alertSafetySteps, defaultSafetySteps, type Alert } from "@/lib/mock-data";

const severityStyle: Record<Alert["severity"], string> = {
  critical: "text-rose-400 border-rose-500/30 bg-rose-500/10",
  warning: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  info: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
};

export default function AlertDetailModal({ alert, onClose }: { alert: Alert | null; onClose: () => void }) {
  const steps = alert ? alertSafetySteps[alert.code] ?? defaultSafetySteps : [];

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
            </div>

            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h4 className="text-sm font-semibold">Recommended next steps</h4>
            </div>
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-muted leading-relaxed">
                  <span className="shrink-0 h-4 w-4 rounded-full bg-emerald-400/15 text-emerald-400 text-[10px] flex items-center justify-center font-mono mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
