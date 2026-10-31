"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Bell, Clock, Gauge, House, Map, Settings, Shield, Wrench, type LucideIcon } from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/useAuth";

const NAV: { href: string; label: string; icon: LucideIcon; admin?: boolean }[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/live-monitor", label: "Live", icon: Activity },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/analysis", label: "Analysis", icon: BarChart3 },
  { href: "/sensor-health", label: "Sensors", icon: Gauge },
  { href: "/network", label: "Network", icon: Map },
  { href: "/maintenance", label: "Upkeep", icon: Wrench },
  { href: "/history", label: "History", icon: Clock },
  { href: "/admin", label: "Admin", icon: Shield, admin: true },
];

function Item({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-medium transition-colors md:w-16 ${
        active ? "bg-accent-soft text-accent" : "text-sub hover:bg-raised hover:text-ink"
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.8} />
      {label}
    </Link>
  );
}

/** App navigation: a vertical rail on desktop, a scrolling strip on small screens. */
export default function SideRail() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = !!user?.roles.includes("ADMIN");
  const items = NAV.filter((n) => !n.admin || isAdmin);

  return (
    <aside className="z-30 shrink-0 md:sticky md:top-0 md:h-dvh md:p-4 md:pr-0">
      <nav
        aria-label="Console"
        className="c-card flex items-center gap-1 overflow-x-auto rounded-none border-x-0 border-t-0 px-3 py-2 md:h-full md:flex-col md:overflow-visible md:rounded-2xl md:border md:px-3 md:py-4"
      >
        <Link href="/dashboard" aria-label="MeghDrishti home" className="mr-2 shrink-0 md:mr-0 md:mb-4">
          <Logo size={36} />
        </Link>
        {items.map((n) => (
          <Item key={n.href} {...n} active={pathname === n.href} />
        ))}
        <div className="hidden md:block md:flex-1" />
        <Item href="/settings" label="Settings" icon={Settings} active={pathname === "/settings"} />
      </nav>
    </aside>
  );
}
