import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";
import { getOrganization } from "@/lib/repositories/organizations";
import { NavSidebar } from "@/components/nav-sidebar";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile) redirect("/onboarding");

  const org = await getOrganization(supabase, profile.org_id);
  if (!org) redirect("/onboarding");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <NavSidebar
        profile={{ email: profile.email, full_name: profile.full_name, role: profile.role as "admin" | "analyst" }}
        org={{ name: org.name }}
      />
      <main
        className="flex flex-1 flex-col overflow-y-auto"
        style={{ maxWidth: "calc(100vw - 224px)" }}
      >
        {children}
      </main>
    </div>
  );
}
