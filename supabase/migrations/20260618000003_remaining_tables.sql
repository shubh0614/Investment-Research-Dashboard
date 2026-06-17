-- Phase 2.1: Remaining application tables.
-- Builds on organizations + profiles from Phase 1.

-- ── updated_at trigger helper ─────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── research_reports ──────────────────────────────────────────────────────────
create table public.research_reports (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null references public.organizations(id) on delete cascade,
  author_id   uuid        not null references public.profiles(id) on delete cascade,
  title       text        not null,
  query_text  text        not null,
  result_json jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index research_reports_org_created_idx on public.research_reports(org_id, created_at desc);

create trigger research_reports_updated_at
  before update on public.research_reports
  for each row execute function public.set_updated_at();

-- ── report_tags ────────────────────────────────────────────────────────────────
create table public.report_tags (
  id        uuid primary key default gen_random_uuid(),
  org_id    uuid not null references public.organizations(id) on delete cascade,
  report_id uuid not null references public.research_reports(id) on delete cascade,
  tag       text not null,
  unique (report_id, tag)
);
create index report_tags_org_tag_idx on public.report_tags(org_id, tag);

-- ── watchlist_items ────────────────────────────────────────────────────────────
create table public.watchlist_items (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  ticker       text        not null,
  company_name text        not null,
  created_at   timestamptz not null default now(),
  unique (user_id, ticker)
);
create index watchlist_items_org_user_idx on public.watchlist_items(org_id, user_id);

-- ── documents ─────────────────────────────────────────────────────────────────
create table public.documents (
  id           uuid        primary key default gen_random_uuid(),
  org_id       uuid        not null references public.organizations(id) on delete cascade,
  company      text        not null,
  doc_type     text        not null,
  title        text        not null,
  source_label text        not null,
  created_at   timestamptz not null default now()
);
create index documents_org_company_idx on public.documents(org_id, company);

-- ── document_chunks ────────────────────────────────────────────────────────────
-- Embedding dimension: 1536 (OpenAI text-embedding-3-small).
-- HNSW vector index is deferred to Phase 3 after embeddings are populated.
create table public.document_chunks (
  id          uuid    primary key default gen_random_uuid(),
  org_id      uuid    not null references public.organizations(id) on delete cascade,
  document_id uuid    not null references public.documents(id) on delete cascade,
  chunk_index integer not null,
  content     text    not null,
  embedding   vector(1536),
  token_count integer not null default 0
);
create index document_chunks_org_idx      on public.document_chunks(org_id);
create index document_chunks_document_idx on public.document_chunks(document_id);

-- ── query_cache ────────────────────────────────────────────────────────────────
-- Not tenant-scoped: stores only public market/news API payloads.
create table public.query_cache (
  id           uuid        primary key default gen_random_uuid(),
  cache_key    text        unique not null,
  payload_json jsonb       not null,
  fetched_at   timestamptz not null default now(),
  expires_at   timestamptz not null
);
create index query_cache_key_idx     on public.query_cache(cache_key);
create index query_cache_expires_idx on public.query_cache(expires_at);

-- ── audit_events ───────────────────────────────────────────────────────────────
create table public.audit_events (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null references public.organizations(id) on delete cascade,
  actor_id      uuid        references public.profiles(id) on delete set null,
  action        text        not null,
  entity_type   text,
  entity_id     uuid,
  metadata_json jsonb,
  created_at    timestamptz not null default now()
);
create index audit_events_org_created_idx on public.audit_events(org_id, created_at desc);
