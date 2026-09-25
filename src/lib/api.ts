// Thin client for the MeghDrishti backend. Every function returns data
// already shaped like the mock-data.ts types so existing components need no
// changes beyond swapping their data source.
import type { Alert, SeriesPoint, Station, StationStatus } from "@/lib/mock-data";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  const body = await res.json();
  return body.data as T;
}

function healthToStatus(healthStatus: string | undefined, isActive: boolean): StationStatus {
  if (!isActive) return "offline";
  switch (healthStatus) {
    case "HEALTHY":
      return "normal";
    case "DEGRADED":
      return "warning";
    case "POOR":
    case "CRITICAL":
      return "critical";
    default:
      return "normal";
  }
}

export async function fetchStations(): Promise<Station[]> {
  const rows = await getJSON<
    { id: string; station_code: string; name: string; latitude: number; longitude: number; is_active: boolean }[]
  >("/stations?limit=100");

  return Promise.all(
    rows.map(async (s) => {
      const [health, obs] = await Promise.all([
        getJSON<{ status: string } | null>(`/stations/${s.id}/health`).catch(() => null),
        getJSON<{ measurements: { temperature_c: number | null } }[]>(
          `/stations/${s.id}/observations?limit=1`
        ).catch(() => []),
      ]);
      return {
        id: s.station_code,
        name: s.name,
        status: healthToStatus(health?.status, s.is_active),
        temp: obs[0]?.measurements.temperature_c ?? 0,
        lat: s.latitude,
        lon: s.longitude,
      };
    })
  );
}

const PRIORITY_TO_SEVERITY: Record<string, Alert["severity"]> = {
  CRITICAL: "critical",
  HIGH: "critical",
  MEDIUM: "warning",
  LOW: "info",
};

export async function fetchAlerts(): Promise<Alert[]> {
  const [rows, stations] = await Promise.all([
    getJSON<
      {
        id: string;
        station_id: string;
        anomaly_id: string | null;
        status: string;
        priority: string;
        policy: string;
        title: string;
        details: Record<string, unknown>;
        created_at: string;
      }[]
    >("/alerts?limit=50"),
    getJSON<{ id: string; station_code: string }[]>("/stations?limit=100"),
  ]);
  const codeById = new Map(stations.map((s) => [s.id, s.station_code]));

  return rows
    .filter((a) => a.status !== "DISMISSED" && a.status !== "RESOLVED")
    .map((a) => {
      const reasonCodes = Array.isArray(a.details.reason_codes) ? (a.details.reason_codes as string[]) : [];
      const confidence = typeof a.details.confidence === "number" ? a.details.confidence : null;
      return {
        id: a.id,
        anomalyId: a.anomaly_id,
        status: a.status,
        station: codeById.get(a.station_id) ?? a.station_id.slice(0, 8),
        code: reasonCodes[0] ?? a.policy,
        message: a.title,
        severity: PRIORITY_TO_SEVERITY[a.priority] ?? "info",
        time: new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        confidence: confidence !== null ? Math.round(confidence * 100) : 0,
      };
    });
}

export interface DashboardStat {
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "rose" | "cyan" | "amber";
}

export async function fetchDashboardStats(): Promise<DashboardStat[]> {
  const summary = await getJSON<{
    stations: { total: number; active: number };
    alerts: { open: number; critical: number };
    anomalies_24h: number;
    average_station_health: number | null;
  }>("/dashboard/summary");

  const healthy = summary.average_station_health ?? 100;

  return [
    {
      label: "System status",
      value: healthy >= 90 ? "Healthy" : healthy >= 70 ? "Degraded" : "Attention needed",
      sub: `Average station health ${healthy.toFixed(0)}%`,
      tone: healthy >= 90 ? "emerald" : healthy >= 70 ? "amber" : "rose",
    },
    {
      label: "Active alerts",
      value: String(summary.alerts.open),
      sub: `${summary.alerts.critical} critical`,
      tone: "rose",
    },
    {
      label: "Stations online",
      value: summary.stations.total
        ? `${Math.round((100 * summary.stations.active) / summary.stations.total)}%`
        : "—",
      sub: `${summary.stations.active} / ${summary.stations.total} online`,
      tone: "cyan",
    },
    {
      label: "Anomalies (24h)",
      value: String(summary.anomalies_24h),
      sub: "Rule + ML + context fusion",
      tone: "amber",
    },
  ];
}

