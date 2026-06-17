-- Supabase CLI v2 no longer auto-exposes new tables to the API roles.
-- These GRANTs are required for PostgREST to reach the tables at all.
-- RLS policies (not GRANT restrictions) enforce who can read/write which rows.

-- organizations: authenticated users and service_role need full DML;
-- anon needs SELECT so the RLS helper current_org_id() can resolve safely.
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organizations to service_role;
grant select                          on public.organizations to anon;

-- profiles: authenticated and service_role need full DML.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
