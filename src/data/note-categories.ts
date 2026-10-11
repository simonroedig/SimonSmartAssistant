"use client";

import { createClient } from "@/lib/supabase/client";
import { isPaletteColor, type PaletteColor } from "@/lib/palette";
import { type NoteCategory, nowIso, queryKeys, useAppQuery, useOptimisticMutation } from "./core";

/** A category's colour (one of the planner's); an unknown one shows as light blue. */
export function categoryColor(category: Pick<NoteCategory, "color">): PaletteColor {
  return isPaletteColor(category.color) ? category.color : "sky";
}

/** The user's note categories, oldest first. */
export function useNoteCategories() {
  return useAppQuery({
    queryKey: queryKeys.noteCategories,
    queryFn: async () => {
      const { data, error } = await createClient().from("note_categories").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export type CategoryInput = { id: string; name: string; color: PaletteColor; isNew: boolean };

export function useSaveCategory() {
  return useOptimisticMutation<CategoryInput>({
    table: "note_categories",
    queryKey: queryKeys.noteCategories,
    errorTitle: "Couldn't save the category",
    mutationFn: async ({ id, name, color, isNew }) => {
      const row = { name: name.trim(), color };
      const { error } = isNew
        ? await createClient()
            .from("note_categories")
            .insert({ ...row, id })
        : await createClient().from("note_categories").update(row).eq("id", id);
      if (error) throw error;
    },
    update: (data, { id, name, color, isNew }) => {
      const list = (data ?? []) as NoteCategory[];
      if (!isNew) return list.map((c) => (c.id === id ? { ...c, name: name.trim(), color } : c));
      const now = nowIso();
      return [...list, { id, name: name.trim(), color, created_at: now, updated_at: now, user_id: "" }];
    },
  });
}

/** Deletes a category; its notes stay, without one. */
export function useDeleteCategory() {
  return useOptimisticMutation<{ id: string }>({
    table: "note_categories",
    queryKey: queryKeys.noteCategories,
    errorTitle: "Couldn't delete the category",
    mutationFn: async ({ id }) => {
      const { error } = await createClient().from("note_categories").delete().eq("id", id);
      if (error) throw error;
    },
    update: (data, { id }) => ((data ?? []) as NoteCategory[]).filter((c) => c.id !== id),
    alsoInvalidate: [queryKeys.notes],
  });
}
