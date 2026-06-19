"use client";

interface SparklineProps {
  data: { date: string; close: number }[];
  up: boolean;
  width?: number;
  height?: number;
}

export function Sparkline({ data, up, width = 60, height = 28 }: SparklineProps) {
  if (!data.length) return null;

  const values = data.map((d) => d.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + ((max - v) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const color = up ? "var(--pos)" : "var(--neg)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
    </svg>
  );
}
