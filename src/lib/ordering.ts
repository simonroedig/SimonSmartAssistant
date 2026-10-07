/**
 * Manual ordering with fractional positions: moving an item only rewrites that
 * one row (its new position lies between its new neighbours).
 */
export type Positioned = { id: string; position: number };

export function byPosition<T extends Positioned>(a: T, b: T): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

/** Position for an item that should go before everything in `items`. */
export function positionAtStart(items: Positioned[]): number {
  return items.length === 0 ? 0 : Math.min(...items.map((i) => i.position)) - 1;
}

/** Position for an item that should go after everything in `items`. */
export function positionAtEnd(items: Positioned[]): number {
  return items.length === 0 ? 0 : Math.max(...items.map((i) => i.position)) + 1;
}

/**
 * New position for `movedId` when it is dropped at `targetIndex` of the list
 * `ordered` (the list in its current order, still including the moved item).
 */
export function positionForMove(ordered: Positioned[], movedId: string, targetIndex: number): number {
  const rest = ordered.filter((i) => i.id !== movedId);
  const index = Math.max(0, Math.min(targetIndex, rest.length));
  const before = rest[index - 1];
  const after = rest[index];
  if (before && after) return (before.position + after.position) / 2;
  if (before) return before.position + 1;
  if (after) return after.position - 1;
  return 0;
}
