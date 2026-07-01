"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN = 60;

export default function ConfirmEmailPage() {
  const router = useRouter();
  const [email,       setEmail]       = useState<string>("");
  const [confirmed,   setConfirmed]   = useState(false);
  const [resending,   setResending]   = useState(false);
  const [resendMsg,   setResendMsg]   = useState<string | null>(null);
  const [cooldown,    setCooldown]    = useState(0);

  // Read email stored by signup page
  useEffect(() => {
    const stored = sessionStorage.getItem("signup_email") ?? "";
    setEmail(stored);
  }, []);

  // Listen for the moment Supabase confirms the email
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setConfirmed(true);
        sessionStorage.removeItem("signup_email");
        setTimeout(() => router.push("/onboarding"), 1800);
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  // Countdown timer for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setResending(true);
    setResendMsg(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });

    setResending(false);
    if (error) {
      setResendMsg(error.message);
    } else {
      setResendMsg("Email resent — check your inbox.");
      setCooldown(RESEND_COOLDOWN);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "48px 24px",
      }}
    >
      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
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

      {/* Card */}
      <div
        className="reveal"
        style={{
          width: "100%",
          maxWidth: 400,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-1)",
          padding: "36px 32px 32px",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 56, height: 56, borderRadius: 14,
            background: confirmed
              ? "color-mix(in srgb, var(--pos) 14%, transparent)"
              : "color-mix(in srgb, var(--accent) 14%, transparent)",
            color: confirmed ? "var(--pos)" : "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            transition: "background 400ms, color 400ms",
          }}
        >
          {confirmed
            ? <CheckCircle2 size={26} strokeWidth={1.5} />
            : <Mail size={26} strokeWidth={1.5} />
          }
        </div>

        {confirmed ? (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.018em", marginBottom: 8, fontFamily: "var(--font-serif)" }}>
              Email confirmed!
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Taking you to your workspace…
            </p>
            {/* Progress bar */}
            <div
              style={{
                marginTop: 24, height: 2, borderRadius: 999,
                background: "var(--border)", overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%", borderRadius: 999,
                  background: "var(--accent)",
                  animation: "progress-fill 1.8s linear forwards",
                }}
              />
            </div>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.018em", marginBottom: 8, fontFamily: "var(--font-serif)" }}>
              Check your inbox
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 4 }}>
              We sent a confirmation link to
            </p>
            {email && (
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 20 }}>
                {email}
              </p>
            )}
            <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 24 }}>
              Click the link in the email to activate your account. This page will automatically continue once confirmed.
            </p>

            {/* Waiting indicator */}
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, marginBottom: 24,
                fontSize: 12, color: "var(--text-muted)",
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--accent)",
                  display: "inline-block",
                  animation: "pulse-dot 1.4s ease-in-out infinite",
                }}
              />
              Waiting for confirmation…
            </div>

            {/* Resend */}
            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              style={{
                width: "100%", height: 36, borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--surface-2)", color: "var(--text)",
                fontSize: 12, fontWeight: 500,
                cursor: resending || cooldown > 0 ? "not-allowed" : "pointer",
                opacity: resending || cooldown > 0 ? 0.5 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "opacity 150ms",
              }}
              onMouseEnter={(e) => { if (!resending && cooldown === 0) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
            >
              <RefreshCw size={12} strokeWidth={2} style={{ animation: resending ? "spin 1s linear infinite" : "none" }} />
              {cooldown > 0
                ? `Resend in ${cooldown}s`
                : resending ? "Sending…" : "Resend confirmation email"
              }
            </button>

            {resendMsg && (
              <p
                style={{
                  marginTop: 10, fontSize: 12, borderRadius: 6,
                  padding: "8px 12px",
                  background: resendMsg.startsWith("Email resent")
                    ? "color-mix(in srgb, var(--pos) 10%, transparent)"
                    : "color-mix(in srgb, var(--neg) 10%, transparent)",
                  color: resendMsg.startsWith("Email resent") ? "var(--pos)" : "var(--neg)",
                }}
              >
                {resendMsg}
              </p>
            )}
          </>
        )}
      </div>

      {!confirmed && (
        <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-muted)" }}>
          Wrong email?{" "}
          <Link href="/signup" style={{ color: "var(--accent)", fontWeight: 500 }}>
            Back to sign up
          </Link>
        </p>
      )}

      {/* Animations */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes progress-fill {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}
