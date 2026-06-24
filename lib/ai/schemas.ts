/**
 * Central Zod schemas for the AI layer.
 *
 * Single source of truth for the ResearchReport shape.
 * Used by: orchestrator (synthesis), API route (response), Phase 6 UI (rendering).
 * Having one schema that spans all three layers is the core value of D1 (one type system).
 */

import { z } from "zod";

// ── Tool argument schemas ─────────────────────────────────────────────────────
// These match the function-calling definitions the planner sends to the model.

export const GetMarketDataArgsSchema = z.object({
  tickers: z
    .array(z.string().min(1).toUpperCase())
    .min(1)
    .max(5)
    .describe("Stock ticker symbols, e.g. ['NVDA', 'AMD']"),
  range: z
    .enum(["7d", "30d", "90d", "1y"])
    .default("90d")
    .describe("Historical price range"),
});

export const SearchNewsArgsSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Company name or topic to search for news about"),
  since_days: z
    .number()
    .int()
    .min(1)
    .max(90)
    .default(30)
    .describe("Fetch news from the last N days"),
});

export const SearchKnowledgeBaseArgsSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Natural-language question about filings, earnings, or fundamentals"),
  company: z
    .string()
    .optional()
    .describe("Optional ticker to narrow search to one company's documents"),
});

export const SearchWebArgsSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Search query - company name + topic, e.g. 'Zomato risks 2026' or 'HDFC Bank earnings'"),
});

export type GetMarketDataArgs       = z.infer<typeof GetMarketDataArgsSchema>;
export type SearchNewsArgs          = z.infer<typeof SearchNewsArgsSchema>;
export type SearchKnowledgeBaseArgs = z.infer<typeof SearchKnowledgeBaseArgsSchema>;
export type SearchWebArgs           = z.infer<typeof SearchWebArgsSchema>;

// ── ResearchReport component schemas ─────────────────────────────────────────

export const CompanyMetricsSchema = z.object({
  current_price:   z.number().nullable().optional(),
  price_change_1d: z.number().nullable().optional().describe("1-day percentage change"),
  market_cap:      z.number().nullable().optional(),
  pe_ratio:        z.number().nullable().optional(),
  forward_pe:      z.number().nullable().optional(),
  revenue_ttm:     z.number().nullable().optional().describe("Trailing-twelve-month revenue in USD"),
});

export const CompanyOverviewSchema = z.object({
  ticker:   z.string().default(""),
  name:     z.string().default(""),
  overview: z.string().default("").describe("2–3 sentence company overview based on retrieved data"),
  metrics:  CompanyMetricsSchema.optional().default({}),
  sources:  z.array(z.string()).min(1).describe("Data source labels for this company"),
});

export const NewsItemSchema = z.object({
  headline:     z.string(),
  summary:      z.string().describe("1–2 sentence summary of the article"),
  sentiment:    z.enum(["positive", "negative", "neutral"]),
  confidence:   z.number().min(0).max(1).describe("LLM confidence in sentiment classification"),
  published_at: z.string().describe("ISO-8601 publish date"),
  source:       z.string().describe("Publication or outlet name"),
  url:          z.string().nullable().optional(),
});

export const RiskItemSchema = z.object({
  risk:        z.string().describe("Short label for the risk"),
  rationale:   z.string().describe("1–2 sentence explanation grounded in the data"),
  severity:    z.enum(["high", "medium", "low"]),
  sources:     z.array(z.string()).min(1),
  source_urls: z.array(z.string()).optional().default([]).describe("Article URLs backing each source, parallel to sources[]"),
});

export const PricePointSchema = z.object({
  date:   z.string().describe("YYYY-MM-DD"),
  close:  z.number(),
  ticker: z.string().default(""),
});

export const ComparisonRowSchema = z.object({
  metric:  z.string().describe("Metric name, e.g. 'Revenue (TTM)'"),
  values:  z
    .record(z.string(), z.union([z.string(), z.number()]).nullable())
    .describe("Map of ticker → value for this metric"),
  sources: z.array(z.string()),
});

export const ReportMetaSchema = z.object({
  query_text:    z.string(),
  generated_at:  z.string().describe("ISO-8601 timestamp"),
  latency_ms:    z.number(),
  token_usage: z.object({
    prompt:     z.number(),
    completion: z.number(),
    total:      z.number(),
  }),
});

// ── SynthesisOutputSchema - what the LLM generates ───────────────────────────
// meta is injected by the orchestrator after the LLM call (it contains timing
// and token data that only exist after the call returns).

export const SynthesisOutputSchema = z.object({
  summary:      z.string().min(1).describe("2–4 sentence executive summary of the research"),
  companies:    z.array(CompanyOverviewSchema).min(1),
  comparison:   z.array(ComparisonRowSchema).optional().describe("Only present for multi-company queries"),
  price_series: z.array(PricePointSchema).optional().describe("Only present when market data was fetched"),
  news:         z.array(NewsItemSchema),
  risks:        z.array(RiskItemSchema).min(1),
  tools_used:   z.array(z.string()).min(1).describe("Names of tools that were called"),
});

// ── ResearchReport - the full contract ───────────────────────────────────────
// This is what the API route returns and what Phase 6 renders.

export const ResearchReportSchema = SynthesisOutputSchema.extend({
  meta: ReportMetaSchema,
});

export type CompanyMetrics    = z.infer<typeof CompanyMetricsSchema>;
export type CompanyOverview   = z.infer<typeof CompanyOverviewSchema>;
export type NewsItem          = z.infer<typeof NewsItemSchema>;
export type RiskItem          = z.infer<typeof RiskItemSchema>;
export type PricePoint        = z.infer<typeof PricePointSchema>;
export type ComparisonRow     = z.infer<typeof ComparisonRowSchema>;
export type ReportMeta        = z.infer<typeof ReportMetaSchema>;
export type SynthesisOutput   = z.infer<typeof SynthesisOutputSchema>;
export type ResearchReport    = z.infer<typeof ResearchReportSchema>;
