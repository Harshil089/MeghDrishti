"use client";

import dynamic from "next/dynamic";

const AlertPulseScene = dynamic(() => import("./AlertPulseScene"), { ssr: false });

export default function AlertPulseCanvas({ size = 22 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <AlertPulseScene />
    </div>
  );
}
