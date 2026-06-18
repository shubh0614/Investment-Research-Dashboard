import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";
import Link from "next/link";
import { Search, ArrowRight, Clock, Bookmark } from "lucide-react";
import { listReports } from "@/lib/services/research";
import { getWatchlist } from "@/lib/services/watchlist";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = await getProfile(supabase, user!.id);
  if (!profile) return null;

  const [reportsResult, watchlistItems] = await Promise.all([
    listReports(supabase, profile.org_id, { limit: 5 }),
    getWatchlist(supabase, profile.org_id, user!.id),
  ]);

  const reports = reportsResult.reports;
  const displayName = profile.full_name || profile.email.split("@")[0];

  return (
    <div
      className="mx-auto w-full max-w-5xl px-8 py-10"
      style={{ color: "var(--text)" }}
    >
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl font-semibold"
          style={{ letterSpacing: "-0.018em", color: "var(--text)" }}
        >
          Good to see you, {displayName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Your research workspace — {profile.org_id && <span className="font-mono text-xs">{profile.role}</span>}
        </p>
      </div>

      {/* Quick action */}
      <Link
        href="/research/new"
        className="mb-8 flex items-center gap-3 rounded-xl border px-5 py-4 transition-colors duration-150 reveal"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        onMouseEnter={undefined}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--accent-weak)", color: "var(--accent)" }}
        >
          <Search size={16} strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Run a research query</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Ask about any company — AI orchestrates market data, news, and filings
          </p>
        </div>
        <ArrowRight size={15} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent reports */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Recent reports</h2>
            <Link href="/history" className="text-xs transition-colors duration-150" style={{ color: "var(--accent)" }}>
              View all
            </Link>
          </div>

          {reports.length === 0 ? (
            <div
              className="flex h-32 items-center justify-center rounded-xl border"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="text-center">
                <Clock size={20} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No reports yet</p>
                <Link href="/research/new" className="mt-1 block text-xs" style={{ color: "var(--accent)" }}>
                  Run your first research query →
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 stagger">
              {reports.map((r) => (
                <Link
                  key={r.id}
                  href={`/research/${r.id}`}
                  className="group flex items-start justify-between rounded-lg border px-4 py-3 transition-colors duration-150"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface)"; }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                      {r.title || r.query_text}
                    </p>
                    <p className="mt-0.5 truncate text-xs" style={{ color: "var(--text-muted)" }}>
                      {r.query_text}
                    </p>
                    {r.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded px-1.5 py-0.5 font-mono text-xs"
                            style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="ml-4 shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                    {formatDate(r.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Watchlist */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Watchlist</h2>
            <Link href="/watchlist" className="text-xs" style={{ color: "var(--accent)" }}>
              Manage
            </Link>
          </div>

          {watchlistItems.length === 0 ? (
            <div
              className="flex h-32 items-center justify-center rounded-xl border"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="text-center">
                <Bookmark size={20} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No tickers</p>
                <Link href="/watchlist" className="mt-1 block text-xs" style={{ color: "var(--accent)" }}>
                  Add a ticker →
                </Link>
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {watchlistItems.slice(0, 8).map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <span
                    className="font-mono text-sm font-semibold"
                    style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {item.ticker}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {item.company_name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
