export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type HotspotType = "PERSISTENT" | "BURST" | "EMERGING" | "STABLE";

export interface Junction {
  junction_id: string;
  name: string;
  pdi: number;
  rank: number;
  violations: number;
  type: HotspotType;
  priority: Priority;
  risk: number;
  officers: number;
  lat: number;
  lng: number;
  peakHour: number;
  dailyAvg: number;
  wowGrowth: number;
  spikeRatio: number;
  consistency: number;

  // Breakdown scores (freq_n, peak_n, heavy_n, recur_n)
  freq_n?: number;
  peak_n?: number;
  heavy_n?: number;
  recur_n?: number;
}

// ── REAL DATA NOTE ──
// All per-junction data (PDI, rank, priority, hotspot type, 24h risk
// profile, coordinates) is loaded LIVE at runtime from
// /public/data/{junction_master,junction_geo,hourly_risk_final,station_eps}.csv
// via AppProvider in state.tsx (fetched once on mount; hour-specific risk is
// then derived in-memory per render, with no re-fetching — see
// `junctionsForHour` in state.tsx). This module intentionally contains no
// static junction/hourly-risk mock data so there is exactly one source of
// truth for those numbers.
//
// The constants below are small, genuinely static reference datasets (not
// yet wired to a live per-record CSV pipeline) plus shared types/color
// helpers used across all pages.

// Historical weekly violation pattern (city-wide, all 298,450 records).
export const WEEKLY_PATTERN = [
  { day: "Mon", value: 34680, weekend: false },
  { day: "Tue", value: 42697, weekend: false },
  { day: "Wed", value: 41977, weekend: false },
  { day: "Thu", value: 43547, weekend: false },
  { day: "Fri", value: 40864, weekend: false },
  { day: "Sat", value: 44523, weekend: true },
  { day: "Sun", value: 50162, weekend: true }
];

// Vehicle type mix (city-wide heuristic breakdown — see GeoMap, where this
// chart is explicitly labeled "Historical Heuristic" since it is not yet
// computed live per the active hour/junction filter).
export const VEHICLE_TYPES = [
  { name: "Scooter", value: 32.0, color: "#00d4ff" },
  { name: "Car/SUV", value: 30.0, color: "#f6ad55" },
  { name: "Motorcycle", value: 13.8, color: "#68d391" },
  { name: "Auto", value: 12.8, color: "#fc4f4f" },
  { name: "Maxi-Cab", value: 3.8, color: "#a78bfa" },
  { name: "LGV", value: 2.8, color: "#facc15" },
  { name: "Other", value: 4.7, color: "#4a5568" }
];

export const HOTSPOT_DESCRIPTIONS: Record<HotspotType, { color: string; description: string }> = {
  PERSISTENT: {
    color: "#fc4f4f",
    description: "Chronic violation zones with consistently high activity across all hours. Requires sustained, long-term deployment and infrastructure changes.",
  },
  BURST: {
    color: "#f6ad55",
    description: "Sudden surge zones — calm most hours but spike sharply during peak windows. Best addressed with timed rapid-response patrols.",
  },
  EMERGING: {
    color: "#00d4ff",
    description: "Newly active hotspots showing rising violation trends week-over-week. Early intervention can prevent escalation to PERSISTENT.",
  },
  STABLE: {
    color: "#68d391",
    description: "Low-variance zones with predictable, low-to-moderate violation rates. Routine patrol cadence is sufficient.",
  },
};

// FIX #1/#3: color/priority everywhere in the app must derive from this
// function (which reads the real backend priority_level field), never from
// an ad-hoc numeric PDI threshold like `pdi >= 70` — the raw PDI
// distribution across the 168 named junctions is heavily right-skewed
// (max 84.5, 2nd place 61.2), so a fixed cutoff collapses to ~1 junction.
export function priorityColor(p: Priority) {
  return p === "CRITICAL" ? "#fc4f4f" : p === "HIGH" ? "#f6ad55" : "#68d391";
}

export function riskColor(r: number) {
  if (r >= 0.75) return "#fc4f4f";
  if (r >= 0.55) return "#f6ad55";
  return "#68d391";
}
