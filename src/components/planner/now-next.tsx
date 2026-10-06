"use client";

import { ArrowRight, Coffee, Sparkles } from "lucide-react";
import type { PlanBlock } from "@/data/core";
import { formatDuration, formatMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";
import { blockStyle } from "./block-colors";
import { nowAndNext } from "./use-planner";

/** "Now: Deep work · 35m left — Next: Lunch at 12:30" */
export function NowNext({
  blocks,
  minute,
  onOpen,
  className,
}: {
  blocks: PlanBlock[];
  minute: number;
  onOpen?: (block: PlanBlock) => void;
  className?: string;
}) {
  const { current, next } = nowAndNext(blocks, minute);

  if (!current && !next) {
    return (
      <div
        className={cn("flex items-center gap-3 rounded-2xl bg-surface-sunken px-4 py-3 text-sm text-muted", className)}
      >
        <Sparkles className="size-4 text-accent" />
        {blocks.length === 0 ? "Nothing planned yet – tap the timeline to add something." : "That's it for today."}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2", current && next ? "sm:grid-cols-2" : "", className)}>
      {current ? (
        <button
          type="button"
          onClick={() => onOpen?.(current)}
          className={cn(
            "relative overflow-hidden rounded-2xl px-4 py-3 text-left",
            blockStyle(current.color).bg,
            blockStyle(current.color).text,
          )}
        >
          <span className="text-[0.7rem] font-bold tracking-wider uppercase opacity-70">Now</span>
          <span className="block truncate text-[1.05rem] font-semibold">{current.title}</span>
          <span className="text-xs tabular opacity-75">
            until {formatMinutes(current.end_min)} · {formatDuration(current.end_min - minute)} left
          </span>
          <span
            className={cn("absolute bottom-0 left-0 h-1", blockStyle(current.color).bar)}
            style={{
              width: `${Math.min(100, ((minute - current.start_min) / (current.end_min - current.start_min)) * 100)}%`,
            }}
          />
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-surface-sunken px-4 py-3">
          <Coffee className="size-5 text-faint" />
          <span className="text-sm text-muted">
            Free{next ? ` for ${formatDuration(next.start_min - minute)}` : ""}
          </span>
        </div>
      )}
      {next && (
        <button
          type="button"
          onClick={() => onOpen?.(next)}
          className="flex items-center gap-3 rounded-2xl bg-surface-sunken px-4 py-3 text-left transition-colors hover:bg-surface-hover"
        >
          <ArrowRight className="size-4 shrink-0 text-faint" />
          <span className="min-w-0">
            <span className="text-[0.7rem] font-bold tracking-wider text-faint uppercase">
              Next · {formatMinutes(next.start_min)}
            </span>
            <span className="block truncate font-semibold">{next.title}</span>
          </span>
          <span className="ml-auto shrink-0 text-xs text-muted tabular">
            in {formatDuration(next.start_min - minute)}
          </span>
        </button>
      )}
    </div>
  );
}
