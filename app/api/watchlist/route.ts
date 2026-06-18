/**
 * GET  /api/watchlist — list the user's watchlist items.
 * POST /api/watchlist — add a ticker to the watchlist.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api/auth";
import { getWatchlist, addToWatchlist } from "@/lib/services/watchlist";
import { writeAuditEvent } from "@/lib/services/audit";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const items = await getWatchlist(auth.ctx.supabase, auth.ctx.orgId, auth.ctx.userId);
    return NextResponse.json({ ok: true, data: { items } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "LIST_FAILED", message: String(err) } },
      { status: 500 },
    );
  }
}

const AddSchema = z.object({
  ticker:       z.string().min(1).max(10).trim().toUpperCase(),
  company_name: z.string().min(1).max(200).trim(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try { body = await req.json(); }
  catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Request body must be JSON" } },
      { status: 400 },
    );
  }

  const parsed = AddSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request",
          details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) } },
      { status: 422 },
    );
  }

  try {
    const item = await addToWatchlist(
      auth.ctx.supabase, auth.ctx.orgId, auth.ctx.userId,
      parsed.data.ticker, parsed.data.company_name,
    );

    void writeAuditEvent(
      auth.ctx.supabase, auth.ctx.orgId, auth.ctx.userId,
      "watchlist.added", "watchlist_item", item.id,
      { ticker: parsed.data.ticker },
    );

    return NextResponse.json({ ok: true, data: item }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException & { code?: string }).code === "DUPLICATE") {
      return NextResponse.json(
        { ok: false, error: { code: "CONFLICT", message: "Ticker already in watchlist" } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: { code: "ADD_FAILED", message: String(err) } },
      { status: 500 },
    );
  }
}
