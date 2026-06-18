/**
 * DELETE /api/watchlist/[id]
 *
 * Removes a watchlist item. Users can only remove their own items
 * (enforced by user_id check in the service, on top of RLS).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { removeFromWatchlist } from "@/lib/services/watchlist";
import { writeAuditEvent } from "@/lib/services/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const removed = await removeFromWatchlist(
      auth.ctx.supabase, id, auth.ctx.orgId, auth.ctx.userId,
    );

    if (!removed) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Watchlist item not found" } },
        { status: 404 },
      );
    }

    void writeAuditEvent(
      auth.ctx.supabase, auth.ctx.orgId, auth.ctx.userId,
      "watchlist.removed", "watchlist_item", id,
    );

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "DELETE_FAILED", message: String(err) } },
      { status: 500 },
    );
  }
}
