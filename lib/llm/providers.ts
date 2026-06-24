/**
 * Model factory - maps LLM_PROVIDER env to an AI SDK LanguageModel.
 *
 * Groq (default): uses createOpenAI with Groq's OpenAI-compatible base URL.
 *   Avoids a second @ai-sdk/groq package while remaining provider-agnostic;
 *   swapping to the official Groq provider is a one-line change.
 * OpenAI: uses @ai-sdk/openai directly.
 * Anthropic: not yet wired - throws a clear error (add @ai-sdk/anthropic when needed).
 */

import { createOpenAI, openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { config } from "@/lib/config";

// Default models per provider - overridden by LLM_MODEL env var.
const PROVIDER_DEFAULTS: Record<string, string> = {
  groq:      "llama-3.3-70b-versatile", // best tool-calling + JSON mode on Groq free tier
  openai:    "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
};

export function createModel(): LanguageModel {
  const provider = config.LLM_PROVIDER;
  const modelId  = config.LLM_MODEL || PROVIDER_DEFAULTS[provider] || "";

  if (!modelId) {
    throw new Error(`[llm] No model configured for provider "${provider}"`);
  }

  switch (provider) {
    case "groq": {
      const groq = createOpenAI({
        name:    "groq",
        baseURL: "https://api.groq.com/openai/v1",
        apiKey:  config.LLM_API_KEY,
      });
      return groq(modelId);
    }

    case "openai": {
      const client = createOpenAI({ apiKey: config.LLM_API_KEY || undefined });
      return client(modelId);
    }

    case "anthropic": {
      // Add @ai-sdk/anthropic to package.json if needed.
      throw new Error("[llm] Anthropic provider not wired. Set LLM_PROVIDER=groq or openai.");
    }

    default:
      throw new Error(`[llm] Unknown LLM_PROVIDER: "${provider}". Use groq | openai | anthropic.`);
  }
}
