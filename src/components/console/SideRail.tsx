"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
import { motionTransitions } from "@/lib/motion-tokens";

type NavItem = { href: string; label: string; icon: LucideIcon; admin?: boolean };

const GROUPS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/live-monitor", label: "Live Telemetry", icon: Activity },
      { href: "/alerts", label: "Alerts", icon: Bell },
      { href: "/network", label: "Grid Map", icon: Map },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { href: "/analysis", label: "Analytics", icon: BarChart3 },
      { href: "/sensor-health", label: "Sensors", icon: Gauge },
      { href: "/maintenance", label: "Dispatch", icon: Wrench },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/history", label: "Audit Ledger", icon: Clock },
      { href: "/admin", label: "Admin", icon: Shield, admin: true },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function SideRail() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = !!user?.roles.includes("ADMIN");

  const mobileItems = GROUPS.flatMap((g) => g.items).filter((n) => !n.admin || isAdmin);

  return (
    <aside className="z-30 shrink-0 bg-[#090d16] text-slate-200 md:sticky md:top-0 md:h-dvh md:w-56 md:border-r md:border-[#1a2234]">
      {/* Mobile navigation bar */}
      <nav aria-label="Console mobile" className="flex items-center gap-1 overflow-x-auto border-b border-[#1a2234] px-3 py-2 md:hidden">
        <Link href="/" aria-label="MeghDrishti home" className="mr-2 flex shrink-0 items-center gap-2">
          <Logo size={26} />
          <span className="font-semibold text-xs tracking-tight text-white">MeghDrishti</span>
        </Link>
        {mobileItems.map((n) => {
          const active = pathname === n.href;
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active ? "text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="activeSideRailMobile"
                  transition={motionTransitions.springMorph}
                  className="absolute inset-0 rounded-lg bg-[#2563eb] -z-10 shadow-xs"
                />
              )}
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              {n.label}
            </Link>
          );
        })}
      </nav>

      {/* Desktop sidebar */}
      <nav aria-label="Console" className="hidden h-dvh flex-col justify-between md:flex">
        <div>
          <div className="border-b border-[#1a2234] px-4 py-3.5">
            <Link href="/" className="flex items-center gap-2.5 group">
              <Logo size={30} />
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-white group-hover:text-blue-300 transition-colors">
                  MeghDrishti
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              </div>
            </Link>
          </div>

          <div className="space-y-4 px-3 py-3">
            {GROUPS.map((group, idx) => {
              const visible = group.items.filter((n) => !n.admin || isAdmin);
              if (visible.length === 0) return null;
              return (
                <div key={idx} className="space-y-0.5">
                  {group.title && (
                    <p className="px-2 pt-2 pb-1 text-[11px] font-medium text-slate-500 tracking-wider uppercase">
                      {group.title}
                    </p>
                  )}
                  <ul>
                    {visible.map((item) => {
                      const active = pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <li key={item.href} className="relative">
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors select-none ${
                              active
                                ? "text-white font-semibold"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            {active && (
                              <motion.div
                                layoutId="activeSideRailDesktop"
                                transition={motionTransitions.springMorph}
                                className="absolute inset-0 rounded-lg bg-[#2563eb] shadow-[0_1px_8px_rgba(37,99,235,0.35)] -z-10"
                              />
                            )}
                            <Icon
                              className={`h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                                active ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                              }`}
                              strokeWidth={1.8}
                            />
                            <span className="truncate flex-1">{item.label}</span>
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

        {/* Minimal status indicator at bottom */}
        <div className="border-t border-[#1a2234] px-4 py-3 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-slate-400">Operational</span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">v2.6</span>
        </div>
      </nav>
    </aside>
  );
}
