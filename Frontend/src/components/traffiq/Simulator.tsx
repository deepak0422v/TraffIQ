import { useState, useMemo } from "react";
import { CartesianGrid, Cell, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, RadialBar, RadialBarChart, PolarAngleAxis, BarChart, Bar, AreaChart } from "recharts";
import { Card, Pill, SectionTitle } from "./ui";
import { useApp } from "./state";
import { Slider } from "@/components/ui/slider";
import { AnimatedNumber } from "./AnimatedNumber";

const tooltipStyle = {
  backgroundColor: "#0f1117",
  border: "1px solid rgba(0,212,255,0.4)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
};

export function Simulator() {
  const { hour, officers, junctions, hourlyRiskLookup } = useApp();

  const [simHour, setSimHour] = useState(hour);
  const [deployOfficers, setDeployOfficers] = useState(officers);
  const [targetZones, setTargetZones] = useState(8);
  const [multiplier, setMultiplier] = useState(1.5);

  // 1. Memoize sorting of all junctions for each of the 24 hours
  // This computes once on mount/data change rather than on every slider drag.
  const hourlySortedJunctions = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => {
      return junctions
        .map(j => {
          const hourlyArr = hourlyRiskLookup[j.junction_id];
          const riskVal = hourlyArr ? hourlyArr[h] : j.risk;
          return { ...j, liveRisk: riskVal };
        })
        .sort((a, b) => b.liveRisk - a.liveRisk);
    });
  }, [junctions, hourlyRiskLookup]);

  // 2. Resolve active simulation lists and stats
  const liveRanked = hourlySortedJunctions[simHour] || [];
  const baseJunctions = liveRanked.slice(0, targetZones);
  
  const totalRisk = baseJunctions.reduce((sum, j) => sum + j.liveRisk, 0);
  const baseAvgRisk = baseJunctions.length > 0 ? totalRisk / baseJunctions.length : 0.42;

  // Apply simulation offsets (explicitly labeled in UI as heuristics)
  const baselineCoverage = Math.min(99, Math.round(baseAvgRisk * 100 + 10));
  const optimizedCoverage = Math.min(99, Math.round(baseAvgRisk * 100 + 10 + (multiplier - 1) * 15));
  const delta = optimizedCoverage - baselineCoverage;

  const baselineHighRisk = baseJunctions.filter(j => j.liveRisk >= 0.55).length;
  const optimizedHighRisk = Math.min(targetZones, Math.round(baselineHighRisk * Math.min(1.5, multiplier)));

  // 3. Memoize 24-hour simulation timelines
  const sim24 = useMemo(() => {
    return Array.from({ length: 24 }, (_, h) => {
      const sorted = hourlySortedJunctions[h] || [];
      const top = sorted.slice(0, targetZones);
      const avgRisk = top.length > 0
        ? top.reduce((sum, r) => sum + r.liveRisk, 0) / top.length
        : 0.35;

      const base = Math.min(99, Math.round(avgRisk * 100 + 10));
      const opt = Math.min(99, Math.round(avgRisk * 100 + 10 + (multiplier - 1) * 15));

      return {
        hour: h,
        baseline: base,
        optimized: opt,
        risk: +(avgRisk * 100).toFixed(1),
      };
    });
  }, [hourlySortedJunctions, targetZones, multiplier]);

  // 4. Proportional officer allocations (Largest Remainder Method)
  const tempBase = baseJunctions.map(j => (j.liveRisk / (totalRisk || 1)) * deployOfficers);
  let baseAllocations = tempBase.map(v => Math.floor(v));
  let sumBase = baseAllocations.reduce((sum, val) => sum + val, 0);
  let remBase = deployOfficers - sumBase;
  const fracBase = tempBase.map((v, idx) => ({ idx, frac: v - Math.floor(v) }));
  fracBase.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remBase && i < baseJunctions.length; i++) {
    baseAllocations[fracBase[i].idx] += 1;
  }

  const optTotalOfficers = Math.min(100, Math.round(deployOfficers * multiplier));
  const tempOpt = baseJunctions.map(j => (j.liveRisk / (totalRisk || 1)) * optTotalOfficers);
  let optAllocations = tempOpt.map(v => Math.floor(v));
  let sumOpt = optAllocations.reduce((sum, val) => sum + val, 0);
  let remOpt = optTotalOfficers - sumOpt;
  const fracOpt = tempOpt.map((v, idx) => ({ idx, frac: v - Math.floor(v) }));
  fracOpt.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remOpt && i < baseJunctions.length; i++) {
    optAllocations[fracOpt[i].idx] += 1;
  }

  const tableJunctions = baseJunctions.map((j, idx) => ({
    ...j,
    baseOfficers: baseAllocations[idx],
    optOfficers: optAllocations[idx],
  }));

  const compare = [
    { metric: "Coverage %", baseline: baselineCoverage, optimized: optimizedCoverage },
    { metric: "High-Risk Covered", baseline: baselineHighRisk, optimized: optimizedHighRisk },
    { metric: "Officers", baseline: deployOfficers, optimized: optTotalOfficers },
  ];

  const gaugeData = [{ name: "Coverage", value: optimizedCoverage, fill: "#68d391" }];

  return (
    <div className="page-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scenario Simulator (Experimental)</h1>
        <p className="text-sm text-muted-foreground">Interactive planning tool for exploring deployment scenarios.</p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-4 gap-6">
          <SliderControl label="Simulation Hour" value={simHour} min={0} max={23} onChange={setSimHour} display={`${String(simHour).padStart(2, "0")}:00`} />
          <SliderControl label="Officers to Deploy" value={deployOfficers} min={5} max={50} onChange={setDeployOfficers} />
          <SliderControl label="Target Zones" value={targetZones} min={3} max={20} onChange={setTargetZones} />
          <SliderControl label="Officer Multiplier" value={multiplier} min={0.5} max={3} step={0.1} onChange={setMultiplier} display={`${multiplier.toFixed(1)}x`} />
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Baseline Coverage" value={<AnimatedNumber value={baselineCoverage} suffix="%" />} sub="Experimental Heuristic" />
        <Card className="p-4">
          <div className="text-[11px] tracking-wider text-muted-foreground uppercase">Optimized Coverage</div>
          <div className="text-3xl font-bold mt-2" style={{ color: "#68d391" }}>
            <AnimatedNumber value={optimizedCoverage} suffix="%" />
          </div>
          <div className="text-xs mt-1" style={{ color: "#68d391" }}>▲ +{delta}% (Experimental Heuristic)</div>
        </Card>
        <Kpi label="High-Risk Baseline" value={<AnimatedNumber value={baselineHighRisk} />} sub="Actual CSV metrics" />
        <Kpi label="High-Risk Optimized" value={<AnimatedNumber value={optimizedHighRisk} />} color="#68d391" sub="Experimental Heuristic" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle>Coverage Score — Optimized vs Baseline</SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <RadialBarChart innerRadius="65%" outerRadius="100%" data={gaugeData} startAngle={180} endAngle={0}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background={{ fill: "#1f2536" }} dataKey="value" cornerRadius={10} />
              <text x="50%" y="55%" textAnchor="middle" fill="#68d391" fontSize={42} fontWeight={700}>
                {optimizedCoverage}%
              </text>
              <text x="50%" y="70%" textAnchor="middle" fill="#a0aec0" fontSize={11}>
                Baseline: {baselineCoverage}% · Heuristic Target: 85%
              </text>
            </RadialBarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <SectionTitle>Baseline vs Optimized</SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={compare}>
              <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" />
              <XAxis dataKey="metric" stroke="#a0aec0" fontSize={11} />
              <YAxis stroke="#a0aec0" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span style={{ color: "#a0aec0" }}>{v}</span>} />
              <Bar dataKey="baseline" fill="#4a5568" radius={[4, 4, 0, 0]} />
              <Bar dataKey="optimized" fill="#68d391" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle>24-Hour Coverage Simulation</SectionTitle>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={sim24}>
            <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" />
            <XAxis dataKey="hour" stroke="#a0aec0" fontSize={11} />
            <YAxis stroke="#a0aec0" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span style={{ color: "#a0aec0" }}>{v}</span>} />
            <Line type="monotone" dataKey="baseline" stroke="#a0aec0" strokeDasharray="2 4" dot={false} name="Baseline Coverage" />
            <Line type="monotone" dataKey="optimized" stroke="#00d4ff" strokeWidth={2.5} dot={false} name="Optimized Coverage" />
            <Line type="monotone" dataKey="risk" stroke="#fc4f4f" strokeDasharray="6 4" dot={false} name="Avg Risk ×100" />
            <ReferenceLine x={simHour} stroke="#facc15" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-5">
        <SectionTitle>Simulation Junction Detail</SectionTitle>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase tracking-wider">
              <th className="text-left py-2 font-medium">Rank</th>
              <th className="text-left py-2 font-medium">Junction</th>
              <th className="text-left py-2 font-medium">PDI</th>
              <th className="text-left py-2 font-medium">Risk</th>
              <th className="text-left py-2 font-medium">Baseline Officers</th>
              <th className="text-left py-2 font-medium">Optimized Officers</th>
              <th className="text-left py-2 font-medium">Priority</th>
            </tr>
          </thead>
          <tbody>
            {tableJunctions.map((j) => {
              return (
                <tr key={j.junction_id} className="border-t" style={{ borderColor: "rgba(0,212,255,0.08)" }}>
                  <td className="py-2.5" style={{ color: "#00d4ff" }}>#{j.rank}</td>
                  <td className="py-2.5 font-semibold">{j.name}</td>
                  <td className="py-2.5">{j.pdi.toFixed(1)}</td>
                  <td className="py-2.5">{j.liveRisk.toFixed(3)}</td>
                  <td className="py-2.5 text-muted-foreground">{j.baseOfficers}</td>
                  <td className="py-2.5" style={{ color: "#68d391" }}>{j.optOfficers}</td>
                  <td className="py-2.5"><Pill priority={j.priority} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function SliderControl({
  label, value, min, max, step = 1, onChange, display,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (n: number) => void; display?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-muted-foreground">{label}</span>
        <span style={{ color: "#00d4ff" }} className="font-semibold">{display ?? value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function Kpi({ label, value, color, sub }: { label: string; value: React.ReactNode; color?: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className="text-3xl font-bold mt-2" style={{ color: color ?? "#00d4ff" }}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}
