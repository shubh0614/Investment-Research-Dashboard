import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    // Minimal round-trip — just checks connectivity, not a real query.
    const { error } = await supabase.from("_health_check").select("1").limit(1).maybeSingle();

    // A "relation does not exist" error still means the DB is reachable.
    const dbOk = !error || error.code === "42P01";

    if (!dbOk) {
      return NextResponse.json(
        { ok: false, error: { code: "DB_UNREACHABLE", message: error!.message } },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, data: { db: "ok" } });
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
