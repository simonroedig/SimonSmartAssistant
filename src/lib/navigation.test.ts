import { describe, expect, it } from "vitest";
import { DEFAULT_NAVIGATION, navigationFromCookie, parseNavigation, phoneTabs, railItems, swap } from "./navigation";

describe("navigation order", () => {
  it("puts Home in the middle of the tab bar by default", () => {
    expect(phoneTabs(DEFAULT_NAVIGATION)).toEqual(["shopping", "backlog", "home", "planner", "notes"]);
    expect(railItems(DEFAULT_NAVIGATION)).toEqual(["home", "planner", "shopping", "backlog", "notes", "weather"]);
  });

  it("or on the left", () => {
    expect(phoneTabs({ ...DEFAULT_NAVIGATION, phoneHome: "left" })).toEqual([
      "home",
      "shopping",
      "backlog",
      "planner",
      "notes",
    ]);
  });

  it("swaps two sections", () => {
    expect(swap(["planner", "shopping", "backlog", "notes"], "planner", "notes")).toEqual([
      "notes",
      "shopping",
      "backlog",
      "planner",
    ]);
  });

  it("falls back to the default for anything that isn't a full order", () => {
    expect(parseNavigation(null)).toEqual(DEFAULT_NAVIGATION);
    expect(parseNavigation({ phone: ["planner", "planner", "notes", "backlog"], rail: ["weather"] })).toEqual(
      DEFAULT_NAVIGATION,
    );
    expect(parseNavigation({ phone: ["notes", "planner", "backlog", "shopping"], phoneHome: "left" })).toEqual({
      ...DEFAULT_NAVIGATION,
      phone: ["notes", "planner", "backlog", "shopping"],
      phoneHome: "left",
    });
  });

  it("floats the menu unless it is attached", () => {
    expect(parseNavigation({}).style).toBe("floating");
    expect(parseNavigation({ style: "attached" }).style).toBe("attached");
    expect(parseNavigation({ style: "glued" }).style).toBe("floating");
  });

  it("reads the cookie, encoded or not", () => {
    const nav = { ...DEFAULT_NAVIGATION, phoneHome: "left" as const };
    expect(navigationFromCookie(JSON.stringify(nav))).toEqual(nav);
    expect(navigationFromCookie(encodeURIComponent(JSON.stringify(nav)))).toEqual(nav);
    expect(navigationFromCookie("%E0%A4%A")).toEqual(DEFAULT_NAVIGATION);
    expect(navigationFromCookie(undefined)).toEqual(DEFAULT_NAVIGATION);
  });
});
