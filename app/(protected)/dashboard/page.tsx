import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";
import Link from "next/link";
import { ArrowRight, Clock, Bookmark, TrendingUp, TrendingDown } from "lucide-react";
import { listReports } from "@/lib/services/research";
import { getWatchlist } from "@/lib/services/watchlist";
import { getOrganization } from "@/lib/repositories/organizations";
import { getMarketData } from "@/lib/tools/market";
import { QuickSearch } from "./quick-search";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = await getProfile(supabase, user!.id);
  if (!profile) return null;

  const org = await getOrganization(supabase, profile.org_id);

  const [reportsResult, watchlistItems] = await Promise.all([
    listReports(supabase, profile.org_id, { limit: 5 }),
    getWatchlist(supabase, profile.org_id, user!.id),
  ]);

  const tickers = watchlistItems.map((i) => i.ticker).slice(0, 8);
  const priceResults = tickers.length > 0
    ? await getMarketData(tickers, "30d", supabase)
    : {} as Awaited<ReturnType<typeof getMarketData>>;

  const reports     = reportsResult.reports;
  const total       = reportsResult.total;
  const displayName = profile.full_name || profile.email.split("@")[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-8 page-enter" style={{ color: "var(--text)" }}>

      {/* Top bar: compact greeting + query */}
      <div className="mb-7">
        <p className="mb-4 font-mono text-xs" style={{ color: "var(--text-faint)" }}>
          {displayName}
          {org && <> · <span>{org.name}</span></>}
          {" · "}
          <span>{total} report{total !== 1 ? "s" : ""}</span>
        </p>
        <QuickSearch />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent reports */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.01em" }}
            >
              Recent reports
            </h2>
            <Link href="/history" className="text-xs" style={{ color: "var(--accent)" }}>View all</Link>
          </div>

          {reports.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border"
                 style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="text-center">
                <Clock size={18} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No reports yet</p>
                <Link href="/research/new" className="mt-1 block text-xs" style={{ color: "var(--accent)" }}>
                  Run your first query →
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg stagger" style={{ border: "1px solid var(--border)" }}>
              {reports.map((r, i) => (
                <Link
                  key={r.id}
                  href={`/research/${r.id}`}
                  className="row-hover group flex items-start justify-between px-4 py-3"
                  style={{
                    background: "var(--surface-1)",
                    borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: "var(--text)", fontFamily: "var(--font-serif)" }}
                    >
                      {r.title || r.query_text}
                    </p>
                    <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-muted)" }}>{r.query_text}</p>
                    {r.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.tags.map((t) => (
                          <span key={t} className="source-chip">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    <span
                      className="font-mono text-xs"
                      style={{ color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatDate(r.created_at)}
                    </span>
                    <ArrowRight size={11} strokeWidth={1.5} style={{ color: "var(--text-muted)", opacity: 0, transition: "opacity 120ms" }} className="group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Watchlist sidebar */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-serif)", letterSpacing: "-0.01em" }}
            >
              Watchlist
            </h2>
            <Link href="/watchlist" className="text-xs" style={{ color: "var(--accent)" }}>Manage</Link>
          </div>

          {watchlistItems.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border"
                 style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="text-center">
                <Bookmark size={18} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No tickers</p>
                <Link href="/watchlist" className="mt-1 block text-xs" style={{ color: "var(--accent)" }}>Add one →</Link>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border)" }}>
              <div
                className="grid px-4 py-2"
                style={{
                  gridTemplateColumns: "3rem 1fr 4.5rem",
                  background: "var(--surface-2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span className="font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Ticker</span>
                <span className="font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Name</span>
                <span className="text-right font-mono text-xs uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>Δ 1D</span>
              </div>
              {watchlistItems.slice(0, 8).map((item, i) => {
                const pr = priceResults[item.ticker];
                const pOk = pr?.ok ? pr : null;
                const up = pOk ? pOk.data.change_pct >= 0 : null;
                return (
                <Link
                  key={item.id}
                  href={`/research/new?q=${encodeURIComponent(`Give me an overview of ${item.ticker}`)}`}
                  className="row-hover grid px-4 py-2.5"
                  style={{
                    gridTemplateColumns: "3rem 1fr 4.5rem",
                    background: "var(--surface-1)",
                    borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                    alignItems: "center",
                  }}
                >
                  <span
                    className="font-mono text-sm font-semibold"
                    style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {item.ticker}
                  </span>
                  <span className="truncate text-xs" style={{ color: "var(--text-muted)" }}>{item.company_name}</span>
                  <span
                    className="flex items-center justify-end gap-0.5 font-mono text-xs"
                    style={{ color: up === null ? "var(--text-faint)" : up ? "var(--pos)" : "var(--neg)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {pOk ? (
                      <>
                        {up ? <TrendingUp size={9} strokeWidth={1.5} /> : <TrendingDown size={9} strokeWidth={1.5} />}
                        {up ? "+" : ""}{pOk.data.change_pct.toFixed(2)}%
                      </>
                    ) : "-"}
                  </span>
                </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
