import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";
import { getMembers, getInviteCode } from "@/lib/services/org";
import { Shield } from "lucide-react";
import { CopyButtonClient } from "./copy-button-client";
import { MembersTableClient } from "./members-table-client";

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
        <MembersTableClient initialMembers={members} currentUserId={user!.id} />
      </section>
    </div>
  );
}
