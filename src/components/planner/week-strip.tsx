"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PlanBlock } from "@/data/core";
import { addDays, type DayKey, formatWeekdayShort, fromDayKey, isoWeek } from "@/lib/date";
import { cn } from "@/lib/utils";
import { blockStyle } from "./block-colors";

export function WeekStrip({
  week,
  selected,
  today,
  blocks,
  onSelect,
  className,
}: {
  week: DayKey[];
  selected: DayKey;
  today: DayKey | null;
  blocks: PlanBlock[];
  onSelect: (day: DayKey) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        aria-label="Previous week"
        onClick={() => onSelect(addDays(selected, -7))}
        className="grid size-10 shrink-0 place-items-center rounded-2xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
      >
        <ChevronLeft className="size-5" />
      </button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {week.map((day) => {
          const date = fromDayKey(day);
          const dayBlocks = blocks.filter((b) => b.day === day);
          const isSelected = day === selected;
          const isToday = day === today;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={isSelected}
              aria-label={date.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors",
                isSelected
                  ? "bg-accent text-accent-fg shadow-[0_8px_24px_-12px_var(--accent)]"
                  : "hover:bg-surface-hover",
              )}
            >
              <span className={cn("text-[0.7rem] font-semibold uppercase", !isSelected && "text-faint")}>
                {formatWeekdayShort(date)}
              </span>
              <span
                className={cn("text-lg leading-tight font-semibold tabular", isToday && !isSelected && "text-accent")}
              >
                {date.getDate()}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {dayBlocks.slice(0, 4).map((b) => (
                  <span
                    key={b.id}
                    className={cn("size-1.5 rounded-full", isSelected ? "bg-accent-fg/70" : blockStyle(b.color).swatch)}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="Next week"
        onClick={() => onSelect(addDays(selected, 7))}
        className="grid size-10 shrink-0 place-items-center rounded-2xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
      >
        <ChevronRight className="size-5" />
      </button>
      <span className="sr-only">Week {isoWeek(selected)}</span>
    </div>
  );
}
