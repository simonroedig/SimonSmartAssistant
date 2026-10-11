"use client";

import { useRef, useState } from "react";
import { useToday } from "@/hooks/use-today";
import { type DayKey, isDayKey } from "@/lib/date";
import { PlannerView } from "./planner-view";

/**
 * Resolves "today" on the device (server time zones differ) and keeps the
 * selected day on the client: switching days is instant and only updates the
 * URL (no server round trip).
 */
export function PlannerClient({ requestedDay, planTodoId }: { requestedDay?: string; planTodoId?: string }) {
  const today = useToday();
  const [picked, setPicked] = useState<DayKey | null>(isDayKey(requestedDay) ? requestedDay : null);
  const day = picked ?? today;

  // Picked in a sheet (the month calendar stays open for more picks): the URL
  // follows once the sheet has given up its history entry – with the last pick.
  const pendingUrl = useRef<string | null>(null);
  const go = (target: DayKey) => {
    setPicked(target === today ? null : target);
    const url = target === today ? "/planner" : `/planner?day=${target}`;
    if (window.history.state?.sheet) {
      if (pendingUrl.current === null) {
        window.addEventListener(
          "popstate",
          () => {
            if (pendingUrl.current) window.history.replaceState(null, "", pendingUrl.current);
            pendingUrl.current = null;
          },
          { once: true },
        );
      }
      pendingUrl.current = url;
    } else {
      window.history.replaceState(null, "", url);
    }
  };

  if (!day) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-(--gutter) md:pl-0" aria-busy="true">
        <div className="skeleton h-10 w-56" />
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-[60dvh] w-full" />
      </div>
    );
  }
  return (
    <PlannerView
      day={day}
      today={today}
      onDayChange={go}
      planTodoId={planTodoId}
      onPlanHandled={() => {
        // Drop "?plan=…" so a reload doesn't plan the item again.
        const url = new URL(window.location.href);
        url.searchParams.delete("plan");
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      }}
    />
  );
}
