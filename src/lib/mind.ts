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

export type TextPart = { text: string; mark: boolean; italic: boolean };

/**
 * A card's text with its styles: ==highlighted== (like a highlighter on paper) and
 * *italic* – the stars at a word's edges, so "sh*t" stays as it is. They mix: ==*both*==.
 */
export function styledParts(text: string, mark = false, italic = false): TextPart[] {
  const parts: TextPart[] = [];
  const re = /==([^=\n](?:[^\n]*?[^=\n])?)==|(?<![\p{L}\p{N}*])\*([^\s*](?:[^*\n]*?[^\s*])?)\*(?![\p{L}\p{N}*])/gu;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), mark, italic });
    if (m[1] !== undefined) parts.push(...styledParts(m[1], true, italic));
    else parts.push(...styledParts(m[2], mark, true));
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mark, italic });
  return parts;
}

/** The plain text, without the marks (for labels and search). */
export function plainCardText(text: string): string {
  return styledParts(text)
    .map((p) => p.text)
    .join("");
}

/** A hash of a text (stable across devices). */
function hashOf(text: string): number {
  let hash = 0;
  for (const ch of text) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  return hash;
}

/** One card a day – the same all day on every device, a different one tomorrow. */
export function cardOfTheDay<T extends { id: string }>(cards: T[], day: string): T | null {
  if (cards.length === 0) return null;
  const sorted = [...cards].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[hashOf(day) % sorted.length];
}

/** To flip through: the one for today first, then the others shuffled – a new order each day. */
export function dayShuffle<T extends { id: string }>(cards: T[], day: string): T[] {
  const first = cardOfTheDay(cards, day);
  const rest = cards
    .filter((c) => c !== first)
    .map((c) => ({ c, key: hashOf(`${day}:${c.id}`) }))
    .sort((a, b) => a.key - b.key || a.c.id.localeCompare(b.c.id))
    .map(({ c }) => c);
  return first ? [first, ...rest] : rest;
}
