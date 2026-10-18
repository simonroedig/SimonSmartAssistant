"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { PlanBlock } from "@/data/core";
import {
  copyBlocksToDay,
  prepareBlock,
  useAddBlocks,
  useBlocks,
  useDeleteBlocks,
  useRecentBlocks,
  useUpdateBlock,
} from "@/data/planner";
import { useSettings } from "@/data/settings";
import { useUpdateTodo } from "@/data/todos";
import { addDays, type DayKey, formatDayMonth, fromDayKey, relativeDayLabel, toDayKey, weekDays } from "@/lib/date";
import { findFreeSlot } from "@/lib/planner-layout";
import { awakeWindow, planSleepRanges, planViewEnd } from "@/lib/sleep";
import { formatEndMinutes, formatMinutes, MINUTES_PER_DAY, minutesOfDay } from "@/lib/time";
import { TOAST_TONE } from "@/lib/tones";
import type { BlockDraft, EditorState } from "./block-editor";

/** Everything the planner UIs (full page and dashboard card) need for one day. */
export function usePlanner(day: DayKey) {
  const { settings, isLoading: settingsLoading } = useSettings();
  const week = useMemo(() => weekDays(day), [day]);
  const blocksQuery = useBlocks(week[0], week[6]);
  const recentQuery = useRecentBlocks(addDays(day, -60));
  const add = useAddBlocks();
  const update = useUpdateBlock();
  const remove = useDeleteBlocks();
  const updateTodo = useUpdateTodo();
  const [editor, setEditor] = useState<EditorState | null>(null);

  const weekBlocks = useMemo(() => blocksQuery.data ?? [], [blocksQuery.data]);
  const dayBlocks = useMemo(() => weekBlocks.filter((b) => b.day === day), [weekBlocks, day]);
  const sleepRanges = useMemo(() => planSleepRanges(settings.sleepSchedule, day), [settings.sleepSchedule, day]);
  /** The plan view runs past midnight when bedtime is after midnight. */
  const viewEnd = planViewEnd(settings.sleepSchedule, day);
  const awake = useMemo(() => awakeWindow(settings.sleepSchedule, day), [settings.sleepSchedule, day]);
  const { snap, defaultDuration } = settings.planner;

  const createAt = (minute: number, extra?: Partial<Extract<EditorState, { mode: "create" }>>) => {
    setEditor({
      mode: "create",
      day,
      start: minute,
      end: Math.min(MINUTES_PER_DAY, minute + defaultDuration),
      ...extra,
    });
  };

  /** Opens the editor at the next free slot (after now for today, after waking up otherwise). */
  const createAtNextFree = (extra?: Partial<Extract<EditorState, { mode: "create" }>>) => {
    const isToday = day === toDayKey(new Date());
    const from = isToday ? Math.max(awake[0], Math.ceil(minutesOfDay(new Date()) / snap) * snap) : awake[0];
    const slot =
      findFreeSlot(dayBlocks, defaultDuration, from, Math.max(awake[1], from + defaultDuration), snap) ??
      findFreeSlot(dayBlocks, 30, from, MINUTES_PER_DAY, snap) ??
      Math.min(from, MINUTES_PER_DAY - defaultDuration);
    createAt(slot, extra);
  };

  const changeTime = (block: PlanBlock, start: number, end: number) => {
    update.mutate({ block, patch: { start_min: start, end_min: end } });
  };

  const toggleDone = (block: PlanBlock) => {
    const done = !block.done;
    update.mutate({ block, patch: { done } });
    if (block.todo_id) updateTodo.mutate({ id: block.todo_id, patch: { done } });
  };

  const deleteBlock = (block: PlanBlock) => {
    remove.mutate({ ids: [block.id] });
    toast(`Removed "${block.title}"`, {
      action: { label: "Undo", onClick: () => add.mutate({ blocks: [block] }) },
      classNames: { toast: TOAST_TONE.rose },
      duration: 6000,
    });
  };

  const copyTo = (blocks: PlanBlock[], target: DayKey) => {
    if (blocks.length === 0) return;
    add.mutate({ blocks: copyBlocksToDay(blocks, target) });
    toast(
      blocks.length === 1
        ? `Copied "${blocks[0].title}" to ${relativeDayLabel(target, toDayKey(new Date()))}`
        : `Copied ${blocks.length} blocks to ${formatDayMonth(fromDayKey(target))}`,
    );
  };

  const clearDay = () => {
    if (dayBlocks.length === 0) return;
    const removed = dayBlocks;
    remove.mutate({ ids: removed.map((b) => b.id) });
    toast(`Cleared ${removed.length} ${removed.length === 1 ? "block" : "blocks"}`, {
      action: { label: "Undo", onClick: () => add.mutate({ blocks: removed }) },
      classNames: { toast: TOAST_TONE.rose },
      duration: 8000,
    });
  };

  const editorProps = {
    state: editor,
    onClose: () => setEditor(null),
    recent: recentQuery.data ?? weekBlocks,
    snap,
    onCreate: (draft: BlockDraft) => {
      add.mutate({ blocks: [prepareBlock(draft)] });
    },
    onSave: (block: PlanBlock, draft: BlockDraft) => {
      update.mutate({ block, patch: draft });
      if (block.todo_id && draft.done !== block.done) {
        updateTodo.mutate({ id: block.todo_id, patch: { done: draft.done } });
      }
    },
    onDelete: deleteBlock,
    onCopyTo: (block: PlanBlock, target: DayKey) => copyTo([block], target),
    // "Full day": from waking up to bedtime of that day.
    awakeFor: (target: DayKey) => awakeWindow(settings.sleepSchedule, target),
  };

  const draftPreview =
    editor?.mode === "create" && editor.day === day ? { start: editor.start, end: editor.end } : null;

  return {
    settings,
    isLoading: settingsLoading || blocksQuery.isLoading,
    week,
    weekBlocks,
    dayBlocks,
    sleepRanges,
    viewEnd,
    awake,
    snap,
    editor,
    setEditor,
    createAt,
    createAtNextFree,
    changeTime,
    toggleDone,
    copyTo,
    clearDay,
    editorProps,
    draftPreview,
  };
}

export type NowNext = {
  current: PlanBlock | null;
  next: PlanBlock | null;
  freeUntil: number | null;
};

export function nowAndNext(blocks: PlanBlock[], minute: number): NowNext {
  const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min);
  const current = sorted.find((b) => b.start_min <= minute && minute < b.end_min && !b.done) ?? null;
  // Ticked off ahead of time: nothing left to look forward to.
  const next = sorted.find((b) => b.start_min > minute && !b.done) ?? null;
  return { current, next, freeUntil: current ? null : (next?.start_min ?? null) };
}

export function describeSlot(block: PlanBlock): string {
  return `${formatMinutes(block.start_min)} – ${formatEndMinutes(block.end_min)}`;
}
