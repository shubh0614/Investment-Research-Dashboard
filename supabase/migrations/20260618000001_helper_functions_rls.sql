-- Phase 1.2: Security-definer helpers and RLS policies.
--
-- WHY security definer on the helpers:
-- current_org_id() reads profiles to find the caller's org. If it ran
-- with the caller's rights under RLS, the profiles policy (which calls
-- current_org_id()) would recurse infinitely. security definer bypasses
-- RLS on that one internal lookup, breaking the cycle while keeping the
-- guarantee that every other query is still restricted.

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ── Organizations ──────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;

-- A user may only see their own organization.
create policy organizations_select on public.organizations
  for select using (id = public.current_org_id());

-- ── Profiles ───────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- A user may read their own row or any row in their org (so org members are visible).
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or org_id = public.current_org_id());

-- A user may only insert their own profile (enforced by the primary-key FK to auth.users).
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

-- A user may only update their own profile row.
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
