/**
 * LLM gateway - Phase 4.1.
 *
 * Wraps AI SDK v6's generateObject and generateText with:
 * - Timeout via AbortController (30s default)
 * - Structured token-usage logging on every call
 * - Throws LLMError on timeout / provider error so callers handle one type
 *
 * Groq compatibility note: Groq's OpenAI-compatible API supports json_object mode
 * but not the newer json_schema (structured outputs) format. AI SDK v6 uses
 * json_schema when a schema is passed to generateObject. We work around this by
 * using output:"no-schema" (→ json_object) and validating the result ourselves.
 */

import { generateObject, generateText } from "ai";
import type { LanguageModel, LanguageModelUsage, ModelMessage, SystemModelMessage, ToolSet } from "ai";
import { z } from "zod";
import { createModel } from "./providers";
import { config } from "@/lib/config";

export { createModel };

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

// Singleton model - instantiated once at first call, not at module load,
// so the config is already populated and the app doesn't fail on import.
let _model: LanguageModel | null = null;

export function getModel(): LanguageModel {
  if (!_model) _model = createModel();
  return _model;
}

const TIMEOUT_MS = 30_000;

function makeAbortSignal(ms = TIMEOUT_MS): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`LLM timed out after ${ms}ms`)), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/** Split system messages out of a ModelMessage array - AI SDK v6 takes system separately. */
function splitMessages(messages: ModelMessage[]): {
  system:   string | undefined;
  rest:     ModelMessage[];
} {
  const sysMsgs = messages.filter((m): m is SystemModelMessage => m.role === "system");
  const rest    = messages.filter((m) => m.role !== "system");
  const system  = sysMsgs.length > 0
    ? sysMsgs.map((m) => m.content as string).join("\n\n")
    : undefined;
  return { system, rest };
}

export interface StructuredResult<T> {
  data:       T;
  usage:      LanguageModelUsage;
  durationMs: number;
  wasRepaired: boolean;
}

// Maps common LLM field-name variations to the canonical schema names.
function normalizeLLMOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;

  // Normalize company items
  if (Array.isArray(obj.companies)) {
    obj.companies = obj.companies.map((item: unknown) => {
      if (!item || typeof item !== "object") return item;
      const c = { ...(item as Record<string, unknown>) };
      if (c.symbol      && !c.ticker)   c.ticker   = c.symbol;
      if (c.code        && !c.ticker)   c.ticker   = c.code;
      if (c.description && !c.overview) c.overview = c.description;
      if (c.about       && !c.overview) c.overview = c.about;
      if (c.summary     && !c.overview) c.overview = c.summary;
      if (!c.ticker && c.name) c.ticker = String(c.name).toUpperCase().replace(/\s+/g, "").slice(0, 6);
      // Normalize metrics sub-object
      const metricsRaw = c.metrics ?? c.financials ?? c.data ?? c.financial_data ?? {};
      const m = typeof metricsRaw === "object" && metricsRaw !== null
        ? metricsRaw as Record<string, unknown>
        : {};
      c.metrics = {
        current_price:   m.current_price   ?? m.price        ?? m.currentPrice   ?? null,
        price_change_1d: m.price_change_1d ?? m.change       ?? m.changePercent  ?? null,
        market_cap:      m.market_cap      ?? m.marketCap    ?? m.market_capitalization ?? null,
        pe_ratio:        m.pe_ratio        ?? m.pe           ?? m.peRatio        ?? null,
        forward_pe:      m.forward_pe      ?? m.forwardPE    ?? m.forward_pe_ratio ?? null,
        revenue_ttm:     m.revenue_ttm     ?? m.revenue      ?? m.revenues       ?? null,
      };
      if (!Array.isArray(c.sources)) c.sources = [];
      return c;
    });
  }

  // Normalize price_series items - infer ticker from companies if missing
  if (Array.isArray(obj.price_series)) {
    const firstTicker = Array.isArray(obj.companies) && obj.companies.length > 0
      ? (obj.companies[0] as Record<string, unknown>).ticker as string ?? ""
      : "";
    obj.price_series = obj.price_series.map((item: unknown) => {
      if (!item || typeof item !== "object") return item;
      const p = { ...(item as Record<string, unknown>) };
      if (!p.ticker) p.ticker = firstTicker;
      if (typeof p.close !== "number") p.close = parseFloat(String(p.close ?? p.price ?? p.value ?? 0));
      return p;
    });
  }

  // Normalize news items
  if (Array.isArray(obj.news)) {
    obj.news = obj.news.map((item: unknown) => {
      if (!item || typeof item !== "object") return item;
      const n = { ...(item as Record<string, unknown>) };
      if (n.title      && !n.headline)      n.headline     = n.title;
      if (n.description && !n.summary)      n.summary      = n.description;
      if (n.body       && !n.summary)       n.summary      = n.body;
      if (n.date       && !n.published_at)  n.published_at = n.date;
      if (n.published  && !n.published_at)  n.published_at = n.published;
      if (n.publishedAt && !n.published_at) n.published_at = n.publishedAt;
      if (n.url === undefined) n.url = null;
      return n;
    });
  }

  // Normalize risk items
  if (Array.isArray(obj.risks)) {
    obj.risks = obj.risks.map((item: unknown) => {
      if (!item || typeof item !== "object") return item;
      const r = { ...(item as Record<string, unknown>) };
      if (r.description  && !r.rationale) r.rationale = r.description;
      if (r.explanation  && !r.rationale) r.rationale = r.explanation;
      if (r.detail       && !r.rationale) r.rationale = r.detail;
      if (r.label        && !r.risk)      r.risk       = r.label;
      if (r.name         && !r.risk)      r.risk       = r.name;
      if (r.title        && !r.risk)      r.risk       = r.title;
      // Normalize severity to lowercase
      if (typeof r.severity === "string") {
        r.severity = r.severity.toLowerCase();
        if (!(["high","medium","low"] as string[]).includes(r.severity as string)) r.severity = "medium";
      } else {
        r.severity = "medium";
      }
      if (!Array.isArray(r.sources)) r.sources = [];
      if (!Array.isArray(r.source_urls)) r.source_urls = [];
      return r;
    });
  }

  return obj;
}

