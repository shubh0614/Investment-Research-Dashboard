/**
 * Phase 4.4 - Synthesizer.
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

// ── Helpers ────────────────────────────────────────────────────────────────────

// Groq's API rejects messages that contain non-ASCII characters outside ISO-8859-1.
// Replace common Unicode punctuation with ASCII equivalents then strip anything left.
function sanitize(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x00-\x7F]/g, " ");
}

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
          `  Price series (last ${d.series.length} days - for price_series field use only date+close):\n` +
          d.series.slice(-10).map((p) => `    { "date": "${p.date}", "close": ${p.close} }`).join("\n"),
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
        `- "${sanitize(a.headline)}" (${a.source}, ${a.published_at})\n` +
        `  ${sanitize(a.summary || "(no description)")}\n` +
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
        `[${chunk.doc_title} / ${chunk.source_label}]\n${sanitize(chunk.content)}`,
      );
    }
  } else if (results.kb && !results.kb.ok) {
    sections.push(`\n=== KNOWLEDGE BASE ===\nunavailable: ${results.kb.error}`);
  }

  // Web search
  if (results.web?.ok && results.web.result.ok) {
    const payload = results.web.result.data;
    sections.push(`\n=== WEB SEARCH (query: "${payload.query}") ===`);
    sections.push(`Source: ${results.web.result.source}`);
    for (const r of payload.results) {
      sections.push(
        `- "${sanitize(r.title)}" (${r.source}${r.published_date ? ", " + r.published_date : ""})\n` +
        `  ${sanitize(r.content.slice(0, 400))}\n` +
        `  URL: ${r.url}`,
      );
    }
  } else if (results.web && !results.web.ok) {
    sections.push(`\n=== WEB SEARCH ===\nunavailable: ${results.web.error}`);
  }

  return sections.join("\n\n");
}

function toolsUsedList(results: ExecutionResults): string[] {
  const used: string[] = [];
  if (results.market) used.push("get_market_data");
  if (results.news)   used.push("search_news");
  if (results.kb)     used.push("search_knowledge_base");
  if (results.web)    used.push("search_web");
  return used;
}

// ── Synthesis prompt ──────────────────────────────────────────────────────────

const SYNTHESIS_SYSTEM_PROMPT = `You are a senior financial research analyst producing a structured report.

You have been given raw tool outputs (market data, news, knowledge-base excerpts).
Your job is to synthesize these into a structured JSON report conforming to the schema.

STRICT RULES:
1. SOURCE ATTRIBUTION IS MANDATORY. Every company and risk entry MUST have a non-empty sources[] array.
   Use the exact source label from the tool output (e.g. "Finnhub", "Reuters", "NVIDIA Q3 FY2025 Earnings Call Summary").
   NEVER invent a source. If you cannot attribute a claim, omit that claim.
2. MARKET DATA → METRICS — THIS IS THE HIGHEST PRIORITY RULE. Read it carefully and follow it exactly.
   For EVERY company you output, do the following BEFORE writing anything else for that company:
   a) Find the ticker symbol for that company (e.g. NVDA, AZN, AAPL).
   b) Search the "=== MARKET DATA ===" section for a block starting with that ticker.
   c) If found, copy these values DIRECTLY into the company's metrics object — do NOT leave them null:
      - "Current price: X"   → metrics.current_price = X  (also add "Finnhub" to sources[])
      - "1-day change: X%"   → metrics.price_change_1d = X
      - "Market cap: X"      → metrics.market_cap = X
      - "P/E ratio: X"       → metrics.pe_ratio = X
      - "Forward P/E: X"     → metrics.forward_pe = X
      - "Revenue (TTM): X"   → metrics.revenue_ttm = X
   d) Only set a metric to null if its value is literally "N/A" in the market data block.
   e) FALLBACK: If a metric is "N/A" in market data, scan WEB SEARCH and NEWS for that figure
      (e.g. "market cap of $200B", "P/E of 25") and extract the number.
   IMPORTANT: Knowledge base and web sources describe the company overview — they do NOT replace market
   data metrics. Always use the market data block for numeric metrics when it is present.
3. SENTIMENT CLASSIFICATION: For every news item, classify it as "positive", "negative", or "neutral"
   based on its content and assign a confidence (0.0–1.0).
4. FACTUAL ACCURACY: Use only the data provided in the tool outputs. Do not add metrics or prices not present.
5. CONDITIONAL FIELDS:
   - price_series[] MUST be populated whenever "Price series" data appears in the tool outputs above.
     Extract every data point as { "date": "YYYY-MM-DD", "close": <number>, "ticker": "<SYMBOL>" }. Do NOT omit this field when series data is present.
   - comparison[] SHOULD only be included when two or more companies have comparable metrics in the data.
6. RISKS: Extract at minimum 2 risks from the data. Each risk must cite at least one source.
   For each risk, populate source_urls[] with the article URLs from news/web results that support the risk.
   Match source_urls[i] to sources[i] - if a source has no URL, use an empty string "".
7. tools_used must list exactly the tools that provided data (not necessarily all tools called).`;

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

const NO_DATA_THRESHOLD = 400; // chars - below this context is too thin to synthesize reliably

export async function runSynthesizer(
  query:   string,
  results: ExecutionResults,
): Promise<SynthesizerResult> {
  const context    = buildContext(results);
  const toolsUsed  = toolsUsedList(results);

  console.log(`[synthesizer] Synthesizing report for query="${query}", context=${context.length} chars`);

  // When all tools returned empty results, skip the LLM call entirely and return
  // a structured "no data" response rather than letting the LLM fail validation.
  if (context.length < NO_DATA_THRESHOLD) {
    console.log("[synthesizer] No usable data retrieved - returning no-data fallback");
    const t = Date.now();
    return {
      output: {
        summary: `No data was found for the query "${query}". The knowledge base is empty, news returned no articles, and the web search found nothing relevant. Try rephrasing with the full company name, or check that your API keys (NewsAPI, Tavily) are configured.`,
        companies:    [],
        news:         [],
        risks:        [],
        tools_used:   toolsUsed,
        price_series: undefined,
        comparison:   undefined,
      },
      durationMs:  Date.now() - t,
      wasRepaired: false,
      tokenUsage:  { prompt: 0, completion: 0, total: 0 },
    };
  }

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
