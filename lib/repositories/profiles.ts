import type { SupabaseClient } from "@supabase/supabase-js";

export async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, org_id, email, full_name, role")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data as { id: string; org_id: string; email: string; full_name: string | null; role: "admin" | "analyst" };
}
