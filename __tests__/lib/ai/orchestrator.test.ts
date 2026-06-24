import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// All mocks hoisted before any imports so the orchestrator's deps resolve to mocks.
vi.mock("@/lib/ai/planner", () => ({ runPlanner: vi.fn() }));
vi.mock("@/lib/ai/executor", () => ({ runExecutor: vi.fn() }));
vi.mock("@/lib/ai/synthesizer", () => ({ runSynthesizer: vi.fn() }));
vi.mock("@/lib/llm", () => ({
  LLMError: class LLMError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "LLMError";
    }
  },
}));

import { runOrchestrator } from "@/lib/ai/orchestrator";
import { runPlanner }     from "@/lib/ai/planner";
import { runExecutor }    from "@/lib/ai/executor";
import { runSynthesizer } from "@/lib/ai/synthesizer";
import { LLMError }       from "@/lib/llm";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_PLAN = {
  calls: [{ tool: "search_news" as const, args: { query: "test", since_days: 30 } }],
};

const MOCK_EXEC = { durationMs: 50 };

const MOCK_SYNTH_OUTPUT = {
  summary:    "Executive summary.",
  companies:  [{ ticker: "TEST", name: "Test Corp", overview: "Overview.", metrics: { current_price: 100, price_change_1d: 1, market_cap: 1e9, pe_ratio: 20, forward_pe: 18, revenue_ttm: 5e8 }, sources: ["market-data"] }],
  news:       [],
  risks:      [{ risk: "Test risk", rationale: "Rationale.", severity: "low" as const, sources: ["news"] }],
  tools_used: ["search_news"],
};

const MOCK_SYNTH = {
  output:      MOCK_SYNTH_OUTPUT,
  tokenUsage:  { prompt: 100, completion: 50, total: 150 },
  wasRepaired: false,
};

const MOCK_SUPABASE = {} as never;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runOrchestrator", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns LLM_NOT_CONFIGURED when the planner throws about a missing API key", async () => {
    (runPlanner as Mock).mockRejectedValue(new LLMError("LLM_API_KEY not set - check .env.local"));

    const result = await runOrchestrator({ query: "test", supabase: MOCK_SUPABASE });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("LLM_NOT_CONFIGURED");
  });

  it("returns LLM_NOT_CONFIGURED when the planner mentions 'No model configured'", async () => {
    (runPlanner as Mock).mockRejectedValue(new LLMError("No model configured"));

    const result = await runOrchestrator({ query: "test", supabase: MOCK_SUPABASE });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("LLM_NOT_CONFIGURED");
  });

  it("returns PLAN_FAILED for non-LLM planner errors", async () => {
    (runPlanner as Mock).mockRejectedValue(new Error("network timeout"));

    const result = await runOrchestrator({ query: "test", supabase: MOCK_SUPABASE });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PLAN_FAILED");
  });

  it("returns NO_TOOLS_SELECTED when the planner returns an empty call list", async () => {
    (runPlanner as Mock).mockResolvedValue({ calls: [] });

    const result = await runOrchestrator({ query: "test", supabase: MOCK_SUPABASE });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NO_TOOLS_SELECTED");
  });

  it("returns SYNTHESIS_FAILED when the synthesizer throws", async () => {
    (runPlanner as Mock).mockResolvedValue(MOCK_PLAN);
    (runExecutor as Mock).mockResolvedValue(MOCK_EXEC);
    (runSynthesizer as Mock).mockRejectedValue(new Error("model overload"));

    const result = await runOrchestrator({ query: "test", supabase: MOCK_SUPABASE });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SYNTHESIS_FAILED");
  });

  it("returns ok:true and injects meta on a successful run", async () => {
    (runPlanner as Mock).mockResolvedValue(MOCK_PLAN);
    (runExecutor as Mock).mockResolvedValue(MOCK_EXEC);
    (runSynthesizer as Mock).mockResolvedValue(MOCK_SYNTH);

    const result = await runOrchestrator({ query: "What is NVDA?", supabase: MOCK_SUPABASE });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report.meta.query_text).toBe("What is NVDA?");
      expect(result.report.meta.latency_ms).toBeTypeOf("number");
      expect(result.report.meta.latency_ms).toBeGreaterThanOrEqual(0);
      expect(result.report.meta.token_usage.total).toBe(150);
      expect(result.report.summary).toBe(MOCK_SYNTH_OUTPUT.summary);
      expect(result.report.companies).toHaveLength(1);
    }
  });

  it("passes the planner's call list directly to the executor", async () => {
    (runPlanner as Mock).mockResolvedValue(MOCK_PLAN);
    (runExecutor as Mock).mockResolvedValue(MOCK_EXEC);
    (runSynthesizer as Mock).mockResolvedValue(MOCK_SYNTH);

    await runOrchestrator({ query: "test", supabase: MOCK_SUPABASE });

    expect(runExecutor).toHaveBeenCalledWith(MOCK_PLAN.calls, MOCK_SUPABASE);
  });

  it("skips the executor entirely when the planner returns no calls", async () => {
    (runPlanner as Mock).mockResolvedValue({ calls: [] });

    await runOrchestrator({ query: "test", supabase: MOCK_SUPABASE });

    expect(runExecutor).not.toHaveBeenCalled();
  });
});
