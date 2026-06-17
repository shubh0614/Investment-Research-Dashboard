# INTERVIEW PREP — KLYPUP
### The knowledge base. Every decision in interview language, plus questions and answers.

This file grows as we build. Rule: when a decision is made during implementation, add its one-line answer, its merit reason, the alternative rejected, and the likely follow-up here, before moving on. Klypup grades on "if you can't explain it, it doesn't count." This is the file you study before the room.

---

## SECTION 1 — THE DECISIONS, IN INTERVIEW LANGUAGE

### Why Option A?
"Its center of gravity is multi-tenant data isolation over a knowledge base with a light, request-scoped AI tool-orchestration layer. The hardest part is isolation and retrieval correctness, which is security-critical and explicitly weighted, so I could go deep on it rather than spread thin across five agents."

### Why Next.js 16 full-stack instead of a separate backend?
One-liner: "It is a single-product MVP for one team, so a modular monolith is the correct architecture. A separate service would add a network boundary, a second deployment, and cross-service auth for no compute reason, which is premature decomposition."
Merit: one type system spans the API contract and the AI's structured output, removing integration bugs at the seam where AI apps break.
Rejected: FastAPI+Next (right only when AI compute is the center of gravity, which is Option B); the FastAPI+Supabase hybrid with session-variable RLS (more failure surface for a marginal gain).

### Why Supabase?
"It collapses auth, Postgres, tenant isolation via RLS, and the vector store via pgvector into one vetted service, and it lets me push isolation into the database tier."
Rejected: rolling my own auth (a security anti-pattern); a separate vector DB (a second isolation implementation and a consistency problem).

### Why RLS for multi-tenancy?
The strongest line: "Isolation cannot be bypassed by a forgotten WHERE clause, because it is enforced at the data layer. Broken object-level authorization is the number-one item on the OWASP API Security Top 10, so I moved the invariant below the application. App-layer scoping is still there as defense in depth, but the database is the authority."
Rejected: app-layer filtering only (strictly weaker); schema-per-tenant (correct at scale, over-engineered for an MVP).

### Why pgvector colocated, not Pinecone or Chroma?
"Because embeddings live in the same Postgres, the same RLS policies protect the knowledge base. Retrieval is tenant-isolated by construction, and I can combine a tenant filter and a vector search in one query. A separate vector store would mean re-implementing isolation a second time and keeping two stores consistent."

### Why a provider-agnostic LLM gateway on the Vercel AI SDK v6?
"No vendor lock-in is an architectural property. The SDK normalizes generation, tool-calling, and Zod structured output across providers, so swapping Groq's free tier for a paid OpenAI or Anthropic model is a config change, not a rewrite. I can benchmark models or add a fallback chain without touching application logic."
Rejected: hard-coding a single provider SDK (couples to one vendor and one tool-call dialect); LangChain.js (heavier abstraction for an orchestration I want to own and explain).

### Why agentic tool-calling instead of a fixed pipeline?
"The model decides which tools to call from the query, so a news-only question never hits the market API. That satisfies the explicit requirement, and it is cheaper and faster."
Rejected: call-all-tools-then-summarize (fails the requirement and wastes rate limit).

### Why a strict Zod schema with validate-and-repair for the AI output?
"The rubric wants structured components and source attribution on every datum, so I made sources a required field in the schema. The same type is what the UI renders, so the model and the UI cannot disagree on shape. Validate-and-repair is the standard way to handle a non-deterministic generator."
Rejected: trusting raw JSON (brittle); regex-parsing prose (fragile, unexplainable).

### Why real APIs behind a cache plus synthetic filings?
"A demo that depends on a rate-limited free API can fail in the room. The read-through cache makes the demo deterministic and doubles as a real caching bonus. Synthetic filings are explicitly allowed and let me control content quality; the ingestion pipeline is what is graded, not the data's provenance."

---

## SECTION 2 — ANTICIPATED QUESTIONS AND ANSWERS

**"Walk me through what happens when a user submits a query."**
UI sends the query to `POST /api/research`. Auth and tenant middleware resolve the user and org. The orchestrator asks the model which tools to call; selected tools run, in parallel where independent, each reading through the cache and returning sourced, typed results. The model synthesizes a Zod-valid ResearchReport with sources on every claim. We validate, repair once if needed, return it, and the UI maps fields to components. The reasoning panel shows which tools actually ran.

**"How exactly does tenant isolation work, and how do you know it holds?"**
Every tenant table has org_id and an RLS policy that restricts rows to the caller's org, derived from their JWT. Services also scope by org_id and re-check ids from URLs. I prove it with an automated test that attempts a cross-tenant read and write and asserts the database denies both, and I demo it by fetching an Org A report id while logged in as Org B and showing the denial.

