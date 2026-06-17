import type { SupabaseClient } from "@supabase/supabase-js";

export async function getOrganization(supabase: SupabaseClient, orgId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, invite_code, created_at")
    .eq("id", orgId)
    .single();

  if (error) return null;
  return data as { id: string; name: string; invite_code: string; created_at: string };
}

export async function getOrganizationByInviteCode(supabase: SupabaseClient, inviteCode: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("invite_code", inviteCode)
    .single();

  if (error) return null;
  return data as { id: string; name: string };
}
