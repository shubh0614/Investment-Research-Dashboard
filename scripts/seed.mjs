/**
 * Phase 2 + 3 idempotent seed script.
 *
 * Creates two orgs with distinct, recognizable data so cross-tenant isolation
 * is visually obvious in the UI demo. Safe to run multiple times - cleans up
 * before re-seeding.
 *
 * Orgs:
 *   Alpha Capital  - alice@alpha.test (admin), bob@alpha.test (analyst)
 *   Beta Ventures  - carol@beta.test  (admin), dave@beta.test  (analyst)
 *
 * Run: npm run seed
 * Requires: `supabase start` running locally.
 */

import { createClient } from "@supabase/supabase-js";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// JWT-format keys from `npx supabase status` (not the sb_* keys from `supabase start`).
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function ok(label, error) {
  if (error) {
    console.error(`  ✗ ${label}: ${error.message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${label}`);
}

async function upsertAuthUser(email, password) {
  const { data: list } = await service.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) {
    await service.auth.admin.updateUserById(existing.id, { password });
    return existing.id;
  }
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) { console.error(`  ✗ createUser ${email}: ${error.message}`); process.exit(1); }
  return data.user.id;
}

function readKb(filename) {
  return readFileSync(path.join(__dir, "../data/kb", filename), "utf8");
}

// ── Phase 0: Cleanup ──────────────────────────────────────────────────────────

console.log("\n=== Seed: Klypup Investment Research Dashboard ===\n");
console.log("0. Cleaning up previous seed data...");

const SEED_EMAILS = [
  "alice@alpha.test",
  "bob@alpha.test",
  "carol@beta.test",
  "dave@beta.test",
];
const SEED_ORGS = ["Alpha Capital", "Beta Ventures"];

const { data: allUsers } = await service.auth.admin.listUsers();
for (const u of allUsers?.users ?? []) {
  if (SEED_EMAILS.includes(u.email ?? "")) {
    await service.from("profiles").delete().eq("id", u.id);
    await service.auth.admin.deleteUser(u.id);
  }
}
await service.from("organizations").delete().in("name", SEED_ORGS);

// Pre-warm cache cleanup: delete existing demo cache entries so they're refreshed.
await service
  .from("query_cache")
  .delete()
  .in("cache_key", [
    "market:NVDA:90d", "market:AMD:90d", "market:INTC:90d",
    "market:MSFT:90d", "market:GOOGL:90d",
    "news:NVIDIA:30", "news:AMD:30", "news:Intel:30",
  ]);

console.log("  done.\n");

// ── Phase 1: Organizations ────────────────────────────────────────────────────

console.log("1. Creating organisations...");

const { data: orgAlpha, error: e1 } = await service
  .from("organizations")
  .insert({ name: "Alpha Capital" })
  .select("id, invite_code")
  .single();
ok("Alpha Capital", e1);

const { data: orgBeta, error: e2 } = await service
  .from("organizations")
  .insert({ name: "Beta Ventures" })
  .select("id, invite_code")
  .single();
ok("Beta Ventures", e2);

// ── Phase 2: Auth users + profiles ───────────────────────────────────────────

console.log("\n2. Creating auth users + profiles...");

const aliceId = await upsertAuthUser("alice@alpha.test", "password123");
const bobId   = await upsertAuthUser("bob@alpha.test",   "password123");
const carolId = await upsertAuthUser("carol@beta.test",  "password123");
const daveId  = await upsertAuthUser("dave@beta.test",   "password123");

const { error: ep1 } = await service.from("profiles").insert([
  { id: aliceId, org_id: orgAlpha.id, email: "alice@alpha.test", full_name: "Alice Chen",   role: "admin"    },
  { id: bobId,   org_id: orgAlpha.id, email: "bob@alpha.test",   full_name: "Bob Sharma",   role: "analyst"  },
  { id: carolId, org_id: orgBeta.id,  email: "carol@beta.test",  full_name: "Carol Tanaka", role: "admin"    },
  { id: daveId,  org_id: orgBeta.id,  email: "dave@beta.test",   full_name: "Dave Okonkwo", role: "analyst"  },
]);
ok("Profiles (4)", ep1);

// ── Phase 3: Research reports ─────────────────────────────────────────────────

console.log("\n3. Seeding research reports...");

