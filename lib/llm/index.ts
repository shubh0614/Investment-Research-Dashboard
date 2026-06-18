/**
 * LLM gateway — Phase 4.1.
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

// Singleton model — instantiated once at first call, not at module load,
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

/** Split system messages out of a ModelMessage array — AI SDK v6 takes system separately. */
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

/**
 * Generate a schema-valid object from the model.
 *
 * Uses output:"no-schema" (json_object mode) so Groq-compatible endpoints work.
 * The JSON schema is appended to the system prompt and Zod validates the response.
 * On structural failure one repair pass is attempted; throws LLMError on second failure.
 */
export async function generateStructuredOutput<T>(
  schema:   z.ZodType<T>,
  messages: ModelMessage[],
  options?: { timeoutMs?: number },
): Promise<StructuredResult<T>> {
  const { system: sysBase, rest } = splitMessages(messages);

  // Include JSON schema in the system prompt so the model knows the exact shape.
  const jsonSchemaStr = JSON.stringify(z.toJSONSchema(schema), null, 2);
  const system = [
    sysBase,
    `Respond with a JSON object that EXACTLY matches this schema:\n\`\`\`json\n${jsonSchemaStr}\n\`\`\``,
  ].filter(Boolean).join("\n\n");

  const { signal, clear } = makeAbortSignal(options?.timeoutMs ?? TIMEOUT_MS);
  const start = Date.now();

  const attempt = async (
    extraMessages: ModelMessage[],
    sig: AbortSignal,
  ): Promise<{ object: unknown; usage: LanguageModelUsage }> => {
    // output:"no-schema" → AI SDK sends json_object (not json_schema) to provider.
    // Groq supports json_object; json_schema (structured outputs) is OpenAI-only.
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
  };

  try {
    const { object, usage } = await attempt([], signal);

    const parsed = schema.safeParse(object);
    if (!parsed.success) {
      throw new Error(`Schema validation failed: ${parsed.error.message}`);
    }

    const durationMs = Date.now() - start;
    console.log(`[llm] generateObject ok — ${durationMs}ms, tokens=${usage.totalTokens ?? 0}`);
    return { data: parsed.data, usage, durationMs, wasRepaired: false };

  } catch (firstErr) {
    clear();

    const { signal: signal2, clear: clear2 } = makeAbortSignal(options?.timeoutMs ?? TIMEOUT_MS);
    try {
      const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      console.warn(`[llm] generateObject first attempt failed (${errMsg}) — attempting repair`);

      const repairMessages: ModelMessage[] = [
        { role: "assistant", content: `My previous attempt failed: ${errMsg}` },
        { role: "user",      content: "Produce a corrected JSON response that fully satisfies the schema. Focus on required fields and non-empty arrays." },
      ];
      const { object, usage } = await attempt(repairMessages, signal2);

      const parsed = schema.safeParse(object);
      if (!parsed.success) {
        throw new Error(`Schema validation failed after repair: ${parsed.error.message}`);
      }

      const durationMs = Date.now() - start;
      console.log(`[llm] generateObject repaired — ${durationMs}ms, tokens=${usage.totalTokens ?? 0}`);
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
      `[llm] generateWithTools ok — ${durationMs}ms, tools_selected=${calls.map((c) => c.toolName).join(",")||"none"}, tokens=${result.usage.totalTokens ?? 0}`,
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
