-- Enable pgcrypto for gen_random_bytes() used in invite_code defaults.
-- Enable vector (pgvector) for the knowledge-base embedding store (Phase 2).
create extension if not exists pgcrypto;
create extension if not exists vector;
