"use client";

import { Check, Film, Link2, type LucideIcon, Play, Radio, Tv, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MediaTitle } from "@/data/core";
import { episodeKey, formatEpisode, type MediaKind } from "@/lib/media";
import { textOn } from "@/lib/poster-color";
import { cn } from "@/lib/utils";
import { seenMessage, useMediaActions } from "./use-media-actions";
import { useWatching, type Watching } from "./use-watching";

export const KIND_LABEL: Record<MediaKind, string> = {
  series: "Series",
  movie: "Movie",
  channel: "Live TV",
  link: "Link",
};

/** The page's tabs (and the add sheet's kinds) from left to right: Links first, as a small icon. */
export const MEDIA_TABS: MediaKind[] = ["link", "series", "movie", "channel"];

export const TAB_LABEL: Record<MediaKind, string> = {
  series: "Series",
  movie: "Movies",
  channel: "Live TV",
  link: "Links",
};

export const KIND_ICON: Record<MediaKind, LucideIcon> = { series: Tv, movie: Film, channel: Radio, link: Link2 };

/** A title's colours (see .media-tone in globals.css): its poster's, or fuchsia. */
export const MEDIA_TONE = {
  solid: "bg-(--m) text-(--m-fg)",
  soft: "bg-(--m)/15",
  text: "text-(--m-text)",
  ring: "ring-(--m)/60",
};

/** Focused fields in the title's colour (on an element with `media-tone`). */
export const MEDIA_FIELD_FOCUS = "[--field-focus:color-mix(in_oklab,var(--m)_60%,transparent)]";

/** Put on the element with `media-tone`: the title's own colour, if it has one. */
export function mediaStyle(color: string | null | undefined): React.CSSProperties | undefined {
  if (!color || !/^#[0-9a-f]{6}$/.test(color)) return undefined;
  return { "--m-own": color, "--m-own-fg": textOn(color) } as React.CSSProperties;
}

/**
 * The big "Watch" button: opens the link in a new tab (without telling the site where
 * you came from) and remembers what you went to watch, to ask about it afterwards.
 */
export function WatchButton({
  href,
  watching,
  onClick,
  icon: Icon = Play,
  className,
  children,
}: {
  href: string | null;
  watching?: Omit<Watching, "at">;
  onClick?: () => void;
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  const { start } = useWatching();
  if (!href) {
    return (
      <Button variant="secondary" disabled className={className}>
        <Icon /> No link yet
      </Button>
    );
  }
  return (
    // A plain small shadow: the primary button's glow is the accent's – a light haze in Aurora Sky.
    <Button
      asChild
      variant="primary"
      className={cn("ui-action shadow-[0_2px_6px_-2px_rgb(0_0_0/0.3)]", MEDIA_TONE.solid, className)}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (watching) start(watching);
          onClick?.();
        }}
      >
        <Icon className="fill-current" /> {children}
      </a>
    </Button>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-(--m)/15", className)}>
      <div
        className={cn("h-full rounded-full bg-(--m) transition-[width] duration-500")}
        style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
      />
    </div>
  );
}

/**
 * Back from watching: "Seen S1 E4 of Bob's Burgers?" – one tap marks it (the
 * streaming sites can't tell us). Stays until answered.
 */
export function WatchingBanner({ media }: { media: MediaTitle[] }) {
  const { watching, clear } = useWatching();
  const { setSeen, setMovieSeen } = useMediaActions();
  const title = watching ? media.find((m) => m.id === watching.id) : null;
  if (!watching || !title) return null;
  const episode =
    watching.season != null && watching.episode != null ? { season: watching.season, number: watching.episode } : null;
  const what = episode ? `${formatEpisode(episode.season, episode.number)} of ${title.title}` : title.title;
  return (
    <div
      role="status"
      style={mediaStyle(title.color)}
      className={cn(
        "media-tone mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius-card) px-4 py-3",
        MEDIA_TONE.soft,
      )}
    >
      <Play className={cn("size-4 shrink-0 fill-current", MEDIA_TONE.text)} />
      <p className="min-w-0 flex-1 text-[0.95rem]">
        Watched <span className="font-semibold">{what}</span>?
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          className={cn("ui-action shadow-[0_2px_6px_-2px_rgb(0_0_0/0.3)]", MEDIA_TONE.solid)}
          variant="primary"
          onClick={() => {
            if (episode)
              setSeen(
                title,
                [episodeKey(episode.season, episode.number)],
                true,
                seenMessage(episode.season, episode.number),
              );
            else setMovieSeen(title, true);
            clear();
          }}
        >
          <Check /> Seen it
        </Button>
        <Button size="sm" variant="ghost" onClick={clear} aria-label="Not yet">
          <X /> Not yet
        </Button>
      </div>
    </div>
  );
}
