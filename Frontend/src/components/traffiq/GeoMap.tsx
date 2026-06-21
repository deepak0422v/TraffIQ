import { lazy, Suspense, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, SectionTitle } from "./ui";
import { VEHICLE_TYPES, HOTSPOT_DESCRIPTIONS, priorityColor, type HotspotType } from "@/lib/traffiq-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "./state";

const MapView = lazy(() => import("./MapView"));

const tooltipStyle = {
  backgroundColor: "#0f1117",
  border: "1px solid rgba(0,212,255,0.4)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
};

export function GeoMap() {
  const [mounted, setMounted] = useState(false);
  const [mapLayer, setMapLayer] = useState("PDI Hotspots");
  // FIX #7: renamed from `filterHour` to `peakWindowFilter` and the visible
  // label from "Filter Hour" to "Peak Window" — this control filters
  // junctions by each junction's own historical peak-risk hour (peakHour),
  // it is intentionally NOT linked to the global sidebar hour slider.
  // Logic/behavior unchanged; this is a naming/label fix only.
  const [peakWindowFilter, setPeakWindowFilter] = useState("All");
  const [hotspotType, setHotspotType] = useState("All");

  const { epsData, junctions } = useApp();

  useEffect(() => setMounted(true), []);

  // Filter junctions list dynamically based on selection
  const typeFiltered = hotspotType === "All"
    ? junctions
    : junctions.filter(j => j.type === hotspotType);

  const hourFiltered = typeFiltered.filter(j => {
    if (peakWindowFilter === "All") return true;
    if (peakWindowFilter === "AM Peak (7-10)") return j.peakHour >= 7 && j.peakHour <= 10;
    if (peakWindowFilter === "PM Peak (17-21)") return j.peakHour >= 17 && j.peakHour <= 21;
    if (peakWindowFilter === "Off-peak") return !(j.peakHour >= 7 && j.peakHour <= 10) && !(j.peakHour >= 17 && j.peakHour <= 21);
    return true;
  });

  const top10 = hourFiltered.slice(0, 10);

  // Dynamic station burden loaded from epsData
  const chartEpsData = [...epsData]
    .sort((a, b) => (parseFloat(b.EPS) || 0) - (parseFloat(a.EPS) || 0))
    .slice(0, 8)
    .map(row => ({
      station: row.police_station,
      eps: parseFloat(row.EPS) || 0
    }));

  return (
    <div className="page-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Geo Intelligence Map</h1>
        <p className="text-sm text-muted-foreground">Spatial overview of Bengaluru enforcement hotspots.</p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Filter label="Map Layer" options={["PDI Hotspots", "Violation Heatmap", "GPS Points"]} value={mapLayer} onChange={setMapLayer} />
          <Filter label="Peak Window (Historical)" options={["All", "AM Peak (7-10)", "PM Peak (17-21)", "Off-peak"]} value={peakWindowFilter} onChange={setPeakWindowFilter} />
          <Filter label="Hotspot Type" options={["All", "PERSISTENT", "BURST", "EMERGING", "STABLE"]} value={hotspotType} onChange={setHotspotType} />
        </div>
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: "rgba(0,212,255,0.2)", height: 480 }}>
          {mounted ? (
            <Suspense fallback={<div className="h-full grid place-items-center text-muted-foreground">Loading map…</div>}>
              <MapView layer={mapLayer} filteredJunctions={hourFiltered} />
            </Suspense>
          ) : (
            <div className="h-full grid place-items-center text-muted-foreground">Initializing…</div>
          )}
        </div>

        <div className="flex flex-wrap gap-4 mt-4 text-xs">
          {(Object.keys(HOTSPOT_DESCRIPTIONS) as HotspotType[]).map((t) => (
            <div key={t} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: HOTSPOT_DESCRIPTIONS[t].color }} />
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground/90">{t}</span> — {HOTSPOT_DESCRIPTIONS[t].description.split(".")[0]}.
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        <Card className="p-5">
          <SectionTitle>Top 10 Critical Junctions</SectionTitle>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top10} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="#a0aec0" fontSize={10} />
              <YAxis dataKey="name" type="category" stroke="#a0aec0" fontSize={10} width={110} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pdi" radius={[0, 5, 5, 0]}>
                {/* FIX #3: color by real priority_level via priorityColor,
                    not a recomputed pdi>=70 cutoff (see CommandCenter for
                    the same fix and rationale). */}
                {top10.map((d) => (
                  <Cell key={d.name} fill={priorityColor(d.priority)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionTitle>Station Burden (EPS)</SectionTitle>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartEpsData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="#a0aec0" fontSize={10} />
              <YAxis dataKey="station" type="category" stroke="#a0aec0" fontSize={10} width={120} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="eps" radius={[0, 5, 5, 0]}>
                {chartEpsData.map((d) => (
                  <Cell key={d.station} fill={d.eps >= 80 ? "#fc4f4f" : d.eps >= 60 ? "#f6ad55" : "#68d391"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionTitle>Vehicle Type Mix (Historical Heuristic)</SectionTitle>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={VEHICLE_TYPES} innerRadius={55} outerRadius={95} dataKey="value" paddingAngle={3}>
                {VEHICLE_TYPES.map((s) => (
                  <Cell key={s.name} fill={s.color} stroke="#0f1117" />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span style={{ color: "#a0aec0" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function Filter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-[#141925] border-[rgba(0,212,255,0.25)] text-foreground">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1f2e] border-[rgba(0,212,255,0.25)] text-foreground z-[1100]">
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
