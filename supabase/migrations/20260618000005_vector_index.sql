-- Phase 3: indexes for knowledge-base retrieval.

-- HNSW vector similarity index (cosine distance, <=> operator).
-- m=16, ef_construction=64 are standard defaults; fine for hundreds of chunks.
create index document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- GIN full-text index so plainto_tsquery / websearch_to_tsquery are index-backed.
-- Required for .textSearch() in the keyword fallback path.
create index document_chunks_content_fts_idx
  on public.document_chunks
  using gin (to_tsvector('english', content));
