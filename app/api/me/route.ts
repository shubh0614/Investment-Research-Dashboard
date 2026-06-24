import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";
import { getOrganization } from "@/lib/repositories/organizations";

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: { code: "PROFILE_NOT_FOUND", message: "Profile not found - complete onboarding first" } },
      { status: 404 }
    );
  }

  const org = await getOrganization(supabase, profile.org_id);
  if (!org) {
    return NextResponse.json(
      { ok: false, error: { code: "ORG_NOT_FOUND", message: "Organization not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      user:    { id: user.id, email: user.email },
      profile: { id: profile.id, email: profile.email, full_name: profile.full_name, role: profile.role },
      org:     { id: org.id, name: org.name, invite_code: org.invite_code },
    },
  });
}
