/**
 * My Media: series, films, live TV channels and streams, and handy links. Pure helpers –
 * reading a pasted link, building an episode's link from it, and working out
 * what to watch next.
 */

import { isStreamLink } from "./live";

/** `channel` is TV (always on air), `stream` a creator's channel that is live now and then. */
export type MediaKind = "series" | "movie" | "channel" | "stream" | "link";
export const MEDIA_KINDS: MediaKind[] = ["series", "movie", "channel", "stream", "link"];

/** Live: TV channels and streams. */
export function isLive(kind: string): kind is "channel" | "stream" {
  return kind === "channel" || kind === "stream";
}

/** Live, as TV or a stream – by the link (YouTube, TikTok … are streams). */
export function liveKindOf(url: string): "channel" | "stream" {
  return isStreamLink(url) ? "stream" : "channel";
}

/** Where to watch: a name and a link (for series it may hold {season} and {episode}). */
export type MediaSource = { label: string; url: string };

/** One episode of a series (from TVmaze). */
export type Episode = {
  season: number;
  number: number;
  name: string;
  airdate: string | null;
  runtime: number | null;
  summary: string | null;
};

export function isWebLink(text: string): boolean {
  if (!/^https?:\/\/\S+$/i.test(text.trim())) return false;
  try {
    new URL(text.trim());
    return true;
  } catch {
    return false;
  }
}

/** The stored sources of a title (anything malformed is left out). */
export function sourcesOf(value: unknown): MediaSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((s) =>
    s && typeof s === "object" && typeof s.url === "string" && isWebLink(s.url)
      ? [{ label: typeof s.label === "string" && s.label.trim() ? s.label.trim() : linkLabel(s.url), url: s.url }]
      : [],
  );
}

const SLOT = /\{(season|episode)(2?)\}/g;

export function hasEpisodeSlots(url: string): boolean {
  return /\{(season|episode)2?\}/.test(url);
}

/** A source's link for one episode ({season2}/{episode2}: two digits, 01). */
export function episodeLink(url: string, season: number, episode: number): string {
  return url.replace(SLOT, (_, which: string, padded: string) => {
    const value = which === "season" ? season : episode;
    return padded ? String(value).padStart(2, "0") : String(value);
  });
}

/** A link with the episode slots filled with "1", for showing and checking it. */
export function sampleLink(url: string): string {
  return episodeLink(url, 1, 1);
}

const slot = (which: "season" | "episode", digits: string) =>
  `{${which}${digits.length > 1 && digits.startsWith("0") ? "2" : ""}}`;

/**
 * A link to one episode, turned into one for any episode:
 * …/season/1/episode/1 → …/season/{season}/episode/{episode}; also …-s01e01… and …-1x01….
 * Null when the link names no episode.
 */