// --- Live Monitor + Analysis ---

export interface StationOption {
  dbId: string;
  code: string;
  name: string;
}

export async function fetchStationOptions(): Promise<StationOption[]> {
  const rows = await getJSON<{ id: string; station_code: string; name: string }[]>("/stations?limit=100");
  return rows.map((s) => ({ dbId: s.id, code: s.station_code, name: s.name }));
}

export interface LiveReading {
  id: string;
  timestamp: string;
  source: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  rainfall_mm: number | null;
  wind_speed_ms: number | null;
}

export async function fetchStationObservations(stationDbId: string, limit = 20): Promise<LiveReading[]> {
  const rows = await getJSON<
    {
      id: string;
      timestamp: string;
      source: string;
      measurements: {
        temperature_c: number | null;
        humidity_pct: number | null;
        pressure_hpa: number | null;
        rainfall_mm: number | null;
        wind_speed_ms: number | null;
      };
    }[]
  >(`/stations/${stationDbId}/observations?limit=${limit}`);

  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    source: r.source,
    ...r.measurements,
  }));
}

function readingsToSeries(readings: LiveReading[], key: keyof LiveReading): SeriesPoint[] {
  return [...readings]
    .reverse()
    .map((r) => ({
      t: new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      value: typeof r[key] === "number" ? (r[key] as number) : 0,
    }));
}

export function seriesFromReadings(readings: LiveReading[]) {
  return {
    temperature: readingsToSeries(readings, "temperature_c"),
    humidity: readingsToSeries(readings, "humidity_pct"),
    pressure: readingsToSeries(readings, "pressure_hpa"),
  };
}

export interface StationAnomaly {
  id: string;
  classification: string;
  severity: string;
  fault_score: number;
  confidence: number;
  reason_codes: string[];
  created_at: string;
}

export async function fetchStationAnomalies(stationDbId: string, limit = 15): Promise<StationAnomaly[]> {
  return getJSON<StationAnomaly[]>(`/stations/${stationDbId}/anomalies?limit=${limit}`);
}

export interface AnomalyAnalytics {
  window_hours: number;
  classification_counts: Record<string, number>;
  rule_trigger_counts: Record<string, number>;
  hourly_series: { hour: string; count: number }[];
  average_fault_score: number | null;
  average_confidence: number | null;
}

export async function fetchAnomalyAnalytics(stationDbId?: string): Promise<AnomalyAnalytics> {
  const qs = stationDbId ? `?station_id=${stationDbId}` : "";
  return getJSON<AnomalyAnalytics>(`/analytics/anomalies${qs}`);
}

// --- Sensor health, maintenance, fleet series, insights ---
// All derived server-side from real qc_rule_results / station_health /
// weather_observations rows — see app/api/analytics.py.

export interface SensorHealth {
  measurement: string;
  label: string;
  reliability_pct: number | null;
  readings: number;
  rule_triggers: number;
}

export async function fetchSensorHealth(): Promise<SensorHealth[]> {
  const body = await getJSON<{ sensors: SensorHealth[] }>("/analytics/sensor-health");
  return body.sensors;
}

export interface MaintenancePrediction {
  station_id: string;
  station_code: string;
  name: string;
  pct: number;
  note: string;
}

export interface MaintenanceReport {
  predictions: MaintenancePrediction[];
  recommended_actions: string[];
}

export async function fetchMaintenance(): Promise<MaintenanceReport> {
  return getJSON<MaintenanceReport>("/analytics/maintenance");
}

