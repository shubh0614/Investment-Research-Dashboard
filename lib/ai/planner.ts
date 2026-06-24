/**
 * Phase 4.2 - Planner.
 *
 * Asks the model which tools to call for a given research query.
 * Tools are defined WITHOUT execute functions - the model selects and
 * returns tool calls; the executor runs them. This is the "plan" step of
 * plan → execute → synthesize.
 *
 * Design choice (D6): tool selection is fully delegated to the model so that
 * a news-only query never hits the market API. The planner prompt contracts
 * the model to ONLY choose tools the query actually needs.
 */

import { tool } from "ai";
import type { LanguageModel } from "ai";
import { generateWithTools } from "@/lib/llm";
import {
  GetMarketDataArgsSchema,
  SearchNewsArgsSchema,
  SearchKnowledgeBaseArgsSchema,
  SearchWebArgsSchema,
  type GetMarketDataArgs,
  type SearchNewsArgs,
  type SearchKnowledgeBaseArgs,
  type SearchWebArgs,
} from "./schemas";

// ── Tool definitions (no execute - planner only) ───────────────────────────

const PLANNER_TOOLS = {
  get_market_data: tool({
    description:
      "Fetches stock prices, historical price series, and key financial metrics " +
      "(P/E ratio, market cap, revenue, EPS) for one or more companies. " +
      "Use when the query asks about stock performance, price history, valuations, or financial metrics. " +
      "Pass ALL tickers in one call - do not call this tool once per ticker.",
    inputSchema: GetMarketDataArgsSchema,
  }),

  search_news: tool({
    description:
      "Retrieves recent financial news articles for a company or topic. " +
      "Use when the query asks about recent events, news sentiment, developments, or current affairs. " +
      "Default since_days=30 unless the query specifies a different window.",
    inputSchema: SearchNewsArgsSchema,
  }),

  search_knowledge_base: tool({
    description:
      "Searches analyst reports, earnings-call transcripts, and SEC filing excerpts " +
      "stored in the knowledge base. " +
      "Use when the query asks about earnings details, competitive analysis, strategic risks, " +
      "company fundamentals, or any information typically found in filings rather than live data.",
    inputSchema: SearchKnowledgeBaseArgsSchema,
  }),

  search_web: tool({
    description:
      "Searches the live web for information about any company worldwide - including " +
      "Indian, European, Asian, and private companies not covered by market data APIs. " +
      "Use this for: international companies, private companies, any company with sparse news coverage, " +
      "annual reports, risk disclosures, company overviews, or when other tools may lack coverage. " +
      "Always call this alongside search_news for comprehensive coverage.",
    inputSchema: SearchWebArgsSchema,
  }),
} as const;

// ── Typed plan output ──────────────────────────────────────────────────────

export type MarketDataCall = { tool: "get_market_data";        args: GetMarketDataArgs };
export type NewsCall       = { tool: "search_news";            args: SearchNewsArgs };
export type KBCall         = { tool: "search_knowledge_base";  args: SearchKnowledgeBaseArgs };
export type WebCall        = { tool: "search_web";             args: SearchWebArgs };
export type ToolCall       = MarketDataCall | NewsCall | KBCall | WebCall;

export interface PlanResult {
  calls:      ToolCall[];
  durationMs: number;
}

const PLANNER_SYSTEM_PROMPT = `You are a financial research assistant planning data retrieval for an analyst query.

Your job is to select exactly the tools needed. Rules:
1. Whenever the query mentions a company with a recognizable stock ticker (e.g. NVDA, AAPL, MSFT, META, TSLA, AMD, INTC, GOOGL, AMZN, etc.) - ALWAYS call get_market_data. No exceptions. Metrics like MKT CAP, P/E, REV TTM come exclusively from get_market_data.
2. For ANY query that mentions a company name or ticker - ALWAYS call search_web + search_news + search_knowledge_base in addition to get_market_data (if a ticker is present). This applies to: stock performance, comparison, risks, strategy, outlook, analysis, overview, earnings, news - everything. Market data alone is never sufficient.
3. Pass ALL requested tickers in a single get_market_data call - never call it once per ticker.
4. Do not call the same tool twice.
5. Private companies, Indian companies, European companies, or any non-US company without a clear ticker: call search_web + search_news + search_knowledge_base. Skip get_market_data only when you are certain there is no ticker.
6. search_web is always required - include it for any company or topic query.
7. When in doubt, call get_market_data - missing market metrics in the report is worse than an extra API call.`;

// ── Public API ─────────────────────────────────────────────────────────────

export async function runPlanner(
  query: string,
  _model?: LanguageModel, // accepts injected model for testability; uses gateway default
): Promise<PlanResult> {
  console.log(`[planner] Planning tools for query="${query}"`);

  const result = await generateWithTools(
    [
      { role: "system",  content: PLANNER_SYSTEM_PROMPT },
      { role: "user",    content: query },
    ],
    PLANNER_TOOLS,
  );

  const calls: ToolCall[] = result.toolCalls
    .filter((tc) => tc.toolName in PLANNER_TOOLS)
    .map((tc) => {
      switch (tc.toolName as keyof typeof PLANNER_TOOLS) {
        case "get_market_data":
          return { tool: "get_market_data", args: tc.args as GetMarketDataArgs } satisfies MarketDataCall;
        case "search_news":
          return { tool: "search_news", args: tc.args as SearchNewsArgs } satisfies NewsCall;
        case "search_knowledge_base":
          return { tool: "search_knowledge_base", args: tc.args as SearchKnowledgeBaseArgs } satisfies KBCall;
        case "search_web":
          return { tool: "search_web", args: tc.args as SearchWebArgs } satisfies WebCall;
      }
    });

  console.log(
    `[planner] Selected tools: [${calls.map((c) => c.tool).join(", ")}] in ${result.durationMs}ms`,
  );

  return { calls, durationMs: result.durationMs };
}
