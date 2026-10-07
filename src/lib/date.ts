/**
 * Calendar helpers. Days are handled as local "YYYY-MM-DD" keys so the planner
 * never suffers from time-zone or DST surprises. Display texts are English with
 * German ordering, e.g. "Tuesday, 6 October 2026", "13:10", "06.10.2026".
 */

export type DayKey = string;

const LOCALE = "de-DE";

export function toDayKey(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDayKey(fromDayKey(value)) === value;
}

export function todayKey(now: Date = new Date()): DayKey {
  return toDayKey(now);
}

export function addDays(key: DayKey, amount: number): DayKey {
  const date = fromDayKey(key);
  date.setDate(date.getDate() + amount);
  return toDayKey(date);
}

/** Monday = 0 … Sunday = 6 */
export function weekdayIndex(key: DayKey): number {
  return (fromDayKey(key).getDay() + 6) % 7;
}

export function startOfWeek(key: DayKey): DayKey {
  return addDays(key, -weekdayIndex(key));
}

export function weekDays(key: DayKey): DayKey[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function diffInDays(a: DayKey, b: DayKey): number {
  const ms = fromDayKey(a).getTime() - fromDayKey(b).getTime();
  return Math.round(ms / 86_400_000);
}

/** ISO-8601 week number (German "KW", shown as "Week"). */
export function isoWeek(key: DayKey): number {
  const date = fromDayKey(key);
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

// Words are English, the order is German: day before month, 24-hour clock,
// numeric dates as 06.10.2026. Composed by hand so every browser shows the
// exact same text (ICU versions disagree on commas for en-GB).
const WORDS = "en-GB";
const weekdayLongFormat = new Intl.DateTimeFormat(WORDS, { weekday: "long" });
const weekdayShortFormat = new Intl.DateTimeFormat(WORDS, { weekday: "short" });
const monthLongFormat = new Intl.DateTimeFormat(WORDS, { month: "long" });
const monthShortFormat = new Intl.DateTimeFormat(WORDS, { month: "short" });
const numericDateFormat = new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });

/** "Tuesday, 6 October 2026" */
export function formatLongDate(date: Date): string {
  return `${formatWeekday(date)}, ${formatDayMonthYear(date)}`;
}

/** "Tuesday" */
export function formatWeekday(date: Date): string {
  return weekdayLongFormat.format(date);
}

/** "Tue" */
export function formatWeekdayShort(date: Date): string {
  return weekdayShortFormat.format(date).replace(".", "");
}

/** "6 October" */
export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${monthLongFormat.format(date)}`;
}

/** "6 Oct" */
export function formatDayMonthShort(date: Date): string {
  return `${date.getDate()} ${monthShortFormat.format(date).replace(".", "")}`;
}

/** "6 October 2026" */
export function formatDayMonthYear(date: Date): string {
  return `${formatDayMonth(date)} ${date.getFullYear()}`;
}

/** "06.10.2026" */
export function formatNumericDate(date: Date): string {
  return numericDateFormat.format(date);
}

/** "13:10" */
export function formatTime(date: Date): string {
  return timeFormat.format(date);
}

/** "October 2026" */
export function formatMonthYear(date: Date): string {
  return `${monthLongFormat.format(date)} ${date.getFullYear()}`;
}

/** "October" */
export function formatMonth(date: Date): string {
  return monthLongFormat.format(date);
}

/** Relative label for a day: "Today", "Tomorrow", "Yesterday" or "Friday, 9 October". */
export function relativeDayLabel(key: DayKey, today: DayKey): string {
  const diff = diffInDays(key, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const date = fromDayKey(key);
  return `${formatWeekday(date)}, ${formatDayMonth(date)}`;
}

/** Due-date chip text for todos. */
export function dueLabel(key: DayKey, today: DayKey): { text: string; tone: "overdue" | "today" | "soon" | "later" } {
  const diff = diffInDays(key, today);
  if (diff < 0) {
    return { text: diff === -1 ? "Yesterday" : formatDayMonthShort(fromDayKey(key)), tone: "overdue" };
  }
  if (diff === 0) return { text: "Today", tone: "today" };
  if (diff === 1) return { text: "Tomorrow", tone: "soon" };
  if (diff < 7) return { text: formatWeekday(fromDayKey(key)), tone: "soon" };
  return { text: formatDayMonthShort(fromDayKey(key)), tone: "later" };
}

/** Greeting that follows the time of day. */
export function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}
