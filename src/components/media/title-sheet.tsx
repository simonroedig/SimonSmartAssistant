"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowUp,
  Check,
  ChevronDown,
  ExternalLink,
  Link2,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { CHIP, CHIP_IDLE, CHIP_ON } from "@/components/ui/chip";
import type { MediaTitle } from "@/data/core";
import { type Found, searchFilms, searchShows, useDeleteMedia } from "@/data/media";
import { formatDayMonthYear, fromDayKey } from "@/lib/date";
import {
  type Episode,
  episodeKey,
  episodesUpTo,
  formatEpisode,
  hasEpisodeSlots,
  isWebLink,
  linkLabel,
  type MediaKind,
  type MediaSource,
  sampleLink,
  seasonsOf,
  sourcesOf,
  toEpisodeTemplate,
} from "@/lib/media";
import { cn } from "@/lib/utils";
import { KIND_LABEL, MEDIA_FIELD_FOCUS, MEDIA_TONE, mediaStyle, WatchButton } from "./media-parts";
import { Poster } from "./poster";
import { useMediaActions, useSeriesState, watchUrl } from "./use-media-actions";

/** Details of a title: what it's about, where to watch it, how far you are – and editing it. */
export function TitleSheet({ title, onClose }: { title: MediaTitle | null; onClose: () => void }) {
  // Keeps the name while the sheet slides away.
  const [last, setLast] = useState(title);
  if (title && title !== last) setLast(title);
  return (
    <Sheet
      open={!!title}
      onOpenChange={(open) => !open && onClose()}
      title={last?.title ?? ""}
      description={last ? KIND_LABEL[last.kind as MediaKind] : undefined}
      size="lg"
    >
      {title && <Details key={title.id} title={title} onClose={onClose} />}
    </Sheet>
  );
}

function Details({ title, onClose }: { title: MediaTitle; onClose: () => void }) {
  const kind = title.kind as MediaKind;
  return (
    // Everything in the title's colour – the frame of a focused field too.
    <div style={mediaStyle(title.color)} className={cn("media-tone flex flex-col gap-6", MEDIA_FIELD_FOCUS)}>
      {(kind === "series" || kind === "movie") && <About title={title} />}
      {kind === "series" && <SeriesProgress title={title} />}
      {kind === "movie" && <MovieProgress title={title} />}
      {(kind === "channel" || kind === "link") && (
        <WatchButton href={watchUrl(title)} className="self-start" icon={kind === "link" ? ExternalLink : Play}>
          {kind === "link" ? "Open" : "Watch live"}
        </WatchButton>
      )}
      <Sources title={title} />
      <Edit title={title} />
      <Remove title={title} onRemoved={onClose} />
    </div>
  );
}