export async function fetchFleetSeries(): Promise<{
  temperature_c: SeriesPoint[];
  humidity_pct: SeriesPoint[];
  pressure_hpa: SeriesPoint[];
}> {
  const body = await getJSON<Record<string, { t: string; value: number }[]>>("/analytics/fleet-series");
  const toSeries = (rows: { t: string; value: number }[]): SeriesPoint[] =>
    rows.map((r) => ({ t: new Date(r.t).toLocaleTimeString([], { hour: "2-digit" }), value: r.value }));
  return {
    temperature_c: toSeries(body.temperature_c ?? []),
    humidity_pct: toSeries(body.humidity_pct ?? []),
    pressure_hpa: toSeries(body.pressure_hpa ?? []),
  };
}

export async function fetchInsights(): Promise<string[]> {
  const body = await getJSON<{ insights: string[] }>("/analytics/insights");
  return body.insights;
}

// --- Authenticated writes ---

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function authedJSON<T>(path: string, method: "PATCH" | "POST", body?: unknown): Promise<T> {
  const { authHeaders } = await import("@/lib/auth");
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new ApiError(res.status, detail?.error?.message ?? `${path} -> ${res.status}`);
  }
  const json = await res.json();
  return json.data as T;
}

export const ALERT_STATUSES = ["ACKNOWLEDGED", "UNDER_REVIEW", "RESOLVED", "DISMISSED"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export async function updateAlertStatus(alertId: string, status: AlertStatus): Promise<void> {
  await authedJSON(`/alerts/${alertId}`, "PATCH", { status });
}

export const REVIEW_CLASSIFICATIONS = [
  "CONFIRMED_SENSOR_FAULT",
  "VALID_EXTREME_WEATHER",
  "FALSE_POSITIVE",
  "UNKNOWN",
  "REVIEW_LATER",
] as const;
export type ReviewClassification = (typeof REVIEW_CLASSIFICATIONS)[number];

// --- Admin / settings ---

export interface CalibrationProfile {
  id: string;
  name: string;
  is_active: boolean;
  rule_thresholds: Record<string, unknown>;
  fusion_weights: Record<string, number>;
  decision_thresholds: Record<string, number>;
  health_weights: Record<string, number>;
  health_boundaries: Record<string, string>;
  updated_at: string;
}

export async function fetchActiveCalibration(): Promise<CalibrationProfile | null> {
  return getJSON<CalibrationProfile | null>("/admin/calibration");
}

export interface DataSourceStatus {
  name: string;
  kind: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
}

export async function fetchDataSources(): Promise<DataSourceStatus[]> {
  return getJSON<DataSourceStatus[]>("/admin/data-sources");
}

export interface IngestionJob {
  id: string;
  source: string;
  station_id: string | null;
  status: string;
  attempt: number;
  error_message: string | null;
  stats: Record<string, unknown>;
  created_at: string;
}

export async function fetchIngestionJobs(): Promise<IngestionJob[]> {
  return getJSON<IngestionJob[]>("/admin/ingestion-jobs?limit=30");
}

export async function replayIngestionJob(jobId: string): Promise<void> {
  await authedJSON(`/admin/replay/${jobId}`, "POST");
}

export interface ModelVersion {
  id: string;
  model_id: string;
  model_version: string;
  measurement: string;
  region: string | null;
  season: string | null;
  contamination: number;
  threshold: number | null;
  metrics: Record<string, unknown>;
  status: string;
  created_at: string;
}

export async function fetchModels(): Promise<ModelVersion[]> {
  return getJSON<ModelVersion[]>("/models?limit=50");
}

export async function activateModel(modelId: string): Promise<void> {
  await authedJSON(`/models/${modelId}/activate`, "POST");
}

export async function submitReview(
  anomalyId: string,
  operatorClassification: ReviewClassification,
  comment?: string
): Promise<void> {
  await authedJSON(`/anomalies/${anomalyId}/review`, "POST", {
    operator_classification: operatorClassification,
    comment: comment ?? null,
  });
}
