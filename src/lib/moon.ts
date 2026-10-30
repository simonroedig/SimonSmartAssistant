/**
 * The moon's phase, worked out from the date (no lookup needed): days since a
 * known new moon, in units of the synodic month. Accurate to well under a day –
 * plenty to tell a crescent from a half or a full moon.
 */

const SYNODIC_MONTH = 29.530588853;
/** A new moon: 6 January 2000, 18:14 UTC. */
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** 0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
export function moonPhase(date: Date): number {
  const days = (date.getTime() - NEW_MOON) / 86_400_000;
  return (((days / SYNODIC_MONTH) % 1) + 1) % 1;
}

/** How much of the disc is lit (0 at new moon, 1 at full). */
export function moonLight(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

export type MoonIcon =
  | "moon-new"
  | "moon-waxing-crescent"
  | "moon-first-quarter"
  | "moon-waxing-gibbous"
  | "moon-full"
  | "moon-waning-gibbous"
  | "moon-last-quarter"
  | "moon-waning-crescent";

const ICONS: MoonIcon[] = [
  "moon-new",
  "moon-waxing-crescent",
  "moon-first-quarter",
  "moon-waxing-gibbous",
  "moon-full",
  "moon-waning-gibbous",
  "moon-last-quarter",
  "moon-waning-crescent",
];

/** The weather icon of the moon on that date (eight phases, each centred on its moment). */
export function moonIcon(date: Date): MoonIcon {
  return ICONS[Math.round(moonPhase(date) * 8) % 8];
}

export const MOON_LABEL: Record<MoonIcon, string> = {
  "moon-new": "New moon",
  "moon-waxing-crescent": "Waxing crescent",
  "moon-first-quarter": "Half moon (waxing)",
  "moon-waxing-gibbous": "Waxing moon",
  "moon-full": "Full moon",
  "moon-waning-gibbous": "Waning moon",
  "moon-last-quarter": "Half moon (waning)",
  "moon-waning-crescent": "Waning crescent",
};
