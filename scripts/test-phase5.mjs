/**
 * Phase 5 machine test - API surface and CRUD.
 *
 * REQUIRES:
 *   1. `supabase start` running
 *   2. `npm run seed` completed
 *   3. `npm run dev` running in a separate terminal
 *
 * Run: node scripts/test-phase5.mjs
 *
 * Tests:
 *   5.1 Auth guards: every endpoint returns 401 without auth.
 *   5.2 Admin guards: analyst is denied on admin-only endpoints.
 *   5.3 Research CRUD: save → list → read → update title → update tags → delete.
 *   5.4 Cross-tenant: Org B cannot read Org A's report (gets 404).
 *   5.5 Tag filter: filter by tag returns only tagged reports.
 *   5.6 Text search: ?q= filters by title/query_text.
 *   5.7 Watchlist CRUD: add → list → duplicate 409 → delete → list empty.
 *   5.8 Admin panel: invite code and members list work for admin.
 */

import { createClient } from "@supabase/supabase-js";

const BASE_URL    = process.env.APP_URL          ?? "http://localhost:3000";
const SUPA_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "http://127.0.0.1:54321";
const ANON_KEY    =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

let passed = 0, failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const sb = createClient(SUPA_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { session }, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !session) throw new Error(`Sign-in failed for ${email}: ${error?.message}`);
  return session.access_token;
}

function headers(token) {
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function api(method, path, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(token),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: res.status, body: json };
}

// ── Pre-flight ────────────────────────────────────────────────────────────────

console.log("\n=== Phase 5 machine tests - API surface and CRUD ===\n");

try {
  const health = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
  if (!health.ok) throw new Error("health not ok");
  console.log("✓ Dev server reachable\n");
} catch {
  console.error("✗ Dev server not running. Start with `npm run dev`.");
  process.exit(1);
}

// ── Sign in ───────────────────────────────────────────────────────────────────

let aliceToken, bobToken, carolToken;

console.log("Signing in as test users...");
try {
  aliceToken = await signIn("alice@alpha.test", "password123");
  console.log("  ✓ alice@alpha.test (Org A admin) signed in");
} catch (e) { console.error(`  ✗ ${e.message}`); process.exit(1); }

try {
  bobToken = await signIn("bob@alpha.test", "password123");
  console.log("  ✓ bob@alpha.test (Org A analyst) signed in");
} catch (e) { console.error(`  ✗ ${e.message}`); process.exit(1); }

try {
  carolToken = await signIn("carol@beta.test", "password123");
  console.log("  ✓ carol@beta.test (Org B analyst) signed in");
} catch (e) { console.error(`  ✗ ${e.message}`); process.exit(1); }

// ── 5.1 Auth guards ───────────────────────────────────────────────────────────

console.log("\n5.1 Auth guards (no token → 401)...");

for (const [method, path] of [
  ["GET",    "/api/research"],
  ["POST",   "/api/research/save"],
  ["GET",    "/api/watchlist"],
  ["POST",   "/api/watchlist"],
  ["POST",   "/api/org/invite"],
  ["GET",    "/api/org/members"],
]) {
  const body = ["GET", "HEAD", "DELETE"].includes(method) ? undefined : {};
  const { status } = await api(method, path, null, body);
  assert(status === 401, `${method} ${path} → 401`);
}

// ── 5.2 Admin guards ──────────────────────────────────────────────────────────

console.log("\n5.2 Admin guards (analyst → 403)...");

for (const [method, path] of [
  ["POST", "/api/org/invite"],
  ["GET",  "/api/org/members"],
]) {
  const body = ["GET", "HEAD", "DELETE"].includes(method) ? undefined : {};
  const { status } = await api(method, path, bobToken, body);
  assert(status === 403, `${method} ${path} as analyst → 403`);
}

// ── 5.3 Research CRUD ─────────────────────────────────────────────────────────

console.log("\n5.3 Research CRUD...");

const mockReport = {
  summary:    "Test report summary",
  companies:  [{ ticker: "NVDA", name: "NVIDIA", sources: ["Alpha Vantage"] }],
  news:       [],
  risks:      [{ title: "Risk 1", description: "A risk", severity: "medium", sources: ["Alpha Vantage"] }],
  tools_used: ["get_market_data"],
  meta: {
    query_text:   "NVDA overview",
    generated_at: new Date().toISOString(),
    latency_ms:   1234,
    token_usage:  { prompt: 100, completion: 200, total: 300 },
  },
};

// Save
const saveRes = await api("POST", "/api/research/save", aliceToken, {
  query_text:  "NVDA overview test",
  title:       "Phase 5 test report",
  result_json: mockReport,
  tags:        ["test", "nvda"],
});
assert(saveRes.status === 201, `POST /api/research/save → 201 (got ${saveRes.status})`);
assert(typeof saveRes.body.data?.id === "string", "save returns report id");
assert(Array.isArray(saveRes.body.data?.tags), "save returns tags array");
assert(saveRes.body.data?.tags?.includes("test"), "save returns correct tags");

const reportId = saveRes.body.data?.id;

// List
const listRes = await api("GET", "/api/research", aliceToken);
assert(listRes.status === 200, `GET /api/research → 200`);
assert(listRes.body.data?.total > 0, "list returns at least 1 report");
const found = listRes.body.data?.reports?.find((r) => r.id === reportId);
assert(found !== undefined, "saved report appears in list");
assert(found?.tags?.includes("test"), "list result includes tags");

// Read
const readRes = await api("GET", `/api/research/${reportId}`, aliceToken);
assert(readRes.status === 200, `GET /api/research/${reportId} → 200`);
assert(readRes.body.data?.result_json !== undefined, "read returns result_json");

