"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient, type Query } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";

export const QUERY_CACHE_KEY = "ssa:cache";
const CACHE_VERSION = "1";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 7 * 24 * 60 * 60_000,
        retry: 2,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: 1 },
    },
  });
}

const shouldPersist = (query: Query) => query.state.status === "success" && query.meta?.persist !== false;

/**
 * Data cache shared by the whole app. It is persisted to localStorage so the
 * dashboard opens instantly with the last known state (also offline) and then
 * refreshes in the background.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: QUERY_CACHE_KEY,
      throttleTime: 1500,
    }),
  );

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: 7 * 24 * 60 * 60_000,
        buster: CACHE_VERSION,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
      }}
      // Show the cached state instantly, then refresh everything in the background.
      onSuccess={() => client.invalidateQueries()}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

/** Removes every cached row from this device (used on sign-out). */
export function clearPersistedCache() {
  try {
    window.localStorage.removeItem(QUERY_CACHE_KEY);
  } catch {
    // ignore
  }
}
