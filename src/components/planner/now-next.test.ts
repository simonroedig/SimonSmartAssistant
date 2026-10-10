import { describe, expect, it } from "vitest";
import type { PlanBlock } from "@/data/core";
import { nowAndNext } from "./use-planner";

const block = (id: string, start: number, end: number, done = false) =>
  ({ id, title: id, start_min: start, end_min: end, done }) as PlanBlock;

describe("now and next", () => {
  it("skips blocks that are already ticked off", () => {
    const blocks = [block("early", 480, 540), block("done", 600, 660, true), block("later", 720, 780)];
    expect(nowAndNext(blocks, 550).next?.id).toBe("later");
    expect(nowAndNext(blocks, 610).current).toBeNull();
    expect(nowAndNext([block("done", 600, 660, true)], 550).next).toBeNull();
  });
});
