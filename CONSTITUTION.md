# THE KLYPUP CONSTITUTION
### Build Constitution for the Investment Research Dashboard (Option A) — v1.1

> A full-stack web application that turns a research analyst's natural-language question into an AI-orchestrated, source-attributed, structured analysis in minutes. The AI is a feature inside a real multi-tenant product, not the product itself.

**This document is the single source of truth for the entire build.** Every architectural decision, schema choice, API contract, prompt, and build step lives here. When building any step in Claude Code, this document is the law. If something is not specified here, default to the principles in **Part 2 — The Engineering Constitution**, and keep it consistent with what is already built. When a decision is made during the build that is not in this document, record it in the Decision Ledger (Part 3) and in `INTERVIEW_PREP.md` before moving on.

**Two non-negotiable rules of this project:**
1. **Explainability over cleverness.** Klypup grades on "if you can't explain it, it doesn't count." Every step in this document states *why* it exists and *what alternative was rejected and why*. Do not introduce a pattern that is not defensible out loud.
2. **Shippable at every checkpoint.** The roadmap is ordered so that at the end of every phase the application runs, demos, and could be submitted. Bonuses are additive layers at the end. Nothing load-bearing depends on a bonus.

---

## TABLE OF CONTENTS

- **Part 0** — Context, Constraints, and the Rubric We Are Optimizing
- **Part 1** — The Product (what we build, the three demo workflows, roles)
- **Part 2** — The Engineering Constitution (the rules every step obeys)
- **Part 3** — The Decision Ledger (every architectural choice, with alternatives discarded)
- **Part 4** — System Architecture (components and the five required diagrams)
- **Part 5** — The Data Model (schema, RLS policies, indexes)
- **Part 6** — The AI Layer (gateway, agentic loop, tools, structured output)
- **Part 7** — API Design (endpoint contracts, response envelope, error taxonomy)
- **Part 8** — Frontend Specification (routes, components, rendering contract, design)
- **Part 9** — Multi-Tenancy and Security (isolation model, RBAC matrix, auth)
- **Part 9.5** — Implementation Tiering (MoSCoW: what the constitution designs vs what the MVP builds)
- **Part 10** — The Build Roadmap (step-wise, with definition-of-done and machine test)
- **Part 11** — Deliverables (mapped to assignment Section 4)
- **Part 12** — The Demo Script
- **Part 13** — Bonus Layers (independent, droppable modules)
- **Appendix A** — Environment Variable Catalog
- **Appendix B** — Synthetic Data and Knowledge Base Specification
- **Appendix C** — Commit and Branch Convention
- **Appendix D** — Risk Register
- **Changelog**

---

## PART 0 — CONTEXT, CONSTRAINTS, AND THE RUBRIC

### 0.1 Who and what
- **Builder:** solo, using Claude Code as the primary implementation tool, reviewing and owning every block.
- **Assignment:** Klypup Applied AI Intern technical assessment. Option A, the Investment Research Dashboard.
- **Deadline model:** evenings only across roughly six working sessions, then submit. This shapes the roadmap into small, independently shippable steps. It does **not** shape any architectural decision. Architecture is chosen on merit; the schedule only governs ordering and scope-cutting.

### 0.2 Why Option A (recorded for DECISIONS.md and the interview)
Chosen because its center of gravity is multi-tenant data isolation over a knowledge base with a light, request-scoped AI tool-orchestration layer. The hardest problem is data isolation and retrieval correctness, which is security-critical and explicitly weighted, and it maps cleanly onto a knowledge architecture we can make excellent. Option B's strength is heavy multi-agent compute, which is a different and larger surface; Option A lets us go deep on isolation, retrieval, and a clean agentic loop rather than spreading thin across five agents.

### 0.3 The rubric is the spec
Every phase below is tagged with the rubric criterion it serves. We do not build anything that does not move one of these numbers.

| Criterion | Weight | Where we win it |
|---|---|---|
| Full-Stack Engineering | 30% | Working auth, full CRUD, clean API, real schema, polished UI with loading/error/empty states |
| AI Integration Quality | 25% | Genuine tool-calling (model decides which tools), structured output rendered as components, source attribution on every datum |
| Architecture and Code Quality | 20% | Clean separation, error handling, the five diagrams, a sharp DECISIONS.md |
| Multi-Tenant Implementation | 15% | Database-tier isolation via RLS, RBAC enforced, demonstrable two-org separation |
| Communication and Product Thinking | 10% | README, UX quality, and the ability to articulate every decision |

---

## PART 1 — THE PRODUCT

### 1.1 One-sentence definition
An analyst types a research question in natural language; the system plans which data tools are needed, fetches market data, news with sentiment, and knowledge-base filings, synthesizes a structured, sourced report, and lets the analyst save, tag, search, and revisit it, all inside an organization-isolated workspace.

### 1.2 The three demo workflows (these are the acceptance target for the whole project)
1. **The core AI feature.** An analyst submits "Give me an overview of NVIDIA: this quarter's stock performance, major news in the last 30 days, and key risks." The agent selects the market, news, and KB tools, runs them, and returns a structured report with cards, a price chart, sentiment badges, a risks section, and a source chip on every claim. The analyst saves and tags it.
2. **Multi-tenant isolation.** Log in as a user in Org A, then as a user in Org B. Each sees only their own saved reports, watchlist, and history. Org B cannot reach Org A's data by any route, including direct API calls with a guessed id.
3. **Role-based access.** An Admin can manage the workspace and invite users; an Analyst can run and save research but cannot access admin functions. The UI and the API both enforce this.

### 1.3 Roles
- **Admin:** manages the organization, invites and manages members, sees all of the org's research. Has every Analyst capability.
- **Analyst:** creates, reads, updates, deletes their research; manages their watchlist; cannot manage members or org settings.

Roles are per organization. A user belongs to exactly one organization in the MVP (recorded as a deliberate simplification in Part 3).

---

## PART 2 — THE ENGINEERING CONSTITUTION

These rules are obeyed by every step. They are the default when this document is silent.

