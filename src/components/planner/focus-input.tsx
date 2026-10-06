"use client";

import { Target } from "lucide-react";
import { useState } from "react";
import { useDayNotes, useSetDayNote } from "@/data/planner";
import { useToday } from "@/hooks/use-today";
import type { DayKey } from "@/lib/date";
import { cn } from "@/lib/utils";

/** One line "focus of the day" – the intention that sits above the plan. */
export function FocusInput({ day, week, className }: { day: DayKey; week: DayKey[]; className?: string }) {
  const notes = useDayNotes(week[0], week[6]);
  const save = useSetDayNote();
  const today = useToday();
  const stored = notes.data?.find((n) => n.day === day)?.focus ?? "";
  // While typing we keep a local draft; otherwise remote changes show up live.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? stored;

  const commit = () => {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next !== stored) save.mutate({ day, focus: next });
  };

  return (
    <form
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border border-transparent px-3 transition-colors focus-within:border-line focus-within:bg-surface-sunken",
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        commit();
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <Target className={cn("size-[1.15rem] shrink-0", value ? "text-accent" : "text-faint")} />
      <input
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setDraft((d) => d ?? stored)}
        onBlur={commit}
        placeholder={
          today && today !== day ? "What matters most that day?" : "What's the one thing that matters today?"
        }
        maxLength={200}
        enterKeyHint="done"
        aria-label="Focus of the day"
        className="h-11 min-w-0 flex-1 bg-transparent text-[0.98rem] font-medium outline-none placeholder:font-normal placeholder:text-faint"
      />
    </form>
  );
}
