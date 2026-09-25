"use client";

import dynamic from "next/dynamic";

const RadarSweepScene = dynamic(() => import("./RadarSweepScene"), { ssr: false });

export default function RadarSweepCanvas({ size = 40 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <RadarSweepScene />
    </div>
  );
}
