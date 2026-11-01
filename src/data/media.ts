"use client";

import type { Json } from "@/lib/database.types";
import { liveCheckFor, type LiveStatus } from "@/lib/live";
import {
  cleanFilmTitle,
  type Episode,
  type MediaKind,
  type MediaSource,
  plainText,
  sortEpisodes,
  yearFromText,
} from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import { type MediaTitle, nowIso, queryKeys, useAppQuery, useOptimisticMutation } from "./core";

export const TVMAZE_API = "https://api.tvmaze.com";
export const WIKIPEDIA_API = "https://en.wikipedia.org";

export function useMedia() {
  return useAppQuery({
    queryKey: queryKeys.media,
    queryFn: async () => {
      const { data, error } = await createClient().from("media_titles").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export type MediaInput = {
  id: string;
  kind: MediaKind;
  title: string;
  year: number | null;
  tvmaze_id: number | null;
  poster_url: string | null;
  summary: string | null;
  sources: MediaSource[];
  watched?: boolean;
};

const clip = (text: string | null, max: number) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text);

function toRow(input: MediaInput) {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title.trim().slice(0, 200),
    year: input.year,
    tvmaze_id: input.tvmaze_id,
    poster_url: input.poster_url?.startsWith("https://") ? input.poster_url.slice(0, 500) : null,
    summary: clip(input.summary, 4000),
    sources: input.sources as unknown as NonNullable<Json>,
    watched: input.watched ?? false,
  };
}

/** Adds several titles at once (one or a whole pasted list). */
export function useAddMedia() {
  return useOptimisticMutation<MediaInput[]>({
    table: "media_titles",
    queryKey: queryKeys.media,
    errorTitle: "Couldn't add it",
    mutationFn: async (inputs) => {
      const { error } = await createClient().from("media_titles").insert(inputs.map(toRow));
      if (error) throw error;
    },
    update: (data, inputs) => {
      const now = nowIso();
      const rows: MediaTitle[] = inputs.map((input) => ({
        ...toRow(input),
        user_id: "",
        watched_episodes: [],
        last_watched_at: null,
        color: null,
        created_at: now,
        updated_at: now,
      }));
      return [...((data ?? []) as MediaTitle[]), ...rows];
    },
  });
}

export type MediaPatch = Partial<
  Pick<
    MediaTitle,
    | "title"
    | "kind"
    | "year"
    | "tvmaze_id"
    | "poster_url"
    | "summary"
    | "watched"
    | "watched_episodes"
    | "last_watched_at"
    | "color"
  >
> & { sources?: MediaSource[] };

export function useUpdateMedia() {
  return useOptimisticMutation<{ id: string; patch: MediaPatch }>({
    table: "media_titles",
    queryKey: queryKeys.media,
    errorTitle: "Couldn't save it",
    mutationFn: async ({ id, patch }) => {
      const { sources, ...rest } = patch;
      const row = sources ? { ...rest, sources: sources as unknown as NonNullable<Json> } : rest;
      const { error } = await createClient().from("media_titles").update(row).eq("id", id);
      if (error) throw error;
    },
    update: (data, { id, patch }) =>
      ((data ?? []) as MediaTitle[]).map((m) =>
        m.id === id ? { ...m, ...patch, sources: (patch.sources as unknown as NonNullable<Json>) ?? m.sources } : m,
      ),
  });
}

export function useDeleteMedia() {
  return useOptimisticMutation<{ id: string }>({
    table: "media_titles",
    queryKey: queryKeys.media,
    errorTitle: "Couldn't delete it",
    mutationFn: async ({ id }) => {
      const { error } = await createClient().from("media_titles").delete().eq("id", id);
      if (error) throw error;
    },
    update: (data, { id }) => ((data ?? []) as MediaTitle[]).filter((m) => m.id !== id),
  });
}

// -----------------------------------------------------------------------------
// Looking things up: TVmaze for series (free, no key), Wikipedia for films.
// -----------------------------------------------------------------------------

type TvmazeShow = {
  id: number;
  name: string;
  premiered: string | null;
  summary: string | null;
  image: { medium?: string; original?: string } | null;
};

type TvmazeEpisode = {
  season: number;
  number: number | null;
  name: string;
  airdate: string | null;
  runtime: number | null;
  summary: string | null;
};

/** A title found by a lookup. */
export type Found = {
  title: string;
  year: number | null;
  tvmaze_id: number | null;
  poster_url: string | null;
  summary: string | null;
};

const https = (url: string | undefined | null) => (url ? url.replace(/^http:\/\//, "https://") : null);

function fromShow(show: TvmazeShow): Found {
  return {
    title: show.name,
    year: show.premiered ? Number(show.premiered.slice(0, 4)) : null,
    tvmaze_id: show.id,
    poster_url: https(show.image?.medium ?? show.image?.original),
    summary: plainText(show.summary),
  };
}

export async function searchShows(query: string): Promise<Found[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${TVMAZE_API}/search/shows?q=${encodeURIComponent(query.trim())}`);
  if (!res.ok) throw new Error(`TVmaze answered ${res.status}`);
  const results = (await res.json()) as { show: TvmazeShow }[];
  return results.slice(0, 6).map((r) => fromShow(r.show));
}

type WikiSummary = {
  type?: string;
  title: string;
  description?: string;
  extract?: string;
  thumbnail?: { source: string };
};

export async function searchFilms(query: string, year: number | null): Promise<Found[]> {
  if (!query.trim()) return [];
  const q = `${query.trim()} ${year ?? ""} film`.replace(/\s+/g, " ");
  const res = await fetch(
    `${WIKIPEDIA_API}/w/api.php?action=query&list=search&format=json&origin=*&srlimit=5&srsearch=${encodeURIComponent(q)}`,
  );
  if (!res.ok) throw new Error(`Wikipedia answered ${res.status}`);
  const body = (await res.json()) as { query?: { search?: { title: string }[] } };
  const titles = (body.query?.search ?? []).map((r) => r.title).slice(0, 4);
  const pages = await Promise.all(
    titles.map(async (title): Promise<WikiSummary | null> => {
      const page = await fetch(
        `${WIKIPEDIA_API}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      );
      return page.ok ? ((await page.json()) as WikiSummary) : null;
    }),
  );
  const films = pages
    .filter((p): p is WikiSummary => !!p && p.type !== "disambiguation")
    .map((p) => ({
      found: {
        title: cleanFilmTitle(p.title),
        year: yearFromText(p.description) ?? yearFromText(p.title),
        tvmaze_id: null,
        poster_url: https(p.thumbnail?.source),
        summary: p.extract?.trim() || null,
      } satisfies Found,
      isFilm: /\bfilm\b/i.test(`${p.description ?? ""} ${p.title}`),
    }));
  // Pages about films first (a search also finds actors, books, …); the year decides among them.
  return films
    .sort(
      (a, b) => Number(b.isFilm) - Number(a.isFilm) || Number(b.found.year === year) - Number(a.found.year === year),
    )
    .map((f) => f.found);
}

