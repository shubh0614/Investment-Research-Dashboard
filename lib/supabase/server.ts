import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { config } from "@/lib/config";

/**
 * Session-bound server client — RLS applies, auth.uid() is set.
 *
 * Supports two auth mechanisms so both browser and API clients work:
 * 1. Cookie-based sessions (browser, the normal path).
 * 2. Authorization: Bearer <token> header (machine tests, API clients).
 *
 * Use this for all tenant queries — never the service client.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const headersList = await headers();
  const authHeader  = headersList.get("authorization");

  return createServerClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — mutations ignored; middleware handles refresh.
        }
      },
    },
    // Forward Bearer token when present so programmatic callers don't need cookies.
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}
