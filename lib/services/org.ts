/**
 * Org admin service.
 *
 * Admin-only operations: read invite code, list members.
 * Role check is enforced by requireAdmin() in the route handler;
 * these functions are the business logic only, not the auth gate.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface MemberRow {
  id:         string;
  email:      string;
  full_name:  string | null;
  role:       "admin" | "analyst";
  created_at: string;
}

/** Return the org's current invite code. Orgs always have one (set at creation). */
export async function getInviteCode(
  supabase: SupabaseClient,
  orgId:    string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("invite_code")
    .eq("id", orgId)
    .single();

  if (error || !data) return null;
  return (data as { invite_code: string }).invite_code;
}

/** Remove a member from the org. Admin cannot remove themselves (RLS also enforces this). */
export async function removeMember(
  supabase: SupabaseClient,
  memberId: string,
  orgId:    string,
): Promise<void> {
  // Verify the target exists in this org before attempting delete.
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", memberId)
    .eq("org_id", orgId)
    .single();

  if (!target) throw new Error("Member not found in this organisation");

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", memberId)
    .eq("org_id", orgId);

  if (error) throw new Error(`Failed to remove member: ${error.message}`);
}

/** List all members of an org, ordered by creation date. */
export async function getMembers(
  supabase: SupabaseClient,
  orgId:    string,
): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch members: ${error.message}`);
  return (data ?? []) as MemberRow[];
}