// Update title
const patchTitle = await api("PATCH", `/api/research/${reportId}`, aliceToken, { title: "Updated title" });
assert(patchTitle.status === 200, "PATCH title → 200");
assert(patchTitle.body.data?.title === "Updated title", "title was updated");

// Update tags
const patchTags = await api("PATCH", `/api/research/${reportId}`, aliceToken, { tags: ["nvda", "updated"] });
assert(patchTags.status === 200, "PATCH tags → 200");
assert(patchTags.body.data?.tags?.includes("updated"), "tags were replaced");
assert(!patchTags.body.data?.tags?.includes("test"), "old tag was removed");

// Validation: PATCH with no fields → 422
const patchEmpty = await api("PATCH", `/api/research/${reportId}`, aliceToken, {});
assert(patchEmpty.status === 422, "PATCH with empty body → 422");

// ── 5.4 Cross-tenant isolation ────────────────────────────────────────────────

console.log("\n5.4 Cross-tenant isolation...");

const crossRead = await api("GET", `/api/research/${reportId}`, carolToken);
assert(crossRead.status === 404, "Org B cannot read Org A report (404, not 403)");

// Carol saves her own report in Org B
const carolSave = await api("POST", "/api/research/save", carolToken, {
  query_text:  "AMD overview",
  result_json: mockReport,
  tags:        ["beta"],
});
assert(carolSave.status === 201, "Carol can save her own report (201)");
const carolReportId = carolSave.body.data?.id;

// Alice cannot read Carol's report
const crossRead2 = await api("GET", `/api/research/${carolReportId}`, aliceToken);
assert(crossRead2.status === 404, "Org A cannot read Org B report (404)");

// ── 5.5 Tag filter ────────────────────────────────────────────────────────────

console.log("\n5.5 Tag filter...");

const tagRes = await api("GET", "/api/research?tag=nvda", aliceToken);
assert(tagRes.status === 200, "GET /api/research?tag=nvda → 200");
assert(
  (tagRes.body.data?.reports ?? []).every((r) => r.tags?.includes("nvda")),
  "tag filter returns only reports with that tag",
);

const noTagRes = await api("GET", "/api/research?tag=nonexistent-tag-xyz", aliceToken);
assert(noTagRes.status === 200, "tag filter with no matches → 200");
assert(noTagRes.body.data?.total === 0, "tag filter with no matches → total=0");

// ── 5.6 Text search ───────────────────────────────────────────────────────────

console.log("\n5.6 Text search...");

// query_text is unchanged after the PATCH (only title and tags were changed)
const searchRes = await api("GET", "/api/research?q=NVDA+overview+test", aliceToken);
assert(searchRes.status === 200, "GET /api/research?q=... → 200");
assert(
  (searchRes.body.data?.reports ?? []).some((r) => r.id === reportId),
  "text search finds the test report by query_text",
);

// ── 5.7 Watchlist CRUD ────────────────────────────────────────────────────────

console.log("\n5.7 Watchlist CRUD...");

// Empty initially (after seed, alice may have seeded items - just check 200)
const wlEmpty = await api("GET", "/api/watchlist", aliceToken);
assert(wlEmpty.status === 200, "GET /api/watchlist → 200");

// Add
const wlAdd = await api("POST", "/api/watchlist", aliceToken, { ticker: "TEST", company_name: "Test Corp" });
assert(wlAdd.status === 201, "POST /api/watchlist → 201");
assert(wlAdd.body.data?.ticker === "TEST", "watchlist add returns correct ticker");
const wlItemId = wlAdd.body.data?.id;

// Duplicate → 409
const wlDup = await api("POST", "/api/watchlist", aliceToken, { ticker: "TEST", company_name: "Test Corp" });
assert(wlDup.status === 409, "duplicate watchlist add → 409");

// List includes new item
const wlList = await api("GET", "/api/watchlist", aliceToken);
assert(wlList.body.data?.items?.some((i) => i.id === wlItemId), "watchlist contains added item");

// Cross-tenant: carol cannot delete alice's item
const wlCross = await api("DELETE", `/api/watchlist/${wlItemId}`, carolToken);
assert(wlCross.status === 404, "cross-tenant watchlist delete → 404");

// Delete
const wlDel = await api("DELETE", `/api/watchlist/${wlItemId}`, aliceToken);
assert(wlDel.status === 204, "DELETE /api/watchlist/:id → 204");

// ── 5.8 Admin panel ───────────────────────────────────────────────────────────

console.log("\n5.8 Admin panel...");

const inviteRes = await api("POST", "/api/org/invite", aliceToken);
assert(inviteRes.status === 200, "POST /api/org/invite as admin → 200");
assert(typeof inviteRes.body.data?.invite_code === "string", "invite code is a string");

const membersRes = await api("GET", "/api/org/members", aliceToken);
assert(membersRes.status === 200, "GET /api/org/members as admin → 200");
assert(Array.isArray(membersRes.body.data?.members), "members is an array");
assert(membersRes.body.data?.members?.length >= 2, "Org A has at least 2 members");

// ── Cleanup ───────────────────────────────────────────────────────────────────

console.log("\nCleaning up test reports...");
const delRes = await api("DELETE", `/api/research/${reportId}`, aliceToken);
assert(delRes.status === 204, `DELETE report → 204`);

// Verify deletion
const afterDel = await api("GET", `/api/research/${reportId}`, aliceToken);
assert(afterDel.status === 404, "deleted report returns 404");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
