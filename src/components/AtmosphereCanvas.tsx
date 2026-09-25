"use client";

import dynamic from "next/dynamic";

const AtmosphereScene = dynamic(() => import("./AtmosphereScene"), { ssr: false });

export default function AtmosphereCanvas() {
  return (
    <div className="absolute inset-0 -z-0 opacity-70 pointer-events-none">
      <AtmosphereScene />
    </div>
  );
}
