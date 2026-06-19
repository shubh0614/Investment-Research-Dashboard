"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Building2, Users } from "lucide-react";

type Mode = "choose" | "create" | "join";

export default function OnboardingPage() {
  const router  = useRouter();
  const [mode, setMode]         = useState<Mode>("choose");
  const [orgName, setOrgName]   = useState("");
  const [inviteCode, setCode]   = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [pending, setPending]   = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const body =
      mode === "create"
        ? { mode: "create", org_name: orgName, full_name: fullName || undefined }
        : { mode: "join",   invite_code: inviteCode, full_name: fullName || undefined };

    const res  = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();

    if (!json.ok) {
      setError(json.error?.message ?? "Something went wrong");
      setPending(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm reveal">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--surface-3)", color: "var(--accent)" }}>
            <BarChart3 size={16} strokeWidth={1.5} />
          </div>
          <span className="text-base font-semibold" style={{ color: "var(--text)" }}>Klypup</span>
        </div>

        <h1 className="mb-1 text-2xl font-semibold tracking-tight" style={{ color: "var(--text)", letterSpacing: "-0.018em" }}>
          Set up your workspace
        </h1>
        <p className="mb-7 text-sm" style={{ color: "var(--text-muted)" }}>
          Create a new organization or join an existing one.
        </p>

        {mode === "choose" && (
          <div className="flex flex-col gap-3">
            {[
              { m: "create" as Mode, icon: Building2, title: "Create a new organization", sub: "You'll become the admin." },
              { m: "join"   as Mode, icon: Users,     title: "Join with an invite code",  sub: "Join as an analyst." },
            ].map(({ m, icon: Icon, title, sub }) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="rounded-lg border px-4 py-3 text-left transition-colors duration-150"
                style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={15} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                  <span className="text-sm font-medium">{title}</span>
                </div>
                <p className="mt-0.5 pl-6 text-xs" style={{ color: "var(--text-muted)" }}>{sub}</p>
              </button>
            ))}
          </div>
        )}

        {mode !== "choose" && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {[
              { id: "fullName",   label: "Your name (optional)", value: fullName,    setter: setFullName,   type: "text",     placeholder: "Jane Smith",    mono: false },
              ...(mode === "create"
                ? [{ id: "orgName",  label: "Organization name",    value: orgName,    setter: setOrgName,    type: "text",     placeholder: "Acme Capital",  mono: false, required: true }]
                : [{ id: "invCode",  label: "Invite code",          value: inviteCode, setter: setCode,       type: "text",     placeholder: "e.g. a1b2c3d", mono: true,  required: true }]),
            ].map(({ id, label, value, setter, type, placeholder, mono, required }) => (
              <div key={id} className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }} htmlFor={id}>{label}</label>
                <input
                  id={id} type={type} required={!!required} value={value}
                  onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                  className="h-9 rounded-lg border px-3 text-sm outline-none transition-colors duration-150"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: mono ? "var(--font-mono)" : undefined }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--border)"; }}
                />
              </div>
            ))}

            {error && (
              <p className="rounded-lg px-3 py-2 text-sm"
                 style={{ background: "color-mix(in srgb, var(--neg) 12%, transparent)", color: "var(--neg)" }}>
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => { setMode("choose"); setError(null); }}
                className="flex-1 h-9 rounded-lg border text-sm font-medium transition-colors duration-150"
                style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--text-muted)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}>
                Back
              </button>
              <button type="submit" disabled={pending}
                className="flex-1 h-9 rounded-lg text-sm font-medium transition-opacity duration-150 disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--bg)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}>
                {pending ? "Setting up…" : mode === "create" ? "Create org" : "Join org"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
