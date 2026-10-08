"use client";

import { Cake, ChevronLeft, ChevronRight } from "lucide-react";
import type { PlanBlock } from "@/data/core";
import {
  addDays,
  type DayKey,
  formatDayMonth,
  formatWeekday,
  formatWeekdayShort,
  fromDayKey,
  isoWeek,
} from "@/lib/date";
import { SELECTED_DAY, TODAY_RING, TODAY_RING_STRONG, TODAY_TEXT } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useDayExtras } from "@/data/calendar";
import { blockStyle } from "./block-colors";
import { BIRTHDAY_TEXT, extrasLabel, holidayNumberClass } from "./day-extras";

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
  const dayExtras = useDayExtras();
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
          const extras = dayExtras(day);
          const extra = extrasLabel(extras);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={isSelected}
              aria-label={`${formatWeekday(date)}, ${formatDayMonth(date)}${extra ? ` · ${extra}` : ""}`}
              title={extra || undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors",
                // Today always in the "Now/Today" blue; another selected day quietly grey.
                isToday
                  ? cn(isSelected ? TODAY_RING_STRONG : TODAY_RING, TODAY_TEXT)
                  : isSelected
                    ? SELECTED_DAY
                    : "hover:bg-surface-hover",
              )}
            >
              <span className={cn("text-[0.7rem] font-semibold uppercase", !isSelected && !isToday && "text-faint")}>
                {formatWeekdayShort(date)}
              </span>
              <span
                className={cn(
                  "text-lg leading-tight font-semibold tabular",
                  !isToday && holidayNumberClass(extras.holiday),
                )}
              >
                {date.getDate()}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {extras.birthdays.length > 0 && <Cake className={cn("size-2.5", BIRTHDAY_TEXT)} strokeWidth={3} />}
                {dayBlocks.slice(0, extras.birthdays.length > 0 ? 3 : 4).map((b) => (
                  <span key={b.id} className={cn("size-1.5 rounded-full", blockStyle(b.color).swatch)} />
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
