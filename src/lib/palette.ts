/**
 * The colours the user picks for things – planner blocks and note categories
 * share them. Distinct at a glance: three blues, two greens, one yellow, one
 * orange, two reds, a grey.
 */
export const PALETTE_COLORS = [
  "violet",
  "indigo",
  "blue",
  "sky",
  "emerald",
  "lime",
  "yellow",
  "orange",
  "rose",
  "pink",
  "slate",
] as const;
export type PaletteColor = (typeof PALETTE_COLORS)[number];

export type PaletteStyle = {
  /** Name for screen readers and tooltips. */
  label: string;
  /** Soft tint (a block, a picked chip, a tag). */
  bg: string;
  /** Strong stripe (a block's edge). */
  bar: string;
  /** Text on the tint, near black or white. */
  text: string;
  /** Text and icons in the colour itself (a chip's or tag's label). */
  ink: string;
  /** Solid dot or swatch, and what goes on top of it. */
  swatch: string;
  onSwatch: string;
  ring: string;
};

/** Static class names per colour (Tailwind needs literal strings). */
export const PALETTE: Record<PaletteColor, PaletteStyle> = {
  violet: {
    label: "Violet",
    bg: "bg-violet-500/14 dark:bg-violet-400/16",
    bar: "bg-violet-500 dark:bg-violet-400",
    text: "text-violet-950 dark:text-violet-50",
    ink: "text-violet-600 dark:text-violet-300",
    swatch: "bg-violet-500",
    onSwatch: "text-white",
    ring: "ring-violet-500/50",
  },
  indigo: {
    label: "Indigo",
    bg: "bg-indigo-500/14 dark:bg-indigo-400/16",
    bar: "bg-indigo-500 dark:bg-indigo-400",
    text: "text-indigo-950 dark:text-indigo-50",
    ink: "text-indigo-600 dark:text-indigo-300",
    swatch: "bg-indigo-500",
    onSwatch: "text-white",
    ring: "ring-indigo-500/50",
  },
  blue: {
    label: "Blue",
    bg: "bg-blue-600/14 dark:bg-blue-500/22",
    bar: "bg-blue-600 dark:bg-blue-500",
    text: "text-blue-950 dark:text-blue-50",
    ink: "text-blue-700 dark:text-blue-300",
    swatch: "bg-blue-600",
    onSwatch: "text-white",
    ring: "ring-blue-600/50",
  },
  sky: {
    label: "Light blue",
    bg: "bg-sky-500/14 dark:bg-sky-400/16",
    bar: "bg-sky-500 dark:bg-sky-400",
    text: "text-sky-950 dark:text-sky-50",
    ink: "text-sky-600 dark:text-sky-300",
    swatch: "bg-sky-500",
    onSwatch: "text-white",
    ring: "ring-sky-500/50",
  },
  emerald: {
    label: "Green",
    bg: "bg-emerald-500/14 dark:bg-emerald-400/16",
    bar: "bg-emerald-500 dark:bg-emerald-400",
    text: "text-emerald-950 dark:text-emerald-50",
    ink: "text-emerald-600 dark:text-emerald-300",
    swatch: "bg-emerald-500",
    onSwatch: "text-white",
    ring: "ring-emerald-500/50",
  },
  lime: {
    label: "Lime",
    bg: "bg-lime-500/16 dark:bg-lime-400/16",
    bar: "bg-lime-500 dark:bg-lime-400",
    text: "text-lime-950 dark:text-lime-50",
    ink: "text-lime-700 dark:text-lime-300",
    swatch: "bg-lime-500",
    onSwatch: "text-lime-950",
    ring: "ring-lime-500/50",
  },
  yellow: {
    label: "Yellow",
    bg: "bg-yellow-400/24 dark:bg-yellow-300/16",
    bar: "bg-yellow-400 dark:bg-yellow-300",
    text: "text-yellow-950 dark:text-yellow-50",
    ink: "text-yellow-700 dark:text-yellow-300",
    swatch: "bg-yellow-400",
    onSwatch: "text-yellow-950",
    ring: "ring-yellow-500/50",
  },
  orange: {
    label: "Orange",
    bg: "bg-orange-500/14 dark:bg-orange-400/16",
    bar: "bg-orange-500 dark:bg-orange-400",
    text: "text-orange-950 dark:text-orange-50",
    ink: "text-orange-600 dark:text-orange-300",
    swatch: "bg-orange-500",
    onSwatch: "text-white",
    ring: "ring-orange-500/50",
  },
  rose: {
    label: "Red",
    bg: "bg-rose-500/14 dark:bg-rose-400/16",
    bar: "bg-rose-500 dark:bg-rose-400",
    text: "text-rose-950 dark:text-rose-50",
    ink: "text-rose-600 dark:text-rose-300",
    swatch: "bg-rose-500",
    onSwatch: "text-white",
    ring: "ring-rose-500/50",
  },
  pink: {
    label: "Pink",
    bg: "bg-pink-500/14 dark:bg-pink-400/16",
    bar: "bg-pink-500 dark:bg-pink-400",
    text: "text-pink-950 dark:text-pink-50",
    ink: "text-pink-600 dark:text-pink-300",
    swatch: "bg-pink-500",
    onSwatch: "text-white",
    ring: "ring-pink-500/50",
  },
  slate: {
    label: "Grey",
    bg: "bg-slate-500/14 dark:bg-slate-300/12",
    bar: "bg-slate-500 dark:bg-slate-300",
    text: "text-slate-950 dark:text-slate-50",
    ink: "text-slate-600 dark:text-slate-300",
    swatch: "bg-slate-500",
    onSwatch: "text-white",
    ring: "ring-slate-500/50",
  },
};

export function isPaletteColor(color: string): color is PaletteColor {
  return (PALETTE_COLORS as readonly string[]).includes(color);
}

/** A stored colour's style; anything unknown (an old colour) gets the fallback. */
export function paletteStyle(color: string, fallback: PaletteColor = "violet"): PaletteStyle {
  return PALETTE[isPaletteColor(color) ? color : fallback];
}
