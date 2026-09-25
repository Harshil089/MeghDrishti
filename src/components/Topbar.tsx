"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, Search, Bell } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AlertDetailModal from "@/components/AlertDetailModal";
import type { Alert } from "@/lib/mock-data";
import { fetchAlerts } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const severityDot: Record<string, string> = {
  critical: "bg-rose-500",
  warning: "bg-amber-400",
  info: "bg-cyan-400",
};

export default function Topbar({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const alerts = useLiveData(fetchAlerts, [] as Alert[]);
  const unread = alerts.filter((a) => a.severity !== "info").length;

  function toggleOpen() {
    if (!open && bellRef.current) {
      const r = bellRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  }

  return (
    <header className="h-16 shrink-0 flex items-center justify-between gap-4 border-b border-border bg-panel/40 glass px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button className="md:hidden text-muted">
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base md:text-lg font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-sm text-muted w-64">
          <Search className="h-4 w-4" />
          <span>Search station, alert…</span>
        </div>

        <button
          ref={bellRef}
          onClick={toggleOpen}
          className="relative rounded-lg border border-border p-2 text-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500 animate-pulse-slow" />
          )}
        </button>

        <ThemeToggle />
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-orange-400 flex items-center justify-center text-[11px] font-semibold text-black">
          MD
        </div>
      </div>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
            <div
              className="fixed w-80 rounded-xl border border-border bg-panel-2 shadow-2xl z-[101] overflow-hidden"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold">Notifications</p>
                <p className="text-[11px] text-muted">{unread} needing review</p>
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {alerts.length === 0 && (
                  <li className="px-4 py-6 text-center text-xs text-muted">No open alerts.</li>
                )}
                {alerts.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => {
                        setSelectedAlert(a);
                        setOpen(false);
                      }}
                      className="w-full flex items-start gap-2.5 text-left px-4 py-2.5 text-xs hover:bg-white/[0.04] transition-colors"
                    >
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${severityDot[a.severity]}`} />
                      <div className="min-w-0">
                        <p className="text-foreground/90 truncate">
                          {a.station} — {a.code}
                        </p>
                        <p className="text-muted truncate">{a.message}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>,
          document.body
        )}

      <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </header>
  );
}
