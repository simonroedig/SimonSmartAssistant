import sharp from "sharp";
import { isEmailAllowed } from "@/lib/auth/allowlist";
import { dominantColor } from "@/lib/poster-color";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Only the posters My Media shows – this never fetches anything else. */
const POSTER_HOSTS = new Set(["static.tvmaze.com", "upload.wikimedia.org"]);
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * GET /api/media/color?url=<poster> → { color: "#rrggbb" | null }: the poster's own
 * colour, for showing a series or film in its colours. Signed-in users only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (!data?.claims?.sub || !isEmailAllowed(email)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let poster: URL;
  try {
    poster = new URL(new URL(request.url).searchParams.get("url") ?? "");
  } catch {
    return Response.json({ error: "bad url" }, { status: 400 });
  }
  if (poster.protocol !== "https:" || !POSTER_HOSTS.has(poster.hostname) || poster.port) {
    return Response.json({ error: "not a poster" }, { status: 400 });
  }

  try {
    const res = await fetch(poster, { redirect: "error", signal: AbortSignal.timeout(6000) });
    const length = Number(res.headers.get("content-length") ?? 0);
    if (!res.ok || length > MAX_BYTES) return Response.json({ error: "unavailable" }, { status: 502 });
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return Response.json({ error: "too big" }, { status: 502 });
    // A small copy is enough to tell its colours.
    const pixels = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .resize(36, 54, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer();
    return Response.json({ color: dominantColor(pixels) }, { headers: { "Cache-Control": "private, max-age=86400" } });
  } catch {
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
