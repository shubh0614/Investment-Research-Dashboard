"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

    const res  = await fetch("/api/onboarding", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-zinc-900">Set up your workspace</h1>
        <p className="mb-6 text-sm text-zinc-500">Create a new organization or join an existing one.</p>

        {mode === "choose" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMode("create")}
              className="rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm hover:border-zinc-400 hover:bg-zinc-50"
            >
              <span className="block font-medium text-zinc-900">Create a new organization</span>
              <span className="text-zinc-500">You&apos;ll become the admin.</span>
            </button>
            <button
              onClick={() => setMode("join")}
              className="rounded-lg border border-zinc-200 px-4 py-3 text-left text-sm hover:border-zinc-400 hover:bg-zinc-50"
            >
              <span className="block font-medium text-zinc-900">Join with an invite code</span>
              <span className="text-zinc-500">Join an existing organization as an analyst.</span>
            </button>
          </div>
        )}

        {mode !== "choose" && (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700" htmlFor="fullName">Your name (optional)</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            {mode === "create" ? (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700" htmlFor="orgName">Organization name</label>
                <input
                  id="orgName"
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Capital"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-zinc-700" htmlFor="inviteCode">Invite code</label>
                <input
                  id="inviteCode"
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. a1b2c3"
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                />
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMode("choose"); setError(null); }}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {pending ? "Setting up…" : mode === "create" ? "Create org" : "Join org"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
