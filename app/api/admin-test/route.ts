// TEMPORARY — Phase 1.4 gate test. Remove after Gate 3 is confirmed.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";

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
      { ok: false, error: { code: "PROFILE_NOT_FOUND", message: "Complete onboarding first" } },
      { status: 404 }
    );
  }

  if (profile.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: "Admin only" } },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, data: { message: "Admin access confirmed" } });
}
