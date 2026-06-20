import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Pill, SectionTitle } from "./ui";
import { priorityColor, riskColor } from "@/lib/traffiq-data";
import { useApp, computeAllocation } from "./state";
import { AnimatedNumber } from "./AnimatedNumber";

const tooltipStyle = {
  backgroundColor: "#0f1117",
  border: "1px solid rgba(0,212,255,0.4)",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
};

export function Planner() {
  const { hour, officers, junctions, hourlyRiskLookup } = useApp();

  // 1. Re-rank junctions by active hour risk dynamically from lookup
  const rawLiveRanked = [...junctions]
    .map((j) => {
      const hourlyArr = hourlyRiskLookup[j.junction_id];
      const liveRisk = hourlyArr ? hourlyArr[hour] : j.risk;
      return { ...j, liveRisk };
    })
    .sort((a, b) => b.liveRisk - a.liveRisk);

  // 2. Proportional dynamic officer allocation (aligned with backend)
  const top10Junctions = rawLiveRanked.slice(0, 10);
  const totalRiskTop10 = top10Junctions.reduce((sum, j) => sum + j.liveRisk, 0);
  const roundedAlloc = computeAllocation(top10Junctions, officers);

  const liveRanked = rawLiveRanked.map((j, idx) => {
    const allocatedOfficers = idx < 10 ? roundedAlloc[idx] : 0;
    return { ...j, officers: allocatedOfficers };
  });

  const top10 = liveRanked.slice(0, 10);
  const critical = top10.filter((j) => j.priority === "CRITICAL").length;
  
  // Average risk score across the top 10 priority junctions
  const avgRisk = top10.reduce((s, j) => s + j.liveRisk, 0) / top10.length;
  
  // Real risk coverage score: sum of risk of junctions receiving officers divided by sum of risk of top 10
  const coveredRisk = top10.reduce((sum, j) => sum + (j.officers >= 1 ? j.liveRisk : 0), 0);
  const coverage = totalRiskTop10 > 0 ? (coveredRisk / totalRiskTop10) * 100 : 0;

  const allocData = top10.map((j) => ({ name: j.name, officers: j.officers, risk: j.liveRisk }));

  // Dynamic hour comparison for active junctions.
  // FIX #4: each hour group gets its OWN risk-proportional officer
  // allocation (via the same shared computeAllocation used elsewhere),
  // instead of reusing the current global-hour `j.officers` as the label
  // for every bar regardless of that bar's actual hour/risk.
  const hourGroups = [8, 10, 13, 17, 20];
  const groupJunctions = top10.slice(0, 8);
  const groupedData = hourGroups.map((h) => {
    const row: Record<string, number | string> = { hour: `${h}:00` };
    const risksAtHour = groupJunctions.map((j) => {
      const hourlyArr = hourlyRiskLookup[j.junction_id];
      return hourlyArr ? hourlyArr[h] : j.risk;
    });
    const allocAtHour = computeAllocation(
      risksAtHour.map((r) => ({ liveRisk: r })),
      officers
    );
    groupJunctions.forEach((j, idx) => {
      row[j.name] = +risksAtHour[idx].toFixed(3);
      row[`${j.name}__officers`] = allocAtHour[idx];
    });
    return row;
  });

  return (
    <div className="page-in space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Enforcement Planner</h1>
          <p className="text-sm text-muted-foreground">
            Optimized deployment plan based on real-time risk scoring.
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <div className="glow-card px-3 py-2">
            <span className="text-muted-foreground">Hour: </span>
            <span style={{ color: "#00d4ff" }} className="font-semibold">{String(hour).padStart(2, "0")}:00</span>
          </div>
          <div className="glow-card px-3 py-2">
            <span className="text-muted-foreground">Officers: </span>
            <span style={{ color: "#00d4ff" }} className="font-semibold">{officers}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="High-Risk Zones Covered" value={<AnimatedNumber value={top10.filter(j => j.liveRisk >= 0.55 && j.officers >= 1).length} />} />
        <Kpi label="Critical Zones" value={<AnimatedNumber value={critical} />} color="#fc4f4f" />
        <Kpi label="Avg Risk Score" value={<AnimatedNumber value={avgRisk} decimals={3} />} color="#f6ad55" />
        <Kpi label="Deployment Coverage" value={<AnimatedNumber value={coverage} decimals={0} suffix="%" />} color="#68d391" />
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <Card className="p-5">
            <SectionTitle>Recommended Deployment Plan</SectionTitle>
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {top10.map((j, i) => (
                <div
                  key={j.junction_id}
                  className="glow-card glow-card-hover p-4 flex items-center gap-4"
                  style={{ background: "linear-gradient(135deg,#171c2a,#1f2536)" }}
                >
                  <div className="text-3xl font-bold w-10 text-center" style={{ color: "#00d4ff" }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-base">{j.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      <span className="mr-3">Officers <b style={{ color: "#00d4ff" }}>{j.officers}</b></span>
                      <span className="mr-3">Risk <b>{j.liveRisk.toFixed(3)}</b></span>
                      <span className="mr-3">PDI <b>{j.pdi.toFixed(1)}</b></span>
                      <span className="mr-3">Rank <b>#{j.rank}</b></span>
                      <span>Type <b style={{ color: priorityColor(j.priority) }}>{j.type}</b></span>
                    </div>
                  </div>
                  <Pill priority={j.priority} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-span-2 space-y-6">
          <Card className="p-5">
            <SectionTitle>Officer Allocation</SectionTitle>
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={allocData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="#a0aec0" fontSize={10} />
                <YAxis dataKey="name" type="category" stroke="#a0aec0" fontSize={10} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="officers" radius={[0, 4, 4, 0]}>
                  {allocData.map((d) => <Cell key={d.name} fill={riskColor(d.risk)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <SectionTitle>Risk Score by Zone</SectionTitle>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={top10}>
                <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#a0aec0" fontSize={9} angle={-30} textAnchor="end" height={70} interval={0} />
                <YAxis stroke="#a0aec0" fontSize={10} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="liveRisk" radius={[4, 4, 0, 0]}>
                  {top10.map((d) => <Cell key={d.name} fill={priorityColor(d.priority)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <SectionTitle>How Deployment Changes Across the Day</SectionTitle>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={groupedData}>
            <CartesianGrid stroke="#2d3748" strokeDasharray="3 3" />
            <XAxis dataKey="hour" stroke="#a0aec0" fontSize={11} />
            <YAxis stroke="#a0aec0" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {groupJunctions.map((j, i) => {
              const palette = ["#00d4ff", "#fc4f4f", "#f6ad55", "#68d391", "#a78bfa", "#f472b6", "#22d3ee", "#facc15"];
              return (
                <Bar key={j.junction_id} dataKey={j.name} fill={palette[i]} radius={[3, 3, 0, 0]}>
                  <LabelList dataKey={j.name} position="top" fill="#a0aec0" fontSize={9}
                    content={(props: any) => {
                      const { x, y, width, index } = props;
                      const officersAtHour = groupedData[index]?.[`${j.name}__officers`] ?? 0;
                      return (
                        <text x={(x ?? 0) + (width ?? 0) / 2} y={(y ?? 0) - 4} textAnchor="middle" fill="#a0aec0" fontSize={9}>
                          {officersAtHour}o
                        </text>
                      );
                    }} />
                </Bar>
              );
            })}
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className="text-3xl font-bold mt-2" style={{ color: color ?? "#00d4ff" }}>{value}</div>
    </Card>
  );
}
