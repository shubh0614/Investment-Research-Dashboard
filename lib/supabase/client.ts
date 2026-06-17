"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Browser client — used in Client Components for auth helpers (signIn, signOut, etc.). */
export function createClient() {
  // NEXT_PUBLIC_* vars are inlined at build time — safe to reference directly in client code.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
