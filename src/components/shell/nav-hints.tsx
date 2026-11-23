"use client";

import { Star } from "lucide-react";
import { createContext, useContext, useMemo } from "react";
import { useSettings } from "@/data/settings";
import { useShoppingItems } from "@/data/shopping";
import { useTodos } from "@/data/todos";
import { useNow } from "@/hooks/use-now";
import { backupDue, hintCount, hintCountLabel } from "@/lib/icon-hints";
import { TONE_STYLES, type Tone } from "@/lib/tones";
import { cn } from "@/lib/utils";

export type NavHint = {
  /** Open items, once there are enough to mention. */
  count?: number;
  /** Something in there is starred. */
  star?: boolean;
  /** Something wants doing here (a backup in Settings). */
  due?: boolean;
};

const HintsContext = createContext<Record<string, NavHint>>({});

/** Works out the hints once for the whole menu (rail and tab bar). */
export function NavHintsProvider({ children }: { children: React.ReactNode }) {
  const todos = useTodos().data;
  const shopping = useShoppingItems().data;
  const { settings } = useSettings();
  // Null while rendering on the server: hints only appear in the browser.
  const now = useNow();
  const hints = useMemo((): Record<string, NavHint> => {
    if (!now) return {};
    const open = todos?.filter((t) => !t.done) ?? [];
    const toBuy = shopping?.filter((i) => !i.checked).length ?? 0;
    return {
      "/todos": { count: hintCount(open.length, settings.hints.backlog), star: open.some((t) => t.starred) },
      "/shopping": { count: hintCount(toBuy, settings.hints.shopping) },
      "/settings": { due: backupDue(settings.backup.lastAt, now) },
    };
  }, [now, todos, shopping, settings.hints, settings.backup.lastAt]);
  return <HintsContext.Provider value={hints}>{children}</HintsContext.Provider>;
}

export function useNavHint(href: string): NavHint | undefined {
  return useContext(HintsContext)[href];
}

/** For screen readers: what the marks say. */
export function navHintText(hint: NavHint | undefined): string | undefined {
  if (!hint) return undefined;
  const parts = [
    hint.count !== undefined && `${hint.count} open`,
    hint.star && "something starred",
    hint.due && "a backup is due",
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

/** The marks around an icon (its wrapper is `relative`): calm, in the section's colour. */
export function NavHintMarks({ hint, tone }: { hint: NavHint | undefined; tone: Tone }) {
  if (!hint) return null;
  const style = TONE_STYLES[tone];
  return (
    <>
      {hint.star && (
        <Star
          aria-hidden="true"
          data-hint="star"
          strokeWidth={2.4}
          className="absolute -top-1 -right-1.5 size-2.5 fill-yellow-400 text-yellow-500 dark:fill-yellow-300 dark:text-yellow-300"
        />
      )}
      {hint.count !== undefined && (
        // Drawn by CSS: the number is no part of the link's name (that stays "Backlog").
        <span
          aria-hidden="true"
          data-hint="count"
          data-count={hintCountLabel(hint.count)}
          className={cn(
            "absolute -right-3.5 -bottom-1 min-w-4 rounded-full px-1 text-center text-[0.6rem] leading-4 font-bold tabular-nums after:content-[attr(data-count)]",
            style.soft,
            style.text,
          )}
        />
      )}
      {hint.due && (
        <span
          aria-hidden="true"
          data-hint="due"
          className="absolute -top-0.5 -right-1 size-2 rounded-full bg-amber-500"
        />
      )}
    </>
  );
}
