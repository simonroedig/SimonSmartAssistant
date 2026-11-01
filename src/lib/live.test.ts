import { describe, expect, it } from "vitest";
import {
  isStreamLink,
  liveCheckFor,
  streamName,
  tiktokLiveFromJson,
  youtubeLiveFromHtml,
  youtubeLiveFromStreams,
} from "./live";
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
      expect(liveCheckFor(link)).toMatchObject({ platform: "youtube", url });
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
      `<html><link rel="canonical" href="https://www.youtube.com/watch?v=abc123"><meta name="title" content="Breaking &amp; live">${extra}</html>`;
    expect(youtubeLiveFromHtml(watch('"liveBroadcastDetails":{"isLiveNow":true}'))).toEqual({
      state: "live",
      title: "Breaking & live",
    });
    expect(youtubeLiveFromHtml(watch('"isUpcoming":true'))).toEqual({ state: "offline" });
    expect(
      youtubeLiveFromHtml('<link rel="canonical" href="https://www.youtube.com/channel/UC123"><body>…</body>'),
    ).toEqual({ state: "offline" });
    expect(youtubeLiveFromHtml("<html>Before you continue to YouTube</html>")).toEqual({ state: "unknown" });
    // The broadcast details when the player's are left out: started and not ended.
    const broadcast = (dates: string) => watch(`<meta itemprop="isLiveBroadcast" content="True">${dates}`);
    const now = Date.parse("2026-11-01T20:00:00Z");
    expect(
      youtubeLiveFromHtml(broadcast('<meta itemprop="startDate" content="2026-11-01T18:00:00+00:00">'), now).state,
    ).toBe("live");
    expect(
      youtubeLiveFromHtml(broadcast('<meta itemprop="startDate" content="2026-11-02T18:00:00+00:00">'), now).state,
    ).toBe("offline");
    expect(
      youtubeLiveFromHtml(
        broadcast(
          '<meta itemprop="startDate" content="2026-11-01T18:00:00+00:00"><meta itemprop="endDate" content="x">',
        ),
        now,
      ).state,
    ).toBe("offline");
    // Nothing said at all: unknown – with the video, to look it up in the channel's streams.
    expect(youtubeLiveFromHtml(watch('"playabilityStatus":{"status":"LOGIN_REQUIRED"}'))).toMatchObject({
      state: "unknown",
      videoId: "abc123",
    });
  });

  it("finds the video in the channel's streams: live, announced, or can't tell", () => {
    const item = (id: string, extra: string) => `{"videoId":"${id}","title":"x",${extra},"videoId":"${id}"}`;
    const list = (a: string, b: string) => `[${item("other1", b)},${item("abc123", a)},${item("other2", b)}]`;
    expect(youtubeLiveFromStreams(list('"style":"LIVE"', '"style":"DEFAULT"'), "abc123", "T")).toEqual({
      state: "live",
      title: "T",
    });
    expect(youtubeLiveFromStreams(list('"upcomingEventData":{}', '"style":"LIVE"'), "abc123").state).toBe("offline");
    // Another video's badge is not this one's.
    expect(youtubeLiveFromStreams(list('"style":"DEFAULT"', '"style":"LIVE"'), "abc123").state).toBe("unknown");
    expect(youtubeLiveFromStreams("[]", "abc123").state).toBe("unknown");
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