const alphaReportResult = {
  summary: "NVIDIA dominates AI accelerator spending driven by the Blackwell GPU ramp. Data center revenue grew 112% YoY to $30.8B in Q3 FY2025. The CUDA ecosystem creates durable switching costs. Near-term risks include Blackwell supply constraints and export control headwinds in China.",
  companies: [
    {
      ticker: "NVDA",
      name: "NVIDIA Corporation",
      overview: "Dominant AI infrastructure provider. Blackwell architecture ramping in Q4 FY2025. Data center revenue grew 112% YoY driven by hyperscaler and sovereign AI demand.",
      metrics: { current_price: 134.56, price_change_1d: 1.24, market_cap: 3290000000000, pe_ratio: 52.3, forward_pe: 35.1, revenue_ttm: 96800000000 },
      sources: ["Finnhub", "NVIDIA Q3 FY2025 Earnings Call Summary", "Semiconductor Landscape Overview"],
    },
  ],
  news: [
    { headline: "NVIDIA Blackwell B200 GPUs Begin Mass Shipment to Hyperscalers", summary: "NVIDIA has commenced mass shipments of its Blackwell B200 GPUs to major cloud providers including Microsoft Azure and Google Cloud.", sentiment: "positive", confidence: 0.92, published_at: "2024-11-15", source: "Reuters", url: null },
    { headline: "NVIDIA Q3 Revenue Beats Estimates, Guides Higher on AI Demand", summary: "NVIDIA reported Q3 FY2025 revenue of $35.1B, up 94% YoY, and guided Q4 above consensus on continued strong data center demand.", sentiment: "positive", confidence: 0.95, published_at: "2024-11-20", source: "Bloomberg", url: null },
    { headline: "China Export Controls Trim $2B from NVIDIA FY2025 Revenue", summary: "Updated US export restrictions on AI chips to China are expected to reduce NVIDIA's FY2025 revenue by approximately $2B.", sentiment: "negative", confidence: 0.88, published_at: "2024-10-08", source: "WSJ", url: null },
  ],
  risks: [
    { risk: "Supply chain concentration at TSMC CoWoS", rationale: "NVIDIA's advanced Blackwell packaging relies entirely on TSMC's CoWoS process, which has limited capacity and long lead times.", severity: "high", sources: ["NVIDIA Q3 FY2025 Earnings Call Summary"], source_urls: [] },
    { risk: "China export control expansion", rationale: "Further tightening of US export controls on AI accelerators could eliminate remaining China revenue, which represents a meaningful TAM.", severity: "high", sources: ["WSJ"], source_urls: [] },
    { risk: "AMD MI300X inference competition", rationale: "AMD's MI300X is gaining traction for inference workloads where memory bandwidth matters more than training throughput.", severity: "medium", sources: ["Semiconductor Landscape Overview"], source_urls: [] },
    { risk: "Customer concentration risk", rationale: "Top 5 hyperscalers represent approximately 45% of revenue, creating dependency on a small number of large buyers.", severity: "medium", sources: ["NVIDIA Q3 FY2025 Earnings Call Summary"], source_urls: [] },
  ],
  tools_used: ["get_market_data", "search_news", "search_knowledge_base"],
  meta: { query_text: "Analyze NVIDIA's competitive position and financial outlook for the next 12 months", generated_at: "2024-11-21T10:00:00.000Z", latency_ms: 18400, token_usage: { prompt: 4200, completion: 950, total: 5150 } },
};

