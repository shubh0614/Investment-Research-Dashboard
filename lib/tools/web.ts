import type { SupabaseClient } from "@supabase/supabase-js";
import { tavily } from "@tavily/core";
import { withCache } from "./cache";
import { config } from "@/lib/config";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WebResult {
  title:       string;
  url:         string;
  content:     string;  // Tavily's cleaned excerpt
  published_date?: string;
  source:      string;
}

export interface WebPayload {
  query:   string;
  results: WebResult[];
}

export type WebSearchResult =
  | { ok: true;  data: WebPayload; source: string; from_cache: boolean }
  | { ok: false; error: string;    source: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE       = "Tavily Web Search";
const CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour

// ── Fetcher ───────────────────────────────────────────────────────────────────

async function fetchFromTavily(query: string): Promise<WebPayload> {
  const apiKey = config.TAVILY_API_KEY;
  if (!apiKey) throw new Error("TAVILY_API_KEY not configured");

  const client = tavily({ apiKey });

  const response = await client.search(query, {
    searchDepth: "advanced",
    maxResults:  8,
    includeAnswer: false,
    includeDomains: [],
    excludeDomains: [],
  });

  const results: WebResult[] = (response.results ?? []).map((r) => ({
    title:          r.title ?? "",
    url:            r.url ?? "",
    content:        r.content ?? "",
    published_date: r.publishedDate ?? undefined,
    source:         new URL(r.url ?? "https://unknown").hostname.replace("www.", ""),
  }));

  return { query, results };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchWeb(
  query: string,
  supabase: SupabaseClient,
): Promise<WebSearchResult> {
  const key = `web:${query}`;
  try {
    const entry = await withCache<WebPayload>(
      supabase,
      key,
      CACHE_TTL_MS,
      () => fetchFromTavily(query),
    );
    console.log(`[web] search query="${query}" results=${entry.data.results.length} from_cache=${entry.from_cache}`);
    return { ok: true, data: entry.data, source: SOURCE, from_cache: entry.from_cache };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[web] FAIL query="${query}" error=${msg}`);
    return { ok: false, error: msg, source: SOURCE };
  }
}
