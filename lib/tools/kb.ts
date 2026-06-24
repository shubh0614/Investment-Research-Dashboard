import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQuery } from "@/lib/ai/embed";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KBChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number | null;   // null when keyword fallback was used
  doc_title: string;
  source_label: string;
  company: string;
}

export type KBResult =
  | { ok: true;  data: KBChunk[]; retrieval_method: "vector" | "keyword" }
  | { ok: false; error: string };

// ── Retriever ─────────────────────────────────────────────────────────────────

const MAX_RESULTS   = 8;
const MIN_SIM_SCORE = 0.3; // cosine similarity floor - below this is noise

/**
 * Tenant-scoped knowledge-base search.
 *
 * Primary:  vector similarity using the pre-embedded query (requires OpenAI key).
 * Fallback: keyword ILIKE search when embeddings are unavailable.
 *
 * RLS enforces tenant isolation: the session-bound client automatically
 * restricts document_chunks to the caller's org_id.
 */
export async function searchKnowledgeBase(
  query: string,
  supabase: SupabaseClient,
  company?: string,
): Promise<KBResult> {
  try {
    const queryEmbedding = await embedQuery(query);

    if (queryEmbedding) {
      return vectorSearch(query, queryEmbedding, supabase, company);
    }

    console.log("[kb] No query embedding - using keyword fallback");
    return keywordSearch(query, supabase, company);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[kb] FAIL query="${query}" error=${msg}`);
    return { ok: false, error: msg };
  }
}

// ── Vector path ───────────────────────────────────────────────────────────────

async function vectorSearch(
  query: string,
  embedding: number[],
  supabase: SupabaseClient,
  company?: string,
): Promise<KBResult> {
  // Resolve the caller's org_id from their session (needed for RPC isolation).
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found");

  // Use RPC to avoid embedding the 1536-float vector in a URL parameter,
  // which exceeds PostgREST's URL length limit (~8KB).
  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: embedding as unknown as string,
    match_threshold: MIN_SIM_SCORE,
    match_count:     MAX_RESULTS,
    p_org_id:        profile.org_id,
    p_company:       company?.toUpperCase() ?? null,
  });

  if (error) throw new Error(error.message);

  const chunks: KBChunk[] = (data ?? []).map((row: {
    id: string; document_id: string; chunk_index: number;
    content: string; similarity: number;
    doc_title: string; source_label: string; company: string;
  }) => ({
    id:           row.id,
    document_id:  row.document_id,
    chunk_index:  row.chunk_index,
    content:      row.content,
    similarity:   row.similarity,
    doc_title:    row.doc_title,
    source_label: row.source_label,
    company:      row.company,
  }));

  console.log(`[kb] vector search query="${query}" results=${chunks.length}`);
  return { ok: true, data: chunks, retrieval_method: "vector" };
}

// ── Keyword fallback path ─────────────────────────────────────────────────────

async function keywordSearch(
  query: string,
  supabase: SupabaseClient,
  company?: string,
): Promise<KBResult> {
  // Split query into words and filter chunks containing at least one word.
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5);

  if (!words.length) return { ok: true, data: [], retrieval_method: "keyword" };

  // Use full-text search (to_tsvector) for better matching than ILIKE
  const tsQuery = words.join(" | ");

  let q = supabase
    .from("document_chunks")
    .select(
      `id, document_id, chunk_index, content, token_count,
       documents!inner(title, source_label, company)`,
    )
    .textSearch("content", tsQuery, { type: "plain" })
    .limit(MAX_RESULTS);

  if (company) {
    q = q.eq("documents.company", company.toUpperCase());
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const chunks: KBChunk[] = (data ?? []).map((row) => {
    const doc = (row.documents as unknown) as { title: string; source_label: string; company: string };
    return {
      id:           row.id,
      document_id:  row.document_id,
      chunk_index:  row.chunk_index,
      content:      row.content,
      similarity:   null,
      doc_title:    doc.title,
      source_label: doc.source_label,
      company:      doc.company,
    };
  });

  console.log(`[kb] keyword search query="${query}" results=${chunks.length}`);
  return { ok: true, data: chunks, retrieval_method: "keyword" };
}
