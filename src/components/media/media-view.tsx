"use client";

import { Check, ExternalLink, MoreHorizontal, Pencil, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { FILL_BODY, FillPage, PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CHIP, CHIP_IDLE, CHIP_ON } from "@/components/ui/chip";
import { Fab } from "@/components/ui/fab";
import type { MediaTitle } from "@/data/core";
import { useMedia } from "@/data/media";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useScrollToPressed } from "@/hooks/use-scroll-to-pressed";
import { useSwipe } from "@/hooks/use-swipe";
import {
  episodeKey,
  formatEpisode,
  hasEpisodeSlots,
  linkLabel,
  MEDIA_KINDS,
  type MediaKind,
  sourcesOf,
} from "@/lib/media";
import { FIELD_FOCUS, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { AddMediaSheet } from "./add-media-sheet";
import { KIND_ICON, MEDIA_TONE, mediaStyle, ProgressBar, WatchButton, WatchingBanner } from "./media-parts";
import { Poster } from "./poster";
import { TitleSheet } from "./title-sheet";
import { seenMessage, useMediaActions, usePosterColor, useSeriesState, watchUrl } from "./use-media-actions";

const fuchsia = TONE_STYLES.fuchsia;

const TAB_LABEL: Record<MediaKind, string> = { series: "Series", movie: "Movies", channel: "Live TV", link: "Links" };

/**
 * The tabs from left to right: Links first, as a small icon (like the notes' vault) –
 * one swipe away from Series, which the page opens on.
 */
const TABS: MediaKind[] = ["link", "series", "movie", "channel"];

const EMPTY: Record<MediaKind, string> = {
  series: "No series yet. Add one with + – a link to any episode is enough.",
  movie: "No films yet. Add one with +.",
  channel: "No channels yet. Add one with + (name and link).",
  link: "No links yet – keep the sites you use here, one tap away.",
};

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === "string" && (MEDIA_KINDS as string[]).includes(value);
}

/** Recently watched first, then the newest. */
function byLastWatched(a: MediaTitle, b: MediaTitle) {
  return (b.last_watched_at ?? "").localeCompare(a.last_watched_at ?? "") || b.created_at.localeCompare(a.created_at);
}

/**
 * My Media: series (with where you are and what's next), films, live TV and handy
 * links. Built for the phone, the PC and – with big targets and arrow-key focus –
 * the TV.
 */
