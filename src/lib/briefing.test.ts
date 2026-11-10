import { describe, expect, it } from "vitest";
import { briefingState } from "./briefing";

const at = (iso: string, extra: Partial<{ status: string; read_at: string | null }> = {}) => ({
  status: "ok",
  read_at: null,
  created_at: new Date(iso).toISOString(),
  ...extra,
});

describe("briefing state", () => {
  const morning = new Date("2026-11-10T08:30:00");
  const noon = new Date("2026-11-10T12:00:00");

  it("today's briefing is new until it's opened", () => {
    expect(briefingState([at("2026-11-10T07:50:00")], morning)).toMatchObject({ today: true, unread: true });
    expect(briefingState([at("2026-11-10T07:50:00", { read_at: "2026-11-10T08:00:00Z" })], morning)).toMatchObject({
      today: true,
      unread: false,
      missing: false,
    });
  });

  it("a failed run is told apart, and nothing by mid-morning counts as missing", () => {
    expect(briefingState([at("2026-11-10T07:50:00", { status: "error" })], morning)).toMatchObject({
      failed: true,
      unread: false,
    });
    const yesterday = [at("2026-11-09T07:50:00")];
    expect(briefingState(yesterday, morning)).toMatchObject({ today: false, missing: false });
    expect(briefingState(yesterday, noon)).toMatchObject({ today: false, missing: true, unread: false });
    expect(briefingState([], noon)).toMatchObject({ latest: null, missing: true });
  });
});
