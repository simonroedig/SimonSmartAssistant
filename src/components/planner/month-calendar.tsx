"use client";

import { Cake, Clock, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { MonthGrid, monthGridDays, monthOf } from "@/components/ui/month-grid";
import { hasExtras, useDayExtras } from "@/data/calendar";
import { useBlocks } from "@/data/planner";
import { type DayKey, formatWeekdayShort, fromDayKey } from "@/lib/date";
import { cn } from "@/lib/utils";
import { blockStyle } from "./block-colors";
import { BIRTHDAY_TEXT, CLOCK_CHANGE_TEXT, extrasLabel, holidayNumberClass } from "./day-extras";

/**
 * Month overview of the planner: dots show the planned blocks of each day,
 * holidays colour the day (red: shops closed) and a cake marks birthdays.
 * Below it, the month's holidays and birthdays as a short list.
 */
export function MonthCalendar({
  selected,
  today,
  onSelect,
  listFirst = false,
  className,
}: {
  selected: DayKey;
  today: DayKey | null;
  onSelect: (day: DayKey) => void;
  /**
   * The month's list above the calendar: in a bottom sheet it then grows
   * upwards, and the month arrows stay where they are while browsing.
   */
  listFirst?: boolean;
  className?: string;
}) {
  const [month, setMonth] = useState(monthOf(selected));
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    setMonth(monthOf(selected));
  }
  const days = useMemo(() => monthGridDays(month), [month]);
  const blocks = useBlocks(days[0], days[41]);
  const byDay = useMemo(() => {
    const map = new Map<DayKey, string[]>();
    for (const b of blocks.data ?? []) map.set(b.day, [...(map.get(b.day) ?? []), blockStyle(b.color).swatch]);
    return map;
  }, [blocks.data]);
  const dayExtras = useDayExtras();
  const events = days
    .filter((day) => day.slice(0, 7) === month.slice(0, 7))
    .map((day) => ({ day, extras: dayExtras(day) }))
    .filter(({ extras }) => hasExtras(extras));

  return (
    <div className={cn("flex flex-col", className)}>
      <MonthGrid
        selected={selected}
        today={today}
        onSelect={onSelect}
        onMonthChange={setMonth}
        dots={(day) => byDay.get(day) ?? []}
        decorate={(day) => {
          const extras = dayExtras(day);
          if (!hasExtras(extras)) return null;
          return {
            numberClassName: holidayNumberClass(extras.holiday),
            marker: (
              <>
                {extras.clockChange && <Clock className={cn("size-2", CLOCK_CHANGE_TEXT)} strokeWidth={3} />}
                {extras.birthdays.length > 0 && <Cake className={cn("size-2", BIRTHDAY_TEXT)} strokeWidth={3} />}
              </>
            ),
            label: extrasLabel(extras),
          };
        }}
        tone="rose"
        quietSelection
      />
      {events.length > 0 && (
        <ul
          className={cn(
            "flex flex-col border-line",
            listFirst ? "order-first mb-3 border-b pb-2" : "mt-3 border-t pt-2",
          )}
          aria-label="Holidays and birthdays this month"
        >
          {events.map(({ day, extras }) => {
            const date = fromDayKey(day);
            // Already over this month: still listed, but crossed out.
            const past = today !== null && day < today;
            return (
              <li key={day}>
                <button
                  type="button"
                  onClick={() => onSelect(day)}
                  aria-label={
                    past ? `${formatWeekdayShort(date)} ${date.getDate()} (past): ${extrasLabel(extras)}` : undefined
                  }
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover",
                    past && "line-through decoration-1 opacity-50",
                  )}
                >
                  <span className="w-12 shrink-0 pt-px text-xs font-semibold text-muted tabular">
                    {formatWeekdayShort(date)} {date.getDate()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {extras.holiday && (
                      <span className="flex flex-wrap items-center gap-x-1.5">
                        <span className={cn("font-medium", holidayNumberClass(extras.holiday))}>
                          {extras.holiday.name}
                        </span>
                        {/* Over: the name is enough (keeps the list short). */}
                        {!past && (
                          <>
                            <span className="text-xs text-muted">({extras.holiday.nameDe})</span>
                            <span className="flex items-center gap-1 text-xs text-muted">
                              <Store className="size-3" />
                              {extras.holiday.shopsLabel}
                            </span>
                          </>
                        )}
                      </span>
                    )}
                    {extras.clockChange && (
                      <span className="flex flex-wrap items-center gap-x-1.5">
                        <span className={cn("font-medium", CLOCK_CHANGE_TEXT)}>{extras.clockChange.name}</span>
                        {!past && (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Clock className="size-3" />
                            {extras.clockChange.detail}
                          </span>
                        )}
                      </span>
                    )}
                    {extras.birthdays.map(({ birthday, label }) => (
                      <span key={birthday.id} className="flex items-center gap-1.5">
                        <Cake className={cn("size-3.5 shrink-0", BIRTHDAY_TEXT)} />
                        <span className="truncate">{label}</span>
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
