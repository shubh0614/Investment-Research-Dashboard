import { describe, it, expect } from "vitest";
import { buildCsv } from "@/lib/export/csv";
import type { ResearchReport } from "@/lib/ai/schemas";

const REPORT: ResearchReport = {
  summary: "Test summary for Apple Inc.",
  companies: [{
    ticker:   "AAPL",
    name:     "Apple Inc.",
    overview: "Consumer electronics company.",
    currency: "USD",
    metrics:  { current_price: 175.5, price_change_1d: 0.75, market_cap: 2.8e12, pe_ratio: 29, forward_pe: 26, revenue_ttm: 4.1e11 },
    sources:  ["market-data"],
  }],
  news: [{
    headline:     "Apple posts record revenue",
    summary:      "Strong Q4.",
    sentiment:    "positive",
    confidence:   0.92,
    published_at: "2026-01-01T00:00:00Z",
    source:       "Reuters",
  }],
  risks: [{
    risk:        "Regulatory risk",
    rationale:   "EU Digital Markets Act exposure.",
    severity:    "medium",
    sources:     ["news"],
    source_urls: [],
  }],
  tools_used: ["get_market_data", "search_news"],
  meta: {
    query_text:   "Apple stock overview",
    generated_at: "2026-01-01T10:00:00Z",
    latency_ms:   3200,
    token_usage:  { prompt: 120, completion: 60, total: 180 },
  },
};

describe("buildCsv", () => {
  it("includes the report title and query in the header block", () => {
    const csv = buildCsv("Apple Analysis", "Apple stock overview", REPORT);
    expect(csv).toContain("Apple Analysis");
    expect(csv).toContain("Apple stock overview");
  });

  it("lists the tools used in the header block", () => {
    const csv = buildCsv("Test", "test", REPORT);
    expect(csv).toContain("get_market_data");
    expect(csv).toContain("search_news");
  });

  it("includes the executive summary text", () => {
    const csv = buildCsv("Test", "test", REPORT);
    expect(csv).toContain("Test summary for Apple Inc.");
  });

  it("includes company ticker and name in the companies section", () => {
    const csv = buildCsv("Test", "test", REPORT);
    expect(csv).toContain("AAPL");
    expect(csv).toContain("Apple Inc.");
  });

  it("includes news headline in the news section", () => {
    const csv = buildCsv("Test", "test", REPORT);
    expect(csv).toContain("Apple posts record revenue");
  });

  it("includes sentiment value for news items", () => {
    const csv = buildCsv("Test", "test", REPORT);
    expect(csv).toContain("positive");
  });

  it("includes risk label and severity in the risks section", () => {
    const csv = buildCsv("Test", "test", REPORT);
    expect(csv).toContain("Regulatory risk");
    expect(csv).toContain("medium");
  });

  it("wraps cells containing commas in double-quotes", () => {
    const r: ResearchReport = {
      ...REPORT,
      risks: [{ ...REPORT.risks[0], risk: "Regulatory, antitrust risk" }],
    };
    const csv = buildCsv("Test", "test", r);
    expect(csv).toContain('"Regulatory, antitrust risk"');
  });

  it("escapes double-quotes inside cells by doubling them", () => {
    const r: ResearchReport = {
      ...REPORT,
      risks: [{ ...REPORT.risks[0], risk: 'Risk "quoted" label' }],
    };
    const csv = buildCsv("Test", "test", r);
    expect(csv).toContain('"Risk ""quoted"" label"');
  });

  it("wraps cells containing newlines in double-quotes", () => {
    const r: ResearchReport = {
      ...REPORT,
      risks: [{ ...REPORT.risks[0], rationale: "Line one\nLine two" }],
    };
    const csv = buildCsv("Test", "test", r);
    expect(csv).toContain('"Line one\nLine two"');
  });

  it("emits section headers as comment lines", () => {
    const csv = buildCsv("Test", "test", REPORT);
    expect(csv).toContain("## COMPANIES");
    expect(csv).toContain("## NEWS");
    expect(csv).toContain("## RISKS");
  });

  it("skips the companies section when there are no companies", () => {
    const r: ResearchReport = { ...REPORT, companies: [REPORT.companies[0]] };
    const csv = buildCsv("Test", "test", r);
    expect(csv).toContain("## COMPANIES");
  });

  it("skips the news section when news array is empty", () => {
    const r: ResearchReport = { ...REPORT, news: [] };
    const csv = buildCsv("Test", "test", r);
    expect(csv).not.toContain("## NEWS");
  });

  it("skips the risks section when risks array is empty", () => {
    const r: ResearchReport = { ...REPORT, risks: [] };
    const csv = buildCsv("Test", "test", r);
    expect(csv).not.toContain("## RISKS");
  });
});
