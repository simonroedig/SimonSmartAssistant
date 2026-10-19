"use client";

import { type QueryKey } from "@tanstack/react-query";
import { type DayKey } from "@/lib/date";
import { PALETTE_COLORS } from "@/lib/palette";
import { createClient } from "@/lib/supabase/client";
import { type DayNote, newId, nowIso, type PlanBlock, queryKeys, useOptimisticMutation, useAppQuery } from "./core";

/** The colours a block can have – the shared palette. */
export const BLOCK_COLORS = PALETTE_COLORS;
export type BlockColor = (typeof BLOCK_COLORS)[number];

export async function fetchBlocks(from: DayKey, to: DayKey): Promise<PlanBlock[]> {
  const { data, error } = await createClient()
    .from("plan_blocks")
    .select("*")
    .gte("day", from)
    .lte("day", to)
    .order("day")
    .order("start_min");
  if (error) throw error;
  return data;
}

export function useBlocks(from: DayKey, to: DayKey) {
  return useAppQuery({
    queryKey: queryKeys.blockRange(from, to),
    queryFn: () => fetchBlocks(from, to),
  });
}

/** Blocks planned from backlog items, to show (and jump to) where an item is planned. */
export function useLinkedBlocks() {
  return useAppQuery({
    queryKey: ["plan_blocks", "linked"],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("plan_blocks")
        .select("*")
        .not("todo_id", "is", null)
        .order("day")
        .order("start_min");
      if (error) throw error;
      return data;
    },
  });
}

/** The block a backlog item is planned in: the next one that is not done, else the latest. */
export function plannedBlockByTodo(blocks: PlanBlock[] | undefined, today: DayKey | null): Map<string, PlanBlock> {
  const groups = new Map<string, PlanBlock[]>();
  for (const b of blocks ?? []) {
    if (b.todo_id) groups.set(b.todo_id, [...(groups.get(b.todo_id) ?? []), b]);
  }
  const order = (a: PlanBlock, b: PlanBlock) => a.day.localeCompare(b.day) || a.start_min - b.start_min;
  const map = new Map<string, PlanBlock>();
  for (const [todoId, list] of groups) {
    const upcoming = list.filter((b) => !b.done && (!today || b.day >= today)).sort(order);
    map.set(todoId, upcoming[0] ?? [...list].sort(order).at(-1)!);
  }
  return map;
}

/** Marks every block of a backlog item done (or open) when the item itself is ticked off. */
export function useSetTodoBlocksDone() {
  return useOptimisticMutation<{ todoId: string; done: boolean }>({
    table: "plan_blocks",
    queryKey: queryKeys.blocks,
    errorTitle: "Couldn't update the plan",
    mutationFn: async ({ todoId, done }) => {
      const { error } = await createClient().from("plan_blocks").update({ done }).eq("todo_id", todoId);
      if (error) throw error;
    },
    update: (data, { todoId, done }) => (data as PlanBlock[]).map((b) => (b.todo_id === todoId ? { ...b, done } : b)),
  });
}

function rangeOf(key: QueryKey): [DayKey, DayKey] {
  // ["plan_blocks", from, to], ["plan_blocks", "recent", since] or ["plan_blocks", "linked"]
  if (key[1] === "recent") return [key[2] as DayKey, "9999-12-31"];
  if (key[1] === "linked") return ["0000-01-01", "9999-12-31"];
  return [key[1] as DayKey, key[2] as DayKey];
}

/** Re-inserts `blocks` into a cached range list, keeping only those inside the range. */
function mergeIntoRange(list: PlanBlock[], blocks: PlanBlock[], key: QueryKey): PlanBlock[] {
  const [from, to] = rangeOf(key);
  const ids = new Set(blocks.map((b) => b.id));
  const kept = list.filter((b) => !ids.has(b.id));
  const added = blocks.filter((b) => b.day >= from && b.day <= to && (key[1] !== "linked" || b.todo_id !== null));
  return [...kept, ...added].sort((a, b) => a.day.localeCompare(b.day) || a.start_min - b.start_min);
}

export type BlockInput = Pick<PlanBlock, "day" | "start_min" | "end_min" | "title"> &
  Partial<Pick<PlanBlock, "color" | "notes" | "location" | "icon" | "todo_id" | "done">> & { id?: string };

