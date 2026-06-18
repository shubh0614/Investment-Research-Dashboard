/**
 * POST /api/research — Phase 4 entry point.
 *
 * Validates the request, resolves the authenticated session, and calls the
 * orchestrator. Returns a schema-valid ResearchReport on success.
 *
 * Auth model (from Phase 1):
 * - proxy.ts passes all /api/* through; this route handles auth itself.
 * - Returns 401 for unauthenticated requests, 403 if profile is missing.
 * - The session-bound Supabase client passed to the orchestrator ensures
 *   RLS is enforced for all KB and tool queries.
 *
 * This endpoint ONLY runs the research. Saving is a separate POST /api/research/save
 * introduced in Phase 5 (CRUD). Separation is intentional — the user should be
 * able to inspect the result before deciding to save it.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getProfile }   from "@/lib/repositories/profiles";
import { runOrchestrator } from "@/lib/ai/orchestrator";

const RequestSchema = z.object({
  query: z
    .string({ message: "query is required" })
    .min(3,    { message: "query must be at least 3 characters" })
    .max(1000, { message: "query must be at most 1000 characters" })
    .trim(),
});

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 },
    );
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: { code: "PROFILE_NOT_FOUND", message: "Complete onboarding first" } },
      { status: 403 },
    );
  }

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

  const parsed = RequestSchema.safeParse(body);
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
  const result = await runOrchestrator({ query, supabase });

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
