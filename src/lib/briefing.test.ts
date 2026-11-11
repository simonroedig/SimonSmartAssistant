import { describe, expect, it } from "vitest";
import { briefingState, datedItem } from "./briefing";

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

describe("datedItem", () => {
  const written = new Date(2026, 10, 10, 7, 43);
  const t = (text: string) => ({ type: "text" as const, text });
  const link = (label: string, href: string) => ({ type: "link" as const, href, children: [t(label)] });

  it("reads the date at the start, the rest is the title, the source link the notes", () => {
    expect(
      datedItem([t("15.11. – NFL in der Allianz Arena "), link("Quelle", "https://example.com/nfl")], written),
    ).toEqual({
      day: "2026-11-15",
      title: "NFL in der Allianz Arena",
      source: "https://example.com/nfl",
    });
  });

  it("knows ranges, bold dates, month names and the turn of the year", () => {
    expect(datedItem([{ type: "bold", children: [t("20.11.–24.12.")] }, t(": Christkindlmarkt")], written)?.day).toBe(
      "2026-11-20",
    );
    expect(datedItem([t("3. Dezember – Ein Termin")], written)?.day).toBe("2026-12-03");
    expect(datedItem([t("6.1. – Heilige Drei Könige")], written)?.day).toBe("2027-01-06");
    expect(datedItem([t("1.11.2026 – Allerheiligen")], written)?.day).toBe("2026-11-01");
  });

  it("leaves lines without a date at the start alone", () => {
    expect(datedItem([t("KI-Gipfel in Paris am 3.11.")], written)).toBeNull();
    expect(datedItem([t("3.11.")], written)).toBeNull();
    expect(datedItem([t("31.2. – Kein Tag")], written)).toBeNull();
  });
});
