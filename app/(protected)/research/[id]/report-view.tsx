"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  ExternalLink, Clock, Zap, BarChart2, Tag, ArrowLeft, FileDown, User,
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
      <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{label}</p>
      <p
        className="mt-0.5 font-mono text-sm font-semibold"
        style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}
      >
        {value != null ? String(value) : "-"}
      </p>
    </div>
  );
}

function fmtMetric(val: number | null | undefined, prefix = "", suffix = "", billions = false): string {
  if (val == null) return "-";
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
                style={{ color: up ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}
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
        <MetricCell label="Mkt Cap"    value={fmtMetric(metrics.market_cap, "$", "", true)} />
        <MetricCell label="P/E"        value={fmtMetric(metrics.pe_ratio)} />
        <MetricCell label="Fwd P/E"    value={fmtMetric(metrics.forward_pe)} />
        <MetricCell label="Rev TTM"    value={fmtMetric(metrics.revenue_ttm, "$", "", true)} />
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
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <th className="px-4 py-2.5 text-left font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                Metric
              </th>
              {tickers.map((t) => (
                <th key={t} className="px-4 py-2.5 text-right font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text)" }}>
                  {t}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                Sources
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--border)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--surface-2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
              >
                <td className="px-4 py-2.5 text-xs font-medium" style={{ color: "var(--text)" }}>{row.metric}</td>
                {tickers.map((t) => {
                  const val = row.values[t];
                  return (
                    <td key={t} className="px-4 py-2.5 text-right font-mono text-xs" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                      {val != null ? String(val) : "-"}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-right">
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
                <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(item.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
            <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
              {Math.round(item.confidence * 100)}% conf.
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Risks section ─────────────────────────────────────────────────────────────
const SEVERITY_COLOR: Record<RiskItem["severity"], string> = {
  high:   "var(--neg)",
  medium: "#F5A623",
  low:    "var(--pos)",
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
              className="ml-auto rounded px-1.5 py-0.5 font-mono text-xs font-medium uppercase tracking-wider"
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
            {risk.sources.map((s, idx) => {
              const url = risk.source_urls?.[idx];
              return url && url.startsWith("http") ? (
                <a key={s} href={url} target="_blank" rel="noopener noreferrer"
                   className="source-chip inline-flex items-center gap-1"
                   style={{ textDecoration: "none" }}
                   onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.75"; }}
                   onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}>
                  {s}
                  <ExternalLink size={9} strokeWidth={1.5} />
                </a>
              ) : <SourceChip key={s} label={s} />;
            })}
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
      className="rounded-lg border overflow-hidden"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors duration-150"
        style={{ color: "var(--text)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
      >
        <div className="flex items-center gap-2">
          <Zap size={13} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
          <span className="text-xs font-medium uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)" }}>Methodology</span>
          <div className="flex gap-1.5 ml-2">
            {report.tools_used.map((t) => (
              <span key={t} className="source-chip">{t}</span>
            ))}
          </div>
        </div>
        {open ? <ChevronUp size={13} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={13} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />}
      </button>

      {open && (
        <div
          className="stagger px-4 pb-4 pt-1"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>Tools</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {report.tools_used.map((t) => (
                  <span key={t} className="source-chip">{t}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>Latency</p>
              <p className="mt-0.5 font-mono text-sm" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {(meta.latency_ms / 1000).toFixed(1)}s
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>Tokens</p>
              <p className="mt-0.5 font-mono text-sm" style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                {meta.token_usage.total.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>Generated</p>
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
    <div className="mb-4 flex items-center gap-3">
      <h2
        className="text-xl font-semibold"
        style={{ color: "var(--text)", fontFamily: "var(--font-serif)", letterSpacing: "-0.015em" }}
      >
        {title}
      </h2>
      {count != null && (
        <span
          className="font-mono text-xs"
          style={{ background: "var(--surface-2)", color: "var(--text-faint)", padding: "1px 6px", borderRadius: 4 }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

// ── Section nav ───────────────────────────────────────────────────────────────
type NavSection = { id: string; label: string; visible: boolean };

function SectionNav({ sections }: { sections: NavSection[] }) {
  const visible = sections.filter((s) => s.visible);
  if (visible.length < 2) return null;

  return (
    <div
      className="mb-8 flex items-center gap-0 overflow-x-auto"
      style={{
        borderBottom: "1px solid var(--border)",
        scrollbarWidth: "none",
      }}
    >
      {visible.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="shrink-0 px-4 pb-2.5 pt-1 font-mono text-xs font-medium uppercase tracking-wider transition-colors duration-100"
          style={{ color: "var(--text-muted)", textDecoration: "none", borderBottom: "2px solid transparent" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; }}
        >
          {s.label}
        </a>
      ))}
    </div>
  );
}

// ── Main report view ──────────────────────────────────────────────────────────
export function ReportView({ report: row }: { report: ReportRow }) {
  const raw = row.result_json as unknown as ResearchReport & { [k: string]: unknown };
  if (!raw) return <p style={{ color: "var(--text-muted)" }}>Report data unavailable.</p>;

  // Normalize legacy seed data: old format used key_metrics on companies and
  // stored risks as a plain string[] instead of RiskItem[].
  let r: ResearchReport;
  try {
    r = {
      ...raw,
      companies: (raw.companies ?? []).map((co) => ({
        ...co,
        metrics: co.metrics ?? {},
      })),
      risks: ((raw.risks ?? []) as (RiskItem | string)[]).map((risk) =>
        typeof risk === "string"
          ? { risk, rationale: "", severity: "medium" as const, sources: [], source_urls: [] }
          : risk
      ),
    };
  } catch {
    throw new Error("Report data is in an unrecognized format and could not be rendered.");
  }

  const seriesByTicker: Record<string, { date: string; close: number }[]> = {};
  for (const pt of r.price_series ?? []) {
    if (!seriesByTicker[pt.ticker]) seriesByTicker[pt.ticker] = [];
    seriesByTicker[pt.ticker].push({ date: pt.date, close: pt.close });
  }

  const hasCompanies   = (r.companies?.length ?? 0) > 0;
  const hasFinancials  = Object.keys(seriesByTicker).length > 0 || (r.comparison?.length ?? 0) > 0;
  const hasSentiment   = (r.news?.length ?? 0) > 0;
  const hasRisk        = (r.risks?.length ?? 0) > 0;

  const navSections: NavSection[] = [
    { id: "overview",   label: "Overview",    visible: true },
    { id: "companies",  label: "Companies",   visible: hasCompanies },
    { id: "financials", label: "Financials",  visible: hasFinancials },
    { id: "sentiment",  label: "Sentiment",   visible: hasSentiment },
    { id: "risk",       label: "Risk",        visible: hasRisk },
  ];

  return (
    <div
      className="mx-auto w-full px-8 py-8"
      style={{ maxWidth: "800px", color: "var(--text)" }}
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

      {/* Title + actions */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text)", letterSpacing: "-0.018em", lineHeight: 1.2, fontFamily: "var(--font-serif)" }}
          >
            {row.title || r.meta?.query_text || "Research Report"}
          </h1>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <a
              href={`/api/research/${row.id}/export?format=csv`}
              download
              className="flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)", background: "var(--surface-1)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}
              title="Download CSV"
            >
              <FileDown size={11} strokeWidth={1.5} />
              CSV
            </a>
            <a
              href={`/api/research/${row.id}/export?format=pdf`}
              download
              className="flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)", background: "var(--surface-1)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}
              title="Download PDF"
            >
              <FileDown size={11} strokeWidth={1.5} />
              PDF
            </a>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 font-mono text-xs" style={{ color: "var(--text-faint)" }}>
            <Clock size={11} strokeWidth={1.5} />
            {new Date(row.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          {(row.author_name || row.author_email) && (
            <span className="flex items-center gap-1.5 font-mono text-xs" style={{ color: "var(--text-faint)" }}>
              <User size={11} strokeWidth={1.5} />
              {row.author_name ?? row.author_email}
            </span>
          )}
          {row.tags.length > 0 && (
            <span className="flex items-center gap-1.5 font-mono text-xs" style={{ color: "var(--text-faint)" }}>
              <Tag size={11} strokeWidth={1.5} />
              {row.tags.join(", ")}
            </span>
          )}
          {r.tools_used?.length > 0 && (
            <span className="flex items-center gap-1.5 font-mono text-xs" style={{ color: "var(--text-faint)" }}>
              <BarChart2 size={11} strokeWidth={1.5} />
              {r.tools_used.join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* Section nav */}
      <SectionNav sections={navSections} />

      {/* Overview */}
      <section id="overview" className="mb-10">
        <SectionHeader title="Overview" />
        <div
          className="rounded-lg border px-5 py-4 reveal"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "var(--text)", lineHeight: "1.75" }}>
            {r.summary}
          </p>
        </div>
        {r.meta && (
          <div className="mt-3 reveal">
            <ReasoningPanel report={r} />
          </div>
        )}
      </section>

      {/* Companies */}
      {hasCompanies && (
        <section id="companies" className="mb-10">
          <SectionHeader title="Companies" count={r.companies.length} />
          <div className="flex flex-col gap-4">
            {r.companies.map((co) => <CompanyCard key={co.ticker} co={co} />)}
          </div>
        </section>
      )}

      {/* Financials */}
      {hasFinancials && (
        <section id="financials" className="mb-10">
          <SectionHeader title="Financials" />

          {Object.keys(seriesByTicker).length > 0 && (
            <div className="mb-6 flex flex-col gap-6">
              {Object.entries(seriesByTicker).map(([ticker, pts]) => (
                <div key={ticker} className="card card-lg reveal">
                  <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                    {ticker} · Price history
                  </p>
                  <PriceChart data={pts} ticker={ticker} />
                  <p className="mt-3 font-mono text-xs" style={{ color: "var(--text-faint)" }}>
                    Source: Yahoo Finance / Finnhub
                  </p>
                </div>
              ))}
            </div>
          )}

          {r.comparison && r.comparison.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                Comparison
              </p>
              <ComparisonTable rows={r.comparison} />
            </div>
          )}
        </section>
      )}

      {/* Sentiment */}
      {hasSentiment && (
        <section id="sentiment" className="mb-10">
          <SectionHeader title="Sentiment" count={r.news.length} />

          {/* Sentiment summary bar */}
          {(() => {
            const pos = r.news.filter((n) => n.sentiment === "positive").length;
            const neg = r.news.filter((n) => n.sentiment === "negative").length;
            const neu = r.news.filter((n) => n.sentiment === "neutral").length;
            const total = r.news.length;
            return (
              <div
                className="mb-4 flex items-center gap-4 rounded-lg border px-4 py-3 reveal"
                style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
              >
                <div className="flex h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                  <div style={{ width: `${(pos / total) * 100}%`, background: "var(--pos)", transition: "width 600ms" }} />
                  <div style={{ width: `${(neg / total) * 100}%`, background: "var(--neg)", transition: "width 600ms" }} />
                </div>
                <div className="flex gap-4 shrink-0">
                  <span className="font-mono text-xs" style={{ color: "var(--pos)" }}>{pos} positive</span>
                  <span className="font-mono text-xs" style={{ color: "var(--neg)" }}>{neg} negative</span>
                  <span className="font-mono text-xs" style={{ color: "var(--text-faint)" }}>{neu} neutral</span>
                </div>
              </div>
            );
          })()}

          <NewsSection items={r.news} />
        </section>
      )}

      {/* Risk */}
      {hasRisk && (
        <section id="risk" className="mb-10">
          <SectionHeader title="Risk" count={r.risks.length} />
          <RisksSection items={r.risks} />
        </section>
      )}
    </div>
  );
}
