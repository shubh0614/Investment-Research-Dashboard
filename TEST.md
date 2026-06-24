# TEST GUIDE - Klypup Investment Research Dashboard

> Step-by-step evaluation script covering all rubric areas. Each test includes the exact action, what to look for, and what a passing result looks like.

---

## Prerequisites

```bash
# 1. Install dependencies
npm install

# 2. Start local Supabase (requires Docker Desktop running)
npm run db:start

# 3. Seed demo accounts, KB documents, and pre-warm cache
node --env-file=.env.local scripts/seed.mjs

# 4. Start the dev server
npm run dev

# 5. Open http://localhost:3000
```

### Demo accounts

| Email | Password | Org | Role |
|---|---|---|---|
| alice@alpha.test | password123 | Alpha Capital | admin |
| bob@alpha.test | password123 | Alpha Capital | analyst |
| carol@beta.test | password123 | Beta Ventures | admin |
| dave@beta.test | password123 | Beta Ventures | analyst |

---

## Test 1 - Authentication

**Goal:** Signup, login, logout, and protected route guard all work.

| Step | Action | Expected result |
|---|---|---|
| 1 | Visit `http://localhost:3000` | Redirected to `/login` (protected route guard) |
| 2 | Click **Sign up**, create a new account | Redirected to `/onboarding` |
| 3 | On onboarding, choose **Create organisation**, enter a name | Redirected to `/dashboard` as admin |
| 4 | Click your avatar / logout button | Redirected back to `/login` |
| 5 | Log in as `alice@alpha.test` / `password123` | Lands on `/dashboard` |
| 6 | Paste a protected URL (e.g. `/admin`) in a private window with no session | Redirected to `/login` |

---

## Test 2 - Core AI Research Feature

**Goal:** Agentic pipeline runs, structured report renders with source attribution.

Log in as `alice@alpha.test`. Go to **New Research**.

### Test 2a - Single company query
Paste this query:
```
Give me an overview of NVIDIA: stock performance this quarter, major news in the last 30 days, and key risks.
```

**What to check:**
- [ ] Step indicator shows: Planning → Running tools → Synthesizing (takes ~15–30s)
- [ ] Report renders with a **Company card** showing: price, market cap, P/E ratio, revenue TTM
- [ ] **Price chart** visible (30–90 day candle series)
- [ ] **News section** with at least 2 articles, each with a sentiment badge (Positive / Negative / Neutral)
- [ ] **Risks section** with at least 2 risk items
- [ ] Every data point shows a **source chip** (e.g. "Finnhub", "NewsAPI", article title)
- [ ] No raw JSON or markdown dumps - everything is rendered as typed UI components

### Test 2b - Multi-company comparison
Paste this query:
```
Compare NVIDIA and AMD: revenue growth, P/E ratio, and competitive position in AI chips.
```

**What to check:**
- [ ] Two company cards appear (NVDA + AMD)
- [ ] A **comparison table** shows both companies side by side
- [ ] A **dual-line price chart** renders both tickers on the same chart
- [ ] Sources cited for both companies independently

### Test 2c - News-only query (tool selection)
Paste this query:
```
What is the latest news about Tesla in the last 7 days?
```

**What to check:**
- [ ] The AI reasoning panel (bottom of report) shows **only** `search_news` and `search_web` were called - `get_market_data` should NOT appear for a pure news query
- [ ] Demonstrates the agent is not a hardcoded pipeline

### Test 2d - Knowledge base query
Paste this query:
```
What were the key highlights from NVIDIA's most recent earnings call?
```

**What to check:**
- [ ] Source chips include a KB document title (e.g. "NVIDIA Q3 FY2025 Earnings Call Summary")
- [ ] The AI reasoning panel shows `search_knowledge_base` was called
- [ ] Content references specific figures from the synthetic KB document

---

## Test 3 - Saved Research & History

**Goal:** Full CRUD on reports - save, tag, search, delete.

| Step | Action | Expected result |
|---|---|---|
| 1 | After generating a report, click **Save Report** | Modal opens; enter title "NVIDIA Overview" and tag "Q3 Earnings" |
| 2 | Go to **History** | Report appears in the list with the tag chip |
| 3 | Use the search bar, type "NVIDIA" | Report filters to matching results |
| 4 | Filter by tag "Q3 Earnings" | Only tagged reports shown |
| 5 | Click the report title | Full report renders from saved JSON (no re-generation) |
| 6 | Click **Delete**, confirm | Report removed from history |

---

## Test 4 - Company Watchlist with Live Prices

**Goal:** Watchlist stores tickers and shows live market data.

