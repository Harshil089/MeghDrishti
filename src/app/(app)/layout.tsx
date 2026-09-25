"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PageTransition from "@/components/PageTransition";
import { useAuth } from "@/lib/useAuth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <PageTransition>{children}</PageTransition>
    </div>
  );
}
