import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp, computeAllocation } from "./state";
import {
  WEEKLY_PATTERN,
  priorityColor,
} from "@/lib/traffiq-data";
import { AnimatedNumber } from "./AnimatedNumber";
import { Card, Pill, SectionTitle } from "./ui";

const tooltipStyle = {
  backgroundColor: "#0f1117",
  border: "1px solid rgba(0,212,255,0.4)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
};

export function CommandCenter() {
  const { 
    hour, 
    officers, 
    criticalJunctions, 
    cityAvgPdi, 
    junctions, 
    hourlyRiskLookup,
    hourlyRiskData
  } = useApp();

  // 1. Re-rank junctions by their dynamic risk score for the active hour (O(1) lookups)
  const rawLiveRanked = [...junctions]
    .map((j) => {
      const hourlyArr = hourlyRiskLookup[j.junction_id];
      const liveRisk = hourlyArr ? hourlyArr[hour] : j.risk;
      return { ...j, liveRisk };
    })
    .sort((a, b) => b.liveRisk - a.liveRisk);

  // 2. Proportional dynamic officer allocation (aligned with backend)
  const top10Junctions = rawLiveRanked.slice(0, 10);
  const roundedAlloc = computeAllocation(top10Junctions, officers);

  const liveRanked = rawLiveRanked.map((j, idx) => {
    const allocatedOfficers = idx < 10 ? roundedAlloc[idx] : 0;
    return { ...j, officers: allocatedOfficers };
  });

  // 3. Dynamic metrics & subsets
  const top5 = liveRanked.filter(j => j.officers > 0).slice(0, 5);
  const top10 = junctions.slice(0, 10).map((j) => ({ name: j.name, pdi: j.pdi, priority: j.priority }));
  const alerts = liveRanked.slice(0, 8);

  const topNow = liveRanked[0] || {
    name: "None", liveRisk: 0, priority: "MEDIUM" as const, dailyAvg: 0,
    consistency: 0, officers: 0, pdi: 0, type: "STABLE" as const, wowGrowth: 0,
  };
  const highRiskNowCount = liveRanked.filter((j) => j.liveRisk >= 0.55 && j.officers >= 1).length;
  const totalViolationsCount = junctions.reduce((sum, j) => sum + j.violations, 0);

  // 4. Compute city-wide hourly violation counts dynamically from hourly CSV data
  const dynamicHourlyViolations = Array.from({ length: 24 }, (_, h) => {
    const hourRows = hourlyRiskData.filter(row => parseInt(row.hour_ist) === h);
    const sumViolations = hourRows.reduce((sum, row) => sum + (parseFloat(row.violations) || 0), 0);
    return {
      hour: h,
      violations: Math.round(sumViolations)
    };
  });

  // 5. Compute hotspot behavior percentages dynamically from master CSV types
  const hotspotTypeCounts = junctions.reduce((acc, j) => {
    acc[j.type] = (acc[j.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const dynamicHotspotBehaviors = [
    { name: "PERSISTENT", value: hotspotTypeCounts["PERSISTENT"] || 0, color: "#fc4f4f" },
    { name: "BURST", value: hotspotTypeCounts["BURST"] || 0, color: "#f6ad55" },
    { name: "EMERGING", value: hotspotTypeCounts["EMERGING"] || 0, color: "#00d4ff" },
    { name: "STABLE", value: hotspotTypeCounts["STABLE"] || 0, color: "#68d391" }
  ];

  return (
    <div className="page-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Real-time enforcement intelligence — Hour {String(hour).padStart(2, "0")}:00 IST
        </p>
      </div>

      {/* KPI ROW */}
      <div className="grid grid-cols-5 gap-4">
        <Kpi label="Total Violations" value={<AnimatedNumber value={totalViolationsCount} suffix="" />} sub="CSV Master Total" />
        <Kpi label="Avg City PDI" value={<AnimatedNumber value={cityAvgPdi} decimals={1} />} sub="dynamic average" />
        <Kpi label="Critical Junctions" value={<AnimatedNumber value={criticalJunctions} />} sub={`of ${junctions.length} monitored`} color="#fc4f4f" />
        <Kpi label="Highest Risk Now" value={<span className="text-sm truncate block mt-1.5" title={topNow.name}>{topNow.name}</span>} sub={`${topNow.liveRisk.toFixed(3)} risk`} color="#fc4f4f" />
        <Kpi label="High-Risk Zones Covered" value={<AnimatedNumber value={highRiskNowCount} />} sub={`of ${junctions.length}`} color="#68d391" />
      </div>

      <Card className="p-5" hover={false} style={{ background: "linear-gradient(135deg, #16213e 0%, #0f1a33 100%)", borderColor: "rgba(0,212,255,0.3)" }}>
        <SectionTitle right={<span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(0,212,255,0.15)", color: "#00d4ff" }}>AI-Assisted Risk Forecast</span>}>
          AI-Assisted Risk Forecast
        </SectionTitle>
        <div className="grid grid-cols-3 gap-6 items-center">
          <div className="col-span-2">
            <div className="text-[11px] tracking-widest text-muted-foreground uppercase mb-1">Predicted highest-risk junction · {String((hour + 1) % 24).padStart(2, "0")}:00 IST</div>
            <div className="text-2xl font-bold truncate" title={topNow.name}>{topNow.name}</div>
            <div className="flex items-center gap-4 mt-3">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Risk Level</div>
                <Pill priority={topNow.priority ?? "MEDIUM"} />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Predicted Violations</div>
                <div className="text-lg font-bold" style={{ color: "#f6ad55" }}>{Math.round((topNow.dailyAvg ?? 0) * (topNow.liveRisk ?? 0)) || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Confidence</div>
                <div className="text-lg font-bold" style={{ color: "#68d391" }}>{Math.round((topNow.consistency ?? 0.3) * 60 + 55)}%</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">Recommended Officers</div>
                <div className="text-lg font-bold" style={{ color: "#00d4ff" }}>{topNow.officers ?? 0}</div>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground leading-relaxed border-l pl-4" style={{ borderColor: "rgba(0,212,255,0.2)" }}>
            <div className="text-[10px] tracking-widest uppercase mb-1.5" style={{ color: "#00d4ff" }}>Why this junction</div>
            ✓ Risk score {(topNow.liveRisk ?? 0).toFixed(3)} — highest of {junctions.length} monitored zones this hour<br />
            ✓ PDI {(topNow.pdi ?? 0).toFixed(1)} ({topNow.type ?? "—"} hotspot pattern)<br />
            {(topNow.wowGrowth ?? 0) > 10 && <>✓ Violations trending up {(topNow.wowGrowth ?? 0).toFixed(0)}% week-over-week<br /></>}
            ✓ Confidence derived from historical consistency ({(topNow.consistency ?? 0).toFixed(2)})
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground mt-3 italic">
          Prediction confidence is a heuristic derived from each junction's historical consistency score — not a separately trained probability model.
        </div>
      </Card>

      {/* DEPLOYMENT PLAN HERO */}

      <Card className="p-5">
        <SectionTitle
          right={<span className="text-xs text-muted-foreground">Updated 2 min ago</span>}
        >
          Live Deployment Plan
        </SectionTitle>
        <div className="grid grid-cols-5 gap-4">
          {top5.map((j, i) => (
            <div
              key={j.junction_id}
              className="glow-card glow-card-hover p-4 relative"
              style={{
                background: "linear-gradient(135deg, #1a1f2e 0%, #161b28 100%)",
              }}
            >
              <div className="text-[10px] tracking-widest text-muted-foreground">#{i + 1} PRIORITY</div>
              <div className="text-base font-bold mt-1 truncate" title={j.name}>{j.name}</div>
              <div className="text-5xl font-bold my-3" style={{ color: "#00d4ff" }}>
                <AnimatedNumber value={j.officers} />
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">officers</div>
              <div className="mt-3 flex items-center justify-between">
                <Pill priority={j.priority} />
                <span className="text-xs text-muted-foreground">Risk: {j.liveRisk.toFixed(3)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 space-y-6">
          <Card className="p-5">
            <SectionTitle>City-Wide Hourly Violation Pattern</SectionTitle>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dynamicHourlyViolations}>
                <defs>
                  <linearGradient id="cyanFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#00d4ff" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" />
                <XAxis dataKey="hour" stroke="#a0aec0" fontSize={11} />
                <YAxis stroke="#a0aec0" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <ReferenceArea x1={7} x2={10} fill="#fc4f4f" fillOpacity={0.08} />
                <ReferenceArea x1={17} x2={21} fill="#fc4f4f" fillOpacity={0.12} />
                <Area
                  type="monotone"
                  dataKey="violations"
                  stroke="#00d4ff"
                  strokeWidth={2}
                  fill="url(#cyanFill)"
                />
                <ReferenceLine x={hour} stroke="#fc4f4f" strokeDasharray="4 4" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <SectionTitle>Top 10 High-Priority Junctions (PDI)</SectionTitle>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={top10} layout="vertical" margin={{ left: 30, right: 40 }}>
                <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="#a0aec0" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#a0aec0" fontSize={11} width={130} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="pdi" radius={[0, 6, 6, 0]} label={{ position: "right", fill: "#fff", fontSize: 11 }}>
                  {/* FIX #3: color by the real backend priority_level (via
                      priorityColor), not a recomputed pdi>=70 cutoff — the raw
                      PDI distribution is right-skewed so a fixed numeric
                      threshold left 9 of 10 bars green regardless of rank. */}
                  {top10.map((d) => (
                    <Cell key={d.name} fill={priorityColor(d.priority)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="col-span-2 space-y-6">
          <Card className="p-5">
            <SectionTitle>Active Alerts</SectionTitle>
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {alerts.map((a) => (
                <div
                  key={a.junction_id}
                  className="flex items-center justify-between p-3 rounded-md"
                  style={{
                    background: "#141925",
                    borderLeft: `3px solid ${priorityColor(a.priority)}`,
                  }}
                >
                  <div>
                    <div className="text-sm font-semibold truncate max-w-[200px]" title={a.name}>{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Risk {a.liveRisk.toFixed(3)} · {a.officers} officers
                    </div>
                  </div>
                  <Pill priority={a.priority} />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle>Hotspot Behavior Types</SectionTitle>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={dynamicHotspotBehaviors}
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {dynamicHotspotBehaviors.map((s) => (
                    <Cell key={s.name} fill={s.color} stroke="#0f1117" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#a0aec0" }}
                  iconType="circle"
                  formatter={(v) => <span style={{ color: "#a0aec0" }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <SectionTitle>Weekly Pattern (Historical Baseline)</SectionTitle>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={WEEKLY_PATTERN}>
                <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#a0aec0" fontSize={11} />
                <YAxis stroke="#a0aec0" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {WEEKLY_PATTERN.map((d) => (
                    <Cell key={d.day} fill={d.weekend ? "#fc4f4f" : "#00d4ff"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className="text-3xl font-bold mt-2" style={{ color: color ?? "#00d4ff" }}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