### 2.1 Configuration and secrets
- Twelve-factor configuration. Every secret and environment-specific value comes from environment variables. No secret is ever committed. `.env.example` lists every variable with a description and a safe placeholder (Appendix A).
- A single typed config module reads and validates environment variables at startup with Zod. The app refuses to boot with a clear error if a required variable is missing. Rationale: fail fast and loud beats a 500 deep in a request.

### 2.2 Separation of concerns
- Even though this is a modular monolith on Next.js, the backend is layered: **route handlers** (HTTP, auth, validation only) call **services** (business logic) which call **repositories** (data access) and **tool clients** (external data). The AI orchestration lives in its own module. No business logic in route handlers, no SQL in services.
- This gives us the "separate concerns" the rubric asks for without paying the operational tax of a second deployed service.

### 2.3 The API contract
- Every endpoint returns a consistent envelope: `{ ok: true, data }` or `{ ok: false, error: { code, message, details? } }`.
- Meaningful HTTP status codes (200, 201, 400, 401, 403, 404, 409, 422, 429, 500, 503). Validation failures are 422 with field-level detail. Authorization failures are 403, authentication failures are 401, and the two are never conflated.
- Every request body and query is validated with a Zod schema at the boundary. Unvalidated input never reaches a service.

### 2.4 Error handling and resilience
- Every external call (LLM, market data, news) is wrapped with a timeout, a single bounded retry with backoff for transient failures, and a typed failure result. The app never crashes because an upstream is slow or down. A failed tool degrades the report (that section shows a clear "unavailable" state) rather than failing the whole request.
- The frontend always renders three states for async data: loading, error, and empty. No spinner without a timeout, no blank screen on failure.

### 2.5 Observability
- Structured logging with a request id and the resolved tenant id on every log line. Every AI run logs the plan it chose, the tools it called, latency per tool, and token usage. This log is also the raw material for the "AI reasoning" view and for the interview.
- A `/api/health` endpoint reports database and LLM-gateway reachability.

### 2.6 Security baseline
- Isolation is enforced at the database tier (Part 9). Application code is the second line, not the only line.
- No direct LLM or external-API calls from the browser. The browser only talks to our API. Keys live server-side only.
- Output that is rendered as HTML is sanitized. IDs in URLs are treated as untrusted and re-checked against the tenant on every read.

### 2.7 Definition of Done (applies to every step)
A step is done only when: it has a clear acceptance behavior, that behavior is verified by the step's **machine test** (a command or a scripted check that proves it works on a clean run), error and empty states exist where relevant, and a commit captures it with a message that explains the decision, not just the change.

### 2.8 Commit discipline
- Small, frequent, meaningful commits. Conventional Commits style (Appendix C). The commit history is a graded artifact and should read like a narrative of how the system was reasoned into existence.

---

## PART 3 — THE DECISION LEDGER

This is the heart of the project for interview purposes. Each entry states the decision, the merit reason, and the alternatives rejected and why. Every entry is mirrored, in interview phrasing, into `INTERVIEW_PREP.md`.

### D1 — Stack: Next.js 16 (App Router) full-stack monolith
**Decision.** One TypeScript codebase. Next.js App Router route handlers as the API, React Server Components and client components for the UI, deployed as one unit.
**Why on merit.** This is a single-product MVP for one team. At this scope, a modular monolith is the architecturally correct choice. A separate backend service would introduce a network boundary, a second deployment, CORS surface, and cross-service auth plumbing with no compute justification, which is premature decomposition. One runtime means one type system spanning the API contract and the AI's structured output, which removes a whole class of integration bugs at the exact seam where AI apps break: parsing model output into typed UI.
**Alternatives rejected.**
- *FastAPI + Next.js (Python backend).* Strong on textbook separation and Python's AI ecosystem, and it is the right call when the center of gravity is heavy AI compute. It is not here. For Option A it buys a distributed system we do not need and costs setup and glue we cannot spare. Rejected on scope-fit, not on language preference.
- *FastAPI + Supabase-as-DB hybrid with session-variable RLS.* The maximum-control option and genuinely impressive, but it hand-wires the RLS context per request across a service boundary, adding failure surface for a marginal gain over letting the database and a vetted client enforce the same invariant. Rejected as over-engineering for the MVP.

### D2 — Backing service: Supabase (Auth + Postgres + RLS + pgvector)
**Decision.** Supabase provides authentication, the Postgres database, Row Level Security, and the vector store via the pgvector extension.
**Why on merit.** It collapses the four highest-risk pieces of this assignment (auth, relational store, tenant isolation, vector store) into one coherent, vetted service. Critically, it lets us push the tenant-isolation invariant into the database tier rather than scattering it across application queries.
**Alternatives rejected.**
- *Roll-your-own auth (NextAuth/custom JWT) + raw Postgres.* Rolling your own auth is a security anti-pattern and a time sink with no upside here. Using a vetted, audited auth layer is the responsible choice.
- *Separate vector database (Pinecone, Chroma, Weaviate).* Would force tenant isolation to be re-implemented a second time in a second system, and would require keeping two stores consistent. Rejected (see D4).

### D3 — Multi-tenancy: Row Level Security at the database tier
**Decision.** Every tenant-owned table carries `org_id`. RLS policies on Postgres restrict every row to the requesting user's organization, derived from the authenticated JWT. Application code also scopes queries, as defense in depth, but the database is the authority.
**Why on merit.** Broken object-level authorization is the number-one item on the OWASP API Security Top 10. App-layer filtering means one forgotten `WHERE org_id = ...` is a cross-tenant leak, forever, on every query. RLS makes isolation a property of the data: it holds even if application code has a bug. This is fail-closed, defense-in-depth design, and it is the strongest possible answer to the 15% criterion.
**Alternatives rejected.**
- *App-layer `org_id` filtering only.* The pattern the rubric explicitly accepts as "simple," but strictly weaker: the guarantee lives in code that must never slip. We implement it too, but only as the second line.
- *Schema-per-tenant.* Stronger isolation but heavy operational cost (migrations across N schemas, connection management) and unjustified for an MVP. Noted in DECISIONS.md as the path we would take at real scale.
**Interview line.** "Isolation cannot be bypassed by a forgotten WHERE clause, because it is enforced at the data layer, and the RAG store inherits the same policies for free."

