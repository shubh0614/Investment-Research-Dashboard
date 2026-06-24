# Submission Verification Script

**Instructions for Claude:** Follow every numbered step below in order. Run each command, check each file, and fill in the checklist at the bottom with PASS or FAIL and a one-line note. When done, output the completed checklist — nothing else.

---

## Step 1 — Clone to a fresh directory

```bash
cd /tmp
git clone https://github.com/shubh0614/Investment-Research-Dashboard.git klypup-verify
cd klypup-verify
```

Confirm: the clone succeeded and you are now inside `/tmp/klypup-verify`.

---

## Step 2 — Check repository structure

Run:
```bash
ls -1
```

Verify each of these files/folders exists:
- `README.md`
- `ARCHITECTURE.md`
- `DECISIONS.md`
- `.env.example`
- `docker-compose.yml`
- `Dockerfile`
- `package.json`
- `scripts/seed.mjs`
- `scripts/test-isolation.mjs`
- `supabase/`
- `lib/`
- `app/`
- `components/`
- `screenshots/` (should contain at least 6 image files)
- `TEST.md`

---

## Step 3 — Check README completeness

Read `README.md` and confirm each of the following sections exists with real content (not placeholders):

- **Option choice + why** (section explaining why Option A was chosen)
- **Tech stack table** (with at least 5 rows)
- **Setup instructions** (numbered steps that a developer can follow)
- **Demo accounts table** (with email, password, org, role columns)
- **Screenshots section** (with at least 4 embedded `![]()` image references)
- **Known Limitations section** (at least 3 items)
- **Live Demo URL** (a working `https://` link)
- **Three Demo Workflows** section

---

## Step 4 — Check .env.example

Read `.env.example` and confirm:
- At least 8 environment variables are defined
- Every variable has a comment or description above it
- No actual secrets are present (all values are placeholders like `your-key-here` or empty)
- `LLM_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TAVILY_API_KEY`, `NEWS_API_KEY`, `MARKET_DATA_API_KEY` are all present

---

## Step 5 — Check ARCHITECTURE.md

Read `ARCHITECTURE.md` and confirm each of the following exists:

- **Diagram 1 (System Architecture):** a Mermaid `graph TB` block showing browser, Next.js, Supabase, and external APIs
- **Diagram 2 (Data Flow):** a Mermaid `sequenceDiagram` block tracing a research request end to end
- **Diagram 3 (ER Diagram):** a Mermaid `erDiagram` block with at least 6 tables including `organizations`, `profiles`, `research_reports`, `document_chunks`
- **Diagram 4 (AI Orchestration):** a Mermaid `flowchart` block showing Plan → Execute → Synthesize → Validate
- **Diagram 5 (Multi-Tenant):** a Mermaid `flowchart` block showing RLS enforcement
- **API Reference table:** a markdown table with Method, Path, Auth, Role, Status codes columns and at least 12 rows
- **Request/response shapes:** a code block showing JSON shapes for at least POST /api/research and POST /api/research/save

---

## Step 6 — Check DECISIONS.md

Read `DECISIONS.md` and confirm it answers all 7 required questions:

- Why Option A (not Option B)?
- Why this tech stack, and what alternatives were considered?
- How was multi-tenancy approached, and what pattern was used?
- How was the AI integration designed, including prompt engineering decisions?
- What trade-offs were made given the timeline?
- What would be improved with 2 more weeks?
- What was the hardest part and how was it solved?

Also confirm: the document does NOT sound like boilerplate ("Decision: X / Rejected: Y" template). It should read like genuine engineering retrospective.

---

## Step 7 — Check source code structure

Run:
```bash
ls lib/ai/
ls lib/tools/
ls lib/llm/
ls app/api/
ls __tests__/
```

Confirm:
- `lib/ai/` contains: `orchestrator.ts`, `planner.ts`, `executor.ts`, `synthesizer.ts`, `schemas.ts`
- `lib/tools/` contains: `market.ts`, `news.ts`, `kb.ts`, `web.ts`, `cache.ts`
- `lib/llm/` contains at least `index.ts` and `providers.ts`
- `app/api/` contains: `research/`, `watchlist/`, `org/`, `health/`, `market-prices/`
- `__tests__/` contains test files

---

## Step 8 — Check AI pipeline files

Read `lib/ai/orchestrator.ts` and confirm:
- It imports from planner, executor, and synthesizer (three-phase pipeline)
- It calls tools in parallel (look for `Promise.all` or `Promise.allSettled`)
- It has post-synthesis metric injection (look for overwriting LLM metrics with Finnhub values)

