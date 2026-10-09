import { describe, expect, it } from "vitest";
import { ageOn, birthdayIn, birthdayLabel, isBirthdayOn, isValidBirthday, nextBirthday } from "./birthdays";
import { clockChangeOn } from "./clock-change";
import { calendarDayOf, easterSunday, holidaysOfYear } from "./holidays";

describe("easterSunday", () => {
  it("matches known dates", () => {
    expect(easterSunday(2024)).toBe("2024-03-31");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
    expect(easterSunday(2038)).toBe("2038-04-25");
  });
});

describe("holidays", () => {
  it("knows the Bavarian holidays of 2026 (Munich)", () => {
    const names = [...holidaysOfYear(2026, "BY")]
      .filter(([, d]) => d.kind === "holiday")
      .map(([day, d]) => `${day} ${d.name}`);
    expect(names).toEqual([
      "2026-01-01 New Year's Day",
      "2026-01-06 Epiphany",
      "2026-04-03 Good Friday",
      "2026-04-05 Easter Sunday",
      "2026-04-06 Easter Monday",
      "2026-05-01 Labour Day",
      "2026-05-14 Ascension Day",
      "2026-05-24 Whit Sunday",
      "2026-05-25 Whit Monday",
      "2026-06-04 Corpus Christi",
      "2026-08-15 Assumption Day",
      "2026-10-03 German Unity Day",
      "2026-11-01 All Saints' Day",
      "2026-12-25 Christmas Day",
      "2026-12-26 Boxing Day",
    ]);
  });

  it("says when shops are closed, open or close early", () => {
    expect(calendarDayOf("2026-10-03", "BY")).toMatchObject({
      nameDe: "Tag der Deutschen Einheit",
      shops: "closed",
      shopsLabel: "Shops closed",
    });
    expect(calendarDayOf("2026-12-24", "BY")?.nameDe).toBe("Heiligabend");
    expect(calendarDayOf("2026-11-18", "BY")?.nameDe).toBe("Buß- und Bettag");
    // Repentance Day: a holiday in Saxony only; in Bavaria schools are closed but shops open.
    expect(calendarDayOf("2026-11-18", "BY")).toMatchObject({ kind: "observance", shops: "open" });
    expect(calendarDayOf("2026-11-18", "SN")).toMatchObject({ kind: "holiday", shops: "closed" });
    expect(calendarDayOf("2026-11-18", "BE")).toBeNull();
    // Christmas Eve on a Thursday: shops until 14:00; on a Sunday (2028): closed.
    expect(calendarDayOf("2026-12-24", "BY")).toMatchObject({ shops: "short", shopsLabel: "Shops close at 14:00" });
    expect(calendarDayOf("2028-12-24", "BY")).toMatchObject({ shops: "closed" });
    expect(calendarDayOf("2026-10-08", "BY")).toBeNull();
  });

  it("differs between states", () => {
    expect(calendarDayOf("2026-10-31", "BY")).toBeNull();
    expect(calendarDayOf("2026-10-31", "HH")?.name).toBe("Reformation Day");
    expect(calendarDayOf("2016-10-31", "HH")).toBeNull();
    expect(calendarDayOf("2017-10-31", "BY")?.name).toBe("Reformation Day");
    expect(calendarDayOf("2026-03-08", "BE")?.name).toBe("International Women's Day");
    expect(calendarDayOf("2026-01-06", "BE")).toBeNull();
    expect(calendarDayOf("2026-06-04", "NI")).toBeNull();
    expect(calendarDayOf("2026-09-20", "TH")?.name).toBe("World Children's Day");
  });
});

describe("birthdays", () => {
  const anna = { name: "Anna", month: 3, day: 14, year: 1990 };
  const leap = { name: "Jonas", month: 2, day: 29, year: null };

  it("validates dates", () => {
    expect(isValidBirthday(14, 3, 1990)).toBe(true);
    expect(isValidBirthday(31, 4, null)).toBe(false);
    expect(isValidBirthday(29, 2, null)).toBe(true);
    expect(isValidBirthday(29, 2, 2001)).toBe(false);
    expect(isValidBirthday(29, 2, 2000)).toBe(true);
  });

  it("finds the day, the age and the next one", () => {
    expect(isBirthdayOn(anna, "2026-03-14")).toBe(true);
    expect(ageOn(anna, "2026-03-14")).toBe(36);
    expect(birthdayLabel(anna, "2026-03-14")).toBe("Anna turns 36");
    expect(birthdayLabel(leap, "2026-02-28")).toBe("Jonas' birthday");
    expect(birthdayIn(leap, 2026)).toBe("2026-02-28");
    expect(birthdayIn(leap, 2028)).toBe("2028-02-29");
    expect(nextBirthday(anna, "2026-10-08")).toBe("2027-03-14");
    expect(nextBirthday(anna, "2026-03-14")).toBe("2026-03-14");
  });
});

describe("clock changes", () => {
  it("falls on the last Sunday of March and October", () => {
    expect(clockChangeOn("2026-10-25")).toMatchObject({ forward: false, detail: "03:00 → 02:00 · 1 hour more sleep" });
    expect(clockChangeOn("2026-03-29")).toMatchObject({ forward: true });
    expect(clockChangeOn("2027-03-28")?.forward).toBe(true);
    expect(clockChangeOn("2027-10-31")?.forward).toBe(false);
    expect(clockChangeOn("2026-10-18")).toBeNull();
  });
});
