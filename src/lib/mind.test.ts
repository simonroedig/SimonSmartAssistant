import { describe, expect, it } from "vitest";
import { cardOfTheDay, firstLink, markedParts, parseMindList, toMindRow, videoInfo, webLink } from "./mind";

describe("mind", () => {
  it("knows YouTube (with a still), TikTok and other links", () => {
    expect(videoInfo("https://youtu.be/abcDEF12345?si=abc")).toEqual({
      platform: "youtube",
      label: "YouTube",
      thumbnail: "https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg",
    });
    expect(videoInfo("https://www.youtube.com/watch?v=abcDEF12345&t=3").thumbnail).toContain("abcDEF12345");
    expect(videoInfo("https://m.youtube.com/shorts/abcdefghijk").thumbnail).toContain("abcdefghijk");
    expect(videoInfo("https://vm.tiktok.com/ZSexample1/")).toMatchObject({ platform: "tiktok", thumbnail: null });
    expect(videoInfo("https://vimeo.com/123").label).toBe("Vimeo");
    expect(videoInfo("not a link").platform).toBe("web");
  });

  it("only keeps web links", () => {
    expect(webLink(" https://example.com/a ")).toBe("https://example.com/a");
    expect(webLink("javascript:alert(1)")).toBeNull();
    expect(webLink("https://exa mple.com")).toBeNull();
    expect(firstLink("Look at this! https://vm.tiktok.com/ZSexample1/. So good")).toBe("https://vm.tiktok.com/ZSexample1/");
    expect(firstLink("no link here")).toBeNull();
    expect(toMindRow({ id: "1", kind: "card", title: " T ", body: "x\n", source: "", url: "https://a.b" }).url).toBeNull();
  });

  it("finds the ==marked== parts", () => {
    expect(markedParts("Just take ==a step.== Now")).toEqual([
      { text: "Just take ", mark: false },
      { text: "a step.", mark: true },
      { text: " Now", mark: false },
    ]);
    expect(markedParts("a == b")).toEqual([{ text: "a == b", mark: false }]);
  });

  it("picks the same card all day", () => {
    const cards = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(cardOfTheDay(cards, "2026-11-23")).toBe(cardOfTheDay([...cards].reverse(), "2026-11-23"));
    expect(cardOfTheDay([], "2026-11-23")).toBeNull();
    const days = new Set(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"].map((d) => cardOfTheDay(cards, d)?.id));
    expect(days.size).toBeGreaterThan(1);
  });

  it("reads a pasted list: title, text, who said it, links as videos", () => {
    const list = parseMindList(
      [
        "# Two ways to see it",
        "Plans change… 😔",
        "Plans change!!! 😄",
        "— A friend",
        "---",
        "Rest is part of the work.",
        "",
        "---",
        "# A calm view",
        "https://youtu.be/abcDEF12345",
        "---",
        "   ",
      ].join("\n"),
    );
    expect(list).toEqual([
      {
        kind: "card",
        title: "Two ways to see it",
        body: "Plans change… 😔\nPlans change!!! 😄",
        source: "A friend",
        url: null,
      },
      { kind: "card", title: "", body: "Rest is part of the work.", source: "", url: null },
      { kind: "video", title: "A calm view", body: "", source: "", url: "https://youtu.be/abcDEF12345" },
    ]);
  });
});
