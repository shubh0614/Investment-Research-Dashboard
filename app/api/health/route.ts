import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";

export async function GET() {
  try {
    const supabase = await createClient();
    // Minimal round-trip - just checks connectivity, not a real query.
    const { error } = await supabase.from("_health_check").select("1").limit(1).maybeSingle();

    // A missing-table error means the DB is reachable - the table just doesn't exist yet.
    // PostgreSQL returns code 42P01 ("undefined_table"); PostgREST returns a "schema cache" message.
    const dbOk =
      !error ||
      error.code === "42P01" ||
      (error.message ?? "").toLowerCase().includes("schema cache");

    if (!dbOk) {
      return NextResponse.json(
        { ok: false, error: { code: "DB_UNREACHABLE", message: error!.message } },
        { status: 503 }
      );
    }

    const llmOk = config.LLM_API_KEY.length > 0;
    return NextResponse.json({ ok: true, data: { db: "ok", llm: llmOk ? "ok" : "not_configured" } });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "HEALTH_CHECK_FAILED", message: String(err) },
      },
      { status: 503 }
    );
  }
}
