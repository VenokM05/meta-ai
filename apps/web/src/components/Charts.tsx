import type { ReactNode } from "react";
import { IconAlert } from "../lib/icons";

export function BulletChart({
  name,
  value,
  target,
  suffix = "%",
}: {
  name: string;
  value: number;
  target: number;
  suffix?: string;
}) {
  const pct = Math.round(value * 100);
  const scaleMax = 100;
  const width = Math.min(scaleMax, (pct / scaleMax) * 100);
  const targetPos = target * 100;
  const zone = value >= 0.85 ? "good" : value >= 0.65 ? "ok" : "poor";

  return (
    <div className="rg-bullet">
      <div className="rg-bullet-name">{name}</div>
      <div className="rg-bullet-track">
        {/* Threshold zones carry text labels; colour is never the only signal. */}
        <div className="rg-bullet-zone" data-zone="poor" style={{ width: "65%" }} />
        <div className="rg-bullet-zone" data-zone="ok" style={{ width: "20%" }} />
        <div className="rg-bullet-zone" data-zone="good" style={{ width: "15%" }} />
        <div className="rg-bullet-bar" style={{ width: `${width}%` }} data-zone={zone} />
        <div
          className="rg-bullet-target"
          style={{ left: `${targetPos}%` }}
          title={`target ${Math.round(target * 100)}${suffix}`}
        />
      </div>
      <div className="rg-bullet-value">
        {pct}
        {suffix}
      </div>
    </div>
  );
}

export function Notice({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "info" }) {
  return (
    <div className={tone === "info" ? "rg-notice rg-notice--accent" : "rg-notice"} role="note">
      <IconAlert />
      <span>{children}</span>
    </div>
  );
}
