"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface PricePoint {
  date: string;
  close: number;
}

interface PriceChartProps {
  data: PricePoint[];
  ticker: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PriceChart({ data, ticker }: PriceChartProps) {
  if (!data || data.length === 0) return null;

  const min = Math.min(...data.map((d) => d.close));
  const max = Math.max(...data.map((d) => d.close));
  const first = data[0]?.close ?? 0;
  const last  = data[data.length - 1]?.close ?? 0;
  const change = last - first;
  const pct    = first > 0 ? (change / first) * 100 : 0;
  const up     = change >= 0;

  return (
    <div>
      {/* Summary row */}
      <div className="mb-4 flex items-baseline gap-3">
        <span
          className="font-mono text-2xl font-semibold"
          style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}
        >
          ${fmt(last)}
        </span>
        <span
          className="font-mono text-sm"
          style={{ color: up ? "var(--positive)" : "var(--negative)", fontVariantNumeric: "tabular-nums" }}
        >
          {up ? "+" : ""}{fmt(change)} ({up ? "+" : ""}{pct.toFixed(2)}%)
        </span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="0"
            vertical={false}
            stroke="var(--border)"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            tickFormatter={(v: string) => {
              const d = new Date(v);
              return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            domain={[min * 0.97, max * 1.03]}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--text)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              boxShadow: "var(--shadow-md)",
            }}
            labelStyle={{ color: "var(--text-muted)", marginBottom: 4 }}
            formatter={(v) => [`$${fmt(Number(v))}`, ticker]}
            labelFormatter={(l) => new Date(String(l)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke="var(--accent)"
            strokeWidth={1.5}
            fill={`url(#grad-${ticker})`}
            dot={false}
            activeDot={{ r: 3, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
