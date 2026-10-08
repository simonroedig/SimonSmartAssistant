"use client";

import { byPosition } from "@/lib/ordering";
import { createClient } from "@/lib/supabase/client";
import {
  newId,
  nowIso,
  queryKeys,
  type ShoppingHistoryEntry,
  type ShoppingItem,
  useOptimisticMutation,
  useAppQuery,
} from "./core";

export function useShoppingItems() {
  return useAppQuery({
    queryKey: queryKeys.shopping,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("shopping_items")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Most used items first – powers the one-tap suggestions. */
export function useShoppingHistory() {
  return useAppQuery({
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

type AddInput = { name: string; note?: string | null; id?: string; position: number };

export function useAddShoppingItem() {
  return useOptimisticMutation<ReturnType<typeof prepareShoppingItem>>({
    table: "shopping_items",
    queryKey: queryKeys.shopping,
    errorTitle: "Couldn't add the item",
    alsoInvalidate: [queryKeys.shoppingHistory],
    mutationFn: async ({ id, name, note, position }) => {
      const { error } = await createClient().from("shopping_items").insert({ id, name, note, position });
      if (error) throw error;
    },
    update: (data, { id, name, note, position }) => {
      const now = nowIso();
      const item: ShoppingItem = {
        id,
        name,
        note,
        checked: false,
        checked_at: null,
        position,
        created_at: now,
        updated_at: now,
        user_id: "",
      };
      return [...(data as ShoppingItem[]), item].sort(byPosition);
    },
  });
}

export function prepareShoppingItem(input: AddInput) {
  return {
    id: input.id ?? newId(),
    name: input.name.trim(),
    note: input.note?.trim() || null,
    position: input.position,
  };
}

export function useUpdateShoppingItem() {
  return useOptimisticMutation<{
    id: string;
    patch: Partial<Pick<ShoppingItem, "name" | "note" | "checked" | "position">>;
  }>({
    table: "shopping_items",
    queryKey: queryKeys.shopping,
    errorTitle: "Couldn't update the item",
    mutationFn: async ({ id, patch }) => {
      const { error } = await createClient().from("shopping_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    update: (data, { id, patch }) =>
      (data as ShoppingItem[])
        .map((item) =>
          item.id === id
            ? {
                ...item,
                ...patch,
                checked_at: patch.checked === undefined ? item.checked_at : patch.checked ? nowIso() : null,
              }
            : item,
        )
        .sort(byPosition),
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
      const rows = items.map(({ id, name, note, checked, position, created_at }) => ({
        id,
        name,
        note,
        checked,
        position,
        created_at,
      }));
      const { error } = await createClient().from("shopping_items").upsert(rows);
      if (error) throw error;
    },
    update: (data, { items }) => {
      const existing = data as ShoppingItem[];
      const ids = new Set(existing.map((i) => i.id));
      return [...existing, ...items.filter((i) => !ids.has(i.id))].sort(byPosition);
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
