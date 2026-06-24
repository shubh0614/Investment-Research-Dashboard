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

// ── Finnhub response types ────────────────────────────────────────────────────

interface FinnhubQuote {
  c:  number;  // current price
  d:  number;  // change
  dp: number;  // percent change
  h:  number;  // high of day
  l:  number;  // low of day
  o:  number;  // open
  pc: number;  // previous close
}

interface FinnhubProfile {
  name:                 string;
  marketCapitalization: number;  // millions USD
  shareOutstanding:     number;  // millions
}

interface FinnhubMetrics {
  metric: Record<string, number | null>;
}

// ── Yahoo Finance response types ──────────────────────────────────────────────

interface YahooChartResult {
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?:   (number | null)[];
      high?:   (number | null)[];
      low?:    (number | null)[];
      close?:  (number | null)[];
      volume?: (number | null)[];
    }>;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE       = "Finnhub";
const FINNHUB_URL  = "https://finnhub.io/api/v1";
const YAHOO_URL    = "https://query1.finance.yahoo.com/v8/finance/chart";
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

// ── Yahoo Finance candles ─────────────────────────────────────────────────────

async function fetchCandlesFromYahoo(
  ticker: string,
  range: string,
): Promise<MarketDataPoint[]> {
  const rangeMap: Record<string, string> = {
    "7d": "5d", "30d": "1mo", "90d": "3mo", "1y": "1y",
  };
  const yahooRange = rangeMap[range] ?? "3mo";

  let res: Response;
  try {
    res = await fetchWithRetry(
      `${YAHOO_URL}/${encodeURIComponent(ticker)}?interval=1d&range=${yahooRange}`,
      { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } },
    );
  } catch {
    return [];
  }

  if (!res.ok) return [];

  const json = (await res.json()) as { chart?: { result?: YahooChartResult[] } };
  const result = json?.chart?.result?.[0];
  if (!result?.timestamp?.length) return [];

  const q       = result.indicators?.quote?.[0] ?? {};
  const timestamps = result.timestamp;
  const closes  = q.close  ?? [];
  const opens   = q.open   ?? [];
  const highs   = q.high   ?? [];
  const lows    = q.low    ?? [];
  const volumes = q.volume ?? [];

  const points: MarketDataPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    points.push({
      date:   new Date(timestamps[i] * 1000).toISOString().split("T")[0],
      open:   opens[i]   ?? closes[i]!,
      high:   highs[i]   ?? closes[i]!,
      low:    lows[i]    ?? closes[i]!,
      close:  closes[i]!,
      volume: volumes[i] ?? 0,
    });
  }
  return points;
}

// ── Finnhub quote + profile + metrics ────────────────────────────────────────

async function fetchFromFinnhub(
  ticker: string,
  range: string,
): Promise<MarketDataPayload> {
  const apiKey = config.MARKET_DATA_API_KEY;
  if (!apiKey) throw new Error("MARKET_DATA_API_KEY not configured");

  const symbol = ticker.toUpperCase();

  // Run Finnhub (quote/profile/metrics) and Yahoo Finance (candles) in parallel
  const [quoteRes, profileRes, metricsRes, series] = await Promise.all([
    fetchWithRetry(`${FINNHUB_URL}/quote?symbol=${symbol}&token=${apiKey}`),
    fetchWithRetry(`${FINNHUB_URL}/stock/profile2?symbol=${symbol}&token=${apiKey}`),
    fetchWithRetry(`${FINNHUB_URL}/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`),
    fetchCandlesFromYahoo(symbol, range),
  ]);

  for (const [name, res] of [["quote", quoteRes], ["profile", profileRes], ["metrics", metricsRes]] as const) {
    if (res.status === 429) throw new Error("Finnhub rate limit reached");
    if (res.status === 403) throw new Error("Finnhub API key invalid or unauthorized");
    if (!res.ok)            throw new Error(`Finnhub ${name} HTTP ${res.status}`);
  }

  const [quote, profile, metricsData] = await Promise.all([
    quoteRes.json()   as Promise<FinnhubQuote>,
    profileRes.json() as Promise<FinnhubProfile>,
    metricsRes.json() as Promise<FinnhubMetrics>,
  ]);

  if (!quote.c) throw new Error(`Finnhub: no price data for ${symbol}`);

  // If Yahoo had no history (e.g. very new ticker), fall back to a single quote point
  const priceSeries: MarketDataPoint[] = series.length
    ? series
    : [{
        date:   new Date().toISOString().split("T")[0],
        open:   quote.o  ?? quote.pc ?? quote.c,
        high:   quote.h  ?? quote.c,
        low:    quote.l  ?? quote.c,
        close:  quote.c,
        volume: 0,
      }];

  const m   = metricsData.metric ?? {};
  const num = (v: unknown): number | null =>
    typeof v === "number" && isFinite(v) && v !== 0 ? v : null;

  const revenueTTM = (() => {
    if (num(m["revenueTTM"]) != null) return m["revenueTTM"] as number;
    const rps    = num(m["revenuePerShareTTM"]);
    const shares = profile.shareOutstanding;
    if (rps != null && shares) return rps * shares * 1_000_000;
    return null;
  })();

  return {
    ticker:        symbol,
    name:          profile.name || symbol,
    current_price: quote.c,
    change_pct:    parseFloat((quote.dp ?? 0).toFixed(2)),
    market_cap:    profile.marketCapitalization
                     ? profile.marketCapitalization * 1_000_000
                     : null,
    pe_ratio:      num(m["peTTM"] ?? m["peBasicExclExtraTTM"] ?? m["peNormalizedAnnual"]),
    forward_pe:    num(m["forwardPE"] ?? m["forwardPe"]),
    revenue_ttm:   revenueTTM,
    series:        priceSeries,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

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
          () => fetchFromFinnhub(ticker, range),
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
