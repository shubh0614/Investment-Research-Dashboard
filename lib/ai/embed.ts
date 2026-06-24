/**
 * Thin embedding utility over the Vercel AI SDK v6.
 * Phase 3 uses this only to embed KB documents at seed time.
 * Phase 4 builds on this to embed query strings for retrieval.
 *
 * Falls back gracefully when no embedding provider is configured:
 * returns null vectors so the KB retriever uses keyword search instead.
 */

import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { config } from "@/lib/config";

// Embedding dimension pinned to match the vector(1536) column.
// If you swap the model, update the migration to rebuild the column.
export const EMBEDDING_DIM = 1536;
const DEFAULT_MODEL        = "text-embedding-3-small";

function isEmbeddingConfigured(): boolean {
  return (config.OPENAI_API_KEY || config.LLM_API_KEY).length > 0;
}

/**
 * Embed a batch of texts. Returns null for every text if embedding is not
 * configured, signalling that keyword fallback should be used.
 */
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (!texts.length) return [];

  if (!isEmbeddingConfigured()) {
    console.warn("[embed] No OPENAI_API_KEY or LLM_API_KEY - embeddings skipped, keyword fallback will be used");
    return texts.map(() => null);
  }

  try {
    const model = openai.embedding(DEFAULT_MODEL);
    const { embeddings } = await embedMany({ model, values: texts });
    return embeddings as number[][];
  } catch (err) {
    console.error("[embed] embedMany failed:", err instanceof Error ? err.message : err);
    return texts.map(() => null);
  }
}

/**
 * Embed a single query string for similarity search.
 * Returns null if embedding is not configured (caller uses keyword search).
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  if (!isEmbeddingConfigured()) return null;
  const results = await embedTexts([text]);
  return results[0] ?? null;
}
