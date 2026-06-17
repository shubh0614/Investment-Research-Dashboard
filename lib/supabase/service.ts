import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * Service-role client — bypasses RLS.
 * Use ONLY for the onboarding transaction and seed scripts.
 * Never use for ordinary tenant queries.
 */
export function createServiceClient() {
  return createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
