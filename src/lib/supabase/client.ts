import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import { vaultFetch } from "@/lib/vault";

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Browser client. `createBrowserClient` returns a singleton in the browser, so
 * calling this from many components is cheap. The session lives in cookies,
 * which keeps server rendering and the browser in sync. While the notes vault
 * is open, its requests carry the vault's token (see lib/vault).
 */
export function createClient(): TypedSupabaseClient {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { global: { fetch: vaultFetch } });
}
