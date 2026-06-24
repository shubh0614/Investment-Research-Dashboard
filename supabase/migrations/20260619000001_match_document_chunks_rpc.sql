-- RPC for vector similarity search on document_chunks.
-- Using a function avoids passing the 1536-float embedding as a URL parameter,
-- which exceeds PostgREST's URL length limit (~8KB).
create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count     int,
  p_org_id        uuid,
  p_company       text default null
)
returns table (
  id            uuid,
  document_id   uuid,
  chunk_index   int,
  content       text,
  token_count   int,
  similarity    float,
  doc_title     text,
  source_label  text,
  company       text
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    dc.token_count,
    1 - (dc.embedding <=> query_embedding) as similarity,
    d.title        as doc_title,
    d.source_label as source_label,
    d.company      as company
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where
    d.org_id = p_org_id
    and (p_company is null or d.company = upper(p_company))
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
