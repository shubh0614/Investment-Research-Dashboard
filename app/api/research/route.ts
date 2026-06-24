/**
 * /api/research
 *
 * GET  - list the org's saved reports (tag + text filter, paginated).
 * POST - run the AI orchestrator and return an unsaved ResearchReport.
 *
 * Separation of run vs save is intentional: the user inspects the result
 * before deciding to persist it. Saving is POST /api/research/save (Phase 5).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api/auth";
import { runOrchestrator } from "@/lib/ai/orchestrator";
import { listReports } from "@/lib/services/research";

// AI pipeline can take 20-35s — raise Vercel serverless timeout from default 10s
export const maxDuration = 60;

// ── GET /api/research ─────────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  tag:    z.string().min(1).optional(),
  q:      z.string().min(1).optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = ListQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "Invalid query params",
          details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })) } },
      { status: 422 },
    );
  }

  try {
    const result = await listReports(auth.ctx.supabase, auth.ctx.orgId, parsed.data);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: { code: "LIST_FAILED", message: String(err) } },
      { status: 500 },
    );
  }
}

// ── POST /api/research ────────────────────────────────────────────────────────

const RunSchema = z.object({
  query: z
    .string({ message: "query is required" })
    .min(3,    { message: "query must be at least 3 characters" })
    .max(1000, { message: "query must be at most 1000 characters" })
    .trim(),
});

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { supabase } = auth.ctx;

  // ── Validate request body ─────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Request body must be JSON" } },
      { status: 400 },
    );
  }

  const parsed = RunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok:    false,
        error: {
          code:    "VALIDATION_ERROR",
          message: "Invalid request",
          details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
        },
      },
      { status: 422 },
    );
  }

  const { query } = parsed.data;

  // ── Run orchestrator ──────────────────────────────────────────────────────
  const result = await runOrchestrator({ query, supabase: supabase });

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      LLM_NOT_CONFIGURED: 503,
      PLAN_FAILED:        502,
      NO_TOOLS_SELECTED:  422,
      SYNTHESIS_FAILED:   502,
      UNKNOWN:            500,
    };
    return NextResponse.json(
      { ok: false, error: { code: result.code, message: result.error } },
      { status: statusMap[result.code] ?? 500 },
    );
  }

  return NextResponse.json({ ok: true, data: result.report });
}
