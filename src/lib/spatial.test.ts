import { describe, expect, it } from "vitest";
import { type Box, pickNext } from "./spatial";

const box = (left: number, top: number, width = 100, height = 50): Box => ({ left, top, width, height });

// A grid of tiles:   [0] [1] [2]
//                    [3] [4] [5]
const grid = [box(0, 0), box(120, 0), box(240, 0), box(0, 80), box(120, 80), box(240, 80)];

describe("TV remote focus", () => {
  it("moves to the neighbour in each direction", () => {
    expect(pickNext(grid[4], grid, "left")).toBe(3);
    expect(pickNext(grid[4], grid, "right")).toBe(5);
    expect(pickNext(grid[4], grid, "up")).toBe(1);
    expect(pickNext(grid[1], grid, "down")).toBe(4);
  });

  it("stays put at the edges", () => {
    expect(pickNext(grid[0], grid, "left")).toBe(-1);
    expect(pickNext(grid[0], grid, "up")).toBe(-1);
    expect(pickNext(grid[5], grid, "right")).toBe(-1);
  });

  it("prefers the same row over a closer one diagonally", () => {
    const row = [box(0, 0, 100, 40), box(300, 0, 100, 40), box(110, 60, 100, 40)];
    expect(pickNext(row[0], row, "right")).toBe(1);
  });

  it("goes down to a wide button under several small ones", () => {
    const layout = [box(0, 0, 60, 40), box(70, 0, 60, 40), box(140, 0, 60, 40), box(0, 60, 200, 50)];
    expect(pickNext(layout[2], layout, "down")).toBe(3);
  });
});