export function prepareBlock(input: BlockInput): PlanBlock {
  const now = nowIso();
  return {
    id: input.id ?? newId(),
    day: input.day,
    start_min: input.start_min,
    end_min: input.end_min,
    title: input.title.trim(),
    color: input.color ?? "violet",
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
    icon: input.icon ?? null,
    todo_id: input.todo_id ?? null,
    done: input.done ?? false,
    created_at: now,
    updated_at: now,
    user_id: "",
  };
}

function toRow(block: PlanBlock) {
  const { id, day, start_min, end_min, title, color, notes, location, icon, todo_id, done } = block;
  return { id, day, start_min, end_min, title, color, notes, location, icon, todo_id, done };
}

export function useAddBlocks() {
  return useOptimisticMutation<{ blocks: PlanBlock[] }>({
    table: "plan_blocks",
    queryKey: queryKeys.blocks,
    errorTitle: "Couldn't save to your plan",
    mutationFn: async ({ blocks }) => {
      const { error } = await createClient().from("plan_blocks").upsert(blocks.map(toRow));
      if (error) throw error;
    },
    update: (data, { blocks }, key) => mergeIntoRange(data as PlanBlock[], blocks, key),
  });
}

export type BlockPatch = Partial<
  Pick<
    PlanBlock,
    "day" | "start_min" | "end_min" | "title" | "color" | "notes" | "location" | "icon" | "done" | "todo_id"
  >
>;

export function useUpdateBlock() {
  return useOptimisticMutation<{ block: PlanBlock; patch: BlockPatch }>({
    table: "plan_blocks",
    queryKey: queryKeys.blocks,
    errorTitle: "Couldn't update the block",
    mutationFn: async ({ block, patch }) => {
      const { error } = await createClient().from("plan_blocks").update(patch).eq("id", block.id);
      if (error) throw error;
    },
    update: (data, { block, patch }, key) =>
      mergeIntoRange(data as PlanBlock[], [{ ...block, ...patch, updated_at: nowIso() }], key),
  });
}

export function useDeleteBlocks() {
  return useOptimisticMutation<{ ids: string[] }>({
    table: "plan_blocks",
    queryKey: queryKeys.blocks,
    errorTitle: "Couldn't delete",
    mutationFn: async ({ ids }) => {
      if (ids.length === 0) return;
      const { error } = await createClient().from("plan_blocks").delete().in("id", ids);
      if (error) throw error;
    },
    update: (data, { ids }) => (data as PlanBlock[]).filter((b) => !ids.includes(b.id)),
  });
}

/** Recently used blocks (last ~2 months) – powers the "recent" title suggestions. */
export function useRecentBlocks(since: DayKey) {
  return useAppQuery({
    queryKey: ["plan_blocks", "recent", since],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("plan_blocks")
        .select("*")
        .gte("day", since)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

/** Copies blocks to another day (fresh ids, not done). */
export function copyBlocksToDay(blocks: PlanBlock[], day: DayKey): PlanBlock[] {
  return blocks.map((b) => prepareBlock({ ...b, id: newId(), day, done: false }));
}

// --- Focus of the day ---------------------------------------------------------

export function useDayNotes(from: DayKey, to: DayKey) {
  return useAppQuery({
    queryKey: queryKeys.dayNoteRange(from, to),
    queryFn: async () => {
      const { data, error } = await createClient().from("day_notes").select("*").gte("day", from).lte("day", to);
      if (error) throw error;
      return data;
    },
  });
}

export function useSetDayNote() {
  return useOptimisticMutation<{ day: DayKey; focus: string }>({
    table: "day_notes",
    queryKey: queryKeys.dayNotes,
    errorTitle: "Couldn't save your focus",
    mutationFn: async ({ day, focus }) => {
      const { error } = await createClient().from("day_notes").upsert({ day, focus }, { onConflict: "user_id,day" });
      if (error) throw error;
    },
    update: (data, { day, focus }, key) => {
      const [from, to] = rangeOf(key);
      const list = (data as DayNote[]).filter((n) => n.day !== day);
      if (day < from || day > to) return list;
      return [...list, { day, focus, updated_at: nowIso(), user_id: "" }];
    },
  });
}