Read `lib/ai/synthesizer.ts` and confirm:
- A `sanitize()` function exists that strips non-ASCII characters
- The synthesis prompt includes source attribution rules
- It calls `generateStructuredOutput`

Read `lib/llm/index.ts` and confirm:
- A retry exists for Groq tool-calling failures (look for retry logic on "Failed to call a function")
- `generateStructuredOutput` and `generateWithTools` are both exported

---

## Step 9 — Check multi-tenancy

Run:
```bash
ls supabase/migrations/
```

Read the migration files and confirm:
- An `org_id` column exists on `research_reports`, `document_chunks`, `watchlist_items`
- RLS policies exist (`CREATE POLICY` statements)
- A `current_org_id()` or similar helper function exists with `SECURITY DEFINER`

---

## Step 10 — Install dependencies

Run:
```bash
npm install
```

Confirm: exits with 0 errors (warnings are fine).

---

## Step 11 — TypeScript check

Run:
```bash
npx tsc --noEmit 2>&1 | head -30
```

Confirm: zero TypeScript errors (warnings about missing env vars at runtime are acceptable).

---

## Step 12 — Run unit tests

Run:
```bash
npm test -- --passWithNoTests 2>&1 | tail -20
```

Confirm: test suite runs and passes (or no tests found is also acceptable if the test runner exits 0).

---

## Step 13 — Check bonus deliverables

Run:
```bash
cat .github/workflows/ci.yml | head -20
```
Confirm: GitHub Actions CI file exists with at least lint/build steps.

Run:
```bash
ls app/api/research/\[id\]/export/
```
Confirm: `route.ts` exists (PDF/CSV export endpoint).

Read `app/api/health/route.ts` and confirm it returns `{ ok, db, llm }`.

Check `app/api/research/route.ts` for `export const maxDuration = 60`.
Check `app/api/research/[id]/export/route.ts` for `export const maxDuration = 60`.

---

## Step 14 — Check live deployment

Run:
```bash
curl -s https://klypup-research.vercel.app/api/health | head -c 200
```

Confirm: returns JSON with `"ok":true`.

---

## Step 15 — Check commit history

Run:
```bash
git log --oneline | wc -l
git log --oneline | head -10
```

Confirm:
- At least 25 commits
- Commits follow Conventional Commits format (`feat:`, `fix:`, `docs:`, `chore:` prefixes)
- History reads as a narrative of the build (phases visible)

---

## Output Checklist

When all steps are done, output ONLY the following checklist filled in with PASS/FAIL and a brief note:

```
SUBMISSION VERIFICATION REPORT
================================

4.1 GITHUB REPOSITORY
[ ] Repo clones cleanly
[ ] README: option choice + why
[ ] README: tech stack table
[ ] README: setup instructions
[ ] README: screenshots (N embedded)
[ ] README: known limitations
[ ] README: live demo URL
[ ] README: three demo workflows
[ ] .env.example: all vars present + documented
[ ] Seed script exists (scripts/seed.mjs)
[ ] Commit count: N commits
[ ] Commit style: conventional commits

4.2 ARCHITECTURE.md
[ ] Diagram 1 - System Architecture (Mermaid)
[ ] Diagram 2 - Data Flow / sequence diagram (Mermaid)
[ ] Diagram 3 - ER diagram (Mermaid)
[ ] Diagram 4 - AI Orchestration (Mermaid)
[ ] Diagram 5 - Multi-Tenant isolation (Mermaid)
[ ] API reference table (12+ endpoints)
[ ] Request/response shapes shown

4.3 DECISIONS.md
[ ] Q1: Why Option A
[ ] Q2: Tech stack + alternatives
[ ] Q3: Multi-tenancy approach
[ ] Q4: AI integration + prompt engineering
[ ] Q5: Trade-offs given timeline
[ ] Q6: Two more weeks improvements
[ ] Q7: Hardest part + how solved
[ ] Tone: genuine, not boilerplate

4.4 WORKING DEMO
[ ] docker-compose.yml present
[ ] npm install: zero errors
[ ] TypeScript: zero errors
[ ] Unit tests: pass

SOURCE CODE
[ ] lib/ai/ has all 5 pipeline files
[ ] lib/tools/ has all 4 tool clients
[ ] Retry logic for Groq tool-calling
[ ] sanitize() for non-ASCII in synthesizer
[ ] Post-synthesis metric injection
[ ] RLS migrations with SECURITY DEFINER helper
[ ] maxDuration=60 on /api/research
[ ] maxDuration=60 on export route

BONUS
[ ] Live deployment reachable (curl /api/health)
[ ] GitHub Actions CI file
[ ] PDF/CSV export route
[ ] Health endpoint returns {ok, db, llm}

OVERALL: READY / NOT READY
```
