/**
 * LLM gateway — Phase 4.1.
 *
 * Wraps AI SDK v6's generateObject and generateText with:
 * - Timeout via AbortController (30s default)
 * - Structured token-usage logging on every call
 * - Throws LLMError on timeout / provider error so callers handle one type
 *
 * The gateway owns these cross-cutting concerns so neither the orchestrator
 * nor the synthesizer needs to think about them.
 */

import { generateObject, generateText } from "ai";
import type { LanguageModel, LanguageModelUsage, ModelMessage, ToolSet } from "ai";
import type { z } from "zod";
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

export interface StructuredResult<T> {
  data:       T;
  usage:      LanguageModelUsage;
  durationMs: number;
  wasRepaired: boolean;
}

/**
 * Generate a schema-valid object from the model.
 * Validates against the Zod schema; on structural failure, makes one repair pass.
 */
export async function generateStructuredOutput<T>(
  schema:   z.ZodType<T>,
  messages: ModelMessage[],
  options?: { maxRetries?: number; timeoutMs?: number },
): Promise<StructuredResult<T>> {
  const { signal, clear } = makeAbortSignal(options?.timeoutMs ?? TIMEOUT_MS);
  const start = Date.now();

  try {
    const result = await generateObject({
      model:       getModel(),
      schema,
      messages,
      maxRetries:  0, // we own the repair loop
      abortSignal: signal,
    });

    const durationMs = Date.now() - start;
    console.log(
      `[llm] generateObject ok — ${durationMs}ms, tokens=${result.usage.totalTokens ?? 0}`,
    );

    return { data: result.object as T, usage: result.usage, durationMs, wasRepaired: false };

  } catch (firstErr) {
    clear();

    // One repair pass — give the model the error message as context.
    const { signal: signal2, clear: clear2 } = makeAbortSignal(options?.timeoutMs ?? TIMEOUT_MS);
    try {
      const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      console.warn(`[llm] generateObject first attempt failed (${errMsg}) — attempting repair`);

      const repaired = await generateObject({
        model:       getModel(),
        schema,
        messages: [
          ...messages,
          {
            role:    "assistant" as const,
            content: `My previous response failed schema validation: ${errMsg}`,
          },
          {
            role:    "user" as const,
            content: "Please produce a corrected JSON response that fully satisfies the schema. Pay special attention to required fields and non-empty arrays.",
          },
        ],
        maxRetries:  0,
        abortSignal: signal2,
      });

      const durationMs = Date.now() - start;
      console.log(
        `[llm] generateObject repaired — ${durationMs}ms, tokens=${repaired.usage.totalTokens ?? 0}`,
      );
      return { data: repaired.object as T, usage: repaired.usage, durationMs, wasRepaired: true };

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
  const { signal, clear } = makeAbortSignal(options?.timeoutMs ?? TIMEOUT_MS);
  const start = Date.now();

  try {
    const result = await generateText({
      model:       getModel(),
      messages,
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
