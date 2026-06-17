import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createOrgAndProfile, joinOrgWithInviteCode } from "@/lib/services/onboarding";

const schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    org_name:  z.string().min(1).trim(),
    full_name: z.string().trim().optional(),
  }),
  z.object({
    mode:        z.literal("join"),
    invite_code: z.string().min(1).trim(),
    full_name:   z.string().trim().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  // A user may onboard only once (enforced by the PK, but fail fast here too).
  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (existing) {
    return NextResponse.json(
      { ok: false, error: { code: "ALREADY_ONBOARDED", message: "User already has a profile" } },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body", details: parsed.error.flatten().fieldErrors } },
      { status: 422 }
    );
  }

  try {
    const result =
      parsed.data.mode === "create"
        ? await createOrgAndProfile({ userId: user.id, email: user.email!, orgName: parsed.data.org_name, fullName: parsed.data.full_name })
        : await joinOrgWithInviteCode({ userId: user.id, email: user.email!, inviteCode: parsed.data.invite_code, fullName: parsed.data.full_name });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Onboarding failed";
    const isInvalidCode = msg === "Invalid invite code";
    return NextResponse.json(
      { ok: false, error: { code: isInvalidCode ? "INVALID_INVITE_CODE" : "ONBOARDING_FAILED", message: msg } },
      { status: isInvalidCode ? 404 : 500 }
    );
  }
}
