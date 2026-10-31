"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/console/Select";
import { districtOf, regionLabel, type StationOption } from "@/lib/api";

/** State, district and station dropdowns, each limited by the one before. With ~3,000
 * stations a single list is unusable; operators look for a city like Pune, not a state. */
export function StationPicker({
  stations,
  value,
  onChange,
  allowAll = false,
  className = "",
}: {
  stations: StationOption[];
  value: string;
  onChange: (dbId: string) => void;
  /** Offer "All stations" (value "") instead of always selecting one. */
  allowAll?: boolean;
  className?: string;
}) {
  const selected = stations.find((s) => s.dbId === value);
  const [chosenRegion, setChosenRegion] = useState<string | null>(null);
  const region = chosenRegion ?? selected?.region ?? "";

  const regions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stations) counts.set(s.region ?? "", (counts.get(s.region ?? "") ?? 0) + 1);
    return [...counts].sort(([a], [b]) => regionLabel(a).localeCompare(regionLabel(b)));
  }, [stations]);

  const [chosenDistrict, setChosenDistrict] = useState<string | null>(null);
  const district = chosenDistrict ?? (region && selected ? districtOf(selected.name) : "");

  const inRegion = useMemo(
    () => stations.filter((s) => !region || (s.region ?? "") === region).sort((a, b) => a.name.localeCompare(b.name)),
    [stations, region]
  );
  const districts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of inRegion) counts.set(districtOf(s.name), (counts.get(districtOf(s.name)) ?? 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [inRegion]);
  const inDistrict = district ? inRegion.filter((s) => districtOf(s.name) === district) : inRegion;

  function pickDistrict(next: string) {
    setChosenDistrict(next);
    const first = inRegion.find((s) => !next || districtOf(s.name) === next);
    if (first) onChange(first.dbId);
  }

  function pickRegion(next: string) {
    setChosenRegion(next);
    setChosenDistrict(null);
    // Picking a state jumps to its first station; "All states" goes back to the network-wide view.
    const first = stations.filter((s) => (s.region ?? "") === next).sort((a, b) => a.name.localeCompare(b.name))[0];
    onChange(next && first ? first.dbId : allowAll ? "" : stations[0]?.dbId ?? "");
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Select aria-label="State" value={region} onChange={(e) => pickRegion(e.target.value)} className="min-w-[160px]">
        <option value="">All states</option>
        {regions.map(([r, n]) => (
          <option key={r} value={r}>
            {regionLabel(r)} ({n})
          </option>
        ))}
      </Select>
      {region && (
        <Select aria-label="District" value={district} onChange={(e) => pickDistrict(e.target.value)} className="min-w-[150px]">
          <option value="">All districts</option>
          {districts.map(([d, n]) => (
            <option key={d} value={d}>
              {d} ({n})
            </option>
          ))}
        </Select>
      )}
      <Select aria-label="Station" value={value} onChange={(e) => onChange(e.target.value)} className="min-w-[200px]">
        {allowAll && <option value="">All stations</option>}
        {inDistrict.map((s) => (
          <option key={s.dbId} value={s.dbId}>
            {s.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
