/**
 * One colour per section, used for the navigation, card headers and accents.
 * Home and the generic UI use the violet accent.
 */
export type Tone = "accent" | "rose" | "emerald" | "amber" | "yellow" | "orange" | "sky" | "slate";

export const TONE_STYLES: Record<
  Tone,
  {
    /** Icon colour. */
    text: string;
    /** Icon badge / active pill background. */
    soft: string;
    /** Solid fill (buttons, selected day). */
    solid: string;
  }
> = {
  accent: { text: "text-accent", soft: "bg-accent-soft", solid: "bg-accent text-accent-fg" },
  rose: {
    text: "text-rose-500 dark:text-rose-300",
    soft: "bg-rose-500/12 dark:bg-rose-400/14",
    // The icon's own shades: deep in light, soft in dark.
    solid: "bg-rose-500 text-white dark:bg-rose-300 dark:text-rose-950",
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-300",
    soft: "bg-emerald-500/14",
    solid: "bg-emerald-500 text-white dark:text-emerald-950",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-300",
    soft: "bg-amber-500/16",
    solid: "bg-amber-500 text-white dark:text-amber-950",
  },
  yellow: {
    text: "text-yellow-600 dark:text-yellow-300",
    soft: "bg-yellow-400/22 dark:bg-yellow-300/16",
    solid: "bg-yellow-400 text-yellow-950 dark:bg-yellow-300 dark:text-yellow-950",
  },
  orange: {
    text: "text-orange-600 dark:text-orange-300",
    soft: "bg-orange-500/14",
    solid: "bg-orange-400 text-orange-950 dark:bg-orange-300 dark:text-orange-950",
  },
  sky: {
    text: "text-sky-600 dark:text-sky-300",
    soft: "bg-sky-500/14",
    solid: "bg-sky-500 text-white dark:text-sky-950",
  },
  slate: {
    text: "text-slate-500 dark:text-slate-300",
    soft: "bg-slate-500/12 dark:bg-slate-400/14",
    solid: "bg-slate-600 text-white dark:bg-slate-300 dark:text-slate-900",
  },
};

/** A picked day: grey with a clear ring – always the most visible day. */
export const SELECTED_DAY = "bg-surface-hover shadow-sm ring-2 ring-slate-400/55 ring-inset dark:ring-white/40";
/**
 * "Now" / "Today" (weather hours and days, the planner's week strip and
 * calendars): quietly marked with a light tint and its label or number in blue
 * – each design has its own --today blue. It never outshines the picked day.
 */
export const TODAY_RING = "bg-today/10";
/** Today while it is also the picked day: picked wins, the blue number stays. */
export const TODAY_RING_STRONG = SELECTED_DAY;
/** The blue of today's label or number. */
export const TODAY_TEXT = "font-semibold text-today";
/** The word "Today" in a title: the same blue, at the title's own weight. */
export const TODAY_COLOR = "text-today";

/**
 * The frame of a focused text field in a section's colour (it sets --field-focus
 * for the fields inside). Elsewhere fields use the accent.
 */
export const FIELD_FOCUS = {
  emerald: "[--field-focus:color-mix(in_oklab,var(--color-emerald-500)_60%,transparent)]",
  // The backlog icon's yellow (deeper ones turn orange as a thin line).
  yellow:
    "[--field-focus:color-mix(in_oklab,var(--color-yellow-400)_80%,transparent)] dark:[--field-focus:color-mix(in_oklab,var(--color-yellow-300)_75%,transparent)]",
  rose: "[--field-focus:color-mix(in_oklab,var(--color-rose-500)_55%,transparent)]",
  orange: "[--field-focus:color-mix(in_oklab,var(--color-orange-400)_65%,transparent)]",
  /** Searches: a quiet grey. */
  quiet: "[--field-focus:var(--text-faint)]",
} as const;

/** A starred backlog item: the same grey star as unstarred, filled in. */
export const STAR_ON = "fill-current text-muted";

/**
 * A section's add button: solid in the section's colour once there is something
 * to add, a soft tint before (a faded solid colour looks muddy on dark backgrounds).
 */
export function addButtonTone(tone: "emerald" | "yellow", ready: boolean): string {
  const styles = TONE_STYLES[tone];
  return ready ? styles.solid : `${styles.soft} ${styles.text} shadow-none disabled:opacity-100`;
}
