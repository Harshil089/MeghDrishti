"use client";

import dynamic from "next/dynamic";
import type { Station } from "@/lib/mock-data";

const LeafletMapScene = dynamic(() => import("./LeafletMapScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-xs text-muted">
      Loading map…
    </div>
  ),
});

export default function StationMap(props: {
  stations: Station[];
  selectedId?: string;
  onSelect?: (s: Station) => void;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-b-2xl">
      <LeafletMapScene {...props} />
    </div>
  );
}
