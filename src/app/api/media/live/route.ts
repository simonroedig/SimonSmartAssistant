import { isEmailAllowed } from "@/lib/auth/allowlist";
import {
  liveCheckFor,
  type LiveCheck,
  type LiveStatus,
  tiktokLiveFromJson,
  youtubeLiveFromHtml,
  youtubeLiveFromStreams,
} from "@/lib/live";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Asked at most every few minutes per stream, however many screens show it. */
const FRESH_MS = 3 * 60_000;
const MAX_BYTES = 3 * 1024 * 1024;
const cache = new Map<string, { at: number; status: LiveStatus }>();

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9,de;q=0.8",
};

async function readText(res: Response): Promise<string> {
  const text = await res.text();
  return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
}

async function ask(check: LiveCheck): Promise<LiveStatus> {
  const signal = AbortSignal.timeout(8000);
  if (check.platform === "youtube") {
    // Skips the cookie consent page.
    const headers = { ...BROWSER_HEADERS, Cookie: "SOCS=CAI; CONSENT=YES+1" };
    const res = await fetch(check.url, { headers, signal });
    if (!res.ok) return { state: "unknown" };
    const page = youtubeLiveFromHtml(await readText(res));
    // A video is on the channel's /live page, but the page doesn't say whether it is on
    // air (or only announced): the channel's list of streams does.
    if (page.state !== "unknown" || !page.videoId || !check.streams) return { state: page.state, title: page.title };
    const list = await fetch(check.streams, { headers, signal: AbortSignal.timeout(8000) });
    if (!list.ok) return { state: "unknown", title: page.title };
    return youtubeLiveFromStreams(await readText(list), page.videoId, page.title);
  }
  if (check.platform === "tiktok") {
    const url = `https://www.tiktok.com/api-live/user/room/?aid=1988&sourceType=54&uniqueId=${encodeURIComponent(check.user)}`;
    const res = await fetch(url, { headers: { ...BROWSER_HEADERS, Accept: "application/json" }, signal });
    if (!res.ok) return { state: "unknown" };
    try {
      return tiktokLiveFromJson(JSON.parse(await readText(res)));
    } catch {
      return { state: "unknown" };
    }
  }
  // TV on famelack: on air while the site itself is up.
  try {
    const res = await fetch(check.url, { headers: BROWSER_HEADERS, signal });
    void res.body?.cancel();
    if (res.ok) return { state: "live" };
    return res.status >= 500 ? { state: "offline" } : { state: "unknown" };
  } catch {
    return { state: "offline" };
  }
}

/**
 * GET /api/media/live?url=<stream or channel link> → { state: "live" | "offline" |
 * "unknown", title? }. Only links of YouTube, TikTok and famelack are asked about;
 * everything else is "unknown". Signed-in users only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (!data?.claims?.sub || !isEmailAllowed(email)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const check = liveCheckFor(new URL(request.url).searchParams.get("url") ?? "");
  const headers = { "Cache-Control": "private, max-age=120" };
  if (!check) return Response.json({ state: "unknown" } satisfies LiveStatus, { headers });

  const key = JSON.stringify(check);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < FRESH_MS) return Response.json(cached.status, { headers });

  let status: LiveStatus;
  try {
    status = await ask(check);
  } catch {
    status = { state: "unknown" };
  }
  if (cache.size > 200) cache.clear();
  cache.set(key, { at: Date.now(), status });
  return Response.json(status, { headers });
}
