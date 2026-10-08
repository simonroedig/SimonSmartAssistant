"use client";

import { useMemo, useState } from "react";
import { MonthGrid, monthGridDays, monthOf } from "@/components/ui/month-grid";
import { useBlocks } from "@/data/planner";
import type { DayKey } from "@/lib/date";
import { blockStyle } from "./block-colors";

/** Month overview of the planner: dots show the planned blocks of each day. */
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

  return (
    <MonthGrid
      selected={selected}
      today={today}
      onSelect={onSelect}
      onMonthChange={setMonth}
      dots={(day) => byDay.get(day) ?? []}
      tone="rose"
      quietSelection
      className={className}
    />
  );
}
