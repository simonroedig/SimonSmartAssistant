"use client";

import { useToday } from "@/hooks/use-today";
import { isDayKey } from "@/lib/date";
import { PlannerView } from "./planner-view";

/** Resolves "today" on the device (server time zones differ) before rendering. */
export function PlannerClient({ requestedDay }: { requestedDay?: string }) {
  const today = useToday();
  const day = isDayKey(requestedDay) ? requestedDay : today;
  if (!day) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-8" aria-busy="true">
        <div className="skeleton h-10 w-56" />
        <div className="skeleton h-16 w-full" />
        <div className="skeleton h-[60dvh] w-full" />
      </div>
    );
  }
  return <PlannerView day={day} />;
}
