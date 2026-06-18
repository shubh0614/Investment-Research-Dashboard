/**
 * Phase 4.3 — Executor.
 *
 * Dispatches the planner's tool selections to the actual Phase 3 tool clients.
 * All selected tools run in parallel (Promise.allSettled). A tool failure
 * produces a typed "unavailable" result that degrades its section in the report
 * rather than failing the whole request.
 *
 * The executor is the boundary between the LLM layer and the data layer.
 * It does not call the model. It does not throw — every result is typed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getMarketData, type MarketDataResult }  from "@/lib/tools/market";
import { searchNews, type NewsResult }            from "@/lib/tools/news";
import { searchKnowledgeBase, type KBResult }     from "@/lib/tools/kb";
import type { ToolCall, MarketDataCall, NewsCall, KBCall } from "./planner";

// ── Typed execution results ───────────────────────────────────────────────────

export interface ExecutedMarketData {
  tool:    "get_market_data";
  args:    MarketDataCall["args"];
  results: Record<string, MarketDataResult>;
  ok:      boolean;
  error?:  string;
}

export interface ExecutedNews {
  tool:   "search_news";
  args:   NewsCall["args"];
  result: NewsResult;
  ok:     boolean;
  error?: string;
}

export interface ExecutedKB {
  tool:   "search_knowledge_base";
  args:   KBCall["args"];
  result: KBResult;
  ok:     boolean;
  error?: string;
}

export type ExecutedTool = ExecutedMarketData | ExecutedNews | ExecutedKB;

export interface ExecutionResults {
  market?:    ExecutedMarketData;
  news?:      ExecutedNews;
  kb?:        ExecutedKB;
  durationMs: number;
}

// ── Dispatch ───────────────────────────────────────────────────────────────────

async function dispatchMarketData(
  call: MarketDataCall,
  supabase: SupabaseClient,
): Promise<ExecutedMarketData> {
  try {
    const results = await getMarketData(call.args.tickers, call.args.range, supabase);
    const anyOk = Object.values(results).some((r) => r.ok);
    return { tool: "get_market_data", args: call.args, results, ok: anyOk };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[executor] get_market_data failed: ${error}`);
    return {
      tool: "get_market_data",
      args: call.args,
      results: Object.fromEntries(
        call.args.tickers.map((t) => [t, { ok: false as const, error, source: "market-data" }]),
      ),
      ok: false,
      error,
    };
  }
}

async function dispatchNews(
  call: NewsCall,
  supabase: SupabaseClient,
): Promise<ExecutedNews> {
  try {
    const result = await searchNews(call.args.query, call.args.since_days, supabase);
    return { tool: "search_news", args: call.args, result, ok: result.ok };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[executor] search_news failed: ${error}`);
    return {
      tool: "search_news",
      args: call.args,
      result: { ok: false as const, error, source: "news" },
      ok: false,
      error,
    };
  }
}

async function dispatchKB(
  call: KBCall,
  supabase: SupabaseClient,
): Promise<ExecutedKB> {
  try {
    const result = await searchKnowledgeBase(call.args.query, supabase, call.args.company);
    return { tool: "search_knowledge_base", args: call.args, result, ok: result.ok };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[executor] search_knowledge_base failed: ${error}`);
    return {
      tool: "search_knowledge_base",
      args: call.args,
      result: { ok: false as const, error },
      ok: false,
      error,
    };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Run all planned tools in parallel.
 * Returns a typed ExecutionResults — never throws.
 */
export async function runExecutor(
  calls:    ToolCall[],
  supabase: SupabaseClient,
): Promise<ExecutionResults> {
  if (!calls.length) {
    console.log("[executor] No tools selected by planner");
    return { durationMs: 0 };
  }

  console.log(`[executor] Running ${calls.length} tool(s) in parallel: ${calls.map((c) => c.tool).join(", ")}`);
  const start = Date.now();

  // All tools are independent — run them all in parallel.
  const settled = await Promise.allSettled(
    calls.map((call) => {
      switch (call.tool) {
        case "get_market_data":
          return dispatchMarketData(call, supabase);
        case "search_news":
          return dispatchNews(call, supabase);
        case "search_knowledge_base":
          return dispatchKB(call, supabase);
      }
    }),
  );

  const results: ExecutionResults = { durationMs: Date.now() - start };

  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      // Should not happen — dispatch functions never throw, but guard anyway.
      console.error("[executor] Unexpected settled rejection:", outcome.reason);
      continue;
    }
    const r = outcome.value;
    switch (r.tool) {
      case "get_market_data":     results.market = r; break;
      case "search_news":         results.news   = r; break;
      case "search_knowledge_base": results.kb   = r; break;
    }
  }

  console.log(
    `[executor] Done in ${results.durationMs}ms — market:${results.market?.ok??"-"} news:${results.news?.ok??"-"} kb:${results.kb?.ok??"-"}`,
  );

  return results;
}
