"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, Sun, Moon, LogOut } from "lucide-react";
import Logo from "@/components/Logo";
import AlertDetailModal from "@/components/AlertDetailModal";
import type { Alert, Station } from "@/lib/mock-data";
import { fetchAlerts, fetchStations } from "@/lib/api";
import { useLiveData, useLiveDataWs } from "@/lib/useLiveData";
import { useAuth } from "@/lib/useAuth";
import { logout } from "@/lib/auth";
import { severityTone } from "@/components/console/ui";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/live-monitor", label: "Live" },
  { href: "/alerts", label: "Alerts" },
  { href: "/analysis", label: "Analysis" },
  { href: "/sensor-health", label: "Sensors" },
  { href: "/network", label: "Network" },
  { href: "/maintenance", label: "Maintenance" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

const dot: Record<string, string> = { crit: "bg-crit", warn: "bg-warn", info: "bg-accent" };

function useTheme() {
  // The console only renders client-side after auth resolves, so reading
  // the class during the first render cannot cause a hydration mismatch.
  const [light, setLight] = useState(() => document.documentElement.classList.contains("light"));
  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("meghdrishti-theme", next ? "light" : "dark");
    } catch {}
    window.dispatchEvent(new Event("themechange"));
  }
  return { light, toggle };
}

const iconButton =
  "relative inline-flex h-8 w-8 items-center justify-center rounded-md text-sub transition-colors hover:bg-raised hover:text-ink";

export default function ConsoleHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { light, toggle } = useTheme();
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

  const nav = user?.roles.includes("ADMIN") ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-4 px-4 md:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <Logo size={22} />
          <span className="text-[13px] font-semibold text-ink">MeghDrishti</span>
        </Link>

        <div className="relative ml-auto w-full max-w-xs hidden sm:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sub" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search stations and alerts"
            aria-label="Search stations and alerts"
            className="h-8 w-full rounded-md border border-line bg-canvas pl-8 pr-2.5 text-[13px] text-ink placeholder:text-sub focus-visible:outline-2 focus-visible:outline-accent"
          />
          {focused && q && (
            <div className="absolute top-full mt-1 w-full overflow-hidden rounded-md border border-line bg-surface shadow-lg shadow-black/20">
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
              <div className="absolute right-0 top-full mt-1 w-80 overflow-hidden rounded-md border border-line bg-surface shadow-lg shadow-black/20">
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

          <button onClick={toggle} className={iconButton} aria-label={light ? "Switch to dark theme" : "Switch to light theme"}>
            {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          {user && (
            <div className="ml-1 flex items-center gap-1 border-l border-line pl-2">
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

      <nav aria-label="Console" className="mx-auto max-w-[1440px] overflow-x-auto px-2 md:px-4">
        <ul className="flex h-10 items-stretch">
          {nav.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href} className="flex">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center whitespace-nowrap px-3 text-[13px] transition-colors ${
                    active ? "text-ink font-medium" : "text-sub hover:text-ink"
                  }`}
                >
                  {label}
                  {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <AlertDetailModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </header>
  );
}
