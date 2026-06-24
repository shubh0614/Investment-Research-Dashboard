/**
 * /api/research/[id]
 *
 * GET    - read one saved report (tenant re-checked in the query).
 * PATCH  - update title and/or tags.
 * DELETE - delete the report.
 *
 * The org_id is always verified in the DB query, not just from the session.
 * A guessed ID from another org returns 404, never 403 - we do not confirm
 * the existence of cross-tenant resources.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api/auth";
import { getReport, updateReport, deleteReport } from "@/lib/services/research";
import { writeAuditEvent } from "@/lib/services/audit";

// ── GET /api/research/[id] ────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const report = await getReport(auth.ctx.supabase, id, auth.ctx.orgId);
  if (!report) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Report not found" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, data: report });
}

// ── PATCH /api/research/[id] ──────────────────────────────────────────────────

const PatchSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  tags:  z.array(z.string().min(1).max(50).trim()).max(10).optional(),
}).refine((d) => d.title !== undefined || d.tags !== undefined, {
  message: "At least one of title or tags must be provided",
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request",
          details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) } },
      { status: 422 },
    );
  }

  const { id } = await params;

  try {
    const updated = await updateReport(auth.ctx.supabase, id, auth.ctx.orgId, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Report not found" } },
        { status: 404 },
      );
    }

    void writeAuditEvent(
      auth.ctx.supabase, auth.ctx.orgId, auth.ctx.userId,
      "report.updated", "research_report", id,
      { fields: Object.keys(parsed.data) },
    );

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "UPDATE_FAILED", message: String(err) } },
      { status: 500 },
    );
  }
}

// ── DELETE /api/research/[id] ─────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const deleted = await deleteReport(auth.ctx.supabase, id, auth.ctx.orgId);
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Report not found" } },
        { status: 404 },
      );
    }

    void writeAuditEvent(
      auth.ctx.supabase, auth.ctx.orgId, auth.ctx.userId,
      "report.deleted", "research_report", id,
    );

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "DELETE_FAILED", message: String(err) } },
      { status: 500 },
    );
  }
}
