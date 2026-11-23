"use client";

import { type MindInput, toMindRow } from "@/lib/mind";
import { createClient } from "@/lib/supabase/client";
import { type MindItem, nowIso, queryKeys, useAppQuery, useOptimisticMutation } from "./core";

/** Cards and videos, the newest first. */
export function useMind() {
  return useAppQuery({
    queryKey: queryKeys.mind,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("mind_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/** Adds one or several at once (cards get the next numbers). */
export function useAddMind() {
  return useOptimisticMutation<MindInput[]>({
    table: "mind_items",
    queryKey: queryKeys.mind,
    errorTitle: "Couldn't add it",
    mutationFn: async (inputs) => {
      const { error } = await createClient().from("mind_items").insert(inputs.map(toMindRow));
      if (error) throw error;
    },
    update: (data, inputs) => {
      const now = Date.now();
      const old = (data ?? []) as MindItem[];
      // Cards get the next numbers (the database counts the same way).
      let number = Math.max(0, ...old.map((m) => m.number ?? 0));
      const rows: MindItem[] = inputs.map((input, i) => {
        const at = new Date(now - i).toISOString();
        return {
          ...toMindRow(input),
          number: input.kind === "card" ? ++number : null,
          user_id: "",
          created_at: at,
          updated_at: at,
        };
      });
      return [...rows, ...old];
    },
  });
}

export type MindPatch = Partial<Pick<MindItem, "title" | "body" | "source" | "url">>;

export function useUpdateMind() {
  return useOptimisticMutation<{ id: string; patch: MindPatch }>({
    table: "mind_items",
    queryKey: queryKeys.mind,
    errorTitle: "Couldn't save it",
    mutationFn: async ({ id, patch }) => {
      const { error } = await createClient().from("mind_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    update: (data, { id, patch }) =>
      ((data ?? []) as MindItem[]).map((m) => (m.id === id ? { ...m, ...patch, updated_at: nowIso() } : m)),
  });
}

export function useDeleteMind() {
  return useOptimisticMutation<{ id: string }>({
    table: "mind_items",
    queryKey: queryKeys.mind,
    errorTitle: "Couldn't delete it",
    mutationFn: async ({ id }) => {
      const { error } = await createClient().from("mind_items").delete().eq("id", id);
      if (error) throw error;
    },
    update: (data, { id }) => ((data ?? []) as MindItem[]).filter((m) => m.id !== id),
  });
}