function About({ title }: { title: MediaTitle }) {
  const [more, setMore] = useState(false);
  const kind = title.kind as "series" | "movie";
  return (
    <div className="flex gap-4">
      <Poster src={title.poster_url} title={title.title} kind={kind} className="w-24 md:w-28" />
      <div className="min-w-0 flex-1">
        {title.year && <p className="text-sm font-medium text-muted tabular">{title.year}</p>}
        {title.summary ? (
          <>
            <p
              className={cn(
                "mt-1 text-[0.92rem] leading-relaxed whitespace-pre-line text-muted",
                !more && "line-clamp-5",
              )}
            >
              {title.summary}
            </p>
            {title.summary.length > 240 && (
              <button
                type="button"
                onClick={() => setMore(!more)}
                className="mt-1 text-sm font-medium text-muted hover:text-fg"
              >
                {more ? "Less" : "More"}
              </button>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-faint">No summary – look it up again below.</p>
        )}
      </div>
    </div>
  );
}

function MovieProgress({ title }: { title: MediaTitle }) {
  const { setMovieSeen, touch } = useMediaActions();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <WatchButton href={watchUrl(title)} onClick={() => touch(title)} watching={{ id: title.id, title: title.title }}>
        Watch
      </WatchButton>
      <label className="flex h-11 items-center gap-3 rounded-2xl px-4 well">
        <span className="text-sm font-medium">Seen</span>
        <Switch checked={title.watched} onCheckedChange={(on) => setMovieSeen(title, on)} label="Seen" />
      </label>
    </div>
  );
}

function SeriesProgress({ title }: { title: MediaTitle }) {
  const state = useSeriesState(title);
  const { setSeen, touch } = useMediaActions();
  const seasons = state.episodes ? seasonsOf(state.episodes) : [];
  const [season, setSeason] = useState<number | null>(null);
  const [catchUp, setCatchUp] = useState<string[]>([]);
  const shown = season ?? state.next?.season ?? seasons.at(-1) ?? 1;
  const next = state.next;

  return (
    <div className="flex flex-col gap-4">
      {next && next.aired ? (
        <div className="flex flex-wrap items-center gap-3">
          <WatchButton
            href={watchUrl(title, next)}
            onClick={() => touch(title)}
            watching={{ id: title.id, title: title.title, season: next.season, episode: next.number }}
          >
            Watch {formatEpisode(next.season, next.number)}
          </WatchButton>
          <Button variant="secondary" onClick={() => setSeen(title, [episodeKey(next.season, next.number)], true)}>
            <Check /> Seen
          </Button>
          {next.name && <p className="min-w-0 basis-full truncate text-sm text-muted">{next.name}</p>}
        </div>
      ) : (
        <p className="text-sm text-muted">
          {next && next.airdate
            ? `Up to date – ${formatEpisode(next.season, next.number)} comes on ${formatDayMonthYear(fromDayKey(next.airdate))}.`
            : "All seen."}
        </p>
      )}

      {state.loading && <div className="skeleton h-40 rounded-2xl" />}
      {state.failed && <p className="text-sm text-muted">Couldn&apos;t load the episodes right now.</p>}
      {state.episodes && seasons.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label className="mb-0">Seasons</Label>
            <SeasonToggle
              episodes={state.episodes.filter((e) => e.season === shown)}
              watched={state.watched}
              onSet={(keys, seen) => {
                setSeen(title, keys, seen);
                setCatchUp([]);
              }}
            />
          </div>
          {/* Scrolls sideways itself: a swipe here doesn't do anything else. */}
          <div className="-mx-1 mt-2 no-scrollbar flex gap-1.5 overflow-x-auto px-1 pb-1" data-swipe>
            {seasons.map((s) => {
              const eps = state.episodes!.filter((e) => e.season === s);
              const all = eps.every((e) => state.watched.has(episodeKey(e.season, e.number)));
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={s === shown}
                  onClick={() => setSeason(s)}
                  className={cn(CHIP, "gap-1", s === shown ? cn(MEDIA_TONE.soft, MEDIA_TONE.text, CHIP_ON) : CHIP_IDLE)}
                >
                  {all && <Check className="size-3.5" />}
                  {s}
                </button>
              );
            })}
          </div>
          {catchUp.length > 0 && (
            <div
              role="status"
              className={cn(
                "mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-2.5",
                MEDIA_TONE.soft,
              )}
            >
              <p className="min-w-0 flex-1 text-sm">
                {catchUp.length} earlier {catchUp.length === 1 ? "episode isn't" : "episodes aren't"} marked yet.
              </p>
              <Button
                size="sm"
                variant="primary"
                className={cn("ui-action shadow-[0_2px_6px_-2px_rgb(0_0_0/0.3)]", MEDIA_TONE.solid)}
                onClick={() => {
                  setSeen(title, catchUp, true);
                  setCatchUp([]);
                }}
              >
                <Check /> Mark them too
              </Button>
              <Button size="sm" variant="ghost" aria-label="No, leave them" onClick={() => setCatchUp([])}>
                <X />
              </Button>
            </div>
          )}
          <EpisodeList
            title={title}
            episodes={state.episodes.filter((e) => e.season === shown)}
            all={state.episodes}
            watched={state.watched}
            onSeen={(keys, seen) => {
              setSeen(title, keys, seen);
              setCatchUp([]);
            }}
            onCatchUp={setCatchUp}
            onWatch={() => touch(title)}
          />
        </div>
      )}
      {!title.tvmaze_id && (
        <p className="text-sm text-faint">
          No episode list for this one – look it up on TVmaze below to get its seasons and summaries.
        </p>
      )}
    </div>
  );
}