/** The best match, for titles added from a pasted list. */
export async function lookUp(kind: MediaKind, query: string, year: number | null): Promise<Found | null> {
  try {
    if (kind === "series") return (await searchShows(query))[0] ?? null;
    if (kind === "movie") return (await searchFilms(query, year))[0] ?? null;
  } catch {
    // Offline or the lookup is down: the title stays as written.
  }
  return null;
}

async function fetchEpisodes(tvmazeId: number): Promise<Episode[]> {
  const res = await fetch(`${TVMAZE_API}/shows/${tvmazeId}/episodes`);
  if (!res.ok) throw new Error(`TVmaze answered ${res.status}`);
  const list = (await res.json()) as TvmazeEpisode[];
  return sortEpisodes(
    list
      .filter((e) => e.number != null && e.season > 0)
      .map((e) => ({
        season: e.season,
        number: e.number!,
        name: e.name,
        airdate: e.airdate || null,
        runtime: e.runtime ?? null,
        summary: clip(plainText(e.summary), 900),
      })),
  );
}

/** A show's episodes (with their summaries), kept on the device for a while. */
export function useEpisodes(tvmazeId: number | null) {
  return useAppQuery({
    queryKey: queryKeys.episodes(tvmazeId ?? 0),
    queryFn: () => fetchEpisodes(tvmazeId!),
    enabled: tvmazeId != null,
    staleTime: 12 * 60 * 60_000,
    gcTime: 14 * 24 * 60 * 60_000,
    retry: 1,
  });
}

/**
 * Whether a TV channel or stream is on air – asked only while it is shown (the Live
 * tab), at most every few minutes, and again when coming back to the app later.
 */
export function useLiveStatus(url: string | null) {
  const check = url ? liveCheckFor(url) : null;
  return useAppQuery<LiveStatus>({
    queryKey: ["media", "live", url],
    queryFn: async () => {
      const res = await fetch(`/api/media/live?url=${encodeURIComponent(url!)}`);
      if (!res.ok) return { state: "unknown" };
      return (await res.json()) as LiveStatus;
    },
    enabled: !!check,
    // Only for now: never kept on the device.
    meta: { persist: false },
    staleTime: 3 * 60_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
