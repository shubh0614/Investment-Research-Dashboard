/**
 * GET /api/org/members
 *
 * Returns all members in the admin's org. Admin-only.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth";
import { getMembers } from "@/lib/services/org";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const members = await getMembers(auth.ctx.supabase, auth.ctx.orgId);
    return NextResponse.json({ ok: true, data: { members } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "LIST_FAILED", message: String(err) } },
      { status: 500 },
    );
  }
}
