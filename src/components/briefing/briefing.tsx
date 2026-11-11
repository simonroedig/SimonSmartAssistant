"use client";

import { ChevronDown, Newspaper, Settings2, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CHIP, CHIP_IDLE, CHIP_ON } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import type { Briefing } from "@/data/core";
import { useBriefings, useMarkBriefingRead } from "@/data/briefings";
import { useNow } from "@/hooks/use-now";
import { useScrollToPressed } from "@/hooks/use-scroll-to-pressed";
import { useSwipe } from "@/hooks/use-swipe";
import { briefingState } from "@/lib/briefing";
import { afterSheetClosed } from "@/lib/history";
import {
  formatDayMonthShort,
  formatLongDate,
  formatTime,
  formatWeekday,
  formatWeekdayShort,
  toDayKey,
} from "@/lib/date";
import { TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { MarkdownView } from "./markdown-view";

/** The design's accent – in Aurora Sky it follows the sky. */
const tone = TONE_STYLES.accent;

/**
 * Home: the daily briefing, one tap away. A dot (and a little note under the button)
 * while today's is new; amber when today's run didn't come through.
 */
export function BriefingButton({ className }: { className?: string }) {
  const briefings = useBriefings();
  const now = useNow("minute");
  const [open, setOpen] = useState(false);
  const list = briefings.data ?? [];
  const state = now ? briefingState(list, now) : null;
  const trouble = !!state && (state.failed || (state.missing && list.length > 0));
  const label = state?.unread ? "Daily briefing (new)" : "Daily briefing";

  return (
    <div className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-label={label}
        title="Daily briefing"
        onClick={() => setOpen(true)}
        className={cn(
          "relative grid size-12 place-items-center rounded-2xl transition-colors hover:bg-surface-hover active:bg-surface-hover",
          tone.text,
        )}
      >
        <Newspaper className="size-[1.55rem]" strokeWidth={1.9} />
        {(state?.unread || trouble) && (
          <span
            data-briefing-dot={state?.unread ? "new" : "trouble"}
            className={cn(
              "absolute top-2 right-2 size-2.5 rounded-full ring-2 ring-bg",
              state?.unread ? "bg-accent" : "bg-amber-500 dark:bg-amber-300",
            )}
          />
        )}
      </button>
      {/* Today's is here and not read yet: a small note says so – a tap opens it. */}
      <AnimatePresence>
        {state?.unread && !open && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full right-0 z-20 mt-1 w-max max-w-[15rem] origin-top-right rounded-2xl px-3.5 py-2.5 text-left text-sm shadow-(--shadow-card) glass-strong"
          >
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="size-2 rounded-full bg-accent" /> Your briefing is here
            </span>
            <span className="block text-xs text-muted">
              {formatWeekday(new Date(state.latest!.created_at))} · tap to read
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      <BriefingSheet open={open} onClose={() => setOpen(false)} briefings={list} loading={briefings.isPending} />
    </div>
  );
}

export function BriefingSheet({
  open,
  onClose,
  briefings,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  briefings: Briefing[];
  loading: boolean;
}) {
  const now = useNow("minute");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const shown = briefings.find((b) => b.id === pickedId) ?? briefings[0] ?? null;
  const state = now ? briefingState(briefings, now) : null;
  const markRead = useMarkBriefingRead();
  const router = useRouter();
  const top = useRef<HTMLDivElement>(null);
  const row = useScrollToPressed(shown?.id ?? null);
  const scrollToTop = () => {
    for (let el = top.current?.parentElement; el; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== "visible") {
        el.scrollTo({ top: 0 });
        return;
      }
    }
  };

  // Opened: read (on every screen).
  const shownId = shown?.id;
  const shownUnread = !!shown && !shown.read_at;
  useEffect(() => {
    if (open && shownId && shownUnread) markRead.mutate({ id: shownId });
    // Once per opened briefing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shownId, shownUnread]);

  const close = () => {
    onClose();
    setPickedId(null);
  };

  // Picking a day: from its top. The briefing slides in from the side its chip is on.
  const index = shown ? briefings.findIndex((b) => b.id === shown.id) : -1;
  const [slide, setSlide] = useState({ id: shown?.id, direction: 1 });
  if (slide.id !== shown?.id) {
    const from = briefings.findIndex((b) => b.id === slide.id);
    setSlide({ id: shown?.id, direction: from >= 0 && index < from ? -1 : 1 });
  }
  const pick = (id: string) => {
    setPickedId(id);
    scrollToTop();
  };
  // Sideways swipes go through the days, like the notes' categories: to the left is
  // the chip to the right (the day before).
  const swipe = useSwipe(
    (direction) => {
      const next = briefings[index + direction];
      if (next) pick(next.id);
    },
    open && briefings.length > 1,
  );

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Daily briefing"
      description={
        shown ? `${formatLongDate(new Date(shown.created_at))} · ${formatTime(new Date(shown.created_at))}` : undefined
      }
      size="half"
    >
      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton h-6 w-1/2 rounded-lg" />
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-24 rounded-xl" />
        </div>
      ) : !shown ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-muted">
            No briefing yet. It is written each morning by a scheduled Claude task – set it up in Settings.
          </p>
          <SettingsLink onClick={close} />
        </div>
      ) : (
        <div ref={top} className="flex [touch-action:pan-y] flex-col gap-5" {...swipe}>
          {/* The days, up top: picking one never moves them, and the briefing starts from its top. */}
          {briefings.length > 1 && (
            <div
              ref={row}
              role="group"
              aria-label="Briefings"
              // Sideways it scrolls the days, not the briefing.
              data-swipe
              className="-mx-6 -mt-1 no-scrollbar flex gap-1.5 overflow-x-auto px-6 pb-0.5"
            >
              {briefings.map((b) => {
                const at = new Date(b.created_at);
                const on = b.id === shown.id;
                // Two on one day (e.g. one started by hand): told apart by the time.
                const sameDay = briefings.some(
                  (o) => o.id !== b.id && toDayKey(new Date(o.created_at)) === toDayKey(at),
                );
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(b.id)}
                    className={cn(CHIP, "h-8 shrink-0 text-xs", on ? cn(tone.soft, tone.text, CHIP_ON) : CHIP_IDLE)}
                  >
                    {b.status === "error" && <TriangleAlert className="size-3.5 text-amber-500" />}
                    {formatWeekdayShort(at)} {formatDayMonthShort(at)}
                    {sameDay && <span className="opacity-70">{formatTime(at)}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <motion.div
            key={shown.id}
            initial={{ opacity: 0, x: slide.direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex flex-col gap-5"
          >
            {/* Today's hasn't come (yet): say so above the last one there is. */}
            {state?.missing && shown.id === briefings[0]?.id && (
              <Notice>
                No briefing today yet – the scheduled run didn&apos;t hand one in (maybe Claude&apos;s usage limit was
                reached). Here is the last one.
              </Notice>
            )}
            {shown.status === "error" ? (
              <Notice>
                <span className="font-semibold">This briefing couldn&apos;t be made.</span>{" "}
                {shown.error ?? "The run didn't finish."} The run&apos;s details are in Claude → Scheduled.
              </Notice>
            ) : (
              <MarkdownView
                text={shown.content}
                plan={{
                  writtenAt: new Date(shown.created_at),
                  // To the planner, the editor open with it as an all-day entry (not saved yet).
                  onPlan: (item) => {
                    const params = new URLSearchParams({ day: item.day, add: item.title, allday: "1" });
                    if (item.source) params.set("notes", item.source);
                    close();
                    afterSheetClosed(() => router.push(`/planner?${params}`));
                  },
                }}
              />
            )}

            {shown.prompt && (
              <details className="group rounded-2xl px-4 py-3 well">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
                  Prompt used
                  <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 max-h-72 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-muted">
                  {shown.prompt}
                </p>
                <div className="mt-3">
                  <SettingsLink onClick={close} label="Change the prompt in Settings" />
                </div>
              </details>
            )}
          </motion.div>
        </div>
      )}
    </Sheet>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2.5 rounded-2xl bg-amber-500/12 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
      <span>{children}</span>
    </p>
  );
}

function SettingsLink({ onClick, label = "Daily briefing in Settings" }: { onClick: () => void; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        // The sheet gives its history entry back first; then on to Settings.
        onClick();
        window.setTimeout(() => router.push("/settings#briefing"), 350);
      }}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
    >
      <Settings2 className="size-4" /> {label}
    </button>
  );
}
