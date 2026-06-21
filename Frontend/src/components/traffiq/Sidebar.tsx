import { useApp, type PageKey } from "./state";
import { Slider } from "@/components/ui/slider";
import { LayoutDashboard, Map, Users, Activity, FlaskConical, BrainCircuit } from "lucide-react";
import logo from "@/assets/traffic-police-logo.png";

const NAV: { key: PageKey; label: string; Icon: typeof LayoutDashboard }[] = [
  { key: "command", label: "Command Center", Icon: LayoutDashboard },
  { key: "geo", label: "Geo Intelligence Map", Icon: Map },
  { key: "planner", label: "Enforcement Planner", Icon: Users },
  { key: "junction", label: "Junction Intelligence", Icon: Activity },
  { key: "ai_engine", label: "Traffic Intelligence Engine", Icon: BrainCircuit },
  { key: "simulator", label: "Scenario Simulator (Experimental)", Icon: FlaskConical },
];

export function Sidebar() {
  const { page, setPage, hour, setHour, officers, setOfficers, criticalJunctions, cityAvgPdi } = useApp();
  return (
    <aside
      className="fixed inset-y-0 left-0 w-[240px] flex flex-col border-r"
      style={{ background: "#0c0e14", borderColor: "rgba(0,212,255,0.15)" }}
    >
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5 text-xl font-bold" style={{ color: "#00d4ff" }}>
          <img src={logo} alt="Traffic Police Logo" className="w-8 h-8" loading="lazy" />
          <span>TraffIQ</span>
        </div>
        <div className="text-[11px] mt-1 text-muted-foreground tracking-wide uppercase">
          Bengaluru Enforcement Intelligence
        </div>
      </div>

      <nav className="px-3 flex-1 overflow-y-auto">
        <div className="space-y-1">
          {NAV.map(({ key, label, Icon }) => {
            const active = page === key;
            return (
              <button
                key={key}
                onClick={() => setPage(key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all"
                style={{
                  background: active ? "rgba(0,212,255,0.12)" : "transparent",
                  color: active ? "#00d4ff" : "#a0aec0",
                  borderLeft: active ? "2px solid #00d4ff" : "2px solid transparent",
                }}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 px-1">
          <div className="text-[10px] tracking-widest text-muted-foreground uppercase mb-3">
            Live Controls
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 mb-2">Applies to all pages — simulate a different hour or officer count</p>

          <div className="mb-5">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground">Current Hour (IST)</span>
              <span style={{ color: "#00d4ff" }} className="font-semibold">
                {String(hour).padStart(2, "0")}:00
              </span>
            </div>
            <Slider value={[hour]} min={0} max={23} step={1} onValueChange={(v) => setHour(v[0])} />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground">Officers Available</span>
              <span style={{ color: "#00d4ff" }} className="font-semibold">
                {officers}
              </span>
            </div>
            <Slider value={[officers]} min={5} max={50} step={1} onValueChange={(v) => setOfficers(v[0])} />
          </div>
        </div>
      </nav>

      <div className="border-t px-5 py-4 space-y-1.5" style={{ borderColor: "rgba(0,212,255,0.15)" }}>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Avg City PDI</span>
          <span style={{ color: "#00d4ff" }} className="font-bold">{cityAvgPdi.toFixed(1)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Critical Junctions</span>
          <span style={{ color: "#fc4f4f" }} className="font-bold">{criticalJunctions}</span>
        </div>
      </div>
    </aside>
  );
}