| Step | Action | Expected result |
|---|---|---|
| 1 | Go to **Watchlist** | Empty state shown with prompt to add a ticker |
| 2 | Enter ticker `NVDA`, company `NVIDIA Corporation`, click **+ Add** | Row appears immediately |
| 3 | Wait 5–8s (first fetch, cold cache) | Price, Δ1D %, and 30D sparkline populate. Pulse skeleton shows during load. |
| 4 | Add `MSFT` (Microsoft Corp) | New row appears; price loads faster (partial cache hit) |
| 5 | Click **Research** next to any ticker | Opens New Research pre-filled with "Give me an overview of NVDA" |
| 6 | Click the trash icon, confirm **Yes** | Ticker removed from watchlist |

---

## Test 5 - Multi-Tenant Isolation

**Goal:** Org A's data is invisible to Org B, even with a direct URL.

| Step | Action | Expected result |
|---|---|---|
| 1 | Log in as `alice@alpha.test` in Window 1 | Alpha Capital dashboard |
| 2 | Generate and save a report; copy its URL (e.g. `/research/abc-123`) | - |
| 3 | Open an incognito window, log in as `carol@beta.test` | Beta Ventures dashboard - no Alpha Capital reports visible |
| 4 | Paste Alice's report URL into Carol's window | **404 Not Found** - DB returns 0 rows (not an app-layer check) |
| 5 | Carol's dashboard and history show only Beta Ventures data | No Alpha Capital entries leak through |

### Automated DB-tier proof

```bash
npm run test:isolation
```

Expected output:
```
✓ Cross-tenant read denied (0 rows returned - PGRST116)
✓ Admin-only endpoint returns 403 for analyst role
✓ Org A reports not visible to Org B user
All assertions passed.
```

---

## Test 6 - Role-Based Access Control

**Goal:** Admin and analyst roles have distinct capabilities.

| Step | Action | Expected result |
|---|---|---|
| 1 | Log in as `alice@alpha.test` (admin) | **Admin** link visible in sidebar |
| 2 | Open Admin panel | Invite code displayed; member list shows alice + bob |
| 3 | Log out, log in as `bob@alpha.test` (analyst) | **Admin** link absent from sidebar |
| 4 | Manually visit `http://localhost:3000/admin` as bob | Redirected or access denied |
| 5 | Make a direct API call: `GET /api/org/members` as bob | Returns `403 Forbidden` |
| 6 | As alice (admin), copy the invite code | Share it with a new signup to join Alpha Capital as analyst |

---

## Test 7 - PDF & CSV Export

**Goal:** Generated reports can be exported in both formats.

| Step | Action | Expected result |
|---|---|---|
| 1 | Open any saved report | Report view page |
| 2 | Click **Export PDF** | PDF downloads; contains company cards, metrics table, news summary, risks |
| 3 | Click **Export CSV** | CSV downloads; rows contain ticker, metrics, news headlines |

---

## Test 8 - API Health Check

**Goal:** Health endpoint confirms DB and LLM connectivity.

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "ok": true,
  "data": {
    "db": "ok",
    "llm": "ok"
  }
}
```

---

## Test 9 - Error Handling & Edge Cases

| Scenario | How to trigger | Expected behaviour |
|---|---|---|
| Empty query | Submit research with blank input | Form validation error - request never sent |
| Unknown ticker | Query: "What is the stock price of XYZABC123?" | Report generates with "no market data available" gracefully; no crash |
| Duplicate watchlist | Add the same ticker twice | `409 Conflict` toast - no duplicate row |
| Invalid invite code | Onboarding "join" with a made-up code | Clear error message displayed |
| Direct API without session | `curl http://localhost:3000/api/research` | `401 Unauthorized` JSON response |

---

## Test 10 - Org Invite Flow

**Goal:** A new user can join an existing organisation using the invite code.

| Step | Action | Expected result |
|---|---|---|
| 1 | Log in as `alice@alpha.test` (admin), go to Admin, copy invite code | e.g. `e4e17462c63a` |
| 2 | Sign up with a new email at `/signup` | Redirected to `/onboarding` |
| 3 | Choose **Join organisation**, paste the invite code | Redirected to `/dashboard` as analyst in Alpha Capital |
| 4 | Log back in as alice | New member visible in the Admin member list |

---

## Quick Checklist (Rubric Summary)

| Rubric area | Covered by |
|---|---|
| Full-stack engineering (auth, CRUD, API) | Tests 1, 3, 8, 9 |
| AI integration (tool orchestration, structured output, attribution) | Test 2 |
| Multi-tenant isolation | Test 5 |
| RBAC | Test 6 |
| Watchlist & live data | Test 4 |
| Export feature (bonus) | Test 7 |
| Error handling & edge cases | Test 9 |
| Organisation management | Test 10 |
