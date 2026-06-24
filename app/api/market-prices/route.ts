import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { getMarketData } from "@/lib/tools/market";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const raw = req.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = raw
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 10); // hard cap

  if (!tickers.length) {
    return NextResponse.json({ prices: {} });
  }

  const results = await getMarketData(tickers, "30d", auth.ctx.supabase);

  const prices: Record<string, { price: number; change_pct: number; currency: string; series: { date: string; close: number }[] }> = {};
  const errors: Record<string, string> = {};

  for (const [ticker, res] of Object.entries(results)) {
    if (res.ok) {
      prices[ticker] = {
        price:      res.data.current_price,
        change_pct: res.data.change_pct,
        currency:   res.data.currency,
        series:     res.data.series.slice(-30).map((p) => ({ date: p.date, close: p.close })),
      };
    } else {
      errors[ticker] = res.error;
    }
  }

  return NextResponse.json({ ok: true, data: { prices, errors } }, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
