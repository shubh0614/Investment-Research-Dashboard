# DECISIONS - Klypup Investment Research Dashboard

> The reasoning behind the architecture. Not a list of "here's why my choices were correct" - these are trade-offs made under real constraints, with honest assessment of what was gained and what was left on the table.

---

## 1. Why Option A?

Option A's two hardest problems - multi-tenant data isolation over a shared vector knowledge base, and genuinely agentic tool selection - map directly to what the rubric weights most (15% multi-tenancy, 25% AI). Option B is wider (five specialised agents) but shallower per component; Option A let me go deep on fewer, harder problems rather than building five things at surface level.

The specific draw was the intersection of pgvector and RLS. Isolating a relational database is a solved problem. Isolating a vector knowledge base - where you can't just add a WHERE clause to a cosine similarity search - is not. The fact that Supabase runs pgvector inside Postgres means the same RLS policies that guard reports automatically guard embeddings. That's the kind of compound problem worth solving properly.

---

## 2. Stack choices

**Next.js App Router as a full-stack monolith.**

A note on the Python question first. My background is AI engineering - Python is my primary language, FastAPI is the stack I reach for by reflex when building anything LLM-related. The deliberate choice not to use it here is worth explaining, because it is not a gap in knowledge, it is a judgment call about where the hard problem actually lives.

For Option A, the hard problem is multi-tenant data isolation over a shared knowledge base and a correctly typed AI output pipeline, not heavy ML compute. A Python backend buys you nothing in that problem space. What it costs is a network boundary, two type systems that have to agree on the shape of `ResearchReport` - the exact seam where AI integrations break - and a second deployed service with no justification for the scope. The Vercel AI SDK normalises tool-calling and structured output across Groq, OpenAI, and Anthropic behind one interface. There is no Python AI ecosystem advantage to chase here; the model calls are three lines regardless of the language they run in. The interesting engineering is in the data tier and the type contract, both of which are better served by a monolith.

If this were Option B (five specialised agents doing heavy compute, inter-agent messaging, a pricing recommendation pipeline), Python would have been the right call. It was not here.

The key advantage of the monolith is that the `ResearchReport` type is defined once in `lib/ai/schemas.ts` and used at every layer - Zod validates the model output at the API boundary before the frontend ever sees it. A separate backend would have meant maintaining that contract in two places, which is exactly how AI integrations develop silent bugs.

The other reason is deployment. One service, one deploy, no CORS surface, no cross-service session plumbing.

**Supabase for auth, database, and vector store.**
The honest reason is risk reduction, not feature count. Auth from scratch is a security risk. A separate vector database (Pinecone, Chroma) would mean implementing tenant isolation twice and keeping two stores consistent - which is how you get subtle cross-tenant leaks in the retrieval path that are hard to test. Putting everything in Postgres means one isolation mechanism covers everything.

The free tier constraint also mattered here: Supabase's free tier includes pgvector, RLS, and auth in one project. Running Postgres + a separate vector store + a self-hosted auth service locally was a non-starter for a two-week build.

**Vercel AI SDK v6 as the LLM gateway.**
The primary reason was Groq compatibility. The realistic development choice was Groq's free tier (LLaMA 3.3-70b) for iteration speed, with OpenAI as the production option. The AI SDK normalises tool-calling and structured output across providers so switching is a config change. This turned out to be load-bearing - Groq and OpenAI have meaningfully different behaviours (Groq requires `json_object` mode, OpenAI supports `json_schema`; Groq occasionally fails tool-call JSON generation on the first attempt), and the gateway abstraction meant those differences stayed confined to `lib/llm/` rather than leaking into the orchestrator.

Direct OpenAI client was considered and rejected because it couples the entire AI layer to one vendor's API shape.

---

## 3. Multi-tenancy: why RLS at the database tier?

The short answer is that app-layer filtering is one forgotten `WHERE org_id = ?` away from a permanent cross-tenant data leak on every query. RLS makes isolation a property of the data, not a convention in application code. A bug in a service function degrades a feature; a missing RLS policy is a security incident.

The practical consequence: every time a new table gets added, the RLS policy is part of the migration - you can't ship the table without shipping its isolation guarantee. App-layer filtering requires discipline across every developer, forever.

The `SECURITY DEFINER` choice on `current_org_id()` and `current_user_role()` wasn't a preference - it was a technical constraint. If those functions ran with the caller's rights, evaluating `current_org_id()` to check a profiles row would itself be subject to a profiles RLS policy that calls `current_org_id()`, creating infinite recursion. The `SECURITY DEFINER` with `SET search_path = public` is the minimal fix: it makes one internal read (`profiles WHERE id = auth.uid()`) bypass RLS, which is the smallest possible surface.

The `test-isolation.mjs` script exists because "we have RLS policies" is not the same as "they work". The test logs in as a user in Org B, attempts to read an Org A report by UUID (a direct ID-guessing attack), and asserts zero rows returned. It's a proof, not documentation.

*What was rejected:* schema-per-tenant is a stronger isolation boundary but adds real operational cost (migrations must run across N schemas, connection pooling gets complicated). For two organisations in a demo, that complexity has no upside.

---

## 4. AI integration: plan → execute → synthesize

The split into three phases came from a real constraint, not a design preference.

Groq's API does not support generating structured output (a JSON object conforming to a schema) and tool calling in the same request. OpenAI supports both via different endpoints; Groq supports them separately. So the choice was: do tool selection in one call (text generation with tools), get the tool results, then do synthesis in a second call (JSON generation from context). The separation ended up being cleaner than a single-pass approach anyway - the planner can fail without affecting synthesis, and each step has a single, testable responsibility.

