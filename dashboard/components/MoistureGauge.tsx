import type { PlantPreset } from "../lib/plants.ts";
import { moistureStatus, moistureStatusLabel } from "../lib/plants.ts";

type Props = {
  value: number;
  preset?: PlantPreset | null;
  stale?: boolean;
};

const CX = 60;
const CY = 58;
const R = 44;
const STROKE = 8;
const MARKER_R = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function pctToAngle(pct: number): number {
  return (clamp(pct, 0, 100) / 100) * 180;
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startPct: number,
  endPct: number,
): string {
  const startAngle = pctToAngle(startPct);
  const endAngle = pctToAngle(endPct);
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  if (startPct === endPct) return "";
  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const STATUS_COLORS = {
  optimal: "#00ba7c",
  dry: "#f7931a",
  wet: "#1d9bf0",
  neutral: "#8b98a5",
} as const;

export default function MoistureGauge({ value, preset, stale }: Props) {
  const status = moistureStatus(value, preset ?? null);
  const statusClass = status ?? "neutral";
  const valueColor = STATUS_COLORS[statusClass];
  const marker = polarToCartesian(CX, CY, R, pctToAngle(value));
  const valueArc = describeArc(CX, CY, R, 0, value);

  return (
    <div className={`moisture-gauge${stale ? " stale" : ""}`}>
      <svg viewBox="0 0 120 72" className="gauge-svg" aria-hidden="true">
        <path
          className="gauge-track"
          d={describeArc(CX, CY, R, 0, 100)}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {preset && (
          <path
            className="gauge-optimum"
            d={describeArc(CX, CY, R, preset.minPct, preset.maxPct)}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        )}
        {value > 0 && valueArc && (
          <path
            className="gauge-value-arc"
            d={valueArc}
            fill="none"
            stroke={valueColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        )}
        <circle
          className="gauge-marker"
          cx={marker.x}
          cy={marker.y}
          r={MARKER_R}
          fill={valueColor}
          stroke="#0f1419"
          strokeWidth={2}
        />
      </svg>
      <div className="gauge-readout">
        <div className="gauge-value">{value.toFixed(1)}%</div>
        <div className={`moisture-status ${statusClass}`}>
          {moistureStatusLabel(status)}
        </div>
      </div>
    </div>
  );
}
