/**
 * Shared auth helper for route handlers.
 *
 * Every protected route does the same two-step check:
 * 1. Supabase session → get user
 * 2. Profiles table   → get profile (which carries org_id and role)
 *
 * This helper centralises that logic so route handlers stay thin:
 * only HTTP, auth, validation, and a single service call.
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/repositories/profiles";

export interface AuthContext {
  supabase: SupabaseClient;
  userId:   string;
  orgId:    string;
  role:     "admin" | "analyst";
  email:    string;
}

type AuthResult =
  | { ok: true;  ctx: AuthContext }
  | { ok: false; response: NextResponse };

/**
 * Resolve the calling user's session and profile.
 * Returns a typed context or a ready-to-return error response.
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 },
      ),
    };
  }

  const profile = await getProfile(supabase, user.id);
  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: { code: "PROFILE_NOT_FOUND", message: "Profile not found — complete onboarding first" } },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      supabase,
      userId: user.id,
      orgId:  profile.org_id,
      role:   profile.role,
      email:  profile.email,
    },
  };
}

/**
 * Like requireAuth but also enforces admin role.
 * Returns 403 for authenticated analysts.
 */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();
  if (!result.ok) return result;

  if (result.ctx.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: { code: "FORBIDDEN", message: "Admin role required" } },
        { status: 403 },
      ),
    };
  }

  return result;
}