**"Isn't RLS a performance problem?"**
It adds a predicate per query, which I neutralize by leading every composite index with the tenant column. It is an index-backed filter, and the security guarantee is worth it.

**"Why not just filter by org_id in your code?"**
I do, as a second line. But if that is the only line, one forgotten filter is a permanent cross-tenant leak. RLS makes the guarantee a property of the data, not of every query I ever write.

**"How do you stop the AI from inventing sources?"**
Three layers: the schema requires a non-empty sources array on every factual field, the synthesis prompt is given only the tool outputs and forbidden from inventing sources, and validation rejects any report with an unsourced claim.

**"What happens if the news API is down during the demo?"**
The demo serves from a pre-warmed cache, so it does not call the upstream. If a tool does fail at runtime, that one section degrades to an unavailable state and the rest of the report still renders. The app never crashes on an upstream failure.

**"Why TypeScript for the AI layer when Python has more AI libraries?"**
For this scope the AI layer is light tool-orchestration, and the AI SDK v6 gives provider-agnostic tool-calling and structured output natively. Keeping one language means one type system from the model output to the rendered UI. If the center of gravity were heavy AI compute, I would reach for Python, which is exactly the Option B profile.

**"What would you do with two more weeks?"**
Schema-per-tenant or org-scoped encryption for stronger isolation, a background job to refresh the cache and embeddings on a schedule, evaluation harnesses for the synthesis quality, and the streaming and export bonuses fully hardened.

**"What was the hardest part?"**
(Fill in honestly during the build. Candidate: making the agentic loop both genuinely model-driven and reliably structured, which the planner/executor/synthesizer split plus validate-and-repair solved.)

**"Why Next.js 16 and AI SDK v6? Aren't those very new?"**
Both are the current stable releases, not canary. Next.js 16 has been the recommended default for new projects for months, with Turbopack as the default bundler and React 19. AI SDK v6 is the current standard for tool-calling and structured output. I verified the current versions rather than relying on memory, because "what is the latest version" is exactly the kind of fact that goes stale.

**"How did you decide what to build versus cut in the time you had?"**
I designed the full system in the constitution, then tiered implementation by rubric impact: Must, Should, Could, Won't-for-MVP. The Must tier is a complete, demoable, multi-tenant AI product. Everything above it I cut to stay shippable, and those cuts became my honest "with two more weeks" answer. Designing completely but implementing by priority under a budget is the part of the job that is product judgment, not just coding.

---

## SECTION 3 — GROWING LIST (discoveries recorded as we build)

