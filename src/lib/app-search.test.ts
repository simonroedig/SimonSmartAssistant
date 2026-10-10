import { describe, expect, it } from "vitest";
import { rankApps } from "./app-search";

const apps = ["Xodo", "Box", "Firefox", "X", "Excel", "Max Mobil", "Fox News"].map((label) => ({ label }));

describe("rankApps", () => {
  it("puts the exact name first, then names and words starting with the term", () => {
    expect(rankApps(apps, "x").map((a) => a.label)).toEqual([
      "X",
      "Xodo",
      "Box",
      "Excel",
      "Firefox",
      "Fox News",
      "Max Mobil",
    ]);
  });

  it("finds a word inside the name", () => {
    expect(rankApps(apps, "mob").map((a) => a.label)).toEqual(["Max Mobil"]);
    expect(rankApps(apps, "fox").map((a) => a.label)).toEqual(["Fox News", "Firefox"]);
  });
});
