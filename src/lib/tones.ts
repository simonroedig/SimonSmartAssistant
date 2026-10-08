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
    solid: "bg-rose-500 text-white dark:bg-rose-400 dark:text-rose-950",
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
    solid: "bg-orange-500 text-white dark:text-orange-950",
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

/**
 * "Now" / "Today" everywhere: light blue with a blue ring (weather hours and
 * days, the planner's week strip and calendars), and the same blue for the word.
 */
export const TODAY_RING = "bg-sky-500/14 ring-2 ring-sky-500/50 ring-inset dark:ring-sky-300/50";
/** Today while it is also the selected day. */
export const TODAY_RING_STRONG = "bg-sky-500/26 ring-2 ring-sky-500 ring-inset dark:bg-sky-400/28 dark:ring-sky-300";
/** The blue of "Today" as a word (titles, labels). */
export const TODAY_COLOR = "text-sky-700 dark:text-sky-300";
export const TODAY_TEXT = `font-bold ${TODAY_COLOR}`;
/** A picked day that isn't today: grey like the weather's selected day, with a clear border. */
export const SELECTED_DAY = "bg-surface-hover shadow-sm ring-2 ring-slate-400/55 ring-inset dark:ring-white/40";
