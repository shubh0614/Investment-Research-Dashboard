# Klypup — Investment Research Dashboard

> **Option A** · Klypup Applied AI Intern Technical Assessment

An AI-powered research workspace where an analyst types a natural-language question and receives a structured, sourced report in seconds — complete with live market data, financial news with sentiment, knowledge-base filings, and a price chart. Built as a multi-tenant SaaS with database-tier isolation and role-based access control.

---

## Why Option A

Option A's hardest problem — multi-tenant data isolation over a vector knowledge base with a light agentic AI layer — maps directly onto the rubric's highest-weighted criteria (15% multi-tenancy, 25% AI quality). It let me go deep on both rather than spread thin across five agents as Option B requires. Full rationale in [DECISIONS.md](DECISIONS.md).

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Full-stack framework | **Next.js 16 (App Router)** | One type system spans the API contract, AI output, and UI components — no integration bugs at the model/UI seam |
| Database + Auth + Vectors | **Supabase (Postgres + RLS + pgvector)** | Collapses auth, relational store, tenant isolation, and vector store into one vetted service |
| AI orchestration | **Vercel AI SDK v6** | Provider-agnostic; swap Groq → OpenAI → Anthropic via one env var |
| LLM (default) | **Groq (free tier)** | Zero-cost for development; any provider works |
| Styling | **Tailwind v4 + CSS custom properties** | Fully tokenized design system, dark-by-default, WCAG AA |
| State management | **TanStack Query v5** | Correct loading/error/empty states and cache invalidation without boilerplate |
| Language | **TypeScript throughout** | Shared types from DB schema → AI output → UI render |

---

## Features

- **Agentic research** — model selects which data tools to call from the query (market data, news, knowledge base); independent tools run in parallel
- **Structured reports** — company cards, price chart (Recharts), comparison tables, sentiment-badged news, risk section; every datum carries a source chip
- **Source attribution** — enforced by a Zod schema: no factual field may have an empty `sources` array
- **Multi-tenant isolation** — RLS policies enforce `org_id` at the Postgres tier; a cross-tenant guessed ID returns 0 rows, not an application-layer check
- **RBAC** — admin and analyst roles; admin-only endpoints return 403 for analysts at both the API and database tiers
- **Read-through cache** — `query_cache` table absorbs repeated tool calls; demo tickers pre-warmed by seed script so live APIs are never required during demo
- **Command palette** — `⌘K` / `Ctrl+K` for keyboard-first navigation
- **Theme** — dark by default, working light mode, persisted preference

---

## Architecture

Five diagrams (system overview, query data flow, ER, AI orchestration, multi-tenant isolation proof) and the full API reference are in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Local Setup

### Prerequisites

