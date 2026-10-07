import { describe, expect, it } from "vitest";
import { byPosition, positionAtEnd, positionAtStart, positionForMove } from "./ordering";

const list = [
  { id: "a", position: 1 },
  { id: "b", position: 2 },
  { id: "c", position: 3 },
  { id: "d", position: 4 },
];

describe("manual ordering", () => {
  it("places new items at the start or the end", () => {
    expect(positionAtStart(list)).toBe(0);
    expect(positionAtEnd(list)).toBe(5);
    expect(positionAtStart([])).toBe(0);
  });

  it("moves an item between its new neighbours", () => {
    // d to the second slot: between a and b
    expect(positionForMove(list, "d", 1)).toBe(1.5);
    // a to the end
    expect(positionForMove(list, "a", 3)).toBe(5);
    // c to the top
    expect(positionForMove(list, "c", 0)).toBe(0);
  });

  it("produces the expected order after a move", () => {
    const moved = list.map((i) => (i.id === "d" ? { ...i, position: positionForMove(list, "d", 1) } : i));
    expect([...moved].sort(byPosition).map((i) => i.id)).toEqual(["a", "d", "b", "c"]);
  });
});
