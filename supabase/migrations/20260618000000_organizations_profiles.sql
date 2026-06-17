-- Phase 1.1: Organizations, profiles, and the role enum.
-- These are the tenant root and the user-tenant binding; everything else
-- references org_id from profiles.

create type public.user_role as enum ('admin', 'analyst');

create table public.organizations (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  -- 6-byte random hex used as the org invite code; unique at the table level.
  invite_code text        unique not null default encode(gen_random_bytes(6), 'hex'),
  created_at  timestamptz not null default now()
);

create table public.profiles (
  -- id mirrors the Supabase auth user id so there is exactly one profile per user.
  id          uuid             primary key references auth.users(id) on delete cascade,
  org_id      uuid             not null references public.organizations(id) on delete cascade,
  email       text             not null,
  full_name   text,
  role        public.user_role not null default 'analyst',
  created_at  timestamptz      not null default now()
);

-- Leads with org_id because every profile query is tenant-scoped first.
create index profiles_org_id_idx on public.profiles(org_id);