const alphaReport2Result = {
  summary: "AMD's MI300X is gaining traction for inference workloads where high HBM capacity is critical. However, the ROCm software gap vs. CUDA remains the primary adoption barrier. Intel's Gaudi 3 is price-competitive but lacks developer ecosystem. NVIDIA retains dominant position in training.",
  companies: [
    {
      ticker: "AMD",
      name: "Advanced Micro Devices",
      overview: "Credible NVIDIA challenger. MI300X competitive on memory bandwidth for inference; ROCm 6.2 closing the software gap vs CUDA.",
      metrics: { current_price: 519.85, price_change_1d: -5.76, market_cap: 847800000000, pe_ratio: 168.84, forward_pe: 53.22, revenue_ttm: 37080000000 },
      sources: ["Finnhub", "AMD Risk Factors 2024", "Semiconductor Landscape Overview"],
    },
    {
      ticker: "INTC",
      name: "Intel Corporation",
      overview: "Turnaround underway. Gaudi 3 price-competitive but limited traction. 18A node is the make-or-break catalyst for IFS viability.",
      metrics: { current_price: 21.43, price_change_1d: -1.2, market_cap: 90800000000, pe_ratio: null, forward_pe: null, revenue_ttm: 53500000000 },
      sources: ["Finnhub", "Intel Strategy Report 2024", "Semiconductor Landscape Overview"],
    },
  ],
  news: [
    { headline: "Microsoft Azure Deploys AMD MI300X for OpenAI Inference Workloads", summary: "Microsoft has expanded its AMD MI300X deployment on Azure to support OpenAI inference workloads, citing high memory bandwidth advantages.", sentiment: "positive", confidence: 0.89, published_at: "2024-11-05", source: "Microsoft Blog", url: null },
    { headline: "AMD ROCm 6.2 Closes PyTorch Performance Gap With CUDA", summary: "AMD's ROCm 6.2 release demonstrates near-parity with CUDA on key PyTorch benchmarks, reducing the software moat advantage.", sentiment: "positive", confidence: 0.82, published_at: "2024-10-22", source: "Tom's Hardware", url: null },
    { headline: "Intel Gaudi 3 Revenue 'Immaterial' in FY2024, Targets $500M in 2025", summary: "Intel disclosed Gaudi 3 revenue was immaterial in FY2024 but set a $500M target for 2025, implying a significant ramp is required.", sentiment: "neutral", confidence: 0.85, published_at: "2024-11-01", source: "Intel IR", url: null },
  ],
  risks: [
    { risk: "ROCm ecosystem immaturity vs. CUDA", rationale: "Despite recent improvements, ROCm lacks CUDA's breadth of library support and developer familiarity, limiting AMD's addressable market.", severity: "high", sources: ["AMD Risk Factors 2024"], source_urls: [] },
    { risk: "Intel 18A yield risk", rationale: "Intel's foundry turnaround depends on 18A achieving competitive yields; prior node delays (10nm, 7nm) establish a pattern of execution risk.", severity: "high", sources: ["Intel Strategy Report 2024"], source_urls: [] },
    { risk: "Custom silicon reducing merchant GPU TAM", rationale: "Hyperscalers including Google (TPU), Amazon (Trainium), and Microsoft (Maia) are building custom AI chips that reduce reliance on merchant GPUs.", severity: "medium", sources: ["Semiconductor Landscape Overview"], source_urls: [] },
    { risk: "AMD customer concentration in Azure", rationale: "A significant portion of MI300X revenue is concentrated in Microsoft Azure, creating dependency on a single customer's AI roadmap.", severity: "medium", sources: ["AMD Risk Factors 2024"], source_urls: [] },
  ],
  tools_used: ["get_market_data", "search_news", "search_knowledge_base"],
  meta: { query_text: "Compare AMD and Intel as challengers to NVIDIA in AI accelerators", generated_at: "2024-11-21T14:00:00.000Z", latency_ms: 22100, token_usage: { prompt: 5800, completion: 1200, total: 7000 } },
};

const { data: insertedAlphaReports, error: er1 } = await service
  .from("research_reports")
  .insert([
    {
      org_id: orgAlpha.id,
      author_id: aliceId,
      title: "NVIDIA Deep Dive: Blackwell Ramp & AI Supercycle",
      query_text: "Analyze NVIDIA's competitive position and financial outlook for the next 12 months",
      result_json: alphaReportResult,
    },
    {
      org_id: orgAlpha.id,
      author_id: bobId,
      title: "AMD vs Intel: AI Accelerator Challenger Analysis",
      query_text: "Compare AMD and Intel as challengers to NVIDIA in AI accelerators",
      result_json: alphaReport2Result,
    },
  ])
  .select("id");
ok("Alpha Capital reports (2)", er1);

