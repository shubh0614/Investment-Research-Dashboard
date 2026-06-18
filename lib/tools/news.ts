import type { SupabaseClient } from "@supabase/supabase-js";
import { withCache } from "./cache";
import { fetchWithRetry } from "./fetch";
import { config } from "@/lib/config";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  published_at: string;
  source: string;
  url: string;
  // Sentiment is populated by the AI layer (Phase 4); null from raw fetch.
  sentiment: "positive" | "negative" | "neutral" | null;
  confidence: number | null;
}

export interface NewsPayload {
  query: string;
  articles: NewsArticle[];
}

export type NewsResult =
  | { ok: true;  data: NewsPayload; source: string; from_cache: boolean }
  | { ok: false; error: string;     source: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE       = "NewsAPI.org";
const BASE_URL     = "https://newsapi.org/v2/everything";
// News is time-sensitive; cache for 1 hour.
const CACHE_TTL_MS = 60 * 60 * 1_000;

// ── Upstream fetcher ──────────────────────────────────────────────────────────

async function fetchFromNewsAPI(
  query: string,
  sinceDays: number,
): Promise<NewsPayload> {
  const apiKey = config.NEWS_API_KEY;
  if (!apiKey) throw new Error("NEWS_API_KEY not configured");

  const from = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1_000)
    .toISOString()
    .split("T")[0];

  const url =
    `${BASE_URL}?q=${encodeURIComponent(query)}&from=${from}` +
    `&sortBy=publishedAt&language=en&pageSize=20&apiKey=${apiKey}`;

  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`NewsAPI HTTP ${res.status}`);

  const json = (await res.json()) as {
    status: string;
    message?: string;
    articles?: Array<{
      title?: string;
      description?: string;
      content?: string;
      publishedAt?: string;
      source?: { name?: string };
      url?: string;
    }>;
  };

  if (json.status !== "ok") {
    throw new Error(`NewsAPI error: ${json.message ?? json.status}`);
  }

  const articles: NewsArticle[] = (json.articles ?? [])
    .filter((a) => a.title && a.title !== "[Removed]")
    .slice(0, 20)
    .map((a, i) => ({
      id:           `${query}-${i}`,
      headline:     a.title ?? "",
      summary:      a.description ?? a.content?.slice(0, 300) ?? "",
      published_at: a.publishedAt ?? new Date().toISOString(),
      source:       a.source?.name ?? "Unknown",
      url:          a.url ?? "#",
      sentiment:    null,
      confidence:   null,
    }));

  return { query, articles };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch recent financial news for a query, reading through the cache.
 * Returns a typed error result on failure — never throws.
 */
export async function searchNews(
  query: string,
  sinceDays: number,
  supabase: SupabaseClient,
): Promise<NewsResult> {
  const key = `news:${query}:${sinceDays}`;
  try {
    const entry = await withCache<NewsPayload>(
      supabase,
      key,
      CACHE_TTL_MS,
      () => fetchFromNewsAPI(query, sinceDays),
    );
    return { ok: true, data: entry.data, source: SOURCE, from_cache: entry.from_cache };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[news] FAIL query="${query}" error=${msg}`);
    return { ok: false, error: msg, source: SOURCE };
  }
}
