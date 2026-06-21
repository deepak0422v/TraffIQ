import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, SectionTitle } from "./ui";
import { HOTSPOT_DESCRIPTIONS, priorityColor, riskColor } from "@/lib/traffiq-data";
import { useApp, computeAllocation } from "./state";
import { AnimatedNumber } from "./AnimatedNumber";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const tooltipStyle = {
  backgroundColor: "#0f1117",
  border: "1px solid rgba(0,212,255,0.4)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
};

export function JunctionIntel() {
  const { 
    hour, 
    officers, 
    cityAvgPdi, 
    cityAvgDailyAvg, 
    cityAvgSpikeRatio, 
    junctions, 
    hourlyRiskLookup, 
    junctionLookup 
  } = useApp();
  
  const [selectedId, setSelectedId] = useState(junctions[0]?.junction_id || "BTP001");
  const j = junctionLookup[selectedId] || junctions[0];

  if (!j) {
    return <div className="p-8 text-center text-muted-foreground">Loading junction intelligence data...</div>;
  }

  // 1. Calculate active hourly priority list for officer allocations using O(1) risks
  const rawLiveRanked = [...junctions]
    .map((x) => {
      const hourlyArr = hourlyRiskLookup[x.junction_id];
      const liveRisk = hourlyArr ? hourlyArr[hour] : x.risk;
      return { ...x, liveRisk };
    })
    .sort((a, b) => b.liveRisk - a.liveRisk);

  const top10Junctions = rawLiveRanked.slice(0, 10);
  const roundedAlloc = computeAllocation(top10Junctions, officers);

  const liveRanked = rawLiveRanked.map((x, idx) => {
    const allocatedOfficers = idx < 10 ? roundedAlloc[idx] : 0;
    return { ...x, officers: allocatedOfficers };
  });

  const jLive = liveRanked.find((x) => x.junction_id === selectedId) || { ...j, officers: 0, liveRisk: j.risk };

  // 2. Fetch 24h risk profile
  const hourly = (hourlyRiskLookup[j.junction_id] || Array.from({ length: 24 }, () => j.risk)).map(
    (risk: number, h: number) => ({ hour: h, risk })
  );

  // 3. Comparison metrics
  const comparison = [
    { metric: "PDI Score", junction: j.pdi, city: cityAvgPdi },
    { metric: "Daily Avg", junction: j.dailyAvg, city: cityAvgDailyAvg },
    { metric: "Peak Ratio", junction: j.spikeRatio * 10, city: cityAvgSpikeRatio * 10 },
  ];

  const desc = HOTSPOT_DESCRIPTIONS[j.type];

  // 4. Behavior assessments
  const behaviorRows = [
    { metric: "Daily Avg Violations", value: j.dailyAvg.toFixed(1), assess: j.dailyAvg > 30 ? "🔴 Very High" : j.dailyAvg > 15 ? "🟠 High" : "🟢 Moderate" },
    { metric: "Week-over-Week Growth", value: `${j.wowGrowth > 0 ? "+" : ""}${j.wowGrowth.toFixed(1)}%`, assess: j.wowGrowth > 20 ? "🔴 Rising fast" : j.wowGrowth > 10 ? "🟠 Climbing" : "🟢 Stable" },
    { metric: "Spike Ratio", value: `${j.spikeRatio.toFixed(2)}×`, assess: j.spikeRatio > 4 ? "🔴 Volatile" : j.spikeRatio > 2 ? "🟠 Sharp peaks" : "🟢 Smooth" },
    { metric: "Consistency Score", value: j.consistency.toFixed(2), assess: j.consistency > 0.35 ? "🔴 Chronic" : j.consistency > 0.15 ? "🟠 Recurring" : "🟢 Sporadic" },
    { metric: "Priority Level", value: j.priority, assess: j.priority === "CRITICAL" ? "🔴 Immediate" : j.priority === "HIGH" ? "🟠 Soon" : "🟢 Routine" },
  ];

  // 5. PDI dynamic breakdown
  const freq_n = j.freq_n ?? 0.35;
  const peak_n = j.peak_n ?? 0.30;
  const heavy_n = j.heavy_n ?? 0.20;
  const recur_n = j.recur_n ?? 0.15;

  const dynamicPdiBreakdown = [
    { component: "Violation Frequency (45%)", value: +(freq_n * 45).toFixed(1) },
    { component: "Peak Hour Concentration (25%)", value: +(peak_n * 25).toFixed(1) },
    { component: "Heavy Vehicle Impact (10%)", value: +(heavy_n * 10).toFixed(1) },
    { component: "Recurrence Score (20%)", value: +(recur_n * 20).toFixed(1) },
  ];

  // NOTE: risk-level badges on this page use the real j.priority
  // (priority_level from the backend) directly — see the "Risk Level" KPI
  // below and the area-chart fill color.

  return (
    <div className="page-in space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Junction Intelligence</h1>
          <p className="text-sm text-muted-foreground">Deep dive into individual junction behavior.</p>
        </div>
        <div className="w-80">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="bg-[#141925] border-[rgba(0,212,255,0.25)] text-foreground">
              <SelectValue placeholder="Select a junction" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1f2e] border-[rgba(0,212,255,0.25)] text-foreground max-h-72">
              {junctions.map((x) => (
                <SelectItem key={x.junction_id} value={x.junction_id}>{x.junction_id} - {x.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-4">
        <Kpi label="PDI Score" value={<AnimatedNumber value={j.pdi} decimals={1} />} />
        <Kpi label="City PDI Rank" value={<AnimatedNumber value={j.rank} prefix="#" />} />
        <Kpi label="Total Violations" value={<AnimatedNumber value={j.violations} />} />
        <Kpi label="Peak Hour" value={<span>{String(j.peakHour).padStart(2, "0")}:00</span>} />
        <Kpi label="Risk Level" value={j.priority} color={priorityColor(j.priority)} />
        <Kpi label="Hotspot Type" value={j.type} color={desc.color} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle>Hourly Risk Profile</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={hourly}>
                <defs>
                  <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={priorityColor(j.priority)} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={priorityColor(j.priority)} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" />
                <XAxis dataKey="hour" stroke="#a0aec0" fontSize={11} />
                <YAxis stroke="#a0aec0" fontSize={11} domain={[0, 1]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area dataKey="risk" stroke={priorityColor(j.priority)} fill="url(#riskFill)" strokeWidth={2} />
                <ReferenceLine x={hour} stroke="#00d4ff" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5" hover={false}>
            <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: "#00d4ff" }}>
              Deployment Recommendation
            </div>
            <div className="text-base font-semibold">
              Deploy <span style={{ color: "#00d4ff" }}>{jLive.officers}</span> officers to {j.name}
            </div>
            <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <span>Current Risk: <b className="text-foreground/90">{jLive.liveRisk.toFixed(3)}</b></span>
              <span>PDI: <b className="text-foreground/90">{j.pdi.toFixed(1)}</b></span>
              <span>Rank: <b className="text-foreground/90">#{j.rank}</b></span>
              <span>Type: <b style={{ color: desc.color }}>{j.type}</b></span>
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle>PDI Component Breakdown</SectionTitle>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dynamicPdiBreakdown} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="#a0aec0" fontSize={11} />
                <YAxis dataKey="component" type="category" stroke="#a0aec0" fontSize={10} width={170} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                  {dynamicPdiBreakdown.map((_, i) => (
                    <Cell key={i} fill={["#00d4ff", "#f6ad55", "#fc4f4f", "#68d391"][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "rgba(0,212,255,0.12)" }}>
              <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: "#00d4ff" }}>
                Parking Disruption Index (PDI)
              </div>
              <div className="text-xs font-mono leading-relaxed" style={{ color: "#a0aec0" }}>
                PDI = 0.45 × Violation&nbsp;Frequency<br />
                &nbsp;&nbsp;&nbsp;+ 0.25 × Peak&nbsp;Hour&nbsp;Concentration<br />
                &nbsp;&nbsp;&nbsp;+ 0.10 × Heavy&nbsp;Vehicle&nbsp;Impact<br />
                &nbsp;&nbsp;&nbsp;+ 0.20 × Recurrence&nbsp;Score
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Each component is min-max normalized across all {junctions.length} monitored junctions before weighting, so PDI is directly comparable citywide.
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5" hover={false} >
            <div className="border-l-4 pl-4" style={{ borderColor: desc.color }}>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: desc.color }}>
                Hotspot Type: {j.type}
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{desc.description}</p>
            </div>
          </Card>

          <Card className="p-5" hover={false} style={{ background: "linear-gradient(135deg, #16213e 0%, #0f1a33 100%)", borderColor: "rgba(0,212,255,0.3)" }}>
            <SectionTitle right={<span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(0,212,255,0.15)", color: "#00d4ff" }}>EXPLAINABLE AI</span>}>
              Why was this hotspot selected?
            </SectionTitle>
            <div className="space-y-2 text-sm">
              {j.dailyAvg > 15 && (
                <div className="flex items-start gap-2">
                  <span style={{ color: "#68d391" }}>✓</span>
                  <span><b className="text-foreground">{j.dailyAvg.toFixed(1)} violations/day</b> on average — {j.dailyAvg > 30 ? "well above" : "above"} the city median</span>
                </div>
              )}
              {j.wowGrowth > 10 && (
                <div className="flex items-start gap-2">
                  <span style={{ color: "#f6ad55" }}>✓</span>
                  <span>Violations <b className="text-foreground">rising {j.wowGrowth.toFixed(0)}% week-over-week</b> — emerging risk trend detected</span>
                </div>
              )}
              {j.spikeRatio > 2 && (
                <div className="flex items-start gap-2">
                  <span style={{ color: "#f6ad55" }}>✓</span>
                  <span><b className="text-foreground">{j.spikeRatio.toFixed(2)}× spike ratio</b> — sharp peak-hour concentration, not evenly spread across the day</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span style={{ color: "#00d4ff" }}>✓</span>
                <span>Peak risk window at <b className="text-foreground">{String(j.peakHour).padStart(2, "0")}:00 IST</b> based on 24h historical risk profile</span>
              </div>
              {j.consistency > 0.15 && (
                <div className="flex items-start gap-2">
                  <span style={{ color: "#fc4f4f" }}>✓</span>
                  <span><b className="text-foreground">Recurring pattern</b> (consistency {j.consistency.toFixed(2)}) — this is a chronic, not one-off, hotspot</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span style={{ color: priorityColor(j.priority) }}>✓</span>
                <span>Ranked <b className="text-foreground">#{j.rank} of {junctions.length}</b> citywide by Parking Disruption Index ({j.pdi.toFixed(1)})</span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground mt-3 italic">
              Reasoning generated directly from this junction's PDI inputs and behavior classification — no separate explanation model.
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle>Behavior Metrics</SectionTitle>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="text-left py-2 font-medium">Metric</th>
                  <th className="text-left py-2 font-medium">Value</th>
                  <th className="text-left py-2 font-medium">Assessment</th>
                </tr>
              </thead>
              <tbody>
                {behaviorRows.map((r) => (
                  <tr key={r.metric} className="border-t" style={{ borderColor: "rgba(0,212,255,0.08)" }}>
                    <td className="py-2.5 text-muted-foreground">{r.metric}</td>
                    <td className="py-2.5 font-semibold">{r.value}</td>
                    <td className="py-2.5">{r.assess}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-5">
            <SectionTitle>This Junction vs City Average</SectionTitle>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={comparison}>
                <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" />
                <XAxis dataKey="metric" stroke="#a0aec0" fontSize={11} />
                <YAxis stroke="#a0aec0" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span style={{ color: "#a0aec0" }}>{v}</span>} />
                <Bar dataKey="junction" fill={riskColor(jLive.liveRisk)} radius={[4, 4, 0, 0]} name={j.name} />
                <Bar dataKey="city" fill="#4a5568" radius={[4, 4, 0, 0]} name="City Avg" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className="text-2xl font-bold mt-2" style={{ color: color ?? "#00d4ff" }}>{value}</div>
    </Card>
  );
}
