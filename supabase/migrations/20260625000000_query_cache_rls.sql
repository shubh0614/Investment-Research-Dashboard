-- Enable RLS on query_cache.
-- The table is a shared server-side cache; the app always accesses it via
-- the service_role key which bypasses RLS. Direct REST access by JWT clients
-- is blocked by the deny-all policy below.

ALTER TABLE public.query_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny direct rest access"
  ON public.query_cache
  FOR ALL
  USING (false);
