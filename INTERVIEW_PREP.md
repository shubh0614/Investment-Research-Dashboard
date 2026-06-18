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

### Phase 4 decision: tool() in AI SDK v6 uses inputSchema, not parameters
**What happened:** The AI SDK v5 `tool()` helper took `parameters: ZodSchema`. In AI SDK v6 it was renamed to `inputSchema: ZodSchema`. The TypeScript compiler caught this because the Tool type from `@ai-sdk/provider-utils@4.0.30` no longer exposes `parameters` at all.
**Interview line:** "I read the SDK types before writing any AI code — AGENTS.md instructs this. The rename from `parameters` to `inputSchema` is the kind of breaking change that compiles silently in JavaScript but is caught immediately when you check types."
**Likely follow-up:** "Why not just use `any`?" — Because type-safety on tool input schemas is what gives you typed `toolCalls` in the planner result.

### Phase 4 decision: LanguageModelUsage uses inputTokens/outputTokens in AI SDK v6
**What happened:** AI SDK v5 usage had `promptTokens` and `completionTokens`. In v6 these were renamed to `inputTokens` and `outputTokens`, both `number | undefined`. Default to 0 with `?? 0`.
**Interview line:** "All three token fields are optional in v6 — the SDK allows providers that don't report token counts. We default to 0 rather than letting the schema reject the report."

### Phase 4 decision: provider-agnostic gateway uses createOpenAI with Groq base URL
**What happened:** Rather than installing `@ai-sdk/groq`, we use `createOpenAI({ baseURL: "https://api.groq.com/openai/v1" })` because Groq is OpenAI-compatible. Switching to native OpenAI is a one-character env change.
**Interview line:** "Groq is OpenAI-compatible, so the OpenAI provider handles it with a custom base URL. No extra dependency, full provider-agnosticism via env vars."

### Phase 4 decision: plan → execute → synthesize separation
**What happened:** The orchestrator runs in three distinct steps. Planner calls the model to select tools (no execution). Executor runs those tools in parallel. Synthesizer calls the model with aggregated results. Each step is independently logged and testable.
**Interview line:** "Separation matters for debuggability. If the planner selects wrong tools, I see that without running any tools. Three single-responsibility steps beats one opaque mega-function."
**Likely follow-up:** "Why not use AI SDK's built-in multi-step tool loop?" — For research synthesis we want explicit control: run tools once, synthesize once. The built-in loop lets the model keep calling tools indefinitely — harder to reason about and wasteful.

### Phase 4 decision: meta is injected after synthesis, not generated by the model
**What happened:** `ResearchReport.meta` (latency_ms, token_usage) only exists after the LLM call returns — the model cannot know this. Solution: `SynthesisOutputSchema` (what the LLM generates) + `ResearchReportSchema` (= synthesis + meta injected by orchestrator).
**Interview line:** "The model cannot know its own latency. Meta is infrastructure data injected from real measurements. Asking the model to hallucinate '127ms latency' would be the opposite of source attribution."

### Phase 4 decision: server Supabase client reads Authorization: Bearer header
**What happened:** The browser uses cookie-based auth. API clients (machine tests, integrations) use `Authorization: Bearer <token>`. Original server.ts only read cookies, breaking the test. Fixed by forwarding the Authorization header via `global.headers` if present.
**Interview line:** "A route handler that only works from a browser is not a real API. Two lines — check for Authorization header, forward if present — and it works for both cookies and bearer tokens transparently."

### Phase 3 decision: KB retriever has a vector-primary, keyword-fallback design
**What happened:** The `searchKnowledgeBase()` function calls `embedQuery()` first. If a vector is returned, it issues a PostgREST ORDER BY cosine distance query. If `embedQuery()` returns null (no API key), it falls back to a GIN-indexed `plainto_tsquery` full-text search on the content column.
**Interview line:** "The retriever works whether or not an OpenAI key is present. The happy path is vector similarity, which is tenant-scoped by RLS and ordered by cosine distance. The fallback is GIN full-text search, which is also tenant-scoped and index-backed. The demo never hard-fails on a missing embedding key."
**Likely follow-up:** "Why plainto_tsquery and not to_tsquery?" — `to_tsquery` requires the caller to pass a valid ts_query expression with explicit `&` / `|` operators. `plainto_tsquery` accepts natural prose and is the right choice when the input is an unformatted user query.

