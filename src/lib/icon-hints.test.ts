import { describe, expect, it } from "vitest";
import { backupDue, DEFAULT_ICON_HINTS, hintCount, hintCountLabel, HINT_OFF, parseIconHints } from "./icon-hints";

describe("icon hints", () => {
  it("reads the chosen counts, falling back to the defaults", () => {
    expect(parseIconHints(null)).toEqual(DEFAULT_ICON_HINTS);
    expect(parseIconHints({ backlog: -1, shopping: 10 })).toEqual({ backlog: -1, shopping: 10 });
    expect(parseIconHints({ backlog: 4, shopping: "5" })).toEqual(DEFAULT_ICON_HINTS);
  });

  it("shows a count from the chosen number on – always, or never", () => {
    expect(hintCount(4, 5)).toBeUndefined();
    expect(hintCount(5, 5)).toBe(5);
    expect(hintCount(12, 5)).toBe(12);
    expect(hintCount(0, 0)).toBe(0);
    expect(hintCount(40, HINT_OFF)).toBeUndefined();
    expect(hintCountLabel(7)).toBe("7");
    expect(hintCountLabel(120)).toBe("99+");
  });

  it("asks for a backup when there was none, or after eight weeks", () => {
    const now = new Date("2026-11-23T12:00:00Z");
    expect(backupDue(null, now)).toBe(true);
    expect(backupDue("2026-10-01T12:00:00Z", now)).toBe(false);
    expect(backupDue("2026-09-20T12:00:00Z", now)).toBe(true);
  });
});
