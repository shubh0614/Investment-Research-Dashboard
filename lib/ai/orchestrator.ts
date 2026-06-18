/**
 * Phase 4 — Orchestrator.
 *
 * Ties together the four-step agentic loop from the constitution (Part 6.2):
 *   1. Plan  — model selects which tools to call and with what arguments
 *   2. Execute — tool clients run in parallel; each fails safely
 *   3. Synthesize — model produces a Zod-valid ResearchReport
 *   4. Meta — timing and token data injected after synthesis
 *
 * This is the only entry point the API route calls. All other pieces are
 * internal to this module and the files it imports.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { runPlanner }     from "./planner";
import { runExecutor }    from "./executor";
import { runSynthesizer } from "./synthesizer";
import type { ResearchReport } from "./schemas";
import { LLMError } from "@/lib/llm";

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
    console.warn("[orchestrator] Planner selected zero tools — returning generic fallback");
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
    `[orchestrator] ─── DONE in ${totalMs}ms — ` +
    `tools=[${planResult.calls.map((c) => c.tool).join(",")}] ` +
    `companies=${report.companies.length} news=${report.news.length} risks=${report.risks.length} ` +
    `repaired=${synthResult.wasRepaired} ───`,
  );

  return { ok: true, report };
}
