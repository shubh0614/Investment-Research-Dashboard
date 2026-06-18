import { describe, it, expect } from "vitest";
import {
  NewsItemSchema,
  CompanyOverviewSchema,
  RiskItemSchema,
  GetMarketDataArgsSchema,
  SearchNewsArgsSchema,
  SearchKnowledgeBaseArgsSchema,
  SynthesisOutputSchema,
} from "@/lib/ai/schemas";

// ── Factories ─────────────────────────────────────────────────────────────────

function newsItem(overrides: Record<string, unknown> = {}) {
  return {
    headline:     "Apple posts record earnings",
    summary:      "Strong Q4 results.",
    sentiment:    "positive" as const,
    confidence:   0.9,
    published_at: "2026-01-01T00:00:00Z",
    source:       "Reuters",
    ...overrides,
  };
}

function company(overrides: Record<string, unknown> = {}) {
  return {
    ticker:   "AAPL",
    name:     "Apple Inc.",
    overview: "Consumer electronics and software.",
    metrics:  { current_price: 175, price_change_1d: 0.5, market_cap: 2.8e12, pe_ratio: 29, forward_pe: 26, revenue_ttm: 4.1e11 },
    sources:  ["market-data"],
    ...overrides,
  };
}

function risk(overrides: Record<string, unknown> = {}) {
  return {
    risk:      "Regulatory risk",
    rationale: "Subject to EU Digital Markets Act enforcement.",
    severity:  "medium" as const,
    sources:   ["news"],
    ...overrides,
  };
}

// ── NewsItemSchema ─────────────────────────────────────────────────────────────

describe("NewsItemSchema", () => {
  it("accepts a valid news item", () => {
    expect(() => NewsItemSchema.parse(newsItem())).not.toThrow();
  });

  it("rejects invalid sentiment value", () => {
    expect(NewsItemSchema.safeParse(newsItem({ sentiment: "bullish" })).success).toBe(false);
  });

  it("rejects confidence below 0", () => {
    expect(NewsItemSchema.safeParse(newsItem({ confidence: -0.1 })).success).toBe(false);
  });

  it("rejects confidence above 1", () => {
    expect(NewsItemSchema.safeParse(newsItem({ confidence: 1.01 })).success).toBe(false);
  });

  it("accepts confidence at exact boundary values 0 and 1", () => {
    expect(NewsItemSchema.safeParse(newsItem({ confidence: 0 })).success).toBe(true);
    expect(NewsItemSchema.safeParse(newsItem({ confidence: 1 })).success).toBe(true);
  });

  it("rejects missing headline", () => {
    const { headline: _h, ...rest } = newsItem();
    expect(NewsItemSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts optional url being null", () => {
    expect(NewsItemSchema.safeParse(newsItem({ url: null })).success).toBe(true);
  });
});

// ── CompanyOverviewSchema ──────────────────────────────────────────────────────

describe("CompanyOverviewSchema", () => {
  it("accepts a valid company", () => {
    expect(() => CompanyOverviewSchema.parse(company())).not.toThrow();
  });

  it("rejects empty sources array — every company card must cite a source", () => {
    expect(CompanyOverviewSchema.safeParse(company({ sources: [] })).success).toBe(false);
  });

  it("accepts nullable metric values", () => {
    expect(
      CompanyOverviewSchema.safeParse(
        company({ metrics: { current_price: null, price_change_1d: null, market_cap: null, pe_ratio: null, forward_pe: null, revenue_ttm: null } }),
      ).success,
    ).toBe(true);
  });
});

// ── RiskItemSchema ─────────────────────────────────────────────────────────────

describe("RiskItemSchema", () => {
  it("accepts a valid risk", () => {
    expect(() => RiskItemSchema.parse(risk())).not.toThrow();
  });

  it("rejects invalid severity", () => {
    expect(RiskItemSchema.safeParse(risk({ severity: "critical" })).success).toBe(false);
  });

  it("rejects empty sources array — every risk must be attributable", () => {
    expect(RiskItemSchema.safeParse(risk({ sources: [] })).success).toBe(false);
  });

  it("accepts all three valid severity values", () => {
    for (const s of ["high", "medium", "low"]) {
      expect(RiskItemSchema.safeParse(risk({ severity: s })).success).toBe(true);
    }
  });
});

// ── GetMarketDataArgsSchema ────────────────────────────────────────────────────

describe("GetMarketDataArgsSchema", () => {
  it("normalizes ticker symbols to uppercase", () => {
    const result = GetMarketDataArgsSchema.parse({ tickers: ["aapl", "msft"] });
    expect(result.tickers).toEqual(["AAPL", "MSFT"]);
  });

  it("rejects more than 5 tickers", () => {
    expect(GetMarketDataArgsSchema.safeParse({ tickers: ["A", "B", "C", "D", "E", "F"] }).success).toBe(false);
  });

  it("rejects empty ticker array", () => {
    expect(GetMarketDataArgsSchema.safeParse({ tickers: [] }).success).toBe(false);
  });

  it("rejects invalid range", () => {
    expect(GetMarketDataArgsSchema.safeParse({ tickers: ["AAPL"], range: "2y" }).success).toBe(false);
  });

  it("defaults range to 90d", () => {
    expect(GetMarketDataArgsSchema.parse({ tickers: ["AAPL"] }).range).toBe("90d");
  });
});

// ── SearchNewsArgsSchema ───────────────────────────────────────────────────────

describe("SearchNewsArgsSchema", () => {
  it("rejects since_days of 0", () => {
    expect(SearchNewsArgsSchema.safeParse({ query: "test", since_days: 0 }).success).toBe(false);
  });

  it("rejects since_days greater than 90", () => {
    expect(SearchNewsArgsSchema.safeParse({ query: "test", since_days: 91 }).success).toBe(false);
  });

  it("defaults since_days to 30", () => {
    expect(SearchNewsArgsSchema.parse({ query: "test" }).since_days).toBe(30);
  });

  it("rejects empty query string", () => {
    expect(SearchNewsArgsSchema.safeParse({ query: "" }).success).toBe(false);
  });
});

// ── SearchKnowledgeBaseArgsSchema ─────────────────────────────────────────────

describe("SearchKnowledgeBaseArgsSchema", () => {
  it("accepts a query without a company filter", () => {
    expect(SearchKnowledgeBaseArgsSchema.safeParse({ query: "earnings growth" }).success).toBe(true);
  });

  it("accepts a query with an optional company filter", () => {
    expect(SearchKnowledgeBaseArgsSchema.safeParse({ query: "revenue", company: "AAPL" }).success).toBe(true);
  });
});

// ── SynthesisOutputSchema — min-1 invariants ──────────────────────────────────

describe("SynthesisOutputSchema", () => {
  const base = {
    summary:    "Summary.",
    companies:  [company()],
    news:       [],
    risks:      [risk()],
    tools_used: ["search_news"],
  };

  it("rejects empty companies array — synthesis must have at least one company", () => {
    expect(SynthesisOutputSchema.safeParse({ ...base, companies: [] }).success).toBe(false);
  });

  it("rejects empty risks array — synthesis must have at least one risk", () => {
    expect(SynthesisOutputSchema.safeParse({ ...base, risks: [] }).success).toBe(false);
  });

  it("rejects empty tools_used — synthesis must name the tools it called", () => {
    expect(SynthesisOutputSchema.safeParse({ ...base, tools_used: [] }).success).toBe(false);
  });

  it("accepts a valid synthesis output with empty news", () => {
    expect(() => SynthesisOutputSchema.parse(base)).not.toThrow();
  });
});
