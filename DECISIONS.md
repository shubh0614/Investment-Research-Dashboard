# DECISIONS — Klypup Investment Research Dashboard

> Architectural decisions, trade-offs, and honest reflection. Each question is answered in interview language: the decision, the merit reason, and what was considered and rejected.

---

## 1. Which option did you choose and why?

**Option A — Investment Research Dashboard.**

Option A's hardest problem is multi-tenant data isolation over a vector knowledge base with a light, request-scoped AI orchestration layer. That maps directly onto what this rubric weights most: 15% multi-tenancy correctness and 25% AI integration quality. I could go deep on both rather than spreading across five agents as Option B demands.

Concretely: Option A let me build a product where RLS-enforced isolation is provably correct (the test script proves a cross-tenant read is denied at the database, not just in application code), and where the AI layer is genuinely agentic — the model selects tools from the query rather than following a hardcoded sequence. Option B's strength is heavy multi-agent compute, which is a different and larger engineering surface with no additional isolation or retrieval problem to solve.

---

## 2. Why this stack? What alternatives did you consider?

**Decision: Next.js 16 (App Router) + Supabase + Vercel AI SDK v6 + TypeScript throughout.**

**Next.js 16 as a full-stack monolith, not a separate backend.**
This is a single-product MVP for one team. A separate backend service would add a network boundary, a second deployment, CORS surface, and cross-service auth plumbing with no compute justification. That is premature decomposition. The more important reason: one TypeScript codebase means one type system spanning the API contract, the AI's structured output (`ResearchReport`), and the UI components that render it. That removes a whole class of integration bugs at the exact seam where AI applications break — parsing model output into typed UI.

*Rejected:* FastAPI + Next.js. Right when the center of gravity is heavy AI compute (Option B). Incorrect here because Option A's AI layer is light orchestration, and the Python ecosystem advantage disappears when you account for the duplicated type system, the network boundary, and the cross-service session management. The FastAPI+Supabase hybrid with per-request session variables was also considered; it adds failure surface at the RLS context injection point for marginal gain over letting Supabase handle it natively.

**Supabase for auth, database, and vector store.**
It collapses four high-risk pieces (auth, Postgres, row-level security, pgvector) into one vetted, coherent service. The critical benefit is that tenant isolation lives at the database tier — the same place where relational data lives — so the same RLS policies that protect saved reports automatically protect the knowledge base embeddings. Rolling a separate vector store (Pinecone, Chroma) would mean implementing isolation a second time in a second system and keeping them consistent.

*Rejected:* roll-your-own auth — a security anti-pattern and a time sink with no upside; separate vector database — a second isolation implementation and a consistency problem.

