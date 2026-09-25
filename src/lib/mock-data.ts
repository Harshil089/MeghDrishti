// Shared types, style/legend config, and static reference copy.
// No fabricated readings, stations, or stats live here — those all come
// from src/lib/api.ts. What remains below is either a type, a color/label
// lookup (UI config, not measured data), or an operator runbook keyed to
// the backend's real reason codes.

export type StationStatus = "normal" | "warning" | "critical" | "offline";

export interface Station {
  id: string;
  name: string;
  status: StationStatus;
  temp: number;
  lat: number;
  lon: number;
}

export const statusMeta: Record<StationStatus, { label: string; color: string; dot: string }> = {
  normal: { label: "Normal", color: "text-emerald-400", dot: "bg-emerald-400" },
  warning: { label: "Warning", color: "text-amber-400", dot: "bg-amber-400" },
  critical: { label: "Critical", color: "text-rose-500", dot: "bg-rose-500" },
  offline: { label: "Offline", color: "text-slate-500", dot: "bg-slate-500" },
};

export interface SeriesPoint {
  t: string;
  value: number;
  band?: number;
}

export interface Alert {
  id: string;
  station: string;
  code: string;
  message: string;
  severity: "critical" | "warning" | "info";
  time: string;
  confidence: number;
}

// Operator runbook, keyed to the backend's stable reason codes
// (app/scoring/reasons.py). Shown in the alert detail panel.
export const alertSafetySteps: Record<string, string[]> = {
  TEMP_SPIKE: [
    "Cross-check the reading against nearby stations, forecast, and ERA5 before treating it as a real heatwave.",
    "Flag for field inspection — a probe fault is more likely than a genuine local extreme.",
    "Hold the value out of downstream forecast feeds until confirmed.",
  ],
  RATE_OF_CHANGE_EXCEEDED: [
    "Compare the delta against the sensor's physical response time — most probes can't move this fast.",
    "Check for a wiring or power-supply fault at the station.",
  ],
  TEMP_STUCK: [
    "Compare against rain gauge and nearby humidity trend to rule out a real plateau.",
    "Flag sensor for maintenance if unchanged past 4 hours.",
    "Suppress duplicate alerts until the value changes or is serviced.",
  ],
  TEMP_DRIFT: [
    "Schedule remote recalibration for the temperature sensor.",
    "Lower confidence on this station's readings until recalibrated.",
  ],
  PRESSURE_DRIFT: [
    "Schedule remote recalibration for the pressure sensor.",
    "Lower confidence on this station's readings until recalibrated.",
    "Check for a known calibration-cycle correlation before dispatching a technician.",
  ],
  DROPOUT: [
    "Attempt a remote reset of the telemetry uplink.",
    "Escalate to the field team if no packets resume within 1 hour.",
    "Backfill the gap from cached replay once connectivity returns — do not interpolate silently.",
  ],
  TELEMETRY_GAP: [
    "Attempt a remote reset of the telemetry uplink.",
    "Escalate to the field team if no packets resume within 1 hour.",
  ],
  RAINFALL_EXTREME: [
    "Cross-check against GPM and nearby stations before dispatching a technician.",
    "If confirmed, route to the genuine-extreme-weather feed rather than a fault queue.",
  ],
  MODEL_HIGH_ANOMALY_SCORE: [
    "Review alongside the rule-check and context evidence — a model score alone is never ground truth.",
  ],
  NEIGHBOR_MISMATCH: ["Nearby stations disagree with this reading — weight toward a local sensor fault."],
  NEIGHBOR_CONFIRMED: ["Nearby stations confirm this reading — weight toward a genuine event."],
  FORECAST_MISMATCH: ["Forecast disagrees with this reading — weight toward a local sensor fault."],
  FORECAST_CONFIRMED: ["Forecast confirms this reading — weight toward a genuine event."],
  ERA5_MISMATCH: ["ERA5 reanalysis disagrees with this reading — weight toward a local sensor fault."],
  ERA5_CONFIRMED: ["ERA5 reanalysis confirms this reading — weight toward a genuine event."],
  GPM_MISMATCH: ["Satellite rainfall estimate disagrees with this reading — weight toward a local sensor fault."],
  GPM_CONFIRMED: ["Satellite rainfall estimate confirms this reading — weight toward a genuine event."],
  INSUFFICIENT_CONTEXT: [
    "No external context was available for this reading — treat as unresolved, not confirmed or dismissed.",
    "Recheck once forecast/reanalysis/neighbor data is available.",
  ],
};

export const defaultSafetySteps = [
  "Review the flagged reading against nearby stations and reanalysis context.",
  "Hold the value out of downstream feeds until an operator confirms it.",
];

// Static explainer copy for how the pipeline works — architecture
// documentation, not live data.
export const pipelineStages = [
  { key: "ingest", label: "API Connect", detail: "IMD / AWS / ARG · Open-Meteo · NOAA ISD · ERA5 + GPM" },
  { key: "schema", label: "Schema Check", detail: "Structural + unit validation on arrival" },
  { key: "normalize", label: "Normalize", detail: "Unified feature pipeline across sources" },
  { key: "score", label: "Anomaly Score", detail: "Rule checks + Isolation Forest" },
  { key: "context", label: "Context Verify", detail: "Nearby stations, forecasts, ERA5, GPM rainfall" },
  { key: "review", label: "Operator Review", detail: "Severity, confidence, reason codes, calibration" },
] as const;
