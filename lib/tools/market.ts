import type { SupabaseClient } from "@supabase/supabase-js";
import { withCache } from "./cache";
import { fetchWithRetry } from "./fetch";
import { config } from "@/lib/config";

// ── Types (shared with the AI orchestrator's tool definitions) ────────────────

export interface MarketDataPoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface MarketDataPayload {
  ticker: string;
  name: string;
  current_price: number;
  change_pct: number;
  market_cap: number | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  revenue_ttm: number | null;
  series: MarketDataPoint[];
}

export type MarketDataResult =
  | { ok: true;  data: MarketDataPayload; source: string; from_cache: boolean }
  | { ok: false; error: string;           source: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE       = "Alpha Vantage";
const BASE_URL     = "https://www.alphavantage.co/query";
// Market data changes daily; cache for 24 h.
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

// ── Upstream fetcher ──────────────────────────────────────────────────────────

async function fetchFromAlphaVantage(
  ticker: string,
  range: string,
): Promise<MarketDataPayload> {
  const apiKey = config.MARKET_DATA_API_KEY;
  if (!apiKey) throw new Error("MARKET_DATA_API_KEY not configured");

  const symbol = ticker.toUpperCase();

  const [seriesRes, overviewRes] = await Promise.all([
    fetchWithRetry(
      `${BASE_URL}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=compact&apikey=${apiKey}`,
    ),
    fetchWithRetry(
      `${BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`,
    ),
  ]);

  if (!seriesRes.ok || !overviewRes.ok) {
    throw new Error(`Alpha Vantage HTTP ${seriesRes.status}/${overviewRes.status}`);
  }

  const [seriesJson, overviewJson] = await Promise.all([
    seriesRes.json() as Promise<Record<string, unknown>>,
    overviewRes.json() as Promise<Record<string, string>>,
  ]);

  // Alpha Vantage signals errors in the body even on HTTP 200
  const seriesErr = (seriesJson["Error Message"] ?? seriesJson["Note"]) as string | undefined;
  if (seriesErr) throw new Error(`Alpha Vantage: ${seriesErr}`);

  const daily = seriesJson["Time Series (Daily)"] as
    | Record<string, Record<string, string>>
    | undefined;
  if (!daily) throw new Error("Unexpected Alpha Vantage response shape");

  const rangeDays = range === "1y" ? 365 : range === "30d" ? 30 : 90;
  const cutoff = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1_000);

  const series: MarketDataPoint[] = Object.entries(daily)
    .filter(([date]) => new Date(date) >= cutoff)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      open:   parseFloat(d["1. open"]),
      high:   parseFloat(d["2. high"]),
      low:    parseFloat(d["3. low"]),
      close:  parseFloat(d["4. close"] ?? d["5. adjusted close"]),
      volume: parseInt(d["6. volume"], 10),
    }));

  if (!series.length) throw new Error(`No price data for ${symbol}`);

  const latest = series[series.length - 1];
  const prev   = series[series.length - 2];
  const changePct = prev
    ? parseFloat((((latest.close - prev.close) / prev.close) * 100).toFixed(2))
    : 0;

  const num = (key: string) => {
    const v = overviewJson[key];
    return v && v !== "None" && v !== "-" ? parseFloat(v) : null;
  };

  return {
    ticker:        symbol,
    name:          overviewJson["Name"] ?? symbol,
    current_price: latest.close,
    change_pct:    changePct,
    market_cap:    num("MarketCapitalization"),
    pe_ratio:      num("PERatio"),
    forward_pe:    num("ForwardPE"),
    revenue_ttm:   num("RevenueTTM"),
    series,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch market data for one or more tickers, reading through the cache.
 * Independent tickers are fetched concurrently.
 * A failed ticker returns { ok: false } — it never throws.
 */
export async function getMarketData(
  tickers: string[],
  range: string,
  supabase: SupabaseClient,
): Promise<Record<string, MarketDataResult>> {
  const results: Record<string, MarketDataResult> = {};

  await Promise.all(
    tickers.map(async (ticker) => {
      const key = `market:${ticker.toUpperCase()}:${range}`;
      try {
        const entry = await withCache<MarketDataPayload>(
          supabase,
          key,
          CACHE_TTL_MS,
          () => fetchFromAlphaVantage(ticker, range),
        );
        results[ticker] = { ok: true, data: entry.data, source: SOURCE, from_cache: entry.from_cache };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[market] FAIL ticker=${ticker} error=${msg}`);
        results[ticker] = { ok: false, error: msg, source: SOURCE };
      }
    }),
  );

  return results;
}
