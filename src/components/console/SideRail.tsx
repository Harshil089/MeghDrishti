"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Clock,
  Gauge,
  LayoutDashboard,
  Map,
  Settings,
  Shield,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/useAuth";

type NavItem = { href: string; label: string; shortLabel: string; code: string; icon: LucideIcon; admin?: boolean };

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operations",
    items: [
      { href: "/dashboard", label: "Command Overview", shortLabel: "Overview", code: "01", icon: LayoutDashboard },
      { href: "/live-monitor", label: "Live Telemetry", shortLabel: "Live", code: "02", icon: Activity },
      { href: "/alerts", label: "Anomaly Triage", shortLabel: "Triage", code: "03", icon: Bell },
      { href: "/network", label: "National AWS Grid", shortLabel: "Grid Map", code: "04", icon: Map },
    ],
  },
  {
    title: "Quality Intelligence",
    items: [
      { href: "/analysis", label: "QC & Rule Analytics", shortLabel: "Analytics", code: "05", icon: BarChart3 },
      { href: "/sensor-health", label: "Sensor Fleet Health", shortLabel: "Sensors", code: "06", icon: Gauge },
      { href: "/maintenance", label: "Field Dispatch", shortLabel: "Dispatch", code: "07", icon: Wrench },
    ],
  },
  {
    title: "Governance & Audit",
    items: [
      { href: "/history", label: "Audit Ledger", shortLabel: "Ledger", code: "08", icon: Clock },
      { href: "/admin", label: "Pipeline & ML Admin", shortLabel: "Admin", code: "09", icon: Shield, admin: true },
      { href: "/settings", label: "System Calibration", shortLabel: "Config", code: "10", icon: Settings },
    ],
  },
];

export default function SideRail() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = !!user?.roles.includes("ADMIN");

  const mobileItems = GROUPS.flatMap((g) => g.items).filter((n) => !n.admin || isAdmin);

  return (
    <aside className="z-30 shrink-0 bg-[#0b172a] text-slate-200 md:sticky md:top-0 md:h-dvh md:w-60 md:border-r md:border-[#1e3358]">
      <div className="gov-tricolor" />

      {/* Mobile horizontal navigation bar */}
      <nav aria-label="Console mobile" className="flex items-center gap-1 overflow-x-auto border-b border-[#1e3358] px-3 py-2 md:hidden">
        <Link href="/" aria-label="MeghDrishti home" className="mr-2 flex shrink-0 items-center gap-2">
          <Logo size={28} />
          <span className="font-mono text-xs font-semibold tracking-wider text-white">MEGHDRISHTI</span>
        </Link>
        {mobileItems.map((n) => {
          const active = pathname === n.href;
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-[#1d4ed8] text-white" : "text-slate-300 hover:bg-[#13233f] hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
              {n.shortLabel}
            </Link>
          );
        })}
      </nav>

      {/* Desktop full-height institutional command rail */}
      <nav aria-label="Console" className="hidden h-[calc(100dvh-3px)] flex-col justify-between md:flex">
        <div>
          <div className="border-b border-[#1e3358] px-4 py-3.5">
            <Link href="/" className="flex items-center gap-3">
              <Logo size={34} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-white">MeghDrishti</p>
                <p className="truncate font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  MoES · IMD AWS QC
                </p>
              </div>
            </Link>
          </div>

          <div className="space-y-5 px-3 py-4">
            {GROUPS.map((group) => {
              const visible = group.items.filter((n) => !n.admin || isAdmin);
              if (visible.length === 0) return null;
              return (
                <div key={group.title}>
                  <p className="mb-1.5 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {group.title}
                  </p>
                  <ul className="space-y-0.5">
                    {visible.map((item) => {
                      const active = pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={`group flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] font-medium transition-colors ${
                              active
                                ? "bg-[#1d4ed8] text-white shadow-xs"
                                : "text-slate-300 hover:bg-[#13233f] hover:text-white"
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                active ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                              }`}
                              strokeWidth={1.9}
                            />
                            <span className="truncate flex-1">{item.label}</span>
                            <span
                              className={`font-mono text-[10px] ${
                                active ? "text-blue-200" : "text-slate-500 group-hover:text-slate-400"
                              }`}
                            >
                              {item.code}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#1e3358] bg-[#081120] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-300">
              WMO-No. 8 QC Engine
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-slate-400">
            National Surface Telemetry · v2.6
          </p>
        </div>
      </nav>
    </aside>
  );
}
