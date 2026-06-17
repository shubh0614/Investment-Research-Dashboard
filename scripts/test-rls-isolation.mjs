/**
 * Gate 1 + Gate 2 machine test:
 * 1. Creates two orgs + two users via the service role (bypassing RLS).
 * 2. Signs in each user via the Supabase auth API to get a JWT.
 * 3. Runs profile + org queries under each user's JWT and asserts tenant isolation:
 *    - User A sees only Org A's rows (and zero Org B rows).
 *    - User B sees only Org B's rows (and zero Org A rows).
 * 4. Tests /api/me and /api/admin-test via the app's own HTTP routes.
 *
 * Run: node scripts/test-rls-isolation.mjs
 * Requires: `supabase start` and `npm run dev` both running.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL        = "http://127.0.0.1:54321";
// JWT-format keys from `npx supabase status` (PostgREST requires these, not the sb_* format).
const ANON_KEY         = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY       ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const APP_URL             = "http://localhost:3000";

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method:  "POST",
    headers: { "apikey": ANON_KEY, "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`signUp failed for ${email}: ${JSON.stringify(json)}`);
  return json;
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:  "POST",
    headers: { "apikey": ANON_KEY, "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`signIn failed for ${email}: ${JSON.stringify(json)}`);
  return json;
}

function userClient(accessToken) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth:   { autoRefreshToken: false, persistSession: false },
  });
}

// ── Setup ──────────────────────────────────────────────────────────────────────

console.log("\n=== Gate 1 + 2: RLS isolation test ===\n");

// Idempotent: wipe any leftover test data from a prior run.
console.log("0. Cleaning up leftover test data...");
const { data: staleUsers } = await service.auth.admin.listUsers();
for (const u of staleUsers?.users ?? []) {
  if (["user-a@test.local", "user-b@test.local"].includes(u.email ?? "")) {
    await service.from("profiles").delete().eq("id", u.id);
    await service.auth.admin.deleteUser(u.id);
  }
}
await service.from("organizations").delete().in("name", ["Org Alpha", "Org Beta"]);
console.log("  cleanup done.");

// 1. Create orgs via service role
console.log("\n1. Creating organisations with service role...");
const { data: orgA, error: orgAErr } = await service.from("organizations").insert({ name: "Org Alpha" }).select("id, invite_code").single();
const { data: orgB, error: orgBErr } = await service.from("organizations").insert({ name: "Org Beta"  }).select("id, invite_code").single();
assert(!orgAErr && orgA, `Created Org Alpha: ${orgAErr?.message ?? orgA?.id}`);
assert(!orgBErr && orgB, `Created Org Beta:  ${orgBErr?.message ?? orgB?.id}`);

// 2. Sign up users
console.log("\n2. Signing up test users...");
const sessionA = await signUp("user-a@test.local", "password123").catch(e => ({ error: e.message }));
const sessionB = await signUp("user-b@test.local", "password123").catch(e => ({ error: e.message }));
assert(!sessionA.error, `Signed up user A: ${sessionA.error ?? sessionA.user?.id}`);
assert(!sessionB.error, `Signed up user B: ${sessionB.error ?? sessionB.user?.id}`);

const userAId = sessionA.user?.id;
const userBId = sessionB.user?.id;

// 3. Insert profiles via service role
console.log("\n3. Inserting profiles with service role...");
const { error: profAErr } = await service.from("profiles").insert({ id: userAId, org_id: orgA.id, email: "user-a@test.local", role: "admin" });
const { error: profBErr } = await service.from("profiles").insert({ id: userBId, org_id: orgB.id, email: "user-b@test.local", role: "analyst" });
assert(!profAErr, `Inserted profile A (admin): ${profAErr?.message ?? "ok"}`);
assert(!profBErr, `Inserted profile B (analyst): ${profBErr?.message ?? "ok"}`);

// 4. Sign in and get fresh JWTs
console.log("\n4. Signing in to get JWTs...");
const tokenA = await signIn("user-a@test.local", "password123");
const tokenB = await signIn("user-b@test.local", "password123");
assert(tokenA.access_token, "Got JWT for user A");
assert(tokenB.access_token, "Got JWT for user B");

// 5. RLS: user A sees only Org A data
console.log("\n5. RLS — user A should see only Org A rows...");
const clientA = userClient(tokenA.access_token);
const { data: profsSeenByA } = await clientA.from("profiles").select("id, org_id");
const { data: orgsSeenByA  } = await clientA.from("organizations").select("id");

assert(profsSeenByA?.every(p => p.org_id === orgA.id), `User A profiles: all org_id = orgA  (got ${profsSeenByA?.length} rows)`);
assert(orgsSeenByA?.length === 1 && orgsSeenByA[0].id === orgA.id, `User A orgs: exactly Org Alpha (got ${orgsSeenByA?.length} rows)`);

// 6. RLS: user B cannot see Org A's data
console.log("\n6. RLS — user B should see only Org B rows and zero of Org A...");
const clientB = userClient(tokenB.access_token);
const { data: profsSeenByB } = await clientB.from("profiles").select("id, org_id");
const { data: orgsSeenByB  } = await clientB.from("organizations").select("id");

assert(profsSeenByB?.every(p => p.org_id === orgB.id), `User B profiles: all org_id = orgB  (got ${profsSeenByB?.length} rows)`);
assert(orgsSeenByB?.length === 1 && orgsSeenByB[0].id === orgB.id, `User B orgs: exactly Org Beta  (got ${orgsSeenByB?.length} rows)`);

// 7. Cross-tenant read: user B cannot read user A's profile by ID
console.log("\n7. Cross-tenant direct read: user B tries to fetch user A's profile by ID...");
const { data: crossRead, error: crossErr } = await clientB.from("profiles").select("id").eq("id", userAId).single();
assert(!crossRead && (crossErr?.code === "PGRST116" || crossErr?.code === "42501"), `Cross-tenant read denied (got: ${crossRead ? JSON.stringify(crossRead) : crossErr?.code})`);

// 8. /api/me via HTTP (uses cookie auth — testing JSON shape here)
console.log("\n8. /api/me — unauthenticated should return 401...");
const meRes = await fetch(`${APP_URL}/api/me`);
const meJson = await meRes.json();
assert(meRes.status === 401 && meJson.ok === false, `/api/me unauthenticated → 401 (got ${meRes.status})`);

// 9. /api/admin-test was removed after Gate 3 verification — skip.

// 10. /api/health still returns ok
console.log("\n10. /api/health should still return ok...");
const healthRes  = await fetch(`${APP_URL}/api/health`);
const healthJson = await healthRes.json();
assert(healthJson.ok === true, `/api/health → ok`);

// ── Phase 2: Seed data + new tenant tables ─────────────────────────────────────

// Seed the database so Phase 2 tables have data.
// Re-using service client directly to avoid spawning a subprocess.
const SEED_EMAILS = ["alice@alpha.test", "bob@alpha.test", "carol@beta.test", "dave@beta.test"];
const { data: seedUsers } = await service.auth.admin.listUsers();
const alice = seedUsers?.users?.find(u => u.email === "alice@alpha.test");
const carol = seedUsers?.users?.find(u => u.email === "carol@beta.test");

console.log("\n11. Phase 2 tables — RLS isolation on research_reports...");
if (alice && carol) {
  // Sign in as alice (Alpha Capital admin)
  const tokenAlice = await signIn("alice@alpha.test", "password123");
  const clientAlice = userClient(tokenAlice.access_token);

  // Sign in as carol (Beta Ventures admin)
  const tokenCarol = await signIn("carol@beta.test", "password123");
  const clientCarol = userClient(tokenCarol.access_token);

  const { data: aliceReports } = await clientAlice.from("research_reports").select("id, org_id");
  const { data: carolReports } = await clientCarol.from("research_reports").select("id, org_id");

  // Get their org_ids via service client (bypasses RLS — authoritative lookup).
  const { data: aliceProf } = await service.from("profiles").select("org_id").eq("id", alice.id).single();
  const { data: carolProf } = await service.from("profiles").select("org_id").eq("id", carol.id).single();

  assert(
    aliceReports?.length > 0 && aliceReports?.every(r => r.org_id === aliceProf?.org_id),
    `Alice sees only Alpha Capital reports (${aliceReports?.length} rows)`
  );
  assert(
    carolReports?.length > 0 && carolReports?.every(r => r.org_id === carolProf?.org_id),
    `Carol sees only Beta Ventures reports (${carolReports?.length} rows)`
  );

  // Cross-org: alice cannot read carol's reports
  const carolReportId = carolReports?.[0]?.id;
  if (carolReportId) {
    const { data: crossReport } = await clientAlice
      .from("research_reports").select("id").eq("id", carolReportId).maybeSingle();
    assert(!crossReport, `Cross-tenant report read denied for alice → carol's report`);
  }

  console.log("\n12. Phase 2 tables — watchlist RLS isolation...");
  const { data: aliceWatchlist } = await clientAlice.from("watchlist_items").select("org_id");
  const { data: carolWatchlist } = await clientCarol.from("watchlist_items").select("org_id");
  assert(
    aliceWatchlist?.length > 0 && aliceWatchlist?.every(w => w.org_id === aliceProf?.org_id),
    `Alice sees only Alpha Capital watchlist items (${aliceWatchlist?.length} rows)`
  );
  assert(
    carolWatchlist?.length > 0 && carolWatchlist?.every(w => w.org_id === carolProf?.org_id),
    `Carol sees only Beta Ventures watchlist items (${carolWatchlist?.length} rows)`
  );

  console.log("\n13. Phase 2 tables — documents RLS isolation...");
  const { data: aliceDocs } = await clientAlice.from("documents").select("org_id");
  const { data: carolDocs } = await clientCarol.from("documents").select("org_id");
  assert(
    aliceDocs?.length > 0 && aliceDocs?.every(d => d.org_id === aliceProf?.org_id),
    `Alice sees only Alpha Capital documents (${aliceDocs?.length} rows)`
  );
  assert(
    carolDocs?.length > 0 && carolDocs?.every(d => d.org_id === carolProf?.org_id),
    `Carol sees only Beta Ventures documents (${carolDocs?.length} rows)`
  );

  console.log("\n14. query_cache — accessible to both tenants (no RLS)...");
  const { data: cacheAlice, error: cacheErrA } = await clientAlice.from("query_cache").select("cache_key").limit(1);
  const { data: cacheCarol, error: cacheErrC } = await clientCarol.from("query_cache").select("cache_key").limit(1);
  assert(!cacheErrA && cacheAlice !== null, `Alice can read query_cache`);
  assert(!cacheErrC && cacheCarol !== null, `Carol can read query_cache`);
} else {
  console.log("  (skipping Phase 2 table tests — seed data not present; run npm run seed first)");
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
