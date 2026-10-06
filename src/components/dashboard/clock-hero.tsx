"use client";

import { useNow } from "@/hooks/use-now";
import { formatLongDate, formatTime, greeting, isoWeek, toDayKey } from "@/lib/date";
import { cn } from "@/lib/utils";

/** Big wall clock with the German long date ("Dienstag, 6. Oktober 2026") and week number. */
export function ClockHero({ className, compact = false }: { className?: string; compact?: boolean }) {
  const now = useNow("minute");

  if (!now) {
    return (
      <div className={cn("flex flex-col gap-3", className)} aria-hidden="true">
        <div className={cn("skeleton", compact ? "h-16 w-44" : "h-28 w-72")} />
        <div className="skeleton h-6 w-64" />
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <p className="mb-1 text-sm font-medium text-muted">{greeting(now)}</p>
      <time
        dateTime={now.toISOString()}
        className={cn(
          "block leading-[0.9] font-extralight tracking-[-0.045em] tabular",
          compact ? "text-[3.6rem] sm:text-[4.25rem]" : "text-[clamp(5rem,7.4vw,8.75rem)]",
        )}
      >
        {formatTime(now)}
      </time>
      <p className={cn("font-medium tracking-tight", compact ? "mt-2 text-base sm:text-lg" : "mt-1 text-[1.35rem]")}>
        {formatLongDate(now)}
      </p>
      <p className="mt-0.5 text-sm text-muted tabular">KW {isoWeek(toDayKey(now))}</p>
    </div>
  );
}
