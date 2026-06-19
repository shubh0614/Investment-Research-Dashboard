"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BarChart3, TrendingUp, Search, BookMarked } from "lucide-react";

const FEATURES = [
  { icon: Search,     label: "AI-powered research",  desc: "Ask in plain English, get sourced reports" },
  { icon: TrendingUp, label: "Live market data",      desc: "Real-time prices, news and financials" },
  { icon: BookMarked, label: "Watchlist & history",   desc: "Track companies and revisit past analysis" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [pending,  setPending]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });

    if (authErr) {
      setError(authErr.message);
      setPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        background: "var(--bg)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left panel — feature showcase, desktop only */}
      <div
        className="hidden lg:flex"
        style={{
          flex: "0 0 46%",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px 56px",
          borderRight: "1px solid var(--border)",
          position: "relative",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 56 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 8,
              background: "var(--surface-3)", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <BarChart3 size={18} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
            Klypup
          </span>
        </div>

        <p
          style={{
            fontSize: 12, fontWeight: 600, letterSpacing: "0.07em",
            textTransform: "uppercase", color: "var(--accent)",
            marginBottom: 14,
          }}
        >
          Market Intelligence Platform
        </p>

        <h2
          style={{
            fontSize: 38, fontWeight: 700, letterSpacing: "-0.025em",
            lineHeight: 1.15, marginBottom: 20,
            fontFamily: "var(--font-serif)", color: "var(--text)",
          }}
        >
          Research smarter,<br />decide faster.
        </h2>

        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, maxWidth: 380, marginBottom: 48 }}>
          An AI research workspace combining live market data, news feeds,
          and financial filings into a single sourced report — in seconds.
        </p>

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  width: 34, height: 34, minWidth: 34, borderRadius: 6,
                  background: "var(--surface-3)", color: "var(--accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: 1,
                }}
              >
                <Icon size={15} strokeWidth={1.5} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        {/* Mobile brand */}
        <div className="flex lg:hidden items-center gap-2.5 mb-10">
          <div
            style={{
              width: 32, height: 32, borderRadius: 6,
              background: "var(--surface-3)", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <BarChart3 size={15} strokeWidth={1.5} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Klypup</span>
        </div>

        {/* Login card */}
        <div
          className="reveal"
          style={{
            width: "100%",
            maxWidth: 380,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-1)",
            padding: "32px 32px 28px",
            position: "relative",
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.018em", marginBottom: 4, fontFamily: "var(--font-serif)" }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            Sign in to your research workspace
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  height: 38, borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)", color: "var(--text)",
                  padding: "0 12px", fontSize: 13, outline: "none",
                  transition: "border-color 150ms",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  height: 38, borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)", color: "var(--text)",
                  padding: "0 12px", fontSize: 13, outline: "none",
                  transition: "border-color 150ms",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
            </div>

            {error && (
              <p
                style={{
                  borderRadius: 6, padding: "10px 14px", fontSize: 12,
                  background: "color-mix(in srgb, var(--neg) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--neg) 25%, transparent)",
                  color: "var(--neg)",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              style={{
                marginTop: 4,
                height: 38, borderRadius: 6,
                background: "var(--accent)", color: "var(--accent-ink)",
                fontSize: 13, fontWeight: 600,
                border: "none", cursor: pending ? "not-allowed" : "pointer",
                opacity: pending ? 0.6 : 1,
                transition: "opacity 150ms",
              }}
              onMouseEnter={(e) => { if (!pending) (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = pending ? "0.6" : "1"; }}
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
            No account?{" "}
            <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 500 }}>
              Create one
            </Link>
          </p>
        </div>

        <p style={{ marginTop: 24, fontSize: 11, color: "var(--text-muted)", opacity: 0.45, textAlign: "center" }}>
          © 2025 Klypup · Market data for research purposes only
        </p>
      </div>
    </div>
  );
}
