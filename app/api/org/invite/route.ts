/**
 * POST /api/org/invite
 *
 * Returns the org's invite code. Admins share this code with new members;
 * POST /api/onboarding with the code joins the org as analyst.
 * No body needed — code is set at org creation and never rotated in the MVP.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth";
import { getInviteCode } from "@/lib/services/org";
import { writeAuditEvent } from "@/lib/services/audit";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const code = await getInviteCode(auth.ctx.supabase, auth.ctx.orgId);
  if (!code) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Invite code not found" } },
      { status: 404 },
    );
  }

  void writeAuditEvent(
    auth.ctx.supabase, auth.ctx.orgId, auth.ctx.userId,
    "org.invite_viewed",
  );

  return NextResponse.json({ ok: true, data: { invite_code: code } });
}