### D4 — RAG store: pgvector colocated in the same Postgres
**Decision.** Document chunks and their embeddings live in a Postgres table with a `vector` column and an `org_id` column, queried with the pgvector similarity operator.
**Why on merit.** Because embeddings sit in the same database, the same RLS policies that protect relational data also protect the knowledge base. Retrieval is tenant-isolated by construction with zero duplicated logic, and we can combine a tenant filter and a vector search in a single query. For a tenant-scoped RAG product, colocating vectors with relational data is the correct data architecture, not a shortcut.
**Alternatives rejected.** External vector DBs (see D2): a second isolation implementation and a consistency problem for no benefit at this scale. A pure keyword/BM25 index: allowed by the assignment and simpler, but semantic retrieval is more honest to the "ask about filings in natural language" use case; we keep a keyword fallback for robustness.

### D5 — LLM access: a provider-agnostic gateway on the Vercel AI SDK v6
**Decision.** All model calls go through one internal `llm` module built on the Vercel AI SDK v6. The provider and model are chosen by environment variables. We start on Groq's free tier and can pivot to OpenAI or Anthropic by changing one model string and one key.
**Why on merit.** No vendor lock-in is a real architectural property, not a convenience. The AI SDK exposes a uniform interface for generation, tool-calling, and Zod-validated structured output across providers, so the orchestration logic is identical regardless of who serves the tokens. This lets us benchmark models, build a fallback chain, and start at zero cost without rewriting a line of application logic.
**Alternatives rejected.**
- *Direct provider SDK (OpenAI client) hard-coded.* Couples the app to one vendor and one tool-call dialect. Rejected.
- *LangChain.js orchestration.* Heavier abstraction and bundle for an orchestration we want to own and explain line by line. The assignment rewards understanding the loop, not importing it. Rejected.
**Interview line.** "The AI layer is provider-agnostic by construction; swapping Groq for a paid model is a config change, because tool-calling and structured output are normalized at the gateway."

### D6 — The AI is agentic tool-calling, not a hardcoded pipeline
**Decision.** The model receives the query plus tool definitions and decides which tools to call. If the user asks only about news, the market and KB tools are not invoked. Tools that are independent run in parallel.
**Why on merit.** This is the explicit AI requirement: the model orchestrates tools based on input, not a fixed sequence. It is also cheaper and faster, since we never fetch data the question does not need.
**Alternatives rejected.** A fixed call-all-tools-then-summarize pipeline. Simpler, but it fails the "decides which tools to invoke" requirement and wastes calls and rate limit. Rejected.

### D7 — Structured output: a strict Zod schema with validate-and-repair
**Decision.** The synthesis step must return JSON conforming to a single Zod schema (`ResearchReport`). We validate the model output against it; on failure we run one bounded repair pass; if it still fails we degrade gracefully. The same Zod type is the contract the UI renders.
**Why on merit.** The rubric demands structured components, not a wall of text, and source attribution on every datum. A strict schema makes attribution a required field, not an afterthought, and the shared type guarantees the UI and the model agree on shape. Validate-and-repair is the standard production pattern for non-deterministic generators.
**Alternatives rejected.** Trusting raw model JSON (brittle), or regex-parsing prose (fragile and unexplainable). Rejected.

### D8 — Data strategy: real free APIs behind a read-through cache, plus a synthetic knowledge base
**Decision.** Market data and news come from free sources, but every external response is written to a `query_cache` table and the seed script pre-warms that cache for the demo companies. At demo time the app serves from cache and never depends on a live upstream. The knowledge base is 4 to 6 hand-authored synthetic filings, which the assignment explicitly permits.
**Why on merit.** A live demo that depends on a rate-limited free API is a demo that can fail in the room. The cache turns external calls into a performance and cost optimization (a real bonus) while making the demo deterministic. Synthetic filings let us control content quality and avoid the genuine pain of parsing 100-page SEC documents, with no loss of credibility because the ingestion pipeline is what is being graded.
**Alternatives rejected.** Hitting live APIs during the demo (fragile), or real SEC filings (high parsing cost, low marginal credit). Rejected.

### D9 — News sentiment: a constrained LLM classification, surfaced as a badge
**Decision.** Each news item is classified positive, negative, or neutral by the LLM with a confidence, rendered as a colored badge. News is filtered and sorted by recency (last 7 to 30 days).
**Why on merit.** Satisfies the sentiment requirement without standing up a separate NLP model, and reuses the gateway we already built. The recency requirement is met at the data layer so the UI always reflects it.
**Alternatives rejected.** A dedicated sentiment model or service. Over-scoped for the value. Rejected.

### D10 — Charts: a single lightweight chart for price history, tables for comparisons
**Decision.** One time-series chart for stock price (Recharts). Financial comparisons render as color-coded tables, not charts.
**Why on merit.** A chart earns its complexity only where the data is genuinely temporal. Comparisons read faster as tables. This keeps the UI information-dense and the build lean.
**Alternatives rejected.** Charting everything (slower to build, lower clarity). Rejected.

### D11 — State and data fetching on the client: TanStack Query
**Decision.** Server state on the client is managed with TanStack Query (caching, loading and error states, invalidation after mutations).
**Why on merit.** It gives us correct loading/error/empty handling and cache invalidation almost for free, which is directly what the rubric inspects, rather than hand-rolling fetch state.
**Alternatives rejected.** Raw fetch in effects (boilerplate and bug-prone), a global store like Redux (unnecessary for server state). Rejected.

---

## PART 4 — SYSTEM ARCHITECTURE

### 4.1 Components
- **Client (browser):** React UI (Server and Client Components). Talks only to our API. No keys, no direct LLM or upstream calls.
- **API (Next.js route handlers):** auth and tenant resolution, Zod validation, then delegation to services. Returns the standard envelope.
- **Services and orchestration:** business logic, plus the AI orchestrator that plans and runs tools and synthesizes the report.
- **Tool clients:** market data client, news client, knowledge-base retriever. Each is a clean interface with timeout, retry, and cache.
- **Supabase:** Auth (identity, JWT), Postgres (relational + pgvector), RLS (tenant isolation).
- **LLM gateway:** provider-agnostic model access via AI SDK v6.
- **External free APIs:** market data and news, reached only through the cache.

