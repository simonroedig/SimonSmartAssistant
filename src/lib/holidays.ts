import { addDays, type DayKey, weekdayIndex } from "./date";

/**
 * German public holidays per state, worked out locally (no API needed: they
 * follow fixed dates and Easter), plus a few days worth knowing about for the
 * shops (Christmas Eve, New Year's Eve, Repentance Day in Bavaria).
 *
 * On public holidays (and Sundays) shops are closed everywhere in Germany.
 */

export type HolidayRegion =
  "BW" | "BY" | "BE" | "BB" | "HB" | "HH" | "HE" | "MV" | "NI" | "NW" | "RP" | "SL" | "SN" | "ST" | "SH" | "TH";

export const HOLIDAY_REGIONS: { id: HolidayRegion; name: string }[] = [
  { id: "BW", name: "Baden-Württemberg" },
  { id: "BY", name: "Bavaria" },
  { id: "BE", name: "Berlin" },
  { id: "BB", name: "Brandenburg" },
  { id: "HB", name: "Bremen" },
  { id: "HH", name: "Hamburg" },
  { id: "HE", name: "Hesse" },
  { id: "MV", name: "Mecklenburg-Vorpommern" },
  { id: "NI", name: "Lower Saxony" },
  { id: "NW", name: "North Rhine-Westphalia" },
  { id: "RP", name: "Rhineland-Palatinate" },
  { id: "SL", name: "Saarland" },
  { id: "SN", name: "Saxony" },
  { id: "ST", name: "Saxony-Anhalt" },
  { id: "SH", name: "Schleswig-Holstein" },
  { id: "TH", name: "Thuringia" },
];

export const DEFAULT_HOLIDAY_REGION: HolidayRegion = "BY";

export function isHolidayRegion(value: unknown): value is HolidayRegion {
  return HOLIDAY_REGIONS.some((r) => r.id === value);
}

export type CalendarDay = {
  name: string;
  /** "holiday": a public holiday; "observance": a working day worth knowing about. */
  kind: "holiday" | "observance";
  shops: "closed" | "short" | "open";
  /** What that means for shopping, e.g. "Shops closed". */
  shopsLabel: string;
};

/** Easter Sunday (Gregorian calendar, anonymous algorithm). */
export function easterSunday(year: number): DayKey {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const ALL = HOLIDAY_REGIONS.map((r) => r.id);

function fixed(year: number, month: number, day: number): DayKey {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Buß- und Bettag: the Wednesday before 23 November. */
function repentanceDay(year: number): DayKey {
  const nov22 = fixed(year, 11, 22);
  // weekdayIndex: Monday = 0 … Wednesday = 2.
  return addDays(nov22, -((weekdayIndex(nov22) - 2 + 7) % 7));
}

function reformationRegions(year: number): HolidayRegion[] {
  if (year === 2017) return ALL;
  const east: HolidayRegion[] = ["BB", "MV", "SN", "ST", "TH"];
  return year >= 2018 ? [...east, "HB", "HH", "NI", "SH"] : east;
}

function holiday(name: string): CalendarDay {
  return { name, kind: "holiday", shops: "closed", shopsLabel: "Shops closed" };
}

/** Christmas Eve and New Year's Eve: shorter opening hours, closed on a Sunday. */
function shortDay(name: string, day: DayKey, label: string): CalendarDay {
  return weekdayIndex(day) === 6
    ? { name, kind: "observance", shops: "closed", shopsLabel: "Shops closed" }
    : { name, kind: "observance", shops: "short", shopsLabel: label };
}

function buildYear(year: number, region: HolidayRegion): Map<DayKey, CalendarDay> {
  const easter = easterSunday(year);
  const days = new Map<DayKey, CalendarDay>();
  const add = (day: DayKey, info: CalendarDay, regions: HolidayRegion[] = ALL) => {
    if (regions.includes(region) && !days.has(day)) days.set(day, info);
  };

  add(fixed(year, 1, 1), holiday("New Year's Day"));
  add(fixed(year, 1, 6), holiday("Epiphany"), ["BW", "BY", "ST"]);
  const womensDay: HolidayRegion[] = [
    ...(year >= 2019 ? ["BE" as const] : []),
    ...(year >= 2023 ? ["MV" as const] : []),
  ];
  add(fixed(year, 3, 8), holiday("International Women's Day"), womensDay);
  add(addDays(easter, -2), holiday("Good Friday"));
  add(easter, holiday("Easter Sunday"));
  add(addDays(easter, 1), holiday("Easter Monday"));
  add(fixed(year, 5, 1), holiday("Labour Day"));
  if (year === 2020 || year === 2025) add(fixed(year, 5, 8), holiday("Liberation Day"), ["BE"]);
  add(addDays(easter, 39), holiday("Ascension Day"));
  add(addDays(easter, 49), holiday("Whit Sunday"));
  add(addDays(easter, 50), holiday("Whit Monday"));
  add(addDays(easter, 60), holiday("Corpus Christi"), ["BW", "BY", "HE", "NW", "RP", "SL"]);
  // Bavaria: in most of the state, Munich included.
  add(fixed(year, 8, 15), holiday("Assumption Day"), ["BY", "SL"]);
  add(fixed(year, 9, 20), holiday("World Children's Day"), year >= 2019 ? ["TH"] : []);
  add(fixed(year, 10, 3), holiday("German Unity Day"));
  add(fixed(year, 10, 31), holiday("Reformation Day"), reformationRegions(year));
  add(fixed(year, 11, 1), holiday("All Saints' Day"), ["BW", "BY", "NW", "RP", "SL"]);
  add(repentanceDay(year), holiday("Repentance Day"), ["SN"]);
  add(
    repentanceDay(year),
    { name: "Repentance Day", kind: "observance", shops: "open", shopsLabel: "No school · shops open" },
    ["BY"],
  );
  add(fixed(year, 12, 24), shortDay("Christmas Eve", fixed(year, 12, 24), "Shops close at 14:00"));
  add(fixed(year, 12, 25), holiday("Christmas Day"));
  add(fixed(year, 12, 26), holiday("Boxing Day"));
  add(fixed(year, 12, 31), shortDay("New Year's Eve", fixed(year, 12, 31), "Shops close early"));
  return days;
}

const cache = new Map<string, Map<DayKey, CalendarDay>>();

export function holidaysOfYear(year: number, region: HolidayRegion): Map<DayKey, CalendarDay> {
  const key = `${region}-${year}`;
  let days = cache.get(key);
  if (!days) {
    days = buildYear(year, region);
    cache.set(key, days);
  }
  return days;
}

/** The holiday (or notable day) on `day`, if any. */
export function calendarDayOf(day: DayKey, region: HolidayRegion): CalendarDay | null {
  return holidaysOfYear(Number(day.slice(0, 4)), region).get(day) ?? null;
}