### Phase 1 discovery: Next.js 16 renamed middleware.ts → proxy.ts
**What happened:** AGENTS.md warned of breaking changes. Found in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` that the exported function must be named `proxy`, not `middleware`, and the file is `proxy.ts`. The old `middleware.ts` convention no longer works.
**Interview line:** "I read the docs in node_modules before writing middleware, which is what the AGENTS.md instructed. That's where I found the breaking rename."
**Likely follow-up:** "Why is it called proxy now?" — The rename reflects a more accurate description of what the function does: it intercepts and proxies requests, optionally transforming the response, rather than being a traditional Express-style middleware in a chain.

### Phase 1 discovery: Supabase CLI v2 no longer auto-exposes tables
**What happened:** After running migrations, PostgREST returned "permission denied for table organizations" for `service_role` even with the correct JWT key. Root cause: Supabase CLI v2 changed the default so `auto_expose_new_tables` is now `false`. New tables are NOT automatically GRANTed to `anon`, `authenticated`, or `service_role`. Explicit `GRANT` statements are now required in every migration.
**Interview line:** "I hit a silent default change in the Supabase CLI — it used to auto-grant all roles on new tables, now it doesn't. I fixed it by adding explicit GRANTs and documented why they exist, so anyone who clones the repo and reads the migration knows it wasn't accidental."
**Why this matters architecturally:** RLS controls *which rows* a role can access. GRANTs control *whether* the role can access the table at all. Both layers are required. Forgetting GRANTs means no error during development (service_role gets a clean permission denied), which masks the issue until you move to a fresh database.
**Likely follow-up:** "Won't this also affect hosted Supabase?" — Yes, the same default applies on the hosted platform as of Supabase CLI v2. The explicit GRANTs in migrations make the project portable across local and hosted environments without manual intervention.

### Phase 1 discovery: Supabase local dev has two key formats; only JWT format works for PostgREST
**What happened:** `supabase start` output showed new `sb_publishable_*` and `sb_secret_*` format keys. Used these in `.env.local`. PostgREST returned 401s on all requests. Root cause: the `sb_*` keys work for the Supabase Auth API only. PostgREST still requires JWT-format keys (`npx supabase status` shows both).
**Interview line:** "Supabase CLI v2 introduced a new key format for their Auth API, but the data API (PostgREST) still uses the original JWT format. `supabase start` shows the new format; `npx supabase status` shows both. Documented this in `.env.example` so the next developer doesn't repeat it."
**Likely follow-up:** "How did you figure it out?" — Checked the `sb_secret_*` key's decoded payload and compared it to the JWT key. The JWT key payload contains `"role":"service_role"` which is what PostgREST checks; the `sb_secret_*` key has a different structure PostgREST doesn't recognize.

### Phase 1 discovery: security definer on org_id helpers is required, not optional
**What happened:** During implementation, confirmed that if `current_org_id()` ran with the caller's rights under RLS, the profiles RLS policy (which calls `current_org_id()`) would recurse infinitely because reading from profiles to find org_id would trigger the profiles policy, which calls `current_org_id()`, which reads profiles, etc.
**Interview line:** "The `security definer` on those helper functions isn't a convenience — it's load-bearing. Without it you get infinite recursion when Postgres tries to evaluate the profiles RLS policy. The function bypasses RLS for its single internal lookup, which is correct because it only reads the caller's own org_id and exposes nothing sensitive."
**Likely follow-up:** "Isn't security definer risky?" — Only if the function does something dangerous. This one reads one field from one row (`profiles WHERE id = auth.uid()`), which is the minimal possible operation. The `set search_path = public` clause prevents search-path injection attacks, which is the standard hardening for security definer functions.

### Phase 1 decision: API routes are marked public in the proxy (handle auth themselves)
**What happened:** API routes were receiving HTML 307 redirects to `/login` when called without a session cookie. The fix was to mark all `/api/*` routes as public in proxy.ts so they pass through unchanged and return JSON 401/403 themselves.
**Interview line:** "An API client receiving a redirect to an HTML login page is a contract violation. The proxy's job for API routes is to pass through, not redirect; the route handler owns auth and must return machine-readable errors."
**Likely follow-up:** "Doesn't that mean unauthenticated API requests get through the proxy?" — Yes, intentionally. The proxy handles page-level auth (redirecting browser users to login). API routes validate auth themselves and return 401. These are two different clients with different contracts: browsers vs. API consumers.

### Phase 2 decision: HNSW vector index deferred to Phase 3
**What happened:** The `document_chunks` table was created with `embedding vector(1536)` but no HNSW index. The index requires data to be meaningful, and an empty-column index provides no benefit. Phase 3 will embed the KB documents and add the index after population.
**Interview line:** "A vector index on an empty column is noise. I created the column now to lock the dimension (1536 for OpenAI text-embedding-3-small) and will add the HNSW index after the seed embeddings are written in Phase 3, which is when the index actually needs to exist."
**Likely follow-up:** "Why 1536 dimensions?" — That is the output dimension of OpenAI's `text-embedding-3-small`, which is the default embedding model. The dimension must match the model and cannot be changed after rows are inserted without rewriting all embeddings, so it is pinned here.

### Phase 2 decision: query_cache pre-seeded with synthetic price series
**What happened:** The seed script writes 90-day price series and news articles for NVDA, AMD, INTC, MSFT directly into `query_cache` before Phase 3 tool clients exist. This makes the demo deterministic.
**Interview line:** "The cache is data-model-level plumbing. Seeding it now means the demo is independent of live API availability from day one, which is D8 from the Decision Ledger: never make the demo depend on a rate-limited upstream."
**Likely follow-up:** "What's the cache key format?" — `market:{TICKER}:{range}` and `news:{COMPANY}:{days}`. Phase 3 tool clients will use the same keys, so the pre-seeded entries will be served from cache on the first call without any configuration.

### Phase 1 decision: onboarding uses service-role client, all other tenant queries use session client
**What happened:** Creating an org and profile requires bypassing RLS (the user has no profile yet, so `current_org_id()` returns null, which means no RLS policy passes). Only onboarding uses the service-role client. Every subsequent query uses the session-bound client so RLS is always enforced.
**Interview line:** "The service-role client is a loaded gun — it bypasses RLS completely. I confined it to exactly one place: the onboarding transaction that creates the org and the first profile. Everything after that uses the session client, which means if there is ever a bug in my service layer, RLS is still enforced."
**Likely follow-up:** "What if the org is created but the profile insert fails?" — Best-effort rollback: the service deletes the dangling org. This is not ACID-perfect (the delete could also fail) but is the correct pragmatic choice in a single-connection service layer without explicit transactions.
