/**
 * Research report CRUD service.
 *
 * All queries are org-scoped (defense in depth on top of RLS).
 * Tags are managed as a replace-all on update: delete existing then bulk insert.
 * report_id/org_id re-check on every read/write prevents cross-tenant access
 * even if a guessed ID is passed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResearchReport } from "@/lib/ai/schemas";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReportRow {
  id:           string;
  org_id:       string;
  author_id:    string;
  author_name:  string | null;
  author_email: string | null;
  title:        string;
  query_text:   string;
  result_json:  ResearchReport | null;
  created_at:   string;
  updated_at:   string;
  tags:         string[];
}

export interface ReportSummary {
  id:           string;
  title:        string;
  query_text:   string;
  created_at:   string;
  updated_at:   string;
  author_id:    string;
  author_name:  string | null;
  author_email: string | null;
  tags:         string[];
}

export interface SaveReportInput {
  title:       string;
  query_text:  string;
  result_json: ResearchReport;
  tags?:       string[];
}

export interface ListReportsOptions {
  tag?:    string;
  q?:      string;
  limit?:  number;
  offset?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Attach tags array to report rows by looking up report_tags. */
async function attachTags(
  supabase:  SupabaseClient,
  reportIds: string[],
): Promise<Map<string, string[]>> {
  const tagMap = new Map<string, string[]>();
  if (!reportIds.length) return tagMap;

  const { data } = await supabase
    .from("report_tags")
    .select("report_id, tag")
    .in("report_id", reportIds);

  for (const row of data ?? []) {
    const existing = tagMap.get(row.report_id) ?? [];
    existing.push(row.tag);
    tagMap.set(row.report_id, existing);
  }
  return tagMap;
}

// ── Service functions ──────────────────────────────────────────────────────────

export async function saveReport(
  supabase:  SupabaseClient,
  orgId:     string,
  authorId:  string,
  input:     SaveReportInput,
): Promise<ReportRow> {
  const { data, error } = await supabase
    .from("research_reports")
    .insert({
      org_id:      orgId,
      author_id:   authorId,
      title:       input.title,
      query_text:  input.query_text,
      result_json: input.result_json,
    })
    .select("id, org_id, author_id, title, query_text, result_json, created_at, updated_at")
    .single();

  if (error) throw new Error(`Failed to save report: ${error.message}`);

  const tags = input.tags ?? [];
  if (tags.length) {
    const { error: tagErr } = await supabase.from("report_tags").insert(
      tags.map((tag) => ({ org_id: orgId, report_id: data.id, tag })),
    );
    if (tagErr) throw new Error(`Failed to save tags: ${tagErr.message}`);
  }

  return { ...(data as Omit<ReportRow, "tags">), tags };
}

export async function listReports(
  supabase: SupabaseClient,
  orgId:    string,
  options:  ListReportsOptions = {},
): Promise<{ reports: ReportSummary[]; total: number }> {
  const { tag, q, limit = 20, offset = 0 } = options;

  // If a tag filter is requested, first resolve matching report IDs.
  let tagFilterIds: string[] | null = null;
  if (tag) {
    const { data: tagRows } = await supabase
      .from("report_tags")
      .select("report_id")
      .eq("org_id", orgId)
      .eq("tag", tag);
    tagFilterIds = (tagRows ?? []).map((r: { report_id: string }) => r.report_id);
    if (!tagFilterIds.length) {
      return { reports: [], total: 0 };
    }
  }

  // Main query - no result_json (too large for a list)
  let query = supabase
    .from("research_reports")
    .select("id, title, query_text, author_id, created_at, updated_at, profiles!author_id(full_name, email)", { count: "exact" })
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tagFilterIds) {
    query = query.in("id", tagFilterIds);
  }
  if (q) {
    query = query.or(`title.ilike.%${q}%,query_text.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to list reports: ${error.message}`);

  type ProfileShape = { full_name: string | null; email: string | null };
  type RawRow = Omit<ReportSummary, "tags" | "author_name" | "author_email"> & {
    profiles: ProfileShape[] | ProfileShape | null;
  };
  const rows = (data ?? []) as unknown as RawRow[];
  const tagMap = await attachTags(supabase, rows.map((r) => r.id));

  return {
    reports: rows.map((r) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        ...r,
        author_name:  profile?.full_name  ?? null,
        author_email: profile?.email      ?? null,
        tags:         tagMap.get(r.id) ?? [],
      };
    }),
    total: count ?? 0,
  };
}

export async function getReport(
  supabase:  SupabaseClient,
  reportId:  string,
  orgId:     string,
): Promise<ReportRow | null> {
  const { data, error } = await supabase
    .from("research_reports")
    .select("id, org_id, author_id, title, query_text, result_json, created_at, updated_at, profiles!author_id(full_name, email)")
    .eq("id", reportId)
    .eq("org_id", orgId)
    .single();

  if (error || !data) return null;

  const raw = data as unknown as Omit<ReportRow, "tags" | "author_name" | "author_email"> & {
    profiles: { full_name: string | null; email: string | null }[] | { full_name: string | null; email: string | null } | null;
  };
  const profile = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
  const tagMap = await attachTags(supabase, [reportId]);
  return {
    ...raw,
    author_name:  profile?.full_name  ?? null,
    author_email: profile?.email      ?? null,
    tags:         tagMap.get(reportId) ?? [],
  };
}

export interface UpdateReportInput {
  title?: string;
  tags?:  string[];
}

export async function updateReport(
  supabase:  SupabaseClient,
  reportId:  string,
  orgId:     string,
  input:     UpdateReportInput,
): Promise<ReportRow | null> {
  // Verify ownership before mutating
  const existing = await getReport(supabase, reportId, orgId);
  if (!existing) return null;

  if (input.title !== undefined) {
    const { error } = await supabase
      .from("research_reports")
      .update({ title: input.title })
      .eq("id", reportId)
      .eq("org_id", orgId);
    if (error) throw new Error(`Failed to update report: ${error.message}`);
  }

  if (input.tags !== undefined) {
    // Replace-all: delete existing tags then insert the new set
    const { error: delErr } = await supabase
      .from("report_tags")
      .delete()
      .eq("report_id", reportId)
      .eq("org_id", orgId);
    if (delErr) throw new Error(`Failed to clear tags: ${delErr.message}`);

    if (input.tags.length) {
      const { error: insErr } = await supabase.from("report_tags").insert(
        input.tags.map((tag) => ({ org_id: orgId, report_id: reportId, tag })),
      );
      if (insErr) throw new Error(`Failed to insert tags: ${insErr.message}`);
    }
  }

  return getReport(supabase, reportId, orgId);
}

export async function deleteReport(
  supabase:  SupabaseClient,
  reportId:  string,
  orgId:     string,
): Promise<boolean> {
  const { error, count } = await supabase
    .from("research_reports")
    .delete({ count: "exact" })
    .eq("id", reportId)
    .eq("org_id", orgId);

  if (error) throw new Error(`Failed to delete report: ${error.message}`);
  return (count ?? 0) > 0;
}
