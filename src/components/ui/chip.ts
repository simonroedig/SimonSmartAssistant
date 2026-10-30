/**
 * Filter chips (note categories, media tabs, seasons). Picking one changes only its
 * fill and text colour, smoothly; its frame switches at once – an animated border
 * would start from the text colour and flash light on the chip just left.
 */
export const CHIP =
  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-transparent px-3.5 text-sm font-medium whitespace-nowrap transition-[background-color,color] duration-150 select-none [-webkit-touch-callout:none]";
export const CHIP_IDLE = "text-muted well hover:text-fg";
/** Picked: tinted, with a thin ring in its colour – clear even for a grey category on a light page. */
export const CHIP_ON = "font-semibold ring-[1.5px] ring-current/45 ring-inset";
