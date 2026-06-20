import { createFileRoute } from "@tanstack/react-router";
import { AppProvider, useApp } from "@/components/traffiq/state";
import { Sidebar } from "@/components/traffiq/Sidebar";
import { CommandCenter } from "@/components/traffiq/CommandCenter";
import { GeoMap } from "@/components/traffiq/GeoMap";
import { Planner } from "@/components/traffiq/Planner";
import { JunctionIntel } from "@/components/traffiq/JunctionIntel";
import { AIEngine } from "@/components/traffiq/AIEngine";
import { Simulator } from "@/components/traffiq/Simulator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TraffIQ — Bengaluru Parking Enforcement Intelligence" },
      { name: "description", content: "Real-time parking enforcement intelligence dashboard for Bengaluru Traffic Police." },
      { property: "og:title", content: "TraffIQ — Bengaluru Enforcement Intelligence" },
      { property: "og:description", content: "Real-time parking enforcement intelligence dashboard for Bengaluru." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppProvider>
      <div className="min-h-screen dark" style={{ background: "#0f1117" }}>
        <Sidebar />
        <main className="ml-[240px] px-8 py-8 max-w-[1400px]">
          <PageSwitch />
        </main>
      </div>
    </AppProvider>
  );
}

function PageSwitch() {
  const { page } = useApp();
  switch (page) {
    case "command": return <CommandCenter />;
    case "geo": return <GeoMap />;
    case "planner": return <Planner />;
    case "junction": return <JunctionIntel />;
    case "ai_engine": return <AIEngine />;
    case "simulator": return <Simulator />;
  }
}
