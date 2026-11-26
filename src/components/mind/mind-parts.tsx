"use client";

import { Pencil, Play } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import type { MindItem } from "@/data/core";
import { styledParts, videoInfo } from "@/lib/mind";
import { TODAY_CARD, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";

export const MIND_TONE = TONE_STYLES.teal;

/** A card's text: ==highlighted== like a highlighter on paper, *italic*, or both. */
export function StyledText({ text }: { text: string }) {
  return (
    <>
      {styledParts(text).map((part, i) => {
        const Tag = part.mark ? "mark" : part.italic ? "em" : "span";
        return (
          <Tag
            key={i}
            className={cn(
              part.italic && "italic",
              part.mark &&
                "rounded-[0.25em] bg-teal-300/45 box-decoration-clone px-[0.15em] text-inherit dark:bg-teal-300/22",
            )}
          >
            {part.text}
          </Tag>
        );
      })}
    </>
  );
}

/** The text's biggest size that fits its box: from 1.6rem down to 0.85rem, again when the box resizes. */
function useFitText(on: boolean, content: string) {
  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const outer = box.current;
    const inner = text.current;
    if (!on || !outer || !inner) return;
    const fit = () => {
      let size = 1.6;
      inner.style.fontSize = `${size}rem`;
      while (size > 0.85 && inner.offsetHeight > outer.clientHeight) {
        size = Math.round((size - 0.05) * 100) / 100;
        inner.style.fontSize = `${size}rem`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [on, content]);
  return { box, text };
}

/**
 * A reminder as a card: a title, the text, and who said it in small capitals. `large`
 * for flipping through them (always the same size; the one for today framed); small
 * ones (the list) can be cut after a few lines (`clamp`).
 */
export function ReminderCard({
  card,
  large = false,
  today = false,
  clamp = false,
  onOpen,
  className,
}: {
  card: Pick<MindItem, "title" | "body" | "source"> & { number?: number | null };
  large?: boolean;
  today?: boolean;
  clamp?: boolean;
  /** Without it, the card is only shown (a preview). */
  onOpen?: () => void;
  className?: string;
}) {
  const Tag = onOpen ? "button" : "div";
  const { box, text } = useFitText(large, `${card.title}\n${card.body}`);
  return (
    <Tag
      {...(onOpen ? { type: "button" as const, onClick: onOpen } : {})}
      className={cn(
        "relative block w-full overflow-hidden border border-line bg-surface/55 text-left shadow-(--shadow-card) backdrop-blur-md",
        today
          ? cn(
              TODAY_CARD,
              "bg-[radial-gradient(120%_90%_at_50%_0%,color-mix(in_oklab,var(--color-teal-400)_24%,transparent),transparent_70%)]",
            )
          : "bg-[linear-gradient(150deg,color-mix(in_oklab,var(--color-teal-400)_13%,transparent),transparent_55%)]",
        large
          ? "flex flex-col rounded-(--radius-card) px-6 pt-9 pb-6 text-center md:px-10 md:pt-10 md:pb-7"
          : "rounded-2xl px-3.5 pt-3 pb-3",
        onOpen && "transition-[filter,scale] hover:brightness-[1.04] active:scale-[0.99]",
        className,
      )}
    >
      {large ? (
        // A fixed size: the text takes the biggest type that still fits (and scrolls if even
        // the smallest doesn't), centred in the card.
        <span
          ref={box}
          // Only up and down here: a sideways swipe stays the card's (a scroll box would otherwise
          // hand it to the browser, and the swipe would stop halfway).
          className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-y-auto [scrollbar-width:none]"
        >
          <span ref={text} className="my-auto block text-[1.6rem]">
            {card.title && (
              <span className="block text-[1.3em] leading-tight font-semibold tracking-tight text-balance">
                {card.title}
              </span>
            )}
            <span
              className={cn(
                "block leading-relaxed whitespace-pre-line text-fg/90 [overflow-wrap:anywhere]",
                card.title && "mt-[0.5em]",
              )}
            >
              <StyledText text={card.body} />
            </span>
          </span>
        </span>
      ) : (
        <>
        {card.title && (
          <span
            className={cn(
              "block font-semibold tracking-tight text-balance",
              card.number != null && "pr-5",
              "text-[0.95rem] leading-snug",
            )}
          >
            {card.title}
          </span>
        )}
        <span
          className={cn(
            "block whitespace-pre-line [overflow-wrap:anywhere]",
            card.title && (large ? "mt-2.5" : "mt-1"),
            !card.title && card.number != null && !large && "pr-5",
            large
              ? "text-[1.1rem] leading-relaxed text-fg/90 md:text-[1.25rem]"
              : "text-[0.85rem] leading-snug text-fg/80",
            clamp && "line-clamp-6",
          )}
        >
          <StyledText text={card.body} />
        </span>
        </>
      )}
      {card.source && (
        <span
          className={cn(
            "block font-semibold text-faint uppercase",
            large ? "mt-4 shrink-0 text-[0.7rem] tracking-[0.14em]" : "mt-2 truncate text-[0.62rem] tracking-[0.1em]",
          )}
        >
          — {card.source}
        </span>
      )}
      {card.number != null && (
        // Its number, quietly in the corner ("today it's No. 7") – last, so the card is named by its text.
        <span
          className={cn(
            "absolute font-semibold text-faint tabular-nums",
            large ? "top-3.5 right-4.5 text-xs md:top-4 md:right-5" : "top-2.5 right-3 text-[0.68rem]",
          )}
        >
          {large ? `No. ${card.number}` : card.number}
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
