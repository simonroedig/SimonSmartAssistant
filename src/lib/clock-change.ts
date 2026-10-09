import { addDays, type DayKey, weekdayIndex } from "./date";

/**
 * Daylight saving time in the EU: clocks go forward on the last Sunday of
 * March (02:00 → 03:00) and back on the last Sunday of October (03:00 → 02:00).
 */
export type ClockChange = {
  forward: boolean;
  name: string;
  nameDe: string;
  /** What happens, e.g. "03:00 → 02:00 · 1 hour more sleep". */
  detail: string;
};

function lastSunday(year: number, month: number): DayKey {
  const last = new Date(year, month, 0).getDate();
  const key = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  // weekdayIndex: Monday = 0 … Sunday = 6.
  return addDays(key, -((weekdayIndex(key) + 1) % 7));
}

export function clockChangeOn(day: DayKey): ClockChange | null {
  const year = Number(day.slice(0, 4));
  if (day === lastSunday(year, 3)) {
    return {
      forward: true,
      name: "Clocks go forward",
      nameDe: "Zeitumstellung auf Sommerzeit",
      detail: "02:00 → 03:00 · 1 hour less sleep",
    };
  }
  if (day === lastSunday(year, 10)) {
    return {
      forward: false,
      name: "Clocks go back",
      nameDe: "Zeitumstellung auf Winterzeit",
      detail: "03:00 → 02:00 · 1 hour more sleep",
    };
  }
  return null;
}
