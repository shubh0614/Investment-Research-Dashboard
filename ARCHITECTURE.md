# ARCHITECTURE — Klypup Investment Research Dashboard

> Five required diagrams + API reference. All diagrams are authored in Mermaid.

---

## Diagram 1 — System Architecture

Shows every component and the trust boundaries between them. The browser is the only untrusted zone; keys never leave the server runtime; external APIs are reached only on a cache miss.

```mermaid
graph TB
    subgraph browser ["Browser — untrusted public client"]
        UI["React UI\nServer & Client Components\nNo API keys · No direct DB access"]
    end

    subgraph nextjs ["Next.js 16 App Router — trusted server runtime (single process)"]
        PROXY["proxy.ts\nPage-level auth gate\nRedirects unauthenticated browsers to /login\nPasses /api/* through unchanged"]
        API["Route Handlers  /api/*\nHTTP · Zod input validation\nrequireAuth() / requireAdmin()"]
        SVCS["Services\nBusiness logic · org-scoped operations"]
        REPOS["Repositories\nData access via RLS-scoped Supabase client"]
        ORCH["AI Orchestrator\nPlan → Execute → Synthesize → Validate"]
        TC["Tool Clients\nMarket data · News · KB Retriever · Web search\nread-through query_cache on every call"]
        GW["LLM Gateway\nVercel AI SDK v6\nProvider-agnostic: Groq / OpenAI / Anthropic\nStructured output · tool-calling · validate-repair"]
    end

    subgraph supabase ["Supabase — managed trusted service"]
        SB_AUTH["Auth\nJWT issuance · session management\nsupabase.auth.signIn / signOut"]
        PG["Postgres + Row Level Security\nAll tenant tables (org_id on every row)\npgvector embeddings in document_chunks\nquery_cache (no RLS — public market data only)"]
    end

    subgraph external ["External — reached server-side only, on cache miss"]
        LLM_P["LLM Provider\nGroq (default, free) · OpenAI · Anthropic\nSwap via LLM_PROVIDER env var — zero code change"]
        MKTAPI["Finnhub + Yahoo Finance\nFundamentals · real-time quote · price candles\n(Yahoo Finance for history — no key needed)"]
        NEWSAPI["NewsAPI\nFinancial news with recency filter"]
        WEBAPI["Tavily\nLive web search context"]
    end

    UI -->|"HTTPS page request"| PROXY
    UI -->|"HTTPS JSON API call"| API
    UI <-->|"session cookie / JWT"| SB_AUTH
    SB_AUTH --> PG
    API --> SVCS
    SVCS --> REPOS
    SVCS --> ORCH
    REPOS -->|"JWT-scoped Supabase client\nRLS applies on every query"| PG
    ORCH --> GW
    ORCH --> TC
    TC -->|"cache hit: served from DB"| PG
    TC -->|"cache miss: fetch then write back"| MKTAPI
    TC -->|"cache miss: fetch then write back"| NEWSAPI
    TC -->|"cache miss: fetch then write back"| WEBAPI
    TC -->|"vector similarity + org_id filter\nRLS enforces tenant isolation"| PG
    GW -->|"model call (server-side only)"| LLM_P
```

---

## Diagram 2 — Research Query Data Flow

Traces a single `POST /api/research` request from browser to structured report, showing every step including the cache, parallel tool execution, and the validate-and-repair loop.

