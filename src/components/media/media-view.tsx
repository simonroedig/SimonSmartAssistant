"use client";

import { Check, ExternalLink, MoreHorizontal, Pencil } from "lucide-react";
import { useState } from "react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fab } from "@/components/ui/fab";
import type { MediaTitle } from "@/data/core";
import { useMedia } from "@/data/media";
import { episodeKey, formatEpisode, linkLabel, MEDIA_KINDS, type MediaKind, sourcesOf } from "@/lib/media";
import { FIELD_FOCUS, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { AddMediaSheet } from "./add-media-sheet";
import { KIND_ICON, ProgressBar, WatchButton, WatchingBanner } from "./media-parts";
import { Poster } from "./poster";
import { TitleSheet } from "./title-sheet";
import { seenMessage, useMediaActions, useSeriesState, watchUrl } from "./use-media-actions";

const fuchsia = TONE_STYLES.fuchsia;

const TAB_LABEL: Record<MediaKind, string> = { series: "Series", movie: "Movies", channel: "Live TV", link: "Links" };

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

  return (
    <div>
      <PageHeader title="Media" subtitle="Series, films and live TV – where to watch and how far you are" />
      {/* Room at the end for the + button. */}
      <PageBody className={cn(FIELD_FOCUS.fuchsia, "pb-28 md:pb-28")}>
        <WatchingBanner media={all} />
        <div
          role="tablist"
          aria-label="Media"
          className="-mx-1 mb-4 no-scrollbar flex gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {MEDIA_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            const count = all.filter((m) => m.kind === k).length;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => changeTab(k)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors md:h-10 md:px-4 md:text-[0.95rem]",
                  tab === k
                    ? cn(fuchsia.soft, fuchsia.text, "font-semibold ring-[1.5px] ring-current/40 ring-inset")
                    : "text-muted well hover:text-fg",
                )}
              >
                <Icon className="size-4" />
                {TAB_LABEL[k]}
                {count > 0 && <span className="text-xs tabular opacity-60 max-md:hidden">{count}</span>}
              </button>
            );
          })}
        </div>

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
      </PageBody>

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
    </div>
  );
}

function SeriesCard({ title, onOpen }: { title: MediaTitle; onOpen: () => void }) {
  const state = useSeriesState(title);
  const { setSeen, touch } = useMediaActions();
  const next = state.next;
  const ready = next && next.aired;
  return (
    <Card as="article" className="flex-row gap-4 p-3 md:p-4">
      <button type="button" onClick={onOpen} aria-label={`Open ${title.title}`} className="w-20 shrink-0 md:w-24">
        <Poster src={title.poster_url} title={title.title} kind="series" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <button type="button" onClick={onOpen} className="min-w-0 text-left" tabIndex={-1}>
          <h3 className="truncate text-[1.05rem] leading-tight font-semibold">{title.title}</h3>
          <p className="mt-0.5 text-xs text-muted tabular">
            {state.total != null
              ? `${state.seen} of ${state.total} seen`
              : state.seen > 0
                ? `${state.seen} seen`
                : "Not started"}
          </p>
        </button>
        {state.total != null && state.total > 0 && <ProgressBar value={state.seen / state.total} className="mt-2" />}
        <div className="mt-auto pt-3">
          {state.loading ? (
            <div className="skeleton h-10 rounded-2xl" />
          ) : ready ? (
            <>
              <p className="truncate text-sm">
                <span className={cn("font-semibold", fuchsia.text)}>
                  Next · {formatEpisode(next.season, next.number)}
                </span>
                {next.name && <span className="text-muted"> · {next.name}</span>}
              </p>
              <div className="mt-2 flex gap-2">
                <WatchButton
                  href={watchUrl(title, next)}
                  onClick={() => touch(title)}
                  watching={{ id: title.id, title: title.title, season: next.season, episode: next.number }}
                  className="min-w-0 flex-1 sm:max-w-60"
                >
                  {formatEpisode(next.season, next.number)}
                </WatchButton>
                <Button
                  variant="secondary"
                  size="icon"
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
              <Check className={cn("size-4", fuchsia.text)} />
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
        <button
          key={m.id}
          type="button"
          onClick={() => onOpen(m)}
          aria-label={`${m.title}${m.watched ? " (seen)" : ""}`}
          className="group flex flex-col gap-2 rounded-2xl text-left"
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
                  fuchsia.solid,
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
      ))}
    </div>
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
