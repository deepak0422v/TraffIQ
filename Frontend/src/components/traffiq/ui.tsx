import { type ReactNode } from "react";

export function Card({
  children,
  className = "",
  hover = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`glow-card ${hover ? "glow-card-hover" : ""} ${className}`}>{children}</div>
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
