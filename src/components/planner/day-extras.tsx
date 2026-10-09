"use client";

import { Cake, Clock, Flag, Store } from "lucide-react";
import { type DayExtras, hasExtras } from "@/data/calendar";
import type { CalendarDay } from "@/lib/holidays";
import { cn } from "@/lib/utils";

/** Day numbers in calendars: red when shops are closed, amber for shorter hours or a day off school. */
export function holidayNumberClass(holiday: CalendarDay | null): string | undefined {
  if (!holiday) return undefined;
  return holiday.shops === "closed" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-300";
}

export const BIRTHDAY_TEXT = "text-pink-600 dark:text-pink-300";
export const CLOCK_CHANGE_TEXT = "text-indigo-600 dark:text-indigo-300";

/** One line for tooltips and screen readers: "German Unity Day (Tag der Deutschen Einheit) · Shops closed · Anna turns 30". */
export function extrasLabel(extras: DayExtras): string {
  return [
    extras.holiday && `${extras.holiday.name} (${extras.holiday.nameDe}) · ${extras.holiday.shopsLabel}`,
    extras.clockChange && `${extras.clockChange.name} (${extras.clockChange.detail})`,
    ...extras.birthdays.map((b) => b.label),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The day's holiday (with what it means for the shops), a clock change and birthdays, as chips. */
export function DayExtrasChips({ extras, className }: { extras: DayExtras; className?: string }) {
  const { holiday, clockChange, birthdays } = extras;
  if (!hasExtras(extras)) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Holidays and birthdays">
      {holiday && (
        <li
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-2xl px-2.5 py-1 text-xs font-semibold",
            holiday.shops === "closed"
              ? "bg-red-500/10 text-red-700 dark:bg-red-400/12 dark:text-red-300"
              : "bg-amber-500/12 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200",
          )}
        >
          <Flag className="size-3.5 shrink-0" />
          <span>{holiday.name}</span>
          <span className="font-medium opacity-75">({holiday.nameDe})</span>
          <span className="flex shrink-0 items-center gap-1 font-medium opacity-85">
            <span aria-hidden="true">·</span>
            <Store className="size-3.5" />
            {holiday.shopsLabel}
          </span>
        </li>
      )}
      {clockChange && (
        <li className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-2xl bg-indigo-500/12 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-400/14 dark:text-indigo-200">
          <Clock className="size-3.5 shrink-0" />
          <span>{clockChange.name}</span>
          <span className="font-medium opacity-75">({clockChange.nameDe})</span>
          <span className="font-medium opacity-85">· {clockChange.detail}</span>
        </li>
      )}
      {birthdays.map(({ birthday, label }) => (
        <li
          key={birthday.id}
          className="flex min-w-0 items-center gap-1.5 rounded-full bg-pink-500/12 px-2.5 py-1 text-xs font-semibold text-pink-700 dark:bg-pink-400/12 dark:text-pink-200"
        >
          <Cake className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </li>
      ))}
    </ul>
  );
}
