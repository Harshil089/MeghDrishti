"use client";

import { PageHeader, Section, Badge, Meter, Empty, table, healthTone } from "@/components/console/ui";
import { fetchSensorHealth, type SensorHealth } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const statusLabel = { ok: "Healthy", warn: "Degraded", crit: "Unreliable", info: "", neutral: "No data" } as const;

export default function SensorHealthPage() {
  const sensors = useLiveData(fetchSensorHealth, [] as SensorHealth[]);

  return (
    <>
      <PageHeader
        title="Sensors"
        description="Fleet-wide reliability per measurement, from stuck, drift, spike and physical-range rule trigger rates over the last 7 days."
      />

      <Section title="Reliability by measurement" meta={sensors.length ? `${sensors.length} measurements` : undefined} flush>
        {sensors.length === 0 ? (
          <Empty>Waiting for sensor data</Empty>
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.head}>
                <tr>
                  <th className={table.th}>Measurement</th>
                  <th className={table.th}>Status</th>
                  <th className={`${table.th} w-[40%]`}>Reliability</th>
                  <th className={table.thNum}>Readings</th>
                  <th className={table.thNum}>Flagged</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map((s) => {
                  const tone = healthTone(s.reliability_pct);
                  return (
                    <tr key={s.measurement} className={table.row}>
                      <td className={`${table.td} font-medium text-ink`}>{s.label}</td>
                      <td className={table.td}>
                        <Badge tone={tone}>{statusLabel[tone]}</Badge>
                      </td>
                      <td className={table.td}>
                        <div className="flex items-center gap-3">
                          <Meter pct={s.reliability_pct ?? 0} tone={tone} />
                          <span className="w-12 shrink-0 text-right font-mono tabular-nums text-ink">
                            {s.reliability_pct ?? "-"}
                            <span className="text-sub">%</span>
                          </span>
                        </div>
                      </td>
                      <td className={table.num}>{s.readings}</td>
                      <td className={table.num}>{s.rule_triggers}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
