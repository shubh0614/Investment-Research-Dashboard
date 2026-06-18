/**
 * Phase 7 — Isolation + RBAC test suite.
 *
 * Proves three guarantees in an automated, reproducible way:
 *
 *   GUARANTEE 1 — DB-tier RLS isolation
 *     A user in Org B cannot read Org A's rows from any tenant table,
 *     even when supplying a known Org A row ID directly.
 *     The database returns 0 rows — this is not an application-layer check.
 *
 *   GUARANTEE 2 — API cross-tenant denial
 *     POST-ing a known Org A report ID to the API as an Org B user returns 404.
 *     The response is indistinguishable from "not found" — no information leakage.
 *
 *   GUARANTEE 3 — API RBAC gates
 *     Admin-only endpoints return 403 for authenticated analyst-role users.
 *     Unauthenticated requests return 401 for all protected endpoints.
 *
 * Prerequisites:
 *   `npx supabase start` running
 *   `npm run seed` completed (creates alice/alpha and carol/beta test data)
 *   `npm run dev` running in a separate terminal
 *
 * Run:  npm run test:isolation
 */

import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "http://127.0.0.1:54101";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SVC_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const APP_URL  = process.env.APP_URL ?? "http://localhost:3000";

const service = createClient(SUPA_URL, SVC_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function pass(label) {
  console.log(`  ✓  ${label}`);
  passed++;
}

function fail(label, detail = "") {
  const msg = detail ? `${label}  (${detail})` : label;
  console.error(`  ✗  ${msg}`);
  failures.push(msg);
  failed++;
}

function assert(condition, label, detail = "") {
  condition ? pass(label) : fail(label, detail);
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function signIn(email, password) {
  const sb = createClient(SUPA_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { session }, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !session) throw new Error(`Sign-in failed for ${email}: ${error?.message}`);
  return session.access_token;
}

function dbClient(token) {
  return createClient(SUPA_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function api(method, path, token, body) {
  const res = await fetch(`${APP_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined && !["GET", "HEAD", "DELETE"].includes(method)
      ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: res.status, body: json };
}

// ── Setup: look up seeded users ───────────────────────────────────────────────

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║  Klypup — Phase 7 Isolation + RBAC Test Suite               ║");
console.log("╚══════════════════════════════════════════════════════════════╝");

section("Setup: locating seeded users");

const { data: allUsers } = await service.auth.admin.listUsers();
const users = Object.fromEntries(
  ["alice@alpha.test", "bob@alpha.test", "carol@beta.test", "dave@beta.test"]
    .map(email => [email, allUsers?.users?.find(u => u.email === email)])
);

for (const [email, user] of Object.entries(users)) {
  assert(!!user, `Seeded user exists: ${email}`,
    "Run `npm run seed` first");
}

// Abort if seed data is missing — remaining tests are meaningless
if (!users["alice@alpha.test"] || !users["carol@beta.test"]) {
  console.error("\n  Seed data not found. Run `npm run seed` first.\n");
  process.exit(1);
}

// Get org IDs via service role (authoritative, bypasses RLS)
const { data: aliceProf } = await service.from("profiles").select("org_id").eq("id", users["alice@alpha.test"].id).single();
const { data: carolProf } = await service.from("profiles").select("org_id").eq("id", users["carol@beta.test"].id).single();
const { data: bobProf   } = await service.from("profiles").select("org_id").eq("id", users["bob@alpha.test"].id).single();

assert(aliceProf?.org_id, "Alice has an org_id (Alpha Capital)");
assert(carolProf?.org_id, "Carol has an org_id (Beta Ventures)");
assert(aliceProf?.org_id !== carolProf?.org_id, "Alice and Carol are in different orgs");

// Sign in all four seeded users
section("Setup: signing in as seeded users");

let tokenAlice, tokenBob, tokenCarol, tokenDave;
try {
  [tokenAlice, tokenBob, tokenCarol, tokenDave] = await Promise.all([
    signIn("alice@alpha.test", "password123"),
    signIn("bob@alpha.test",   "password123"),
    signIn("carol@beta.test",  "password123"),
    signIn("dave@beta.test",   "password123"),
  ]);
  pass("alice@alpha.test signed in (Alpha Capital admin)");
  pass("bob@alpha.test signed in (Alpha Capital analyst)");
  pass("carol@beta.test signed in (Beta Ventures admin)");
  pass("dave@beta.test signed in (Beta Ventures analyst)");
} catch (e) {
  fail("Sign-in failed — cannot continue", e.message);
  process.exit(1);
}

const clientAlice = dbClient(tokenAlice);
const clientCarol = dbClient(tokenCarol);

// ═══════════════════════════════════════════════════════════════════════════════
// GUARANTEE 1 — DB-tier RLS isolation
// ═══════════════════════════════════════════════════════════════════════════════

section("Guarantee 1a: Profiles — each user sees only their own org");

const { data: profsAlice } = await clientAlice.from("profiles").select("id, org_id");
const { data: profsCarol } = await clientCarol.from("profiles").select("id, org_id");

assert(
  profsAlice?.length > 0 && profsAlice.every(p => p.org_id === aliceProf.org_id),
  `Alice sees only Alpha Capital profiles (${profsAlice?.length} rows, all org_id matches)`,
);
assert(
  profsCarol?.length > 0 && profsCarol.every(p => p.org_id === carolProf.org_id),
  `Carol sees only Beta Ventures profiles (${profsCarol?.length} rows, all org_id matches)`,
);

section("Guarantee 1b: Cross-tenant profile read — direct ID lookup");

const { data: crossProfile } = await clientCarol
  .from("profiles")
  .select("id")
  .eq("id", users["alice@alpha.test"].id)
  .maybeSingle();

assert(
  crossProfile === null,
  "Carol cannot read Alice's profile by ID (database returns null, not app-layer check)",
  crossProfile ? `Got: ${JSON.stringify(crossProfile)}` : "",
);

section("Guarantee 1c: Research reports — RLS isolation");

const { data: reportsAlice } = await clientAlice.from("research_reports").select("id, org_id");
const { data: reportsCarol } = await clientCarol.from("research_reports").select("id, org_id");

assert(
  reportsAlice?.length > 0 && reportsAlice.every(r => r.org_id === aliceProf.org_id),
  `Alice sees only Alpha Capital reports (${reportsAlice?.length} rows)`,
);
assert(
  reportsCarol?.length > 0 && reportsCarol.every(r => r.org_id === carolProf.org_id),
  `Carol sees only Beta Ventures reports (${reportsCarol?.length} rows)`,
);

// Cross-org direct ID attack
const betaReportId = reportsCarol?.[0]?.id;
if (betaReportId) {
  const { data: crossReport } = await clientAlice
    .from("research_reports")
    .select("id")
    .eq("id", betaReportId)
    .maybeSingle();
  assert(
    crossReport === null,
    `Alice cannot read Carol's report by ID (cross-tenant guessed ID → 0 rows from DB)`,
    crossReport ? `Got: ${JSON.stringify(crossReport)}` : "",
  );
} else {
  fail("No Beta Ventures reports found to test cross-tenant read — run npm run seed");
}

section("Guarantee 1d: Watchlist + documents — RLS isolation");

const { data: wlAlice } = await clientAlice.from("watchlist_items").select("org_id");
const { data: wlCarol } = await clientCarol.from("watchlist_items").select("org_id");

assert(
  wlAlice?.length > 0 && wlAlice.every(w => w.org_id === aliceProf.org_id),
  `Alice watchlist: only Alpha Capital items (${wlAlice?.length} rows)`,
);
assert(
  wlCarol?.length > 0 && wlCarol.every(w => w.org_id === carolProf.org_id),
  `Carol watchlist: only Beta Ventures items (${wlCarol?.length} rows)`,
);

const { data: docsAlice } = await clientAlice.from("documents").select("org_id");
const { data: docsCarol } = await clientCarol.from("documents").select("org_id");

assert(
  docsAlice?.length > 0 && docsAlice.every(d => d.org_id === aliceProf.org_id),
  `Alice documents: only Alpha Capital docs (${docsAlice?.length} rows)`,
);
assert(
  docsCarol?.length > 0 && docsCarol.every(d => d.org_id === carolProf.org_id),
  `Carol documents: only Beta Ventures docs (${docsCarol?.length} rows)`,
);

section("Guarantee 1e: Organizations — each user sees only their own org");

const { data: orgsAlice } = await clientAlice.from("organizations").select("id, name");
const { data: orgsCarol } = await clientCarol.from("organizations").select("id, name");

assert(
  orgsAlice?.length === 1 && orgsAlice[0].id === aliceProf.org_id,
  `Alice sees exactly 1 org: ${orgsAlice?.[0]?.name ?? "(none)"}`,
);
assert(
  orgsCarol?.length === 1 && orgsCarol[0].id === carolProf.org_id,
  `Carol sees exactly 1 org: ${orgsCarol?.[0]?.name ?? "(none)"}`,
);

// ═══════════════════════════════════════════════════════════════════════════════
// GUARANTEE 2 — API cross-tenant denial
// ═══════════════════════════════════════════════════════════════════════════════

section("Guarantee 2: API cross-tenant denial — guessed report ID");

const alphaReportId = reportsAlice?.[0]?.id;
if (alphaReportId) {
  const r = await api("GET", `/api/research/${alphaReportId}`, tokenCarol);
  assert(
    r.status === 404,
    `Carol fetching Alpha report by ID → 404 (not 200 or 403 — no information leakage)`,
    `Got HTTP ${r.status}`,
  );
} else {
  fail("No Alpha Capital reports found to test API cross-tenant denial — run npm run seed");
}

// ═══════════════════════════════════════════════════════════════════════════════
// GUARANTEE 3 — API RBAC gates
// ═══════════════════════════════════════════════════════════════════════════════

section("Guarantee 3a: Unauthenticated requests → 401");

const protectedEndpoints = [
  ["GET",  "/api/me"],
  ["GET",  "/api/research"],
  ["GET",  "/api/watchlist"],
  ["GET",  "/api/org/members"],
];

for (const [method, path] of protectedEndpoints) {
  const r = await api(method, path, null);
  assert(
    r.status === 401,
    `${method} ${path} without auth → 401`,
    `Got HTTP ${r.status}`,
  );
}

section("Guarantee 3b: Admin-only endpoints deny analyst role → 403");

const adminEndpoints = [
  ["GET",  "/api/org/members"],
  ["POST", "/api/org/invite"],
];

for (const [method, path] of adminEndpoints) {
  // Bob is an Alpha Capital analyst
  const r = await api(method, path, tokenBob);
  assert(
    r.status === 403,
    `${method} ${path} as analyst (bob) → 403`,
    `Got HTTP ${r.status}: ${JSON.stringify(r.body?.error)}`,
  );
  // Dave is a Beta Ventures analyst
  const r2 = await api(method, path, tokenDave);
  assert(
    r2.status === 403,
    `${method} ${path} as analyst (dave) → 403`,
    `Got HTTP ${r2.status}: ${JSON.stringify(r2.body?.error)}`,
  );
}

section("Guarantee 3c: Admin-only endpoints succeed for admin role → 200");

for (const [method, path] of adminEndpoints) {
  const r = await api(method, path, tokenAlice);
  assert(
    r.status === 200,
    `${method} ${path} as admin (alice) → 200`,
    `Got HTTP ${r.status}: ${JSON.stringify(r.body?.error)}`,
  );
}

section("Guarantee 3d: Health endpoint is public → 200");

const health = await api("GET", "/api/health", null);
assert(health.status === 200 && health.body?.ok === true, "/api/health → 200 ok");

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n" + "═".repeat(66));
console.log(`  Results: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\n  Failed assertions:");
  failures.forEach(f => console.error(`    ✗  ${f}`));
}
console.log("═".repeat(66) + "\n");

process.exit(failed > 0 ? 1 : 0);
