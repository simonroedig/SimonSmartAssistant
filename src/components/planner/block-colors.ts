import type { BlockColor } from "@/data/planner";

type ColorStyle = { bg: string; bar: string; text: string; swatch: string; ring: string };

/** Static class names per block colour (Tailwind needs literal strings). */
export const BLOCK_STYLES: Record<BlockColor, ColorStyle> = {
  violet: {
    bg: "bg-violet-500/14 dark:bg-violet-400/16",
    bar: "bg-violet-500 dark:bg-violet-400",
    text: "text-violet-950 dark:text-violet-50",
    swatch: "bg-violet-500",
    ring: "ring-violet-500/50",
  },
  indigo: {
    bg: "bg-indigo-500/14 dark:bg-indigo-400/16",
    bar: "bg-indigo-500 dark:bg-indigo-400",
    text: "text-indigo-950 dark:text-indigo-50",
    swatch: "bg-indigo-500",
    ring: "ring-indigo-500/50",
  },
  sky: {
    bg: "bg-sky-500/14 dark:bg-sky-400/16",
    bar: "bg-sky-500 dark:bg-sky-400",
    text: "text-sky-950 dark:text-sky-50",
    swatch: "bg-sky-500",
    ring: "ring-sky-500/50",
  },
  teal: {
    bg: "bg-teal-500/14 dark:bg-teal-400/16",
    bar: "bg-teal-500 dark:bg-teal-400",
    text: "text-teal-950 dark:text-teal-50",
    swatch: "bg-teal-500",
    ring: "ring-teal-500/50",
  },
  emerald: {
    bg: "bg-emerald-500/14 dark:bg-emerald-400/16",
    bar: "bg-emerald-500 dark:bg-emerald-400",
    text: "text-emerald-950 dark:text-emerald-50",
    swatch: "bg-emerald-500",
    ring: "ring-emerald-500/50",
  },
  lime: {
    bg: "bg-lime-500/16 dark:bg-lime-400/16",
    bar: "bg-lime-500 dark:bg-lime-400",
    text: "text-lime-950 dark:text-lime-50",
    swatch: "bg-lime-500",
    ring: "ring-lime-500/50",
  },
  amber: {
    bg: "bg-amber-500/16 dark:bg-amber-400/16",
    bar: "bg-amber-500 dark:bg-amber-400",
    text: "text-amber-950 dark:text-amber-50",
    swatch: "bg-amber-500",
    ring: "ring-amber-500/50",
  },
  orange: {
    bg: "bg-orange-500/14 dark:bg-orange-400/16",
    bar: "bg-orange-500 dark:bg-orange-400",
    text: "text-orange-950 dark:text-orange-50",
    swatch: "bg-orange-500",
    ring: "ring-orange-500/50",
  },
  rose: {
    bg: "bg-rose-500/14 dark:bg-rose-400/16",
    bar: "bg-rose-500 dark:bg-rose-400",
    text: "text-rose-950 dark:text-rose-50",
    swatch: "bg-rose-500",
    ring: "ring-rose-500/50",
  },
  pink: {
    bg: "bg-pink-500/14 dark:bg-pink-400/16",
    bar: "bg-pink-500 dark:bg-pink-400",
    text: "text-pink-950 dark:text-pink-50",
    swatch: "bg-pink-500",
    ring: "ring-pink-500/50",
  },
  slate: {
    bg: "bg-slate-500/14 dark:bg-slate-300/12",
    bar: "bg-slate-500 dark:bg-slate-300",
    text: "text-slate-950 dark:text-slate-50",
    swatch: "bg-slate-500",
    ring: "ring-slate-500/50",
  },
};

export function blockStyle(color: string): ColorStyle {
  return BLOCK_STYLES[(color as BlockColor) in BLOCK_STYLES ? (color as BlockColor) : "violet"];
}
