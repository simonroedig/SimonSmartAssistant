"use client";

import { type QueryClient, type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Tables } from "@/lib/database.types";
import type { DayKey } from "@/lib/date";

export type ShoppingItem = Tables<"shopping_items">;
export type ShoppingHistoryEntry = Tables<"shopping_history">;
export type Todo = Tables<"todos">;
export type PlanBlock = Tables<"plan_blocks">;
export type DayNote = Tables<"day_notes">;
export type UserSettingsRow = Tables<"user_settings">;

/** Tables whose changes are streamed through Supabase Realtime. */
export type SyncedTable = "user_settings" | "shopping_items" | "todos" | "plan_blocks" | "day_notes";

export const queryKeys = {
  settings: ["user_settings"] as const,
  shopping: ["shopping_items"] as const,
  shoppingHistory: ["shopping_history"] as const,
  todos: ["todos"] as const,
  blocks: ["plan_blocks"] as const,
  blockRange: (from: DayKey, to: DayKey) => ["plan_blocks", from, to] as const,
  dayNotes: ["day_notes"] as const,
  dayNoteRange: (from: DayKey, to: DayKey) => ["day_notes", from, to] as const,
  weather: (lat: number, lon: number) => ["weather", lat.toFixed(3), lon.toFixed(3)] as const,
  air: (lat: number, lon: number) => ["air", lat.toFixed(3), lon.toFixed(3)] as const,
};

export function describeError(error: unknown): string {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return "You're offline – changes will sync when you're back.";
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Please try again.";
}

type Snapshot = [QueryKey, unknown][];

function restore(queryClient: QueryClient, snapshot: Snapshot | undefined) {
  snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

/**
 * Mutation with an optimistic cache update for every cached query under
 * `queryKey`. On error the previous state is restored and a toast explains
 * what happened. Realtime and the final refetch reconcile with the server.
 */
export function useOptimisticMutation<TVars>({
  table,
  queryKey,
  mutationFn,
  update,
  errorTitle,
  alsoInvalidate = [],
}: {
  table: string;
  queryKey: QueryKey;
  mutationFn: (vars: TVars) => Promise<void>;
  update: (data: unknown, vars: TVars, key: QueryKey) => unknown;
  errorTitle: string;
  alsoInvalidate?: QueryKey[];
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [table],
    mutationFn,
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey });
      const snapshot: Snapshot = queryClient.getQueriesData({ queryKey });
      for (const [key, data] of snapshot) {
        if (data !== undefined) queryClient.setQueryData(key, update(data, vars, key));
      }
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      restore(queryClient, context?.snapshot);
      toast.error(errorTitle, { description: describeError(error) });
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: [table] }) <= 1) {
        void queryClient.invalidateQueries({ queryKey });
        alsoInvalidate.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
      }
    },
  });
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
