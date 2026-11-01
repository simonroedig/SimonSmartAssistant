import { describe, expect, it } from "vitest";
import { isStreamLink, liveCheckFor, streamName, tiktokLiveFromJson, youtubeLiveFromHtml } from "./live";
import { parseMediaLine } from "./media";

describe("live checks", () => {
  it("knows which links are streams", () => {
    expect(isStreamLink("https://www.youtube.com/@News5de/live")).toBe(true);
    expect(isStreamLink("https://www.tiktok.com/@breakingnewsgermany2/live")).toBe(true);
    expect(isStreamLink("https://famelack.com/tv/de/95qUyvmztON27u")).toBe(false);
  });

  it("asks a YouTube channel's /live page, whatever form its link has", () => {
    for (const [link, url] of [
      ["https://www.youtube.com/@News5de/live", "https://www.youtube.com/@News5de/live"],
      ["https://youtube.com/@News5de", "https://www.youtube.com/@News5de/live"],
      ["https://www.youtube.com/c/AgendaFreeTV/live", "https://www.youtube.com/c/AgendaFreeTV/live"],
      ["https://www.youtube.com/WELTVideoTV/live", "https://www.youtube.com/WELTVideoTV/live"],
      ["https://m.youtube.com/channel/UC123abc/live", "https://www.youtube.com/channel/UC123abc/live"],
      ["https://www.youtube.com/watch?v=abcdEFGH123", "https://www.youtube.com/watch?v=abcdEFGH123"],
    ]) {
      expect(liveCheckFor(link)).toEqual({ platform: "youtube", url });
    }
    expect(liveCheckFor("https://www.youtube.com/results?search_query=x")).toBeNull();
    expect(liveCheckFor("https://www.youtube.com/shorts/abc")).toBeNull();
  });

  it("asks TikTok about the user, famelack about the page, nothing else", () => {
    expect(liveCheckFor("https://www.tiktok.com/@breakingnewsgermany2/live")).toEqual({
      platform: "tiktok",
      user: "breakingnewsgermany2",
    });
    expect(liveCheckFor("https://famelack.com/tv/de/95qUyvmztON27u")).toEqual({
      platform: "famelack",
      url: "https://famelack.com/tv/de/95qUyvmztON27u",
    });
    expect(liveCheckFor("https://example.com/live")).toBeNull();
    expect(liveCheckFor("javascript:alert(1)")).toBeNull();
  });

  it("reads a YouTube page: live, offline (the channel's page or an announced stream), or unknown", () => {
    const watch = (extra: string) =>
      `<html><link rel="canonical" href="https://www.youtube.com/watch?v=abc"><meta name="title" content="Breaking &amp; live">${extra}</html>`;
    expect(youtubeLiveFromHtml(watch('"liveBroadcastDetails":{"isLiveNow":true}'))).toEqual({
      state: "live",
      title: "Breaking & live",
    });
    expect(youtubeLiveFromHtml(watch('"isUpcoming":true'))).toEqual({ state: "offline" });
    expect(
      youtubeLiveFromHtml('<link rel="canonical" href="https://www.youtube.com/channel/UC123"><body>…</body>'),
    ).toEqual({ state: "offline" });
    expect(youtubeLiveFromHtml("<html>Before you continue to YouTube</html>")).toEqual({ state: "unknown" });
  });

  it("reads TikTok's answer", () => {
    expect(tiktokLiveFromJson({ data: { user: {}, liveRoom: { status: 2, title: "News now" } } })).toEqual({
      state: "live",
      title: "News now",
    });
    expect(tiktokLiveFromJson({ data: { user: {}, liveRoom: { status: 4 } } })).toEqual({ state: "offline" });
    expect(tiktokLiveFromJson({ data: { user: {} } })).toEqual({ state: "offline" });
    expect(tiktokLiveFromJson({ statusCode: 10222 })).toEqual({ state: "unknown" });
  });

  it("files YouTube and TikTok live links as streams, famelack as TV", () => {
    expect(parseMediaLine("https://www.youtube.com/@News5de/live")?.kind).toBe("stream");
    expect(parseMediaLine("https://www.tiktok.com/@breakingnewsgermany2/live")?.kind).toBe("stream");
    expect(parseMediaLine("ZDF https://famelack.com/tv/de/abc")?.kind).toBe("channel");
  });

  it("names a stream after its channel", () => {
    expect(streamName("https://www.youtube.com/@News5de/live")).toBe("News5de");
    expect(streamName("https://www.youtube.com/c/AgendaFreeTV/live")).toBe("AgendaFreeTV");
    expect(streamName("https://www.youtube.com/WELTVideoTV/live")).toBe("WELTVideoTV");
    expect(streamName("https://www.tiktok.com/@breakingnewsgermany2/live")).toBe("breakingnewsgermany2");
    expect(streamName("https://www.youtube.com/channel/UC123/live")).toBeNull();
  });
});
