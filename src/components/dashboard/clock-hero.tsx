"use client";

import { BriefingFooter } from "@/components/briefing/briefing";
import { useNow } from "@/hooks/use-now";
import { formatDayMonth, formatTime, formatWeekday, greeting, isoWeek, toDayKey } from "@/lib/date";
import { cn } from "@/lib/utils";

/** Text boxes trimmed to the letters, so the gaps between the lines are exactly what they say. */
const TRIM = "[text-box:trim-both_cap_alphabetic]";

/**
 * Home's first tile: the big clock, beside it – after a thin line – the greeting, weekday,
 * date and week; the daily briefing as its footer. A tile like the others (and as wide), but
 * frosted glass, so Aurora Sky's sky, sun and moon glow through it.
 */
export function ClockHero({ className, wide = false }: { className?: string; wide?: boolean }) {
  const now = useNow("minute");

  return (
    <section
      className={cn(
        "@container relative flex min-w-0 flex-col overflow-hidden rounded-(--radius-card) border border-line bg-surface/35 shadow-(--shadow-card) backdrop-blur-md",
        className,
      )}
    >
      {now ? (
        // Aurora Sky puts its moon in here, right of the date – above the briefing.
        <div data-sky-window className={cn("flex items-center gap-4 px-5", wide ? "pt-6 pb-5" : "pt-5 pb-4")}>
          <time
            dateTime={now.toISOString()}
            className={cn(
              "ui-display block shrink-0 font-extralight tracking-[-0.045em] tabular",
              TRIM,
              // As big as the tile allows next to the date (≈ 2.45em wide): ~4.4rem on a phone.
              "text-[clamp(3.25rem,calc(40cqw-4.5rem),8rem)]",
            )}
          >
            {formatTime(now)}
          </time>
          {/* The sun and moon pass behind this, through the frosted glass (see the sky controller). */}
          <div
            data-sky-beside
            className={cn("flex min-w-0 flex-col border-l border-line pl-4", wide ? "gap-3" : "gap-2.5")}
          >
            <p className={cn("font-medium whitespace-nowrap text-muted", wide ? "text-sm" : "text-xs", TRIM)}>
              {greeting(now)}
            </p>
            <p className={cn("font-semibold tracking-tight whitespace-nowrap", wide ? "text-2xl" : "text-xl", TRIM)}>
              {formatWeekday(now)}
            </p>
            <p className={cn("whitespace-nowrap", wide ? "text-base" : "text-sm", TRIM)}>{formatDayMonth(now)}</p>
            <p className={cn("whitespace-nowrap text-muted tabular", wide ? "text-sm" : "text-xs", TRIM)}>
              Week {isoWeek(toDayKey(now))}
            </p>
          </div>
        </div>
      ) : (
        <div data-sky-window className="flex items-center gap-4 px-5 pt-5 pb-4" aria-hidden="true">
          <div className={cn("skeleton", wide ? "h-24 w-64" : "h-16 w-40")} />
          <div className="skeleton h-16 w-24" />
        </div>
      )}
      <BriefingFooter className="border-t border-line" />
    </section>
  );
}