### 4.2 The five required diagrams (authored in Mermaid in ARCHITECTURE.md)
1. **System architecture:** the components above with trust boundaries drawn (browser vs server vs managed services vs external APIs).
2. **Data flow for one research query:** UI input, API request, auth and tenant middleware, orchestrator plan, parallel tool calls, cache reads/writes, synthesis, validation, database write of the report, structured render.
3. **ER diagram:** the schema in Part 5.
4. **AI orchestration flow:** query in, planner selects tools, parallel or sequential execution, aggregation, synthesis to the Zod schema, validate-and-repair, out.
5. **Multi-tenant data flow:** request, JWT, tenant resolution, RLS predicate applied at Postgres, proof that Org A's rows are unreachable from Org B.

Each diagram is committed as Mermaid in `ARCHITECTURE.md` and exported to PNG for the README and the deck.

---

## PART 5 — THE DATA MODEL

All tenant-owned tables carry `org_id uuid not null`. Timestamps `created_at` and `updated_at` on every table. UUID primary keys.

### 5.1 Tables
- **organizations** — `id`, `name`, `invite_code` (unique), `created_at`. The tenant root.
- **profiles** — `id` (= Supabase auth user id), `org_id`, `email`, `full_name`, `role` enum(`admin`,`analyst`), `created_at`. One profile per user; `org_id` is the tenant claim.
- **research_reports** — `id`, `org_id`, `author_id`, `title`, `query_text`, `result_json` (the validated ResearchReport), `created_at`, `updated_at`. Core CRUD entity.
- **report_tags** — `id`, `org_id`, `report_id`, `tag`. Many tags per report; indexed for tag search.
- **watchlist_items** — `id`, `org_id`, `user_id`, `ticker`, `company_name`, `created_at`. Recommended feature.
- **documents** — `id`, `org_id`, `company`, `doc_type`, `title`, `source_label`, `created_at`. A knowledge-base source document.
- **document_chunks** — `id`, `org_id`, `document_id`, `chunk_index`, `content`, `embedding vector(N)`, `token_count`. The vector store; `embedding` indexed with an IVFFlat or HNSW index.
- **query_cache** — `id`, `cache_key` (unique: tool + normalized params), `payload_json`, `fetched_at`, `expires_at`. Shared infrastructure; not tenant-scoped because market and news data are public, but never exposes tenant data.
- **audit_events** — `id`, `org_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata_json`, `created_at`. Records logins, report create/update/delete, invitations, role changes. Supports the product-thinking and audit story.

### 5.2 RLS policy pattern (applied to every tenant-owned table)
- A SQL helper resolves the caller's `org_id` from their profile via the authenticated user id.
- For each of select, insert, update, delete: the row's `org_id` must equal the caller's `org_id`.
- Admin-only actions (managing members, changing roles) are additionally gated on `role = 'admin'`, enforced both in RLS for the relevant tables and in the service layer.
- `query_cache` has no tenant policy and stores only public market/news payloads, never tenant rows.

### 5.3 Indexes
- `profiles(org_id)`, `research_reports(org_id, created_at desc)`, `report_tags(org_id, tag)`, `watchlist_items(org_id, user_id)`, `document_chunks` vector index plus `document_chunks(org_id)`, `query_cache(cache_key)`, `audit_events(org_id, created_at desc)`.
- Rationale: the tenant column leads every composite index because every query is tenant-scoped first. This is also the answer to "isn't RLS slow": the predicate is index-backed.

---

## PART 6 — THE AI LAYER

### 6.1 The gateway (`lib/llm`)
- One module exposes `generateStructured(schema, messages, tools?)` and `streamStructured(...)`, built on AI SDK v6.
- Provider and model come from env (`LLM_PROVIDER`, `LLM_MODEL`, plus the matching key). Default: Groq free tier. Swap to OpenAI or Anthropic by changing those values only.
- The gateway owns: timeout, one bounded retry on transient errors, token-usage logging, and the validate-and-repair loop for structured output.

### 6.2 The agentic loop (`lib/ai/orchestrator`)
1. **Plan.** The model is given the query and the three tool definitions and asked, via tool-calling, which tools to call and with what arguments. It may choose any subset.
2. **Execute.** Selected tools run; independent tools run in parallel. Each returns a typed result carrying its `source` metadata. Tool failures return a typed "unavailable" result, never throw.
3. **Synthesize.** The model receives the tool results and produces a `ResearchReport` conforming to the Zod schema, with every claim carrying a `sources` array.
4. **Validate and repair.** Output is parsed against the schema. On failure, one repair pass. On second failure, return a partial report with an error banner rather than failing the request.

### 6.3 The three tools (function-calling definitions)
- **`get_market_data(tickers[], range)`** — price, volume, P/E, market cap, revenue, EPS, and historical prices for one or more tickers. Reads through `query_cache`. Source label: the market data provider.
- **`search_news(query, since_days)`** — recent financial news for a company, each item summarized and classified positive/negative/neutral with a confidence. Recency-filtered to 7 to 30 days. Source label: the article outlet and URL.
- **`search_knowledge_base(query, company?)`** — semantic retrieval over `document_chunks`, tenant-scoped by RLS, returning the most relevant filing/earnings passages. Source label: the document title and type.

### 6.4 The output contract (`ResearchReport` Zod schema, summarized)
- `summary`: short synthesized overview.
- `companies[]`: per company — overview card fields, key metrics, `sources[]`.
- `comparison?`: table rows when multiple companies are present, each cell sourced.
- `priceSeries?`: points for the chart.
- `news[]`: items with `sentiment`, `confidence`, `publishedAt`, `source`.
- `risks[]`: each with a short rationale and `sources[]`.
- `toolsUsed[]` and `meta`: which tools ran, latency, token usage. Powers the "AI reasoning" view and proves the agentic behavior in the demo.
- **Rule:** no field carrying a factual claim may have an empty `sources` array. Source attribution is structurally required.

