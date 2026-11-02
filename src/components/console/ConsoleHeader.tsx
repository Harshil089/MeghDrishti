"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, LogOut, ShieldCheck, Clock, Command } from "lucide-react";
import AlertDetailModal from "@/components/AlertDetailModal";
import type { Alert, Station } from "@/lib/mock-data";
import { fetchAlerts, fetchStations } from "@/lib/api";
import { useLiveData, useLiveDataWs } from "@/lib/useLiveData";
import { useAuth } from "@/lib/useAuth";
import { logout } from "@/lib/auth";
import { Badge, severityTone } from "@/components/console/ui";
import { motionTransitions } from "@/lib/motion-tokens";

const dot: Record<string, string> = {
  crit: "bg-crit shadow-[0_0_6px_rgba(185,28,28,0.5)]",
  warn: "bg-warn shadow-[0_0_6px_rgba(180,83,9,0.5)]",
  info: "bg-accent shadow-[0_0_6px_rgba(29,78,216,0.5)]",
};

export default function ConsoleHeader() {
  const router = useRouter();
  const { user } = useAuth();
  const alerts = useLiveDataWs(fetchAlerts, [] as Alert[], "/ws/alerts");
  const stations = useLiveData(fetchStations, [] as Station[]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const inboxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = alerts.filter((a) => a.severity !== "info");
  const q = query.trim().toLowerCase();
  const stationHits = q ? stations.filter((s) => `${s.name} ${s.id}`.toLowerCase().includes(q)).slice(0, 5) : [];
  const alertHits = q
    ? alerts.filter((a) => [a.station, a.code, a.message].some((v) => v.toLowerCase().includes(q))).slice(0, 5)
    : [];

  // Cmd+K shortcut listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!inboxOpen) return;
    function onDown(e: MouseEvent) {
      if (!inboxRef.current?.contains(e.target as Node)) setInboxOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setInboxOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [inboxOpen]);

  const nowDate = new Date();
  const istTime = nowDate.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const utcTime = nowDate.toLocaleTimeString("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur-md transition-shadow duration-300">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-2.5 md:px-6">
        {/* Institutional authority status & dual synoptic clock */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-ok/30 bg-ok/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ok shadow-2xs">
            <ShieldCheck className="h-3 w-3" />
            IMD-QC Live
          </span>
          <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-sub">
            <Clock className="h-3.5 w-3.5 text-accent" />
            <span className="font-semibold text-ink">{istTime} IST</span>
            <span className="text-line">|</span>
            <span>{utcTime} UTC</span>
          </div>
        </div>

        {/* Global Station & Alert Command Search */}
        <div className="relative ml-auto hidden w-full max-w-md sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sub" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search AWS station code, district, or QC reason code…"
            aria-label="Search stations and alerts"
            className="h-8 w-full rounded-lg border border-line bg-canvas/70 pl-8 pr-12 text-xs text-ink placeholder:text-sub transition-all focus:bg-surface focus:border-accent/60 focus:shadow-xs focus-visible:outline-none"
          />
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] font-mono text-sub/70 border border-line/60 rounded px-1 bg-surface/60">
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </div>

          <AnimatePresence>
            {focused && q && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={motionTransitions.springSnappy}
                className="absolute top-full mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-xl shadow-ink/10 z-50"
              >
                {stationHits.length === 0 && alertHits.length === 0 ? (
                  <p className="px-3 py-3 font-mono text-xs uppercase tracking-wider text-sub">No matching records</p>
                ) : (
                  <ul className="max-h-72 divide-y divide-line/60 overflow-y-auto py-1 text-xs">
                    {stationHits.map((s) => (
                      <li key={s.id}>
                        <button
                          onMouseDown={() => {
                            setQuery("");
                            router.push(`/network?station=${s.id}&notify=1`);
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-raised transition-colors cursor-pointer"
                        >
                          <span className="truncate font-medium text-ink">
                            {s.name} <span className="ml-1 font-mono text-[11px] text-sub">{s.id}</span>
                          </span>
                          <span className="rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] uppercase text-sub">
                            AWS Station
                          </span>
                        </button>
                      </li>
                    ))}
                    {alertHits.map((a) => (
                      <li key={a.id}>
                        <button
                          onMouseDown={() => {
                            setQuery("");
                            setSelectedAlert(a);
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-raised transition-colors cursor-pointer"
                        >
                          <span className="truncate text-ink">
                            <span className="font-medium">{a.station}</span>{" "}
                            <span className="font-mono text-[11px] text-sub">{a.code}</span>
                          </span>
                          <Badge tone={severityTone[a.severity]}>{a.severity}</Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right-side Alert Triage Inbox + Operator Badge */}
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <div className="relative" ref={inboxRef}>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setInboxOpen((o) => !o)}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-sub transition-colors hover:bg-raised hover:text-ink cursor-pointer"
              aria-label={`Alert inbox, ${open.length} need review`}
              aria-expanded={inboxOpen}
            >
              <Bell className="h-4 w-4" />
              {open.length > 0 && (
                <span className="absolute -right-1 -top-1 min-w-4 h-4 rounded-full bg-crit px-1 font-mono text-[10px] font-semibold leading-4 text-white text-center shadow-xs">
                  {open.length > 99 ? "99+" : open.length}
                </span>
              )}
            </motion.button>

            <AnimatePresence>
              {inboxOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -6 }}
                  transition={motionTransitions.springSnappy}
                  className="absolute right-0 top-full mt-2 w-88 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-ink/20 z-50"
                >
                  <div className="flex h-10 items-center justify-between border-b border-line bg-raised/60 px-3.5">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink">
                      Active Alert Queue ({open.length})
                    </p>
                    <Link
                      href="/alerts"
                      onClick={() => setInboxOpen(false)}
                      className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent hover:underline"
                    >
                      Open Triage →
                    </Link>
                  </div>
                  <ul className="max-h-80 overflow-y-auto divide-y divide-line">
                    {alerts.length === 0 && (
                      <li className="px-3 py-6 text-center font-mono text-xs uppercase tracking-wider text-sub">
                        No active alerts in queue
                      </li>
                    )}
                    {alerts.map((a) => (
                      <li key={a.id}>
                        <button
                          onClick={() => {
                            setSelectedAlert(a);
                            setInboxOpen(false);
                          }}
                          className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-raised transition-colors cursor-pointer"
                        >
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[severityTone[a.severity]]}`} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-ink">{a.station}</span>
                              <span className="font-mono text-[10px] text-sub">{a.code}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-sub">{a.message}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {user && (
            <div className="flex items-center gap-2 border-l border-line pl-2.5">
              <div className="hidden lg:block text-right">
                <p className="max-w-44 truncate text-xs font-medium leading-none text-ink" title={user.email}>
                  {user.email}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-sub">
                  {user.roles?.[0] ?? "OPERATOR"} · CLEARANCE L2
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={logout}
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-sub transition-colors hover:bg-raised hover:text-ink cursor-pointer"
                aria-label="Sign out"
                title="Sign out of console"
              >
                <LogOut className="h-3.5 w-3.5" />
              </motion.button>
            </div>
          )}
        </div>
      </div>

      <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </header>
  );
}
