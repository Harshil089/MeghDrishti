"use client";

import Topbar from "@/components/Topbar";
import type { Alert } from "@/lib/mock-data";
import { fetchAlerts } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const severityStyle: Record<string, string> = {
  critical: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  warning: "bg-amber-400/10 text-amber-400 border-amber-400/30",
  info: "bg-cyan-400/10 text-cyan-300 border-cyan-400/30",
};

export default function AlertsPage() {
  const alerts = useLiveData(fetchAlerts, [] as Alert[]);
  return (
    <>
      <Topbar title="Alerts" />
      <main className="flex-1 p-4 md:p-6">
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Station</th>
                <th className="px-4 py-3 font-medium">Reason code</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 font-medium">Severity</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted">
                    No open alerts — every station is reporting clean.
                  </td>
                </tr>
              )}
              {alerts.map((a) => (
                <tr key={a.id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-muted whitespace-nowrap">{a.time}</td>
                  <td className="px-4 py-3 font-medium">{a.station}</td>
                  <td className="px-4 py-3 text-cyan-300 font-mono text-xs">{a.code}</td>
                  <td className="px-4 py-3 text-muted max-w-sm">{a.message}</td>
                  <td className="px-4 py-3 text-muted">{a.confidence}%</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${severityStyle[a.severity]}`}>
                      {a.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