const betaReportResult = {
  summary: "Intel's 18A node is the pivotal catalyst for the stock. If 18A achieves claimed PPA metrics and IFS lands a second hyperscaler anchor customer, the sum-of-parts valuation supports significant upside. The bear case - further process delays - risks a liquidity crunch given -$14B FCF.",
  companies: [
    {
      ticker: "INTC",
      name: "Intel Corporation",
      overview: "Deep value or value trap depending on 18A execution. IFS optionality not in the price. Sum-of-parts implies significant upside if the foundry thesis is validated.",
      metrics: { current_price: 21.43, price_change_1d: -1.2, market_cap: 90800000000, pe_ratio: null, forward_pe: null, revenue_ttm: 53500000000 },
      sources: ["Finnhub", "Intel Strategy Report 2024", "Semiconductor Landscape Overview"],
    },
  ],
  news: [
    { headline: "Intel 18A Tape-In Completed; Management Claims PPA Competitive With TSMC N2", summary: "Intel has completed tape-in for its 18A process node and claims power-performance-area metrics competitive with TSMC's N2, a critical milestone for IFS credibility.", sentiment: "positive", confidence: 0.87, published_at: "2024-09-10", source: "AnandTech", url: null },
    { headline: "Intel Reports Q3 Loss, Announces 15,000 Headcount Reduction", summary: "Intel posted a Q3 net loss and announced a restructuring plan cutting 15,000 jobs, citing the need to reduce costs and refocus on core competencies.", sentiment: "negative", confidence: 0.93, published_at: "2024-10-31", source: "CNBC", url: null },
    { headline: "Microsoft Commits to Intel 18A Foundry Capacity for Azure Custom Silicon", summary: "Microsoft has signed a multi-year agreement to use Intel's 18A process for manufacturing custom silicon chips destined for Azure infrastructure.", sentiment: "positive", confidence: 0.91, published_at: "2024-08-22", source: "Bloomberg", url: null },
  ],
  risks: [
    { risk: "18A execution risk from prior node delays", rationale: "Intel's track record includes multi-year slippages on 10nm and 7nm. A repeat on 18A would eliminate the IFS thesis and trigger another re-rating.", severity: "high", sources: ["Intel Strategy Report 2024"], source_urls: [] },
    { risk: "IFS single anchor customer concentration", rationale: "Microsoft is the only publicly announced 18A hyperscaler customer. Failure to add a second anchor before 2025 would undermine the foundry revenue ramp.", severity: "high", sources: ["Bloomberg"], source_urls: [] },
    { risk: "Negative FCF limits execution runway", rationale: "Intel is generating approximately -$14B FCF. Any further delays extend cash burn and may require additional capital raises or asset sales.", severity: "high", sources: ["Intel Strategy Report 2024"], source_urls: [] },
    { risk: "Talent drain during restructuring", rationale: "The 15,000-headcount reduction risks losing the process engineers executing 18A, creating execution risk at exactly the wrong moment.", severity: "medium", sources: ["CNBC"], source_urls: [] },
  ],
  tools_used: ["get_market_data", "search_news", "search_knowledge_base"],
  meta: { query_text: "Evaluate Intel's strategic transformation and 18A process node as an investment thesis", generated_at: "2024-11-22T09:00:00.000Z", latency_ms: 16800, token_usage: { prompt: 3900, completion: 820, total: 4720 } },
};

const { data: insertedBetaReports, error: er2 } = await service
  .from("research_reports")
  .insert([
    {
      org_id: orgBeta.id,
      author_id: carolId,
      title: "Intel 18A: Binary Bet or Value Trap?",
      query_text: "Evaluate Intel's strategic transformation and 18A process node as an investment thesis",
      result_json: betaReportResult,
    },
  ])
  .select("id");
ok("Beta Ventures reports (1)", er2);

// ── Phase 4: Report tags ──────────────────────────────────────────────────────

console.log("\n4. Seeding report tags...");

const [alphaR1, alphaR2] = insertedAlphaReports;
const [betaR1] = insertedBetaReports;

const { error: et } = await service.from("report_tags").insert([
  { org_id: orgAlpha.id, report_id: alphaR1.id, tag: "nvidia"        },
  { org_id: orgAlpha.id, report_id: alphaR1.id, tag: "semiconductors"},
  { org_id: orgAlpha.id, report_id: alphaR1.id, tag: "ai-infra"      },
  { org_id: orgAlpha.id, report_id: alphaR2.id, tag: "amd"           },
  { org_id: orgAlpha.id, report_id: alphaR2.id, tag: "intel"         },
  { org_id: orgAlpha.id, report_id: alphaR2.id, tag: "semiconductors"},
  { org_id: orgBeta.id,  report_id: betaR1.id,  tag: "intel"         },
  { org_id: orgBeta.id,  report_id: betaR1.id,  tag: "foundry"       },
  { org_id: orgBeta.id,  report_id: betaR1.id,  tag: "deep-value"    },
]);
ok("Tags (9)", et);

// ── Phase 5: Watchlist items ──────────────────────────────────────────────────

console.log("\n5. Seeding watchlist items...");

