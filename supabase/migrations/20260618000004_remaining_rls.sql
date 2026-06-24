-- Phase 2.2: RLS policies and grants for Phase 2 tables.
-- Pattern: one policy per tenant table gating both reads and writes on org_id.
-- query_cache has no tenant policy - it stores only public market/news data.

alter table public.research_reports  enable row level security;
alter table public.report_tags        enable row level security;
alter table public.watchlist_items    enable row level security;
alter table public.documents          enable row level security;
alter table public.document_chunks    enable row level security;
alter table public.audit_events       enable row level security;

create policy tenant_isolation on public.research_reports
  for all using     (org_id = public.current_org_id())
  with check        (org_id = public.current_org_id());

create policy tenant_isolation on public.report_tags
  for all using     (org_id = public.current_org_id())
  with check        (org_id = public.current_org_id());

create policy tenant_isolation on public.watchlist_items
  for all using     (org_id = public.current_org_id())
  with check        (org_id = public.current_org_id());

create policy tenant_isolation on public.documents
  for all using     (org_id = public.current_org_id())
  with check        (org_id = public.current_org_id());

create policy tenant_isolation on public.document_chunks
  for all using     (org_id = public.current_org_id())
  with check        (org_id = public.current_org_id());

create policy tenant_isolation on public.audit_events
  for all using     (org_id = public.current_org_id())
  with check        (org_id = public.current_org_id());

-- ── Grants ─────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.research_reports to authenticated, service_role;
grant select, insert, update, delete on public.report_tags       to authenticated, service_role;
grant select, insert, update, delete on public.watchlist_items   to authenticated, service_role;
grant select, insert, update, delete on public.documents         to authenticated, service_role;
grant select, insert, update, delete on public.document_chunks   to authenticated, service_role;
grant select, insert, update, delete on public.query_cache       to authenticated, service_role;
grant select, insert, update, delete on public.audit_events      to authenticated, service_role;
