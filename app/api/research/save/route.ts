/**
 * POST /api/research/save
 *
 * Persists a ResearchReport that was previously returned by POST /api/research.
 * The client sends the full report_json back; we store it alongside title and tags.
 *
 * Design note: run and save are separate round-trips so the user can inspect
 * the report before committing it to history. This also keeps POST /api/research
 * stateless (no DB write on every run).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api/auth";
import { saveReport } from "@/lib/services/research";
import { writeAuditEvent } from "@/lib/services/audit";

const SaveSchema = z.object({
  query_text:  z.string().min(3).max(1000).trim(),
  title:       z.string().min(1).max(200).trim().optional(),
  result_json: z.record(z.string(), z.unknown()),  // opaque blob — validated at AI layer
  tags:        z.array(z.string().min(1).max(50).trim()).max(10).default([]),
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

  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid request",
          details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) } },
      { status: 422 },
    );
  }

  const { query_text, result_json, tags } = parsed.data;
  // Default title: first 80 chars of the query
  const title = parsed.data.title ?? query_text.slice(0, 80);

  try {
    const report = await saveReport(
      auth.ctx.supabase,
      auth.ctx.orgId,
      auth.ctx.userId,
      { title, query_text, result_json: result_json as never, tags },
    );

    // Best-effort audit
    void writeAuditEvent(
      auth.ctx.supabase, auth.ctx.orgId, auth.ctx.userId,
      "report.created", "research_report", report.id,
      { title, tag_count: tags.length },
    );

    return NextResponse.json({ ok: true, data: report }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "SAVE_FAILED", message: String(err) } },
      { status: 500 },
    );
  }
}
