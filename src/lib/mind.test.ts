import { describe, expect, it } from "vitest";
import { cardOfTheDay, dayShuffle, firstLink, plainCardText, styledParts, toMindRow, videoInfo, webLink } from "./mind";

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

  it("finds the ==highlighted== and *italic* parts, also mixed", () => {
    const plain = { mark: false, italic: false };
    expect(styledParts("Just take ==a step.== Now")).toEqual([
      { text: "Just take ", ...plain },
      { text: "a step.", mark: true, italic: false },
      { text: " Now", ...plain },
    ]);
    expect(styledParts("*Slowly*, then ==*all at once*==")).toEqual([
      { text: "Slowly", mark: false, italic: true },
      { text: ", then ", ...plain },
      { text: "all at once", mark: true, italic: true },
    ]);
    expect(styledParts("*a ==b== c*")).toEqual([
      { text: "a ", mark: false, italic: true },
      { text: "b", mark: true, italic: true },
      { text: " c", mark: false, italic: true },
    ]);
    // Stars inside a word or alone stay as they are, like a lone "==".
    for (const text of ["a == b", "Nobody cares a sh*t… and a sh*t!", "2 * 3 * 4", "**"]) {
      expect(styledParts(text)).toEqual([{ text, ...plain }]);
    }
    expect(plainCardText("==*Breathe*== in")).toBe("Breathe in");
  });

  it("picks the same card all day", () => {
    const cards = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(cardOfTheDay(cards, "2026-11-23")).toBe(cardOfTheDay([...cards].reverse(), "2026-11-23"));
    expect(cardOfTheDay([], "2026-11-23")).toBeNull();
    const days = new Set(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26"].map((d) => cardOfTheDay(cards, d)?.id));
    expect(days.size).toBeGreaterThan(1);
  });

  it("flips through today's card first, then all the others in a daily order", () => {
    const cards = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
    const order = dayShuffle(cards, "2026-11-23");
    expect(order[0]).toBe(cardOfTheDay(cards, "2026-11-23"));
    expect(new Set(order.map((c) => c.id))).toEqual(new Set(["a", "b", "c", "d", "e"]));
    expect(dayShuffle([...cards].reverse(), "2026-11-23")).toEqual(order);
    expect(dayShuffle([], "2026-11-23")).toEqual([]);
  });
});
