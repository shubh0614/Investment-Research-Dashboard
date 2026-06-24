/**
 * Phase 4 - Orchestrator.
 *
 * Ties together the four-step agentic loop from the constitution (Part 6.2):
 *   1. Plan  - model selects which tools to call and with what arguments
 *   2. Execute - tool clients run in parallel; each fails safely
 *   3. Synthesize - model produces a Zod-valid ResearchReport
 *   4. Meta - timing and token data injected after synthesis
 *
 * This is the only entry point the API route calls. All other pieces are
 * internal to this module and the files it imports.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { runPlanner }     from "./planner";
import { runExecutor }    from "./executor";
import { runSynthesizer } from "./synthesizer";
import type { ResearchReport, SynthesisOutput } from "./schemas";
import type { ExecutionResults } from "./executor";
import { LLMError } from "@/lib/llm";
import type { MarketDataPayload } from "@/lib/tools/market";

export type OrchestratorResult =
  | { ok: true;  report: ResearchReport }
  | { ok: false; error: string; code: OrchestratorErrorCode };

export type OrchestratorErrorCode =
  | "LLM_NOT_CONFIGURED"
  | "PLAN_FAILED"
  | "NO_TOOLS_SELECTED"
  | "SYNTHESIS_FAILED"
  | "UNKNOWN";

export interface OrchestratorOptions {
  query:    string;
  supabase: SupabaseClient;
}

export async function runOrchestrator(
  options: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const { query, supabase } = options;
  const start = Date.now();

  console.log(`\n[orchestrator] ─── START query="${query}" ───`);

  // ── 1. Plan ────────────────────────────────────────────────────────────────
  let planResult;
  try {
    planResult = await runPlanner(query);
  } catch (err) {
    const msg = err instanceof LLMError ? err.message : String(err);
    if (msg.includes("LLM_API_KEY") || msg.includes("No model configured")) {
      return { ok: false, error: "LLM is not configured. Set LLM_API_KEY in .env.local.", code: "LLM_NOT_CONFIGURED" };
    }
    console.error("[orchestrator] Planning failed:", msg);
    return { ok: false, error: `Planning failed: ${msg}`, code: "PLAN_FAILED" };
  }

  if (!planResult.calls.length) {
    console.warn("[orchestrator] Planner selected zero tools - returning generic fallback");
    // A query the model couldn't map to tools is unusual; degrade gracefully.
    return { ok: false, error: "Could not determine which data sources to query for this request.", code: "NO_TOOLS_SELECTED" };
  }

  // ── 2. Execute ─────────────────────────────────────────────────────────────
  const execResults = await runExecutor(planResult.calls, supabase);

  // ── 3. Synthesize ──────────────────────────────────────────────────────────
  let synthResult;
  try {
    synthResult = await runSynthesizer(query, execResults);
  } catch (err) {
    const msg = err instanceof LLMError ? err.message : String(err);
    console.error("[orchestrator] Synthesis failed:", msg);
    return { ok: false, error: `Report synthesis failed: ${msg}`, code: "SYNTHESIS_FAILED" };
  }

  // ── 3b. Inject market data directly into company metrics ──────────────────
  // The LLM is unreliable at copying numeric values from context into JSON.
  // We do it deterministically here instead.
  injectMarketMetrics(synthResult.output, execResults);

  // ── 4. Inject meta ─────────────────────────────────────────────────────────
  const totalMs = Date.now() - start;
  const report: ResearchReport = {
    ...synthResult.output,
    meta: {
      query_text:   query,
      generated_at: new Date().toISOString(),
      latency_ms:   totalMs,
      token_usage:  synthResult.tokenUsage,
    },
  };

  console.log(
    `[orchestrator] ─── DONE in ${totalMs}ms - ` +
    `tools=[${planResult.calls.map((c) => c.tool).join(",")}] ` +
    `companies=${report.companies.length} news=${report.news.length} risks=${report.risks.length} ` +
    `repaired=${synthResult.wasRepaired} ───`,
  );

  return { ok: true, report };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function injectMarketMetrics(output: SynthesisOutput, execResults: ExecutionResults): void {
  if (!execResults.market) return;
  const marketResults = execResults.market.results;

  // Build a case-insensitive ticker lookup
  const byTicker = new Map<string, MarketDataPayload>();
  for (const [ticker, result] of Object.entries(marketResults)) {
    if (result.ok) byTicker.set(ticker.toUpperCase(), result.data as MarketDataPayload);
  }
  if (!byTicker.size) return;

  for (const company of output.companies) {
    const data = byTicker.get(company.ticker.toUpperCase());
    if (!data) continue;

    // Overwrite with authoritative values - only replace null/undefined, never overwrite valid data
    company.metrics.current_price   ??= data.current_price   ?? null;
    company.metrics.price_change_1d ??= data.change_pct      ?? null;
    company.metrics.market_cap      ??= data.market_cap      ?? null;
    company.metrics.pe_ratio        ??= data.pe_ratio        ?? null;
    company.metrics.forward_pe      ??= data.forward_pe      ?? null;
    company.metrics.revenue_ttm     ??= data.revenue_ttm     ?? null;

    // Always hard-overwrite price with live value (most critical field)
    if (data.current_price != null) company.metrics.current_price = data.current_price;
    if (data.change_pct    != null) company.metrics.price_change_1d = data.change_pct;

    if (!company.sources.includes("Finnhub")) {
      company.sources.push("Finnhub");
    }

    console.log(
      `[orchestrator] Injected market metrics for ${company.ticker}: ` +
      `price=${data.current_price}, cap=${data.market_cap}, pe=${data.pe_ratio}`,
    );
  }

  // Inject price_series for ALL tickers if LLM omitted it (needed for comparison charts)
  if (!output.price_series?.length) {
    const allPoints: SynthesisOutput["price_series"] = [];
    for (const [ticker, result] of Object.entries(marketResults)) {
      if (!result.ok) continue;
      const d = result.data as MarketDataPayload;
      if (d.series?.length) {
        for (const p of d.series) {
          allPoints!.push({ date: p.date, close: p.close, ticker: ticker.toUpperCase() });
        }
        console.log(`[orchestrator] Injected price_series for ${ticker}: ${d.series.length} points`);
      }
    }
    if (allPoints!.length) output.price_series = allPoints;
  }
}
