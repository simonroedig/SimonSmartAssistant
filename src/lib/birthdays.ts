import { type DayKey, diffInDays } from "./date";

/** What the planner needs to know about a birthday (the year is optional). */
export type BirthdayDate = { name: string; month: number; day: number; year: number | null };

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Whether day/month (and the optional year) form a real date. */
export function isValidBirthday(day: number, month: number, year: number | null): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || month < 1 || month > 12 || day < 1) return false;
  if (day > DAYS_IN_MONTH[month - 1]) return false;
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) return false;
  return !(month === 2 && day === 29 && year !== null && !isLeapYear(year));
}

/** The day the birthday is celebrated in `year` (29 February → 28 February in other years). */
export function birthdayIn(b: Pick<BirthdayDate, "month" | "day">, year: number): DayKey {
  const day = b.month === 2 && b.day === 29 && !isLeapYear(year) ? 28 : b.day;
  return `${year}-${String(b.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isBirthdayOn(b: Pick<BirthdayDate, "month" | "day">, day: DayKey): boolean {
  return birthdayIn(b, Number(day.slice(0, 4))) === day;
}

/** The age reached on that day's birthday, if the year is known. */
export function ageOn(b: Pick<BirthdayDate, "year">, day: DayKey): number | null {
  if (b.year === null) return null;
  const age = Number(day.slice(0, 4)) - b.year;
  return age >= 0 ? age : null;
}

/** The next birthday from `today` on (today included). */
export function nextBirthday(b: Pick<BirthdayDate, "month" | "day">, today: DayKey): DayKey {
  const year = Number(today.slice(0, 4));
  const thisYear = birthdayIn(b, year);
  return diffInDays(thisYear, today) >= 0 ? thisYear : birthdayIn(b, year + 1);
}

function possessive(name: string): string {
  return /[sxzß]$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** "Anna turns 30" when the year is known, otherwise "Anna's birthday". */
export function birthdayLabel(b: BirthdayDate, day: DayKey): string {
  const age = ageOn(b, day);
  return age !== null && age > 0 ? `${b.name} turns ${age}` : `${possessive(b.name)} birthday`;
}
