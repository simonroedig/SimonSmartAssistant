import { describe, expect, it } from "vitest";
import { planDay, planDuration, plannedLabel, planStart, showTomorrowFirst } from "./plan-todo";
import { DEFAULT_SLEEP_SCHEDULE } from "./sleep";

// Wednesday 7 Oct 2026: up at 07:00, bed at 23:30. Saturday: up at 09:00.
const today = "2026-10-07";

describe("planning a backlog item", () => {
  it("uses the due date, or the viewed day, never the past", () => {
    expect(planDay({ due_date: "2026-10-10" }, today, today)).toBe("2026-10-10");
    expect(planDay({ due_date: null }, today, "2026-10-09")).toBe("2026-10-09");
    expect(planDay({ due_date: "2026-10-01" }, today, today)).toBe(today);
    expect(planDay({ due_date: null }, today, "2026-10-05")).toBe(today);
  });

  it("gives important items three hours, others one", () => {
    expect(planDuration({ starred: true })).toBe(180);
    expect(planDuration({ starred: false })).toBe(60);
  });

  it("starts at wake-up on that day, after what is already planned", () => {
    const base = { schedule: DEFAULT_SLEEP_SCHEDULE, today, nowMinute: 600, duration: 60, snap: 15 };
    expect(planStart({ ...base, day: "2026-10-10", blocks: [] })).toBe(540);
    expect(planStart({ ...base, day: "2026-10-08", blocks: [{ start_min: 420, end_min: 480 }] })).toBe(480);
    // Later today: not before now.
    expect(planStart({ ...base, day: today, blocks: [] })).toBe(600);
  });
});

describe("home screen in the evening", () => {
  it("switches to tomorrow three hours before bedtime when nothing is left", () => {
    expect(showTomorrowFirst(DEFAULT_SLEEP_SCHEDULE, today, 20 * 60, [])).toBe(false);
    expect(showTomorrowFirst(DEFAULT_SLEEP_SCHEDULE, today, 20 * 60 + 30, [])).toBe(true);
    expect(showTomorrowFirst(DEFAULT_SLEEP_SCHEDULE, today, 21 * 60, [{ start_min: 1260, end_min: 1350 }])).toBe(false);
    // A block that is already over does not hold it back.
    expect(showTomorrowFirst(DEFAULT_SLEEP_SCHEDULE, today, 22 * 60, [{ start_min: 1200, end_min: 1260 }])).toBe(true);
  });
});

describe("planned label", () => {
  it("says where an item is planned", () => {
    expect(plannedLabel({ day: today, start_min: 600 }, today)).toBe("Today 10:00");
    expect(plannedLabel({ day: "2026-10-08", start_min: 540 }, today)).toBe("Tomorrow 09:00");
    expect(plannedLabel({ day: "2026-10-09", start_min: 540 }, today)).toBe("Fri 09:00");
    expect(plannedLabel({ day: "2026-10-20", start_min: 840 }, today)).toBe("20 Oct 14:00");
  });
});
