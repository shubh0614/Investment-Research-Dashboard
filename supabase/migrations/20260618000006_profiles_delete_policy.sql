-- Phase admin: allow admins to remove other members from their org.
--
-- WHY this policy exists:
-- The original profiles RLS only covered select/insert/update.
-- An admin removing a member is a legitimate org-management action;
-- the policy gates it at the DB tier (same defense-in-depth principle
-- as all other RLS) rather than relying solely on the app-layer check.
--
-- WHY the two conditions:
-- 1. org_id = current_org_id()   - can only remove members in their own org
-- 2. id != auth.uid()            - cannot remove themselves (DB-tier guard)
-- The "admin only" part is enforced by current_user_role() = 'admin'.

create policy profiles_delete on public.profiles
  for delete using (
    org_id = public.current_org_id()
    and public.current_user_role() = 'admin'
    and id != auth.uid()
  );