**On tool selection being model-driven:**
The planner passes the query and four tool definitions to the model and asks it to decide. This sounds like the obvious approach, but the realistic alternative - keyword routing (`if "price" in query → call market data`) - is faster, cheaper, and more predictable. The model-driven approach was chosen because it's what the rubric actually asks for, and because it handles genuinely ambiguous queries better: "What's the outlook for NVDA's AI business?" should call market data, news, KB, and web search, but a keyword rule would have to enumerate every variation of that.

The downside is flakiness. LLaMA 3.3-70b on Groq occasionally fails to generate valid tool-call JSON on the first attempt - not because the prompt is wrong, but because smaller models have lower reliability on function-calling. The retry in `lib/llm/index.ts` (`generateWithTools`) exists because we hit this in production. The retry is unconditional on the specific error string because catching the wrong error is worse than retrying once.

**On post-synthesis metric injection:**
The orchestrator overwrites the LLM's numeric metrics (price, P/E, market cap) with values fetched directly from Finnhub after synthesis. This is a workaround for a real problem: LLMs are unreliable at copying numbers accurately, especially when the context is long and the numbers appear multiple times. The injected values are the ground truth; the model's job is to write prose, not transcribe floats. The injection happens in `lib/ai/orchestrator.ts` after `runSynthesizer` returns.

**On the repair loop:**
The synthesizer asks the model to produce a `ResearchReport` JSON. If Zod validation fails, it attempts one repair: the model is given its previous output and the validation error and asked to fix it. This handles roughly 95% of failures in practice, mostly cases where the model uses a wrong field name (`title` instead of `headline`, `description` instead of `rationale`). The normalization pass in `lib/llm/index.ts` (`normalizeLLMOutput`) handles the other common patterns. If both fail, the user gets an error banner - not a 500, not a blank page.

---

## 5. What was cut, and why

**Role management UI.** The RBAC capability is demonstrated by the seeded accounts and enforced by RLS + service-layer checks. A UI for changing roles adds no new technical surface and the rubric doesn't weight it.

**Streaming (SSE).** The synchronous research flow is the reliable path. Streaming structured JSON mid-generation is not straightforward: partial JSON doesn't validate, so you'd need either a streaming format that skips validation or a UI that renders partial state gracefully. That's a non-trivial problem on its own, and the synchronous path works correctly end-to-end. Streaming is a UX improvement, not a correctness requirement.

**Full audit-trail UI.** Audit events are written on key actions (the table and writes exist), but there's no dedicated browser page. The storage layer is done; the UI is the missing piece.

**Real KB documents.** The four synthetic documents per org are stand-ins for real earnings transcripts or SEC filings. The rubric permits this, and the interesting technical work - chunking, embedding, HNSW indexing, tenant-scoped retrieval - is the same regardless of whether the source text is real or authored.

---

## 6. What two more weeks would add

**Embeddings.** The KB currently falls back to Postgres full-text search because the seed script can't embed without an OpenAI key. Wiring Groq's embedding API (or a lightweight open model via Hugging Face) would restore vector similarity search without requiring OpenAI.

**Schema-per-tenant.** The current one-schema-with-org_id approach is correct at this scale. For a product that needed to support organisations with meaningful data sensitivity requirements - or that expected to onboard many organisations - schema-per-tenant is the right boundary. The migration path is known (create schema per org, replicate tables, update the search_path in the helper function); it's a question of operational readiness, not difficulty.

**Eval harness.** Right now, report quality is assessed by looking at outputs. An eval harness would run a fixed set of queries and score attribution correctness, schema compliance rate, and tool selection accuracy against ground truth. That's what would let you actually improve the prompts rather than guess.

**Streaming.** Once the synchronous path is stable (it is), streaming is the right next UX investment. The step indicator currently shows Planning → Running → Synthesizing as discrete phases; streaming would let each section of the report appear as it's generated.

---

## 7. What was actually hard

**Groq tool-calling flakiness.** LLaMA 3.3-70b fails to generate valid tool-call JSON on roughly 5–10% of requests, returning a Groq API error rather than a structured response. This is not a prompt problem - the same prompt succeeds 90% of the time. The fix (retry once on the specific error) is pragmatic rather than elegant, but it works. The underlying issue is that smaller open-weight models have meaningfully lower function-calling reliability than GPT-4-class models.

**Unicode in web search results.** Groq's API rejects message content containing non-ASCII characters - Indian company names, smart quotes, em dashes from web snippets all trigger the error `Input contains unsupported content types`. This was not obvious from the documentation; it surfaced when the first non-US company query hit production. The fix is a sanitizer in `lib/ai/synthesizer.ts` that normalises common Unicode punctuation to ASCII and strips anything else before the context string reaches the API.

**Windows port reservation conflict.** Supabase's default ports (54321, 5432) fall within the range Windows reserves for internal use via WinNAT (roughly 49152–65535, but specifically 54250–54349 on this machine). The symptom was Supabase silently failing to bind - `supabase start` returned success but the DB was unreachable. Solved by remapping all Supabase ports in `supabase/config.toml` to the 54101–54109 range.

**RLS recursion.** The first version of `current_org_id()` was a regular function (not `SECURITY DEFINER`). The first INSERT into `profiles` caused infinite recursion: the INSERT policy called `current_org_id()`, which queried `profiles`, which triggered the policy again. The `SECURITY DEFINER` + `search_path` fix is covered in Section 3.
