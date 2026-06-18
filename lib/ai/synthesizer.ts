/**
 * Phase 4.4 — Synthesizer.
 *
 * Takes the aggregated tool results and asks the model to produce a
 * schema-valid ResearchReport. The validate-and-repair loop (D7) lives here.
 *
 * Design constraints (from constitution):
 * - Every company and risk MUST have a non-empty sources[] array.
 * - The model may only attribute claims to sources present in the tool output.
 * - Sentiment on each news item is classified by the model here (D9).
 * - meta (timing + tokens) is injected by the orchestrator after this returns.
 */

import type { ExecutionResults } from "./executor";
import type { SynthesisOutput }  from "./schemas";
import { SynthesisOutputSchema } from "./schemas";
import { generateStructuredOutput } from "@/lib/llm";
import type { MarketDataPayload } from "@/lib/tools/market";
import type { KBChunk } from "@/lib/tools/kb";

// ── Context builder ────────────────────────────────────────────────────────────

function buildContext(results: ExecutionResults): string {
  const sections: string[] = [];

  // Market data
  if (results.market) {
    const entries = Object.entries(results.market.results);
    if (entries.some(([, r]) => r.ok)) {
      sections.push("=== MARKET DATA ===");
      for (const [ticker, r] of entries) {
        if (!r.ok) {
          sections.push(`${ticker}: unavailable (${r.error})`);
          continue;
        }
        const d = r.data as MarketDataPayload;
        sections.push(
          `${ticker} (${d.name})\n` +
          `  Source: ${r.source}\n` +
          `  Current price: ${d.current_price ?? "N/A"}\n` +
          `  1-day change: ${d.change_pct ?? "N/A"}%\n` +
          `  Market cap: ${d.market_cap ?? "N/A"}\n` +
          `  P/E ratio: ${d.pe_ratio ?? "N/A"}\n` +
          `  Forward P/E: ${d.forward_pe ?? "N/A"}\n` +
          `  Revenue (TTM): ${d.revenue_ttm ?? "N/A"}\n` +
          `  Price series (last ${d.series.length} days): ${JSON.stringify(d.series.slice(-10))}`,
        );
      }
    }
  }

  // News
  if (results.news?.ok && results.news.result.ok) {
    const payload = results.news.result.data;
    sections.push(`\n=== NEWS (query: "${payload.query}") ===`);
    sections.push(`Source: ${results.news.result.source}`);
    for (const a of payload.articles) {
      sections.push(
        `- "${a.headline}" (${a.source}, ${a.published_at})\n` +
        `  ${a.summary || "(no description)"}\n` +
        `  URL: ${a.url}`,
      );
    }
  } else if (results.news && !results.news.ok) {
    sections.push(`\n=== NEWS ===\nunavailable: ${results.news.error}`);
  }

  // Knowledge base
  if (results.kb?.ok && results.kb.result.ok) {
    const chunks = results.kb.result.data as KBChunk[];
    sections.push(`\n=== KNOWLEDGE BASE (${results.kb.result.retrieval_method} retrieval) ===`);
    for (const chunk of chunks) {
      sections.push(
        `[${chunk.doc_title} / ${chunk.source_label}]\n${chunk.content}`,
      );
    }
  } else if (results.kb && !results.kb.ok) {
    sections.push(`\n=== KNOWLEDGE BASE ===\nunavailable: ${results.kb.error}`);
  }

  return sections.join("\n\n");
}

function toolsUsedList(results: ExecutionResults): string[] {
  const used: string[] = [];
  if (results.market) used.push("get_market_data");
  if (results.news)   used.push("search_news");
  if (results.kb)     used.push("search_knowledge_base");
  return used;
}

// ── Synthesis prompt ──────────────────────────────────────────────────────────

const SYNTHESIS_SYSTEM_PROMPT = `You are a senior financial research analyst producing a structured report.

You have been given raw tool outputs (market data, news, knowledge-base excerpts).
Your job is to synthesize these into a structured JSON report conforming to the schema.

STRICT RULES:
1. SOURCE ATTRIBUTION IS MANDATORY. Every company and risk entry MUST have a non-empty sources[] array.
   Use the exact source label from the tool output (e.g. "Alpha Vantage", "Reuters", "NVIDIA Q3 FY2025 Earnings Call Summary").
   NEVER invent a source. If you cannot attribute a claim, omit that claim.
2. SENTIMENT CLASSIFICATION: For every news item, classify it as "positive", "negative", or "neutral"
   based on its content and assign a confidence (0.0–1.0).
3. FACTUAL ACCURACY: Use only the data provided in the tool outputs. Do not add metrics or prices not present.
4. OPTIONAL FIELDS: Only include comparison[] if multiple companies are present with comparable metrics.
   Only include price_series[] if market data with a series was returned.
5. RISKS: Extract at minimum 2 risks from the data. Each risk must cite at least one source.
6. tools_used must list exactly the tools that provided data (not necessarily all tools called).`;

// ── Public API ─────────────────────────────────────────────────────────────────

export interface SynthesizerResult {
  output:      SynthesisOutput;
  durationMs:  number;
  wasRepaired: boolean;
  tokenUsage: {
    prompt:     number;
    completion: number;
    total:      number;
  };
}

export async function runSynthesizer(
  query:   string,
  results: ExecutionResults,
): Promise<SynthesizerResult> {
  const context    = buildContext(results);
  const toolsUsed  = toolsUsedList(results);

  console.log(`[synthesizer] Synthesizing report for query="${query}", context=${context.length} chars`);

  const userMessage =
    `Research query: "${query}"\n\n` +
    `Tools that ran: ${toolsUsed.join(", ") || "none"}\n\n` +
    `Tool outputs:\n${context}`;

  const { data, usage, durationMs, wasRepaired } = await generateStructuredOutput(
    SynthesisOutputSchema,
    [
      { role: "system", content: SYNTHESIS_SYSTEM_PROMPT },
      { role: "user",   content: userMessage },
    ],
  );

  console.log(
    `[synthesizer] Done in ${durationMs}ms, repaired=${wasRepaired}, ` +
    `companies=${data.companies.length}, news=${data.news.length}, risks=${data.risks.length}`,
  );

  return {
    output: data,
    durationMs,
    wasRepaired,
    tokenUsage: {
      prompt:     usage.inputTokens     ?? 0,
      completion: usage.outputTokens    ?? 0,
      total:      usage.totalTokens     ?? 0,
    },
  };
}
