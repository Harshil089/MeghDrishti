"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  HeartPulse,
  BarChart3,
  Radar,
  Wrench,
  History,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/useAuth";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live-monitor", label: "Live Monitor", icon: Activity },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/sensor-health", label: "Sensor Health", icon: HeartPulse },
  { href: "/analysis", label: "Analysis", icon: BarChart3 },
  { href: "/network", label: "Network", icon: Radar },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = user?.roles.includes("ADMIN")
    ? [...nav, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : nav;

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-panel/60 glass">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-border">
        <div className="glow-cyan rounded-lg">
          <Logo size={36} />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-wide">MeghDrishti</p>
          <p className="text-[10px] text-muted uppercase tracking-widest">SIH26073</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active ? "text-cyan-300" : "text-muted hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  className="absolute inset-0 rounded-lg bg-cyan-400/10 border border-cyan-400/20"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon className={`relative h-4 w-4 ${active ? "text-cyan-300" : "text-muted group-hover:text-foreground"}`} />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="rounded-lg px-3 py-3 text-xs text-muted glass">
          <p className="text-foreground/80 font-medium mb-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
            Live backend
          </p>
          Connected to MeghDrishti API
        </div>
      </div>
    </aside>
  );
}