### 6.5 Prompting decisions (recorded for the interview)
- The planner prompt states the tool contracts and instructs the model to call only what the query needs and to prefer parallel calls. Decision recorded: tool selection is delegated to the model, not hinted by keyword rules, to satisfy the "not a hardcoded sequence" requirement honestly.
- The synthesis prompt is given only the tool outputs and is instructed to attribute every claim to a provided source and to never invent a source. Hallucinated attribution is the main risk; the schema plus this instruction plus validation are the three mitigations.

---

## PART 7 — API DESIGN

All endpoints are under `/api`. All return the standard envelope. **Authentication itself (signup, login, logout, session) is handled by Supabase Auth via its client and server helpers, so there are no custom auth endpoints.** Our only auth-adjacent server endpoint is a one-time onboarding call. All tenant-scoped endpoints resolve `org_id` from the session and rely on RLS plus service-layer scoping. Admin-only endpoints additionally check role. The Tier column ties each endpoint to Part 9.5.

| Method | Path | Auth | Role | Tier | Purpose |
|---|---|---|---|---|---|
| POST | `/api/onboarding` | session | any | MUST | Once after first login: create a new org (caller becomes admin) or join via invite code (caller becomes analyst); writes the profile |
| GET | `/api/me` | session | any | MUST | Current user, org, role |
| POST | `/api/research` | session | any | MUST | Run the agentic research query; returns a ResearchReport |
| POST | `/api/research/save` | session | any | MUST | Persist a generated report |
| GET | `/api/research` | session | any | MUST | List the org's saved reports (filter by tag, search text) |
| GET | `/api/research/:id` | session | any | MUST | Read one report (re-checked against tenant) |
| PATCH | `/api/research/:id` | session | any | MUST | Update title or tags |
| DELETE | `/api/research/:id` | session | any | MUST | Delete a report |
| GET | `/api/health` | public | — | MUST | DB and LLM gateway reachability |
| POST | `/api/org/invite` | session | admin | SHOULD | Generate or return invite code |
| GET | `/api/org/members` | session | admin | SHOULD | Read-only member list |
| GET | `/api/watchlist` | session | any | SHOULD | List watchlist |
| POST | `/api/watchlist` | session | any | SHOULD | Add a ticker |
| DELETE | `/api/watchlist/:id` | session | any | SHOULD | Remove a ticker |
| GET | `/api/audit` | session | admin | COULD | List audit events |
| PATCH | `/api/org/members/:id` | session | admin | WON'T (MVP) | Change a member's role |

- Auth flows use the Supabase client (`signUp`, `signInWithPassword`, `signOut`) and server-side session helpers in middleware; we do not reimplement them as routes.
- `POST /api/research` is a normal async call with a loading state in the MVP; the SSE streaming variant is a WON'T-tier bonus.
- Request and response shapes for each endpoint are defined as Zod schemas in a shared `contracts` module and documented in ARCHITECTURE.md as the API reference.

---

## PART 8 — FRONTEND SPECIFICATION

### 8.1 Routes
- `/login`, `/signup` — auth, with org creation or invite-code join.
- `/` (dashboard home) — recent queries, saved reports, bookmarked companies, quick actions (New Research, Compare Companies).
- `/research/new` — the natural-language query interface with example prompts.
- `/research/[id]` — the structured report view, including the AI reasoning panel.
- `/history` — searchable, tag-filterable list of saved reports with delete.
- `/watchlist` — managed list of companies.
- `/admin` — members, invitations, roles, audit trail. Visible to admins only.

### 8.2 The structured rendering contract
The report view never prints raw text or markdown blocks of data. It maps `ResearchReport` fields to components: company overview cards, a comparison table with color-coded values, a price chart, news rows with sentiment badges, a risks section, and a source chip on every datum that links to or names its origin. An "AI reasoning" disclosure shows `toolsUsed`, latency, and the plan, which is both a product feature and the live proof of agentic behavior.

### 8.3 States and quality bar
Every async surface renders loading, error, and empty states. Empty states are designed, not blank. The visual language is clean, information-dense, and intentional, not a default template: a restrained palette, a clear type hierarchy, generous spacing, and components that look considered. Desktop-first, responsive where cheap.

### 8.4 Component and state decisions
- shadcn/ui plus Tailwind for accessible, composable primitives we control, over a heavy component library we would have to fight.
- TanStack Query for all server state (D11). Mutations invalidate the relevant queries so the UI is always consistent after save, delete, or role change.

---

## PART 9 — MULTI-TENANCY AND SECURITY

### 9.1 The isolation model, end to end
1. The user authenticates; Supabase issues a JWT carrying their user id.
2. Every API request resolves the user and their `org_id` from `profiles`.
3. Every database read and write runs under RLS, which restricts rows to the caller's `org_id` at the Postgres tier.
4. The service layer also scopes by `org_id` (defense in depth), and any id taken from a URL is re-validated against the tenant before use.
5. Result: a user in Org B cannot read or mutate Org A's rows by any route, including a crafted request with a guessed report id, because the database itself refuses the row.

### 9.2 RBAC matrix
| Capability | Analyst | Admin |
|---|---|---|
| Run, save, read, update, delete own research | yes | yes |
| Manage watchlist | yes | yes |
| View all org research | scoped to org | yes |
| Invite members, view members | no | yes |
| Change member roles | no | yes |
| View audit trail | no | yes |

Enforced in three places: RLS where applicable, a server-side role check in admin services, and the UI hiding admin surfaces. The server check is the authority; the UI hide is courtesy.

### 9.3 Organization lifecycle
Sign-up either creates a new organization (the creator becomes admin) or joins an existing one via invite code (the joiner becomes analyst). Invite codes are generated by admins. This is the simplest correct org-management flow and is recorded as a deliberate MVP scope choice.