/**
 * Generate a schema-valid object from the model.
 *
 * OpenAI: uses native structured outputs (json_schema mode) - the model is
 * constrained to the exact Zod schema, so validation always passes.
 *
 * Groq / other OpenAI-compatible providers: falls back to json_object mode
 * with a compact field list injected into the system prompt.
 * On structural failure one repair pass is attempted.
 */
export async function generateStructuredOutput<T>(
  schema:   z.ZodType<T>,
  messages: ModelMessage[],
  options?: { timeoutMs?: number },
): Promise<StructuredResult<T>> {
  const { system: sysBase, rest } = splitMessages(messages);
  const { signal, clear } = makeAbortSignal(options?.timeoutMs ?? TIMEOUT_MS);
  const start = Date.now();

  // OpenAI structured outputs reject `propertyNames` (generated by z.record()),
  // which appears in ComparisonRowSchema.values. Use json_object mode for all
  // providers and rely on the compact field description in the system prompt.
  const useNativeSchema = false;

  // For non-OpenAI providers: inject a compact field list rather than the full
  // JSON schema, which is too verbose and confuses smaller models.
  const system = useNativeSchema
    ? (sysBase ?? "")
    : [
        sysBase,
        `You MUST respond with a valid JSON object with EXACTLY these keys and nested shapes:

{
  "summary": "string - required",
  "companies": [     // array of company objects - use EXACTLY these field names:
    {
      "ticker": "string",            // stock symbol, e.g. "META" - NOT symbol, NOT code
      "name": "string",              // full company name
      "overview": "string",          // 2-3 sentence overview - NOT description, NOT about
      "metrics": {                   // all values can be null if unavailable
        "current_price":   number or null,
        "price_change_1d": number or null,
        "market_cap":      number or null,
        "pe_ratio":        number or null,
        "forward_pe":      number or null,
        "revenue_ttm":     number or null
      },
      "sources": ["array of source label strings"]
    }
  ],
  "news": [          // array of news items - use EXACTLY these field names:
    {
      "headline": "string",          // NOT title, NOT name
      "summary": "string",           // NOT description, NOT body
      "sentiment": "positive"|"negative"|"neutral",
      "confidence": 0.0-1.0,
      "published_at": "YYYY-MM-DD",  // NOT date, NOT published
      "source": "string",
      "url": "string or null"
    }
  ],
  "risks": [         // array of risk items - use EXACTLY these field names:
    {
      "risk": "short label string",
      "rationale": "string",             // NOT description, NOT explanation
      "severity": "high"|"medium"|"low", // MUST be one of these three
      "sources": ["source name e.g. CBS News"],
      "source_urls": ["https://article-url-if-available"]  // parallel to sources[], empty [] if no URL
    }
  ],
  "tools_used": ["array", "of", "strings"],
  "price_series": [  // optional - only when market price data was provided
    { "date": "YYYY-MM-DD", "close": 123.45, "ticker": "NVDA" }  // ticker MUST be included
  ],
  "comparison": []   // optional
}

Do NOT wrap the response in any outer key. Output ONLY the JSON object.`,
      ].filter(Boolean).join("\n\n");

  const attempt = async (
    extraMessages: ModelMessage[],
    sig: AbortSignal,
  ): Promise<{ object: unknown; usage: LanguageModelUsage }> => {
    if (useNativeSchema) {
      // OpenAI structured outputs - model is constrained to the schema.
      const r = await generateObject({
        model:       getModel(),
        schema,
        system,
        messages:    [...rest, ...extraMessages] as ModelMessage[],
        maxRetries:  0,
        abortSignal: sig,
      });
      return { object: r.object, usage: r.usage };
    } else {
      // Groq / json_object mode - model outputs JSON, we validate ourselves.
      const r = await generateObject({
        model:       getModel(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        output:      "no-schema" as any,
        system,
        messages:    [...rest, ...extraMessages] as ModelMessage[],
        maxRetries:  0,
        abortSignal: sig,
      });
      return { object: r.object, usage: r.usage };
    }
  };

  try {
    const { object, usage } = await attempt([], signal);

    if (useNativeSchema) {
      const durationMs = Date.now() - start;
      console.log(`[llm] generateObject ok - ${durationMs}ms, tokens=${usage.totalTokens ?? 0}`);
      return { data: object as T, usage, durationMs, wasRepaired: false };
    }

    const parsed = schema.safeParse(normalizeLLMOutput(object));
    if (!parsed.success) {
      throw new Error(`Schema validation failed: ${JSON.stringify(parsed.error.issues)}`);
    }

    const durationMs = Date.now() - start;
    console.log(`[llm] generateObject ok - ${durationMs}ms, tokens=${usage.totalTokens ?? 0}`);
    return { data: parsed.data, usage, durationMs, wasRepaired: false };

  } catch (firstErr) {
    clear();

    const { signal: signal2, clear: clear2 } = makeAbortSignal(options?.timeoutMs ?? TIMEOUT_MS);
    try {
      const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      console.warn(`[llm] generateObject first attempt failed (${errMsg}) - attempting repair`);

      const repairMessages: ModelMessage[] = [
        { role: "assistant", content: `My previous response had wrong field names. I must use the exact schema.` },
        { role: "user",      content: `Return ONLY a valid JSON object. Required fields:\n- summary: non-empty string\n- companies: array (each item needs: ticker, name, overview, metrics{current_price,price_change_1d,market_cap,pe_ratio,forward_pe,revenue_ttm - all nullable}, sources[])\n- news: array (each item needs: headline, summary, sentiment, confidence, published_at, source, url)\n- risks: array (each item needs: risk, rationale, severity[high|medium|low], sources[])\n- tools_used: array of strings\nUse [] for empty arrays. Do not rename any field.` },
      ];
      const { object, usage } = await attempt(repairMessages, signal2);

      if (useNativeSchema) {
        const durationMs = Date.now() - start;
        console.log(`[llm] generateObject repaired - ${durationMs}ms, tokens=${usage.totalTokens ?? 0}`);
        return { data: object as T, usage, durationMs, wasRepaired: true };
      }

      const parsed = schema.safeParse(normalizeLLMOutput(object));
      if (!parsed.success) {
        throw new Error(`Schema validation failed after repair: ${JSON.stringify(parsed.error.issues)}`);
      }

      const durationMs = Date.now() - start;
      console.log(`[llm] generateObject repaired - ${durationMs}ms, tokens=${usage.totalTokens ?? 0}`);
      return { data: parsed.data, usage, durationMs, wasRepaired: true };

    } catch (repairErr) {
      throw new LLMError(
        `Structured generation failed after repair: ${repairErr instanceof Error ? repairErr.message : repairErr}`,
        repairErr,
      );
    } finally {
      clear2();
    }
  } finally {
    clear();
  }
}

export interface ToolCallResult {
  toolName: string;
  args:     unknown;
  toolCallId: string;
}

export interface TextWithToolsResult {
  text:       string;
  toolCalls:  ToolCallResult[];
  usage:      LanguageModelUsage;
  durationMs: number;
}

/**
 * Run the model with tool definitions and no auto-execution.
 * The model selects which tools to call; we run them in executor.ts.
 */
export async function generateWithTools(
  messages: ModelMessage[],
  tools:    ToolSet,
  options?: { timeoutMs?: number },
): Promise<TextWithToolsResult> {
  const { system, rest } = splitMessages(messages);
  const { signal, clear } = makeAbortSignal(options?.timeoutMs ?? TIMEOUT_MS);
  const start = Date.now();

  try {
    const result = await generateText({
      model:       getModel(),
      system,
      messages:    rest as ModelMessage[],
      tools,
      toolChoice:  "auto",
      abortSignal: signal,
    });

    const durationMs = Date.now() - start;
    const rawCalls = result.toolCalls ?? [];
    const calls = rawCalls.map((tc) => ({
      toolName:   tc.toolName as string,
      args:       (tc as { input: unknown }).input,
      toolCallId: tc.toolCallId,
    }));

    console.log(
      `[llm] generateWithTools ok - ${durationMs}ms, tools_selected=${calls.map((c) => c.toolName).join(",")||"none"}, tokens=${result.usage.totalTokens ?? 0}`,
    );

    return { text: result.text, toolCalls: calls, usage: result.usage, durationMs };

  } catch (err) {
    throw new LLMError(
      `Tool-calling generation failed: ${err instanceof Error ? err.message : err}`,
      err,
    );
  } finally {
    clear();
  }
}
