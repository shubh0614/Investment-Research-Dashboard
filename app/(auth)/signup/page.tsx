"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BarChart3 } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [pending, setPending]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signUp({ email, password });

    if (authErr) {
      setError(authErr.message);
      setPending(false);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-sm reveal">
        <div className="mb-8 flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "var(--accent-weak)", color: "var(--accent)" }}
          >
            <BarChart3 size={16} strokeWidth={1.5} />
          </div>
          <span className="text-base font-semibold" style={{ color: "var(--text)" }}>Klypup</span>
        </div>

        <h1
          className="mb-1 text-2xl font-semibold tracking-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.018em" }}
        >
          Create account
        </h1>
        <p className="mb-7 text-sm" style={{ color: "var(--text-muted)" }}>
          Get started with your research workspace
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }} htmlFor="email">
              Email
            </label>
            <input
              id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="h-9 rounded-lg border px-3 text-sm outline-none transition-colors duration-150"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }} htmlFor="password">
              Password
            </label>
            <input
              id="password" type="password" autoComplete="new-password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="h-9 rounded-lg border px-3 text-sm outline-none transition-colors duration-150"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Minimum 6 characters</p>
          </div>

          {error && (
            <p className="rounded-lg px-3 py-2 text-sm"
               style={{ background: "color-mix(in srgb, var(--negative) 12%, transparent)", color: "var(--negative)" }}>
              {error}
            </p>
          )}

          <button
            type="submit" disabled={pending}
            className="mt-1 h-9 rounded-lg text-sm font-medium transition-opacity duration-150 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-medium" style={{ color: "var(--accent)" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
