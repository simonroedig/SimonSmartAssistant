import { describe, expect, it } from "vitest";
import { findFreeSlot, layoutBlocks } from "./planner-layout";

const block = (id: string, start: number, end: number) => ({ id, start_min: start, end_min: end });

describe("layoutBlocks", () => {
  it("gives non-overlapping blocks the full width", () => {
    const result = layoutBlocks([block("a", 540, 600), block("b", 600, 660)]);
    expect(result.map((b) => [b.id, b.column, b.columns])).toEqual([
      ["a", 0, 1],
      ["b", 0, 1],
    ]);
  });

  it("puts overlapping blocks side by side", () => {
    const result = layoutBlocks([block("a", 540, 660), block("b", 570, 600), block("c", 600, 630)]);
    const byId = Object.fromEntries(result.map((b) => [b.id, b]));
    expect(byId.a).toMatchObject({ column: 0, columns: 2 });
    expect(byId.b).toMatchObject({ column: 1, columns: 2 });
    // c reuses the column freed by b.
    expect(byId.c).toMatchObject({ column: 1, columns: 2 });
  });

  it("handles three-way overlaps", () => {
    const result = layoutBlocks([block("a", 0, 120), block("b", 30, 90), block("c", 60, 100)]);
    expect(result.every((b) => b.columns === 3)).toBe(true);
    expect(new Set(result.map((b) => b.column)).size).toBe(3);
  });
});

describe("findFreeSlot", () => {
  it("finds the first gap", () => {
    const blocks = [block("a", 540, 600), block("b", 600, 720)];
    expect(findFreeSlot(blocks, 60, 540)).toBe(720);
    expect(findFreeSlot(blocks, 30, 500)).toBe(510);
  });

  it("returns null when the day is full", () => {
    expect(findFreeSlot([block("a", 0, 1440)], 30, 0)).toBeNull();
  });
});
