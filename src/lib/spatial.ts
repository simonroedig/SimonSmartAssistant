/**
 * TV remote: the arrow keys move the focus to the nearest button in that
 * direction (what TV apps do), instead of scrolling the page.
 */

export type Direction = "up" | "down" | "left" | "right";
export type Box = { left: number; top: number; width: number; height: number };

const center = (b: Box) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });

/**
 * The index of the box to go to from `from`, or -1. Boxes ahead in the direction
 * count; the closest wins, with sideways distance weighing more (staying in the
 * same row or column feels right) and boxes that overlap the current row/column
 * preferred.
 */
export function pickNext(from: Box, boxes: Box[], direction: Direction): number {
  const a = center(from);
  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((b, i) => {
    const c = center(b);
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const ahead =
      direction === "right"
        ? b.left >= from.left + from.width - 1 || (dx > 0 && b.left > from.left)
        : direction === "left"
          ? b.left + b.width <= from.left + 1 || (dx < 0 && b.left + b.width < from.left + from.width)
          : direction === "down"
            ? b.top >= from.top + from.height - 1 || (dy > 0 && b.top > from.top)
            : b.top + b.height <= from.top + 1 || (dy < 0 && b.top + b.height < from.top + from.height);
    if (!ahead) return;
    const horizontal = direction === "left" || direction === "right";
    const main = Math.abs(horizontal ? dx : dy);
    const side = Math.abs(horizontal ? dy : dx);
    // Overlapping the current row (or column) – no sideways penalty beyond a little.
    const overlaps = horizontal
      ? b.top < from.top + from.height && b.top + b.height > from.top
      : b.left < from.left + from.width && b.left + b.width > from.left;
    const score = main + (overlaps ? side * 0.3 : side * 2 + 240);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

export const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};
