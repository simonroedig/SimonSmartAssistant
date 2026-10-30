"use client";

import { Check, Film, Link2, type LucideIcon, Play, Radio, Tv, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MediaTitle } from "@/data/core";
import { episodeKey, formatEpisode, type MediaKind } from "@/lib/media";
import { TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { seenMessage, useMediaActions } from "./use-media-actions";
import { useWatching, type Watching } from "./use-watching";

export const KIND_LABEL: Record<MediaKind, string> = {
  series: "Series",
  movie: "Film",
  channel: "Live TV",
  link: "Link",
};

export const KIND_ICON: Record<MediaKind, LucideIcon> = { series: Tv, movie: Film, channel: Radio, link: Link2 };

const fuchsia = TONE_STYLES.fuchsia;

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
    <Button asChild variant="primary" className={cn("ui-action", fuchsia.solid, className)}>
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
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-surface-sunken", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", fuchsia.solid)}
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
      className={cn("mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-(--radius-card) px-4 py-3", fuchsia.soft)}
    >
      <Play className={cn("size-4 shrink-0 fill-current", fuchsia.text)} />
      <p className="min-w-0 flex-1 text-[0.95rem]">
        Watched <span className="font-semibold">{what}</span>?
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          className={cn("ui-action", fuchsia.solid)}
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
