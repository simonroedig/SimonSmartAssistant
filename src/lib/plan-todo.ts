import { type DayKey, diffInDays, formatDayMonthShort, formatWeekdayShort, fromDayKey, weekdayIndex } from "@/lib/date";
import { findFreeSlot } from "@/lib/planner-layout";
import type { SleepSchedule } from "@/lib/sleep";
import { formatMinutes, MINUTES_PER_DAY } from "@/lib/time";

type Timed = { start_min: number; end_min: number };

/** Important backlog items get a longer block. */
export function planDuration(todo: { starred: boolean }): number {
  return todo.starred ? 180 : 60;
}

/**
 * The day a backlog item is planned on: its due date ("Weekend" → Saturday,
 * "Next week" → Monday, a picked date …). Without one – or when it is already
 * overdue – the day you are looking at, but never a day in the past.
 */
export function planDay(todo: { due_date: DayKey | null }, today: DayKey, viewed: DayKey): DayKey {
  if (todo.due_date && todo.due_date >= today) return todo.due_date;
  return viewed >= today ? viewed : today;
}

/**
 * Start time for a planned backlog item: from waking up on that day (or from
 * now, if that is later today), the first gap that fits.
 */
export function planStart({
  schedule,
  day,
  today,
  nowMinute,
  blocks,
  duration,
  snap,
}: {
  schedule: SleepSchedule;
  day: DayKey;
  today: DayKey;
  nowMinute: number;
  blocks: Timed[];
  duration: number;
  snap: number;
}): number {
  const { wake, bed } = schedule[weekdayIndex(day)];
  const from = day === today ? Math.max(wake, Math.ceil(nowMinute / snap) * snap) : wake;
  const until = Math.min(MINUTES_PER_DAY, Math.max(bed, from + duration));
  return (
    findFreeSlot(blocks, duration, from, until, snap) ??
    findFreeSlot(blocks, duration, from, MINUTES_PER_DAY, snap) ??
    Math.min(from, MINUTES_PER_DAY - duration)
  );
}

/**
 * In the evening the home screen shows tomorrow: from three hours before
 * bedtime on, once nothing is left in today's plan.
 */
export function showTomorrowFirst(
  schedule: SleepSchedule,
  today: DayKey,
  nowMinute: number,
  todayBlocks: Timed[],
): boolean {
  const { bed } = schedule[weekdayIndex(today)];
  if (nowMinute < bed - 180) return false;
  return !todayBlocks.some((b) => b.end_min > nowMinute);
}

/** Where a backlog item is planned, e.g. "Today 10:00", "Fri 09:00", "12 Oct 14:00". */
export function plannedLabel(block: { day: DayKey; start_min: number }, today: DayKey): string {
  const diff = diffInDays(block.day, today);
  const date = fromDayKey(block.day);
  const day =
    diff === 0
      ? "Today"
      : diff === 1
        ? "Tomorrow"
        : diff === -1
          ? "Yesterday"
          : diff > 1 && diff < 7
            ? formatWeekdayShort(date)
            : formatDayMonthShort(date);
  return `${day} ${formatMinutes(block.start_min)}`;
}
