export const MINUTES_PER_DAY = 24 * 60;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 450 → "07:30". Values ≥ 24h wrap around (e.g. a bedtime of 00:30). */
export function formatMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Same as formatMinutes, but 1440 renders as "24:00" (end of day). */
export function formatEndMinutes(minutes: number): string {
  return minutes === MINUTES_PER_DAY ? "24:00" : formatMinutes(minutes);
}

/** "07:30" → 450. Returns null for invalid input. */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,2})[:.](\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
  return h * 60 + m;
}

export function snapMinutes(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** 90 → "1h 30m", 45 → "45m", 120 → "2h". */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Human "time left" for the current block, e.g. "noch 25 min" style but English. */
export function formatRemaining(minutes: number): string {
  if (minutes < 1) return "less than a minute left";
  return `${formatDuration(minutes)} left`;
}
