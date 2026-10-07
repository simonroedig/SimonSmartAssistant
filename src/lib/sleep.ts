import { addDays, type DayKey, toDayKey, weekdayIndex } from "@/lib/date";
import { MINUTES_PER_DAY, minutesOfDay } from "@/lib/time";

/**
 * Sleep schedule: one entry per weekday, Monday first. `wake` and `bed` are
 * minutes after midnight of that day; `bed` may exceed 1440 when going to bed
 * after midnight (e.g. 1470 = 00:30 the next morning).
 */
export type SleepDay = { wake: number; bed: number };
export type SleepSchedule = SleepDay[];
export type Range = [start: number, end: number];

export const DEFAULT_SLEEP_SCHEDULE: SleepSchedule = [
  { wake: 420, bed: 1410 },
  { wake: 420, bed: 1410 },
  { wake: 420, bed: 1410 },
  { wake: 420, bed: 1410 },
  { wake: 420, bed: 1470 },
  { wake: 540, bed: 1470 },
  { wake: 540, bed: 1410 },
];

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function isValidDay(value: unknown): value is SleepDay {
  if (!value || typeof value !== "object") return false;
  const { wake, bed } = value as Record<string, unknown>;
  return (
    typeof wake === "number" &&
    typeof bed === "number" &&
    wake >= 0 &&
    wake < MINUTES_PER_DAY &&
    bed > wake &&
    bed <= MINUTES_PER_DAY + 12 * 60
  );
}

export function normalizeSleepSchedule(value: unknown): SleepSchedule {
  if (!Array.isArray(value) || value.length !== 7) return DEFAULT_SLEEP_SCHEDULE;
  return value.map((day, i) => (isValidDay(day) ? { wake: day.wake, bed: day.bed } : DEFAULT_SLEEP_SCHEDULE[i]));
}

/**
 * Ranges of a given day that are spent asleep: the tail of the previous night
 * (from midnight, or from a post-midnight bedtime, until waking up) and the time
 * after going to bed that evening.
 */
export function sleepRangesForDay(schedule: SleepSchedule, day: DayKey): Range[] {
  const today = schedule[weekdayIndex(day)];
  const yesterday = schedule[weekdayIndex(addDays(day, -1))];
  const ranges: Range[] = [];

  const nightTailStart = Math.max(0, yesterday.bed - MINUTES_PER_DAY);
  if (nightTailStart < today.wake) ranges.push([nightTailStart, today.wake]);
  if (today.bed < MINUTES_PER_DAY) ranges.push([today.bed, MINUTES_PER_DAY]);

  return ranges;
}

/** The awake part of a day, e.g. [420, 1410]. */
export function awakeWindow(schedule: SleepSchedule, day: DayKey): Range {
  const today = schedule[weekdayIndex(day)];
  return [today.wake, Math.min(today.bed, MINUTES_PER_DAY)];
}

/** Whether the given moment falls into a sleep range. */
export function isAsleepAt(schedule: SleepSchedule, now: Date): boolean {
  const minutes = minutesOfDay(now);
  return sleepRangesForDay(schedule, toDayKey(now)).some(([s, e]) => minutes >= s && minutes < e);
}

export type HourSleep = {
  /** At least half of the hour is spent asleep. */
  asleep: boolean;
  /** Wake-up time (minutes) if it falls into this hour. */
  wake?: number;
  /** Bedtime (minutes after midnight of `day`) if it falls into this hour. */
  bed?: number;
};

/** Sleep information for the hour starting at `hour` on `day` (for hourly forecasts). */
export function hourSleep(schedule: SleepSchedule, day: DayKey, hour: number): HourSleep {
  const start = hour * 60;
  const end = start + 60;
  const asleepMinutes = sleepRangesForDay(schedule, day).reduce(
    (sum, [s, e]) => sum + Math.max(0, Math.min(e, end) - Math.max(s, start)),
    0,
  );
  const today = schedule[weekdayIndex(day)];
  const lateBed = schedule[weekdayIndex(addDays(day, -1))].bed - MINUTES_PER_DAY;
  const result: HourSleep = { asleep: asleepMinutes >= 30 };
  if (today.wake >= start && today.wake < end) result.wake = today.wake;
  if (today.bed >= start && today.bed < end) result.bed = today.bed;
  else if (lateBed > 0 && lateBed >= start && lateBed < end) result.bed = lateBed;
  return result;
}

/** Use the same wake/bed time for several weekdays at once. */
export function applyToDays(schedule: SleepSchedule, days: number[], patch: Partial<SleepDay>): SleepSchedule {
  return schedule.map((entry, i) => (days.includes(i) ? { ...entry, ...patch } : entry));
}

/** Returns the shared value of a group of days, or null when they differ. */
export function sharedDay(schedule: SleepSchedule, days: number[]): SleepDay | null {
  const first = schedule[days[0]];
  return days.every((d) => schedule[d].wake === first.wake && schedule[d].bed === first.bed) ? first : null;
}

export const WEEKDAYS = [0, 1, 2, 3, 4];
export const WEEKEND = [5, 6];
