import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react";
import { type Junction, type HotspotType, type Priority } from "@/lib/traffiq-data";

export type PageKey = "command" | "geo" | "planner" | "junction" | "simulator";

interface AppState {
  page: PageKey;
  setPage: (p: PageKey) => void;
  hour: number;
  setHour: (h: number) => void;
  officers: number;
  setOfficers: (o: number) => void;
  criticalJunctions: number;
  cityAvgPdi: number;
  cityAvgDailyAvg: number;
  cityAvgGrowthRate: number;
  cityAvgSpikeRatio: number;
  cityAvgConsistency: number;
  
  // Dynamic datasets
  junctions: Junction[];
  hourlyRiskData: any[];
  epsData: any[];
  
  // O(1) lookup maps built once during initialization
  junctionLookup: Record<string, Junction>;
  hourlyRiskLookup: Record<string, number[]>; // BTPxxx -> 24 risk numbers
  stationEpsLookup: Record<string, number>;    // police_station -> EPS number
}

const Ctx = createContext<AppState | null>(null);

// Robust state-machine CSV parser that correctly handles escaped quotes, 
// quoted values containing commas, and quoted values containing newlines.
function parseCSV(text: string) {
  const result: any[] = [];
  let row: string[] = [""];
  let inQuotes = false;
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped double quote
        row[row.length - 1] += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
    } else if (char === ',' && !inQuotes) {
      row.push("");
      i++;
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      // End of row
      if (char === '\r' && nextChar === '\n') {
        i += 2;
      } else {
        i++;
      }
      // Add row if not empty
      if (row.length > 1 || row[0] !== "") {
        result.push(row.map(cell => cell.trim()));
      }
      row = [""];
    } else {
      row[row.length - 1] += char;
      i++;
    }
  }
  
  if (row.length > 1 || row[0] !== "") {
    result.push(row.map(cell => cell.trim()));
  }
  
  if (result.length === 0) return [];
  const headers = result[0] as string[];
  return result.slice(1).map(rowValues => {
    const obj: any = {};
    headers.forEach((h: string, idx: number) => {
      obj[h] = rowValues[idx] ?? "";
    });
    return obj;
  });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageKey>("command");
  const [hour, setHour] = useState(18);
  const [officers, setOfficers] = useState(25);

  const [junctions, setJunctions] = useState<Junction[]>([]);
  const [hourlyRiskData, setHourlyRiskData] = useState<any[]>([]);
  const [epsData, setEpsData] = useState<any[]>([]);
  
  const [junctionLookup, setJunctionLookup] = useState<Record<string, Junction>>({});
  const [hourlyRiskLookup, setHourlyRiskLookup] = useState<Record<string, number[]>>({});
  const [stationEpsLookup, setStationEpsLookup] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      fetch("/data/junction_master.csv").then(r => r.text()),
      fetch("/data/junction_geo.csv").then(r => r.text()),
      fetch("/data/hourly_risk_final.csv").then(r => r.text()),
      fetch("/data/station_eps.csv").then(r => r.text())
    ]).then(([masterText, geoText, hourlyText, epsText]) => {
      const masterRows = parseCSV(masterText);
      const geoRows = parseCSV(geoText);
      const hourlyRows = parseCSV(hourlyText);
      const epsRows = parseCSV(epsText);

      // 1. Build Geo Coordinates Lookup Map: junction_id -> { lat, lng }
      const geoLookup: Record<string, { lat: number; lng: number }> = {};
      geoRows.forEach(row => {
        const jid = row.junction_id;
        if (jid) {
          geoLookup[jid] = {
            lat: parseFloat(row.lat) || 12.9716,
            lng: parseFloat(row.lng) || 77.5946
          };
        }
      });

      // 2. Build Station EPS Lookup Map: police_station -> EPS
      const stationLookup: Record<string, number> = {};
      epsRows.forEach(row => {
        const station = row.police_station;
        if (station) {
          stationLookup[station] = parseFloat(row.EPS) || 0;
        }
      });

      // 3. Build Hourly Risk Lookup Map: junction_id -> number[24]
      const riskLookup: Record<string, number[]> = {};
      hourlyRows.forEach(row => {
        const name = row.junction_name;
        const match = name.match(/^(BTP\d{3})/);
        if (match) {
          const jid = match[1];
          const hr = parseInt(row.hour_ist);
          const riskVal = parseFloat(row.city_risk) || 0;
          if (!riskLookup[jid]) {
            riskLookup[jid] = Array(24).fill(0.2); // default fallback
          }
          if (hr >= 0 && hr < 24) {
            riskLookup[jid][hr] = riskVal;
          }
        }
      });

      // 4. Assemble and Join Junctions metadata (all 168 junctions).
      // NOTE: `risk` here intentionally holds the FULL 24h array, not a single
      // hour-specific number — the active-hour value is derived later in a
      // useMemo (see `junctionsForHour` below) without re-fetching or re-parsing.
      const lookup: Record<string, Junction> = {};
      const parsedJunctions: Junction[] = masterRows.map(row => {
        const jid = row.junction_id;
        const geo = geoLookup[jid] || { lat: 12.9716, lng: 77.5946 };

        // Compute peak hour dynamically based on max risk hour from hourly CSV data
        const riskArray = riskLookup[jid] || Array(24).fill(0.2);
        let peakHour = 10; // default
        let maxRisk = -1;
        riskArray.forEach((risk, hr) => {
          if (risk > maxRisk) {
            maxRisk = risk;
            peakHour = hr;
          }
        });

        const j: Junction = {
          junction_id: jid,
          name: row.clean_name || row.junction_name,
          pdi: parseFloat(row.PDI) || 0,
          rank: parseInt(row.rank) || 999,
          violations: parseInt(row.total_violations) || 0,
          type: (row.hotspot_type || "STABLE") as HotspotType,
          priority: (row.priority_level || "MEDIUM") as Priority,
          risk: riskArray[0] !== undefined ? riskArray[0] : 0.2, // placeholder (hour 0); active risk is derived per-hour below
          officers: 0,
          lat: geo.lat,
          lng: geo.lng,
          peakHour: peakHour,
          dailyAvg: parseFloat(row.daily_avg) || 0,
          wowGrowth: parseFloat(row.growth_rate) * 100 || 0, // convert percentage (e.g. 0.559 -> 55.9%)
          spikeRatio: parseFloat(row.spike_ratio) || 0,
          consistency: parseFloat(row.consistency) || 0,
          freq_n: parseFloat(row.freq_n) || 0.35,
          peak_n: parseFloat(row.peak_n) || 0.30,
          heavy_n: parseFloat(row.heavy_n) || 0.20,
          recur_n: parseFloat(row.recur_n) || 0.15
        };

        lookup[jid] = j;
        return j;
      });

      // Sort by PDI descending (should match rank)
      parsedJunctions.sort((a, b) => b.pdi - a.pdi);
      parsedJunctions.forEach((j, idx) => {
        j.rank = idx + 1;
      });

      setJunctions(parsedJunctions);
      setJunctionLookup(lookup);
      setHourlyRiskLookup(riskLookup);
      setStationEpsLookup(stationLookup);
      setHourlyRiskData(hourlyRows);
      setEpsData(epsRows);
    }).catch(err => {
      console.error("Error loading CSV files:", err);
    });
  }, []); // Fetch & parse all CSVs exactly ONCE on mount. The hour slider must
          // NEVER trigger a re-fetch — see `junctionsForHour` useMemo below,
          // which derives hour-specific risk purely from data already in memory.

  // Derive hour-specific `risk` for every junction from data already fetched
  // above. This recomputes in-memory (array lookups only, no network/IO) any
  // time `hour` or the base `junctions`/`hourlyRiskLookup` change.
  const junctionsForHour = useMemo(() => {
    if (junctions.length === 0) return junctions;
    return junctions.map(j => {
      const arr = hourlyRiskLookup[j.junction_id];
      return { ...j, risk: arr && arr[hour] !== undefined ? arr[hour] : j.risk };
    });
  }, [junctions, hourlyRiskLookup, hour]);

  // Keep the by-id lookup map consistent with junctionsForHour so any
  // component reading junctionLookup[id].risk gets the same active-hour
  // value as the junctions array (no stale hour-0 placeholder).
  const junctionLookupForHour = useMemo(() => {
    const map: Record<string, Junction> = {};
    junctionsForHour.forEach(j => { map[j.junction_id] = j; });
    return map;
  }, [junctionsForHour]);

  // Set default fallbacks in case data is loading
  let criticalJunctions = 0;
  let cityAvgPdi = 16.2;
  let cityAvgDailyAvg = 8.54;
  let cityAvgGrowthRate = 55.9;
  let cityAvgSpikeRatio = 5.33;
  let cityAvgConsistency = 0.10;

  if (junctionsForHour.length > 0) {
    // FIX #1: count junctions by their real backend-computed priority_level
    // (CRITICAL/HIGH/MEDIUM/LOW from junction_behavior_final.csv via
    // generate_master_csv.py), not an ad-hoc `pdi > 70` cutoff. The raw PDI
    // distribution is heavily right-skewed (max 84.5, 2nd place 61.2), so a
    // fixed PDI threshold collapses to a single junction; priority_level is
    // already correctly percentile/threshold-calibrated on the backend.
    criticalJunctions = junctionsForHour.filter(row => row.priority === "CRITICAL").length;
    const totalPdi = junctionsForHour.reduce((sum, row) => sum + row.pdi, 0);
    cityAvgPdi = totalPdi / junctionsForHour.length;
    
    const totalDailyAvg = junctionsForHour.reduce((sum, row) => sum + row.dailyAvg, 0);
    cityAvgDailyAvg = totalDailyAvg / junctionsForHour.length;

    const totalGrowth = junctionsForHour.reduce((sum, row) => sum + row.wowGrowth, 0);
    cityAvgGrowthRate = totalGrowth / junctionsForHour.length;

    const totalSpike = junctionsForHour.reduce((sum, row) => sum + row.spikeRatio, 0);
    cityAvgSpikeRatio = totalSpike / junctionsForHour.length;

    const totalConsistency = junctionsForHour.reduce((sum, row) => sum + row.consistency, 0);
    cityAvgConsistency = totalConsistency / junctionsForHour.length;
  }

  return (
    <Ctx.Provider value={{
      page, setPage, hour, setHour, officers, setOfficers,
      criticalJunctions, cityAvgPdi, cityAvgDailyAvg, cityAvgGrowthRate, cityAvgSpikeRatio, cityAvgConsistency,
      junctions: junctionsForHour, hourlyRiskData, epsData,
      junctionLookup: junctionLookupForHour, hourlyRiskLookup, stationEpsLookup
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppProvider missing");
  return v;
}

export function computeAllocation(topN: { liveRisk: number }[], officers: number): number[] {
  if (topN.length === 0) return [];
  const totalRisk = topN.reduce((sum, j) => sum + j.liveRisk, 0);
  if (totalRisk === 0) {
    return topN.map(() => 0);
  }
  
  const alloc = topN.map(j => {
    const share = (j.liveRisk / totalRisk) * officers;
    return Math.max(1, Math.round(share));
  });
  
  const sumAlloc = alloc.reduce((sum, v) => sum + v, 0);
  const diff = officers - sumAlloc;
  
  if (alloc.length > 0) {
    alloc[0] += diff;
  }
  
  return alloc;
}
