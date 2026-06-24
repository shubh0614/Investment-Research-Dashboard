import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "http://127.0.0.1:54101",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
);

const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (error) { console.error("listUsers:", error.message); process.exit(1); }

console.log("Found " + data.users.length + " user(s)");

for (const u of data.users) {
  const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
  if (delErr) console.warn("  Failed: " + u.email + " - " + delErr.message);
  else console.log("  Deleted auth user: " + u.email);
}

// query_cache is intentionally excluded - it holds API responses with no user data,
// and clearing it burns through daily API quotas (NewsAPI: 100/day, Alpha Vantage: 25/day)
const tables = ["audit_events","report_tags","research_reports","watchlist_items","document_chunks","documents","profiles","organizations"];
for (const t of tables) {
  const { error: e } = await supabase.from(t).delete().not("id","is",null);
  if (e) console.warn("  Truncate " + t + ": " + e.message);
  else console.log("  Cleared table: " + t);
}

console.log("\nDone - all accounts and data cleared.");
