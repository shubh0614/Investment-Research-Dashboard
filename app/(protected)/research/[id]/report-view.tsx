"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  ExternalLink, Clock, Zap, BarChart2, Tag, ArrowLeft, FileDown,
} from "lucide-react";
import { PriceChart } from "@/components/price-chart";
import type { ReportRow } from "@/lib/services/research";
import type { ResearchReport, NewsItem, RiskItem, CompanyOverview, ComparisonRow } from "@/lib/ai/schemas";

// ── Source chip ────────────────────────────────────────────────────────────────
function SourceChip({ label }: { label: string }) {
  return <span className="source-chip">{label}</span>;
}

// ── Metric cell ───────────────────────────────────────────────────────────────
function MetricCell({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p
        className="mt-0.5 font-mono text-sm font-semibold"
        style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}
      >
        {value != null ? String(value) : "—"}
      </p>
    </div>
  );
}

function fmtMetric(val: number | null | undefined, prefix = "", suffix = "", billions = false): string {
  if (val == null) return "—";
  if (billions && Math.abs(val) >= 1e9) return `${prefix}${(val / 1e9).toFixed(1)}B${suffix}`;
  if (billions && Math.abs(val) >= 1e6) return `${prefix}${(val / 1e6).toFixed(0)}M${suffix}`;
  return `${prefix}${val.toFixed(2)}${suffix}`;
}

// ── Company card ──────────────────────────────────────────────────────────────
function CompanyCard({ co }: { co: CompanyOverview }) {
  const { metrics } = co;
  const change = metrics.price_change_1d;
  const up = change != null && change >= 0;

  return (
    <div className="card card-lg reveal">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-lg font-bold"
              style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}
            >
              {co.ticker}
            </span>
            {change != null && (
              <span
                className="flex items-center gap-1 font-mono text-xs"
                style={{ color: up ? "var(--positive)" : "var(--negative)", fontVariantNumeric: "tabular-nums" }}
              >
                {up ? <TrendingUp size={11} strokeWidth={1.5} /> : <TrendingDown size={11} strokeWidth={1.5} />}
                {up ? "+" : ""}{change.toFixed(2)}%
              </span>
            )}
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{co.name}</p>
        </div>
        {metrics.current_price != null && (
          <span
            className="font-mono text-xl font-semibold"
            style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}
          >
            ${metrics.current_price.toFixed(2)}
          </span>
        )}
      </div>

      <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
        {co.overview}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCell label="Market Cap" value={fmtMetric(metrics.market_cap, "$", "", true)} />
        <MetricCell label="P/E Ratio"  value={fmtMetric(metrics.pe_ratio)} />
        <MetricCell label="Fwd P/E"    value={fmtMetric(metrics.forward_pe)} />
        <MetricCell label="Revenue TTM" value={fmtMetric(metrics.revenue_ttm, "$", "", true)} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {co.sources.map((s) => <SourceChip key={s} label={s} />)}
      </div>
    </div>
  );
}

