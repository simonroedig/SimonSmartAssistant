"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { newId, nowIso, queryKeys, type ShoppingHistoryEntry, type ShoppingItem, useOptimisticMutation } from "./core";

export function useShoppingItems() {
  return useQuery({
    queryKey: queryKeys.shopping,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("shopping_items")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Most used items first – powers the one-tap suggestions. */
export function useShoppingHistory() {
  return useQuery({
    queryKey: queryKeys.shoppingHistory,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("shopping_history")
        .select("*")
        .order("use_count", { ascending: false })
        .order("last_used_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

type AddInput = { name: string; note?: string | null; id?: string };

export function useAddShoppingItem() {
  return useOptimisticMutation<Required<Pick<AddInput, "id" | "name">> & { note: string | null }>({
    table: "shopping_items",
    queryKey: queryKeys.shopping,
    errorTitle: "Couldn't add the item",
    alsoInvalidate: [queryKeys.shoppingHistory],
    mutationFn: async ({ id, name, note }) => {
      const { error } = await createClient().from("shopping_items").insert({ id, name, note });
      if (error) throw error;
    },
    update: (data, { id, name, note }) => {
      const now = nowIso();
      const item: ShoppingItem = {
        id,
        name,
        note,
        checked: false,
        checked_at: null,
        created_at: now,
        updated_at: now,
        user_id: "",
      };
      return [...(data as ShoppingItem[]), item];
    },
  });
}

export function prepareShoppingItem(input: AddInput) {
  return { id: input.id ?? newId(), name: input.name.trim(), note: input.note?.trim() || null };
}

export function useUpdateShoppingItem() {
  return useOptimisticMutation<{ id: string; patch: Partial<Pick<ShoppingItem, "name" | "note" | "checked">> }>({
    table: "shopping_items",
    queryKey: queryKeys.shopping,
    errorTitle: "Couldn't update the item",
    mutationFn: async ({ id, patch }) => {
      const { error } = await createClient().from("shopping_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    update: (data, { id, patch }) =>
      (data as ShoppingItem[]).map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              checked_at: patch.checked === undefined ? item.checked_at : patch.checked ? nowIso() : null,
            }
          : item,
      ),
  });
}

export function useDeleteShoppingItems() {
  return useOptimisticMutation<{ ids: string[] }>({
    table: "shopping_items",
    queryKey: queryKeys.shopping,
    errorTitle: "Couldn't delete",
    mutationFn: async ({ ids }) => {
      if (ids.length === 0) return;
      const { error } = await createClient().from("shopping_items").delete().in("id", ids);
      if (error) throw error;
    },
    update: (data, { ids }) => (data as ShoppingItem[]).filter((item) => !ids.includes(item.id)),
  });
}

/** Puts deleted items back (used by "Undo"). Keeps created_at, so suggestions are not counted twice. */
export function useRestoreShoppingItems() {
  return useOptimisticMutation<{ items: ShoppingItem[] }>({
    table: "shopping_items",
    queryKey: queryKeys.shopping,
    errorTitle: "Couldn't restore",
    mutationFn: async ({ items }) => {
      const rows = items.map(({ id, name, note, checked, created_at }) => ({ id, name, note, checked, created_at }));
      const { error } = await createClient().from("shopping_items").upsert(rows);
      if (error) throw error;
    },
    update: (data, { items }) => {
      const existing = data as ShoppingItem[];
      const ids = new Set(existing.map((i) => i.id));
      return [...existing, ...items.filter((i) => !ids.has(i.id))].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      );
    },
  });
}

export function useForgetSuggestion() {
  return useOptimisticMutation<{ nameKey: string }>({
    table: "shopping_history",
    queryKey: queryKeys.shoppingHistory,
    errorTitle: "Couldn't remove the suggestion",
    mutationFn: async ({ nameKey }) => {
      const { error } = await createClient().from("shopping_history").delete().eq("name_key", nameKey);
      if (error) throw error;
    },
    update: (data, { nameKey }) => (data as ShoppingHistoryEntry[]).filter((e) => e.name_key !== nameKey),
  });
}
