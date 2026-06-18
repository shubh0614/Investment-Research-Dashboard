import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";
import { getMembers, getInviteCode } from "@/lib/services/org";
import { Users, Shield } from "lucide-react";
import { CopyButtonClient } from "./copy-button-client";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = await getProfile(supabase, user!.id);
  if (!profile) redirect("/onboarding");
  if (profile.role !== "admin") redirect("/dashboard");

  const [members, inviteCode] = await Promise.all([
    getMembers(supabase, profile.org_id),
    getInviteCode(supabase, profile.org_id),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl px-8 py-10" style={{ color: "var(--text)" }}>
      <div className="mb-6 flex items-center gap-2">
        <Shield size={18} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
        <h1 className="text-2xl font-semibold" style={{ color: "var(--text)", letterSpacing: "-0.018em" }}>
          Admin panel
        </h1>
      </div>

      {/* Invite code */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text)" }}>Invite code</h2>
        <div
          className="flex items-center justify-between rounded-xl border px-5 py-4 reveal"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Share this code with new members so they can join as analysts.
            </p>
            <p
              className="mt-2 font-mono text-lg font-semibold tracking-widest"
              style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}
            >
              {inviteCode ?? "—"}
            </p>
          </div>
          {inviteCode && <CopyButtonClient value={inviteCode} />}
        </div>
      </section>

      {/* Members */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Members</h2>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-xs"
            style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
          >
            {members.length}
          </span>
        </div>

        {members.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border"
               style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-center">
              <Users size={22} strokeWidth={1.5} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No members yet</p>
            </div>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-xl border"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div
              className="grid grid-cols-[1fr_100px_120px] px-5 py-2"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              {["Member", "Role", "Joined"].map((h) => (
                <span key={h} className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{h}</span>
              ))}
            </div>
            {members.map((m: { id: string; full_name: string | null; email: string; role: string; created_at: string }, i: number) => (
              <div
                key={m.id}
                className="grid grid-cols-[1fr_100px_120px] items-center px-5 py-3 table-row-hover"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {m.full_name || m.email}
                  </p>
                  {m.full_name && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.email}</p>
                  )}
                </div>
                <span
                  className="inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-medium"
                  style={{
                    color: m.role === "admin" ? "var(--accent)" : "var(--text-muted)",
                    background: m.role === "admin"
                      ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                      : "var(--surface-2)",
                  }}
                >
                  {m.role}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