export function toEpisodeTemplate(url: string): string | null {
  const named = /(season|staffel)([/\-_=]*)(\d{1,3})([/\-_&?=]+)(episodes?|folge|ep)([/\-_=]*)(\d{1,4})/i;
  if (named.test(url)) {
    return url.replace(
      named,
      (_, s: string, a: string, season: string, between: string, e: string, b: string, episode: string) =>
        `${s}${a}${slot("season", season)}${between}${e}${b}${slot("episode", episode)}`,
    );
  }
  const short = /([/\-_.=])(s)(\d{1,2})(e)(\d{1,3})(?=[/\-_.?#&]|$)/i;
  if (short.test(url)) {
    return url.replace(
      short,
      (_, sep: string, s: string, season: string, e: string, episode: string) =>
        `${sep}${s}${slot("season", season)}${e}${slot("episode", episode)}`,
    );
  }
  const cross = /([/\-_.=])(\d{1,2})x(\d{1,3})(?=[/\-_.?#&]|$)/i;
  if (cross.test(url)) {
    return url.replace(
      cross,
      (_, sep: string, season: string, episode: string) =>
        `${sep}${slot("season", season)}x${slot("episode", episode)}`,
    );
  }
  return null;
}

/** "stream.example" for https://www.stream.example/… */
export function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

/** Words in a link that say nothing about the title itself. */
const NOISE = new Set([
  "watch",
  "online",
  "free",
  "stream",
  "streaming",
  "hd",
  "full",
  "movie",
  "movies",
  "film",
  "films",
  "series",
  "watchseries",
  "watchmovie",
  "tv",
  "show",
  "shows",
  "season",
  "episode",
  "sub",
  "dub",
  "english",
  "german",
  "deutsch",
  "ger",
  "eng",
  "html",
  "htm",
  "php",
]);

/** The title a link names, as words to look up (and a year, if it has one). */
export function titleFromLink(url: string): { query: string; year: number | null } {
  let path = "";
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    return { query: "", year: null };
  }
  let best: { words: string[]; year: number | null } = { words: [], year: null };
  for (const segment of path.split("/")) {
    const words = segment
      .toLowerCase()
      .replace(/^\d+-/, "")
      .split(/[-_+.\s]+/)
      .filter((w) => w && /[a-z]/.test(w) && !NOISE.has(w));
    const all = segment.toLowerCase().split(/[-_+.\s]+/);
    const yearWord = [...all].reverse().find((w) => /^(19|20)\d{2}$/.test(w));
    if (words.join("").length > best.words.join("").length) {
      best = { words, year: yearWord ? Number(yearWord) : null };
    }
  }
  return { query: best.words.join(" "), year: best.year };
}

/** "the substance" → "The Substance" (until the real title is looked up). */
export function titleCase(text: string): string {
  return text.replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

export type ParsedLine = {
  kind: MediaKind;
  /** A name written before the link, if any. */
  name: string | null;
  /** What to look the title up by. */
  query: string;
  year: number | null;
  source: MediaSource;
  /** The link as pasted. */
  raw: string;
};

/**
 * One pasted line: a link, optionally with a name before it ("ZDF https://…").
 * Recognises series (a link to an episode), films, live TV, streams and plain links.
 */
export function parseMediaLine(line: string): ParsedLine | null {
  const match = line.match(/https?:\/\/\S+/i);
  if (!match || !isWebLink(match[0])) return null;
  const raw = match[0].replace(/[),.;]+$/, "");
  const name =
    line
      .slice(0, match.index)
      .trim()
      .replace(/[\s:–—-]+$/, "")
      .trim() || null;
  const url = new URL(raw);
  const path = url.pathname.toLowerCase();
  const template = toEpisodeTemplate(raw);

  let kind: MediaKind;
  if (/famelack\./.test(url.hostname) || /\/(live|livetv|live-tv|channel|channels|sender)(\/|$)/.test(path)) {
    kind = liveKindOf(raw);
  } else if (template) kind = "series";
  else if (/\/(movie|movies|film|films|watchmovie)(\/|-|$)/.test(path)) kind = "movie";
  else if (/\/(watchseries|series|serie|tv-show|tvshow|show|shows|tv)(\/|-|$)/.test(path)) kind = "series";
  else kind = "link";

  const { query, year } = kind === "series" || kind === "movie" ? titleFromLink(raw) : { query: "", year: null };
  return {
    kind,
    name,
    query: name ?? query,
    year,
    source: { label: linkLabel(raw), url: template ?? raw },
    raw,
  };
}

/**
 * A pasted line read as the kind it was added under (the tab it was added from):
 * only a series' link becomes one for any episode, only a series or film is looked up.
 */
export function lineAs(line: ParsedLine, kind: MediaKind): ParsedLine {
  if (kind === line.kind) return line;
  if (isLive(kind) && isLive(line.kind)) return { ...line, kind };
  const lookup = kind === "series" || kind === "movie";
  const { query, year } = lookup ? titleFromLink(line.raw) : { query: "", year: null };
  return {
    ...line,
    kind,
    query: line.name ?? query,
    year,
    source: {
      label: linkLabel(line.raw),
      url: kind === "series" ? (toEpisodeTemplate(line.raw) ?? line.raw) : line.raw,
    },
  };
}

export function episodeKey(season: number, episode: number): string {
  return `${season}:${episode}`;
}

export function parseEpisodeKey(key: string): { season: number; number: number } | null {
  const m = key.match(/^(\d+):(\d+)$/);
  return m ? { season: Number(m[1]), number: Number(m[2]) } : null;
}

export function sortEpisodes<T extends { season: number; number: number }>(episodes: T[]): T[] {
  return [...episodes].sort((a, b) => a.season - b.season || a.number - b.number);
}

export function seasonsOf(episodes: { season: number }[]): number[] {
  return [...new Set(episodes.map((e) => e.season))].sort((a, b) => a - b);
}

/**
 * What to watch next: the episode after the furthest one seen (skipped ones before it
 * don't hold you back). The first episode if none is seen yet; null after the last.
 */
export function nextEpisode<T extends { season: number; number: number }>(
  episodes: T[],
  watched: Iterable<string>,
): T | null {
  const seen = new Set(watched);
  const list = sortEpisodes(episodes);
  let last = -1;
  list.forEach((e, i) => {
    if (seen.has(episodeKey(e.season, e.number))) last = i;
  });
  return list[last + 1] ?? null;
}

/** Without an episode list: the one after the furthest seen (S1 E1 to begin with). */
export function nextFromWatched(watched: string[]): { season: number; number: number } {
  const seen = sortEpisodes(watched.map(parseEpisodeKey).filter((e) => e !== null));
  const last = seen.at(-1);
  return last ? { season: last.season, number: last.number + 1 } : { season: 1, number: 1 };
}

/** The keys of all episodes up to and including this one. */
export function episodesUpTo<T extends { season: number; number: number }>(episodes: T[], until: T): string[] {
  return sortEpisodes(episodes)
    .filter((e) => e.season < until.season || (e.season === until.season && e.number <= until.number))
    .map((e) => episodeKey(e.season, e.number));
}

/** Out already (or with no date: assumed to be). `today` as YYYY-MM-DD. */
export function isAired(episode: { airdate: string | null }, today: string): boolean {
  return !episode.airdate || episode.airdate <= today;
}

/** "S1 E4" */
export function formatEpisode(season: number, episode: number): string {
  return `S${season} E${episode}`;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/** TVmaze's HTML summaries as plain text (never rendered as HTML). */
export function plainText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (whole, code: string) => {
      const lower = code.toLowerCase();
      if (ENTITIES[lower]) return ENTITIES[lower];
      if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
      if (lower.startsWith("#")) return String.fromCodePoint(Number(lower.slice(1)));
      return whole;
    })
    .replace(/[ \t]+/g, " ")
    .trim();
  return text || null;
}

/** "American Beauty (1999 film)" → "American Beauty" */
export function cleanFilmTitle(title: string): string {
  return title.replace(/\s*\((\d{4} )?(american |british |german )?(film|movie)\)\s*$/i, "").trim();
}

/** The year in a Wikipedia description like "1999 film by Sam Mendes". */
export function yearFromText(text: string | null | undefined): number | null {
  const m = text?.match(/\b(18[89]\d|19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}