const { error: ew } = await service.from("watchlist_items").insert([
  { org_id: orgAlpha.id, user_id: aliceId, ticker: "NVDA",  company_name: "NVIDIA Corporation"    },
  { org_id: orgAlpha.id, user_id: aliceId, ticker: "AMD",   company_name: "Advanced Micro Devices" },
  { org_id: orgAlpha.id, user_id: aliceId, ticker: "INTC",  company_name: "Intel Corporation"      },
  { org_id: orgAlpha.id, user_id: bobId,   ticker: "NVDA",  company_name: "NVIDIA Corporation"    },
  { org_id: orgAlpha.id, user_id: bobId,   ticker: "AVGO",  company_name: "Broadcom Inc."          },
  { org_id: orgBeta.id,  user_id: carolId, ticker: "INTC",  company_name: "Intel Corporation"      },
  { org_id: orgBeta.id,  user_id: carolId, ticker: "MSFT",  company_name: "Microsoft Corporation"  },
  { org_id: orgBeta.id,  user_id: daveId,  ticker: "MSFT",  company_name: "Microsoft Corporation"  },
  { org_id: orgBeta.id,  user_id: daveId,  ticker: "GOOGL", company_name: "Alphabet Inc."          },
]);
ok("Watchlist items (9)", ew);

// ── Phase 6: Documents (knowledge base) ──────────────────────────────────────

console.log("\n6. Seeding knowledge-base documents...");

const kbDocs = [
  { company: "NVIDIA", doc_type: "earnings_summary", title: "NVIDIA Q3 FY2025 Earnings Call Summary",       source_label: "NVIDIA IR",        file: "nvidia-q3-2024-earnings.md"   },
  { company: "AMD",    doc_type: "risk_factors",     title: "AMD Risk Factors & Competitive Analysis 2024", source_label: "AMD 10-K / IR",     file: "amd-risk-factors.md"          },
  { company: "INTC",   doc_type: "strategy",         title: "Intel Strategic Transformation Update 2024",   source_label: "Intel Investor Day", file: "intel-strategy.md"            },
  { company: "MULTI",  doc_type: "landscape",        title: "Semiconductor AI Competitive Landscape",       source_label: "Research Synthesis", file: "semiconductor-landscape.md"   },
];

// Insert documents for both orgs, capturing IDs for the embedding step.
const orgDocIds = {};
for (const org of [orgAlpha, orgBeta]) {
  const rows = kbDocs.map(({ company, doc_type, title, source_label }) => ({
    org_id: org.id,
    company,
    doc_type,
    title,
    source_label,
  }));
  const { data: insertedDocs, error: ed } = await service
    .from("documents")
    .insert(rows)
    .select("id, title");
  ok(`Documents for ${org === orgAlpha ? "Alpha Capital" : "Beta Ventures"} (4)`, ed);
  // Build map: title → id for this org's documents
  orgDocIds[org.id] = Object.fromEntries((insertedDocs ?? []).map((d) => [d.title, d.id]));
}

// ── Phase 6b: Chunk + embed KB documents (Phase 3.4) ─────────────────────────

console.log("\n6b. Chunking and embedding knowledge-base documents...");

function chunkText(text, maxChars = 2000, overlapChars = 200) {
  const paras = text.split(/\n\n+/).filter(Boolean);
  const chunks = [];
  let current = "";
  let overlap = "";

  for (const para of paras) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(overlap + current);
      overlap = current.slice(-overlapChars);
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current) chunks.push(overlap + current);
  return chunks;
}

const apiKey = process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY ?? "";
const embeddingEnabled = apiKey.length > 0;

if (!embeddingEnabled) {
  console.log("  ⚠ OPENAI_API_KEY not set - storing chunks without embeddings (keyword fallback mode).");
}

// Clear any existing chunks so re-runs are idempotent.
await service.from("document_chunks").delete().not("id", "is", null);
console.log("  cleared existing chunks.");

for (const org of [orgAlpha, orgBeta]) {
  const docIdMap = orgDocIds[org.id];
  const orgLabel = org === orgAlpha ? "Alpha Capital" : "Beta Ventures";

  for (const { title, file } of kbDocs) {
    const docId = docIdMap[title];
    if (!docId) { console.error(`  ✗ No doc ID for "${title}" in ${orgLabel}`); continue; }

    const content = readKb(file);
    const chunks  = chunkText(content);

    let embeddings = chunks.map(() => null);
    if (embeddingEnabled) {
      try {
        const model = openai.embedding("text-embedding-3-small");
        const result = await embedMany({ model, values: chunks });
        embeddings = result.embeddings;
      } catch (e) {
        console.warn(`  ⚠ Embedding failed for "${title}": ${e.message} - storing null vectors.`);
      }
    }

    const rows = chunks.map((content, i) => ({
      org_id:      org.id,
      document_id: docId,
      chunk_index: i,
      content,
      embedding:   embeddings[i] ? JSON.stringify(embeddings[i]) : null,
      token_count: Math.ceil(content.length / 4), // rough estimate: 1 token ≈ 4 chars
    }));

    const { error: ech } = await service.from("document_chunks").insert(rows);
    ok(`${orgLabel} / "${title}" (${chunks.length} chunks${embeddingEnabled ? ", embedded" : ", no embeddings"})`, ech);
  }
}

