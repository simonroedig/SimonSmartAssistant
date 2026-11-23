"use client";

import { createContext, useContext, useMemo } from "react";
import { useSettings } from "@/data/settings";
import { useShoppingItems } from "@/data/shopping";
import { useTodos } from "@/data/todos";
import { useNow } from "@/hooks/use-now";
import { backupDue, hintCount } from "@/lib/icon-hints";
import { BacklogIcon, SettingsIcon, ShoppingIcon } from "./hint-icons";
import type { NavItem } from "./nav-items";

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

/** A section's icon in the menu – drawn differently when there is something to hint at. */
export function NavIcon({
  item,
  hint,
  className,
  strokeWidth,
}: {
  item: NavItem;
  hint: NavHint | undefined;
  className?: string;
  strokeWidth?: number;
}) {
  const props = { className, strokeWidth };
  if (item.href === "/todos" && (hint?.star || hint?.count !== undefined))
    return <BacklogIcon {...props} star={hint.star} count={hint.count} />;
  if (item.href === "/shopping" && hint?.count !== undefined) return <ShoppingIcon {...props} count={hint.count} />;
  if (item.href === "/settings" && hint?.due) return <SettingsIcon {...props} due />;
  const Icon = item.icon;
  return <Icon {...props} />;
}
