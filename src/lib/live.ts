/**
 * Whether a stream is on air right now – read from the stream's own page, without
 * any account or key. Only YouTube, TikTok and famelack (TV) are asked, and only
 * from the server (see /api/media/live). Anything unclear is "unknown", never "live".
 */

export type LiveState = "live" | "offline" | "unknown";
export type LiveStatus = { state: LiveState; title?: string | null };

export type LiveCheck =
  /** `streams`: the channel's list of live streams – asked when its /live page can't tell. */
  | { platform: "youtube"; url: string; streams?: string }
  | { platform: "tiktok"; user: string }
  | { platform: "famelack"; url: string };

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com"]);
const FAMELACK_HOSTS = new Set(["famelack.com", "www.famelack.com"]);

/** Links that are a creator's stream (live now and then), not a TV channel. */
export function isStreamLink(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      YOUTUBE_HOSTS.has(host) ||
      host === "youtu.be" ||
      TIKTOK_HOSTS.has(host) ||
      /(^|\.)twitch\.tv$/.test(host) ||
      /(^|\.)kick\.com$/.test(host)
    );
  } catch {
    return false;
  }
}

/** What to ask to tell whether this link is on air – null if it can't be told. */
export function liveCheckFor(link: string): LiveCheck | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (YOUTUBE_HOSTS.has(host)) {
    // One video: is it live right now?
    if (parts[0] === "watch" && /^[\w-]{6,20}$/.test(url.searchParams.get("v") ?? "")) {
      return { platform: "youtube", url: `https://www.youtube.com/watch?v=${url.searchParams.get("v")}` };
    }
    // A channel (@name, /c/name, /channel/id, /user/name or the old /name): its /live page.
    let channel: string[] | null = null;
    if (parts[0]?.startsWith("@") && parts[0].length > 1) channel = [parts[0]];
    else if (["c", "channel", "user"].includes(parts[0] ?? "") && parts[1]) channel = parts.slice(0, 2);
    else if (parts.length === 1 || (parts.length === 2 && parts[1] === "live")) channel = [parts[0]];
    if (!channel || channel.some((p) => !/^@?[\w.%-]+$/.test(p))) return null;
    if (["watch", "shorts", "results", "playlist", "feed", "embed", "live"].includes(channel[0])) return null;
    const base = `https://www.youtube.com/${channel.join("/")}`;
    return { platform: "youtube", url: `${base}/live`, streams: `${base}/streams` };
  }

  if (TIKTOK_HOSTS.has(host)) {
    const user = parts[0]?.startsWith("@") ? parts[0].slice(1) : null;
    return user && /^[\w.]{1,40}$/.test(user) ? { platform: "tiktok", user } : null;
  }

  if (FAMELACK_HOSTS.has(host)) return { platform: "famelack", url: `https://famelack.com${url.pathname}` };
  return null;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * A YouTube /live (or watch) page: on air when it is a video page that says it is
 * live now. A channel's page instead (nothing on air) or an announced stream is
 * offline. A video page that doesn't say (YouTube often leaves that out for a server
 * asking) is unknown, with the video's id to look it up in the channel's streams.
 */
export function youtubeLiveFromHtml(html: string, now = Date.now()): LiveStatus & { videoId?: string } {
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
  if (!canonical) return { state: "unknown" };
  if (!/youtube\.com\/watch\?v=/.test(canonical)) {
    // The channel's own page: nothing live just now.
    return /youtube\.com\/(@|channel\/|c\/|user\/)/.test(canonical) ? { state: "offline" } : { state: "unknown" };
  }
  const videoId = canonical.match(/[?&]v=([\w-]{6,20})/)?.[1];
  const rawTitle = html.match(/<meta name="title" content="([^"]*)"/)?.[1] ?? null;
  const title = rawTitle ? decodeHtml(rawTitle) : null;
  // The player's own word, if it's there.
  if (/"isLiveNow":\s*true/.test(html)) return { state: "live", title };
  if (/"isLiveNow":\s*false/.test(html)) return { state: "offline" };
  if (/"isUpcoming":\s*true|"upcomingEventData"/.test(html)) return { state: "offline" };
  if (/"videoDetails":\{[^}]*"isLive":\s*true/.test(html)) return { state: "live", title };
  // The page's broadcast details: started and not ended is on air.
  if (/itemprop="isLiveBroadcast" content="True"/i.test(html)) {
    const start = Date.parse(html.match(/itemprop="startDate" content="([^"]+)"/)?.[1] ?? "");
    const ended = /itemprop="endDate"/.test(html);
    if (!ended && start <= now) return { state: "live", title };
    if (ended || start > now) return { state: "offline" };
  }
  return { state: "unknown", title, videoId };
}

/**
 * The channel's list of streams: is this video marked as live there (or announced)?
 * Only the part right after the video's id is read.
 */
export function youtubeLiveFromStreams(html: string, videoId: string, title?: string | null): LiveStatus {
  const at = html.indexOf(`"videoId":"${videoId}"`);
  if (at < 0) return { state: "unknown", title };
  // Up to the next video in the list.
  let end = Math.min(html.length, at + 8000);
  const ids = /"videoId":"([\w-]+)"/g;
  ids.lastIndex = at + 1;
  for (let m = ids.exec(html); m && m.index < end; m = ids.exec(html)) {
    if (m[1] !== videoId) {
      end = m.index;
      break;
    }
  }
  const part = html.slice(at, end);
  if (/"upcomingEventData"|"style":"UPCOMING"/.test(part)) return { state: "offline" };
  if (/"style":"LIVE"|BADGE_STYLE_TYPE_LIVE_NOW|"isLive":true/.test(part)) return { state: "live", title };
  return { state: "unknown", title };
}

/** TikTok's answer about a user's live room: status 2 is on air. */
export function tiktokLiveFromJson(json: unknown): LiveStatus {
  const data = (json as { data?: { liveRoom?: { status?: unknown; title?: unknown }; user?: unknown } })?.data;
  const status = data?.liveRoom?.status;
  if (typeof status !== "number") return data?.user ? { state: "offline" } : { state: "unknown" };
  if (status === 2) {
    const title = typeof data?.liveRoom?.title === "string" ? data.liveRoom.title.trim() : "";
    return { state: "live", title: title || null };
  }
  return { state: "offline" };
}

/** A stream's channel name from its link (@News5de → "News5de"), for naming it. */
export function streamName(link: string): string | null {
  try {
    const parts = new URL(link).pathname.split("/").filter(Boolean);
    const name = parts[0]?.startsWith("@")
      ? parts[0].slice(1)
      : ["c", "user"].includes(parts[0] ?? "")
        ? parts[1]
        : parts[0] && !["channel", "watch", "live"].includes(parts[0])
          ? parts[0]
          : null;
    return name ? decodeURIComponent(name) : null;
  } catch {
    return null;
  }
}