### Phase 3 decision: GIN full-text index added alongside HNSW
**What happened:** Added `CREATE INDEX ... USING gin(to_tsvector('english', content))` in the same migration as the HNSW index. The Supabase JS `.textSearch()` call with `{ type: 'plain' }` maps to `plainto_tsquery`, which the GIN index backs.
**Interview line:** "I index both retrieval paths: HNSW for vectors and GIN for full-text. Without the GIN index, keyword search is a sequential scan of the content column. With it, keyword search is milliseconds regardless of KB size."
**Likely follow-up:** "Why not just use ILIKE?" — ILIKE is a regex-style character match, not semantic text search. It doesn't handle stemming (`earn` doesn't match `earnings`), stop words, or relevance ranking. `to_tsvector` + `plainto_tsquery` does all three.

### Phase 3 implementation: embedding is null-safe throughout
**What happened:** `embedTexts()` returns `null[]` if `OPENAI_API_KEY` is unset. `seed.mjs` stores those nulls in `document_chunks.embedding`. `embedQuery()` returns `null` if unconfigured. `searchKnowledgeBase()` detects null and switches to keyword path. No code in the system crashes on a missing key.
**Interview line:** "Embedding is optional infrastructure, not a hard dependency. Setting `OPENAI_API_KEY` improves retrieval quality but the app ships without it. That is the correct graduation of complexity for an MVP where the grader may not have an OpenAI key at evaluation time."
**Likely follow-up:** "Can you add embeddings to existing chunks retroactively?" — Yes. Re-run `npm run seed` with `OPENAI_API_KEY` set. The seed clears chunks at the start, re-chunks every document, calls `embedMany`, and inserts with real vectors. The HNSW index is then live and vector search activates automatically.

### Phase 1 decision: onboarding uses service-role client, all other tenant queries use session client
**What happened:** Creating an org and profile requires bypassing RLS (the user has no profile yet, so `current_org_id()` returns null, which means no RLS policy passes). Only onboarding uses the service-role client. Every subsequent query uses the session-bound client so RLS is always enforced.
**Interview line:** "The service-role client is a loaded gun — it bypasses RLS completely. I confined it to exactly one place: the onboarding transaction that creates the org and the first profile. Everything after that uses the session client, which means if there is ever a bug in my service layer, RLS is still enforced."
**Likely follow-up:** "What if the org is created but the profile insert fails?" — Best-effort rollback: the service deletes the dangling org. This is not ACID-perfect (the delete could also fail) but is the correct pragmatic choice in a single-connection service layer without explicit transactions.

### Phase 5 decision: run and save are separate round-trips
**What happened:** `POST /api/research` runs the orchestrator and returns the report JSON without touching the DB. `POST /api/research/save` persists it. The client must explicitly decide to save after reviewing the result.
**Interview line:** "Separation of concern in two directions: the read path stays stateless (useful for future caching/CDN), and the user gets to inspect the result before committing storage cost and audit trail. One route that does both is simpler to write but harder to test, harder to reason about, and couples LLM latency to DB writes."
**Likely follow-up:** "What prevents the client from modifying result_json before saving?" — We store it exactly as-sent. The model already validated the shape at AI layer (Zod parse + repair loop). A determined attacker can obviously send garbage, but the read path (`GET /api/research/:id`) just returns what was stored — there is no downstream system that trusts result_json as authoritative for anything security-sensitive.

### Phase 5 decision: cross-tenant reads return 404, not 403
**What happened:** `GET /api/research/:id` re-checks `org_id` in the query (`.eq("org_id", orgId)`). If a user from Org B guesses Org A's report UUID, they get 404.
**Interview line:** "403 confirms the resource exists but you don't have access. 404 is information-free — the attacker learns nothing. IDOR (insecure direct object reference) is OWASP A01. The defence-in-depth here is RLS enforcing the same rule plus the service layer adding an explicit `org_id` filter on every query. Two independent enforcement points."
**Likely follow-up:** "Doesn't RLS alone handle this?" — Yes, RLS would return 0 rows. But the service re-check means that if someone accidentally runs the query with the service-role client (bypassing RLS), it still can't leak cross-tenant data.

