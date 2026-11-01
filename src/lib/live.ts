/**
 * Whether a stream is on air right now – read from the stream's own page, without
 * any account or key. Only YouTube, TikTok and famelack (TV) are asked, and only
 * from the server (see /api/media/live). Anything unclear is "unknown", never "live".
 */

export type LiveState = "live" | "offline" | "unknown";
export type LiveStatus = { state: LiveState; title?: string | null };

export type LiveCheck =
  { platform: "youtube"; url: string } | { platform: "tiktok"; user: string } | { platform: "famelack"; url: string };

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
    return { platform: "youtube", url: `https://www.youtube.com/${channel.join("/")}/live` };
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
 * offline; anything else (a consent page, a changed layout) is unknown.
 */
export function youtubeLiveFromHtml(html: string): LiveStatus {
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
  if (!canonical) return { state: "unknown" };
  if (!/youtube\.com\/watch\?v=/.test(canonical)) {
    // The channel's own page: nothing live just now.
    return /youtube\.com\/(@|channel\/|c\/|user\/)/.test(canonical) ? { state: "offline" } : { state: "unknown" };
  }
  const title = html.match(/<meta name="title" content="([^"]*)"/)?.[1] ?? null;
  if (/"isLiveNow":\s*true/.test(html)) return { state: "live", title: title ? decodeHtml(title) : null };
  // A video page, but not live now: announced, or a past stream.
  return /"isLiveNow":\s*false|"isUpcoming":\s*true|"isLiveContent":\s*(true|false)/.test(html)
    ? { state: "offline" }
    : { state: "unknown" };
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
