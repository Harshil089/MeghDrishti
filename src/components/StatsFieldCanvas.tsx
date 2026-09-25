"use client";

import dynamic from "next/dynamic";

const StatsFieldScene = dynamic(() => import("./StatsFieldScene"), { ssr: false });

export default function StatsFieldCanvas() {
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-6 h-24 opacity-60">
      <StatsFieldScene />
    </div>
  );
}
