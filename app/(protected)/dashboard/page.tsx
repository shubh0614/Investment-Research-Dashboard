import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";
import { getOrganization } from "@/lib/repositories/organizations";
import LogoutButton from "../logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const profile = await getProfile(supabase, user!.id);
  const org     = await getOrganization(supabase, profile!.org_id);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50">
      <div className="rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Klypup Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Signed in as{" "}
          <span className="font-medium text-zinc-700">{profile!.email}</span>
          {" · "}
          <span className="font-medium text-zinc-700">{profile!.role}</span>
          {" · "}
          <span className="font-medium text-zinc-700">{org?.name}</span>
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Org invite code:{" "}
          <span className="font-mono">{org?.invite_code}</span>
        </p>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
