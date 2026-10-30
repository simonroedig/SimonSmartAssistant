import { describe, expect, it } from "vitest";
import { moonIcon, moonLight, moonPhase } from "./moon";

describe("the moon", () => {
  it("knows the phase of known moons", () => {
    // Full moon 25 January 2024, 17:54 UTC; new moon 11 January 2024, 11:57 UTC.
    expect(moonPhase(new Date(Date.UTC(2024, 0, 25, 17, 54)))).toBeCloseTo(0.5, 1);
    expect(moonIcon(new Date(Date.UTC(2024, 0, 25, 22)))).toBe("moon-full");
    expect(moonIcon(new Date(Date.UTC(2024, 0, 11, 12)))).toBe("moon-new");
    // First quarter 18 January 2024, last quarter 2 February 2024.
    expect(moonIcon(new Date(Date.UTC(2024, 0, 18, 3)))).toBe("moon-first-quarter");
    expect(moonIcon(new Date(Date.UTC(2024, 1, 2, 23)))).toBe("moon-last-quarter");
    // In between: a waxing crescent a few days after new moon.
    expect(moonIcon(new Date(Date.UTC(2024, 0, 14, 12)))).toBe("moon-waxing-crescent");
  });

  it("lights the disc from none to all", () => {
    expect(moonLight(0)).toBeCloseTo(0);
    expect(moonLight(0.25)).toBeCloseTo(0.5);
    expect(moonLight(0.5)).toBeCloseTo(1);
  });
});
