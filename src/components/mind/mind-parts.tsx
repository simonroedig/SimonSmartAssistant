"use client";

import { Pencil, Play } from "lucide-react";
import type { MindItem } from "@/data/core";
import { markedParts, videoInfo } from "@/lib/mind";
import { TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";

export const MIND_TONE = TONE_STYLES.teal;

/** A card's text: ==marked== words like a highlighter on paper. */
export function MarkedText({ text }: { text: string }) {
  return (
    <>
      {markedParts(text).map((part, i) =>
        part.mark ? (
          <mark
            key={i}
            className="rounded-[0.25em] bg-teal-300/45 box-decoration-clone px-[0.15em] text-inherit dark:bg-teal-300/22"
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * A reminder as a card: set like a page of a good book – a serif title, the text, and
 * who said it in small capitals. `large` for the one of the day.
 */
export function ReminderCard({
  card,
  large = false,
  onOpen,
  className,
}: {
  card: Pick<MindItem, "title" | "body" | "source">;
  large?: boolean;
  /** Without it, the card is only shown (a preview). */
  onOpen?: () => void;
  className?: string;
}) {
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      {...(onOpen ? { type: "button" as const, onClick: onOpen } : {})}
      className={cn(
        "relative block w-full overflow-hidden rounded-(--radius-card) border border-line bg-surface/55 text-left shadow-(--shadow-card) backdrop-blur-md",
        "bg-[linear-gradient(150deg,color-mix(in_oklab,var(--color-teal-400)_13%,transparent),transparent_55%)]",
        // The one of the day: centred, like a printed card.
        large ? "px-6 pt-7 pb-6 text-center md:px-10 md:pt-9 md:pb-7" : "px-5 pt-5 pb-4",
        onOpen && "transition-[filter,scale] hover:brightness-[1.04] active:scale-[0.99]",
        className,
      )}
    >
      {card.title && (
        <span
          className={cn(
            "relative block font-serif leading-[1.12] font-semibold tracking-tight text-balance",
            large ? "text-[1.75rem] md:text-[2.1rem]" : "text-[1.3rem]",
          )}
        >
          {card.title}
        </span>
      )}
      <span
        className={cn(
          "relative block font-serif whitespace-pre-line text-fg/90 [overflow-wrap:anywhere]",
          card.title && (large ? "mt-3" : "mt-2"),
          large ? "text-[1.2rem] leading-relaxed md:text-[1.3rem]" : "text-[1.02rem] leading-relaxed",
        )}
      >
        <MarkedText text={card.body} />
      </span>
      {card.source && (
        <span className="relative mt-4 block text-[0.7rem] font-semibold tracking-[0.14em] text-faint uppercase">
          — {card.source}
        </span>
      )}
    </Tag>
  );
}

/** A pinned video: its still (YouTube) or the platform's colours, a tap plays it. */
export function VideoTile({ video, onEdit }: { video: MindItem; onEdit: () => void }) {
  const info = videoInfo(video.url);
  const title = video.title || `A ${info.label} video`;
  return (
    <article className="relative overflow-hidden rounded-(--radius-card) glass">
      <a href={video.url ?? undefined} target="_blank" rel="noopener noreferrer" className="group block">
        <span className="relative block aspect-video overflow-hidden bg-[linear-gradient(135deg,color-mix(in_oklab,var(--color-teal-500)_45%,#0b1220),color-mix(in_oklab,var(--color-fuchsia-500)_30%,#0b1220))]">
          {info.thumbnail && (
            // Plain <img>: the still comes straight from YouTube (no image optimisation to pay for).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={info.thumbnail}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              // Not reachable (offline …): the platform's colours instead of a broken image.
              onError={(e) => (e.currentTarget.style.display = "none")}
              className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          )}
          <span className="absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0/0.35),transparent_55%)]" />
          <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-0.5 text-[0.72rem] font-semibold text-white backdrop-blur-sm">
            {info.label}
          </span>
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-14 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform group-hover:scale-105">
              <Play className="size-6 translate-x-0.5" fill="currentColor" />
            </span>
          </span>
        </span>
        <span className="block px-4 pt-3 pb-3.5 pr-12">
          <span className="line-clamp-2 block leading-snug font-semibold">{title}</span>
          {video.body && <span className="mt-1 line-clamp-3 block text-sm text-muted">{video.body}</span>}
        </span>
      </a>
      <button
        type="button"
        aria-label={`Edit ${title}`}
        onClick={onEdit}
        className="absolute right-1.5 bottom-1.5 grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
      >
        <Pencil className="size-4" />
      </button>
    </article>
  );
}