```mermaid
sequenceDiagram
    autonumber
    participant B  as Browser
    participant RH as Route Handler
    participant O  as Orchestrator
    participant PL as Planner (LLM)
    participant EX as Executor
    participant MK as Market Client
    participant NW as News Client
    participant KB as KB Retriever
    participant SY as Synthesizer (LLM)
    participant CA as query_cache (DB)
    participant PG as Postgres (RLS)

    B  ->> RH: POST /api/research { query }
    RH ->> RH: Zod validate body
    RH ->> RH: requireAuth() → { userId, orgId, role }
    RH ->> O:  runOrchestrator({ query, supabase })

    Note over O,PL: Step 1 — Plan
    O  ->> PL: "Which tools does this query need?"<br/>tool definitions: market, news, knowledge_base, web
    PL -->> O: tool calls: [get_market_data(NVDA,90d), search_news(NVIDIA,30), search_knowledge_base(NVIDIA), search_web(NVIDIA)]

    Note over O,KB: Step 2 — Execute (independent tools run in parallel)
    par Market data
        O  ->> EX: run get_market_data
        EX ->> CA: lookup market:NVDA:90d
        CA -->> EX: cache HIT → return payload
        EX -->> O:  MarketResult { data, source: "Finnhub" }
    and News
        O  ->> EX: run search_news
        EX ->> CA: lookup news:NVIDIA:30
        CA -->> EX: cache MISS
        EX ->> NW: fetch NewsAPI
        NW -->> EX: raw articles
        EX ->> CA: write news:NVIDIA:30
        EX -->> O:  NewsResult { items[], sources[] }
    and Knowledge base
        O  ->> EX: run search_knowledge_base
        EX ->> KB: query(NVIDIA, orgId)
        KB ->> PG: SELECT chunks ORDER BY embedding <-> $vec<br/>WHERE org_id = current_org_id()   ← RLS
        PG -->> KB: chunks for this org only
        KB -->> O:  KBResult { chunks[], sources[] }
    and Web search
        O  ->> EX: run search_web
        EX ->> CA: lookup web:NVIDIA
        CA -->> EX: cache MISS
        EX ->> WB: fetch Tavily API
        WB -->> EX: web results
        EX ->> CA: write web:NVIDIA
        EX -->> O:  WebResult { results[], sources[] }
    end

    Note over O,SY: Step 3 — Synthesize
    O  ->> SY: query + aggregated tool results
    SY -->> O:  ResearchReport JSON (Zod schema)

    Note over O: Step 4 — Validate & repair
    alt valid on first pass
        O  -->> RH: { ok: true, report }
    else invalid → repair pass
        O  ->> SY: repair prompt
        SY -->> O:  corrected JSON
        O  -->> RH: { ok: true, report }
    else still invalid
        O  -->> RH: partial report with error banner
    end

    RH -->> B: 200 { ok: true, data: { report } }
    Note over B: UI maps ResearchReport fields<br/>to typed components — no raw text
```

---

## Diagram 3 — Entity-Relationship Diagram

Every tenant-owned table carries `org_id`. `query_cache` is intentionally not tenant-scoped because it stores only public market/news API payloads, never tenant data.

```mermaid
erDiagram
    organizations {
        uuid id PK
        text name
        text invite_code UK
        timestamptz created_at
    }
    profiles {
        uuid id PK "equals auth.uid()"
        uuid org_id FK
        text email
        text full_name
        user_role role "admin | analyst"
        timestamptz created_at
    }
    research_reports {
        uuid id PK
        uuid org_id FK
        uuid author_id FK
        text title
        text query_text
        jsonb result_json "ResearchReport (Zod-validated)"
        timestamptz created_at
        timestamptz updated_at
    }
    report_tags {
        uuid id PK
        uuid org_id FK
        uuid report_id FK
        text tag
    }
    watchlist_items {
        uuid id PK
        uuid org_id FK
        uuid user_id FK
        text ticker
        text company_name
        timestamptz created_at
    }
    documents {
        uuid id PK
        uuid org_id FK
        text company
        text doc_type "earnings_call | risk_factors | filing"
        text title
        text source_label
        timestamptz created_at
    }
    document_chunks {
        uuid id PK
        uuid org_id FK
        uuid document_id FK
        int chunk_index
        text content
        vector embedding "1536 dims — OpenAI text-embedding-3-small"
        int token_count
    }
    query_cache {
        uuid id PK
        text cache_key UK "tool:params hash — no org_id"
        jsonb payload_json
        timestamptz fetched_at
        timestamptz expires_at
    }
    audit_events {
        uuid id PK
        uuid org_id FK
        uuid actor_id FK
        text action "login | report.create | member.remove …"
        text entity_type
        uuid entity_id
        jsonb metadata_json
        timestamptz created_at
    }

    organizations ||--o{ profiles       : "has members"
    organizations ||--o{ research_reports: "owns"
    organizations ||--o{ watchlist_items : "owns"
    organizations ||--o{ documents       : "owns"
    organizations ||--o{ document_chunks : "owns"
    organizations ||--o{ audit_events    : "logs"
    profiles      ||--o{ research_reports: "authors"
    profiles      ||--o{ watchlist_items : "tracks"
    profiles      ||--o{ audit_events    : "actor"
    research_reports ||--o{ report_tags  : "tagged with"
    documents     ||--o{ document_chunks : "chunked into"
```

