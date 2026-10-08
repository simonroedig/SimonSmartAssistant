"use client";

import { createClient } from "@/lib/supabase/client";
import { type Birthday, nowIso, queryKeys, useAppQuery, useOptimisticMutation } from "./core";

/** In calendar order (January first), then by name. */
export function sortBirthdays(list: Birthday[]): Birthday[] {
  return [...list].sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name));
}

export function useBirthdays() {
  return useAppQuery({
    queryKey: queryKeys.birthdays,
    queryFn: async () => {
      const { data, error } = await createClient().from("birthdays").select("*");
      if (error) throw error;
      return sortBirthdays(data);
    },
    staleTime: 5 * 60_000,
  });
}

export type BirthdayInput = { name: string; day: number; month: number; year: number | null };

/** Adds (`isNew`) or changes a birthday; new ones get their id up front (see `newId`). */
export function useSaveBirthday() {
  return useOptimisticMutation<BirthdayInput & { id: string; isNew: boolean }>({
    table: "birthdays",
    queryKey: queryKeys.birthdays,
    errorTitle: "Couldn't save the birthday",
    mutationFn: async ({ id, isNew, name, day, month, year }) => {
      const row = { name: name.trim(), day, month, year };
      const { error } = isNew
        ? await createClient()
            .from("birthdays")
            .insert({ ...row, id })
        : await createClient().from("birthdays").update(row).eq("id", id);
      if (error) throw error;
    },
    update: (data, { id, isNew, name, day, month, year }) => {
      const list = (data ?? []) as Birthday[];
      const fields = { name: name.trim(), day, month, year };
      if (!isNew) return sortBirthdays(list.map((b) => (b.id === id ? { ...b, ...fields } : b)));
      const now = nowIso();
      return sortBirthdays([...list, { id, ...fields, created_at: now, updated_at: now, user_id: "" }]);
    },
  });
}

export function useDeleteBirthday() {
  return useOptimisticMutation<{ id: string }>({
    table: "birthdays",
    queryKey: queryKeys.birthdays,
    errorTitle: "Couldn't delete the birthday",
    mutationFn: async ({ id }) => {
      const { error } = await createClient().from("birthdays").delete().eq("id", id);
      if (error) throw error;
    },
    update: (data, { id }) => ((data ?? []) as Birthday[]).filter((b) => b.id !== id),
  });
}
