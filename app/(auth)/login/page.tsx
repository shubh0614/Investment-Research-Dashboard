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
      {/* Grid background */}
      <div className="grid-bg grid-bg-mask" style={{ position: "absolute", inset: 0, opacity: 0.22, pointerEvents: "none" }} />

      {/* Ambient glow blobs */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse 55% 45% at 15% 10%, color-mix(in srgb, var(--accent) 9%, transparent) 0%, transparent 65%),
          radial-gradient(ellipse 40% 35% at 85% 85%, color-mix(in srgb, var(--positive) 6%, transparent) 0%, transparent 60%),
          radial-gradient(ellipse 30% 50% at 70% 15%, color-mix(in srgb, var(--accent) 5%, transparent) 0%, transparent 55%)
        `,
      }} />

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
              width: 36, height: 36, borderRadius: 10,
              background: "var(--accent-weak)", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 6px color-mix(in srgb, var(--accent) 7%, transparent)",
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
          className="gradient-heading"
          style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, marginBottom: 20 }}
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
                  width: 34, height: 34, minWidth: 34, borderRadius: 9,
                  background: "var(--accent-weak)", color: "var(--accent)",
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

        {/* Bottom-left decorative orb */}
        <div style={{
          position: "absolute", bottom: -80, left: -60,
          width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />
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
              width: 32, height: 32, borderRadius: 9,
              background: "var(--accent-weak)", color: "var(--accent)",
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
            borderRadius: 18,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "32px 32px 28px",
            position: "relative",
            boxShadow: "0 8px 40px rgba(14,17,22,.18)",
          }}
        >
          {/* Hairline glow along card top edge */}
          <div style={{
            position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
            width: "55%", height: 1,
            background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 55%, transparent), transparent)",
            pointerEvents: "none", borderRadius: "0 0 2px 2px",
          }} />

          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.018em", marginBottom: 4 }}>
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
                  height: 38, borderRadius: 9,
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
                  height: 38, borderRadius: 9,
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
                  borderRadius: 9, padding: "10px 14px", fontSize: 12,
                  background: "color-mix(in srgb, var(--negative) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--negative) 25%, transparent)",
                  color: "var(--negative)",
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
                height: 38, borderRadius: 9,
                background: "var(--accent)", color: "var(--bg)",
                fontSize: 13, fontWeight: 600,
                border: "none", cursor: pending ? "not-allowed" : "pointer",
                opacity: pending ? 0.6 : 1,
                transition: "opacity 150ms",
                boxShadow: "0 2px 14px color-mix(in srgb, var(--accent) 30%, transparent)",
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