// ── Comparison table ──────────────────────────────────────────────────────────
function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  if (!rows.length) return null;
  const tickers = Object.keys(rows[0]?.values ?? {});

  return (
    <div className="card overflow-hidden reveal" style={{ padding: 0 }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Metric
              </th>
              {tickers.map((t) => (
                <th key={t} className="px-4 py-3 text-right font-mono text-xs font-semibold" style={{ color: "var(--text)" }}>
                  {t}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Sources
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="table-row-hover" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <td className="px-4 py-3 text-xs font-medium" style={{ color: "var(--text)" }}>{row.metric}</td>
                {tickers.map((t) => {
                  const val = row.values[t];
                  return (
                    <td key={t} className="px-4 py-3 text-right font-mono text-xs" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                      {val != null ? String(val) : "—"}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {row.sources.map((s) => <SourceChip key={s} label={s} />)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sentiment badge ────────────────────────────────────────────────────────────
function SentimentBadge({ sentiment }: { sentiment: NewsItem["sentiment"] }) {
  const cls =
    sentiment === "positive" ? "badge-positive" :
    sentiment === "negative" ? "badge-negative" : "badge-neutral";
  const Icon = sentiment === "positive" ? TrendingUp : sentiment === "negative" ? TrendingDown : Minus;
  return (
    <span className={`${cls} flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium`}>
      <Icon size={10} strokeWidth={2} />
      {sentiment}
    </span>
  );
}

// ── News section ──────────────────────────────────────────────────────────────
function NewsSection({ items }: { items: NewsItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="card reveal">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-sm font-medium leading-snug" style={{ color: "var(--text)" }}>
              {item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                   className="hover:underline inline-flex items-center gap-1"
                   style={{ color: "var(--text)" }}>
                  {item.headline}
                  <ExternalLink size={11} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
                </a>
              ) : item.headline}
            </p>
            <SentimentBadge sentiment={item.sentiment} />
          </div>
          <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
            {item.summary}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SourceChip label={item.source} />
              {item.published_at && (
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(item.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
            <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
              {Math.round(item.confidence * 100)}% confidence
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Risks section ─────────────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<RiskItem["severity"], string> = {
  high:   "var(--negative)",
  medium: "#F5A623",
  low:    "var(--positive)",
};

function RisksSection({ items }: { items: RiskItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((risk, i) => (
        <div key={i} className="card reveal">
          <div className="mb-1.5 flex items-center gap-2.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: SEVERITY_COLOR[risk.severity] }}
            />
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{risk.risk}</p>
            <span
              className="ml-auto rounded px-1.5 py-0.5 font-mono text-xs font-medium"
              style={{
                color: SEVERITY_COLOR[risk.severity],
                background: `color-mix(in srgb, ${SEVERITY_COLOR[risk.severity]} 12%, transparent)`,
              }}
            >
              {risk.severity}
            </span>
          </div>
          <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)", lineHeight: "1.6" }}>
            {risk.rationale}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {risk.sources.map((s) => <SourceChip key={s} label={s} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AI reasoning panel ────────────────────────────────────────────────────────
function ReasoningPanel({ report }: { report: ResearchReport }) {
  const [open, setOpen] = useState(false);
  const { meta } = report;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors duration-150"
        style={{ color: "var(--text)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <div className="flex items-center gap-2">
          <Zap size={14} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-medium">AI reasoning</span>
          <div className="flex gap-1.5 ml-2">
            {report.tools_used.map((t) => (
              <span key={t} className="source-chip">{t}</span>
            ))}
          </div>
        </div>
        {open ? <ChevronUp size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />}
      </button>

      {open && (
        <div
          className="stagger px-4 pb-4 pt-1"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tools called</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {report.tools_used.map((t) => (
                  <span key={t} className="source-chip">{t}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Latency</p>
              <p className="mt-0.5 font-mono text-sm" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {(meta.latency_ms / 1000).toFixed(1)}s
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tokens used</p>
              <p className="mt-0.5 font-mono text-sm" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {meta.token_usage.total.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Generated at</p>
              <p className="mt-0.5 font-mono text-sm" style={{ color: "var(--text)" }}>
                {new Date(meta.generated_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>{title}</h2>
      {count != null && (
        <span
          className="rounded px-1.5 py-0.5 font-mono text-xs"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// ── Main report view ──────────────────────────────────────────────────────────
export function ReportView({ report: row }: { report: ReportRow }) {
  const r = row.result_json as unknown as ResearchReport;
  if (!r) return <p style={{ color: "var(--text-muted)" }}>Report data unavailable.</p>;

  // Group price series by ticker
  const seriesByTicker: Record<string, { date: string; close: number }[]> = {};
  for (const pt of r.price_series ?? []) {
    if (!seriesByTicker[pt.ticker]) seriesByTicker[pt.ticker] = [];
    seriesByTicker[pt.ticker].push({ date: pt.date, close: pt.close });
  }

  return (
    <div
      className="mx-auto w-full px-8 py-8"
      style={{ maxWidth: "760px", color: "var(--text)" }}
    >
      {/* Back link */}
      <Link
        href="/history"
        className="mb-6 inline-flex items-center gap-1.5 text-xs transition-colors duration-150"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; }}
      >
        <ArrowLeft size={12} strokeWidth={1.5} />
        Back to history
      </Link>

      {/* Title + meta */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1
            className="text-2xl font-semibold"
            style={{ color: "var(--text)", letterSpacing: "-0.012em" }}
          >
            {row.title || r.meta?.query_text || "Research Report"}
          </h1>
          {/* Export buttons */}
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <a
              href={`/api/research/${row.id}/export?format=csv`}
              download
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)", background: "var(--surface)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}
              title="Download CSV"
            >
              <FileDown size={12} strokeWidth={1.5} />
              CSV
            </a>
            <a
              href={`/api/research/${row.id}/export?format=pdf`}
              download
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)", background: "var(--surface)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}
              title="Download PDF"
            >
              <FileDown size={12} strokeWidth={1.5} />
              PDF
            </a>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <Clock size={12} strokeWidth={1.5} />
            {new Date(row.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          {row.tags.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              <Tag size={12} strokeWidth={1.5} />
              {row.tags.join(", ")}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
            <BarChart2 size={12} strokeWidth={1.5} />
            {r.tools_used?.join(", ")}
          </span>
        </div>
      </div>

      {/* Summary */}
      <div
        className="mb-8 rounded-xl border px-5 py-4 reveal"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--text)", lineHeight: "1.7" }}>
          {r.summary}
        </p>
      </div>

      {/* AI reasoning */}
      {r.meta && (
        <div className="mb-8 reveal">
          <ReasoningPanel report={r} />
        </div>
      )}

      {/* Company cards */}
      {r.companies?.length > 0 && (
        <section className="mb-8">
          <SectionHeader title="Companies" count={r.companies.length} />
          <div className="flex flex-col gap-4">
            {r.companies.map((co) => <CompanyCard key={co.ticker} co={co} />)}
          </div>
        </section>
      )}

      {/* Price chart(s) */}
      {Object.keys(seriesByTicker).length > 0 && (
        <section className="mb-8">
          <SectionHeader title="Price History" />
          <div className="flex flex-col gap-6">
            {Object.entries(seriesByTicker).map(([ticker, pts]) => (
              <div key={ticker} className="card card-lg reveal">
                <p className="mb-4 font-mono text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  {ticker}
                </p>
                <PriceChart data={pts} ticker={ticker} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comparison table */}
      {r.comparison && r.comparison.length > 0 && (
        <section className="mb-8">
          <SectionHeader title="Comparison" />
          <ComparisonTable rows={r.comparison} />
        </section>
      )}

      {/* News */}
      {r.news?.length > 0 && (
        <section className="mb-8">
          <SectionHeader title="News" count={r.news.length} />
          <NewsSection items={r.news} />
        </section>
      )}

      {/* Risks */}
      {r.risks?.length > 0 && (
        <section className="mb-8">
          <SectionHeader title="Risks" count={r.risks.length} />
          <RisksSection items={r.risks} />
        </section>
      )}
    </div>
  );
}
