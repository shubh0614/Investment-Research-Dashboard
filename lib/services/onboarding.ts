import { createServiceClient } from "@/lib/supabase/service";

type CreateInput = { userId: string; email: string; orgName: string; fullName?: string };
type JoinInput   = { userId: string; email: string; inviteCode: string; fullName?: string };

export async function createOrgAndProfile(input: CreateInput) {
  const supabase = createServiceClient();

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({ name: input.orgName })
    .select("id")
    .single();

  if (orgErr || !org) throw new Error(orgErr?.message ?? "Failed to create organization");

  const { error: profileErr } = await supabase.from("profiles").insert({
    id: input.userId,
    org_id: org.id,
    email: input.email,
    full_name: input.fullName ?? null,
    role: "admin",
  });

  if (profileErr) {
    // Best-effort rollback: if the profile insert fails the org is dangling.
    await supabase.from("organizations").delete().eq("id", org.id);
    throw new Error(profileErr.message);
  }

  return { orgId: org.id, role: "admin" as const };
}

export async function joinOrgWithInviteCode(input: JoinInput) {
  const supabase = createServiceClient();

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("invite_code", input.inviteCode)
    .single();

  if (orgErr || !org) throw new Error("Invalid invite code");

  const { error: profileErr } = await supabase.from("profiles").insert({
    id: input.userId,
    org_id: org.id,
    email: input.email,
    full_name: input.fullName ?? null,
    role: "analyst",
  });

  if (profileErr) throw new Error(profileErr.message);

  return { orgId: org.id, role: "analyst" as const };
}