### 9.4 Proving it in the demo
The seed script creates two organizations, each with an admin and an analyst and its own reports and watchlist, with distinct, recognizable data. The isolation workflow logs into each and shows the data is disjoint, then attempts a direct cross-tenant id fetch and shows it denied.

---

## PART 9.5 — IMPLEMENTATION TIERING (MoSCoW)

The constitution describes the full design. The build does not implement all of it in the MVP window. This section is the honest separation between what is designed and what is built by Tuesday, tiered by rubric impact. This separation is itself a deliberate engineering decision: design completely, implement by priority under a time budget, and keep the cut items as the credible "what two more weeks would add" story.

**Rule:** build top-down. Do not start a lower tier until the tier above is complete and at a checkpoint.

### MUST (the MVP; non-negotiable; this is a passing, demoable submission)
- Supabase Auth (signup, login, logout, session) used directly, plus a single onboarding call that creates or joins an org and writes the profile.
- Organizations, profiles, the two roles, and RLS on every tenant table. Tenant + role middleware.
- The seed script with two orgs, each with an admin and an analyst and distinct data.
- The three tool clients (market, news, knowledge base) behind the read-through cache, each sourced and failing safely.
- The agentic loop: planner selects tools, executor runs them, synthesizer returns a Zod-valid sourced ResearchReport, with validate-and-repair.
- Research CRUD: run, save, list with tag and text search, read with tenant re-check, delete.
- Frontend: dashboard, query interface, structured report view (cards, one price chart, comparison table, news with sentiment badges, risks, source chips, a simple "tools used" indicator), history.
- The three demo workflows working end to end.
- ARCHITECTURE.md (five diagrams), DECISIONS.md, README with screenshots, `.env.example`, `.gitignore`, Docker Compose, seed.

### SHOULD (do if the MVP is solid before Monday evening)
- Company watchlist (assignment-recommended; cheap CRUD).
- Org invite-code generation and a read-only members list for admins.
- B1 live deploy to Vercel + Supabase with a URL in the README.

### COULD (only if comfortably ahead)
- audit_events table with event writing on key actions (no dedicated UI).
- The detailed AI reasoning panel (latency, token usage, full plan) beyond the simple "tools used" indicator.
- B3 export to PDF or CSV.

### WON'T (this MVP; kept in the design as the two-weeks-more story)
- Role-change UI and endpoint (RBAC is demonstrated by seeded admin and analyst; changing roles is not required by the rubric).
- A full audit-trail UI and filtering.
- B2 SSE streaming (structured JSON mid-stream is fiddly; not load-bearing).
- B4 CI/CD and broad test suites beyond the isolation tests.
- Schema-per-tenant, scheduled cache/embedding refresh jobs, document upload and re-indexing UI.

Any WON'T item that gets built early is promoted; any MUST item at risk on Monday evening triggers a scope conversation, never a silent slip.

---

## PART 10 — THE BUILD ROADMAP (STEP-WISE)

Steps are ordered by dependency, not by day. Each step lists its goal, the rubric it serves, why it is here, what was rejected, and its **machine test** (the check that proves it is done). **CHECKPOINT** markers denote a state where the app runs and could be submitted. Stop at any checkpoint and you have a coherent project.

### PHASE 0 — Foundations
- **0.1 Repo and tooling.** Initialize Next.js 16 (App Router, TypeScript), Tailwind, shadcn/ui, ESLint, Prettier, `.gitignore`, Conventional Commits. *Machine test:* `npm run dev` serves a blank app; `npm run lint` passes.
- **0.2 Config module.** Zod-validated env loader that fails fast on missing vars; `.env.example` seeded. *Machine test:* booting with a missing required var prints a clear error and exits.
- **0.3 Supabase project and migrations baseline.** Create the project, wire the client, set up the migration tooling. *Machine test:* a trivial migration applies and a health query returns.
- *Why first:* nothing can be built or tested without config, lint, and a reachable database. *Rejected:* deferring tooling to "later", which always becomes never and pollutes the commit history.

### PHASE 1 — The multi-tenant spine (built before any feature)
- **1.1 Schema for organizations and profiles, with the role enum.** *Machine test:* migration applies; tables exist with constraints.
- **1.2 Auth via Supabase Auth** (signup, login, logout, session through the Supabase client and server-side session helpers), protected routes, and a one-time `POST /api/onboarding` that creates or joins an org and writes the profile. No custom auth endpoints. *Machine test:* a scripted signup then login yields a session, and onboarding produces the correct org and role.
- **1.3 RLS on organizations and profiles**, plus the `org_id` resolver helper. *Machine test:* a second user in a different org cannot read the first user's profile row (proven by a SQL or API check).
- **1.4 Tenant + role middleware** that resolves `org_id` and role on every request and exposes them to services. *Machine test:* an admin-only route returns 403 for an analyst and 200 for an admin.
- *Why before features:* every feature table inherits this spine. Building isolation first means no feature is ever written without it. *Rejected:* bolting tenancy on at the end, which is how leaks happen.
- **CHECKPOINT A:** auth and isolation work. Two orgs, two roles, enforced at the database. This alone demonstrates the 15% criterion.

### PHASE 2 — Data model and seed framework
- **2.1 Remaining tables and RLS:** research_reports, report_tags, watchlist_items, documents, document_chunks (with pgvector), query_cache, audit_events, with indexes from Part 5.3. *Machine test:* all migrations apply; RLS denies cross-tenant access on each tenant table.
- **2.2 Seed framework:** idempotent script creating two orgs, four users (admin+analyst each), recognizable per-org data, and the audit baseline. *Machine test:* `npm run seed` on a clean database produces the two-org fixture; re-running does not duplicate.
- *Why here:* features and the demo both need realistic data immediately, and the evaluator must see data on first run. *Rejected:* manual data entry, which is not reproducible and fails the "see data immediately" requirement.
- **CHECKPOINT B:** the database is complete, isolated, and seeded.

