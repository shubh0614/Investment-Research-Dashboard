import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";
import Link from "next/link";
import { ArrowRight, BarChart3, FileText, Shield, Users, TrendingUp, Search, Clock } from "lucide-react";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const profile = await getProfile(supabase, user.id);
    redirect(profile ? "/dashboard" : "/onboarding");
  }

  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100dvh" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav
        style={{
          position: "sticky", top: 0, zIndex: 50,
          borderBottom: "1px solid var(--border)",
          background: "color-mix(in srgb, var(--bg) 90%, transparent)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--surface-3)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart3 size={15} strokeWidth={1.5} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>Klypup</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Link href="#how-it-works" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>How it works</Link>
            <Link href="#features" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>Features</Link>
            <Link href="/login"
              style={{ height: 34, padding: "0 16px", borderRadius: 6, background: "var(--accent)", color: "var(--accent-ink)", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 32px 72px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          {/* Left */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 18, fontFamily: "var(--font-mono)" }}>
              AI Research Workspace for Finance
            </p>
            <h1 style={{ fontSize: "3rem", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.03em", color: "var(--text)", fontFamily: "var(--font-serif)", marginBottom: 20 }}>
              From question to<br />sourced report,<br />in minutes.
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--text-muted)", marginBottom: 32, maxWidth: 440 }}>
              Ask in plain English. Klypup pulls live prices, filings, earnings, and news, then returns a structured, source-attributed analysis — not a wall of text, and not a guess.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/login"
                style={{ height: 44, padding: "0 24px", borderRadius: 6, background: "var(--accent)", color: "var(--accent-ink)", fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                Start researching
                <ArrowRight size={14} strokeWidth={2} />
              </Link>
              <a href="#output-showcase"
                style={{ height: 44, padding: "0 24px", borderRadius: 6, border: "1px solid var(--border)", color: "var(--text)", fontSize: 14, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", background: "var(--surface-1)" }}>
                See sample output →
              </a>
            </div>
            <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
              Built for analysts who can&apos;t afford to be wrong.
            </p>
          </div>

          {/* Right — product mock */}
          <div style={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-1)", overflow: "hidden" }}>
            {/* Mock report header */}
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)" }}>
              <p style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>Research report · NVDA · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
              <p style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-serif)", color: "var(--text)", lineHeight: 1.3 }}>NVIDIA Corporation — Q4 Overview &amp; Risk Assessment</p>
            </div>
            {/* Mock company card */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: "var(--text)" }}>NVDA</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--pos)", display: "flex", alignItems: "center", gap: 3 }}>
                      <TrendingUp size={9} strokeWidth={2} /> +2.34%
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>NVIDIA Corporation</p>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>$134.40</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {[["Mkt Cap", "$3.3T"], ["P/E", "52.4"], ["Fwd P/E", "38.1"], ["Rev TTM", "$113B"]].map(([l, v]) => (
                  <div key={l}>
                    <p style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>{l}</p>
                    <p style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{v}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                {["Alpha Vantage", "SEC filing", "Earnings call"].map((s) => (
                  <span key={s} className="source-chip">{s}</span>
                ))}
              </div>
            </div>
            {/* Mock comparison table */}
            <div style={{ padding: "12px 20px" }}>
              <p style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Comparison</p>
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "4px 0", color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontWeight: 400, fontSize: 9 }}>Metric</th>
                    {["NVDA", "AMD", "INTC"].map((t) => (
                      <th key={t} style={{ textAlign: "right", padding: "4px 6px", color: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 10 }}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Revenue TTM", "$113B", "$22.7B", "$54.2B"],
                    ["Gross Margin", "74.6%", "47.2%", "41.5%"],
                    ["P/E Ratio", "52.4×", "138×", "—"],
                  ].map(([metric, ...vals], ri) => (
                    <tr key={ri} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "5px 0", color: "var(--text-muted)", fontSize: 10 }}>{metric}</td>
                      {vals.map((v, vi) => (
                        <td key={vi} style={{ textAlign: "right", padding: "5px 6px", fontFamily: "var(--font-mono)", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof ────────────────────────────────────────────────────── */}
      <section style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "20px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
          {["Source-attributed output", "Isolated org workspaces", "Structured reports, not paragraphs", "Live market data"].map((t) => (
            <span key={t} style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── Problem ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "80px 32px" }}>
        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 16 }}>
          The problem
        </p>
        <h2 style={{ fontSize: "2rem", fontWeight: 700, fontFamily: "var(--font-serif)", letterSpacing: "-0.025em", color: "var(--text)", marginBottom: 20, lineHeight: 1.15 }}>
          Research shouldn&apos;t take days.
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: "var(--text-muted)", maxWidth: 640 }}>
          Pulling prices from a terminal. Reading thirty news articles. Combing SEC filings and earnings transcripts. Stitching it into something a partner can use. By the time it&apos;s done, the market has moved — and a generic chatbot&apos;s summary is something you&apos;d never put your name on.
        </p>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ background: "var(--surface-1)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "72px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 12, textAlign: "center" }}>
            How it works
          </p>
          <h2 style={{ fontSize: "1.875rem", fontWeight: 700, fontFamily: "var(--font-serif)", letterSpacing: "-0.025em", color: "var(--text)", marginBottom: 48, textAlign: "center", lineHeight: 1.2 }}>
            Ask once. Get a report you can defend.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
            {[
              {
                n: "01",
                icon: <Search size={20} strokeWidth={1.5} />,
                title: "Ask in plain English",
                body: "\"Compare the balance sheets of JPMorgan, Goldman, and Morgan Stanley; which has the strongest capital position?\" No query syntax, no filters.",
              },
              {
                n: "02",
                icon: <BarChart3 size={20} strokeWidth={1.5} />,
                title: "Klypup orchestrates the data",
                body: "It selects the right tools, pulls live market data, filings, transcripts, and news, then reasons across all of it.",
              },
              {
                n: "03",
                icon: <FileText size={20} strokeWidth={1.5} />,
                title: "Get a structured, sourced report",
                body: "Company cards, comparison tables, charts, and a news-sentiment read — every data point linked to its source.",
              },
            ].map((step) => (
              <div key={step.n} style={{ padding: "28px 28px 24px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ color: "var(--accent)" }}>{step.icon}</div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>{step.n}</span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, fontFamily: "var(--font-serif)", color: "var(--text)", marginBottom: 10, lineHeight: 1.3 }}>{step.title}</p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.65 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Output showcase ─────────────────────────────────────────────────── */}
      <section id="output-showcase" style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 32px" }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 12 }}>
            Output
          </p>
          <h2 style={{ fontSize: "1.875rem", fontWeight: 700, fontFamily: "var(--font-serif)", letterSpacing: "-0.025em", color: "var(--text)", marginBottom: 12, lineHeight: 1.2 }}>
            Structured. Sourced. Auditable.
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-muted)", maxWidth: 560, lineHeight: 1.65 }}>
            Klypup doesn&apos;t hand you paragraphs to fact-check. It returns the analysis as components you can scan — and every number shows where it came from.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {[
            { title: "Clean cards, not paragraphs", desc: "Key metrics structured per company — price, market cap, P/E, revenue — not buried in prose." },
            { title: "Side-by-side comparison tables", desc: "Tabular numbers across companies in aligned columns with source attribution per row." },
            { title: "Charts with source labels", desc: "30/90-day price history per ticker, styled for readability, source listed below." },
            { title: "News sentiment read", desc: "Positive/negative/neutral breakdown with per-article confidence and direct links to originals." },
          ].map((card) => (
            <div key={card.title} style={{ padding: "20px 22px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-1)" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6, fontFamily: "var(--font-serif)" }}>{card.title}</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{card.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 24, padding: "16px 22px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, color: "var(--accent)" }}>❝</span>
          <p style={{ fontSize: 13, fontStyle: "italic", color: "var(--text-muted)", lineHeight: 1.6 }}>
            If a figure isn&apos;t sourced, it isn&apos;t in your report.
          </p>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" style={{ background: "var(--surface-1)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "72px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: 12, textAlign: "center" }}>
            Features
          </p>
          <h2 style={{ fontSize: "1.875rem", fontWeight: 700, fontFamily: "var(--font-serif)", letterSpacing: "-0.025em", color: "var(--text)", marginBottom: 40, textAlign: "center" }}>
            Everything a research desk needs.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            {[
              { icon: <TrendingUp size={18} strokeWidth={1.5} />, title: "Watchlist", desc: "Track tickers with live prices, daily deltas, and 30-day sparklines." },
              { icon: <Clock size={18} strokeWidth={1.5} />, title: "Saved research", desc: "Every report saved, tagged, and searchable. Your research archive." },
              { icon: <BarChart3 size={18} strokeWidth={1.5} />, title: "Compare companies", desc: "Side-by-side financials, metrics, and news across multiple tickers." },
              { icon: <Users size={18} strokeWidth={1.5} />, title: "Team workspace", desc: "Isolated org workspace — invite colleagues, share reports, manage access." },
            ].map((f) => (
              <div key={f.title} style={{ padding: "20px 20px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <div style={{ color: "var(--accent)", marginBottom: 12 }}>{f.icon}</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6, fontFamily: "var(--font-serif)" }}>{f.title}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ───────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "80px 32px" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <Shield size={18} strokeWidth={1.5} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-serif)", letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 12, lineHeight: 1.2 }}>
              Built for teams that get audited.
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.75, maxWidth: 560 }}>
              Your organization gets its own workspace, fully isolated from every other organization on Klypup. Source attribution on every data point means anyone on your team can trace a conclusion back to its filing, transcript, or article.
            </p>
          </div>
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Source-attributed output", "Isolated org workspaces", "Role-based access control"].map((c) => (
            <span key={c} className="source-chip" style={{ fontSize: 12 }}>{c}</span>
          ))}
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────────── */}
      <section style={{ borderTop: "1px solid var(--border)", padding: "72px 32px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontSize: "2.25rem", fontWeight: 700, fontFamily: "var(--font-serif)", letterSpacing: "-0.03em", color: "var(--text)", marginBottom: 16, lineHeight: 1.1 }}>
            Stop gathering.<br />Start deciding.
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 32 }}>
            Your first research query is one question away.
          </p>
          <Link href="/login"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 48, padding: "0 28px", borderRadius: 6, background: "var(--accent)", color: "var(--accent-ink)", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
            Start researching
            <ArrowRight size={15} strokeWidth={2} />
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--border)", padding: "24px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--surface-3)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart3 size={12} strokeWidth={1.5} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Klypup</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
            © 2026 Klypup · Market data for research purposes only.
          </p>
        </div>
      </footer>
    </div>
  );
}