- **Node.js 20+** — `node --version`
- **Docker Desktop** running (Supabase uses Docker internally)
- **Supabase CLI** — installed via npm devDependencies (`npx supabase`)
- A **Groq API key** — free at [console.groq.com](https://console.groq.com) (no credit card)
- Optional: OpenAI key for KB embeddings (seed falls back to keyword search if absent)

### Step-by-step

```bash
# 1. Clone and install
git clone <repo-url>
cd "Klypup Assignment A"
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — fill in at minimum:
#   LLM_API_KEY=<your-groq-key>
# The Supabase keys are the default local-dev keys and work as-is.

# 3. Start local Supabase (starts Docker containers)
npm run db:start
# Wait for: "Started supabase local development setup."
# Note the API URL and keys printed — they match .env.example defaults.

# 4. Seed the database
# Creates two orgs, four users, synthetic KB documents, and pre-warms query_cache.
npm run seed

# 5. Start the dev server
npm run dev

# 6. Open http://localhost:3000
```

### Demo accounts (created by seed)

| Email | Password | Org | Role |
|---|---|---|---|
| alice@alpha.test | password123 | Alpha Capital | admin |
| bob@alpha.test | password123 | Alpha Capital | analyst |
| carol@beta.test | password123 | Beta Ventures | admin |
| dave@beta.test | password123 | Beta Ventures | analyst |

### Verify isolation

```bash
# Requires: supabase start + npm run seed + npm run dev (all running)
npm run test:isolation
```

Expected output: all assertions pass, including the cross-tenant read denial and the admin/analyst RBAC gate.

---

## Production Deployment (Docker)

```bash
# Build and run the Next.js app in a container
# (Supabase must be accessible — point to a hosted Supabase project)
docker compose up --build
```

The `docker-compose.yml` builds the Next.js app. For Supabase, use a hosted project and update `NEXT_PUBLIC_SUPABASE_URL` and the key env vars in `.env.local` before building.

---

## Project Structure

```
app/
  (auth)/          Login and signup pages
  (protected)/     All authenticated routes (dashboard, research, history, watchlist, admin)
  api/             Route handlers — thin HTTP layer only
lib/
  ai/              Orchestrator, planner, executor, synthesizer, Zod schemas
  services/        Business logic (research, org, watchlist)
  repositories/    Data access (profiles, reports, watchlist)
  tools/           Tool clients (market, news, KB retriever)
  llm.ts           Provider-agnostic LLM gateway (Vercel AI SDK v6)
  supabase/        Server and browser Supabase clients
components/
  layout-shell.tsx Collapsible sidebar shell (client component)
  nav-sidebar.tsx  Navigation with glowing active indicator
  ui/              Toaster, skeletons, shared primitives
supabase/
  migrations/      All DB migrations (schema → RLS → indexes → grants)
scripts/
  seed.mjs         Idempotent two-org seed with KB embeddings
  test-isolation.mjs  Phase 7 isolation + RBAC test suite
```

---

## npm Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run db:start` | Start local Supabase via Docker |
| `npm run db:stop` | Stop local Supabase |
| `npm run db:reset` | Reset local DB and re-run all migrations |
| `npm run seed` | Idempotent seed (safe to re-run) |
| `npm run test:isolation` | Run the Phase 7 isolation + RBAC test suite |
| `npm run lint` | ESLint |

---

## Three Demo Workflows

### 1. Core AI feature
Log in as `alice@alpha.test`. Go to **New Research** and submit:
> *"Give me an overview of NVIDIA: this quarter's stock performance, major news in the last 30 days, and key risks."*

Watch the step progress indicator (Planning → Running → Synthesizing). The report renders with company cards, a price chart, sentiment-badged news items, a risk section, and a source chip on every claim. The AI reasoning panel at the bottom shows which tools were called.

### 2. Multi-tenant isolation
Open a second browser window (or incognito). Log in as `carol@beta.test`. Confirm the dashboard shows only Beta Ventures data. Copy an Alpha Capital report URL from the first window and paste it into the second — the app returns a 404. Run `npm run test:isolation` to see the DB-tier proof.

### 3. Role-based access
Log in as `alice@alpha.test` (admin). Open the **Admin** panel — invite code and member list are visible. Log in as `bob@alpha.test` (analyst). The Admin link is absent from the sidebar; a direct request to `/api/org/members` returns 403.

---

## Known Limitations

- **Single org per user.** A user belongs to exactly one organization. Multi-org membership is designed (the data model supports it) but not implemented in the MVP. Documented as a deliberate scope cut in `DECISIONS.md`.
- **No role-change UI.** Admins can remove members but cannot promote an analyst to admin via the UI. The RLS and service plumbing exist; the management surface does not. Documented as a Won't-for-MVP item.
- **Synthetic knowledge base.** The KB contains 4–6 hand-authored synthetic filings for NVDA, AMD, INTC, and MSFT. Real SEC filing ingestion would use the same pipeline unchanged; the volume is intentionally small to keep the seed fast.
- **Embeddings require an OpenAI key.** The seed script falls back to keyword-only search if `OPENAI_API_KEY` is absent. The demo still works; semantic retrieval is disabled.
- **Groq rate limits.** The free Groq tier has a token-per-minute limit. Back-to-back research queries may hit this. The app returns a clear error and does not crash.

---

## Key Design Decisions

See [DECISIONS.md](DECISIONS.md) for the full decision ledger. Short version:

1. **Full-stack monolith** — one type system, one deployment, no premature service decomposition
2. **RLS for isolation** — invariant lives at the data tier, not in every WHERE clause
3. **pgvector colocated** — same RLS policies protect relational data and the knowledge base
4. **Provider-agnostic AI gateway** — swap the LLM via env var, not a rewrite
5. **Agentic, not a pipeline** — model selects tools; a news-only query never hits the market API
6. **Strict Zod schema** — sources are a required field; the validator rejects an unsourced report

---

## Architecture Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — five diagrams (system, data flow, ER, AI orchestration, multi-tenant proof) + API reference
- [DECISIONS.md](DECISIONS.md) — seven-question decision ledger (option choice, stack, multi-tenancy, AI design, trade-offs, two-more-weeks, hardest part)
