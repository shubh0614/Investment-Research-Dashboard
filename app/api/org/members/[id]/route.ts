/**
 * DELETE /api/org/members/:id
 *
 * Removes a member from the admin's org. Admin-only.
 * An admin cannot remove themselves - checked here and enforced by RLS.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth";
import { removeMember } from "@/lib/services/org";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id: memberId } = await params;

  if (memberId === auth.ctx.userId) {
    return NextResponse.json(
      { ok: false, error: { code: "CANNOT_REMOVE_SELF", message: "You cannot remove yourself from the organisation" } },
      { status: 400 },
    );
  }

  try {
    await removeMember(auth.ctx.supabase, memberId, auth.ctx.orgId);
    return NextResponse.json({ ok: true, data: { removed: memberId } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: { code: "REMOVE_FAILED", message: msg } },
      { status },
    );
  }
}
