/**
 * Mind: reminders as cards and pinned videos. Pure helpers – what a link is, the
 * marked parts of a card's text, the card of the day and pasting several at once.
 */

export type MindKind = "card" | "video";

export type MindInput = {
  id: string;
  kind: MindKind;
  title: string;
  body: string;
  source: string;
  url: string | null;
};

export function toMindRow(input: MindInput) {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title.trim().slice(0, 200),
    body: input.body.replace(/\s+$/, "").replace(/^\s*\n/, "").slice(0, 4000),
    source: input.source.trim().slice(0, 200),
    url: input.kind === "video" ? webLink(input.url) : null,
  };
}

/** A web link (http/https, nothing a tap could run), or null. */
export function webLink(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!/^https?:\/\/\S+$/i.test(text) || text.length > 2000) return null;
  try {
    return new URL(text).protocol.startsWith("http") ? text : null;
  } catch {
    return null;
  }
}

/** The link in a shared text ("Look at this! https://vm.tiktok.com/…"), or null. */
export function firstLink(text: string): string | null {
  const direct = webLink(text);
  if (direct) return direct;
  const found = text.match(/https?:\/\/[^\s<>"]+/i)?.[0].replace(/[.,;:!?)\]]+$/, "");
  return webLink(found);
}

export type VideoPlatform = "youtube" | "tiktok" | "instagram" | "web";

export type VideoInfo = {
  platform: VideoPlatform;
  /** "YouTube", "TikTok" … or the site's name. */
  label: string;
  /** A still from the video, where the platform offers one without asking it first. */
  thumbnail: string | null;
};

/** YouTube's stills come from here (allowed in the page's CSP). */
export const YOUTUBE_IMAGE_HOST = "https://i.ytimg.com";

export function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    id = first === "watch" ? url.searchParams.get("v") : ["shorts", "live", "embed", "v"].includes(first) ? second : null;
  }
  return id && /^[\w-]{6,20}$/.test(id) ? id : null;
}

export function videoInfo(link: string | null): VideoInfo {
  let url: URL;
  try {
    url = new URL(link ?? "");
  } catch {
    return { platform: "web", label: "Link", thumbnail: null };
  }
  const host = url.hostname.replace(/^www\./, "");
  const yt = youtubeId(url);
  if (yt || /(^|\.)youtube\.com$|^youtu\.be$/.test(host)) {
    return { platform: "youtube", label: "YouTube", thumbnail: yt ? `${YOUTUBE_IMAGE_HOST}/vi/${yt}/hqdefault.jpg` : null };
  }
  if (/(^|\.)tiktok\.com$/.test(host)) return { platform: "tiktok", label: "TikTok", thumbnail: null };
  if (/(^|\.)instagram\.com$/.test(host)) return { platform: "instagram", label: "Instagram", thumbnail: null };
  const name = host.split(".").slice(-2, -1)[0] ?? host;
  return { platform: "web", label: name.charAt(0).toUpperCase() + name.slice(1), thumbnail: null };
}

export type TextPart = { text: string; mark: boolean };

/** A card's text with its ==marked== parts (shown like a highlighter on paper). */
export function markedParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = /==([^=\n](?:[^\n]*?[^=\n])?)==/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), mark: false });
    parts.push({ text: m[1], mark: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mark: false });
  return parts;
}

/** The plain text, without the marks (for labels and search). */
export function plainCardText(text: string): string {
  return markedParts(text)
    .map((p) => p.text)
    .join("");
}

/** One card a day – the same all day on every device, a different one tomorrow. */
export function cardOfTheDay<T extends { id: string }>(cards: T[], day: string): T | null {
  if (cards.length === 0) return null;
  const sorted = [...cards].sort((a, b) => a.id.localeCompare(b.id));
  let hash = 0;
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return sorted[hash % sorted.length];
}

/**
 * Several at once, pasted: blocks between lines of `---`. In a block, a first line
 * `# …` is the title, a last line `— …` (or `-- …`) says who it's from, and a link
 * on its own makes it a video; everything else is the card's text.
 */
export function parseMindList(text: string): Omit<MindInput, "id">[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/^\s*-{3,}\s*$/m)
    .flatMap((block): Omit<MindInput, "id">[] => {
      const lines = block.split("\n");
      while (lines.length && !lines[0].trim()) lines.shift();
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      if (!lines.length) return [];
      let title = "";
      let source = "";
      if (/^#\s+/.test(lines[0])) title = lines.shift()!.replace(/^#\s+/, "").trim();
      const last = lines[lines.length - 1];
      if (last && /^\s*(—|–|--)\s*\S/.test(last)) source = lines.pop()!.replace(/^\s*(—|–|--)\s*/, "").trim();
      const body = lines.join("\n").trim();
      const link = webLink(body);
      if (link) return [{ kind: "video", title, body: "", source, url: link }];
      if (!body) return [];
      return [{ kind: "card", title, body, source, url: null }];
    });
}
