"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useSwipe } from "@/hooks/use-swipe";
import {
  addDays,
  type DayKey,
  formatDayMonth,
  formatMonthYear,
  formatWeekday,
  fromDayKey,
  startOfWeek,
  toDayKey,
} from "@/lib/date";
import { SELECTED_DAY, type Tone, TODAY_RING, TODAY_RING_STRONG, TODAY_TEXT, TONE_STYLES } from "@/lib/tones";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function monthOf(day: DayKey): DayKey {
  return `${day.slice(0, 7)}-01`;
}

function shiftMonth(month: DayKey, amount: number): DayKey {
  const date = fromDayKey(month);
  date.setMonth(date.getMonth() + amount, 1);
  return monthOf(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`);
}

export type DayDecoration = { numberClassName?: string; marker?: React.ReactNode; label?: string };

/** The six weeks shown for a month (Monday first). */
export function monthGridDays(month: DayKey): DayKey[] {
  const start = startOfWeek(monthOf(month));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * A month to pick a day from. Always six weeks, so the grid (and the arrows
 * above it) never change height. Optional coloured dots per day.
 */
export function MonthGrid({
  selected,
  today,
  onSelect,
  onMonthChange,
  dots,
  tone = "accent",
  quietSelection = false,
  todayPicks = false,
  decorate,
  className,
}: {
  selected: DayKey | null;
  today: DayKey | null;
  onSelect: (day: DayKey) => void;
  /** Called with the first day of the month that is shown. */
  onMonthChange?: (month: DayKey) => void;
  /** Tailwind background classes of the dots to show under a day. */
  dots?: (day: DayKey) => string[];
  tone?: Tone;
  /** Mark the selected day in quiet grey (browsing) instead of the tone (picking a value). */
  quietSelection?: boolean;
  /**
   * "Today" picks today (browsing a calendar, like the planner's) instead of
   * only showing its month (picking a value, like a due date) – and shows
   * whenever another day is picked.
   */
  todayPicks?: boolean;
  /** Extra marks for a day: a colour for its number, a small marker and a label (e.g. holidays). */
  decorate?: (day: DayKey) => DayDecoration | null;
  className?: string;
}) {
  const initial = monthOf(selected ?? today ?? toDayKey(new Date()));
  const [month, setMonthState] = useState(initial);
  const setMonth = (next: DayKey) => {
    setMonthState(next);
    onMonthChange?.(next);
  };
  // Follow the selected day when it moves to another month (e.g. by swiping).
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    if (selected && monthOf(selected) !== month) setMonth(monthOf(selected));
  }

  const days = useMemo(() => monthGridDays(month), [month]);
  const styles = TONE_STYLES[tone];
  // Swipe sideways through the months (phones; the wall display has the arrows).
  const swipe = useSwipe((direction) => setMonth(shiftMonth(month, direction)));

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-1">
        <h3 className="min-w-0 flex-1 truncate pl-1 text-[0.98rem] font-semibold tracking-tight whitespace-nowrap">
          {formatMonthYear(fromDayKey(month))}
        </h3>
        {today && (monthOf(today) !== month || (todayPicks && selected !== today)) && (
          <button
            type="button"
            onClick={() => {
              setMonth(monthOf(today));
              if (todayPicks) onSelect(today);
            }}
            className="h-8 shrink-0 rounded-xl px-2.5 text-xs font-semibold whitespace-nowrap text-today transition-colors well"
          >
            Today
          </button>
        )}
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid [touch-action:pan-y] grid-cols-7 gap-0.5 text-center" data-swipe {...swipe}>
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-[0.68rem] font-semibold text-faint uppercase">
            {d}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const isSelected = day === selected;
          const isToday = day === today;
          const colors = dots?.(day) ?? [];
          const extra = decorate?.(day) ?? null;
          const date = fromDayKey(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={isSelected}
              aria-label={`${formatWeekday(date)}, ${formatDayMonth(date)}${extra?.label ? ` · ${extra.label}` : ""}`}
              title={extra?.label || undefined}
              className={cn(
                "flex aspect-square max-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-sm tabular transition-colors",
                isToday
                  ? cn(isSelected ? TODAY_RING_STRONG : TODAY_RING, TODAY_TEXT)
                  : isSelected
                    ? quietSelection
                      ? SELECTED_DAY
                      : styles.solid
                    : "hover:bg-surface-hover",
                !inMonth && !isSelected && !isToday && "text-faint",
              )}
            >
              <span className={cn(!isToday && !(isSelected && !quietSelection) && extra?.numberClassName)}>
                {date.getDate()}
              </span>
              <span className="flex h-1 items-center gap-0.5">
                {extra?.marker}
                {colors.slice(0, extra?.marker ? 2 : 3).map((c, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-1 rounded-full",
                      isSelected && !isToday && !quietSelection ? "bg-current opacity-70" : c,
                    )}
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
