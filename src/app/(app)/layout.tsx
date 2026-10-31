"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import ConsoleHeader from "@/components/console/ConsoleHeader";
import SideRail from "@/components/console/SideRail";
import { useAuth } from "@/lib/useAuth";

function ShellSkeleton() {
  return (
    <div className="min-h-dvh bg-canvas md:flex">
      <div className="hidden md:block">
        <div className="h-dvh w-60 bg-[#0b172a]" />
      </div>
      <div className="flex-1 space-y-5 px-4 py-6 md:px-6">
        <div className="h-8 w-64 rounded bg-raised animate-pulse" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-md border border-line bg-surface" />
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
    <div className="relative isolate min-h-dvh w-full bg-canvas text-ink md:flex">
      <SideRail />
      <div className="min-w-0 flex-1 flex flex-col">
        <ConsoleHeader />
        <main key={pathname} className="page-fade mx-auto w-full max-w-[1440px] flex-1 px-4 pb-12 pt-5 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
