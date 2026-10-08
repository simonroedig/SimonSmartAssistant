"use client";

import {
  type DefaultError,
  type QueryClient,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useHydrated } from "@/hooks/use-hydrated";
import type { Tables } from "@/lib/database.types";
import type { DayKey } from "@/lib/date";

export type ShoppingItem = Tables<"shopping_items">;
export type ShoppingHistoryEntry = Tables<"shopping_history">;
export type Todo = Tables<"todos">;
export type PlanBlock = Tables<"plan_blocks">;
export type DayNote = Tables<"day_notes">;
export type Note = Tables<"notes">;
export type UserSettingsRow = Tables<"user_settings">;

/** Tables whose changes are streamed through Supabase Realtime. */
export type SyncedTable = "user_settings" | "shopping_items" | "todos" | "plan_blocks" | "day_notes" | "notes";

export const queryKeys = {
  settings: ["user_settings"] as const,
  shopping: ["shopping_items"] as const,
  shoppingHistory: ["shopping_history"] as const,
  todos: ["todos"] as const,
  blocks: ["plan_blocks"] as const,
  blockRange: (from: DayKey, to: DayKey) => ["plan_blocks", from, to] as const,
  dayNotes: ["day_notes"] as const,
  dayNoteRange: (from: DayKey, to: DayKey) => ["day_notes", from, to] as const,
  notes: ["notes"] as const,
  weather: (lat: number, lon: number) => ["weather", lat.toFixed(3), lon.toFixed(3)] as const,
  air: (lat: number, lon: number) => ["air", lat.toFixed(3), lon.toFixed(3)] as const,
};

/**
 * `useQuery` that has no data until the page is hydrated. The server never has
 * data, but the browser may already have restored its cache by the time a page
 * hydrates – rendering that would not match the server's HTML.
 */
export function useAppQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>): UseQueryResult<TData, TError> {
  const result = useQuery(options);
  const hydrated = useHydrated();
  if (hydrated) return result;
  return {
    ...result,
    data: undefined,
    status: "pending",
    isPending: true,
    isLoading: true,
    isSuccess: false,
    isError: false,
    error: null,
  } as UseQueryResult<TData, TError>;
}

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
