"use client";

import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { MediaTitle } from "@/data/core";
import { useEpisodes, useUpdateMedia } from "@/data/media";
import { useToday } from "@/hooks/use-today";
import {
  type Episode,
  episodeKey,
  episodeLink,
  formatEpisode,
  hasEpisodeSlots,
  isAired,
  nextEpisode,
  nextFromWatched,
  sampleLink,
  sourcesOf,
} from "@/lib/media";
import { TOAST_TONE } from "@/lib/tones";

/** An episode to watch: from TVmaze, or (without its list) just its numbers. */
export type NextUp = { season: number; number: number; name: string | null; airdate: string | null; aired: boolean };

/** Where a series stands: its episodes, what's seen, what comes next. */
export function useSeriesState(title: MediaTitle) {
  const today = useToday() ?? "9999-12-31";
  const query = useEpisodes(title.tvmaze_id);
  const episodes: Episode[] | null = title.tvmaze_id ? (query.data ?? null) : null;
  const watched = useMemo(() => new Set(title.watched_episodes), [title.watched_episodes]);

  let next: NextUp | null;
  if (episodes) {
    const e = nextEpisode(episodes, watched);
    next = e
      ? { season: e.season, number: e.number, name: e.name, airdate: e.airdate, aired: isAired(e, today) }
      : null;
  } else {
    const e = nextFromWatched(title.watched_episodes);
    next = { ...e, name: null, airdate: null, aired: true };
  }
  const aired = episodes?.filter((e) => isAired(e, today)) ?? [];
  const seen = episodes ? aired.filter((e) => watched.has(episodeKey(e.season, e.number))).length : watched.size;
  // Where you are, by season: the one of the next episode (or the last one when all is seen).
  const seasons = [...new Set(aired.map((e) => e.season))];
  const current = next?.aired ? next.season : (seasons.at(-1) ?? null);
  const inSeason = current == null ? [] : aired.filter((e) => e.season === current);
  return {
    seasonCount: seasons.length,
    season:
      current == null
        ? null
        : {
            number: current,
            seen: inSeason.filter((e) => watched.has(episodeKey(e.season, e.number))).length,
            total: inSeason.length,
          },
    episodes,
    loading: title.tvmaze_id != null && query.isPending,
    failed: query.isError,
    watched,
    next,
    seen,
    total: episodes ? aired.length : null,
    /** Every episode out so far is seen (and the list is known). */
    caughtUp: !!episodes && episodes.length > 0 && (!next || !next.aired),
  };
}

/** The link to watch a title (an episode of a series), or null without a source. */
export function watchUrl(title: MediaTitle, episode?: { season: number; number: number } | null): string | null {
  const primary = sourcesOf(title.sources)[0];
  if (!primary) return null;
  if (!hasEpisodeSlots(primary.url)) return primary.url;
  return episode ? episodeLink(primary.url, episode.season, episode.number) : sampleLink(primary.url);
}

export function useMediaActions() {
  const update = useUpdateMedia();

  /** Marks episodes as seen (or not) – with Undo. */
  const setSeen = (title: MediaTitle, keys: string[], seen: boolean, message?: string) => {
    const before = title.watched_episodes;
    const set = new Set(before);
    keys.forEach((k) => (seen ? set.add(k) : set.delete(k)));
    if (set.size === before.length && keys.every((k) => before.includes(k) === seen)) return;
    update.mutate({
      id: title.id,
      patch: {
        watched_episodes: [...set],
        ...(seen ? { last_watched_at: new Date().toISOString() } : {}),
      },
    });
    if (message) {
      toast(message, {
        classNames: { toast: TOAST_TONE.fuchsia },
        action: {
          label: "Undo",
          onClick: () =>
            update.mutate({
              id: title.id,
              patch: { watched_episodes: before, last_watched_at: title.last_watched_at },
            }),
        },
      });
    }
  };

  const setMovieSeen = (title: MediaTitle, seen: boolean) =>
    update.mutate({
      id: title.id,
      patch: { watched: seen, ...(seen ? { last_watched_at: new Date().toISOString() } : {}) },
    });

  /** Opening something to watch counts as "watched lately" (it moves up the list). */
  const touch = (title: MediaTitle) =>
    update.mutate({ id: title.id, patch: { last_watched_at: new Date().toISOString() } });

  return { update, setSeen, setMovieSeen, touch };
}

export function seenMessage(season: number, episode: number): string {
  return `${formatEpisode(season, episode)} seen`;
}

/** Posters whose colour is being asked for (once per title and page load). */
const asked = new Set<string>();

/**
 * Finds a title's colour from its poster once (on the server – the poster sites
 * don't let pages read their pixels) and keeps it with the title.
 */
export function usePosterColor(title: MediaTitle) {
  const update = useUpdateMedia();
  const { id, poster_url: poster, color, user_id: saved } = title;
  useEffect(() => {
    // Not yet saved (an optimistic row), no poster, or already known.
    if (!poster || color !== null || !saved || asked.has(`${id}:${poster}`)) return;
    asked.add(`${id}:${poster}`);
    void fetch(`/api/media/color?url=${encodeURIComponent(poster)}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ color: string | null }>) : null))
      .then((body) => {
        if (body) update.mutate({ id, patch: { color: body.color ?? "none" } });
      })
      .catch(() => {
        // Offline or the poster is gone: tried again on the next visit.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, poster, color, saved]);
}
