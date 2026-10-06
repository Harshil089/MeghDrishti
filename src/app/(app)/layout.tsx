"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import ConsoleHeader from "@/components/console/ConsoleHeader";
import { useAuth } from "@/lib/useAuth";

// Shell silhouette shown while auth resolves: header bars + metric strip,
// the same shape every page opens with, so nothing jumps on swap.
function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="h-[89px] border-b border-line bg-surface" />
      <div className="mx-auto max-w-[1440px] px-4 md:px-6 py-6 space-y-5">
        <div className="h-6 w-48 rounded bg-raised animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-md border border-line bg-line overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[84px] bg-surface" />
          ))}
        </div>
        <div className="h-72 rounded-md border border-line bg-surface" />
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
    <div className="min-h-dvh w-full bg-canvas text-ink">
      <ConsoleHeader />
      {/* key remounts main on every tab switch so the fade replays */}
      <main key={pathname} className="page-fade mx-auto max-w-[1440px] px-4 md:px-6 py-6">{children}</main>
    </div>
  );
}
