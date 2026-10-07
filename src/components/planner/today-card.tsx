"use client";

import { CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useElementSize } from "@/hooks/use-element-size";
import { useNow } from "@/hooks/use-now";
import { useSwipe } from "@/hooks/use-swipe";
import { addDays, type DayKey, formatDayMonthShort, formatWeekday, formatWeekdayShort, fromDayKey } from "@/lib/date";
import { MINUTES_PER_DAY, minutesOfDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { BlockEditor } from "./block-editor";
import { DayTimeline } from "./day-timeline";
import { FocusInput } from "./focus-input";
import { NowNext } from "./now-next";
import { usePlanner } from "./use-planner";

/** How far the card can browse away from today. */
const MIN_OFFSET = -1;
const MAX_OFFSET = 6;
/** The wall display drifts back to today when nobody looks at another day. */
const RETURN_TO_TODAY_MS = 2 * 60_000;

function dayTitle(offset: number, day: DayKey): { title: string; subtitle: string } {
  const date = fromDayKey(day);
  const short = `${formatWeekdayShort(date)}, ${formatDayMonthShort(date)}`;
  if (offset === 0) return { title: "Today", subtitle: short };
  if (offset === 1) return { title: "Tomorrow", subtitle: short };
  if (offset === -1) return { title: "Yesterday", subtitle: short };
  return { title: formatWeekday(date), subtitle: formatDayMonthShort(date) };
}

/**
 * The day plan on the dashboard, starting at today. Swipe sideways (touch) or
 * use the arrows to look at the next days. The timeline shows the awake part of
 * the day and, on big screens, scales so the whole day fits without scrolling.
 */
export function TodayCard({ today, className, fit = false }: { today: DayKey; className?: string; fit?: boolean }) {
  const [offset, setOffset] = useState(0);
  const [direction, setDirection] = useState(1);
  const day = addDays(today, offset);
  const isToday = offset === 0;
  const planner = usePlanner(day);
  const now = useNow("minute");
  const box = useRef<HTMLDivElement>(null);
  const { height } = useElementSize(box);

  const go = (delta: number) => {
    const next = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, offset + delta));
    if (next === offset) return;
    setDirection(Math.sign(next - offset));
    setOffset(next);
  };

  // Come back to today after a while, unless a block is being edited.
  const editing = planner.editor !== null;
  useEffect(() => {
    if (isToday || editing) return;
    const timer = window.setTimeout(() => {
      setDirection(-1);
      setOffset(0);
    }, RETURN_TO_TODAY_MS);
    return () => window.clearTimeout(timer);
  }, [isToday, editing, day]);

  // Sideways swipe on touch screens. Blocks use press-and-hold and vertical
  // drags, so a quick sideways flick never collides with moving a block.
  const swipe = useSwipe((direction) => go(direction), !editing);

  // Visible range: from a bit before waking up until a bit after bedtime (past
  // midnight if that's when you go to bed), widened for blocks outside it.
  const starts = [planner.awake[0], ...planner.dayBlocks.map((b) => b.start_min)];
  const ends = [planner.dayBlocks.length ? Math.max(...planner.dayBlocks.map((b) => b.end_min)) + 30 : 0];
  const rangeStart = Math.max(0, Math.floor((Math.min(...starts) - 30) / 60) * 60);
  const bedEnd = planner.viewEnd > MINUTES_PER_DAY ? planner.viewEnd : Math.ceil((planner.awake[1] + 30) / 60) * 60;
  const rangeEnd = Math.max(bedEnd, Math.min(MINUTES_PER_DAY, Math.ceil(Math.max(...ends) / 60) * 60));
  const hours = (rangeEnd - rangeStart) / 60;
  // Leave room for the timeline's bottom padding so the whole day fits without scrolling.
  const fitted = height > 0 ? Math.floor((height - 48) / hours) : 48;
  const hourHeight = fit ? Math.max(34, Math.min(72, fitted)) : 48;
  const minute = now ? minutesOfDay(now) : 0;
  const { title, subtitle } = dayTitle(offset, day);

  return (
    <Card className={cn("[touch-action:pan-y] overflow-hidden", className)} {...swipe}>
      <CardHeader
        icon={<CalendarClock />}
        tone="rose"
        title={title}
        subtitle={subtitle}
        href={isToday ? "/planner" : `/planner?day=${day}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous day"
              disabled={offset <= MIN_OFFSET}
              onClick={() => go(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next day"
              disabled={offset >= MAX_OFFSET}
              onClick={() => go(1)}
            >
              <ChevronRight />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Add block" onClick={() => planner.createAtNextFree()}>
              <Plus />
            </Button>
          </>
        }
      />
      <motion.div
        key={`head-${day}`}
        initial={{ opacity: 0, x: direction * 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="flex flex-col gap-2.5 px-4"
      >
        <FocusInput day={day} week={planner.week} className="-mx-1" />
        {now && isToday && !planner.isLoading && (
          <NowNext
            blocks={planner.dayBlocks}
            minute={minute}
            onOpen={(block) => planner.setEditor({ mode: "edit", block })}
          />
        )}
      </motion.div>
      <div ref={box} className="relative min-h-0 flex-1 pt-3">
        <motion.div
          key={day}
          initial={{ opacity: 0, x: direction * 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className={cn(fit && "absolute inset-0 top-3")}
        >
          <DayTimeline
            // On phones the page keeps scrolling once the timeline reaches its end.
            className={cn("[touch-action:pan-y] px-2 pb-3", fit ? "h-full" : "max-h-[22rem] overscroll-auto")}
            blocks={planner.dayBlocks}
            sleepRanges={planner.sleepRanges}
            hourHeight={hourHeight}
            range={[rangeStart, rangeEnd]}
            snap={planner.snap}
            isToday={isToday}
            draft={planner.draftPreview}
            onCreateAt={(m) => planner.createAt(m)}
            onOpen={(block) => planner.setEditor({ mode: "edit", block })}
            onChangeTime={planner.changeTime}
            onToggleDone={planner.toggleDone}
            scrollTarget={fit || !isToday ? rangeStart : Math.max(rangeStart, minute - 90)}
            scrollKey={`${day}-${planner.isLoading}`}
          />
        </motion.div>
      </div>
      <BlockEditor {...planner.editorProps} />
    </Card>
  );
}
