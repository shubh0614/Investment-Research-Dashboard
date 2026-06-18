import type { ResearchReport } from "@/lib/ai/schemas";

function escapeCell(val: string | number | null | undefined): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(...cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCell).join(",");
}

export function buildCsv(title: string, query: string, r: ResearchReport): string {
  const lines: string[] = [];

  // Metadata header
  lines.push(`# Klypup Research Report`);
  lines.push(`# Title: ${title}`);
  lines.push(`# Query: ${query}`);
  lines.push(`# Generated: ${r.meta.generated_at}`);
  lines.push(`# Tools used: ${r.tools_used.join(", ")}`);
  lines.push(`# Latency: ${r.meta.latency_ms}ms`);
  lines.push("");

  // Executive summary
  lines.push("## EXECUTIVE SUMMARY");
  lines.push(escapeCell(r.summary));
  lines.push("");

  // Companies
  if (r.companies.length > 0) {
    lines.push("## COMPANIES");
    lines.push(csvRow(
      "Ticker", "Name", "Overview",
      "Price (USD)", "Change 1d (%)", "Market Cap (USD)", "P/E Ratio",
      "Revenue TTM (USD)", "Sources",
    ));
    for (const co of r.companies) {
      const m = co.metrics;
      lines.push(csvRow(
        co.ticker, co.name, co.overview,
        m.current_price, m.price_change_1d, m.market_cap, m.pe_ratio,
        m.revenue_ttm, co.sources.join("; "),
      ));
    }
    lines.push("");
  }

  // News
  if (r.news.length > 0) {
    lines.push("## NEWS");
    lines.push(csvRow("Headline", "Summary", "Sentiment", "Confidence", "Published", "Source"));
    for (const item of r.news) {
      lines.push(csvRow(
        item.headline, item.summary,
        item.sentiment, item.confidence.toFixed(2),
        item.published_at, item.source,
      ));
    }
    lines.push("");
  }

  // Risks
  if (r.risks.length > 0) {
    lines.push("## RISKS");
    lines.push(csvRow("Risk", "Severity", "Rationale", "Sources"));
    for (const risk of r.risks) {
      lines.push(csvRow(risk.risk, risk.severity, risk.rationale, risk.sources.join("; ")));
    }
    lines.push("");
  }

  return lines.join("\n");
}
