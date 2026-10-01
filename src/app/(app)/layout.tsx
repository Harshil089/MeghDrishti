"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PageTransition from "@/components/PageTransition";
import Skeleton from "@/components/Skeleton";
import { useAuth } from "@/lib/useAuth";

// Silhouette of the console shell (sidebar rail + topbar + card grid) shown
// while the auth check resolves, instead of a bare spinner — same shape as
// every real page so nothing jumps once content swaps in.
function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden md:flex w-64 shrink-0 flex-col gap-2 border-r border-border bg-panel/60 p-4">
        <Skeleton className="h-8 w-32 mb-4" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </aside>
      <div className="flex-1 flex flex-col">
        <div className="h-16 shrink-0 border-b border-border flex items-center px-6">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex-1 p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 content-start">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return <AppShellSkeleton />;
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <PageTransition>{children}</PageTransition>
    </div>
  );
}
