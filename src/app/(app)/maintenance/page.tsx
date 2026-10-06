"use client";

import { PageHeader, Section, Meter, Empty, table, riskTone } from "@/components/console/ui";
import { fetchMaintenance, type MaintenanceReport } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";

const EMPTY: MaintenanceReport = { predictions: [], recommended_actions: [] };

export default function MaintenancePage() {
  const { predictions, recommended_actions } = useLiveData(fetchMaintenance, EMPTY);

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Stations ranked by maintenance need, from QC rule trigger rates over the last 7 days."
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <Section title="Predicted need" meta="Worst first" flush className="lg:col-span-8">
          {predictions.length === 0 ? (
            <Empty>No station health data yet</Empty>
          ) : (
            <div className={table.wrap}>
              <table className={table.table}>
                <thead className={table.head}>
                  <tr>
                    <th className={table.th}>Station</th>
                    <th className={`${table.th} w-[35%]`}>Need</th>
                    <th className={table.th}>Main contributor</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((m) => (
                    <tr key={m.station_id} className={table.row}>
                      <td className={table.td}>
                        <p className="font-medium text-ink">{m.name}</p>
                        <p className="font-mono text-[11px] text-sub">{m.station_code}</p>
                      </td>
                      <td className={table.td}>
                        <div className="flex items-center gap-3">
                          <Meter pct={m.pct} tone={riskTone(m.pct)} />
                          <span className="w-10 shrink-0 text-right font-mono tabular-nums text-ink">{m.pct}%</span>
                        </div>
                      </td>
                      <td className={`${table.td} text-sub`}>{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Action queue" meta="From live health data" className="lg:col-span-4">
          {recommended_actions.length === 0 ? (
            <p className="text-sm text-sub">No actions recommended. Fleet is healthy.</p>
          ) : (
            <ol className="space-y-3">
              {recommended_actions.map((a, i) => (
                <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-2 text-[13px] leading-relaxed text-ink">
                  <span className="font-mono text-xs text-sub pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  {a}
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </>
  );
}
