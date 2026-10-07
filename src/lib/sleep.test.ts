import { describe, expect, it } from "vitest";
import {
  DEFAULT_SLEEP_SCHEDULE,
  hourSleep,
  planSleepRanges,
  planViewEnd,
  applyToDays,
  awakeWindow,
  isAsleepAt,
  normalizeSleepSchedule,
  sharedDay,
  sleepRangesForDay,
  WEEKEND,
  type SleepSchedule,
} from "./sleep";

const schedule: SleepSchedule = [
  { wake: 420, bed: 1380 }, // Mon 07:00–23:00
  { wake: 420, bed: 1380 }, // Tue
  { wake: 420, bed: 1380 }, // Wed
  { wake: 420, bed: 1380 }, // Thu
  { wake: 420, bed: 1500 }, // Fri 07:00–01:00 (next day)
  { wake: 600, bed: 1530 }, // Sat 10:00–01:30
  { wake: 570, bed: 1350 }, // Sun 09:30–22:30
];

describe("sleep ranges", () => {
  it("shades the early morning and the late evening", () => {
    // Tuesday 2026-10-06
    expect(sleepRangesForDay(schedule, "2026-10-06")).toEqual([
      [0, 420],
      [1380, 1440],
    ]);
  });

  it("keeps the night awake when the previous bedtime is after midnight", () => {
    // Saturday 2026-10-10: Friday's bedtime is 01:00, Saturday wake 10:00, bed 01:30.
    expect(sleepRangesForDay(schedule, "2026-10-10")).toEqual([[60, 600]]);
    // Sunday 2026-10-11: Saturday bedtime 01:30.
    expect(sleepRangesForDay(schedule, "2026-10-11")).toEqual([
      [90, 570],
      [1350, 1440],
    ]);
  });

  it("returns the awake window", () => {
    expect(awakeWindow(schedule, "2026-10-06")).toEqual([420, 1380]);
    expect(awakeWindow(schedule, "2026-10-09")).toEqual([420, 1440]);
  });

  it("detects whether someone is asleep", () => {
    expect(isAsleepAt(schedule, new Date(2026, 9, 6, 3, 0))).toBe(true);
    expect(isAsleepAt(schedule, new Date(2026, 9, 6, 12, 0))).toBe(false);
    expect(isAsleepAt(schedule, new Date(2026, 9, 10, 0, 30))).toBe(false);
  });

  it("normalizes invalid data to defaults", () => {
    expect(normalizeSleepSchedule(null)).toEqual(DEFAULT_SLEEP_SCHEDULE);
    const broken = [...schedule.slice(0, 6), { wake: 900, bed: 100 }];
    expect(normalizeSleepSchedule(broken)[6]).toEqual(DEFAULT_SLEEP_SCHEDULE[6]);
  });

  it("edits groups of days", () => {
    const updated = applyToDays(schedule, WEEKEND, { wake: 480 });
    expect(updated[5].wake).toBe(480);
    expect(updated[6].wake).toBe(480);
    expect(updated[4].wake).toBe(420);
    expect(sharedDay(updated, WEEKEND)).toBeNull();
    expect(sharedDay(applyToDays(updated, WEEKEND, { bed: 1400 }), WEEKEND)).toEqual({ wake: 480, bed: 1400 });
  });
});

describe("sleep per forecast hour", () => {
  // Default schedule: weekdays up at 07:00, in bed at 23:30; Friday night until 00:30.
  it("marks sleeping hours, the wake-up hour and bedtime", () => {
    expect(hourSleep(DEFAULT_SLEEP_SCHEDULE, "2026-10-07", 5)).toEqual({ asleep: true });
    expect(hourSleep(DEFAULT_SLEEP_SCHEDULE, "2026-10-07", 7)).toEqual({ asleep: false, wake: 420 });
    expect(hourSleep(DEFAULT_SLEEP_SCHEDULE, "2026-10-07", 12)).toEqual({ asleep: false });
    expect(hourSleep(DEFAULT_SLEEP_SCHEDULE, "2026-10-07", 23)).toEqual({ asleep: true, bed: 1410 });
  });

  it("puts a bedtime after midnight on the next morning", () => {
    // Friday bed 00:30 → Saturday 00:00–01:00 shows the bedtime.
    expect(hourSleep(DEFAULT_SLEEP_SCHEDULE, "2026-10-10", 0)).toEqual({ asleep: true, bed: 30 });
    expect(hourSleep(DEFAULT_SLEEP_SCHEDULE, "2026-10-09", 23)).toEqual({ asleep: false });
  });
});

describe("sleep in the day plan", () => {
  it("shows a bedtime after midnight at the end of the same day", () => {
    // Friday: up 07:00, bed 00:30 (Saturday) – the Friday view runs to 02:00 and is shaded from 00:30.
    expect(planViewEnd(DEFAULT_SLEEP_SCHEDULE, "2026-10-09")).toBe(1560);
    expect(planSleepRanges(DEFAULT_SLEEP_SCHEDULE, "2026-10-09")).toEqual([
      [0, 420],
      [1470, 2160],
    ]);
  });

  it("ends at midnight when going to bed before", () => {
    expect(planViewEnd(DEFAULT_SLEEP_SCHEDULE, "2026-10-07")).toBe(1440);
    expect(planSleepRanges(DEFAULT_SLEEP_SCHEDULE, "2026-10-07")).toEqual([
      [0, 420],
      [1410, 2160],
    ]);
  });

  it("starts the next morning's sleep at the late bedtime", () => {
    // Saturday after a 00:30 bedtime: awake until 00:30, asleep until 09:00.
    expect(planSleepRanges(DEFAULT_SLEEP_SCHEDULE, "2026-10-10")[0]).toEqual([30, 540]);
  });
});