---

## Diagram 4 — AI Orchestration Flow

The model decides which tools to call; it is never a hardcoded pipeline. Tool failures degrade one section, not the whole report.

```mermaid
flowchart TD
    Q["User Query\ne.g. 'NVIDIA: stock performance, news, risks'"]
    Q --> PL

    subgraph S1 ["Step 1 — Plan  (model decides)"]
        PL["Planner  LLM call\nInput:  query + 4 tool definitions\nOutput: which tools + args\nPrompt explicitly forbids hardcoded sequences"]
    end

    PL --> GATE{Any tools\nselected?}
    GATE -->|no| NOOP["Degrade: NO_TOOLS_SELECTED\nReturn error to UI"]
    GATE -->|yes| EX

    subgraph S2 ["Step 2 — Execute  (parallel where independent)"]
        EX["Executor\nFan out selected tools concurrently\nPromise.all — each fails safely"]
        EX --> T1["get_market_data\nquery_cache → Finnhub (quote, profile, metrics)\n+ Yahoo Finance (price candles)\nReturns: prices, metrics, price_series"]
        EX --> T2["search_news\nquery_cache → NewsAPI\nReturns: articles + LLM sentiment classification"]
        EX --> T3["search_knowledge_base\npgvector similarity search\nRLS: only this org's chunks returned"]
        EX --> T4["search_web\nquery_cache → Tavily\nReturns: live web results + sources"]
        T1 --> FAIL1["Failure → typed 'unavailable' result\nNever throws — report degrades, not crashes"]
        T2 --> FAIL2["Failure → typed 'unavailable' result"]
        T3 --> FAIL3["Failure → typed 'unavailable' result"]
        T4 --> FAIL4["Failure → typed 'unavailable' result"]
    end

    FAIL1 & FAIL2 & FAIL3 & FAIL4 --> AGG["Aggregate ToolResults\nAll results typed — unavailable sections\nget an explicit degraded state in the UI"]

    subgraph S3 ["Step 3 — Synthesize"]
        AGG --> SY["Synthesizer  LLM call\nInput:  query + all tool results\nOutput: ResearchReport JSON\nPrompt: attribute every claim, never invent a source"]
    end

    subgraph S4 ["Step 4 — Validate + Repair"]
        SY --> V1{"Zod schema\nvalid?"}
        V1 -->|yes| DONE["ResearchReport ✓\nEvery factual field has sources array\nRendered as typed UI components"]
        V1 -->|no| R["One repair pass\nModel given the validation error + original output"]
        R --> V2{"Valid?"}
        V2 -->|yes| DONE
        V2 -->|no| PART["Partial report + error banner\nUser told synthesis degraded\nApplication never crashes"]
    end
```

---

## Diagram 5 — Multi-Tenant Isolation Proof

Isolation is enforced at the database tier, not only in application code. A forgotten `WHERE org_id` in application code cannot cause a cross-tenant leak because Postgres denies the rows before they leave the database.

```mermaid
flowchart LR
    subgraph OA ["Org A — Alpha Capital"]
        ALICE["Alice\njwt: { sub: uuid-a, ... }\nprofile.org_id = uuid-alpha"]
    end
    subgraph OB ["Org B — Beta Ventures"]
        BOB["Bob\njwt: { sub: uuid-b, ... }\nprofile.org_id = uuid-beta"]
    end

    subgraph APP ["Next.js API — application tier"]
        AUTH["requireAuth()\nResolves org_id from profiles\nInjects into service calls"]
        SCOPE["Service layer also\nscopes every query by org_id\n(defense in depth — second line only)"]
    end

    subgraph DB ["Postgres — database tier  (primary line of defence)"]
        HELPER["current_org_id()\nSECURITY DEFINER function\nReads profiles WHERE id = auth.uid()\nReturns this caller's org_id"]
        RLS["RLS predicate on every tenant table\nFOR SELECT USING org_id = current_org_id\nFOR INSERT WITH CHECK org_id = current_org_id\nFOR DELETE USING org_id = current_org_id AND role='admin'"]
        ROWS_A[("Alpha rows\norg_id = uuid-alpha")]
        ROWS_B[("Beta rows\norg_id = uuid-beta")]
    end

    ALICE -->|"Alice's JWT in every request"| AUTH
    BOB   -->|"Bob's JWT in every request"| AUTH
    AUTH  --> SCOPE
    SCOPE -->|"Supabase client carrying Alice's JWT"| HELPER
    HELPER --> RLS
    RLS -->|"uuid-alpha matches → rows returned"| ROWS_A
    RLS -->|"uuid-beta != uuid-alpha → 0 rows, PGRST116\neven with a guessed Alpha report ID"| ROWS_B

    note1["Proof: test-isolation.mjs logs in as Bob,\nattempts to fetch an Alice report by ID.\nDatabase returns 0 rows — not an app-level check."]
```