function SeasonToggle({
  episodes,
  watched,
  onSet,
}: {
  episodes: Episode[];
  watched: Set<string>;
  onSet: (keys: string[], seen: boolean) => void;
}) {
  const keys = episodes.map((e) => episodeKey(e.season, e.number));
  const all = keys.length > 0 && keys.every((k) => watched.has(k));
  return (
    <button
      type="button"
      onClick={() => onSet(keys, !all)}
      className="text-sm font-medium text-muted transition-colors hover:text-fg"
    >
      {all ? "Mark season unseen" : "Mark season seen"}
    </button>
  );
}

function EpisodeList({
  title,
  episodes,
  all,
  watched,
  onSeen,
  onCatchUp,
  onWatch,
}: {
  title: MediaTitle;
  episodes: Episode[];
  all: Episode[];
  watched: Set<string>;
  onSeen: (keys: string[], seen: boolean) => void;
  /** Earlier episodes still unmarked when one is ticked (none: empty). */
  onCatchUp: (keys: string[]) => void;
  onWatch: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {episodes.map((e) => {
        const key = episodeKey(e.season, e.number);
        const seen = watched.has(key);
        const expanded = open === key;
        const url = watchUrl(title, e);
        return (
          <li key={key} className={cn("rounded-2xl transition-colors well", seen && "opacity-70")}>
            <div className="flex items-center gap-1 pr-1.5">
              <button
                type="button"
                aria-label={
                  seen
                    ? `${formatEpisode(e.season, e.number)}: mark unseen`
                    : `${formatEpisode(e.season, e.number)}: mark seen`
                }
                aria-pressed={seen}
                onClick={() => {
                  if (seen) return onSeen([key], false);
                  onSeen([key], true);
                  // Seen this one: probably the ones before too – offered right above the list.
                  onCatchUp(episodesUpTo(all, e).filter((k) => k !== key && !watched.has(k)));
                }}
                className="grid size-11 shrink-0 place-items-center"
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border-2 transition-colors",
                    seen ? cn("border-transparent", MEDIA_TONE.solid) : "border-line-strong",
                  )}
                >
                  {seen && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : key)}
                className="flex min-w-0 flex-1 items-center gap-2 py-2.5 text-left"
              >
                <span className="w-9 shrink-0 text-sm font-semibold text-muted tabular">E{e.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.name}</span>
                  {e.airdate && (
                    <span className="block text-xs text-faint tabular">
                      {formatDayMonthYear(fromDayKey(e.airdate))}
                      {e.runtime ? ` · ${e.runtime} min` : ""}
                    </span>
                  )}
                </span>
                {e.summary && (
                  <ChevronDown
                    className={cn("size-4 shrink-0 text-faint transition-transform", expanded && "rotate-180")}
                  />
                )}
              </button>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onWatch}
                  aria-label={`Play ${formatEpisode(e.season, e.number)}`}
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full transition-colors",
                    MEDIA_TONE.text,
                    "hover:bg-surface-hover",
                  )}
                >
                  <Play className="size-4 fill-current" />
                </a>
              )}
            </div>
            {expanded && e.summary && <p className="px-4 pb-3 text-sm leading-relaxed text-muted">{e.summary}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/** Where to watch: the first link is the one used; more are spares for when one stops working. */
function Sources({ title }: { title: MediaTitle }) {
  const { update } = useMediaActions();
  const sources = sourcesOf(title.sources);
  const kind = title.kind as MediaKind;
  const [draft, setDraft] = useState("");
  const save = (next: MediaSource[]) => update.mutate({ id: title.id, patch: { sources: next } });
  const add = () => {
    const raw = draft.trim();
    if (!isWebLink(raw)) return;
    const url = kind === "series" ? (toEpisodeTemplate(raw) ?? raw) : raw;
    const source = { label: linkLabel(url), url };
    // An episode link for a site whose link was only the series page takes its place.
    const stale =
      kind === "series" && hasEpisodeSlots(url)
        ? sources.findIndex((s) => s.label === source.label && !hasEpisodeSlots(s.url))
        : -1;
    save(stale >= 0 ? sources.map((s, i) => (i === stale ? source : s)) : [...sources, source]);
    setDraft("");
  };

  return (
    <div>
      <Label>{kind === "channel" || kind === "link" ? "Link" : "Where to watch"}</Label>
      {sources.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`} className="flex items-center gap-1 rounded-2xl py-1 pr-1 pl-3.5 well">
              <Link2 className="size-4 shrink-0 text-faint" />
              <div className="min-w-0 flex-1 px-1.5">
                <p className="truncate text-sm font-medium">
                  {s.label}
                  {i === 0 && sources.length > 1 && (
                    <span className="ml-1.5 text-xs font-normal text-faint">used first</span>
                  )}
                </p>
                <p className="truncate text-xs text-faint">{sampleLink(s.url).replace(/^https?:\/\//, "")}</p>
                {kind === "series" && <EpisodeLinkStatus url={s.url} />}
              </div>
              <a
                href={sampleLink(s.url)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${s.label}`}
                className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <ExternalLink className="size-4" />
              </a>
              {i > 0 && (
                <button
                  type="button"
                  aria-label={`Use ${s.label} first`}
                  onClick={() => save([s, ...sources.filter((_, j) => j !== i)])}
                  className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
                >
                  <ArrowUp className="size-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={`Remove ${s.label}`}
                onClick={() => save(sources.filter((_, j) => j !== i))}
                className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input
          aria-label="Add a link"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          inputMode="url"
          placeholder={
            kind === "series"
              ? sources.length
                ? "Another site – paste a link to any episode"
                : "Paste a link to any episode"
              : sources.length
                ? "Another link"
                : "Paste the link"
          }
        />
        <Button
          type="submit"
          variant="secondary"
          size="icon"
          aria-label="Add the link"
          disabled={!isWebLink(draft.trim())}
        >
          <Plus />
        </Button>
      </form>
      {kind === "series" && <EpisodeLinkHint />}
    </div>
  );
}

function Edit({ title }: { title: MediaTitle }) {
  const { update } = useMediaActions();
  const kind = title.kind as MediaKind;
  const [name, setName] = useState(title.title);
  const [lookup, setLookup] = useState(false);
  const commitName = () => {
    const next = name.trim();
    if (next && next !== title.title) update.mutate({ id: title.id, patch: { title: next } });
    else setName(title.title);
  };
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label htmlFor="media-name">Name</Label>
        <Input
          id="media-name"
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </div>
      {(kind === "series" || kind === "movie") &&
        (lookup ? (
          <LookUp
            kind={kind}
            initial={title.title}
            year={title.year}
            onPick={(found) => {
              // A new poster: its colour is found anew.
              update.mutate({ id: title.id, patch: { ...found, color: null } });
              setName(found.title);
              setLookup(false);
            }}
          />
        ) : (
          <Button variant="secondary" className="self-start" onClick={() => setLookup(true)}>
            <Search /> {kind === "series" ? "Wrong show? Look it up again" : "Wrong film? Look it up again"}
          </Button>
        ))}
    </div>
  );
}

/** Whether a series link leads to each episode – or only to the series' page. */
export function EpisodeLinkStatus({ url }: { url: string }) {
  return hasEpisodeSlots(url) ? (
    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
      <Check className="size-3.5" /> Opens each episode directly
    </p>
  ) : (
    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-300">
      <TriangleAlert className="size-3.5 shrink-0" /> The series page only – paste a link to one episode
    </p>
  );
}

/** How to give a series its link: one episode's, from which every other one follows. */
export function EpisodeLinkHint() {
  return (
    <p className="mt-1.5 px-1 text-xs text-faint">
      Paste the link of <span className="font-semibold text-muted underline">one episode</span> (e.g. season 1, episode
      1) – the link of every other episode is worked out from it.
    </p>
  );
}

/** Find a title on TVmaze (series) or Wikipedia (films) and pick it. */
export function LookUp({
  kind,
  initial,
  year,
  onPick,
  picked,
  autoPick = false,
}: {
  kind: "series" | "movie";
  initial: string;
  year: number | null;
  onPick: (found: Found) => void;
  /** The one currently chosen (marked in the list). */
  picked?: Found | null;
  /** Choose the best match by itself (adding a title). */
  autoPick?: boolean;
}) {
  const [query, setQuery] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);
  // Searches as you type (a moment after the last key).
  useEffect(() => {
    const timer = window.setTimeout(() => setSubmitted(query.trim()), 450);
    return () => window.clearTimeout(timer);
  }, [query]);
  const results = useQuery({
    queryKey: ["media-lookup", kind, submitted, year],
    queryFn: () => (kind === "series" ? searchShows(submitted) : searchFilms(submitted, year)),
    enabled: submitted.trim().length > 1,
    staleTime: 60 * 60_000,
    meta: { persist: false },
  });
  const best = results.data?.[0];
  useEffect(() => {
    if (autoPick && best && !picked) onPick(best);
    // Only when new results arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [best]);
  return (
    <div>
      {/* Not a form of its own: it sits inside the add form, and Enter here only searches. */}
      <div className="flex gap-2">
        <Input
          aria-label={kind === "series" ? "Search TVmaze" : "Search Wikipedia"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            setSubmitted(query.trim());
          }}
          enterKeyHint="search"
          placeholder={kind === "series" ? "Search the show" : "Search the film"}
        />
        <Button variant="secondary" size="icon" aria-label="Search" onClick={() => setSubmitted(query.trim())}>
          <Search />
        </Button>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {results.isFetching && <div className="skeleton h-20 rounded-2xl" />}
        {results.isError && <p className="px-1 text-sm text-muted">The lookup isn&apos;t reachable right now.</p>}
        {!results.isFetching && results.data?.length === 0 && (
          <p className="px-1 text-sm text-muted">Nothing found – try another spelling.</p>
        )}
        {!results.isFetching &&
          results.data?.map((found) => {
            const on = picked != null && picked.title === found.title && picked.year === found.year;
            return (
              <button
                key={`${found.tvmaze_id ?? ""}-${found.title}-${found.year ?? ""}`}
                type="button"
                aria-pressed={on}
                onClick={() => onPick(found)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-2 text-left transition-colors well hover:bg-surface-hover",
                  on && cn("ring-2 ring-inset", MEDIA_TONE.ring),
                )}
              >
                <Poster src={found.poster_url} title={found.title} kind={kind} className="w-10 rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{found.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {[found.year, found.summary?.slice(0, 80)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {on && <Check className={cn("size-4 shrink-0", MEDIA_TONE.text)} />}
              </button>
            );
          })}
        <p className="px-1 text-[0.7rem] text-faint">
          {kind === "series" ? "Show info from TVmaze" : "Film info from Wikipedia"}
        </p>
      </div>
    </div>
  );
}

function Remove({ title, onRemoved }: { title: MediaTitle; onRemoved: () => void }) {
  const remove = useDeleteMedia();
  const [sure, setSure] = useState(false);
  return (
    <div className="flex items-center gap-2 border-t border-line pt-4">
      {sure ? (
        <>
          <Button
            variant="danger"
            onClick={() => {
              remove.mutate({ id: title.id });
              onRemoved();
            }}
          >
            <Trash2 /> Delete for good
          </Button>
          <Button variant="ghost" onClick={() => setSure(false)}>
            <RotateCcw /> Keep it
          </Button>
        </>
      ) : (
        <Button variant="ghost" className="text-muted" onClick={() => setSure(true)}>
          <Trash2 /> Delete
        </Button>
      )}
    </div>
  );
}
