import { describe, expect, it } from "vitest";
import {
  addDays,
  diffInDays,
  dueLabel,
  formatDayMonth,
  formatLongDate,
  formatTime,
  formatWeekdayShort,
  fromDayKey,
  isDayKey,
  isoWeek,
  relativeDayLabel,
  startOfWeek,
  toDayKey,
  weekDays,
  weekdayIndex,
} from "./date";

describe("day keys", () => {
  it("round-trips local dates", () => {
    expect(toDayKey(new Date(2026, 9, 6, 13, 10))).toBe("2026-10-06");
    expect(fromDayKey("2026-10-06").getDate()).toBe(6);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-10-06")).toBe(true);
  });

  it("adds days across month and DST boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    // DST ends in Germany on 2026-10-25.
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
    expect(diffInDays("2026-10-26", "2026-10-24")).toBe(2);
  });

  it("knows weeks start on Monday", () => {
    expect(weekdayIndex("2026-10-05")).toBe(0); // Monday
    expect(weekdayIndex("2026-10-11")).toBe(6); // Sunday
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05");
    expect(weekDays("2026-10-07")).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
  });

  it("computes ISO week numbers (KW)", () => {
    expect(isoWeek("2026-10-06")).toBe(41);
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(isoWeek("2024-12-30")).toBe(1);
  });
});

describe("German formatting", () => {
  const date = new Date(2026, 9, 6, 13, 10);

  it("formats the long date like 'Dienstag, 6. Oktober 2026'", () => {
    expect(formatLongDate(date)).toBe("Dienstag, 6. Oktober 2026");
  });

  it("formats times as 24h", () => {
    expect(formatTime(date)).toBe("13:10");
    expect(formatTime(new Date(2026, 9, 6, 7, 5))).toBe("07:05");
  });

  it("formats short weekdays without a period", () => {
    expect(formatWeekdayShort(date)).toBe("Di");
    expect(formatDayMonth(date)).toBe("6. Oktober");
  });

  it("labels relative days", () => {
    expect(relativeDayLabel("2026-10-06", "2026-10-06")).toBe("Today");
    expect(relativeDayLabel("2026-10-07", "2026-10-06")).toBe("Tomorrow");
    expect(relativeDayLabel("2026-10-05", "2026-10-06")).toBe("Yesterday");
    expect(relativeDayLabel("2026-10-09", "2026-10-06")).toBe("Freitag, 9. Oktober");
  });

  it("labels due dates with a tone", () => {
    expect(dueLabel("2026-10-03", "2026-10-06").tone).toBe("overdue");
    expect(dueLabel("2026-10-06", "2026-10-06")).toEqual({ text: "Today", tone: "today" });
    expect(dueLabel("2026-10-07", "2026-10-06")).toEqual({ text: "Tomorrow", tone: "soon" });
    expect(dueLabel("2026-10-30", "2026-10-06").tone).toBe("later");
  });
});
