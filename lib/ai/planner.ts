/**
 * Phase 4.2 — Planner.
 *
 * Asks the model which tools to call for a given research query.
 * Tools are defined WITHOUT execute functions — the model selects and
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
  type GetMarketDataArgs,
  type SearchNewsArgs,
  type SearchKnowledgeBaseArgs,
} from "./schemas";

// ── Tool definitions (no execute — planner only) ───────────────────────────

const PLANNER_TOOLS = {
  get_market_data: tool({
    description:
      "Fetches stock prices, historical price series, and key financial metrics " +
      "(P/E ratio, market cap, revenue, EPS) for one or more companies. " +
      "Use when the query asks about stock performance, price history, valuations, or financial metrics. " +
      "Pass ALL tickers in one call — do not call this tool once per ticker.",
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
} as const;

// ── Typed plan output ──────────────────────────────────────────────────────

export type MarketDataCall = { tool: "get_market_data"; args: GetMarketDataArgs };
export type NewsCall       = { tool: "search_news";       args: SearchNewsArgs };
export type KBCall         = { tool: "search_knowledge_base"; args: SearchKnowledgeBaseArgs };
export type ToolCall       = MarketDataCall | NewsCall | KBCall;

export interface PlanResult {
  calls:      ToolCall[];
  durationMs: number;
}

const PLANNER_SYSTEM_PROMPT = `You are a financial research assistant planning data retrieval for an analyst query.

Your job is to select exactly the tools needed — no more. Rules:
1. A news-only question ("any recent news about...") must NOT call get_market_data.
2. A price/metrics question ("how is the stock performing") must NOT call search_news unless the query also asks for news.
3. Pass ALL requested tickers in a single get_market_data call.
4. Call search_knowledge_base when the query mentions earnings, filings, risks, strategy, or fundamentals not in live market data.
5. You may call all three tools if the query needs them all.
6. Do not call the same tool twice.`;

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
      }
    });

  console.log(
    `[planner] Selected tools: [${calls.map((c) => c.tool).join(", ")}] in ${result.durationMs}ms`,
  );

  return { calls, durationMs: result.durationMs };
}
