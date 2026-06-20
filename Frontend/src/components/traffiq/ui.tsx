import { type ReactNode, type CSSProperties } from "react";

export function Card({
  children,
  className = "",
  hover = true,
  style,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className={`glow-card ${hover ? "glow-card-hover" : ""} ${className}`} style={style}>{children}</div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold tracking-wide text-foreground/90 uppercase">
        {children}
      </h3>
      {right}
    </div>
  );
}

export function Pill({ priority }: { priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" }) {
  const cls =
    priority === "CRITICAL"
      ? "pill-critical"
      : priority === "HIGH"
      ? "pill-high"
      : "pill-medium";
  return (
    <span className={`${cls} text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider`}>
      {priority}
    </span>
  );
}

export function Kpi({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: ReactNode;
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