// ── Phase 7: Pre-warm query_cache ─────────────────────────────────────────────

console.log("\n7. Pre-warming query cache with demo market data (Phase 2.2 + D8)...");

// Synthetic price series - deterministic data shaped like the real API response.
// Phase 3 tool clients will refresh these from real APIs (or serve from cache).
function pricePoint(date, open, close, high, low, volume) {
  return { date, open, close, high, low, volume };
}

const now = new Date();
const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

const marketCache = [
  {
    cache_key: "market:NVDA:90d",
    payload_json: {
      ticker: "NVDA", name: "NVIDIA Corporation",
      current_price: 138.85, change_pct: 2.31, market_cap: 3390000000000,
      pe_ratio: 53.2, forward_pe: 34.8, revenue_ttm: 113400000000,
      series: [
        pricePoint("2024-09-03", 102.83, 108.13, 109.02, 101.50, 312000000),
        pricePoint("2024-09-10", 108.13, 116.00, 117.93, 107.40, 288000000),
        pricePoint("2024-09-17", 116.00, 121.44, 122.80, 115.22, 267000000),
        pricePoint("2024-09-24", 121.44, 121.09, 123.01, 119.55, 198000000),
        pricePoint("2024-10-01", 121.09, 130.32, 131.38, 120.88, 254000000),
        pricePoint("2024-10-08", 130.32, 132.65, 135.72, 129.14, 231000000),
        pricePoint("2024-10-15", 132.65, 138.85, 139.22, 131.80, 247000000),
        pricePoint("2024-10-22", 138.85, 143.71, 144.45, 137.60, 219000000),
        pricePoint("2024-10-29", 143.71, 139.56, 144.01, 138.22, 208000000),
        pricePoint("2024-11-05", 139.56, 148.88, 149.77, 138.90, 294000000),
        pricePoint("2024-11-12", 148.88, 141.95, 149.50, 140.81, 256000000),
        pricePoint("2024-11-19", 141.95, 138.85, 142.60, 137.22, 241000000),
      ],
    },
    expires_at: in30d,
  },
  {
    cache_key: "market:AMD:90d",
    payload_json: {
      ticker: "AMD", name: "Advanced Micro Devices",
      current_price: 141.52, change_pct: -0.87, market_cap: 229000000000,
      pe_ratio: 115.4, forward_pe: 39.6, revenue_ttm: 24000000000,
      series: [
        pricePoint("2024-09-03", 142.35, 148.91, 150.22, 141.80, 58000000),
        pricePoint("2024-09-10", 148.91, 152.76, 155.44, 147.90, 62000000),
        pricePoint("2024-09-17", 152.76, 167.34, 168.22, 151.60, 74000000),
        pricePoint("2024-09-24", 167.34, 170.84, 172.50, 165.11, 69000000),
        pricePoint("2024-10-01", 170.84, 175.45, 177.03, 169.22, 61000000),
        pricePoint("2024-10-08", 175.45, 168.22, 176.01, 166.80, 67000000),
        pricePoint("2024-10-15", 168.22, 164.58, 169.00, 162.90, 59000000),
        pricePoint("2024-10-22", 164.58, 158.34, 165.22, 157.01, 71000000),
        pricePoint("2024-10-29", 158.34, 152.91, 159.77, 151.22, 78000000),
        pricePoint("2024-11-05", 152.91, 145.03, 153.55, 143.80, 82000000),
        pricePoint("2024-11-12", 145.03, 143.77, 146.44, 141.22, 64000000),
        pricePoint("2024-11-19", 143.77, 141.52, 144.22, 140.01, 58000000),
      ],
    },
    expires_at: in30d,
  },
  {
    cache_key: "market:INTC:90d",
    payload_json: {
      ticker: "INTC", name: "Intel Corporation",
      current_price: 24.77, change_pct: -1.24, market_cap: 105000000000,
      pe_ratio: null, forward_pe: null, revenue_ttm: 53500000000,
      series: [
        pricePoint("2024-09-03", 21.48, 21.92, 22.44, 21.05, 112000000),
        pricePoint("2024-09-10", 21.92, 22.80, 23.11, 21.77, 98000000),
        pricePoint("2024-09-17", 22.80, 23.55, 23.89, 22.41, 104000000),
        pricePoint("2024-09-24", 23.55, 24.22, 24.77, 23.01, 95000000),
        pricePoint("2024-10-01", 24.22, 23.67, 24.55, 23.22, 107000000),
        pricePoint("2024-10-08", 23.67, 22.44, 23.80, 22.01, 118000000),
        pricePoint("2024-10-15", 22.44, 23.11, 23.55, 22.01, 101000000),
        pricePoint("2024-10-22", 23.11, 21.88, 23.22, 21.44, 134000000),
        pricePoint("2024-10-29", 21.88, 24.88, 25.22, 21.55, 189000000),
        pricePoint("2024-11-05", 24.88, 25.44, 25.77, 24.22, 142000000),
        pricePoint("2024-11-12", 25.44, 25.01, 25.66, 24.55, 123000000),
        pricePoint("2024-11-19", 25.01, 24.77, 25.33, 24.44, 115000000),
      ],
    },
    expires_at: in30d,
  },
  {
    cache_key: "market:MSFT:90d",
    payload_json: {
      ticker: "MSFT", name: "Microsoft Corporation",
      current_price: 415.50, change_pct: 0.43, market_cap: 3090000000000,
      pe_ratio: 35.8, forward_pe: 31.2, revenue_ttm: 245100000000,
      series: [
        pricePoint("2024-09-03", 404.51, 407.22, 408.78, 403.11, 18000000),
        pricePoint("2024-09-10", 407.22, 411.65, 413.22, 406.01, 16500000),
        pricePoint("2024-09-17", 411.65, 420.55, 422.11, 410.33, 19200000),
        pricePoint("2024-09-24", 420.55, 418.34, 421.88, 417.22, 17800000),
        pricePoint("2024-10-01", 418.34, 425.22, 426.77, 417.55, 18900000),
        pricePoint("2024-10-08", 425.22, 419.77, 426.00, 418.33, 19800000),
        pricePoint("2024-10-15", 419.77, 422.11, 423.55, 418.22, 17200000),
        pricePoint("2024-10-22", 422.11, 430.53, 431.22, 421.00, 22100000),
        pricePoint("2024-10-29", 430.53, 420.33, 431.00, 419.22, 24300000),
        pricePoint("2024-11-05", 420.33, 425.77, 426.44, 419.11, 20100000),
        pricePoint("2024-11-12", 425.77, 418.22, 426.11, 417.55, 21400000),
        pricePoint("2024-11-19", 418.22, 415.50, 419.01, 414.33, 18700000),
      ],
    },
    expires_at: in30d,
  },
];