---

## API Reference

All endpoints return `{ ok: true, data }` on success or `{ ok: false, error: { code, message } }` on failure. Auth is via session cookie (browser) or `Authorization: Bearer <jwt>` (programmatic).

| Method | Path | Auth | Role | Status codes | Purpose |
|--------|------|------|------|-------------|---------|
| `POST` | `/api/onboarding` | session | any | 200, 400, 409 | Create new org (caller → admin) or join via invite code (caller → analyst). One-time call after first sign-up. |
| `GET` | `/api/me` | session | any | 200, 401, 403 | Current user, profile, org, and role. |
| `POST` | `/api/research` | session | any | 200, 400, 401, 422, 503 | Run the agentic research query. Returns a full `ResearchReport`. |
| `POST` | `/api/research/save` | session | any | 201, 400, 401, 422 | Persist a generated report. |
| `GET` | `/api/research` | session | any | 200, 401 | List org's saved reports. Supports `?tag=` and `?q=` filters. |
| `GET` | `/api/research/:id` | session | any | 200, 401, 404 | Read one report. Re-checked against tenant — guessed IDs return 404. |
| `PATCH` | `/api/research/:id` | session | any | 200, 400, 401, 404, 422 | Update title or tags. |
| `DELETE` | `/api/research/:id` | session | any | 200, 401, 404 | Delete a report. |
| `GET` | `/api/health` | public | — | 200, 503 | DB and LLM gateway reachability. Returns `{ ok, db, llm }`. |
| `POST` | `/api/org/invite` | session | admin | 200, 401, 403 | Return (or generate) the org's invite code. |
| `GET` | `/api/org/members` | session | admin | 200, 401, 403 | List all members of the org. |
| `DELETE` | `/api/org/members/:id` | session | admin | 200, 400, 401, 403, 404 | Remove a member. Cannot remove self. RLS also blocks self-removal at DB tier. |
| `GET` | `/api/market-prices` | session | any | 200, 400, 401 | Live prices, 1D change %, and 30D sparkline series for comma-separated `?tickers=`. Results cached 24h. |
| `GET` | `/api/watchlist` | session | any | 200, 401 | List the caller's watchlist items. |
| `POST` | `/api/watchlist` | session | any | 201, 400, 401, 409, 422 | Add a ticker to the watchlist. 409 on duplicate. |
| `DELETE` | `/api/watchlist/:id` | session | any | 200, 401, 404 | Remove a watchlist item. |

### Standard response envelope

```jsonc
// Success
{ "ok": true, "data": { /* endpoint-specific payload */ } }

// Failure
{
  "ok": false,
  "error": {
    "code": "REPORT_NOT_FOUND",   // machine-readable constant
    "message": "Report not found" // human-readable
  }
}
```

### Error code taxonomy

| HTTP | Codes | When |
|------|-------|------|
| 400 | `VALIDATION_ERROR`, `CANNOT_REMOVE_SELF` | Malformed request or business-rule violation |
| 401 | `UNAUTHORIZED` | No valid session |
| 403 | `FORBIDDEN` | Authenticated but wrong role |
| 404 | `NOT_FOUND` | Resource missing or cross-tenant id (indistinguishable by design) |
| 409 | `DUPLICATE` | Unique constraint violation (e.g. duplicate watchlist ticker) |
| 422 | `VALIDATION_ERROR` | Body fails Zod schema — includes `details` array with field-level errors |
| 503 | `LLM_NOT_CONFIGURED`, `SYNTHESIS_FAILED` | Upstream unavailable or LLM key missing |
