export type TimedItem = { id: string; start_min: number; end_min: number };
export type Positioned<T> = T & { column: number; columns: number };

/**
 * Lays out overlapping blocks side by side, like a calendar day view.
 * Blocks that overlap (directly or through a chain) form a cluster; inside a
 * cluster every block gets the first free column, and all blocks of the cluster
 * share the cluster's column count.
 */
export function layoutBlocks<T extends TimedItem>(items: T[]): Positioned<T>[] {
  const sorted = [...items].sort(
    (a, b) =>
      a.start_min - b.start_min || b.end_min - b.start_min - (a.end_min - a.start_min) || a.id.localeCompare(b.id),
  );

  const result: Positioned<T>[] = [];
  let cluster: Positioned<T>[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const columns = columnEnds.length;
    for (const item of cluster) item.columns = columns;
    result.push(...cluster);
    cluster = [];
    columnEnds = [];
  };

  for (const item of sorted) {
    if (item.start_min >= clusterEnd && cluster.length > 0) flush();

    let column = columnEnds.findIndex((end) => end <= item.start_min);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end_min);
    } else {
      columnEnds[column] = item.end_min;
    }

    cluster.push({ ...item, column, columns: 1 });
    clusterEnd = cluster.length === 1 ? item.end_min : Math.max(clusterEnd, item.end_min);
  }
  if (cluster.length > 0) flush();

  return result;
}

/** First free slot of `duration` minutes at or after `from` that avoids existing blocks. */
export function findFreeSlot(
  items: TimedItem[],
  duration: number,
  from: number,
  until = 24 * 60,
  step = 15,
): number | null {
  const start = Math.ceil(from / step) * step;
  const sorted = [...items].sort((a, b) => a.start_min - b.start_min);
  for (let t = start; t + duration <= until; t += step) {
    const clash = sorted.some((b) => t < b.end_min && t + duration > b.start_min);
    if (!clash) return t;
  }
  return null;
}
