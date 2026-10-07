"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useBlocks } from "@/data/planner";
import {
  addDays,
  type DayKey,
  formatDayMonth,
  formatMonthYear,
  formatWeekday,
  fromDayKey,
  startOfWeek,
} from "@/lib/date";
import { TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { blockStyle } from "./block-colors";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthOf(day: DayKey): DayKey {
  return `${day.slice(0, 7)}-01`;
}

function shiftMonth(month: DayKey, amount: number): DayKey {
  const date = fromDayKey(month);
  date.setMonth(date.getMonth() + amount, 1);
  return monthOf(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`);
}

/**
 * Month overview for picking any day: dots show planned blocks. Browse months
 * with the arrows; "Today" jumps back.
 */
export function MonthCalendar({
  selected,
  today,
  onSelect,
  className,
}: {
  selected: DayKey;
  today: DayKey | null;
  onSelect: (day: DayKey) => void;
  className?: string;
}) {
  const [month, setMonth] = useState(monthOf(selected));
  // Follow the selected day when it moves to another month (e.g. by swiping).
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    if (monthOf(selected) !== month) setMonth(monthOf(selected));
  }

  const gridStart = startOfWeek(month);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const blocks = useBlocks(days[0], days[41]);
  const byDay = useMemo(() => {
    const map = new Map<DayKey, string[]>();
    for (const b of blocks.data ?? []) map.set(b.day, [...(map.get(b.day) ?? []), b.color]);
    return map;
  }, [blocks.data]);

  const rose = TONE_STYLES.rose;
  // Drop a trailing week that belongs entirely to the next month.
  const visible = days.slice(0, days[35].slice(0, 7) !== month.slice(0, 7) ? 35 : 42);

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-1">
        <h3 className="flex-1 pl-1 text-[0.98rem] font-semibold tracking-tight">
          {formatMonthYear(fromDayKey(month))}
        </h3>
        {today && monthOf(today) !== month && (
          <button
            type="button"
            onClick={() => setMonth(monthOf(today))}
            className={cn("h-8 rounded-xl px-3 text-xs font-semibold", rose.soft, rose.text)}
          >
            This month
          </button>
        )}
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-[0.68rem] font-semibold text-faint uppercase">
            {d}
          </span>
        ))}
        {visible.map((day) => {
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const isSelected = day === selected;
          const isToday = day === today;
          const colors = byDay.get(day) ?? [];
          const date = fromDayKey(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={isSelected}
              aria-label={`${formatWeekday(date)}, ${formatDayMonth(date)}`}
              className={cn(
                "flex aspect-square max-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-sm tabular transition-colors",
                isSelected ? rose.solid : "hover:bg-surface-hover",
                !inMonth && !isSelected && "text-faint",
                isToday && !isSelected && cn("font-bold ring-1 ring-current", rose.text),
              )}
            >
              {date.getDate()}
              <span className="flex h-1 items-center gap-0.5">
                {colors.slice(0, 3).map((c, i) => (
                  <span
                    key={i}
                    className={cn("size-1 rounded-full", isSelected ? "bg-current opacity-70" : blockStyle(c).swatch)}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
