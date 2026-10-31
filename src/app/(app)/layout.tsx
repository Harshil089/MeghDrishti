"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import ConsoleHeader from "@/components/console/ConsoleHeader";
import SideRail from "@/components/console/SideRail";
import AsciiBackdrop from "@/components/ascii/AsciiBackdrop";
import AsciiArt from "@/components/ascii/AsciiArt";
import { stationsLg } from "@/components/ascii/art";
import { useAuth } from "@/lib/useAuth";

// Shell silhouette shown while auth resolves: header bars + metric strip,
// the same shape every page opens with, so nothing jumps on swap.
function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-canvas md:flex">
      <div className="hidden md:block md:p-4 md:pr-0">
        <div className="h-[calc(100dvh-2rem)] w-[88px] rounded-2xl border border-line bg-surface" />
      </div>
      <div className="flex-1 space-y-5 px-4 py-6 md:px-6">
        <div className="h-8 w-56 rounded-lg bg-raised animate-pulse" />
        <div className="h-64 rounded-2xl border border-line bg-surface" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl border border-line bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) return <ShellSkeleton />;

  return (
    <div className="relative isolate min-h-dvh w-full bg-canvas text-ink md:flex">
      {/* India drawn by the network's own stations, quietly behind every console page. */}
      <AsciiBackdrop opacity={0.55}>
        <AsciiArt art={stationsLg} x={0.76} dy={0.55} depth={0.12} effect="twinkle" />
      </AsciiBackdrop>
      <SideRail />
      <div className="min-w-0 flex-1">
        <ConsoleHeader />
        {/* key remounts main on every tab switch so the fade replays */}
        <main key={pathname} className="page-fade mx-auto max-w-[1360px] px-4 pb-10 pt-4 md:px-6">{children}</main>
      </div>
    </div>
  );
}
