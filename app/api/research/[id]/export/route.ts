import { type NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireAuth } from "@/lib/api/auth";
import { getReport } from "@/lib/services/research";
import { buildCsv } from "@/lib/export/csv";
import { ReportPdfDocument } from "@/lib/export/pdf-document";
import type { ResearchReport } from "@/lib/ai/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format") ?? "csv";

  if (format !== "pdf" && format !== "csv") {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_FORMAT", message: "format must be pdf or csv" } },
      { status: 400 },
    );
  }

  const row = await getReport(auth.ctx.supabase, id, auth.ctx.orgId);
  if (!row) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Report not found" } },
      { status: 404 },
    );
  }

  const r = row.result_json as unknown as ResearchReport;
  if (!r) {
    return NextResponse.json(
      { ok: false, error: { code: "REPORT_DATA_UNAVAILABLE", message: "Report has no result data" } },
      { status: 422 },
    );
  }

  const slug = row.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);
  const date = new Date(row.created_at).toISOString().slice(0, 10);
  const filename = `klypup-${slug}-${date}`;

  if (format === "pdf") {
    const buffer = await renderToBuffer(
      createElement(ReportPdfDocument, { title: row.title, query: row.query_text, report: r }),
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // CSV
  const csv = buildCsv(row.title, row.query_text, r);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
