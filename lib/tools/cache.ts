import type { SupabaseClient } from "@supabase/supabase-js";

export interface CacheEntry<T> {
  data: T;
  from_cache: boolean;
  fetched_at: string;
}

/**
 * Read-through cache over the query_cache table.
 *
 * On hit: returns payload_json and from_cache=true — no upstream call.
 * On miss / expired: calls fetchFn, writes to cache (upsert), returns data.
 * query_cache has no RLS; any authenticated client can read/write it.
 */
export async function withCache<T>(
  supabase: SupabaseClient,
  cacheKey: string,
  ttlMs: number,
  fetchFn: () => Promise<T>,
): Promise<CacheEntry<T>> {
  const now = new Date();

  const { data: cached } = await supabase
    .from("query_cache")
    .select("payload_json, fetched_at, expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (cached && new Date(cached.expires_at) > now) {
    console.log(`[cache] HIT  key=${cacheKey}`);
    return { data: cached.payload_json as T, from_cache: true, fetched_at: cached.fetched_at };
  }

  console.log(`[cache] MISS key=${cacheKey} — fetching upstream`);
  const t0 = Date.now();
  const data = await fetchFn();
  console.log(`[cache] STORE key=${cacheKey} latency=${Date.now() - t0}ms`);

  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  await supabase.from("query_cache").upsert(
    { cache_key: cacheKey, payload_json: data as object, fetched_at: now.toISOString(), expires_at: expiresAt },
    { onConflict: "cache_key" },
  );

  return { data, from_cache: false, fetched_at: now.toISOString() };
}