const newsCache = [
  {
    cache_key: "news:NVIDIA:30",
    payload_json: {
      query: "NVIDIA", articles: [
        { id: "n1", headline: "NVIDIA Blackwell B200 GPUs Begin Mass Shipment to Hyperscalers", summary: "NVIDIA has started volume shipments of its Blackwell B200 GPUs to major cloud providers. Microsoft and Google are first recipients.", sentiment: "positive", confidence: 0.92, published_at: "2024-11-15T09:30:00Z", source: "Reuters", url: "#" },
        { id: "n2", headline: "NVIDIA Q3 Revenue Beats Estimates, Guides Higher on AI Demand", summary: "NVIDIA reported Q3 FY2025 revenue of $35.1B, beating consensus of $32.5B, and guided Q4 to $37.5B.", sentiment: "positive", confidence: 0.95, published_at: "2024-11-20T16:15:00Z", source: "Bloomberg", url: "#" },
        { id: "n3", headline: "China Export Controls Trim $2B from NVIDIA FY2025 Revenue", summary: "U.S. BIS restrictions on H20 exports to China reduced NVIDIA's FY2025 revenue by approximately $2 billion, per management commentary.", sentiment: "negative", confidence: 0.88, published_at: "2024-10-08T11:45:00Z", source: "Wall Street Journal", url: "#" },
        { id: "n4", headline: "CUDA Developer Base Crosses 4 Million Milestone", summary: "NVIDIA announced that the CUDA developer ecosystem has surpassed 4 million registered developers, reinforcing its software moat.", sentiment: "positive", confidence: 0.84, published_at: "2024-11-01T14:00:00Z", source: "VentureBeat", url: "#" },
      ],
    },
    expires_at: in30d,
  },
  {
    cache_key: "news:AMD:30",
    payload_json: {
      query: "AMD", articles: [
        { id: "a1", headline: "Microsoft Azure Deploys AMD MI300X for OpenAI Inference Workloads", summary: "Microsoft confirmed broad deployment of AMD MI300X GPUs in Azure for running OpenAI model inference, citing superior HBM capacity.", sentiment: "positive", confidence: 0.89, published_at: "2024-11-05T10:00:00Z", source: "Microsoft Blog", url: "#" },
        { id: "a2", headline: "AMD ROCm 6.2 Closes PyTorch Performance Gap With CUDA", summary: "AMD's latest ROCm release achieves within 5% of CUDA performance on key PyTorch benchmarks, a significant improvement over prior versions.", sentiment: "positive", confidence: 0.82, published_at: "2024-10-22T08:30:00Z", source: "Tom's Hardware", url: "#" },
        { id: "a3", headline: "AMD Q3 2024: Data Center Revenue Hits $3.5B, MI300 Demand Strong", summary: "AMD reported Data Center segment revenue of $3.5B, driven primarily by MI300X shipments. Management raised full-year data center guidance.", sentiment: "positive", confidence: 0.91, published_at: "2024-10-29T16:30:00Z", source: "AMD IR", url: "#" },
      ],
    },
    expires_at: in30d,
  },
  {
    cache_key: "news:Intel:30",
    payload_json: {
      query: "Intel", articles: [
        { id: "i1", headline: "Intel Reports Q3 Loss, Announces 15,000 Headcount Reduction", summary: "Intel posted a Q3 net loss and announced a restructuring plan that includes reducing its workforce by approximately 15,000 employees.", sentiment: "negative", confidence: 0.93, published_at: "2024-10-31T16:00:00Z", source: "CNBC", url: "#" },
        { id: "i2", headline: "Intel 18A Tape-In Complete; PPA Claims Competitive With TSMC N2", summary: "Intel confirmed tape-in of its first 18A product. The company claims power-performance-area metrics on par with TSMC's N2 node.", sentiment: "positive", confidence: 0.87, published_at: "2024-09-10T09:00:00Z", source: "AnandTech", url: "#" },
        { id: "i3", headline: "Microsoft Commits to Intel 18A Foundry Capacity for Azure Custom Silicon", summary: "Microsoft signed a multi-year agreement to manufacture custom Azure silicon at Intel Foundry using the 18A process node.", sentiment: "positive", confidence: 0.91, published_at: "2024-08-22T11:30:00Z", source: "Bloomberg", url: "#" },
      ],
    },
    expires_at: in30d,
  },
];

