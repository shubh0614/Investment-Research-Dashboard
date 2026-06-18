/**
 * Watchlist service.
 *
 * Watchlist items are user-scoped (one per user+ticker) within an org.
 * RLS enforces org_id; we additionally scope by user_id for defense in depth.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface WatchlistItem {
  id:           string;
  ticker:       string;
  company_name: string;
  created_at:   string;
}

export async function getWatchlist(
  supabase: SupabaseClient,
  orgId:    string,
  userId:   string,
): Promise<WatchlistItem[]> {
  const { data, error } = await supabase
    .from("watchlist_items")
    .select("id, ticker, company_name, created_at")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch watchlist: ${error.message}`);
  return (data ?? []) as WatchlistItem[];
}

export async function addToWatchlist(
  supabase:     SupabaseClient,
  orgId:        string,
  userId:       string,
  ticker:       string,
  companyName:  string,
): Promise<WatchlistItem> {
  const { data, error } = await supabase
    .from("watchlist_items")
    .insert({ org_id: orgId, user_id: userId, ticker: ticker.toUpperCase(), company_name: companyName })
    .select("id, ticker, company_name, created_at")
    .single();

  if (error) {
    // Unique constraint: (user_id, ticker) — treat as idempotent 409
    if (error.code === "23505") {
      throw Object.assign(new Error("Ticker already in watchlist"), { code: "DUPLICATE" });
    }
    throw new Error(`Failed to add to watchlist: ${error.message}`);
  }
  return data as WatchlistItem;
}

export async function removeFromWatchlist(
  supabase: SupabaseClient,
  itemId:   string,
  orgId:    string,
  userId:   string,
): Promise<boolean> {
  const { error, count } = await supabase
    .from("watchlist_items")
    .delete({ count: "exact" })
    .eq("id", itemId)
    .eq("org_id", orgId)
    .eq("user_id", userId); // user can only remove their own items

  if (error) throw new Error(`Failed to remove watchlist item: ${error.message}`);
  return (count ?? 0) > 0;
}
