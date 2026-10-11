import { PALETTE, type PaletteStyle, paletteStyle } from "@/lib/palette";

/** Blocks use the shared palette (the same colours as note categories). */
export const BLOCK_STYLES = PALETTE;

export function blockStyle(color: string): PaletteStyle {
  return paletteStyle(color, "violet");
}