const { error: ecache } = await service.from("query_cache").insert([...marketCache, ...newsCache]);
ok("Query cache entries (7)", ecache);

// ── Phase 8: Audit events ─────────────────────────────────────────────────────

console.log("\n8. Seeding audit baseline...");

const { error: ea } = await service.from("audit_events").insert([
  {
    org_id: orgAlpha.id, actor_id: aliceId,
    action: "org.created", entity_type: "organization", entity_id: orgAlpha.id,
    metadata_json: { org_name: "Alpha Capital" },
  },
  {
    org_id: orgAlpha.id, actor_id: aliceId,
    action: "report.created", entity_type: "research_report", entity_id: insertedAlphaReports[0].id,
    metadata_json: { title: "NVIDIA Deep Dive: Blackwell Ramp & AI Supercycle" },
  },
  {
    org_id: orgAlpha.id, actor_id: bobId,
    action: "report.created", entity_type: "research_report", entity_id: insertedAlphaReports[1].id,
    metadata_json: { title: "AMD vs Intel: AI Accelerator Challenger Analysis" },
  },
  {
    org_id: orgBeta.id, actor_id: carolId,
    action: "org.created", entity_type: "organization", entity_id: orgBeta.id,
    metadata_json: { org_name: "Beta Ventures" },
  },
  {
    org_id: orgBeta.id, actor_id: carolId,
    action: "report.created", entity_type: "research_report", entity_id: insertedBetaReports[0].id,
    metadata_json: { title: "Intel 18A: Binary Bet or Value Trap?" },
  },
]);
ok("Audit events (5)", ea);

// ── Done ──────────────────────────────────────────────────────────────────────

console.log(`
=== Seed complete ===

Alpha Capital (${orgAlpha.id.slice(0, 8)}…)
  invite code : ${orgAlpha.invite_code}
  alice@alpha.test  - admin    / password123
  bob@alpha.test    - analyst  / password123

Beta Ventures (${orgBeta.id.slice(0, 8)}…)
  invite code : ${orgBeta.invite_code}
  carol@beta.test   - admin    / password123
  dave@beta.test    - analyst  / password123
`);
