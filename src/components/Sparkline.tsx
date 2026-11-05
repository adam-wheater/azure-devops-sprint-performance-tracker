import * as React from "react";

interface Props {
  data: number[];
  label?: string;
  /** Any CSS colour, normally a design token such as `var(--ax-info)`. */
  color?: string;
  /** Give both to draw at a fixed size; leave them out to fill the width of the parent. */
  width?: number;
  height?: number;
}

const FLUID_WIDTH = 100;
const FLUID_HEIGHT = 28;
const PAD = 2;

/** Compact trend line. Hand-rolled SVG that draws in `currentColor`, so it follows the theme. */
export const Sparkline: React.FC<Props> = ({
  data,
  label,
  color = "var(--ax-accent)",
  width,
  height,
}) => {
  if (data.length < 2) return null;

  const fixed = width !== undefined && height !== undefined;
  const w = fixed ? width : FLUID_WIDTH;
  const h = fixed ? height : FLUID_HEIGHT;
  const innerW = w - PAD * 2;
  const innerH = h - PAD * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => ({
    x: PAD + (i / (data.length - 1)) * innerW,
    y: PAD + innerH - ((value - min) / range) * innerH,
  }));
  const line = points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const area = `${line} ${points[points.length - 1].x.toFixed(2)},${h - PAD} ${points[0].x.toFixed(2)},${h - PAD}`;
  const last = points[points.length - 1];

  return (
    <svg
      className={fixed ? "ax-chart" : "ax-metric__spark ax-chart"}
      width={fixed ? w : undefined}
      height={fixed ? h : undefined}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={fixed ? undefined : "none"}
      style={{ color, ...(fixed ? { display: "inline-block", width: w, height: h } : {}) }}
      role="img"
      aria-label={label || "Trend chart"}
    >
      <polygon points={area} fill="currentColor" opacity={0.1} />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      {fixed && <circle cx={last.x} cy={last.y} r={2} fill="currentColor" />}
    </svg>
  );
};