### PHASE 3 — Tool clients (no AI yet)
- **3.1 query_cache read-through helper.** *Machine test:* a second identical call is served from cache (logged), not the upstream.
- **3.2 Market data client** behind the cache, normalized to our type with source metadata, timeout and retry. *Machine test:* fetching two tickers returns normalized data with sources; a forced upstream failure returns a typed unavailable result, not a throw.
- **3.3 News client** with recency filter, normalized with source and URL. *Machine test:* returns items within the recency window, each with a source.
- **3.4 Knowledge-base ingestion + retriever:** the seed script chunks the synthetic filings (Appendix B), embeds them once via the gateway, and stores them in document_chunks. There is no runtime upload or re-indexing UI. The retriever does tenant-scoped vector search with a keyword fallback. *Machine test:* a query returns relevant chunks for the seeded company and zero chunks for another org's documents.
- *Why before the AI:* the orchestrator can only be trusted if each tool is independently proven. *Rejected:* building tools and AI together, which makes failures impossible to localize.
- **CHECKPOINT C:** every data source works, is cached, is sourced, and fails safely, callable without the LLM.

### PHASE 4 — AI orchestration (the 25%)
- **4.1 The LLM gateway** on AI SDK v6: provider via env, Groq default, structured-output and tool-calling helpers, validate-and-repair, token logging. *Machine test:* a structured call returns schema-valid JSON; an induced malformed output triggers exactly one repair pass.
- **4.2 The planner:** model selects tools from the query via tool-calling. *Machine test:* a news-only query plans only the news tool; a multi-company comparison plans market + KB for several tickers.
- **4.3 The executor:** runs selected tools, parallel where independent, aggregates typed results. *Machine test:* two independent tools run concurrently (observable in the latency log) and one tool's failure degrades only its section.
- **4.4 The synthesizer:** produces a schema-valid ResearchReport with non-empty sources on every factual field. *Machine test:* the validator rejects any report containing a claim with empty sources.
- *Why this order:* plan, then execute, then synthesize is the honest agentic flow the rubric asks for, and each sub-step is separately testable. *Rejected:* a single mega-prompt that fetches and writes in one shot, which is neither inspectable nor faithful to tool-calling.
- **CHECKPOINT D:** `POST /api/research` returns a real, structured, sourced report from a natural-language query, end to end, server-side.

### PHASE 5 — API surface and contracts
- **5.1 Contracts module:** Zod request/response schemas for every endpoint in Part 7. *Machine test:* invalid input returns 422 with field detail.
- **5.2 Research CRUD:** save, list (tag + text filter), read (tenant re-check), update, delete, each writing an audit event. *Machine test:* full create-read-update-delete cycle scoped to the org; cross-tenant read of a known id returns 404/403.
- **5.3 Watchlist and admin endpoints** (members, invite, role change, audit). *Machine test:* role changes and invites work for admin, are denied for analyst.
- *Why here:* the UI needs stable, validated contracts to build against. *Rejected:* letting the UI shape the API ad hoc, which produces inconsistent envelopes and weak validation.
- **CHECKPOINT E:** a complete, validated, audited API. The product is fully usable via API.

### PHASE 6 — Frontend
- **6.1 App shell, auth screens, protected layout, TanStack Query provider.** *Machine test:* unauthenticated access redirects to login; authenticated lands on the dashboard.
- **6.2 Dashboard home:** recent queries, saved reports, watchlist, quick actions. *Machine test:* reflects seeded data for the logged-in org only.
- **6.3 Research query interface** with example prompts and full loading/error states. *Machine test:* submitting a query renders a structured report; a forced backend error renders the error state, not a crash.
- **6.4 Structured report view:** cards, comparison table, price chart, news with sentiment badges, risks, source chips, and the AI reasoning panel. *Machine test:* every factual element shows a source; the reasoning panel lists the tools actually used.
- **6.5 History (search, tag filter, delete), watchlist management, admin panel.** *Machine test:* search and tag filter return correct subsets; admin panel is absent for analysts.
- *Why after the API:* a product, not a Postman collection, but built on contracts that already hold. *Rejected:* UI-first against mocked data, which hides integration bugs until the end.
- **CHECKPOINT F:** the full product runs locally and demos all three workflows. This is a complete, submittable project.

### PHASE 7 — Hardening and the docs that are graded
- **7.1 Isolation tests:** automated checks that a cross-tenant read and write are denied at the database, plus an admin-vs-analyst permission test. *Machine test:* the suite passes and fails loudly if a policy regresses.
- **7.2 Error-path polish:** every external failure mode produces a designed degraded state; rate-limit handling on external calls is verified.
- **7.3 ARCHITECTURE.md** with the five Mermaid diagrams and the API reference. **DECISIONS.md** answering all seven assignment questions from the Decision Ledger. **README.md** with chosen option and rationale, stack rationale, tested setup steps, 4 to 6 screenshots, and known limitations. *Machine test:* a clean clone followed only by the README steps brings the app up with seeded data.
- **7.4 Docker Compose** for one-command local setup; `.env.example` complete; `.gitignore` verified clean. *Machine test:* `docker compose up` on a fresh checkout serves the app.
- **CHECKPOINT G:** all required deliverables exist and the setup is reproducible on a clean machine.

### PHASE 8 — Presentation and rehearsal
- **8.1 PRESENTATION.pptx:** problem, architecture (the diagrams), AI orchestration, multi-tenant story, decisions and trade-offs, demo, what is next. Structure in Part 11.5.
- **8.2 Demo rehearsal** of the three workflows plus the cross-tenant denial, timed to the 15-minute slot.
- **8.3 INTERVIEW_PREP.md** final pass: every decision in interview phrasing plus anticipated questions and answers (maintained throughout, finalized here).
- **CHECKPOINT H:** ready to present.

---

## PART 11 — DELIVERABLES (mapped to assignment Section 4)

### 11.1 GitHub repository
Complete source, frequent meaningful commits, `.gitignore` (no node_modules, no .env, no build artifacts), seed scripts so data appears on first run.

### 11.2 README.md
Which option and why; tech stack and rationale; setup steps tested on a clean clone (Docker Compose preferred); 4 to 6 screenshots of the running app; known limitations. The README is graded under Communication; it must actually work when followed verbatim.

### 11.3 ARCHITECTURE.md
The five diagrams (Part 4.2) and the API reference (Part 7), in Mermaid plus exported images.

