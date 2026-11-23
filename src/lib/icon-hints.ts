/**
 * Quiet hints on the menu's icons – no red badges: a small star on the backlog when
 * something there is starred, the number of open items once there are a few (from a
 * count chosen in Settings), and a dot on Settings when a backup is due.
 */

export type IconHintPreferences = {
  /** Show the backlog's open items from this many on (0: always, even none; HINT_OFF: never). */
  backlog: number;
  /** The same for the shopping list. */
  shopping: number;
};

/** No number on the icon. */
export const HINT_OFF = -1;
/** Off, always (0 too), or from 3, 5 or 10 items on. */
export const HINT_FROM_OPTIONS = [HINT_OFF, 0, 3, 5, 10] as const;
export const DEFAULT_ICON_HINTS: IconHintPreferences = { backlog: 0, shopping: 0 };

export function parseIconHints(value: unknown): IconHintPreferences {
  const v = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const from = (x: unknown, fallback: number) =>
    (HINT_FROM_OPTIONS as readonly unknown[]).includes(x) ? (x as number) : fallback;
  return {
    backlog: from(v.backlog, DEFAULT_ICON_HINTS.backlog),
    shopping: from(v.shopping, DEFAULT_ICON_HINTS.shopping),
  };
}

/** The count to show, if any: from `from` items on (0: always, HINT_OFF: never). */
export function hintCount(open: number, from: number): number | undefined {
  return from !== HINT_OFF && open >= from ? open : undefined;
}

/** How a count reads on the icon (it stays small). */
export function hintCountLabel(count: number): string {
  return count > 99 ? "99+" : String(count);
}

/** A backup is due after this long (and when there never was one). */
export const BACKUP_DUE_DAYS = 56;

export function backupDue(lastAt: string | null, now: Date): boolean {
  if (!lastAt) return true;
  const last = Date.parse(lastAt);
  return Number.isNaN(last) || now.getTime() - last > BACKUP_DUE_DAYS * 86_400_000;
}
