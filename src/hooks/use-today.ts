"use client";

import { type DayKey, toDayKey } from "@/lib/date";
import { useNow } from "./use-now";

/** Today's day key; updates right after midnight. Null until hydrated. */
export function useToday(): DayKey | null {
  const now = useNow("minute");
  return now ? toDayKey(now) : null;
}