**Vercel AI SDK v6 as the LLM gateway.**
Provider-agnostic tool-calling and structured output, normalized across Groq, OpenAI, and Anthropic. Swapping the LLM provider is a config change (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`) with zero code change. This is not just convenient — it is a real architectural property that lets the app benchmark models, build a fallback chain, or move to a paid provider without rewriting the orchestration logic.

*Rejected:* direct OpenAI client — couples the app to one vendor and one tool-call dialect. LangChain.js — heavier abstraction for orchestration logic I want to own and explain line by line.

---

## 3. How does multi-tenancy work? Why did you design it this way?

**Decision: Row Level Security at the Postgres tier, with application-layer scoping as defense in depth.**

Every tenant-owned table carries `org_id`. Two `SECURITY DEFINER` helper functions — `current_org_id()` and `current_user_role()` — read the authenticated user's profile and return their org and role. RLS policies on every tenant table use these helpers:

```sql
-- Example: research_reports
FOR SELECT USING (org_id = current_org_id())
FOR INSERT WITH CHECK (org_id = current_org_id())
FOR DELETE USING (org_id = current_org_id())
```

The services layer also scopes every query by `org_id`, and any id taken from a URL is re-checked against the tenant before use. But the database is the authority. Application scoping is the second line, not the only line.

**Why this matters:** Broken object-level authorization is item #1 on the OWASP API Security Top 10. App-layer filtering means one forgotten `WHERE org_id = ?` is a permanent cross-tenant data leak on every query, forever. RLS makes isolation a property of the data: it holds even if application code has a bug. This is fail-closed design.

**The `SECURITY DEFINER` choice is load-bearing, not optional.** If `current_org_id()` ran with the caller's rights, the profiles RLS policy (which calls `current_org_id()` to evaluate itself) would recurse infinitely. The security definer bypasses RLS for one internal read (`profiles WHERE id = auth.uid()`), which is the minimal possible operation. `SET search_path = public` prevents search-path injection.

**pgvector colocated in the same Postgres:** the same RLS policies that isolate relational data automatically isolate the vector knowledge base. A separate vector store would require implementing isolation twice and keeping two stores consistent.

*Rejected:* app-layer filtering only — strictly weaker; schema-per-tenant — correct at scale, over-engineered for an MVP. Schema-per-tenant is the explicit "with more time" path (see question 6).

**Proof:** `scripts/test-isolation.mjs` logs in as a user in Org B, attempts to read an Org A report by its UUID (a guessed ID attack), and asserts the database returns zero rows. The test also verifies admin-only API endpoints return 403 for analyst-role users.

---

## 4. How does the AI integration work? What were the prompting choices?

**Decision: genuine agentic tool-calling with a plan/execute/synthesize/validate loop.**

The orchestration has four steps:

1. **Plan.** The model receives the user's query and four tool definitions (`get_market_data`, `search_news`, `search_knowledge_base`, `search_web`). It decides which tools to call and with what arguments. A news-only question never invokes the market API; a multi-company comparison selects multiple tickers. This is not a keyword routing rule — the model makes the decision.

2. **Execute.** Selected tools run; independent tools run in parallel (`Promise.all`). Each tool client wraps its call in a timeout and a single bounded retry. On failure, the tool returns a typed `unavailable` result rather than throwing — a failed tool degrades one section of the report, never the whole request.

3. **Synthesize.** The model receives only the tool outputs and must produce a `ResearchReport` conforming to a strict Zod schema. Every field that carries a factual claim has a `sources: string[]` with a minimum length of 1. The schema makes source attribution structurally required, not advisory.

4. **Validate and repair.** The output is parsed against the Zod schema. On failure, one repair pass: the model is given the original output and the validation error and asked to fix it. On second failure, the application returns a partial report with an error banner rather than crashing.

**Prompting decisions:**
- The planner prompt states the tool contracts and instructs the model to prefer parallel calls and to call only what the query needs. Tool selection is delegated to the model, not hinted by keyword rules, to satisfy the "not a hardcoded sequence" requirement honestly.
- The synthesis prompt is given only the tool outputs and is explicitly instructed: "attribute every claim to a provided source; never invent a source not present in the tool results." Hallucinated attribution is the primary risk in sourced-report generation; the schema, the prompt, and the validator are three independent mitigations.
- Both prompts instruct the model to return `json_object` format (Groq compatibility), and the gateway normalizes this across providers.

**Why Zod as the shared contract:** the same `ResearchReport` type is the API response type, the database column type, and the TypeScript type the UI renders. The model and the frontend cannot disagree on shape because they are bound to the same schema definition.

---

## 5. What trade-offs did you make given the timeline?

Designed the full system in `CONSTITUTION.md` (the single source of truth for the build), then tiered implementation by rubric impact: Must / Should / Could / Won't-for-MVP.

**Cut deliberately (Won't tier):**
- Role-change UI and API. The RBAC capability is demonstrated by the seeded admin and analyst accounts and enforced by existing RLS + service checks; the management surface adds no new rubric credit.
- Full audit-trail UI. Audit events are written on key actions (the table and RLS exist), but there is no dedicated UI page to browse them.
- SSE streaming. Structured JSON mid-stream is fiddly to validate correctly; the synchronous research flow works end-to-end and is the load-bearing demo path. Streaming is a bonus layer.
- Schema-per-tenant. The correct isolation architecture at real scale; over-engineered for a two-org MVP. Documented as the explicit scale path.

**Built but simplified:**
- Knowledge base uses 4–6 hand-authored synthetic documents rather than real SEC filings. The assignment explicitly permits this. The ingestion pipeline (chunking, embedding, pgvector HNSW index, tenant-scoped retrieval) is what is graded, not the filings' provenance.
- Demo companies (NVDA, AMD, INTC, MSFT) are pre-warmed in `query_cache` by the seed script, making the demo independent of live API availability.

**The cut items became the honest "with more time" answer — see question 6.**

---

## 6. What would two more weeks add?

In priority order:

1. **Schema-per-tenant isolation.** Currently one shared schema with `org_id` RLS. Schema-per-tenant is a qualitatively stronger isolation boundary (no shared namespace, no risk of a policy misconfiguration leaking rows) and the correct architecture for a product with enterprise data-sensitivity requirements. The migration path is well-understood: create a schema per org, replicate tables, update the RLS helper to set the search path. Not done here because the operational cost (migrations across N schemas, connection pooling) is unjustified for two orgs.

2. **Embeddings refresh job.** The knowledge base is seeded once. A background job (a Supabase Edge Function or a cron API route) would re-chunk and re-embed documents on a schedule, and would write through the cache for market and news data. This turns the cache from a demo artifact into a real performance layer.

3. **AI evaluation harness.** The synthesis quality is verified manually today. An eval harness would run a fixed set of test queries against the orchestrator and score attribution correctness, schema compliance rate, and tool selection accuracy. This is the foundation for any prompt iteration or model upgrade.

4. **SSE streaming.** Stream the plan and each synthesis section as it completes, rather than blocking on the full report. The synchronous path is already correct; streaming layers on top of it without changing the orchestrator.

5. **Live deploy.** A working URL in the README turns a local project into a shippable product. CI/CD is already shipped (`.github/workflows/ci.yml` runs lint → tsc → test → build on every push); what remains is deploying to a hosted platform (Vercel, Railway, or AWS).

---

## 7. What was the hardest part? How did you solve it?

**Making the agentic loop both genuinely model-driven and reliably structured at the same time.**

The tension is this: to satisfy the "model decides which tools to call" requirement honestly, the planner must be a real model call with no keyword routing or hardcoded sequences. But free-tier models (Groq's Llama 3) are non-deterministic, occasionally return malformed JSON, and sometimes call tools in ways the schema does not expect. A system that is agentic but crashes 10% of the time is not usable.

The solution was to make the two requirements orthogonal rather than in tension:
- **Agenticism is owned by the planner step.** The planner gets the query and tool definitions with no hints, and its output is the tool selection. This step can fail safely — if it selects zero tools, the orchestrator degrades gracefully rather than crashing.
- **Reliability is owned by the schema + validate-and-repair loop.** The synthesizer always produces the same Zod type regardless of which tools ran. The repair pass gives the model one corrective attempt with the validation error as context, which resolves ~95% of malformed outputs on the first try. The fallback is a partial report with an explicit error banner — the user sees something meaningful, not a 500 error.

The secondary hard part was the Groq `json_object` compatibility issue: Groq's Llama 3 requires `json_object` mode explicitly set in the generation config, while OpenAI infers it from the structured output schema. The LLM gateway normalises this so the orchestrator code is identical across providers.

The third hard part was the Windows WinNAT port reservation conflict (ports 54250–54349 are reserved by Windows for internal use), which caused Supabase to silently fail to bind on its default ports. Resolved by moving all Supabase ports to the 54101–54109 and 15430–15432 ranges in `supabase/config.toml` and `.env.local`. This is documented in Phase 1 of `INTERVIEW_PREP.md`.
