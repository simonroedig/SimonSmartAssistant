import { describe, expect, it } from "vitest";
import { formatDuration, formatEndMinutes, formatMinutes, parseTime, snapMinutes } from "./time";

describe("time helpers", () => {
  it("formats minutes as HH:MM", () => {
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(450)).toBe("07:30");
    expect(formatMinutes(1470)).toBe("00:30");
    expect(formatEndMinutes(1440)).toBe("24:00");
  });

  it("parses user input", () => {
    expect(parseTime("7:30")).toBe(450);
    expect(parseTime("07.30")).toBe(450);
    expect(parseTime("24:00")).toBe(1440);
    expect(parseTime("24:30")).toBeNull();
    expect(parseTime("abc")).toBeNull();
  });

  it("snaps to the grid", () => {
    expect(snapMinutes(452, 15)).toBe(450);
    expect(snapMinutes(458, 15)).toBe(465);
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
  });
});
