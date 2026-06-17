import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase, user.id);
  if (!profile) redirect("/onboarding");

  return <>{children}</>;
}
