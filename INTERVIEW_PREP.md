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

## SECTION 3 — GROWING LIST (add as we build)
- (Append per-step decisions and any new questions here during implementation.)
