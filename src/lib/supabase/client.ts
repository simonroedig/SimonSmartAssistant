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
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { global: { fetch: signedInFetch } });
}

let renewing: Promise<string | null> | null = null;

/**
 * A fresh sign-in token: null if there's no sign-in at all (e.g. on the sign-in page).
 * Throws – as a network error, so it's tried again – if it couldn't be renewed just now.
 */
function renewToken(): Promise<string | null> {
  renewing ??= (async () => {
    try {
      const { data, error } = await createClient().auth.refreshSession();
      if (data.session) return data.session.access_token;
      const status = (error as { status?: number } | null)?.status ?? 0;
      if (error && (error.name === "AuthRetryableFetchError" || status === 0 || status >= 500)) {
        throw new TypeError("Network error: the sign-in couldn't be renewed yet");
      }
      return null;
    } finally {
      renewing = null;
    }
  })();
  return renewing;
}

/**
 * After a long while asleep (a tab in the background, the PC on standby) the sign-in
 * may have run out, and when it can't be renewed right away (the network not back yet)
 * the client would send database requests without it: saves get turned down and lists
 * come back empty. Such a request renews the sign-in first – or fails as a network
 * error, so saves are tried again and lists keep what they show.
 */
const signedInFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("/rest/v1/")) {
    const headers = new Headers(init?.headers);
    const auth = headers.get("Authorization");
    if (!auth || auth === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) {
      const token = await renewToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
        init = { ...init, headers };
      }
    }
  }
  return vaultFetch(input, init);
};