### Phase 5 decision: audit events are best-effort (fire-and-forget)
**What happened:** `writeAuditEvent()` is called with `void` — the route never awaits it and never checks its result. The function catches all errors internally and logs them.
**Interview line:** "Audit logging must never fail a business operation. If the audit write times out, the user's report should still save successfully. Best-effort here is the correct semantics: logs are observability, not transactions. The only risk is a gap in the audit trail, which is acceptable for an MVP. In production you'd queue audit events through a reliable message bus."
**Likely follow-up:** "What if you need audit events for compliance?" — Then they're not best-effort. You promote them to a Postgres-level trigger inside the same transaction as the mutation, or you use a CDC pipeline. The decision is a product requirement, not a code preference.

### Phase 5 decision: tags use replace-all on update, not delta
**What happened:** `updateReport()` with `tags: [...]` deletes all existing `report_tags` rows for the report, then bulk-inserts the new set. There is no partial update.
**Interview line:** "Replace-all is idempotent and simple to reason about. Delta updates (add X, remove Y) require the client to track the previous state and compute a diff. For a tag set that rarely exceeds 10 items, the extra delete+insert is negligible and the code is trivially correct. Delta makes sense for large ordered collections; it's premature optimisation here."
**Likely follow-up:** "What if two users update tags simultaneously?" — Last-write-wins at the row level. Tags are not ordered or versioned in the MVP. If concurrent tag editing becomes a use case, optimistic locking via a `tags_version` column would be the correct upgrade.

### Phase 5 decision: requireAuth / requireAdmin shared helper
**What happened:** Every route calls `requireAuth()` or `requireAdmin()` at its top — one function that extracts the Bearer token, validates it with Supabase, fetches the profile, and returns a typed `AuthContext`. The route only proceeds if `auth.ok`.
**Interview line:** "Centralising auth into one function eliminates copy-paste errors. If I inline the same three Supabase calls in 10 routes, someone will eventually omit the role check or forget to handle the null-profile case. The type system enforces that any route that calls requireAuth can only reach its business logic with a fully-validated `AuthContext`."
**Likely follow-up:** "Why not middleware for this?" — Middleware (proxy.ts) runs on every request and is the right place for rate-limiting and public-route gating. It does not have the Supabase session context needed to check roles. The per-route helper pattern keeps auth logic close to the handler that needs it and avoids a shared mutable context object.

---

### Phase 6 decision: dark-by-default with ThemeScript for FOUC prevention
**What happened:** `:root` carries the Ink (dark) palette so the page is dark on first paint. A `<ThemeScript>` inlines ~4 lines of JS in `<head>` that reads `localStorage("klypup-theme")` and adds `.light` to `<html>` before React hydrates. Without it, users who chose light mode would see a dark flash on every page load. `<html>` has `suppressHydrationWarning` because the class changes between server and client intentionally.
**Interview line:** "FOUC on a dark-by-default app is worse than on a light-by-default one — the user sees a full black-to-white flash. The inline script is the standard solution: it runs before the CSS paint, costs ~60 bytes, and disappears entirely if JS is disabled. `suppressHydrationWarning` is the sanctioned escape hatch for known intentional server/client class differences."
**Likely follow-up:** "Why not CSS prefers-color-scheme?" — It ignores the user's explicit override saved in localStorage. The inline script checks localStorage first and falls back to `prefers-color-scheme`, which is the correct priority order.

### Phase 6 decision: Tailwind v4 inline @theme config, no tailwind.config.ts
**What happened:** Tailwind v4 moved all configuration into CSS via `@theme inline {}` inside `globals.css`. There is no `tailwind.config.ts`. The locked design system tokens are mapped here: `--color-background: var(--bg)` etc., bridging shadcn's expected variable names to our custom token set.
**Interview line:** "Tailwind v4 is a breaking change from v3. The config file is gone — the theme is declared in CSS alongside the tokens it consumes, which means the design system and the utility layer are co-located and can't drift. Every component that uses `bg-background` automatically picks up whatever `--bg` is, dark or light."
**Likely follow-up:** "What about shadcn's expected variable names?" — shadcn base-nova uses `--color-*` CSS custom properties. The `@theme inline` block maps `--color-primary: var(--accent)` etc. so every shadcn-generated component inherits our palette without modification.