export function MediaView({ initialTab }: { initialTab?: string }) {
  const media = useMedia();
  const all = media.data ?? [];
  const [tab, setTab] = useState<MediaKind>(isMediaKind(initialTab) ? initialTab : "series");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const open = all.find((m) => m.id === openId) ?? null;
  const items = all.filter((m) => m.kind === tab);

  const changeTab = (next: MediaKind) => {
    setTab(next);
    // In the address, so reloading (or the TV's browser coming back) keeps the tab.
    window.history.replaceState(window.history.state, "", next === "series" ? "/media" : `/media?tab=${next}`);
  };

  // The list slides in from the side the picked tab is on.
  const [shown, setShown] = useState({ tab, direction: 1 });
  if (shown.tab !== tab) {
    setShown({ tab, direction: TABS.indexOf(tab) < TABS.indexOf(shown.tab) ? -1 : 1 });
  }
  // Phones: swipe sideways through the tabs (no wrapping round), like the notes' categories.
  const phone = useMediaQuery("(max-width: 767px)");
  const swipe = useSwipe(
    (direction) => {
      const next = TABS[TABS.indexOf(tab) + direction];
      if (next) changeTab(next);
    },
    phone && !adding && openId === null,
  );
  const row = useScrollToPressed(tab);

  return (
    // Phones: the title and the tabs stay; only the list below them scrolls (like the notes).
    // Sideways moves are the page's (swipes); nothing may stick out sideways while a
    // list slides in, or the whole page – tab bar included – would wobble.
    <FillPage>
      <div
        className="flex [touch-action:pan-y] flex-col overflow-x-clip max-md:min-h-0 max-md:flex-1 md:min-h-dvh"
        {...swipe}
      >
        <PageHeader title="Media" subtitle="Series, films and live TV – where to watch and how far you are" />
        <PageBody className={cn(FIELD_FOCUS.fuchsia, FILL_BODY, "md:pb-28")}>
          <WatchingBanner media={all} />
          <div
            ref={row}
            role="tablist"
            aria-label="Media"
            className="-mx-4 mb-4 no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
          >
            {TABS.map((k) => {
              const Icon = KIND_ICON[k];
              const count = all.filter((m) => m.kind === k).length;
              const iconOnly = k === "link";
              return (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  aria-label={iconOnly ? TAB_LABEL[k] : undefined}
                  title={iconOnly ? TAB_LABEL[k] : undefined}
                  onClick={() => changeTab(k)}
                  className={cn(
                    CHIP,
                    iconOnly ? "w-9 justify-center px-0 md:w-10" : "md:h-10 md:px-4 md:text-[0.95rem]",
                    "md:h-10",
                    tab === k ? cn(fuchsia.soft, fuchsia.text, CHIP_ON) : CHIP_IDLE,
                  )}
                >
                  <Icon className="size-4" />
                  {!iconOnly && TAB_LABEL[k]}
                  {!iconOnly && count > 0 && <span className="text-xs tabular opacity-60 max-md:hidden">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Phones: this part scrolls (room at its end for the + button). */}
          <div className="[touch-action:pan-y] max-md:-mx-4 max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:overscroll-contain max-md:px-4 max-md:pb-24">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: shown.direction * 28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {media.isPending ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-36 rounded-(--radius-card)" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <Card className="items-center gap-3 px-6 py-12 text-center">
                  {(() => {
                    const Icon = KIND_ICON[tab];
                    return <Icon className={cn("size-10", fuchsia.text)} />;
                  })()}
                  <p className="max-w-sm text-sm text-muted">{EMPTY[tab]}</p>
                </Card>
              ) : tab === "series" ? (
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {[...items].sort(byLastWatched).map((s) => (
                    <SeriesCard key={s.id} title={s} onOpen={() => setOpenId(s.id)} />
                  ))}
                </div>
              ) : tab === "movie" ? (
                <MovieGrid movies={items} onOpen={(m) => setOpenId(m.id)} />
              ) : tab === "channel" ? (
                <ChannelGrid channels={items} onEdit={(c) => setOpenId(c.id)} />
              ) : (
                <LinkList links={items} onEdit={(l) => setOpenId(l.id)} />
              )}
            </motion.div>
          </div>
        </PageBody>
      </div>

      <Fab
        aria-label="Add to Media"
        onClick={() => setAdding(true)}
        className={cn(
          // Phones: the same spot as the planner's + (above the tab bar); elsewhere in the corner.
          "fixed max-md:right-[calc(2rem+1px)] max-md:bottom-[calc(var(--page-bottom)+1rem+1px)] md:right-[calc(2*var(--gutter))] md:bottom-[calc(2*var(--gutter))]",
          fuchsia.solid,
        )}
      />
      <AddMediaSheet open={adding} kind={tab} media={all} onClose={() => setAdding(false)} onAdded={changeTab} />
      <TitleSheet title={open} onClose={() => setOpenId(null)} />
    </FillPage>
  );
}

function SeriesCard({ title, onOpen }: { title: MediaTitle; onOpen: () => void }) {
  const state = useSeriesState(title);
  const { setSeen, touch } = useMediaActions();
  usePosterColor(title);
  const next = state.next;
  const ready = next && next.aired;
  const season = state.season;
  // A link to the series' page (not to an episode) can't open each episode by itself.
  const primary = sourcesOf(title.sources)[0];
  const seriesPageOnly = !!primary && !hasEpisodeSlots(primary.url);
  // Where you are, by season – "S12 · 3 of 13 seen" says more than "151 of 333".
  const where =
    state.total == null
      ? state.seen > 0
        ? `${state.seen} ${state.seen === 1 ? "episode" : "episodes"} seen`
        : "Not started"
      : state.seen === 0
        ? `${state.seasonCount} ${state.seasonCount === 1 ? "season" : "seasons"} · ${state.total} episodes`
        : state.caughtUp
          ? `All ${state.seasonCount} ${state.seasonCount === 1 ? "season" : "seasons"} seen`
          : season
            ? `Season ${season.number} of ${state.seasonCount} · ${season.seen} of ${season.total} seen`
            : "";
  return (
    <Card
      as="article"
      style={mediaStyle(title.color)}
      className="media-tone flex-row gap-4 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--m)_14%,transparent),transparent_65%)] p-3 md:p-4"
    >
      {/* The whole card opens the series; its buttons sit on top. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${title.title}`}
        className="absolute inset-0 rounded-(--radius-card) transition-colors hover:bg-fg/[0.03]"
      />
      <Poster
        src={title.poster_url}
        title={title.title}
        kind="series"
        className="pointer-events-none relative w-20 md:w-24"
      />
      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col">
        <h3 className="truncate text-[1.05rem] leading-tight font-semibold">{title.title}</h3>
        <p className="mt-0.5 truncate text-xs text-muted tabular">{where}</p>
        {season && state.seen > 0 && !state.caughtUp && season.total > 0 && (
          <ProgressBar value={season.seen / season.total} className="mt-2" />
        )}
        {seriesPageOnly && (
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-300">
            <TriangleAlert className="size-3.5 shrink-0" />
            <span className="truncate">Link to the series page only</span>
          </p>
        )}
        <div className="mt-auto pt-3">
          {state.loading ? (
            <div className="skeleton h-10 rounded-2xl" />
          ) : ready ? (
            <>
              <p className="truncate text-sm">
                <span className={cn("font-semibold", MEDIA_TONE.text)}>
                  Next · {formatEpisode(next.season, next.number)}
                </span>
                {next.name && <span className="text-muted"> · {next.name}</span>}
              </p>
              <div className="pointer-events-auto mt-2 flex gap-2">
                <WatchButton
                  href={watchUrl(title, next)}
                  onClick={() => touch(title)}
                  watching={{ id: title.id, title: title.title, season: next.season, episode: next.number }}
                  className="min-w-0 flex-1"
                >
                  {formatEpisode(next.season, next.number)}
                </WatchButton>
                <Button
                  variant="secondary"
                  size="icon"
                  className="ml-auto"
                  aria-label={`Mark ${formatEpisode(next.season, next.number)} as seen`}
                  onClick={() =>
                    setSeen(title, [episodeKey(next.season, next.number)], true, seenMessage(next.season, next.number))
                  }
                >
                  <Check />
                </Button>
              </div>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Check className={cn("size-4", MEDIA_TONE.text)} />
              {next ? `Up to date – ${formatEpisode(next.season, next.number)} is coming` : "All seen"}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function MovieGrid({ movies, onOpen }: { movies: MediaTitle[]; onOpen: (m: MediaTitle) => void }) {
  // Still to watch first; seen ones after, quieter.
  const sorted = [...movies].sort((a, b) => Number(a.watched) - Number(b.watched) || byLastWatched(a, b));
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
      {sorted.map((m) => (
        <MovieTile key={m.id} movie={m} onOpen={() => onOpen(m)} />
      ))}
    </div>
  );
}

function MovieTile({ movie: m, onOpen }: { movie: MediaTitle; onOpen: () => void }) {
  usePosterColor(m);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${m.title}${m.watched ? " (seen)" : ""}`}
      style={mediaStyle(m.color)}
      className="media-tone group flex flex-col gap-2 rounded-2xl text-left"
    >
      <div className="relative">
        <Poster
          src={m.poster_url}
          title={m.title}
          kind="movie"
          className={cn(
            "w-full shadow-(--shadow-card) transition-transform group-hover:scale-[1.02]",
            m.watched && "opacity-60 saturate-50",
          )}
        />
        {m.watched && (
          <span
            className={cn(
              "absolute top-2 right-2 grid size-7 place-items-center rounded-full shadow",
              MEDIA_TONE.solid,
            )}
          >
            <Check className="size-4" strokeWidth={3} />
          </span>
        )}
      </div>
      <span className="px-0.5">
        <span className="line-clamp-2 leading-snug font-semibold">{m.title}</span>
        <span className="block text-xs text-muted tabular">
          {[m.year, m.watched ? "Seen" : null].filter(Boolean).join(" · ")}
        </span>
      </span>
    </button>
  );
}

function ChannelGrid({ channels, onEdit }: { channels: MediaTitle[]; onEdit: (c: MediaTitle) => void }) {
  const { touch } = useMediaActions();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {channels.map((c) => {
        const url = sourcesOf(c.sources)[0]?.url ?? null;
        return (
          <Card key={c.id} as="article" className="overflow-hidden p-0">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => touch(c)}
                className="flex h-32 flex-col justify-between p-4 transition-colors hover:bg-surface-hover"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-rose-500 uppercase dark:text-rose-300">
                  <span className="size-2 animate-pulse rounded-full bg-current" /> Live
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xl font-semibold tracking-tight">{c.title}</span>
                  <span className="block truncate text-xs text-faint">{linkLabel(url)}</span>
                </span>
              </a>
            ) : (
              <button type="button" onClick={() => onEdit(c)} className="flex h-32 flex-col justify-end p-4 text-left">
                <span className="truncate text-xl font-semibold">{c.title}</span>
                <span className="text-xs text-faint">No link yet</span>
              </button>
            )}
            <button
              type="button"
              aria-label={`Edit ${c.title}`}
              onClick={() => onEdit(c)}
              className="absolute top-2 right-2 grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </Card>
        );
      })}
    </div>
  );
}

function LinkList({ links, onEdit }: { links: MediaTitle[]; onEdit: (l: MediaTitle) => void }) {
  const { touch } = useMediaActions();
  return (
    <Card className="divide-y divide-line p-1.5">
      {links.map((l) => {
        const url = sourcesOf(l.sources)[0]?.url ?? null;
        return (
          <div key={l.id} className="flex items-center gap-1">
            <a
              href={url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => touch(l)}
              aria-disabled={!url}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-surface-hover"
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", fuchsia.soft, fuchsia.text)}>
                <ExternalLink className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{l.title}</span>
                <span className="block truncate text-xs text-faint">
                  {url ? url.replace(/^https?:\/\//, "") : "No link yet"}
                </span>
              </span>
            </a>
            <button
              type="button"
              aria-label={`Edit ${l.title}`}
              onClick={() => onEdit(l)}
              className="grid size-10 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
            >
              <Pencil className="size-4" />
            </button>
          </div>
        );
      })}
    </Card>
  );
}
