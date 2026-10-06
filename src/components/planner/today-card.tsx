"use client";

import { CalendarClock, Plus } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useElementSize } from "@/hooks/use-element-size";
import { useNow } from "@/hooks/use-now";
import type { DayKey } from "@/lib/date";
import { MINUTES_PER_DAY, minutesOfDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { BlockEditor } from "./block-editor";
import { DayTimeline } from "./day-timeline";
import { FocusInput } from "./focus-input";
import { NowNext } from "./now-next";
import { usePlanner } from "./use-planner";

/**
 * Today's plan on the dashboard. The timeline shows the awake part of the day
 * and, on big screens, scales so the whole day fits without scrolling.
 */
export function TodayCard({ day, className, fit = false }: { day: DayKey; className?: string; fit?: boolean }) {
  const planner = usePlanner(day);
  const now = useNow("minute");
  const box = useRef<HTMLDivElement>(null);
  const { height } = useElementSize(box);

  // Visible range: the awake window plus any blocks outside it, rounded to hours.
  const starts = [planner.awake[0], ...planner.dayBlocks.map((b) => b.start_min)];
  const ends = [planner.awake[1], ...planner.dayBlocks.map((b) => b.end_min)];
  const rangeStart = Math.max(0, Math.floor((Math.min(...starts) - 30) / 60) * 60);
  const rangeEnd = Math.min(MINUTES_PER_DAY, Math.ceil((Math.max(...ends) + 30) / 60) * 60);
  const hours = (rangeEnd - rangeStart) / 60;
  // Leave room for the timeline's bottom padding so the whole day fits without scrolling.
  const fitted = height > 0 ? Math.floor((height - 48) / hours) : 48;
  const hourHeight = fit ? Math.max(34, Math.min(72, fitted)) : 52;
  const minute = now ? minutesOfDay(now) : 0;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader
        icon={<CalendarClock />}
        title="Today"
        href="/planner"
        actions={
          <Button variant="ghost" size="icon-sm" aria-label="Add block" onClick={() => planner.createAtNextFree()}>
            <Plus />
          </Button>
        }
      />
      <div className="flex flex-col gap-2.5 px-4">
        <FocusInput day={day} week={planner.week} className="-mx-1" />
        {now && (
          <NowNext
            blocks={planner.dayBlocks}
            minute={minute}
            onOpen={(block) => planner.setEditor({ mode: "edit", block })}
          />
        )}
      </div>
      <div ref={box} className="relative min-h-0 flex-1 pt-3">
        <DayTimeline
          className={cn("px-2 pb-3", fit ? "absolute inset-0 top-3" : "max-h-[34rem]")}
          blocks={planner.dayBlocks}
          sleepRanges={planner.sleepRanges}
          hourHeight={hourHeight}
          range={[rangeStart, rangeEnd]}
          snap={planner.snap}
          isToday
          draft={planner.draftPreview}
          onCreateAt={(m) => planner.createAt(m)}
          onOpen={(block) => planner.setEditor({ mode: "edit", block })}
          onChangeTime={planner.changeTime}
          onToggleDone={planner.toggleDone}
          scrollTarget={fit ? rangeStart : Math.max(rangeStart, minute - 90)}
          scrollKey={`${day}-${planner.isLoading}`}
        />
      </div>
      <BlockEditor {...planner.editorProps} />
    </Card>
  );
}