### Phase 6 decision: server components for data-heavy pages, client components for interaction
**What happened:** Dashboard, report view, and admin panel are server components — they fetch directly from Supabase with `await`, have no JS bundle cost, and stream HTML to the browser. History, watchlist, and research/new are client components with TanStack Query — they need user interaction (search input, mutations, streaming AI state) that would require client-side re-fetches anyway.
**Interview line:** "The split is functional, not aesthetic. Server components remove the API round-trip for pages where the data is known at request time. Client components exist only where the UI must respond to user interaction between navigations. TanStack Query handles all client-side server state with cache invalidation, so there is no parallel state management."
**Likely follow-up:** "Why TanStack Query for client fetches and not SWR?" — TanStack v5 has first-class support for mutations with `useMutation`, typed `queryKey` arrays, and fine-grained invalidation. SWR covers the read path well but its mutation pattern requires more boilerplate. For history (delete with invalidation) and watchlist (add/delete), useMutation is cleaner.

### Phase 6 decision: source chips as a CSS utility class
**What happened:** Every factual datum in the report view — prices, PE ratios, news headlines, risk rationale — is wrapped in a `source-chip` span. This is a single CSS class defined in `globals.css` as a monospace pill with `--border` border and `--surface-2` background. The class is the signature visual element that makes attribution visible without adding component weight.
**Interview line:** "Source attribution is a first-class design requirement, not an afterthought. Making it a utility class means any developer can add it to any datum in one word and it's instantly styled consistently. It's the cheapest way to make 'sources on every claim' a visible property of the UI."
**Likely follow-up:** "What does a source chip contain?" — The provider name and, where available, a date (e.g. 'Yahoo Finance · 2026-06-18'). For KB sources it shows the document title. For AI-synthesized claims with multiple sources, each source gets its own chip side by side.

### Phase 6 decision: PriceChart uses Recharts AreaChart with CSS variable strokes
**What happened:** Recharts renders SVG. All color values are CSS variable strings (`"var(--accent)"`, `"var(--border)"`). The gradient fill references `var(--accent)` at 15% opacity on the start stop and 0% at the end. The Y-domain is clamped to `[min * 0.97, max * 1.03]` so the line fills the chart height regardless of absolute price.
**Interview line:** "Recharts is a declarative wrapper over D3 primitives. By passing CSS variables as stroke/fill values I keep the chart theme-aware — toggle light mode and the chart palette switches without a React re-render. The domain clamp prevents a $2 move on a $400 stock from looking like a flat line."
**Likely follow-up:** "Why Recharts over native D3?" — D3 manipulates the DOM imperatively. In React, that's a source of ref management bugs. Recharts is a React-native component tree over D3, which means no imperative DOM mutations and full compatibility with React's reconciler.

### Phase 6 decision: apiFetch<T> client utility wraps fetch with typed errors
**What happened:** `lib/api/client.ts` exports `apiFetch<T>` which adds `Content-Type: application/json` to every request, parses the response as JSON, and throws a typed `Error` with `.code` and `.status` properties on non-ok responses. TanStack Query's `queryFn` returns `apiFetch(...)` directly — no boilerplate per query.
**Interview line:** "A bare `fetch` call in every TanStack queryFn means repeating the same JSON-parse, error-handling, and header logic in every query. One wrapper function means those decisions are made once. The typed error lets the UI distinguish a 401 (show login redirect) from a 409 (show conflict message) without parsing the status in each component."
**Likely follow-up:** "Why not use the Supabase JS client on the client side?" — The Supabase client handles auth state management but couples the UI to PostgREST's query syntax. Our API routes are the contract surface; `apiFetch` calls them with standard HTTP. Swapping the backend implementation doesn't change the UI layer.
