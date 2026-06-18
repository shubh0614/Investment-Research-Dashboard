import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";
import Link from "next/link";
import { Search, ArrowRight, Clock, Bookmark, Sparkles } from "lucide-react";
import { listReports } from "@/lib/services/research";
import { getWatchlist } from "@/lib/services/watchlist";
import { getOrganization } from "@/lib/repositories/organizations";

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

  const reports     = reportsResult.reports;
  const total       = reportsResult.total;
  const displayName = profile.full_name || profile.email.split("@")[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-10 page-enter" style={{ color: "var(--text)" }}>
      {/* ── Hero ── */}
      <div className="hero-glow mb-8 rounded-2xl border px-7 py-8"
           style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md px-2 py-0.5 font-mono text-xs font-medium"
                style={{ background: "var(--accent-weak)", color: "var(--accent)" }}>
            {profile.role}
          </span>
          {org && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{org.name}</span>}
        </div>
        <h1 className="gradient-heading text-3xl font-bold" style={{ letterSpacing: "-0.022em", lineHeight: 1.2 }}>
          Good to see you, {displayName}.
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {total > 0
            ? `${total} saved report${total !== 1 ? "s" : ""} in your workspace.`
            : "Your workspace is empty. Run your first research query."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/research/new"
            className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--bg)" }}>
            <Sparkles size={13} strokeWidth={1.5} />
            New research
          </Link>
          <Link href="/history"
            className="btn-outline inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm">
            <Clock size={13} strokeWidth={1.5} />
            View history
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent reports */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent reports</h2>
            <Link href="/history" className="text-xs" style={{ color: "var(--accent)" }}>View all</Link>
          </div>

          {reports.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-xl border"
                 style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
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
                <Link key={r.id} href={`/research/${r.id}`}
                  className="card-lift group flex items-start justify-between rounded-xl border px-4 py-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
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
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{formatDate(r.created_at)}</span>
                    <ArrowRight size={12} strokeWidth={1.5} style={{ color: "var(--text-muted)", opacity: 0, transition: "opacity 150ms" }} className="group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Watchlist */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Watchlist</h2>
            <Link href="/watchlist" className="text-xs" style={{ color: "var(--accent)" }}>Manage</Link>
          </div>

          {watchlistItems.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-xl border"
                 style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div className="text-center">
                <Bookmark size={20} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No tickers</p>
                <Link href="/watchlist" className="mt-1 block text-xs" style={{ color: "var(--accent)" }}>Add a ticker →</Link>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              {watchlistItems.slice(0, 8).map((item, i) => (
                <Link key={item.id} href={`/research/new?q=${encodeURIComponent(`Give me an overview of ${item.ticker}`)}`}
                  className="row-hover flex items-center justify-between px-4 py-2.5"
                  style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined, display: "flex" }}>
                  <span className="font-mono text-sm font-semibold" style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
                    {item.ticker}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.company_name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
