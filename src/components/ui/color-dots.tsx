import { cn } from "@/lib/utils";

/**
 * A row of coloured dots under a day (one per planned block). However many there are,
 * all of them fit: the dots shrink evenly once the row would get wider than the day.
 */
export function ColorDots({
  colors,
  leading,
  size,
  className,
}: {
  /** Background classes, one per dot. */
  colors: string[];
  /** Small icons in front of the dots (birthday, clock change). */
  leading?: React.ReactNode;
  /** The dots' full size in px. */
  size: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex w-full items-center justify-center px-1",
        colors.length > 4 ? "gap-px" : "gap-0.5",
        className,
      )}
      style={{ height: size }}
    >
      {leading}
      {colors.map((color, i) => (
        <span
          key={i}
          data-dot=""
          className={cn("aspect-square min-w-0 flex-1 rounded-full", color)}
          style={{ maxWidth: size }}
        />
      ))}
    </span>
  );
}
