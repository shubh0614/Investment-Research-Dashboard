# CLAUDE CODE KICKOFF — PHASE 0 + PHASE 1 ONLY

Paste this into Claude Code at the root of an empty repository. Build **only** Phase 0 and Phase 1. **Stop at every GATE and wait for my confirmation. Do not build ahead into Phase 2 or later.**

`CONSTITUTION.md` (v1.1) is the law. This prompt scopes the first two phases and pre-stages the multi-tenant patterns so they are correct and explainable. If anything here conflicts with the constitution, the constitution wins and you flag it.

---

## GROUND RULES (from the Engineering Constitution, Part 2)

- Stack: Next.js 16 (App Router, TypeScript), Supabase (Auth + Postgres + RLS), Tailwind + shadcn/ui. Use the Supabase CLI for versioned SQL migrations and local dev. Use `@supabase/ssr` for session-bound server and client helpers; confirm the current Supabase Next.js App Router auth pattern against the live Supabase docs before writing the client, since that API moves.
- Twelve-factor config. A single Zod-validated env module loads and validates all env vars at startup and the app refuses to boot with a clear message if one is missing. Maintain `.env.example` with every var documented and a safe placeholder. Never commit secrets.
- Layering: route handlers do HTTP, auth, and Zod validation only, then call services, which call repositories. No business logic in routes, no SQL in services.
- Every API response uses the envelope `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`, with correct status codes (401 vs 403 never conflated; 422 for validation).
- Conventional Commits, small and frequent, the body explaining the decision. Commit at each completed step.
- A step is done only when its machine test passes on a clean run.

---

## CONCEPTS YOU MUST IMPLEMENT EXACTLY (multi-tenancy)

Tenant isolation is enforced at the database via RLS. Use this precise pattern. Do not invent your own.

**Helper functions (security definer, so they bypass RLS and avoid recursion):**
```sql
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
```

**Every tenant-owned table (from Phase 2 onward) uses this one-policy template:**
```sql
alter table public.<table> enable row level security;
create policy tenant_isolation on public.<table>
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());
```

**Service role vs user session:** tenant reads and writes run through a per-request Supabase server client bound to the user's session, so RLS applies and `auth.uid()` is set. The service-role client bypasses RLS and is used only for trusted server operations (onboarding transaction, seed). Never use the service role for ordinary tenant queries.

---

## PHASE 0 — FOUNDATIONS

**0.1 Repo and tooling.** Initialize Next.js 16 App Router with TypeScript. Add Tailwind, shadcn/ui, ESLint, Prettier, a complete `.gitignore` (no `node_modules`, no `.env*`, no build output), and the Conventional Commits convention. 

**0.2 Config module.** Create a typed config module that reads env via a Zod schema and throws a clear, named error at startup if a required var is missing. Seed `.env.example` per Appendix A of the constitution.

**0.3 Supabase local + migrations.** `supabase init`, `supabase start` (local stack via Docker), and a first migration that enables required extensions. Wire a `/api/health` route that checks database reachability and returns the standard envelope.

### GATE 0 — STOP. Confirm before continuing.
Machine tests I will run:
- `npm run dev` serves the app; `npm run lint` passes.
- Removing a required env var makes the app refuse to boot with a clear message.
- `supabase start` is up; the migration applied; `GET /api/health` returns `{ ok: true }` with a database OK.
Commit, then wait for my go.

---

## PHASE 1 — THE MULTI-TENANT SPINE

**1.1 Schema for organizations and profiles.** Migration:
```sql
create type public.user_role as enum ('admin','analyst');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default encode(gen_random_bytes(6),'hex'),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'analyst',
  created_at timestamptz not null default now()
);
create index profiles_org_id_idx on public.profiles(org_id);
```

**1.2 Helper functions and RLS** (use the exact functions above). Enable RLS on both tables and add policies:
```sql
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

-- organizations: you can read only your own org
create policy organizations_select on public.organizations
  for select using (id = public.current_org_id());

-- profiles: read your own row or anyone in your org; write only your own row
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or org_id = public.current_org_id());
create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
```
Note in a code comment why `current_org_id()` is `security definer`: it reads profiles while bypassing RLS so the profiles policy does not recurse.

### GATE 1 — STOP. This is the block I must understand. Confirm before continuing.
Machine test (run via the Supabase SQL editor or a script): create two organizations and two users, one user in each, insert their profiles with the service role, then, simulating each user's auth context, assert that user A's `select` on profiles and organizations returns only org A's rows and zero of org B's. A cross-tenant read must return no rows.
Pause here and explain the policies back to me in plain language before we proceed.

**1.3 Supabase Auth + onboarding.** Wire signup, login, logout, and session using the Supabase client and `@supabase/ssr` server helpers (no custom auth endpoints). Add `GET /api/me` returning the current user, org, and role from the session-bound client. Add `POST /api/onboarding` (server, using the service-role client for one trusted transaction):
- mode `create`: insert an organization, then insert the caller's profile as `admin`.
- mode `join`: resolve the org by `invite_code`, then insert the caller's profile as `analyst`.
- A user may onboard only once (enforced by the profiles primary key on the user id).
After signup and first login, if the user has no profile, route them to an onboarding screen (create org or enter invite code).

### GATE 2 — STOP. Confirm before continuing.
Machine test: script or click through two signups. User 1 creates Org A (becomes admin). User 2 joins Org B via its invite code (becomes analyst). `GET /api/me` returns the correct org and role for each. Logged in as each user through the session-bound client, each sees only their own org's data. A direct attempt by user 2 to read an Org A profile returns nothing.

**1.4 Tenant and role middleware.** Add middleware that, on every protected request, resolves the session, loads the caller's `org_id` and `role`, and exposes them to services. Protect app routes (unauthenticated access redirects to login). Add a temporary admin-only test route that returns 200 for an admin and 403 for an analyst, to prove role enforcement (remove it once verified).

### GATE 3 — STOP. CHECKPOINT A reached.
Machine test: unauthenticated access to a protected route redirects to login. The admin-only test route returns 200 for the admin and 403 for the analyst. `GET /api/me` is correct for both. Auth and database-tier isolation now work for two orgs and two roles.
Commit, update `INTERVIEW_PREP.md` with anything learned, and wait. We resume at Phase 2 (the rest of the schema and the seed) in the next kickoff.

---

## DO NOT, IN THESE TWO PHASES
- Do not build research, tools, the AI layer, the dashboard, or any Phase 2+ table.
- Do not use the service-role client for ordinary tenant queries.
- Do not skip a GATE. If a machine test fails, stop and fix before moving on.
