"use client";

import { useSyncExternalStore } from "react";

/**
 * The open vault: the token of the last unlock (from `vault_unlock`), kept only
 * in memory – never stored. While it is set, requests to the database carry it
 * as `x-vault-token`, and the notes policies let vault notes through. Locking
 * just forgets it (the server's token runs out after 30 minutes anyway).
 */
type Unlock = { token: string; expiresAt: number };

let unlock: Unlock | null = null;
let expiry: ReturnType<typeof setTimeout> | undefined;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

export function openVault(token: string, expiresAt: string) {
  const at = new Date(expiresAt).getTime();
  unlock = { token, expiresAt: at };
  clearTimeout(expiry);
  // Shut a little before the server does, so no request goes out with a dead token.
  expiry = setTimeout(lockVault, Math.max(0, at - Date.now() - 30_000));
  notify();
}

export function lockVault() {
  if (!unlock) return;
  unlock = null;
  clearTimeout(expiry);
  notify();
}

export function isVaultOpen(): boolean {
  return unlock !== null && unlock.expiresAt > Date.now();
}

export function useVaultOpen(): boolean {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    isVaultOpen,
    () => false,
  );
}

/** `fetch` for the Supabase client: adds the vault token to database requests while it's open. */
export const vaultFetch: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!isVaultOpen() || !url.includes("/rest/v1/")) return fetch(input, init);
  const headers = new Headers(init?.headers);
  headers.set("x-vault-token", unlock!.token);
  return fetch(input, { ...init, headers });
};