### 11.4 DECISIONS.md (1 to 2 pages)
Answers, drawn from the Decision Ledger: which option and why; why this stack and what was considered; the multi-tenancy approach and why; the AI integration design and prompt-engineering choices; trade-offs given the timeline; what two more weeks would add; the hardest part and how it was solved.

### 11.5 PRESENTATION.pptx (15-minute walkthrough)
Slides: title and problem; the product in one screen; system architecture; the agentic AI flow; the multi-tenant isolation story; key decisions and trade-offs; live demo pointer; what is next. Diagrams come straight from ARCHITECTURE.md.

### 11.6 INTERVIEW_PREP.md (our side knowledge base)
Maintained in parallel with the build. For every decision: the one-line interview answer, the merit reason, the alternative rejected, and the likely follow-up questions with answers. This is the file you study before the interview.

### 11.7 Working demo
Runnable locally with Docker Compose; three workflows demonstrable: the core AI feature, two-org isolation, and role-based access.

---

## PART 12 — THE DEMO SCRIPT

1. **Core AI feature.** Log in as Org A analyst. Run the NVIDIA overview query. Narrate the reasoning panel as the tools fire (this proves agentic tool selection). Walk the structured report and point at source chips. Save and tag it. Show it appears in history.
2. **Isolation.** Open Org B in a second session. Show its dashboard holds only Org B data. Copy an Org A report id and attempt to fetch it as Org B; show the denial. State the one-liner: enforced at the database, not in app code.
3. **Roles.** As Org A admin, open the admin panel, invite a user, change a role, view the audit trail. Log in as an analyst; show the admin panel is gone and the admin API returns 403.
4. **Resilience aside (optional).** Toggle a tool to fail; show the report degrades that one section gracefully rather than crashing.

---

## PART 13 — BONUS LAYERS (independent, droppable)

Each is a self-contained module added only after CHECKPOINT F. Dropping any of them leaves a complete project.
- **B1 Live deploy** to Vercel + Supabase, with a working URL in the README. Cheapest high-value bonus on this stack.
- **B2 SSE streaming** of the research run, layered on top of the working async `POST /api/research` so it can never block the core. Streams the plan and sections as they complete.
- **B3 Export** a report to PDF or CSV from the report view.
- **B4 Tests and CI** beyond the isolation suite: unit tests for the orchestrator and services, a GitHub Actions lint/test/build pipeline.

Priority if time allows: B1, then B2, then B4, then B3. All are in the pipeline; none is load-bearing.

---

## APPENDIX A — ENVIRONMENT VARIABLE CATALOG (.env.example)

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (browser-safe).
- `SUPABASE_SERVICE_ROLE_KEY` — server-only privileged key. Never exposed to the client.
- `LLM_PROVIDER` — `groq` | `openai` | `anthropic`. Default `groq`.
- `LLM_MODEL` — model string for the chosen provider.
- `LLM_API_KEY` — key for the chosen provider.
- `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL` — for knowledge-base embeddings.
- `MARKET_DATA_API_KEY` — if the chosen market source requires one.
- `NEWS_API_KEY` — if the chosen news source requires one.
- `APP_URL` — base URL for links and callbacks.
Each variable is documented inline in `.env.example` with a one-line description and a safe placeholder.

## APPENDIX B — SYNTHETIC DATA AND KNOWLEDGE BASE SPEC

- **Demo companies:** a small set (for example NVIDIA, AMD, Intel, plus one or two from another sector) so comparisons are meaningful. The seed pre-warms `query_cache` for these.
- **Knowledge base:** 4 to 6 hand-authored documents **in total** (not per company), for example a synthetic earnings-call summary and a risk-factors excerpt for two or three of the demo companies, in markdown, each with a clear source label. They are generated once (an LLM can draft them), saved under `/data`, and ingested by the seed script, which chunks them with overlap, embeds them once, and stores them. No runtime upload or re-indexing. Synthetic content is explicitly allowed by the assignment; the ingestion pipeline is the graded artifact, so volume is not the point. In the interview, note this scales to N documents unchanged.
- **Per-org data:** Org A and Org B each get distinct saved reports, tags, and watchlist entries so isolation is visually obvious.

## APPENDIX C — COMMIT AND BRANCH CONVENTION

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`. The body explains the decision, not just the change.
- Short-lived branches per phase, merged at each checkpoint, so history reads as the narrative of the build.

## APPENDIX D — RISK REGISTER

| Risk | Mitigation |
|---|---|
| Free API rate limits or downtime during the demo | Read-through cache pre-warmed by seed; demo serves from cache |
| Model returns malformed structured output | Strict Zod schema + one repair pass + graceful degrade |
| Hallucinated source attribution | Schema requires sources; synthesis prompt forbids invented sources; validation enforces |
| RLS policy regression leaks data | Automated cross-tenant isolation tests in CI |
| Evenings-only overrun | Checkpoint ordering; stop at any checkpoint with a coherent submission; bonuses are droppable |
| pgvector index or embedding dimension mismatch | Pin embedding model and vector dimension in config; verify at seed time |

---

## CHANGELOG
- **v1.1** — Merged a three-model review round. Added Part 9.5 Implementation Tiering (MoSCoW) to separate the full design from the MVP build path under the evenings-only budget. Replaced custom auth endpoints with Supabase Auth used directly plus a single `/api/onboarding` call. Tagged every API endpoint with its tier and demoted role-change to WON'T-for-MVP. Clarified the knowledge base to 4 to 6 documents total, embedded once at seed with no runtime ingestion UI. Verified and held Next.js 16 and Vercel AI SDK v6 as current stable as of June 2026 against stale reviewer claims of 15 and v4. Retained the validate-and-repair loop with rationale that it reduces live-demo risk on free models.
- **v1.0** — Initial constitution. Stack locked to Next.js 16 + Supabase + Vercel AI SDK v6 after a documented merit-based comparison against FastAPI and a FastAPI+Supabase hybrid. Option A selected. Roadmap structured into eight phases with checkpoints A through H.
