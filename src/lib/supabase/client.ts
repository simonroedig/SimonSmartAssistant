import { createBrowserClient } from "@supabase/ssr";
import { onlineManager } from "@tanstack/react-query";
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

/** A failure that passes (the network, the server) – not a sign-in that is gone. */
function passing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, status } = error as { name?: string; status?: number };
  return name === "AuthRetryableFetchError" || !status || status >= 500;
}

let holding = false;

/**
 * Until the sign-in is renewed the app counts as offline (TanStack Query's own notion of it):
 * saves wait – their changes stay on screen – and lists aren't reloaded meanwhile, so nothing
 * that's waiting gets pushed off the screen. Every few seconds it tries again; once it works,
 * the waiting saves go out first, then lists are brought up to date.
 */
function holdUntilSignedIn() {
  onlineManager.setOnline(false);
  if (holding) return;
  holding = true;
  const attempt = async () => {
    let failed: unknown = null;
    try {
      const { data, error } = await createClient().auth.refreshSession();
      if (!data.session) failed = error ?? new Error("no session");
    } catch (error) {
      failed = error;
    }
    if (failed && passing(failed)) {
      window.setTimeout(attempt, 4000);
      return;
    }
    // Renewed – or the sign-in is gone for good (then the sign-in page takes over).
    holding = false;
    onlineManager.setOnline(navigator.onLine);
  };
  window.setTimeout(attempt, 4000);
}

/**
 * A fresh sign-in token: null if there's no sign-in at all (e.g. on the sign-in page).
 * Throws – as a network error, so it's tried again – if it couldn't be renewed just now.
 */
function renewToken(): Promise<string | null> {
  renewing ??= (async () => {
    try {
      const { data, error } = await createClient().auth.refreshSession();
      if (data.session) return data.session.access_token;
      if (error && passing(error)) {
        holdUntilSignedIn();
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
  if (!url.includes("/rest/v1/")) return vaultFetch(input, init);
  const headers = new Headers(init?.headers);
  const auth = headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  // No sign-in. (Whether one has run out is the server's to say – see the 401 below; the
  // device's clock may be off, and judging by it could renew the sign-in over and over.)
  if (!token || token === SUPABASE_PUBLISHABLE_KEY) {
    const fresh = await renewToken();
    if (fresh) {
      headers.set("Authorization", `Bearer ${fresh}`);
      init = { ...init, headers };
    }
  }
  const response = await vaultFetch(input, init);
  // The server says the sign-in has run out after all: wait for a fresh one, then try again.
  if (response.status === 401) {
    holdUntilSignedIn();
    throw new TypeError("Network error: the sign-in has run out – renewing it");
  }
  return response;
};
