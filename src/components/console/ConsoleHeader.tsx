"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Bell, LogOut } from "lucide-react";
import AlertDetailModal from "@/components/AlertDetailModal";
import type { Alert, Station } from "@/lib/mock-data";
import { fetchAlerts, fetchStations } from "@/lib/api";
import { useLiveData, useLiveDataWs } from "@/lib/useLiveData";
import { useAuth } from "@/lib/useAuth";
import { logout } from "@/lib/auth";
import { severityTone } from "@/components/console/ui";

const dot: Record<string, string> = { crit: "bg-crit", warn: "bg-warn", info: "bg-accent" };

const iconButton =
  "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-sub transition-colors hover:text-ink";

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

  const open = alerts.filter((a) => a.severity !== "info");
  const q = query.trim().toLowerCase();
  const stationHits = q ? stations.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 5) : [];
  const alertHits = q
    ? alerts.filter((a) => [a.station, a.code, a.message].some((v) => v.toLowerCase().includes(q))).slice(0, 5)
    : [];

  // Close the inbox on outside click or Escape.
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

  const now = new Date().toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <header className="relative z-30">
      <div className="mx-auto flex max-w-[1360px] items-center gap-3 px-4 pt-4 md:px-6 md:pt-5">
        <p className="hidden font-mono text-[11px] uppercase tracking-wider text-sub sm:block">{now}</p>

        <div className="relative ml-auto w-full max-w-sm hidden sm:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sub" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search stations, readings or alerts"
            aria-label="Search stations and alerts"
            className="h-9 w-full rounded-full border border-line bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-sub focus-visible:outline-2 focus-visible:outline-accent"
          />
          {focused && q && (
            <div className="absolute top-full mt-1 w-full overflow-hidden rounded-md border border-line bg-surface shadow-lg shadow-ink/10">
              {stationHits.length === 0 && alertHits.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-sub">No matches</p>
              ) : (
                <ul className="max-h-72 overflow-y-auto py-1 text-[13px]">
                  {stationHits.map((s) => (
                    <li key={s.id}>
                      <button
                        onMouseDown={() => {
                          setQuery("");
                          router.push(`/network?station=${s.id}`);
                        }}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-raised"
                      >
                        <span className="text-ink truncate">{s.name}</span>
                        <span className="text-xs text-sub">Station</span>
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
                        className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-raised"
                      >
                        <span className="text-ink truncate">
                          {a.station} <span className="font-mono text-xs text-sub">{a.code}</span>
                        </span>
                        <span className="text-xs text-sub">Alert</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 ml-auto sm:ml-0">
          <div className="relative" ref={inboxRef}>
            <button
              onClick={() => setInboxOpen((o) => !o)}
              className={iconButton}
              aria-label={`Alert inbox, ${open.length} need review`}
              aria-expanded={inboxOpen}
            >
              <Bell className="h-4 w-4" />
              {open.length > 0 && (
                <span className="absolute right-1 top-1 min-w-3.5 h-3.5 rounded-full bg-crit px-0.5 font-mono text-[9px] leading-3.5 text-white text-center">
                  {open.length > 9 ? "9+" : open.length}
                </span>
              )}
            </button>
            {inboxOpen && (
              <div className="absolute right-0 top-full mt-1 w-80 overflow-hidden rounded-md border border-line bg-surface shadow-lg shadow-ink/10">
                <div className="flex items-center justify-between border-b border-line px-3 h-10">
                  <p className="text-[13px] font-semibold text-ink">Inbox</p>
                  <Link href="/alerts" onClick={() => setInboxOpen(false)} className="text-xs text-accent hover:underline">
                    All alerts
                  </Link>
                </div>
                <ul className="max-h-80 overflow-y-auto">
                  {alerts.length === 0 && <li className="px-3 py-6 text-center text-xs text-sub">No open alerts</li>}
                  {alerts.map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => {
                          setSelectedAlert(a);
                          setInboxOpen(false);
                        }}
                        className="flex w-full items-start gap-2.5 border-b border-line px-3 py-2 text-left last:border-0 hover:bg-raised"
                      >
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot[severityTone[a.severity]]}`} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-ink">
                            {a.station} <span className="font-mono text-xs text-sub">{a.code}</span>
                          </span>
                          <span className="block truncate text-xs text-sub">{a.message}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {user && (
            <div className="ml-1 flex items-center gap-2">
              <span className="hidden lg:block max-w-40 truncate text-xs text-sub" title={user.email}>
                {user.email}
              </span>
              <button onClick={logout} className={iconButton} aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </header>
  );
}
